import React, { useEffect, useMemo, useRef, useState } from "react";
import * as echarts from "echarts/core";
import { LineChart, BarChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  MarkAreaComponent,
  MarkLineComponent,
} from "echarts/components";
import { SVGRenderer } from "echarts/renderers";
import type { EChartsOption } from "echarts";
import gsap from "gsap";
import { allocate, perturb, type Mechanism } from "./analytics/engine";
import type { Election, Party, Report } from "./types";
import Story from "./ContextJourney";
echarts.use([
  LineChart,
  BarChart,
  GridComponent,
  TooltipComponent,
  MarkAreaComponent,
  MarkLineComponent,
  SVGRenderer,
]);

const number = (n: number) => n.toLocaleString("en-ZA");
const fixed = (n: number, d = 2) => n.toFixed(d);
const aliases: Record<string, string> = {
  "AFRICAN NATIONAL CONGRESS": "ANC",
  "DEMOCRATIC ALLIANCE": "DA",
  "DEMOCRATIC ALLIANCE/DEMOKRATIESE ALLIANSIE": "DA",
  "ECONOMIC FREEDOM FIGHTERS": "EFF",
  "INKATHA FREEDOM PARTY": "IFP",
  "VRYHEIDSFRONT PLUS": "VF+",
  "AFRICAN CHRISTIAN DEMOCRATIC PARTY": "ACDP",
  "UNITED DEMOCRATIC MOVEMENT": "UDM",
  "AFRICAN TRANSFORMATION MOVEMENT": "ATM",
  "AFRICAN INDEPENDENT CONGRESS": "AIC",
  "CONGRESS OF THE PEOPLE": "COPE",
  "PAN AFRICANIST CONGRESS OF AZANIA": "PAC",
  "NATIONAL FREEDOM PARTY": "NFP",
  "UMKHONTO WESIZWE": "MK",
};
const short = (p: Party) => aliases[p.party] ?? p.abbreviation;
const color = (p: Party) =>
  ({
    ANC: "#217467",
    DA: "#3679aa",
    EFF: "#bd513d",
    IFP: "#ad8657",
    "VF+": "#768b57",
    MK: "#3a4d39",
  })[short(p)] ?? "#9b9e9b";
const tabs = [
  "One vote",
  "Historical patterns",
  "Counterfactual",
  "Provinces",
  "Methodology & sources",
] as const;
type Page = (typeof tabs)[number];

function Chart({ option, label }: { option: EChartsOption; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const chart = echarts.init(ref.current!, undefined, { renderer: "svg" });
    chart.setOption({
      ...option,
      animation: !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    });
    const resize = new ResizeObserver(() => chart.resize());
    resize.observe(ref.current!);
    return () => {
      resize.disconnect();
      chart.dispose();
    };
  }, [option]);
  return <div className="chart" ref={ref} role="img" aria-label={label} />;
}

function SeatMap({ e, seats }: { e: Election; seats: Record<string, number> }) {
  const parties = [...e.parties].sort(
    (a, b) => b.officialSeats - a.officialSeats,
  );
  return (
    <>
      <div
        className="seat-grid"
        aria-label="400 National Assembly seat entitlements"
      >
        {parties.flatMap((p) =>
          Array.from({ length: seats[p.party] ?? 0 }, (_, i) => (
            <span
              key={`${p.party}-${i}`}
              style={{ backgroundColor: color(p) }}
              title={`${short(p)} · ${seats[p.party]} seats`}
            />
          )),
        )}
      </div>
      <div className="seat-legend">
        {parties
          .filter((p) => seats[p.party] > 0)
          .slice(0, 6)
          .map((p) => (
            <span key={p.party}>
              <i style={{ background: color(p) }} />
              {short(p)} <b>{seats[p.party]}</b>
            </span>
          ))}
        <span className="muted">Each square = 1 seat</span>
      </div>
    </>
  );
}

