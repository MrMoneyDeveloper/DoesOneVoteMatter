import { useEffect, useRef, useState } from "react";
import { range, select, scaleBand } from "d3";
import gsap from "gsap";
import "@materializecss/materialize/dist/css/materialize.css";
import "./journey.css";
import type { Report } from "./types";
import { classroom } from "./analytics/lesson";

const A = "#4264a4",
  B = "#b66531",
  NEUTRAL = "#b5beb6";
const fmt = (n: number) => n.toLocaleString("en-ZA");
const titles = [
  "100 people. 10 chairs.",
  "Move just one ballot.",
  "A bigger group can cross a boundary.",
  "Same one ballot. Much bigger crowd.",
  "Now check real elections. Every party.",
  "The count, the seats and control are different.",
];
const labels = [
  "Start small",
  "One ballot",
  "The boundary",
  "Grow the crowd",
  "Real evidence",
  "The takeaway",
];

export function Marks({
  count,
  a,
  changed = 0,
  chairs = false,
  label,
}: {
  count: number;
  a?: number;
  changed?: number;
  chairs?: boolean;
  label: string;
}) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const svg = select(ref.current!);
    const cols = chairs ? (count === 10 ? 10 : 20) : 10;
    const rows = Math.ceil(count / cols),
      gap = chairs && count === 10 ? 44 : 24;
    const w = cols * gap,
      h = rows * gap;
    svg.attr("viewBox", `0 0 ${w} ${h}`);
    const x = scaleBand<number>().domain(range(cols)).range([0, w]);
    const marks = svg
      .selectAll<SVGGElement, number>("g.mark")
      .data(range(count), (d) => d)
      .join("g")
      .attr("class", "mark")
      .attr("aria-hidden", "true")
      .attr(
        "transform",
        (i) =>
          `translate(${x(i % cols)! + gap / 2},${Math.floor(i / cols) * gap + gap / 2})`,
      );
    marks.selectAll("*").remove();
    const color = (i: number) => (a === undefined ? NEUTRAL : i < a ? A : B);
    if (chairs) {
      marks
        .append("path")
        .attr(
          "d",
          count === 10
            ? "M-12,-15 h24 v17 h-24 Z M-15,3 h30 v6 h-30 Z M-11,9 v7 M11,9 v7"
            : "M-7,-8 h14 v10 h-14 Z M-9,3 h18 v3 h-18 Z M-6,6 v3 M6,6 v3",
        )
        .attr("fill", color)
        .attr("stroke", color)
        .attr("stroke-width", 2);
    } else {
      marks.append("circle").attr("r", 8).attr("fill", color);
      marks
        .filter((i) => changed > 0 && i >= 60 - changed && i < 60)
        .append("circle")
        .attr("r", 10)
        .attr("fill", "none")
        .attr("stroke", "#263c31")
        .attr("stroke-width", 1.5);
    }
    marks
      .append("title")
      .text(
        (i) =>
          `${chairs ? "Seat" : "Ballot"} ${i + 1}${a === undefined ? "" : i < a ? " · Group A" : " · Group B"}`,
      );
  }, [count, a, changed, chairs]);
  return (
    <svg
      ref={ref}
      className={`lesson-marks ${chairs ? "chair-marks" : ""}`}
      role="img"
      aria-label={label}
    />
  );
}

