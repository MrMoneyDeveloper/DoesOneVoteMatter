import { test } from "node:test";
import assert from "node:assert/strict";
import { classroom } from "./lesson.ts";
test("lesson distinguishes count, seats and majority with neutral groups", () => {
  assert.deepEqual(classroom(0), {
    a: 60,
    b: 40,
    seatsA: 6,
    seatsB: 4,
    majority: "Group A",
  });
  assert.deepEqual(classroom(1), {
    a: 59,
    b: 41,
    seatsA: 6,
    seatsB: 4,
    majority: "Group A",
  });
  assert.deepEqual(classroom(6), {
    a: 54,
    b: 46,
    seatsA: 5,
    seatsB: 5,
    majority: "Neither group",
  });
  assert.deepEqual(classroom(16), {
    a: 44,
    b: 56,
    seatsA: 4,
    seatsB: 6,
    majority: "Group B",
  });
});
test("lesson refuses to invent a tie winner and validates input", () => {
  assert.equal(classroom(5).seatsA, null);
  assert.equal(classroom(5).majority, "Unresolved");
  for (const n of [-1, 61, 1.5, NaN]) assert.throws(() => classroom(n));
});
