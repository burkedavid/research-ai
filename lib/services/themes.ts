import { eq } from "drizzle-orm";
import { db } from "@/db";
import { chunkThemes, themes } from "@/db/schema";
import { audit } from "@/lib/audit";
import { ForbiddenError, type SessionUser } from "@/lib/errors";

function requireAdmin(user: SessionUser): void {
  if (user.role !== "admin") throw new ForbiddenError("Requires admin role");
}

export async function listThemes() {
  return db.select().from(themes).orderBy(themes.name);
}

export async function createTheme(user: SessionUser, params: { name: string; definition?: string }, ip?: string | null) {
  requireAdmin(user);
  const [theme] = await db
    .insert(themes)
    .values({ name: params.name, definition: params.definition })
    .returning();
  await audit({ userId: user.id, action: "theme_edit", entityType: "theme", entityId: theme.id, detail: { op: "create", name: params.name }, ip });
  return theme;
}

export async function updateThemeDefinition(user: SessionUser, themeId: string, definition: string, ip?: string | null) {
  requireAdmin(user);
  await db.update(themes).set({ definition }).where(eq(themes.id, themeId));
  await audit({ userId: user.id, action: "theme_edit", entityType: "theme", entityId: themeId, detail: { op: "define" }, ip });
}

/**
 * Theme merge (§A5.2): recorded, not destructive. The source theme keeps its
 * row with status='merged' and merged_into set, so historic tagging remains
 * traceable; live chunk tags move to the target.
 */
export async function mergeThemes(user: SessionUser, sourceId: string, targetId: string, ip?: string | null) {
  requireAdmin(user);
  if (sourceId === targetId) throw new Error("Cannot merge a theme into itself");
  const [source] = await db.select().from(themes).where(eq(themes.id, sourceId));
  const [target] = await db.select().from(themes).where(eq(themes.id, targetId));
  if (!source || !target) throw new Error("Theme not found");
  if (source.status === "merged") throw new Error("Source theme is already merged");
  if (target.status === "merged") throw new Error("Cannot merge into an already-merged theme");

  // move tags, keeping the stronger source designation on conflict
  const tagged = await db.select().from(chunkThemes).where(eq(chunkThemes.themeId, sourceId));
  for (const tag of tagged) {
    await db
      .insert(chunkThemes)
      .values({ chunkId: tag.chunkId, themeId: targetId, source: tag.source, confidence: tag.confidence })
      .onConflictDoNothing();
  }
  await db.delete(chunkThemes).where(eq(chunkThemes.themeId, sourceId));
  await db.update(themes).set({ status: "merged", mergedInto: targetId }).where(eq(themes.id, sourceId));

  await audit({
    userId: user.id,
    action: "theme_edit",
    entityType: "theme",
    entityId: sourceId,
    detail: { op: "merge", into: targetId, sourceName: source.name, targetName: target.name, movedTags: tagged.length },
    ip,
  });
}
