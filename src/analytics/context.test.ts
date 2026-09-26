import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { Report } from "../types";
import {
  geography,
  historicalWindow,
  timeline,
  checksSummary,
} from "./context.ts";
const report: Report = JSON.parse(
  readFileSync(
    new URL("../../public/data/report.json", import.meta.url),
    "utf8",
  ),
);
test("regional count reconciles to national total including overseas ballots", () => {
  const geo = geography(report.elections.find((e) => e.year === 2019)!);
  assert.equal(geo.total, 17437379);
  assert.equal(geo.outside, 19882);
  assert.equal(geo.regions.find((r) => r.name === "Gauteng")!.votes, 4537402);
  assert.equal(
    geo.regions.reduce((n, r) => n + r.votes, 0) + geo.outside,
    geo.total,
  );
});
test("historical windows preserve observed changes and do not invent future outcomes", () => {
  assert.deepEqual(
    timeline(report).map((r) => r.seats),
    [252, 266, 279, 264, 249, 230, 159],
  );
  assert.equal(historicalWindow(report, 2014, 10).seatChange, -90);
  assert.equal(historicalWindow(report, 2019, 5).last!.majority, false);
  const future = historicalWindow(report, 2019, 10);
  assert.equal(future.observed, false);
  assert.equal(future.seatChange, null);
  assert.throws(() => historicalWindow(report, 2018, 10));
});
test("conclusion counts match all national and regional scenarios", () => {
  assert.deepEqual(checksSummary(report), {
    national: 7794,
    changed: 0,
    ties: 0,
    regional: 50960,
    regionalChanges: 0,
  });
});