function Crowd({ level, total }: { level: number; total: number }) {
  const ref = useRef<SVGSVGElement>(null);
  const amounts = [100, 1000, 100000, total],
    units = [1, 10, 1000, 100000];
  const n = amounts[level],
    unit = units[level],
    cells = Math.ceil(n / unit);
  useEffect(() => {
    const svg = select(ref.current!),
      columns = 20,
      size = 22;
    svg.attr("viewBox", `0 0 440 ${Math.ceil(cells / columns) * size}`);
    const rects = svg
      .selectAll<SVGRectElement, number>("rect")
      .data(range(cells), (d) => d)
      .join("rect")
      .attr("aria-hidden", "true")
      .attr("x", (i) => (i % columns) * size + 2)
      .attr("y", (i) => Math.floor(i / columns) * size + 2)
      .attr("width", 18)
      .attr("height", (i) =>
        i === cells - 1 ? ((n - i * unit) / unit) * 18 : 18,
      )
      .attr("rx", 2)
      .attr("fill", (i) => (i === 0 ? "#b66531" : "#b5beb6"));
    rects.selectAll("title").remove();
    rects
      .append("title")
      .text(
        (i) =>
          `${Math.min(unit, n - i * unit).toLocaleString()} ballots${i === 0 ? " · includes the one ballot we are following" : ""}`,
      );
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const animation = gsap.fromTo(
        rects.nodes(),
        { opacity: 0.25 },
        { opacity: 1, duration: 0.35, stagger: 0.002 },
      );
      return () => {
        animation.kill();
      };
    }
  }, [level, n, unit, cells]);
  return (
    <div className="crowd-visual">
      <div className="diagram-caption">
        <b>{fmt(n)} ballots</b>
        <span>
          1 tile = {fmt(unit)} {unit === 1 ? "ballot" : "ballots"}
        </span>
      </div>
      <svg
        ref={ref}
        role="img"
        aria-label={`${fmt(n)} ballots in groups of ${fmt(unit)}. The orange tile ${unit === 1 ? "is one ballot" : "contains our one ballot"}.`}
      />
      <p>
        <i className="key-dot" style={{ background: B }} />
        {unit === 1
          ? "The orange tile is our one ballot."
          : `The orange tile contains our one ballot, plus ${fmt(unit - 1)} others.`}
      </p>
    </div>
  );
}

