import path from "node:path";
import { courseEmbeddingText } from "./course-text";
import { EMBEDDING_MODEL } from "./model";
import type { Catalogue } from "../types";
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

export async function loadCourseVectors(
  catalogue: Catalogue,
  embedder: FeatureExtractionPipeline,
) {
  const byCourse = new Map<string, typeof catalogue.sections>();
  for (const section of catalogue.sections) {
    const list = byCourse.get(section.courseCode) ?? [];
    list.push(section);
    byCourse.set(section.courseCode, list);
  }
  const courses = [...byCourse.keys()].sort((a, b) => a.localeCompare(b));
  const texts = courses.map((courseCode) => courseEmbeddingText(courseCode, byCourse.get(courseCode) ?? []));
  const vectors = await embedTexts(embedder, texts);
  return courses.map((courseCode, index) => ({
    courseCode,
    text: texts[index] ?? "",
    vector: vectors[index] ?? [],
  }));
}
