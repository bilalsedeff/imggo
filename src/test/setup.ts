/**
 * Vitest setup file
 */

import { beforeAll, afterAll } from "vitest";

beforeAll(() => {
  // Setup test environment
  if (process.env.NODE_ENV !== "test") {
    Object.defineProperty(process.env, "NODE_ENV", {
      value: "test",
      writable: true,
    });
  }
});

afterAll(() => {
  // Cleanup
});
