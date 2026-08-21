import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { desc, eq, sql } from "drizzle-orm";
import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/db";
import { auditLog, messages } from "@/db/schema";
import { audit, type AuditAction } from "@/lib/audit";
import { parseEnv } from "@/lib/env";
import { runAsk } from "@/lib/services/ask";
import { ensureCorpusIngested, researcher } from "./helpers";

beforeAll(async () => {
  await ensureCorpusIngested();
});

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (["node_modules", ".next", ".git", ".storage", "db"].includes(entry)) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, files);
    else if (/\.(ts|tsx)$/.test(entry)) files.push(full);
  }
  return files;
}

describe("hardening sweep (§B10.5, §B9)", () => {
  it("audit_log is insert-only by construction: no update/delete code path exists", () => {
    const sources = walk(process.cwd()).filter((f) => !f.includes(`tests${path.sep}`));
    const offenders: string[] = [];
    for (const file of sources) {
      const content = readFileSync(file, "utf-8");
      if (/\.update\(\s*auditLog\s*\)/.test(content) || /\.delete\(\s*auditLog\s*\)/.test(content)) {
        offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("every declared audit action writes and reads back", async () => {
    const actions: AuditAction[] = [
      "login",
      "upload",
      "approve",
      "reject",
      "search",
      "source_view",
      "export",
      "permission_change",
      "delete",
      "theme_edit",
      "segment_edit",
      "client_edit",
      "project_edit",
    ];
    for (const action of actions) {
      await audit({ action, entityType: "hardening_probe", detail: { probe: true } });
    }
    const rows = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.entityType, "hardening_probe"));
    expect(new Set(rows.map((r) => r.action))).toEqual(new Set(actions));
  });

  it("provenance coverage: no assistant message lacks prompt version, model or usage (criterion 12)", async () => {
    // ensure at least one assistant message exists
    const user = await researcher();
    await (await runAsk({ user, question: "How do consumers talk about saving money?" })).text();

    const [row] = await db
      .select({
        total: sql<number>`count(*)::int`,
        missing: sql<number>`count(*) FILTER (WHERE prompt_version IS NULL OR model IS NULL OR usage IS NULL OR retrieval_version IS NULL OR embedding_model IS NULL)::int`,
      })
      .from(messages)
      .where(eq(messages.role, "assistant"));
    expect(row.total).toBeGreaterThan(0);
    expect(row.missing).toBe(0);
  });

  it("assistant messages never carry a numeric confidence score (criterion 12)", async () => {
    const recent = await db
      .select()
      .from(messages)
      .where(eq(messages.role, "assistant"))
      .orderBy(desc(messages.createdAt))
      .limit(20);
    for (const message of recent) {
      const citations = message.citations as { basis?: { statement?: string } } | null;
      const statement = citations?.basis?.statement ?? "";
      expect(statement).not.toMatch(/\d+(\.\d+)?\s*%/);
      expect(message.content).not.toMatch(/confidence[:\s]+\d+(\.\d+)?\s*%/i);
    }
  });

  it("production env rejects dev-only configuration (§B9.8)", () => {
    const base = {
      NODE_ENV: "production",
      DATABASE_URL: "postgres://real",
      AUTH_SECRET: "real-secret",
    };
    expect(() => parseEnv({ ...base, LLM_PROVIDER: "fake" } as NodeJS.ProcessEnv)).toThrow(/fake is not allowed/);
    expect(() => parseEnv({ ...base, LLM_PROVIDER: "anthropic", ANTHROPIC_API_KEY: "k", EMBEDDINGS_PROVIDER: "fake" } as NodeJS.ProcessEnv)).toThrow(/EMBEDDINGS_PROVIDER=fake/);
    expect(() =>
      parseEnv({
        ...base,
        LLM_PROVIDER: "anthropic",
        ANTHROPIC_API_KEY: "k",
        EMBEDDINGS_PROVIDER: "voyage",
        VOYAGE_API_KEY: "v",
        PIPELINE_MODE: "inline",
      } as NodeJS.ProcessEnv),
    ).toThrow(/PIPELINE_MODE/);
    expect(() =>
      parseEnv({
        ...base,
        LLM_PROVIDER: "anthropic",
        ANTHROPIC_API_KEY: "k",
        EMBEDDINGS_PROVIDER: "voyage",
        VOYAGE_API_KEY: "v",
        PIPELINE_MODE: "inngest",
        DEV_LOGIN_ENABLED: "true",
      } as NodeJS.ProcessEnv),
    ).toThrow(/DEV_LOGIN_ENABLED/);
    // and a correct production config parses
    expect(() =>
      parseEnv({
        ...base,
        LLM_PROVIDER: "anthropic",
        ANTHROPIC_API_KEY: "k",
        EMBEDDINGS_PROVIDER: "voyage",
        VOYAGE_API_KEY: "v",
        PIPELINE_MODE: "inngest",
        STORAGE_DRIVER: "vercel-blob",
        BLOB_READ_WRITE_TOKEN: "t",
      } as NodeJS.ProcessEnv),
    ).not.toThrow();
  });

  it("OpenAI provider requires OPENAI_API_KEY (LLM or embeddings)", () => {
    const base = { NODE_ENV: "development", DATABASE_URL: "postgres://real", AUTH_SECRET: "real-secret" };
    // openai chat, no key → reject
    expect(() =>
      parseEnv({ ...base, LLM_PROVIDER: "openai", EMBEDDINGS_PROVIDER: "openai" } as NodeJS.ProcessEnv),
    ).toThrow(/OPENAI_API_KEY/);
    // one key serves both openai chat + openai embeddings → parses
    expect(() =>
      parseEnv({
        ...base,
        LLM_PROVIDER: "openai",
        EMBEDDINGS_PROVIDER: "openai",
        OPENAI_API_KEY: "sk-test",
      } as NodeJS.ProcessEnv),
    ).not.toThrow();
    // openai embeddings alongside anthropic chat still needs the key
    expect(() =>
      parseEnv({
        ...base,
        LLM_PROVIDER: "anthropic",
        ANTHROPIC_API_KEY: "k",
        EMBEDDINGS_PROVIDER: "openai",
      } as NodeJS.ProcessEnv),
    ).toThrow(/OPENAI_API_KEY/);
  });

  it("no server code logs chunk content (§B9.5 spot check)", () => {
    const sources = walk(path.join(process.cwd(), "lib"));
    for (const file of sources) {
      const content = readFileSync(file, "utf-8");
      // console.* calls must not interpolate chunk/quote content
      const badLog = content.match(/console\.\w+\([^)]*(chunk\.content|\.content\b[^)]*\))/);
      if (badLog && !/console\.error\("(AUDIT_WRITE_FAILED|API_ERROR|ASK_STREAM_ERROR)"/.test(content)) {
        throw new Error(`Possible content logging in ${file}: ${badLog[0]}`);
      }
    }
  });
});
