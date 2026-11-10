import path from "node:path";
import { EMBEDDING_MODEL } from "./model";
import type { FeatureExtractionPipeline } from "@huggingface/transformers";

export async function loadEmbedder(): Promise<FeatureExtractionPipeline> {
  const { env, pipeline } = await import("@huggingface/transformers");
  env.cacheDir = path.resolve(process.cwd(), ".cache/retrieval/models");
  return pipeline("feature-extraction", EMBEDDING_MODEL.id, {
    revision: EMBEDDING_MODEL.revision,
    dtype: EMBEDDING_MODEL.dtype,
    device: "cpu",
  }) as Promise<FeatureExtractionPipeline>;
}

export async function embedTexts(
  embedder: FeatureExtractionPipeline,
  texts: string[],
): Promise<number[][]> {
  const output = await embedder(texts, {
    pooling: EMBEDDING_MODEL.pooling,
    normalize: EMBEDDING_MODEL.normalize,
  });
  const rows = output.tolist() as number[][];
  if (rows.length !== texts.length) throw new Error("Embedding row count does not match the input.");
  return rows;
}
