import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const createMessage = vi.fn();
vi.mock("@anthropic-ai/sdk", () => {
  return {
    default: class FakeAnthropic {
      messages = { create: createMessage };
    },
  };
});

import { createClaude } from "../../scripts/concepts/lib/claude";

describe("createClaude", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "claude-test-"));
    createMessage.mockReset();
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("calls Anthropic on cache miss, returns parsed JSON", async () => {
    createMessage.mockResolvedValueOnce({
      content: [{ type: "text", text: '{"foo": "bar"}' }],
    });
    const claude = createClaude({ apiKey: "test", cacheDir: dir });
    const result = await claude.askJson<{ foo: string }>({
      system: "be helpful",
      user: "hi",
    });
    expect(result).toEqual({ foo: "bar" });
    expect(createMessage).toHaveBeenCalledTimes(1);
  });

  it("returns cached value on second call with same input", async () => {
    createMessage.mockResolvedValueOnce({
      content: [{ type: "text", text: '{"n": 1}' }],
    });
    const claude = createClaude({ apiKey: "test", cacheDir: dir });
    await claude.askJson({ system: "s", user: "u" });
    const second = await claude.askJson({ system: "s", user: "u" });
    expect(second).toEqual({ n: 1 });
    expect(createMessage).toHaveBeenCalledTimes(1);
  });

  it("strips markdown code fences before parsing JSON", async () => {
    createMessage.mockResolvedValueOnce({
      content: [{ type: "text", text: "```json\n{\"a\": 1}\n```" }],
    });
    const claude = createClaude({ apiKey: "test", cacheDir: dir });
    expect(await claude.askJson({ system: "s", user: "u" })).toEqual({ a: 1 });
  });
});
