/**
 * Vitest setup file
 */

import { beforeAll, afterAll } from "vitest";

beforeAll(() => {
  // Setup test environment
  process.env.NODE_ENV = "test";
});

afterAll(() => {
  // Cleanup
});