export default function Journey({
  report,
  onExplore,
}: {
  report: Report;
  onExplore: () => void;
}) {
  const [step, setStep] = useState(0),
    [oneMoved, setOneMoved] = useState(false),
    [group, setGroup] = useState(1),
    [level, setLevel] = useState(0),
    [year, setYear] = useState(2019);
  const panel = useRef<HTMLElement>(null),
    heading = useRef<HTMLHeadingElement>(null),
    first = useRef(true);
  const e = report.elections.find((e) => e.year === year)!;
  const reference = report.elections.find((e) => e.year === 2019)!;
  const national = report.pivotality.filter((p) => p.year === year);
  const switches = report.switchChecks.find((s) => s.year === year)!;
  const checks = national.length + switches.tested;
  const changes =
    national.filter((p) => p.entitlementChanged === true).length +
    switches.changes.length;
  const ties =
    national.filter((p) => p.entitlementChanged === null).length +
    switches.ties.length;
  const totalChecks =
    report.pivotality.length +
    report.switchChecks.reduce((n, s) => n + s.tested, 0);
  const totalChanges =
    report.pivotality.filter((p) => p.entitlementChanged === true).length +
    report.switchChecks.reduce((n, s) => n + s.changes.length, 0);
  const shifted = step === 0 ? 0 : step === 1 ? (oneMoved ? 1 : 0) : group;
  const toy = classroom(shifted);
  const amounts = [100, 1000, 100000, reference.voteTotal];
  const go = (n: number) => {
    setStep(n);
  };
  const restart = () => {
    setOneMoved(false);
    setGroup(1);
    setLevel(0);
    setYear(2019);
    setStep(0);
  };
  useEffect(() => {
    if (first.current) first.current = false;
    else {
      heading.current?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: "instant" });
    }
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const context = gsap.context(() => {
      gsap.fromTo(
        ".scene-content",
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" },
      );
    }, panel);
    return () => context.revert();
  }, [step]);
  return (
    <div className="journey">
      <a className="skip-link" href="#lesson">
        Skip to explanation
      </a>
      <header className="lesson-header">
        <a href="#lesson" className="lesson-brand" onClick={restart}>
          <b>
            1<span>·</span>
          </b>
          <span>
            ONE VOTE
            <br />
            IN PERSPECTIVE
          </span>
        </a>
        <button className="btn-flat" onClick={onExplore}>
          Full data ↗
        </button>
      </header>
      <div className="lesson-progress">
        <div>
          <span aria-live="polite">
            Step {step + 1} of {titles.length}
          </span>
          <b>{labels[step]}</b>
          <span>
            {step < 4
              ? step === 3
                ? "ONE BALLOT AT DIFFERENT SCALES"
                : "LEARN WITH A FICTIONAL EXAMPLE"
              : "SOUTH AFRICAN EVIDENCE"}
          </span>
        </div>
        <div
          className="progress"
          role="progressbar"
          aria-label="Explanation progress"
          aria-valuemin={0}
          aria-valuemax={titles.length}
          aria-valuenow={step + 1}
        >
          <div
            className="determinate"
            style={{ width: `${(100 * (step + 1)) / titles.length}%` }}
          />
        </div>
      </div>
      <main id="lesson" ref={panel}>
        <div className="scene-content" key={step}>
          <p className="lesson-eyebrow">
            {step < 3
              ? "A SMALL, MADE-UP ELECTION"
              : step === 3
                ? "ZOOMING OUT"
                : step === 4
                  ? "PUT THE IDEA TO THE TEST"
                  : "PUT IT TOGETHER"}
          </p>
          <h1 ref={heading} tabIndex={-1}>
            {titles[step]}
          </h1>
          {step < 3 && (
            <>
              <p className="lesson-lead">
                {step === 0
                  ? "Each person casts one ballot. Ten people will be chosen to represent the whole group. Each chair is one representative’s seat."
                  : step === 1
                    ? "One person changes their choice from Group A to Group B. Watch the ballots and the chairs separately."
                    : "More people change from A to B. Now watch when the chairs move—and whether either group still has more than half."}
              </p>
              <div className="fiction-label">
                <span className="chip">Fictional groups</span>
                <span className="chip">Simplified teaching rule</span>
                <span>No real parties</span>
              </div>
              <div className="classroom-layout">
                <div className="card-panel ballot-panel">
                  <div className="diagram-caption">
                    <b>100 ballots</b>
                    <span>Each dot = one person’s ballot</span>
                  </div>
                  <Marks
                    count={100}
                    a={toy.a}
                    changed={shifted}
                    label={`${toy.a} ballots for Group A and ${toy.b} for Group B`}
                  />
                  <div className="group-tallies" aria-live="polite">
                    <span>
                      <i className="key-dot" style={{ background: A }} />
                      Group A <b>{toy.a}</b>
                    </span>
                    <span>
                      <i className="key-dot" style={{ background: B }} />
                      Group B <b>{toy.b}</b>
                    </span>
                  </div>
                </div>
                <div className="seat-panel">
                  <div className="diagram-caption">
                    <b>10 seats</b>
                    <span>Each chair = one representative</span>
                  </div>
                  <Marks
                    count={10}
                    a={toy.seatsA!}
                    chairs
                    label={`${toy.seatsA} seats for Group A and ${toy.seatsB} for Group B`}
                  />
                  <div className="group-tallies">
                    <span>
                      Group A <b>{toy.seatsA}</b>
                    </span>
                    <span>
                      Group B <b>{toy.seatsB}</b>
                    </span>
                  </div>
                  <div className="chair-rule">
                    <strong>
                      {step === 0
                        ? "60 out of 100 → 6 out of 10"
                        : step === 1
                          ? `${toy.a} out of 100 ${oneMoved ? "still rounds to" : "gives"} 6 chairs`
                          : `${toy.a} out of 100 → ${toy.seatsA} out of 10`}
                    </strong>
                    <p>
                      {step === 0
                        ? "We share the chairs in proportion to support. Six chairs for A, four for B."
                        : step === 1
                          ? "We cannot give someone 0.1 of a chair. Small changes in support can leave the whole-chair allocation unchanged."
                          : "A group needs at least 6 of the 10 chairs to have a majority on its own."}
                    </p>
                  </div>
                </div>
              </div>
              {step === 1 && (
                <div className="lesson-action">
                  <button
                    className="btn"
                    onClick={() => setOneMoved(!oneMoved)}
                  >
                    {oneMoved
                      ? "Reset the ballot"
                      : "Switch one ballot from A to B"}{" "}
                    <span aria-hidden="true">↔</span>
                  </button>
                  <span>
                    {oneMoved
                      ? "The outlined dot changed groups. No chair moved."
                      : "Try it. You can undo the switch."}
                  </span>
                </div>
              )}
              {step === 2 && (
                <div className="lesson-action group-buttons">
                  <span>How many people switch?</span>
                  {[1, 6, 16].map((n) => (
                    <button
                      className={`btn ${group === n ? "" : "tonal"}`}
                      aria-pressed={group === n}
                      key={n}
                      onClick={() => setGroup(n)}
                    >
                      {n} {n === 1 ? "person" : "people"}
                    </button>
                  ))}
                </div>
              )}
              {step > 0 && (
                <div className="outcome-strip" aria-live="polite">
                  <div>
                    <span>01 · BALLOT COUNT</span>
                    <b>{shifted ? "Changed" : "Not changed yet"}</b>
                    <small>
                      {shifted
                        ? `A −${shifted} · B +${shifted}`
                        : "A 60 · B 40"}
                    </small>
                  </div>
                  <div>
                    <span>02 · SEATS</span>
                    <b>
                      {toy.seatsA === 6
                        ? "Unchanged"
                        : `${Math.abs(toy.seatsA! - 6)} ${Math.abs(toy.seatsA! - 6) === 1 ? "seat moves" : "seats move"}`}
                    </b>
                    <small>
                      A {toy.seatsA} · B {toy.seatsB}
                    </small>
                  </div>
                  <div>
                    <span>03 · SINGLE-GROUP MAJORITY</span>
                    <b>{toy.majority}</b>
                    <small>
                      {toy.majority === "Neither group"
                        ? "5–5: neither can act alone"
                        : "6 or more seats needed"}
                    </small>
                  </div>
                </div>
              )}
              <details className="lesson-details">
                <summary>The teaching rule, and its limits</summary>
                <p>
                  This example uses 100 ballots and 10 seats. Divide each
                  group’s ballots by 10, award whole seats, then give the
                  remaining seat to the larger fractional remainder. A 55–45
                  split produces a tie for the final seat, so we do not invent a
                  winner. The buttons use unambiguous examples. This is not the
                  South African allocation formula; it illustrates why counts,
                  seats and a majority can respond differently. Coalitions and
                  other reasons for voting are separate questions.
                </p>
              </details>
            </>
          )}
          {step === 3 && (
            <>
              <p className="lesson-lead">
                Keep track of the same one ballot as the crowd grows. We are
                changing the scale here, not calculating seats.
              </p>
              <div className="scale-buttons" aria-label="Crowd size">
                {amounts.map((n, i) => (
                  <button
                    className={`btn ${level === i ? "" : "tonal"}`}
                    aria-pressed={level === i}
                    onClick={() => setLevel(i)}
                    key={n}
                  >
                    {i === 3 ? "17.4 million" : fmt(n)}
                    <small>
                      {i === 3
                        ? "2019 valid national ballots"
                        : "illustrative ballots"}
                    </small>
                  </button>
                ))}
              </div>
              <div className="scale-layout card-panel">
                <Crowd level={level} total={reference.voteTotal} />
                <div className="scale-number" aria-live="polite">
                  <span>ONE BALLOT IS</span>
                  <strong>
                    1 <small>out of</small>
                    <br />
                    {fmt(amounts[level])}
                  </strong>
                  <b>
                    {(100 / amounts[level]).toFixed(
                      level === 3 ? 7 : level === 2 ? 3 : level === 1 ? 1 : 0,
                    )}
                    %
                  </b>
                  <p>of this crowd’s ballots.</p>
                  <div className="scale-fixed">
                    The ballot stays <b>one</b>.<br />
                    Its share of the crowd gets smaller.
                  </div>
                </div>
              </div>
              <p className="lesson-insight">
                Size alone does not tell us if a seat changes. We also need to
                know how close the allocation is to its next boundary.
              </p>
            </>
          )}
          {step === 4 && (
            <>
              <p className="lesson-lead">
                Instead of choosing a favourite party, test every party. Add one
                ballot, remove one, then try a one-ballot switch between each
                pair.
              </p>
              <div className="evidence-year">
                <label htmlFor="lesson-year">Choose an election</label>
                <select
                  className="browser-default"
                  id="lesson-year"
                  value={year}
                  onChange={(ev) => setYear(Number(ev.target.value))}
                >
                  {report.elections.map((e) => (
                    <option key={e.year}>{e.year}</option>
                  ))}
                </select>
                <span>
                  {fmt(e.voteTotal)} valid national ballots · {e.parties.length}{" "}
                  parties
                </span>
              </div>
              <div className="evidence-layout">
                <div className="evidence-count card-panel" aria-live="polite">
                  <span>{year} · ALL PARTIES TESTED</span>
                  <strong>{fmt(checks)}</strong>
                  <p>one-ballot scenarios</p>
                  <div>
                    <b>{changes}</b>
                    <span>
                      changed the modelled
                      <br />
                      national seat allocation
                    </span>
                  </div>
                  {ties > 0 && <p>{ties} unresolved ties</p>}
                </div>
                <div className="evidence-seats">
                  <div className="diagram-caption">
                    <b>The National Assembly</b>
                    <span>400 seats · each chair = 1 seat</span>
                  </div>
                  <Marks
                    count={400}
                    chairs
                    label="400 neutral chairs representing the National Assembly; no party is highlighted"
                  />
                  <p>
                    No party is highlighted. The test checks whether{" "}
                    <b>any party’s</b> seat total changes.
                  </p>
                </div>
              </div>
              <p className="lesson-insight">
                In the {year} scenarios we tested,{" "}
                {changes === 0
                  ? "the tally changed, but no seat changed hands."
                  : `${changes} scenarios changed the seat allocation.`}
              </p>
              <details className="lesson-details">
                <summary>How we checked, and what is excluded</summary>
                <p>
                  The calculation first reproduces the published IEC national
                  seat totals. Then it reruns the allocation after each
                  one-ballot change. These are national entitlements, not a full
                  candidate-assignment simulation: list exhaustion, regional
                  overhangs and winning-independent counterfactuals are
                  excluded. In 2024, national and regional party votes both
                  contribute to the allocation; these tests change only the
                  national ballot. Regional baseline checks for 2004–2024 are
                  available in the full data.
                </p>
              </details>
            </>
          )}
          {step === 5 && (
            <>
              <p className="lesson-lead">
                A ballot can change the first thing without changing the next
                two.
              </p>
              <div className="takeaway-chain">
                <div>
                  <span>01</span>
                  <h2>The count</h2>
                  <p>One ballot changes a party’s tally.</p>
                  <b>Every counted ballot contributes.</b>
                </div>
                <i aria-hidden="true">→</i>
                <div>
                  <span>02</span>
                  <h2>The seats</h2>
                  <p>A seat moves when an allocation boundary is crossed.</p>
                  <b>The size of the gap matters.</b>
                </div>
                <i aria-hidden="true">→</i>
                <div>
                  <span>03</span>
                  <h2>A majority</h2>
                  <p>A seat change may shift who has more than half.</p>
                  <b>Not every seat changes control.</b>
                </div>
              </div>
              <div className="lesson-conclusion">
                <span>WHAT THE HISTORICAL CHECKS FOUND</span>
                <strong>
                  {fmt(totalChecks)} national one-ballot scenarios.
                  <br />
                  {totalChanges === 0
                    ? "No changes to the seat allocation."
                    : `${totalChanges} changes to the seat allocation.`}
                </strong>
                <p>
                  That describes the elections and scenarios tested. It does not
                  prove that one ballot can never be decisive, predict a future
                  election, or tell you whether you should vote.
                </p>
              </div>
              <div className="lesson-summary-actions">
                <a
                  className="btn tonal"
                  href="/guide-summary.html"
                  target="_blank"
                  rel="noreferrer"
                >
                  Keep a printable summary ↗
                </a>
                <button className="btn-flat" onClick={onExplore}>
                  Inspect the data and assumptions ↗
                </button>
              </div>
            </>
          )}
        </div>
      </main>
      <nav className="lesson-footer" aria-label="Lesson navigation">
        <div>
          <button
            className="btn-flat"
            disabled={step === 0}
            onClick={() => go(step - 1)}
          >
            ← Back
          </button>
          <span>
            {step < titles.length - 1
              ? `Up next: ${labels[step + 1]}`
              : "You’ve reached the takeaway."}
          </span>
          <button
            className="btn"
            onClick={() =>
              step === titles.length - 1 ? restart() : go(step + 1)
            }
          >
            {step === titles.length - 1 ? "Start again" : "Next"}{" "}
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