function App({ report }: { report: Report }) {
  const [page, setPage] = useState<Page>("One vote");
  const [year, setYear] = useState(2019);
  const [partyId, setPartyId] = useState("AFRICAN NATIONAL CONGRESS");
  const [mechanism, setMechanism] = useState<Mechanism>("add");
  const [destination, setDestination] = useState("DEMOCRATIC ALLIANCE");
  const [k, setK] = useState(1);
  const e = report.elections.find((e) => e.year === year)!;
  const party =
    e.parties.find((p) => p.party === partyId) ??
    e.parties.find((p) => short(p) === "ANC")!;
  const target =
    e.parties.find((p) => p.party === destination && p.party !== party.party) ??
    [...e.parties]
      .sort((a, b) => b.votes - a.votes)
      .find((p) => p.party !== party.party)!;
  const inputVotes = useMemo(
    () => Object.fromEntries(e.parties.map((p) => [p.party, p.votes])),
    [e],
  );
  const changed = page === "One vote" ? 1 : k;
  const baseline = Object.fromEntries(
    e.parties.map((p) => [p.party, p.officialSeats]),
  );
  const simulated = useMemo(() => {
    try {
      const votes = perturb(
        inputVotes,
        party.party,
        changed,
        mechanism,
        target.party,
      );
      const total = Object.values(votes).reduce((a, b) => a + b, 0);
      if (!total)
        throw new Error("No valid votes remain. Vote share is undefined.");
      const entitlementVotes = Object.fromEntries(
        e.parties.map((p) => [
          p.party,
          votes[p.party] + (p.regionalVotes ?? 0),
        ]),
      );
      try {
        return { votes, total, seats: allocate(entitlementVotes), error: null };
      } catch (err) {
        return { votes, total, seats: null, error: (err as Error).message };
      }
    } catch (err) {
      return {
        votes: inputVotes,
        total: e.voteTotal,
        seats: null,
        error: (err as Error).message,
      };
    }
  }, [inputVotes, party.party, changed, mechanism, target.party, e]);
  const delta =
    (simulated.votes[party.party] / simulated.total -
      party.votes / e.voteTotal) *
    100;
  const moved = simulated.seats
    ? Object.keys(baseline).reduce(
        (n, p) => n + Math.abs(simulated.seats![p] - baseline[p]),
        0,
      ) / 2
    : null;
  const majority = (seats: Record<string, number> | null) => {
    if (!seats) return "Unresolved";
    const p = e.parties.find((p) => seats[p.party] >= 201);
    return p ? short(p) : "No single party";
  };
  const headingRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ".reveal",
        { y: 18, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.55, stagger: 0.07, ease: "power2.out" },
      );
    }, headingRef);
    return () => ctx.revert();
  }, [page]);
  function chooseYear(y: number) {
    setYear(y);
    setK(1);
    setPartyId(y === 1994 ? "ANC" : "AFRICAN NATIONAL CONGRESS");
  }
  const controls = (
    <div className="row g-3">
      <div className="col-sm-4">
        <label className="form-label" htmlFor="election">
          Historical election
        </label>
        <select
          id="election"
          className="form-select"
          value={year}
          onChange={(x) => chooseYear(Number(x.target.value))}
        >
          {report.elections.map((e) => (
            <option key={e.year}>{e.year}</option>
          ))}
        </select>
      </div>
      <div className="col-sm-8">
        <label className="form-label" htmlFor="party">
          Party
        </label>
        <select
          id="party"
          className="form-select"
          value={party.party}
          onChange={(x) => {
            setPartyId(x.target.value);
            setK(1);
          }}
        >
          {[...e.parties]
            .sort((a, b) => b.votes - a.votes)
            .map((p) => (
              <option key={p.party} value={p.party}>
                {short(p)} · {p.name}
              </option>
            ))}
        </select>
      </div>
    </div>
  );
  const mechanismControls = (
    <>
      <fieldset className="mt-4">
        <legend className="form-label">Change mechanism</legend>
        <div className="segmented">
          {(["add", "abstain", "switch"] as const).map((m) => (
            <button
              type="button"
              key={m}
              aria-pressed={mechanism === m}
              className={mechanism === m ? "selected" : ""}
              onClick={() => {
                setMechanism(m);
                setK(1);
              }}
            >
              {
                {
                  add: "New vote",
                  abstain: "Abstention",
                  switch: "Switch vote",
                }[m]
              }
            </button>
          ))}
        </div>
      </fieldset>
      {mechanism === "switch" && (
        <div className="mt-3">
          <label className="form-label" htmlFor="destination">
            Switch from {short(party)} to
          </label>
          <select
            id="destination"
            className="form-select"
            value={target.party}
            onChange={(x) => setDestination(x.target.value)}
          >
            {e.parties
              .filter((p) => p.party !== party.party)
              .map((p) => (
                <option key={p.party} value={p.party}>
                  {short(p)}
                </option>
              ))}
          </select>
        </div>
      )}
    </>
  );
  const assumptions = (
    <p className="scope-note">
      Seat results are <strong>national entitlements</strong>, with no
      candidate-list limits or regional overhang adjustments.{" "}
      {year === 2024
        ? "Only the national ballot changes; regional votes stay fixed."
        : "The national vote distribution changes; regional seat allocation is not recomputed."}{" "}
      <button
        className="text-button"
        onClick={() => setPage("Methodology & sources")}
      >
        Read the model’s limits ↗
      </button>
    </p>
  );
  return (
    <div ref={headingRef as React.RefObject<HTMLDivElement>}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="topbar">
        <a
          className="brand"
          href="#"
          onClick={(ev) => {
            ev.preventDefault();
            setPage("One vote");
          }}
        >
          <span className="brand-mark">
            1<span>·</span>
          </span>
          <span>
            SA ELECTORAL
            <br />
            <b>IMPACT LAB</b>
          </span>
        </a>
        <span className="edition">
          AN INDEPENDENT DATA EXPLORATION <span>1994 — 2024</span>
        </span>
        <a href="/data/elections.csv" download className="download-link">
          Download data <span>↗</span>
        </a>
      </header>
      <nav className="nav-strip" aria-label="Report sections">
        {tabs.map((t, i) => (
          <button
            key={t}
            onClick={() => setPage(t)}
            className={page === t ? "active" : ""}
            aria-current={page === t ? "page" : undefined}
          >
            <span>0{i + 1}</span>
            {t}
          </button>
        ))}
      </nav>
      <main id="main" className="container-fluid report-shell">
        {(page === "One vote" || page === "Counterfactual") && (
          <>
            <section className="hero reveal">
              <div>
                <div className="eyebrow">
                  <span className="status-dot" /> THE ARITHMETIC OF
                  PARTICIPATION
                </div>
                <h1>
                  {page === "One vote" ? (
                    <>
                      Does one vote
                      <br />
                      actually <em>matter?</em>
                    </>
                  ) : (
                    <>
                      Small decisions.
                      <br />
                      <em>Collective change.</em>
                    </>
                  )}
                </h1>
                <p>
                  {page === "One vote"
                    ? "One ballot changes the tally. Whether it changes representation is a different question. Explore the numbers behind South Africa’s national elections."
                    : "Change the number of ballots, hold the scenario explicit, and see how a historical national vote distribution responds."}
                </p>
                <small>
                  Throughout this report, “one vote” means one counted ballot
                  unless a voter-level scenario is explicitly labelled. In
                  2024, one voter could cast multiple ballots.
                </small>
              </div>
              <aside className="hero-aside">
                <span className="mini-label">
                  THE QUESTION ISN’T YES OR NO.
                </span>
                <p>
                  It’s{" "}
                  <i>
                    what changes,
                    <br />
                    and by how much?
                  </i>
                </p>
                <div className="audit-stamp">
                  <span>✓</span>
                  <div>
                    <b>7 / 7 elections reproduced</b>
                    <small>Every party’s national seat entitlement</small>
                  </div>
                </div>
              </aside>
            </section>
            <div className="section-title reveal">
              <h2>
                <span>01 /</span>{" "}
                {page === "One vote"
                  ? "Put one vote in perspective"
                  : "Run a counterfactual"}
              </h2>
              <span className="pill">HISTORICAL · NOT A FORECAST</span>
            </div>
            <section className="calculator row g-0 reveal">
              <div className="col-lg-5 control-panel">
                {controls}
                {mechanismControls}
                {page === "Counterfactual" && (
                  <div className="scale-control">
                    <label className="form-label" htmlFor="vote-count">
                      How many ballots change?
                    </label>
                    <input
                      id="vote-count"
                      className="form-control count-input"
                      type="number"
                      min="0"
                      max={mechanism === "add" ? 3000000 : party.votes}
                      value={k}
                      onChange={(x) =>
                        setK(
                          Math.max(
                            0,
                            Math.min(
                              mechanism === "add" ? 3000000 : party.votes,
                              Math.floor(Number(x.target.value) || 0),
                            ),
                          ),
                        )
                      }
                    />
                    <input
                      className="form-range mt-3"
                      aria-label="Number of ballots"
                      type="range"
                      min="0"
                      max={Math.min(
                        3000000,
                        mechanism === "add" ? 3000000 : party.votes,
                      )}
                      step="1"
                      value={k}
                      onChange={(x) => setK(Number(x.target.value))}
                    />
                    <div className="scale-labels">
                      <span>0</span>
                      <span>
                        {number(
                          Math.min(
                            3000000,
                            mechanism === "add" ? 3000000 : party.votes,
                          ),
                        )}
                      </span>
                    </div>
                    <div className="quick-values">
                      {[1, 100, 10000, 100000, 1000000].map((n) => (
                        <button
                          key={n}
                          disabled={mechanism !== "add" && n > party.votes}
                          onClick={() => setK(n)}
                        >
                          {n >= 1000000 ? "1m" : n >= 1000 ? `${n / 1000}k` : n}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="ballot-equation">
                  <span>
                    {mechanism === "add" ? "+" : "−"}
                    {number(changed)}
                  </span>
                  <div>
                    {mechanism === "add"
                      ? `additional ${short(party)} ${changed === 1 ? "ballot" : "ballots"}`
                      : mechanism === "abstain"
                        ? `${short(party)} ${changed === 1 ? "voter abstains" : "voters abstain"}`
                        : `${short(party)} → ${short(target)}`}
                    <small>
                      {mechanism === "switch"
                        ? "Total valid votes stay constant."
                        : mechanism === "add"
                          ? "The party tally and total both increase."
                          : "The party tally and total both decrease."}
                    </small>
                  </div>
                </div>
              </div>
              <div className="col-lg-7 result-panel" aria-live="polite">
                <div className="result-head">
                  <span className="mini-label">
                    {year} · {short(party)} · NATIONAL BALLOT
                  </span>
                  <span className="pill dark">THE RESULT</span>
                </div>
                <div className="big-number">
                  {delta >= 0 ? "+" : "−"}
                  {Math.abs(delta).toFixed(7)}
                  <span> pp</span>
                </div>
                <p className="result-caption">
                  change in {short(party)}’s national vote share
                </p>
                <div className="result-grid">
                  <div>
                    <span>PARTY VOTES</span>
                    <b>{number(party.votes)}</b>
                    <small>→ {number(simulated.votes[party.party])}</small>
                  </div>
                  <div>
                    <span>PARTY ENTITLEMENT</span>
                    <b>
                      {party.officialSeats} <small>→</small>{" "}
                      {simulated.seats?.[party.party] ?? "—"}
                    </b>
                    <small>of 400 seats</small>
                  </div>
                  <div>
                    <span>SEATS REALLOCATED</span>
                    <b>{moved ?? "—"}</b>
                    <small>
                      {moved === 0
                        ? "Entitlements unchanged"
                        : moved === null
                          ? "Unresolved tie"
                          : "Under this model"}
                    </small>
                  </div>
                </div>
                <div className="majority-status">
                  <span>
                    Single-party parliamentary majority{" "}
                    <small>201 seats needed</small>
                  </span>
                  <b>
                    {majority(baseline)} → {majority(simulated.seats)}
                  </b>
                </div>
                {simulated.error ? (
                  <p role="alert" className="alert alert-warning">
                    {simulated.error}
                  </p>
                ) : (
                  <SeatMap e={e} seats={simulated.seats!} />
                )}
              </div>
            </section>
            {assumptions}
            <section className="bottom-insights row g-4">
              <div className="col-lg-5">
                <div className="insight-card">
                  <span className="eyebrow">
                    SCALE, NOT A VOTING RECOMMENDATION
                  </span>
                  <h3>
                    One ballot is part
                    <br />
                    of a bigger change.
                  </h3>
                  <p>
                    In {year}, one ballot’s weight was{" "}
                    <b>{fixed(100 / e.voteTotal, 7)} percentage points</b> of
                    the valid national vote. Its exact marginal effect also
                    depends on which tally and denominator change.
                  </p>
                  <p>
                    A smooth 400-seat proportional average is{" "}
                    <b>{fixed(e.metrics.smoothSeatEquivalent, 8)} seats per ballot</b>,
                    equivalent to about{" "}
                    <b>{number(Math.round(e.metrics.averageBallotsPerSeat))} ballots per seat</b>.
                    Actual seats are discrete, so the realised marginal seat
                    effect remains zero until an allocation boundary is crossed.
                  </p>
                  <button
                    className="solid-button"
                    onClick={() => {
                      setPage(
                        page === "One vote" ? "Counterfactual" : "One vote",
                      );
                      setK(1);
                    }}
                  >
                    {page === "One vote"
                      ? "Explore collective change"
                      : "Return to one vote"}{" "}
                    <span>↗</span>
                  </button>
                </div>
              </div>
              <div className="col-lg-7">
                <div className="threshold-card">
                  <div className="mini-label">A DIFFERENT THRESHOLD</div>
                  <h3>From vote share to majority.</h3>
                  <p>
                    Ballots needed to take the ANC{" "}
                    <strong>strictly below 50% of national votes</strong> in{" "}
                    {year}. This is a vote-share threshold, not the 201-seat
                    parliamentary threshold.
                  </p>
                  <div className="threshold-row">
                    <span>ANC voters switch to other parties</span>
                    <b>{number(e.anc.belowHalf.switch ?? 0)}</b>
                  </div>
                  <div className="threshold-row">
                    <span>Additional votes for other parties</span>
                    <b>{number(e.anc.belowHalf.opposition_add ?? 0)}</b>
                  </div>
                  <div className="threshold-row">
                    <span>ANC voters abstain</span>
                    <b>
                      {e.anc.belowHalf.abstain === null
                        ? "Not reachable"
                        : number(e.anc.belowHalf.abstain)}
                    </b>
                  </div>
                  {e.anc.share < 50 && (
                    <small>Already below 50% in the observed election.</small>
                  )}
                </div>
              </div>
            </section>
          </>
        )}
        {page === "Historical patterns" && (
          <>
            <section className="page-heading reveal">
              <span className="eyebrow">02 / HISTORICAL PATTERNS</span>
              <h1>
                Stability has
                <br />
                <em>a history.</em>
              </h1>
              <p>
                Six elections describe the earlier pattern. The seventh shows
                why a historical standard deviation is not a probability.
              </p>
            </section>
            <div className="history-metrics row g-3">
              <Metric
                value={`${fixed(report.history.mean)}%`}
                label="1994–2019 ANC mean"
              />
              <Metric
                value={`${fixed(report.history.sampleSD)} pp`}
                label="Sample standard deviation · n = 6"
              />
              <Metric
                value={`${fixed(report.history.thresholdDistanceSD)} σ`}
                label="50% threshold below the mean"
              />
            </div>
            <section className="chart-card">
              <div className="section-title">
                <h2>ANC national vote share</h2>
                <span className="pill">2024 EXCLUDED FROM BASELINE</span>
              </div>
              <Chart
                label="ANC national vote shares from 1994 to 2024, with historical sigma bands and the 50 percent threshold"
                option={historyOption(report)}
              />
              <p className="scope-note">
                Bands are ±1, ±2 and ±3 sample standard deviations around the
                1994–2019 mean. They are not confidence intervals. This is a
                retrospective holdout illustration: the 2024 outcome was already
                known when the split was chosen.
              </p>
            </section>
            <div className="table-responsive">
              <table className="table data-table">
                <caption>
                  Exact vote counts from archived IEC reports; percentages
                  computed from those counts.
                </caption>
                <thead>
                  <tr>
                    <th>Election</th>
                    <th>ANC votes</th>
                    <th>Vote share</th>
                    <th>Seats</th>
                    <th>Swing (pp)</th>
                    <th>Annualised (pp/year)</th>
                  </tr>
                </thead>
                <tbody>
                  {report.elections.map((e, i) => (
                    <tr key={e.year}>
                      <th>
                        {e.year}
                        {e.year === 2024 && <small> Holdout</small>}
                      </th>
                      <td>{number(e.anc.votes)}</td>
                      <td>{fixed(e.anc.share)}%</td>
                      <td>{e.anc.seats} / 400</td>
                      <td>
                        {i ? fixed(report.history.swings[i - 1].changePP) : "—"}
                      </td>
                      <td>
                        {i
                          ? fixed(report.history.swings[i - 1].annualisedPP)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {page === "Provinces" && (
          <>
            <section className="page-heading reveal">
              <span className="eyebrow">04 / GEOGRAPHIC CONTEXT</span>
              <h1>
                One country.
                <br />
                <em>Different patterns.</em>
              </h1>
              <p>
                Compare the national ballot across nine provinces within an
                election. These are national-election votes cast in each
                province, not provincial-legislature results.
              </p>
            </section>
            <section className="chart-card">
              <div className="compact-controls">{controls}</div>
              <Chart
                label={`${short(party)} national ballot share by province in ${year}`}
                option={provinceOption(e, party)}
              />
              <div className="table-responsive">
                <table className="table data-table">
                  <thead>
                    <tr>
                      <th>Province</th>
                      <th>{short(party)} votes</th>
                      <th>Valid national votes</th>
                      <th>Party share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(party.provinceVotes).map(
                      ([province, votes]) => {
                        const total = e.parties.reduce(
                          (n, p) => n + p.provinceVotes[province],
                          0,
                        );
                        return (
                          <tr key={province}>
                            <th>{province}</th>
                            <td>{number(votes)}</td>
                            <td>{number(total)}</td>
                            <td>{fixed((100 * votes) / total)}%</td>
                          </tr>
                        );
                      },
                    )}
                  </tbody>
                </table>
              </div>
              <p className="scope-note">
                Overseas ballots are excluded from this comparison. Province
                names in 1994 have been mapped to their current names for
                display; boundaries have not been harmonised for longitudinal
                inference. Municipal and voting-district crosswalks remain
                outstanding.
              </p>
            </section>
          </>
        )}
        {page === "Methodology & sources" && (
          <>
            <section className="page-heading reveal">
              <span className="eyebrow">05 / OPEN METHODS</span>
              <h1>
                Follow the maths.
                <br />
                <em>Check the evidence.</em>
              </h1>
              <p>
                A reproducible report begins with the limits of its claims.
                Every source below is archived locally with a retrieval time and
                SHA-256 fingerprint.
              </p>
            </section>
            <div className="row g-4">
              <div className="col-lg-7">
                <article className="method-card">
                  <h2>What this model measures</h2>
                  <p>
                    The engine calculates national seat entitlements using the
                    IEC quota, up to five largest remainders, then the highest
                    average votes per seat already awarded. It reproduces all
                    211 party-election results across seven elections.
                  </p>
                  <p>
                    Reproducing historical totals is necessary, but does not
                    establish correctness for every possible counterfactual.
                    Candidate-list exhaustion, regional overhangs and winning
                    independents need additional rules and tests. The simulator
                    therefore reports national entitlements under those
                    exclusions.
                  </p>
                  <h3>Three different questions</h3>
                  <ol>
                    <li>
                      <b>Vote share:</b> continuous arithmetic; an additional
                      vote changes the denominator too.
                    </li>
                    <li>
                      <b>Representation:</b> discrete seat entitlements; 201
                      seats form a majority in a 400-seat assembly.
                    </li>
                    <li>
                      <b>Probability:</b> requires a defensible stochastic
                      model. None is estimated here.
                    </li>
                  </ol>
                  <h3>A historical test that can be challenged</h3>
                  <p>
                    The narrow test is whether a one-ballot perturbation crosses
                    a national entitlement boundary in the realised historical
                    results. A verified seat change is a counterexample. No
                    future pivotality probability is estimated from these
                    deterministic counterfactuals.
                  </p>
                  <h3>Minimum thresholds are bounded searches</h3>
                  <p>
                    The pipeline checks every integer k, in order, up to 50,000
                    for ANC additions and abstentions before 2024. It stops at
                    an unresolved tie. A result not found within a bound is not
                    proof that change is impossible. Crucially, the report now
                    separates the first change anywhere in the entitlement
                    vector from the first seat change of the selected party.
                  </p>
                </article>
              </div>
              <div className="col-lg-5">
                <article className="method-card research-card">
                  <span className="pill">
                    NEXT RESEARCH PHASE · NO ESTIMATES YET
                  </span>
                  <h2>
                    What correlates
                    <br />
                    with electoral patterns?
                  </h2>
                  <p>
                    Literacy, unemployment, digital access and tertiary
                    education exposure belong in a separate statistical study.
                  </p>
                  <ul>
                    <li>
                      Ingest Census, GHS and QLFS with their definitions and
                      survey weights.
                    </li>
                    <li>
                      Join municipal codes using validated boundary crosswalks.
                    </li>
                    <li>Separate contact enrolment from distance study.</li>
                    <li>
                      Report sample sizes, uncertainty and model specifications.
                    </li>
                  </ul>
                  <p className="research-warning">
                    Area-level correlations cannot tell us how an individual
                    voted. Internet access is not computer literacy. No
                    socioeconomic correlations are published in this version.
                  </p>
                  <a
                    href="/data/report.json"
                    download
                    className="download-link"
                  >
                    Download full analysis JSON ↗
                  </a>
                </article>
              </div>
            </div>
            <section className="chart-card mt-4">
              <h2>Allocation audit</h2>
              <div className="audit-grid">
                {report.validation.map((v) => (
                  <div key={v.year}>
                    <span>✓ {v.year}</span>
                    <b>
                      {v.matched}/{v.parties}
                    </b>
                    <small>party entitlements match</small>
                  </div>
                ))}
              </div>
              <h3 className="mt-4">Regional and compensatory seats</h3>
              <p>
                For 2004–2024, a separate calculation also reproduces every
                published regional allocation and all 200 compensatory seats.
                Regional seats use largest remainders without the national
                five-seat cap. This audit covers historical baselines; the
                simulator above still changes national entitlements only.
              </p>
              <div className="table-responsive">
                <table className="table data-table">
                  <thead>
                    <tr>
                      <th>Election</th>
                      <th>Regional entries matched</th>
                      <th>Compensatory party entries matched</th>
                      <th>One-ballot regional checks</th>
                      <th>Changes / ties</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.regionalValidation.map((a) => (
                      <tr key={a.year}>
                        <td>{a.year}</td>
                        <td>
                          {a.status === "passed"
                            ? number(a.regionalCellsMatched!)
                            : "Fixtures not yet ingested"}
                        </td>
                        <td>
                          {a.status === "passed"
                            ? number(a.compensatoryRowsMatched!)
                            : "—"}
                        </td>
                        <td>
                          {a.oneBallotChecks
                            ? number(a.oneBallotChecks.tested)
                            : "—"}
                        </td>
                        <td>
                          {a.oneBallotChecks
                            ? `${a.oneBallotChecks.changes.length} / ${a.oneBallotChecks.ties.length}`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>
                One-ballot checks cover additions, abstentions and every
                directed switch among candidates who contested each region.
                These test regional seat composition, not a probability of
                changing a future election.
              </p>
              <a
                href="/data/regional-seats.csv"
                download
                className="download-link"
              >
                Download verified regional seats ↓
              </a>
              <details className="mt-4">
                <summary>View bounded threshold searches</summary>
                <div className="table-responsive">
                  <table className="table data-table">
                    <thead>
                      <tr>
                        <th>Election</th>
                        <th>ANC action</th>
                        <th>Threshold metric</th>
                        <th>First change</th>
                        <th>Selected-party Δ</th>
                        <th>Checked through</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.thresholds.map((t) => (
                        <tr key={`${t.year}-${t.action}-${t.metric}`}>
                          <td>{t.year}</td>
                          <td>{t.action}</td>
                          <td>
                            {t.metric === "first_entitlement_vector_change"
                              ? "Any entitlement changes"
                              : "Selected party seat changes"}
                          </td>
                          <td>
                            {t.k !== null
                              ? number(t.k)
                              : t.status === "tie"
                                ? `Tie at ${number(t.tieAt!)}`
                                : "Not found within bound"}
                          </td>
                          <td>
                            {t.selectedPartyDelta === undefined
                              ? "—"
                              : t.selectedPartyDelta > 0
                                ? `+${t.selectedPartyDelta}`
                                : t.selectedPartyDelta}
                          </td>
                          <td>{number(t.searchedThrough)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </section>
            <section className="sources-section">
              <div className="section-title">
                <h2>Source registry</h2>
                <a
                  href="/data/elections.csv"
                  download
                  className="download-link"
                >
                  Cleaned national data ↓
                </a>
              </div>
              {report.sources.map((s) => (
                <details className="source-row" key={s.id}>
                  <summary>
                    <span>{s.id}</span>
                    <small>
                      {s.format.toUpperCase()} · {number(s.sizeBytes)} bytes
                    </small>
                  </summary>
                  <div className="source-detail">
                    <a href={s.url} target="_blank" rel="noreferrer">
                      Open original IEC source ↗
                    </a>
                    <p>
                      Retrieved {new Date(s.retrievedAt).toISOString()}{" "}
                      {s.note && <>· {s.note}</>}
                    </p>
                    <label>SHA-256</label>
                    <code>{s.sha256}</code>
                  </div>
                </details>
              ))}
            </section>
          </>
        )}
      </main>
      <footer>
        <span className="brand-word">ONE VOTE. MANY QUESTIONS.</span>
        <p>
          South African Electoral Impact Lab · Historical evidence, explicit
          assumptions.
        </p>
        <button
          className="text-button"
          onClick={() => setPage("Methodology & sources")}
        >
          Sources & limitations ↗
        </button>
      </footer>
    </div>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <div className="col-md-4">
      <div className="metric">
        <b>{value}</b>
        <span>{label}</span>
      </div>
    </div>
  );
}
function historyOption(r: Report): EChartsOption {
  const mean = r.history.mean,
    sd = r.history.sampleSD;
  return {
    tooltip: {
      trigger: "axis",
      valueFormatter: (v) => `${Number(v).toFixed(2)}%`,
    },
    grid: { left: 48, right: 30, top: 30, bottom: 35 },
    xAxis: {
      type: "category",
      data: r.elections.map((e) => String(e.year)),
      axisLine: { lineStyle: { color: "#babeb8" } },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      min: 35,
      max: 80,
      axisLabel: { formatter: "{value}%" },
      splitLine: { lineStyle: { color: "#e4e6de" } },
    },
    series: [
      {
        type: "line",
        data: r.elections.map((e) => e.anc.share),
        symbolSize: 10,
        lineStyle: { color: "#217467", width: 3 },
        itemStyle: { color: "#217467" },
        markArea: {
          silent: true,
          label: { show: false },
          data: [
            [
              { yAxis: mean - 3 * sd, itemStyle: { color: "#21746708" } },
              { yAxis: mean + 3 * sd },
            ],
            [
              { yAxis: mean - 2 * sd, itemStyle: { color: "#2174670b" } },
              { yAxis: mean + 2 * sd },
            ],
            [
              { yAxis: mean - sd, itemStyle: { color: "#21746710" } },
              { yAxis: mean + sd },
            ],
          ],
        },
        markLine: {
          symbol: "none",
          label: {
            position: "insideEndTop",
            formatter: "50% vote-share threshold",
          },
          lineStyle: { color: "#bd513d", type: "dashed" },
          data: [{ yAxis: 50 }],
        },
      },
    ],
  };
}
function provinceOption(e: Election, p: Party): EChartsOption {
  const rows = Object.entries(p.provinceVotes)
    .map(([name, n]) => ({
      name,
      share:
        (100 * n) / e.parties.reduce((v, p) => v + p.provinceVotes[name], 0),
    }))
    .sort((a, b) => a.share - b.share);
  return {
    grid: { left: 115, right: 40, top: 15, bottom: 30 },
    tooltip: {
      trigger: "axis",
      valueFormatter: (v) => `${Number(v).toFixed(2)}%`,
    },
    xAxis: {
      type: "value",
      max: 100,
      axisLabel: { formatter: "{value}%" },
      splitLine: { lineStyle: { color: "#e4e6de" } },
    },
    yAxis: {
      type: "category",
      data: rows.map((r) => r.name),
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        type: "bar",
        data: rows.map((r) => Number(r.share.toFixed(4))),
        barWidth: 17,
        itemStyle: { color: color(p), borderRadius: [0, 3, 3, 0] },
        label: {
          show: true,
          position: "right",
          formatter: (p) => `${Number(p.value).toFixed(1)}%`,
        },
      },
    ],
  };
}
export default function Loader() {
  const [explore, setExplore] = useState(false);
  const [report, setReport] = useState<Report | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    fetch("/data/report.json")
      .then((r) => {
        if (!r.ok) throw new Error("The analysis dataset could not be loaded.");
        return r.json();
      })
      .then(setReport)
      .catch((e) => setError(e.message));
  }, []);
  return report ? (
    explore ? (
      <>
        <button
          className="return-story"
          onClick={() => {
            setExplore(false);
            window.scrollTo(0, 0);
          }}
        >
          ← Back to the visual explanation
        </button>
        <App report={report} />
      </>
    ) : (
      <Story
        report={report}
        onExplore={() => {
          setExplore(true);
          window.scrollTo(0, 0);
        }}
      />
    )
  ) : (
    <main className="loading">
      <h1>SA Electoral Impact Lab</h1>
      <p role="status">{error || "Loading the verified election dataset…"}</p>
      {error && <button onClick={() => location.reload()}>Try again</button>}
    </main>
  );
}
