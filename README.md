# SA Electoral Impact Lab

A React + TypeScript report exploring the arithmetic of one vote in South African national elections. Uses Bootstrap 5, GSAP and ECharts. Deployable as Cloudflare Workers Static Assets.

## Run locally

Requires Node 22.12+ (validated with Node 24), Python 3.11+ (validated with Python 3.13), and curl.

```sh
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
python -m pip install -r requirements.txt
npm ci
npm run verify
npm run dev
```

Open the local URL printed by Vite. Official raw files and processed exports are included, so normal verification works offline. Google Fonts are optional; system fonts are the fallback.

## What works

The default view is a seven-scene explanation with **Back / Next** controls. It starts with individual influence, years of waiting and personal value; explains the Assembly; connects 2019 regional counts to the countrywide total; traces source provenance; tests one-ballot influence; and compares historical time windows before giving three separate verdicts. Future endpoints remain unobserved. Annualised changes are not forecasts. Technical assumptions are expandable and the original analytical tools remain under **Full data**, with a return link.

D3 draws regional ballot-area tiles and the historical seat timeline; GSAP animates scene and scale transitions with reduced-motion support. Materialize styles the guide's controls, cards and progress indicator. PostCSS scopes Materialize to `.journey` and Autoprefixer processes the CSS, preserving the Bootstrap data explorer. Handlebars generates `/guide-summary.html` from the same verified report and historical evidence, both in development and in the production build. No browser-side template evaluation is required.

- Official IEC source retrieval with MIME type, format signature, byte count, URL, UTC retrieval time and SHA-256 provenance.
- Seven elections, 1994–2024; 211 national party-election records.
- Independent calculation matching **every published national seat entitlement**, 2,800 seats across seven elections.
- Python and TypeScript implementations tested against the same official fixtures and against each other for 422 additions/abstentions and 7,372 directed one-ballot switches.
- Separate regional calculation matches 1,638 party/candidate-region cells and all compensatory seats for 2004–2024. Another 50,960 eligible one-ballot regional scenarios produce no regional seat changes or ties in these historical fixtures.
- One-ballot addition, abstention and directed switching; counterfactual slider; parliamentary majority status under the entitlement model. “One vote” means one counted ballot unless a voter-level scenario is explicitly labelled.
- Exact vote-share thresholds, retrospective 1994–2019 mean/sample SD, 2024 holdout illustration, election swings, annualised swings, and province comparisons.
- Bounded, exhaustive ANC threshold searches (add/abstain, pre-2024, up to 50,000 ballots) now distinguish the first change anywhere in the entitlement vector from the first seat change of the selected party; ties are reported explicitly.
- CSV and JSON downloads; source inspector; responsive layout and reduced-motion support.

## Scope and outstanding work

This is the **national-analysis milestone**, not completion of every research phase in the attached roadmap. The engine reproduces historical national entitlements, but does not yet implement candidate-list exhaustion, regional overhang redistribution or independent-winning counterfactuals. It must not be represented as a complete implementation of every legal electoral contingency. 2024 simulations change the national ballot only, keeping regional votes fixed.

Municipal/VD ingestion, boundary harmonisation, socioeconomic correlations/regressions, university exposure and R2 archiving remain outstanding. The interface explicitly states these limitations and publishes no fabricated socioeconomic estimates. See [ROADMAP.md](docs/ROADMAP.md) and [METHODOLOGY.md](docs/METHODOLOGY.md).

## Reproduce the data

```sh
npm run data:download     # fetch missing registered sources; check cached hashes
npm run data:build        # parse, validate, analyse and export; no network
npm test                 # Python + TypeScript regression tests
npm run build            # typecheck + production Vite bundle
```

`python -m pipeline.download --refresh` explicitly retrieves new source versions. Changed bytes preserve the preceding version in `data/raw/archive/` and the manifest's version history. Sources are not considered valid merely because HTTP returned 200: HTML error pages are rejected by signature checks. Updating published totals requires an explicit fixture review; it cannot silently change an analysis build.

- `data/sources.json`: authoritative source registry, plus non-ingested research sources.
- `data/data-manifest.json`: downloaded byte provenance and retrieval attempts.
- `data/transcriptions/1999-seats.json`: manually checked scan transcription with page locator.
- `data/processed/validation.json`: per-election entitlement reproduction results.
- `data/processed/regional-validation.json`: regional and compensatory baseline audit, capacities and one-ballot checks.
- `public/data/regional-seats.csv`: verified regional seat allocations for 2004–2024.
- `public/data/report.json`: analysis consumed by the application.
- `public/data/elections.csv`: national party counts and entitlement totals.
- `pipeline/`: reproducible Python source pipeline and arithmetic.
- `src/analytics/`: browser arithmetic and parity tests.

The first data build can take tens of seconds because minimum-threshold searches are exhaustive and do not assume that a remainder method is monotonic.


## Continuous verification

GitHub Actions runs the full offline verification suite on pushes and pull requests. The workflow rebuilds the report from the pinned source files, runs Python and TypeScript tests, type-checks the app and performs the production Vite build. This protects the published allocation claims from silently drifting when the engine changes.

## Cloudflare

```sh
npm run deploy:check      # validated locally: static-assets deployment dry run
npx wrangler login       # sign in to your intended Cloudflare account
npm run deploy           # regenerate data, test, build, deploy
```

The app uses Workers Static Assets with SPA routing, following [Cloudflare's SPA configuration](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/). A GitHub Actions deployment workflow will deploy pushes to `main` when repository secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are available; otherwise it verifies the build and explicitly skips the deployment step. No Worker API, D1 or R2 is necessary for the current small exports. Raw data stays in the repository and is excluded from public assets. Add R2 only when bulky municipal or boundary data is ingested.

## Data interpretation

One ballot's weight (`100 / total valid votes`) differs from the change in a party's share when both numerator and denominator change. The report also exposes the smooth proportional seat-equivalent (`400 / total valid votes`) and average ballots per seat (`total valid votes / 400`) while keeping those continuous averages separate from the real discrete allocation. A historical outcome that is unchanged after one ballot is removed is not a probability estimate and does not establish whether someone should vote. Vote-share majority, largest-party status and parliamentary majority are separate questions.

Source data retains its publishers' rights. The project claims no IEC affiliation or endorsement.

