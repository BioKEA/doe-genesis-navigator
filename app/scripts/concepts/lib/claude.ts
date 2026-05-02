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
  const fenced = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced ? fenced[1] : text;
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
