import { afterEach, describe, expect, it, vi } from "vitest";
import { EMBEDDING } from "@/lib/config";
import { openaiProvider } from "@/lib/embeddings";

describe("OpenAI embeddings provider", () => {
  afterEach(() => vi.restoreAllMocks());

  it("requests text-embedding-3-large truncated to the canonical 1024 dims", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        // returned out of order to prove we re-sort by index
        JSON.stringify({
          data: [
            { index: 1, embedding: [0.3, 0.4] },
            { index: 0, embedding: [0.1, 0.2] },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    const vectors = await openaiProvider().embed(["first", "second"], "document");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/embeddings");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.model).toBe("text-embedding-3-large");
    expect(body.dimensions).toBe(1024);
    expect(EMBEDDING.dimensions).toBe(1024);
    expect(body.input).toEqual(["first", "second"]);

    // vectors come back ordered by the API's index field, not response order
    expect(vectors).toEqual([
      [0.1, 0.2],
      [0.3, 0.4],
    ]);
  });

  it("throws with the status on a non-OK response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("rate limited", { status: 429 }));
    await expect(openaiProvider().embed(["x"], "document")).rejects.toThrow(/429/);
  });
});
