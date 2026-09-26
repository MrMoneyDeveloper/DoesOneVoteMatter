import { useEffect, useRef, useState } from "react";
import { select, hierarchy, treemap, scaleLinear, line } from "d3";
import gsap from "gsap";
import "@materializecss/materialize/dist/css/materialize.css";
import "./journey.css";
import {
  checksSummary,
  geography,
  historicalWindow,
  timeline,
} from "./analytics/context";
import type { Report } from "./types";
import "./context.css";

const fmt = (n: number) => n.toLocaleString("en-ZA");
const titles = [
  "One vote. Years of waiting. Change you may not want.",
  "What can a national vote actually change?",
  "Your region sits inside the countrywide count.",
  "Where did these numbers come from?",
  "Did one ballot change the allocation?",
  "Does meaningful electoral change need a decade?",
  "What the evidence establishes—and what remains open.",
];
const labels = [
  "The question",
  "How the system connects",
  "Regional → national scale",
  "How the evidence was formed",
  "Individual influence",
  "Time and your life",
  "Evidence status",
];
const govt = "https://www.gov.za/about-government/national-assembly-na";
const iec =
  "https://www.elections.org.za/pw/elections/whats-new-in-the-2024-elections-electoral-amendment-act";

function RegionTiles({
  rows,
  selected,
}: {
  rows: { name: string; votes: number }[];
  selected: string;
}) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const root = hierarchy<{
      name: string;
      votes?: number;
      children?: { name: string; votes: number }[];
    }>({ name: "South Africa", children: rows })
      .sum((d) => d.votes ?? 0)
      .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    const layout = treemap<typeof root.data>().size([800, 280]).paddingInner(5)(
      root,
    );
    const svg = select(ref.current!);
    svg.selectAll("*").remove();
    const group = svg
      .selectAll("g")
      .data(layout.leaves())
      .join("g")
      .attr("aria-hidden", "true");
    group
      .append("rect")
      .attr("x", (d) => d.x0)
      .attr("y", (d) => d.y0)
      .attr("width", (d) => d.x1 - d.x0)
      .attr("height", (d) => d.y1 - d.y0)
      .attr("rx", 3)
      .attr("fill", (d) => (d.data.name === selected ? "#4264a4" : "#dde3d7"));
    group
      .filter((d) => d.x1 - d.x0 > 75 && d.y1 - d.y0 > 35)
      .append("text")
      .attr("x", (d) => d.x0 + 10)
      .attr("y", (d) => d.y0 + 23)
      .attr("font-size", 12)
      .attr("font-family", "DM Sans, sans-serif")
      .attr("fill", (d) => (d.data.name === selected ? "white" : "#40533c"))
      .text((d) => d.data.name);
    group
      .append("title")
      .text(
        (d) => `${d.data.name}: ${fmt(d.value ?? 0)} valid national ballots`,
      );
  }, [rows, selected]);
  return (
    <svg
      className="region-tiles"
      viewBox="0 0 800 280"
      ref={ref}
      role="img"
      aria-label={`2019 national ballots grouped by where they were cast. ${selected} is highlighted. Area represents ballot counts, not land area.`}
    />
  );
}

