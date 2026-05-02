import Anthropic from "@anthropic-ai/sdk";
import { createCache } from "./cache";

export interface ClaudeOptions {
  apiKey: string;
  cacheDir: string;
  model?: string;
}

export interface AskParams {
  system: string;
  user: string;
}

export interface Claude {
  askJson<T>(params: AskParams): Promise<T>;
}

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

function stripFences(text: string): string {
  const trimmed = text.trim();
  // Properly fenced: ```json ... ``` (or ``` ... ```)
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  if (fenced) return fenced[1];
  // Fallback: response had an opening fence but no closing one (or no fences
  // at all). Carve out the JSON object/array by its outermost brackets.
  const firstBrace = trimmed.search(/[{[]/);
  if (firstBrace === -1) return text;
  const lastBrace = Math.max(trimmed.lastIndexOf("}"), trimmed.lastIndexOf("]"));
  if (lastBrace > firstBrace) return trimmed.slice(firstBrace, lastBrace + 1);
  return text;
}

export function createClaude(opts: ClaudeOptions): Claude {
  const client = new Anthropic({ apiKey: opts.apiKey });
  const cache = createCache<unknown>(opts.cacheDir);
  const model = opts.model ?? DEFAULT_MODEL;

  return {
    async askJson<T>(params: AskParams): Promise<T> {
      const cacheKey = JSON.stringify({ model, ...params });
      const cached = await cache.get(cacheKey);
      if (cached !== null) return cached as T;

      const resp = await client.messages.create({
        model,
        max_tokens: 1024,
        system: params.system,
        messages: [{ role: "user", content: params.user }],
      });
      const block = resp.content[0];
      if (!block || block.type !== "text") {
        throw new Error(`Unexpected response shape: ${JSON.stringify(resp)}`);
      }
      const parsed = JSON.parse(stripFences(block.text)) as T;
      await cache.set(cacheKey, parsed);
      return parsed;
    },
  };
}
