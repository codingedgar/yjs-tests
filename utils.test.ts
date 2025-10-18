import { describe, expect, test } from "vitest";
import { diff_position } from "./utils.js";

describe("diff_position", () => {
  test("identical arrays", () => {
    const a = new Uint8Array([1, 2, 3, 4, 5]);
    const b = new Uint8Array([1, 2, 3, 4, 5]);
    expect(diff_position(a, b)).toBe(-1);
  });
  test("differ at start", () => {
    const a = new Uint8Array([0, 2, 3, 4, 5]);
    const b = new Uint8Array([1, 2, 3, 4, 5]);
    expect(diff_position(a, b)).toBe(0);
  });
  test("differ in middle", () => {
    const a = new Uint8Array([1, 2, 0, 4, 5]);
    const b = new Uint8Array([1, 2, 3, 4, 5]);
    expect(diff_position(a, b)).toBe(2);
  });
  test("differ at end", () => {
    const a = new Uint8Array([1, 2, 3, 4, 0]);
    const b = new Uint8Array([1, 2, 3, 4, 5]);
    expect(diff_position(a, b)).toBe(4);
  });
  test("a longer than b", () => {
    const a = new Uint8Array([1, 2, 3, 4, 5, 6]);
    const b = new Uint8Array([1, 2, 3, 4, 5]);
    expect(diff_position(a, b)).toBe(5);
  });
  test("b longer than a", () => {
    const a = new Uint8Array([1, 2, 3, 4]);
    const b = new Uint8Array([1, 2, 3, 4, 5]);
    expect(diff_position(a, b)).toBe(4);
  });
});
