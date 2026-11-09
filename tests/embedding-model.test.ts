import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { EMBEDDING_MODEL } from "../src/domain/retrieval/model";

describe("EMBEDDING_MODEL", () => {
  it("pins the MiniLM revision and the quantized dtype", () => {
    expect(EMBEDDING_MODEL).toEqual({
      id: "Xenova/all-MiniLM-L6-v2",
      revision: "751bff37182d3f1213fa05d7196b954e230abad9",
      dtype: "q8",
      pooling: "mean",
      normalize: true,
    });
    const pkg = JSON.parse(fs.readFileSync("package.json", "utf8")) as { dependencies: Record<string, string> };
    expect(pkg.dependencies["@huggingface/transformers"]).toBe("4.3.2");
    expect(fs.readFileSync(".gitignore", "utf8")).toContain(".cache/");
    const source = fs.readFileSync("src/domain/retrieval/dense.ts", "utf8");
    expect(source).toContain('revision: EMBEDDING_MODEL.revision');
    expect(source).toContain('dtype: EMBEDDING_MODEL.dtype');
    expect(source).toContain('pooling: EMBEDDING_MODEL.pooling');
    expect(source).toContain('normalize: EMBEDDING_MODEL.normalize');
    expect(source).toContain('device: "cpu"');
  });
});
