import { pipeline, type FeatureExtractionPipeline } from "@xenova/transformers";

let extractor: FeatureExtractionPipeline | null = null;

const MODEL = "Xenova/all-MiniLM-L6-v2"; // 384-dim, ~25MB, fast

async function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractor) {
    extractor = (await pipeline("feature-extraction", MODEL)) as FeatureExtractionPipeline;
  }
  return extractor;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const ex = await getExtractor();
  const out: number[][] = [];
  for (const t of texts) {
    const tensor = await ex(t, { pooling: "mean", normalize: true });
    out.push(Array.from(tensor.data as Float32Array));
  }
  return out;
}

export const EMBED_DIM = 384;
