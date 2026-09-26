import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { allocate, perturb } from "./engine.ts";
import type { Report } from "../types.ts";
const report: Report = JSON.parse(
  readFileSync("public/data/report.json", "utf8"),
);
test("browser engine reproduces every official party entitlement in all seven elections", () => {
  for (const e of report.elections) {
    const votes = Object.fromEntries(
      e.parties.map((p) => [p.party, p.votes + (p.regionalVotes ?? 0)]),
    );
    assert.deepEqual(
      allocate(votes),
      Object.fromEntries(e.parties.map((p) => [p.party, p.officialSeats])),
      String(e.year),
    );
  }
});
test("browser one-vote results agree with Python for every party and mechanism", () => {
  for (const e of report.elections) {
    const votes = Object.fromEntries(e.parties.map((p) => [p.party, p.votes]));
    for (const r of report.pivotality.filter((x) => x.year === e.year)) {
      const next = perturb(votes, r.party, 1, r.action as "add" | "abstain");
      const total = Object.values(next).reduce((a, b) => a + b, 0);
      assert.ok(
        Math.abs(
          (next[r.party] / total - votes[r.party] / e.voteTotal) * 100 -
            r.shareChangePP,
        ) < 1e-12,
      );
      e.parties.forEach((p) => (next[p.party] += p.regionalVotes ?? 0));
      const baseline = Object.fromEntries(
        e.parties.map((p) => [p.party, p.officialSeats]),
      );
      try {
        const actual = allocate(next);
        const changed = Object.keys(actual).some(
          (p) => actual[p] !== baseline[p],
        );
        assert.equal(changed, r.entitlementChanged);
      } catch (err) {
        if (r.entitlementChanged !== null) throw err;
      }
    }
  }
});
test("invalid switches and exact ties are explicit", () => {
  assert.throws(() => perturb({ A: 3, B: 2 }, "A", 4, "abstain"));
  assert.throws(() => perturb({ A: 3, B: 2 }, "A", 1, "switch", "A"));
  assert.throws(() => allocate({ A: 10, B: 10 }, 1));
  assert.deepEqual(perturb({ A: 3, B: 2 }, "A", 1, "switch", "B"), {
    A: 2,
    B: 3,
  });
});
test("all ordered one-ballot party switches agree with Python", () => {
  for (const e of report.elections) {
    const expected = report.switchChecks.find((r) => r.year === e.year)!;
    const votes = Object.fromEntries(
      e.parties.map((p) => [p.party, p.votes + (p.regionalVotes ?? 0)]),
    );
    const baseline = allocate(votes);
    const changes: string[][] = [],
      ties: string[][] = [];
    let tested = 0;
    for (const origin of Object.keys(votes))
      for (const destination of Object.keys(votes)) {
        if (origin === destination) continue;
        tested++;
        try {
          const next = allocate(
            perturb(votes, origin, 1, "switch", destination),
          );
          if (Object.keys(next).some((p) => next[p] !== baseline[p]))
            changes.push([origin, destination]);
        } catch {
          ties.push([origin, destination]);
        }
      }
    assert.deepEqual({ year: e.year, tested, changes, ties }, expected);
  }
});
