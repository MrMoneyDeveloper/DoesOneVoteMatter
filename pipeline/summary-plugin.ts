import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Handlebars from "handlebars";
import type { Plugin } from "vite";
import type { Report } from "../src/types.ts";
import {
  geography,
  timeline,
  checksSummary,
} from "../src/analytics/context.ts";

export function summaryPlugin(): Plugin {
  let root = "";
  function render() {
    const report: Report = JSON.parse(
      readFileSync(resolve(root, "public/data/report.json"), "utf8"),
    );
    const rows = report.elections.map((e) => {
      const one = report.pivotality.filter((p) => p.year === e.year);
      const sw = report.switchChecks.find((s) => s.year === e.year)!;
      return {
        year: e.year,
        parties: e.parties.length,
        checks: one.length + sw.tested,
        changes:
          one.filter((p) => p.entitlementChanged === true).length +
          sw.changes.length,
      };
    });
    return Handlebars.compile(
      readFileSync(resolve(root, "templates/guide-summary.hbs"), "utf8"),
    )({
      elections: rows.map((r) => ({
        ...r,
        checks: r.checks.toLocaleString("en-ZA"),
      })),
      timeline: timeline(report),
      regions: [
        ...geography(
          report.elections.find((e) => e.year === 2019)!,
        ).regions.map((r) => ({
          ...r,
          votes: r.votes.toLocaleString("en-ZA"),
          seats: report.regionalValidation.find((a) => a.year === 2019)!
            .capacities![r.name],
        })),
        {
          name: "Overseas",
          votes: geography(
            report.elections.find((e) => e.year === 2019)!,
          ).outside.toLocaleString("en-ZA"),
          seats: "—",
        },
      ],
      regionalChecks: checksSummary(report).regional.toLocaleString("en-ZA"),
      sourceUrl: report.sources.find((s) => s.id === "iec-2019-seats")!.url,
      ballots2019: report.elections
        .find((e) => e.year === 2019)!
        .voteTotal.toLocaleString("en-ZA"),
      checks: rows.reduce((n, r) => n + r.checks, 0).toLocaleString("en-ZA"),
      changes: rows.reduce((n, r) => n + r.changes, 0),
    });
  }
  return {
    name: "handlebars-lesson-summary",
    configResolved(c) {
      root = c.root;
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split("?")[0] !== "/guide-summary.html") return next();
        try {
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(render());
        } catch (error) {
          next(error);
        }
      });
    },
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "guide-summary.html",
        source: render(),
      });
    },
  };
}
