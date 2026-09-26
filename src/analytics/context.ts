import type { Election, Report } from "../types.ts";

export function geography(e: Election) {
  const names = Object.keys(e.parties[0].provinceVotes);
  const regions = names.map((name) => ({
    name,
    votes: e.parties.reduce((n, p) => n + p.provinceVotes[name], 0),
  }));
  const outside = e.voteTotal - regions.reduce((n, r) => n + r.votes, 0);
  if (outside < 0) throw new Error("Province totals exceed national votes");
  return { regions, outside, total: e.voteTotal };
}
export function largestParty(e: Election) {
  return e.parties.reduce((largest, p) =>
    p.officialSeats > largest.officialSeats ? p : largest,
  );
}
export function timeline(report: Report) {
  return report.elections.map((e) => ({
    year: e.year,
    seats: largestParty(e).officialSeats,
    name: largestParty(e).name,
    majority: largestParty(e).officialSeats >= 201,
  }));
}
export function historicalWindow(report: Report, start: number, years: number) {
  const rows = timeline(report),
    first = rows.find((e) => e.year === start);
  if (!first || ![5, 10, 15].includes(years))
    throw new Error("Choose an observed start and a supported interval");
  const endYear = start + years,
    last = rows.find((e) => e.year === endYear);
  return {
    start,
    endYear,
    years,
    first,
    last,
    observed: !!last,
    seatChange: last ? last.seats - first.seats : null,
    elections: rows.filter((e) => e.year >= start && e.year <= endYear),
  };
}
export function checksSummary(report: Report) {
  return {
    national:
      report.pivotality.length +
      report.switchChecks.reduce((n, s) => n + s.tested, 0),
    changed:
      report.pivotality.filter((p) => p.entitlementChanged === true).length +
      report.switchChecks.reduce((n, s) => n + s.changes.length, 0),
    ties:
      report.pivotality.filter((p) => p.entitlementChanged === null).length +
      report.switchChecks.reduce((n, s) => n + s.ties.length, 0),
    regional: report.regionalValidation.reduce(
      (n, a) => n + (a.oneBallotChecks?.tested ?? 0),
      0,
    ),
    regionalChanges: report.regionalValidation.reduce(
      (n, a) => n + (a.oneBallotChecks?.changes.length ?? 0),
      0,
    ),
  };
}
