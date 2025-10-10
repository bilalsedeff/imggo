/**
 * Example test file
 */

import { describe, it, expect } from "vitest";
import { convertFormat } from "@/llm/orchestrator";

describe("Format conversion", () => {
  it("should convert object to JSON", () => {
    const data = { test: "value" };
    const result = convertFormat(data, "json");
    expect(result).toContain('"test"');
    expect(result).toContain('"value"');
  });

  it("should convert object to YAML", () => {
    const data = { test: "value" };
    const result = convertFormat(data, "yaml");
    expect(result).toContain("test:");
    expect(result).toContain("value");
  });

  it("should convert object to text", () => {
    const data = { test: "value" };
    const result = convertFormat(data, "text");
    expect(result).toContain("Test:");
    expect(result).toContain("value");
  });
});