function TimeChart({
  report,
  start,
  end,
}: {
  report: Report;
  start: number;
  end: number;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const rows = timeline(report);
  useEffect(() => {
    const svg = select(ref.current!);
    svg.selectAll("*").remove();
    const x = scaleLinear().domain([1994, 2024]).range([54, 756]),
      y = scaleLinear().domain([0, 400]).range([240, 20]);
    svg
      .append("rect")
      .attr("x", x(start))
      .attr("y", 15)
      .attr("width", Math.max(0, x(Math.min(end, 2024)) - x(start)))
      .attr("height", 230)
      .attr("fill", "#e9eee3");
    for (const tick of [0, 100, 201, 300, 400]) {
      svg
        .append("line")
        .attr("x1", 48)
        .attr("x2", 765)
        .attr("y1", y(tick))
        .attr("y2", y(tick))
        .attr("stroke", tick === 201 ? "#b66531" : "#dce1d4")
        .attr("stroke-dasharray", tick === 201 ? "5 4" : "none");
      svg
        .append("text")
        .attr("x", 38)
        .attr("y", y(tick) + 4)
        .attr("text-anchor", "end")
        .attr("font-size", 11)
        .attr("fill", "#66755d")
        .text(tick);
    }
    svg
      .append("text")
      .attr("x", 55)
      .attr("y", y(201) + 17)
      .attr("fill", "#a45930")
      .attr("font-size", 11)
      .text("201 seats = more than half");
    svg
      .append("path")
      .datum(rows)
      .attr(
        "d",
        line<(typeof rows)[number]>()
          .x((d) => x(d.year))
          .y((d) => y(d.seats)),
      )
      .attr("fill", "none")
      .attr("stroke", "#4264a4")
      .attr("stroke-width", 3);
    const points = svg
      .selectAll("g.point")
      .data(rows)
      .join("g")
      .attr("class", "point")
      .attr("aria-hidden", "true");
    points
      .append("circle")
      .attr("cx", (d) => x(d.year))
      .attr("cy", (d) => y(d.seats))
      .attr("r", 6)
      .attr("fill", (d) => (d.majority ? "#4264a4" : "#b66531"));
    points
      .append("text")
      .attr("x", (d) => x(d.year))
      .attr("y", (d) => y(d.seats) - 15)
      .attr("text-anchor", "middle")
      .attr("fill", "#27352e")
      .attr("font-size", 13)
      .text((d) => d.seats);
    points
      .append("text")
      .attr("x", (d) => x(d.year))
      .attr("y", 263)
      .attr("text-anchor", "middle")
      .attr("font-size", 12)
      .attr("fill", "#5d6f55")
      .text((d) => d.year);
  }, [report, start, end]);
  return (
    <>
      <svg
        className="time-chart"
        viewBox="0 0 810 285"
        ref={ref}
        role="img"
        aria-label={`Largest party's seats: ${rows.map((r) => `${r.year}: ${r.seats}`).join("; ")}. Majority needs 201. Shading marks ${start} to ${Math.min(end, 2024)}.`}
      />
      <div className="time-mobile">
        {rows.map((r) => (
          <div key={r.year}>
            <span>{r.year}</span>
            <div>
              <i
                style={{
                  width: `${r.seats / 4}%`,
                  background: r.majority ? "#4264a4" : "#b66531",
                }}
              />
              <b />
            </div>
            <strong>{r.seats}</strong>
          </div>
        ))}
        <small>
          0–400 seats; marker at 201. Each bar is an election, not an annual
          measurement.
        </small>
      </div>
    </>
  );
}

export default function ContextJourney({
  report,
  onExplore,
}: {
  report: Report;
  onExplore: () => void;
}) {
  const [step, setStep] = useState(0),
    [region, setRegion] = useState("Gauteng"),
    [scale, setScale] = useState<"one" | "region" | "country">("region"),
    [start, setStart] = useState(2014),
    [years, setYears] = useState(10);
  const panel = useRef<HTMLElement>(null),
    heading = useRef<HTMLHeadingElement>(null),
    first = useRef(true);
  const e = report.elections.find((e) => e.year === 2019)!;
  const geo = geography(e),
    rows = [...geo.regions, { name: "Overseas", votes: geo.outside }];
  const selected = geo.regions.find((r) => r.name === region)!;
  const audit = report.regionalValidation.find((a) => a.year === 2019)!;
  const source = report.sources.find((s) => s.id === "iec-2019-seats")!;
  const check = checksSummary(report),
    window = historicalWindow(report, start, years);
  const total =
    scale === "one" ? 1 : scale === "region" ? selected.votes : geo.total;
  useEffect(() => {
    if (first.current) first.current = false;
    else {
      heading.current?.focus({ preventScroll: true });
      globalThis.window.scrollTo({ top: 0, behavior: "instant" });
    }
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const context = gsap.context(
      () =>
        gsap.fromTo(
          ".scene-content",
          { y: 10, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.35 },
        ),
      panel,
    );
    return () => context.revert();
  }, [step]);
  const restart = () => {
    setStep(0);
    setScale("region");
    setRegion("Gauteng");
    setStart(2014);
    setYears(10);
  };
  return (
    <div className="journey context-journey">
      <a className="skip-link" href="#lesson">
        Skip to explanation
      </a>
      <header className="lesson-header">
        <a className="lesson-brand" href="#lesson" onClick={restart}>
          <b>
            1<span>·</span>
          </b>
          <span>
            ONE VOTE
            <br />
            TIME & CHANGE
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
          <span>HISTORICAL EVIDENCE · NOT A FORECAST</span>
        </div>
        <div
          className="progress"
          role="progressbar"
          aria-label="Explanation progress"
          aria-valuenow={step + 1}
          aria-valuemin={0}
          aria-valuemax={titles.length}
        >
          <div
            className="determinate"
            style={{ width: `${((step + 1) / titles.length) * 100}%` }}
          />
        </div>
      </div>
      <main id="lesson" ref={panel}>
        <div key={step} className="scene-content">
          <p className="lesson-eyebrow">{labels[step]}</p>
          <h1 ref={heading} tabIndex={-1}>
            {titles[step]}
          </h1>
          {step === 0 && (
            <>
              <p className="lesson-lead">
                The concern is bigger than “does a vote count?” It is whether a
                tiny individual input can produce a change you value, within a
                meaningful part of your life.
              </p>
              <blockquote className="context-question">
                “If change takes years, my ballot barely affects it, and the
                result may not improve my life—what does participation actually
                change?”
              </blockquote>
              <div className="context-three">
                <article>
                  <span>CLAIM 1 · INFLUENCE</span>
                  <h2>My one vote makes no difference.</h2>
                  <p>
                    Test whether one changed ballot alters the national seat
                    allocation.
                  </p>
                </article>
                <article>
                  <span>CLAIM 2 · TIME</span>
                  <h2>Change needs several elections.</h2>
                  <p>
                    Check how long observed shifts took. Do not turn a past
                    trend into a promised waiting time.
                  </p>
                </article>
                <article>
                  <span>CLAIM 3 · VALUE</span>
                  <h2>I may not want the result.</h2>
                  <p>
                    Distinguish a changed electoral result from an improvement
                    you personally value.
                  </p>
                </article>
              </div>
              <p className="lesson-insight">
                We will assess these separately. A result can support one part
                of the argument and leave another unanswered.
              </p>
            </>
          )}
          {step === 1 && (
            <>
              <p className="lesson-lead">
                A national ballot helps choose representatives. It is not a
                direct vote for a guaranteed policy, service improvement or
                personal outcome.
              </p>
              <div className="domain-route">
                <article>
                  <span>YOUR INPUT</span>
                  <h2>Ballots</h2>
                  <p>People express a choice.</p>
                </article>
                <i>→</i>
                <article>
                  <span>MEASURED HERE</span>
                  <h2>400 seats</h2>
                  <p>One seat is one National Assembly representative.</p>
                </article>
                <i>→</i>
                <article>
                  <span>MEASURED HERE</span>
                  <h2>201 seats</h2>
                  <p>
                    More than half. A single-party majority is different from
                    being the largest party.
                  </p>
                </article>
              </div>
              <div className="domain-beyond">
                <span>THEN, FURTHER STEPS</span>
                <strong>
                  Parliament → political decisions → implementation → effects on
                  your life
                </strong>
                <p>
                  The National Assembly elects the President, passes laws and
                  oversees the executive. If no party has a majority alone,
                  cooperation between parties becomes relevant. None of this
                  guarantees a particular improvement.
                </p>
                <a href={govt} target="_blank" rel="noreferrer">
                  What the National Assembly does ↗
                </a>
              </div>
              <details className="lesson-details">
                <summary>
                  Where do regions fit—and what changed in 2024?
                </summary>
                <p>
                  The 400 seats comprise 200 regional seats plus 200
                  compensatory seats that help make the overall party allocation
                  proportional. “Regional” here means
                  province-to-National-Assembly representation, not seats in a
                  provincial legislature. In 2024, separate national and
                  regional ballots both contributed to the Assembly calculation;
                  a third ballot elected the provincial legislature. We use 2019
                  next to show geography without mixing those ballot types.
                </p>
                <a href={iec} target="_blank" rel="noreferrer">
                  IEC explanation of the ballot system ↗
                </a>
              </details>
            </>
          )}
          {step === 2 && (
            <>
              <p className="lesson-lead">
                “National” means countrywide. It is not an extra layer above the
                whole country. The nine regions contribute to one national
                result.
              </p>
              <div className="evidence-year">
                <label htmlFor="context-region">Choose a region</label>
                <select
                  className="browser-default region-select"
                  id="context-region"
                  value={region}
                  onChange={(ev) => setRegion(ev.target.value)}
                >
                  {geo.regions.map((r) => (
                    <option key={r.name}>{r.name}</option>
                  ))}
                </select>
                <span>
                  2019 · valid national ballots grouped by where they were cast
                </span>
              </div>
              <div className="geography-levels">
                <button
                  aria-pressed={scale === "one"}
                  onClick={() => setScale("one")}
                >
                  <span>ONE BALLOT</span>
                  <strong>1</strong>
                  <small>An individual input</small>
                </button>
                <i>→</i>
                <button
                  aria-pressed={scale === "region"}
                  onClick={() => setScale("region")}
                >
                  <span>{region.toUpperCase()}</span>
                  <strong>{fmt(selected.votes)}</strong>
                  <small>Ballots cast in this region</small>
                </button>
                <i>→</i>
                <button
                  aria-pressed={scale === "country"}
                  onClick={() => setScale("country")}
                >
                  <span>WHOLE COUNTRY</span>
                  <strong>{fmt(geo.total)}</strong>
                  <small>Nine regions + {fmt(geo.outside)} overseas</small>
                </button>
              </div>
              <div className="scale-clock card-panel" aria-live="polite">
                <span>MAKE THE SIZE TANGIBLE</span>
                <strong>
                  {scale === "one"
                    ? "1 second"
                    : `About ${Math.round(total / 86400)} days`}
                </strong>
                <p>
                  At <b>one ballot per second</b>, counting{" "}
                  {scale === "one"
                    ? "your ballot"
                    : scale === "region"
                      ? `this region’s ${fmt(total)} ballots`
                      : `all ${fmt(total)} ballots`}{" "}
                  would take{" "}
                  {scale === "one"
                    ? "one second"
                    : `${(total / 86400).toFixed(1)} days nonstop`}
                  . This is a scale analogy, not the IEC’s counting time.
                </p>
                {scale !== "one" && (
                  <small>
                    Your one second is 1 out of {fmt(total)}. Changing the scale
                    does not multiply your ballot.
                  </small>
                )}
              </div>
              <RegionTiles rows={rows} selected={region} />
              <p className="context-caption">
                Tiles show ballot counts, not land area. The highlighted region
                accounts for {((100 * selected.votes) / geo.total).toFixed(1)}%
                of the national count. This is a diagram of aggregation, not a
                geographic map.
              </p>
              <div className="region-seat-route">
                <span>
                  <b>{audit.capacities![region]}</b> regional seats for {region}
                </span>
                <i>within</i>
                <span>
                  <b>200</b> regional seats across the country
                </span>
                <i>+</i>
                <span>
                  <b>200</b> compensatory seats
                </span>
                <i>=</i>
                <span>
                  <b>400</b> National Assembly seats
                </span>
              </div>
              <details className="lesson-details">
                <summary>What this scale view cannot tell us</summary>
                <p>
                  One regional ballot is not worth {audit.capacities![region]}{" "}
                  seats. The counts and the allocation formula determine how the
                  seats are divided. A smaller region does not automatically
                  make a ballot decisive: its distance from an allocation
                  boundary also matters. Voting-district, municipal-election and
                  provincial-legislature results have not been ingested here, so
                  we do not extrapolate national findings to those elections.
                </p>
              </details>
            </>
          )}
          {step === 3 && (
            <>
              <p className="lesson-lead">
                These are published election totals, followed by our
                calculations. We did not observe individual voters, preferences
                or annual changes in opinion.
              </p>
              <ol className="provenance-route">
                <li>
                  <b>IEC publishes the results.</b>
                  <span>
                    PDF and spreadsheet reports give vote counts and seat
                    allocations. They are aggregated counts, not a survey of
                    people’s motives.
                  </span>
                </li>
                <li>
                  <b>We preserve the source files.</b>
                  <span>
                    The registry records the URL, retrieval time and a file
                    fingerprint. This detects later file changes; it is not an
                    independent audit of ballot counting.
                  </span>
                </li>
                <li>
                  <b>We extract and reconcile counts.</b>
                  <span>
                    Party rows are checked against published totals. The scanned
                    1999 seat table required a checked manual transcription.
                  </span>
                </li>
                <li>
                  <b>We reproduce the seat result.</b>
                  <span>
                    All 211 party-election national seat totals match across
                    seven elections. Regional and compensatory baselines also
                    match for 2004–2024.
                  </span>
                </li>
                <li>
                  <b>We change a count and recalculate.</b>
                  <span>
                    This creates a hypothetical scenario around a real result.
                    It is not a new observed election or a prediction.
                  </span>
                </li>
              </ol>
              <div className="source-proof">
                <strong>Trace the 2019 example</strong>
                <a href={source.url} target="_blank" rel="noreferrer">
                  Open the original IEC vote-and-seat report ↗
                </a>
                <small>
                  Retrieved{" "}
                  {new Date(source.retrievedAt).toISOString().slice(0, 10)} ·{" "}
                  {fmt(source.sizeBytes)} bytes
                </small>
                <details>
                  <summary>Show file fingerprint</summary>
                  <code>{source.sha256}</code>
                </details>
              </div>
              <p className="lesson-insight">
                We have seven national election observations, not thirty annual
                observations. Dividing a five-year difference by five does not
                create five measured yearly changes.
              </p>
            </>
          )}
          {step === 4 && (
            <>
              <p className="lesson-lead">
                The narrow historical test asks whether adding, removing or
                switching one counted ballot crosses a national seat-allocation
                boundary in the realised result. Any verified seat change is a
                counterexample.
              </p>
              <p className="lesson-insight">
                In this report, “one vote” means one counted ballot unless a
                voter-level scenario is explicitly labelled. That distinction
                matters especially in 2024, when one voter could cast multiple
                ballots.
              </p>
              <div className="influence-results">
                <article>
                  <span>ALL PARTIES · 1994–2024</span>
                  <strong>{fmt(check.national)}</strong>
                  <p>one-ballot national scenarios</p>
                  <b>
                    {check.changed} changed allocations · {check.ties}{" "}
                    unresolved ties
                  </b>
                </article>
                <article>
                  <span>REGIONAL COMPONENT · 2004–2024</span>
                  <strong>{fmt(check.regional)}</strong>
                  <p>eligible one-ballot regional scenarios</p>
                  <b>{check.regionalChanges} changed regional allocations</b>
                </article>
              </div>
              <div className="evidence-note">
                <span>OBSERVED RESULT</span>
                <h2>No tested one-ballot perturbation changed the allocation.</h2>
                <p>
                  This is a deterministic result for the historical scenarios
                  tested. It is not an estimated probability that a future
                  ballot will or will not be decisive.
                </p>
              </div>
              <div className="gap-warning">
                <strong>The missing denominator is the gap to change.</strong>
                <p>
                  One ballot divided by millions describes size. One ballot
                  compared with the smallest change needed to move a seat
                  describes proximity to impact. Our complete minimum-seat and
                  minimum-majority searches across every party are still
                  unfinished.
                </p>
              </div>
              <details className="lesson-details">
                <summary>What these checks exclude</summary>
                <p>
                  The national model calculates overall entitlements without
                  candidate-list exhaustion, regional overhang redistribution or
                  winning-independent counterfactuals. The 2024 national checks
                  change only the national ballot, holding regional votes fixed.
                  Thousands of scenarios around seven outcomes are not thousands
                  of independent elections. Regional checks test the regional
                  component separately.
                </p>
              </details>
            </>
          )}
          {step === 5 && (
            <>
              <p className="lesson-lead">
                The time cost is real as a personal concern. The data can show
                how long observed electoral shifts took; it cannot promise how
                long you must wait for an outcome you would value.
              </p>
              <div className="time-controls">
                <label>
                  Start observing in{" "}
                  <select
                    className="browser-default"
                    value={start}
                    onChange={(ev) => setStart(Number(ev.target.value))}
                  >
                    {report.elections.slice(0, -1).map((e) => (
                      <option key={e.year}>{e.year}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Follow for{" "}
                  <select
                    className="browser-default"
                    value={years}
                    onChange={(ev) => setYears(Number(ev.target.value))}
                  >
                    {[5, 10, 15].map((y) => (
                      <option key={y} value={y}>
                        {y} years
                      </option>
                    ))}
                  </select>
                </label>
                <span>Historical windows, not a forecast</span>
              </div>
              <div
                className="year-ruler"
                aria-label={`${years} years of elapsed time`}
              >
                {Array.from({ length: years }, (_, i) => (
                  <div
                    key={i}
                    className={(i + 1) % 5 === 0 ? "election-mark" : ""}
                  >
                    <span>{i + 1}</span>
                    <small>{(i + 1) % 5 === 0 ? start + i + 1 : ""}</small>
                  </div>
                ))}
              </div>
              <p className="context-caption">
                One block = one year. Dates mark five-year intervals; an
                endpoint after 2024 has no outcome in this dataset.
              </p>
              <div className="time-window-result" aria-live="polite">
                <strong>
                  {start} → {window.endYear}: {years} years
                </strong>
                {window.last ? (
                  <>
                    <span>
                      Largest party: {window.first.seats} → {window.last.seats}{" "}
                      seats ({window.seatChange! > 0 ? "+" : ""}
                      {window.seatChange})
                    </span>
                    <p>
                      {window.first.majority && !window.last.majority
                        ? "The period ends without a single-party majority."
                        : window.last.majority
                          ? "A single party still has a majority at the endpoint."
                          : "No party has a majority alone at the endpoint."}{" "}
                      This measures representation, not whether life improved.
                    </p>
                  </>
                ) : (
                  <>
                    <span>Endpoint not observed.</span>
                    <p>
                      The data ends in 2024. We cannot fill in {window.endYear},
                      project a straight line, or call this a waiting-time
                      estimate.
                    </p>
                  </>
                )}
              </div>
              <div className="card-panel time-panel">
                <div className="diagram-caption">
                  <b>Seats held by the largest party in each election</b>
                  <span>Actual results · 0–400 seats</span>
                </div>
                <TimeChart report={report} start={start} end={window.endYear} />
              </div>
              <div className="time-three">
                <article>
                  <strong>30 years</strong>
                  <span>1994 → 2024</span>
                  <p>
                    From the first election in the series to the first result
                    without a single-party majority.
                  </p>
                </article>
                <article>
                  <strong>20 years</strong>
                  <span>2004 → 2024</span>
                  <p>From the largest party’s peak of 279 seats to 159.</p>
                </article>
                <article>
                  <strong>5 years</strong>
                  <span>2019 → 2024</span>
                  <p>
                    The final interval: 230 → 159 seats, crossing below 201.
                  </p>
                </article>
              </div>
              <p className="lesson-insight">
                Long-term persistence is visible. But “change must take more
                than a decade” is not a general rule supported by these results.
                The starting point and your definition of change determine the
                answer.
              </p>
              <details className="lesson-details">
                <summary>Why not project the annual change forward?</summary>
                <p>
                  These elections are five years apart. A difference divided by
                  five is an average rate between endpoints, not a measured
                  annual process. Changes are uneven, election rules changed in
                  2024, and there are only seven national observations. A
                  straight-line estimate of “years until change” would hide that
                  uncertainty. This largest-party series happens to track the
                  ANC throughout these seven elections; it is a concentration
                  measure, not a judgment about that party. No party label or
                  colour is used to recommend an outcome.
                </p>
              </details>
            </>
          )}
          {step === 6 && (
            <>
              <p className="lesson-lead">
                The original position contains an empirical claim, a timing
                claim and a personal judgment. The evidence addresses them at
                different levels.
              </p>
              <div className="verdict-rows">
                <article>
                  <span className="verdict-tag">
                    OBSERVED IN THE TESTS
                  </span>
                  <h2>“My one ballot did not change the national result.”</h2>
                  <p>
                    Supported if “result” means party seat totals in the tested
                    historical scenarios. No tested one-ballot perturbation
                    changed them. Broader political effects were not measured.
                  </p>
                </article>
                <article>
                  <span className="verdict-tag qualified">
                    NOT ESTABLISHED AS A GENERAL RULE
                  </span>
                  <h2>
                    “Electoral change requires multiple elections and more than
                    ten years.”
                  </h2>
                  <p>
                    The record includes long persistence and substantial changes
                    within a single five-year interval. It does not yield a
                    universal waiting time. Seat changes, losing a majority and
                    improving services are different endpoints.
                  </p>
                </article>
                <article>
                  <span className="verdict-tag unknown">
                    NOT ANSWERED BY THIS DATA
                  </span>
                  <h2>“The result may not be worth that part of my life.”</h2>
                  <p>
                    Election counts do not measure the value of your time,
                    whether you prefer the eventual outcome, or improvements in
                    your life. That requires explicit outcome criteria and
                    additional evidence, not just a seat chart.
                  </p>
                </article>
              </div>
              <div className="lesson-conclusion">
                <span>WHAT THE CURRENT EVIDENCE ESTABLISHES</span>
                <strong>
                  No observed single-ballot seat change in the tested scenarios. Uneven collective change.
                  No guaranteed personal benefit or waiting time.
                </strong>
                <p>
                  The current data establishes a narrow historical seat-impact
                  result within the tested counterfactuals. It does not establish
                  that participation is or is not worthwhile, and it does not
                  estimate future pivotality.
                </p>
              </div>
              <div className="lesson-summary-actions">
                <a
                  className="btn tonal"
                  href="/guide-summary.html"
                  target="_blank"
                  rel="noreferrer"
                >
                  Keep the evidence summary ↗
                </a>
                <button className="btn-flat" onClick={onExplore}>
                  Inspect the calculations ↗
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
            onClick={() => setStep(step - 1)}
          >
            ← Back
          </button>
          <span>
            {step < titles.length - 1
              ? `Next: ${labels[step + 1]}`
              : "Three claims. Three evidence statuses."}
          </span>
          <button
            className="btn"
            onClick={() =>
              step === titles.length - 1 ? restart() : setStep(step + 1)
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
