# Execution status

## Delivered: national analytical report

- [x] IEC registry and downloader; original file format, SHA-256, URL and retrieval time.
- [x] All seven national election datasets and published seat entitlements.
- [x] Offline normalization and strict validation, including scanned 1999 seat transcription.
- [x] National entitlement engine reproducing all 211 party-election rows.
- [x] Independent browser engine and Python/browser parity tests.
- [x] Regional and compensatory baseline reproduction for 2004–2024: 1,638 regional cells; 50,960 eligible one-ballot regional checks.
- [x] One-vote addition/abstention/switching and collective counterfactual controls.
- [x] Exact vote-share majority thresholds.
- [x] Bounded ANC national entitlement-change searches with unresolved ties explicit.
- [x] Historical SD, swings, retrospective holdout, province comparisons.
- [x] React, Bootstrap, GSAP, ECharts; CSV/JSON download and provenance inspector.
- [x] Cloudflare Workers Static Assets build and deployment dry run.

## Outstanding: complete electoral-impact engine

- [ ] 1994/1999 regional fixtures; candidate availability, forfeitures, overhang redistribution, independent wins and adjudicated ties. Regional and compensatory baselines for 2004–2024 now pass independently.
- [ ] Region-specific perturbations; directed party-to-party minimum thresholds for every party.
- [ ] Full MEVP-seat, MEVP-majority and largest-party searches with proof of minimality.
- [ ] Explicit integer distribution rule for proportional opposition swings; candidate-list fixtures for every supported election.

Acceptance: reproduce regional, compensatory and total seats separately; validate edge cases against published rules and independent examples; never infer broad correctness from matching national aggregates alone.

## Outstanding: subnational and socioeconomic research

- [ ] Download municipality/VD results and Stats SA Census, GHS and QLFS datasets.
- [ ] Build variable dictionary with years, definitions, population denominators, weights, missingness, uncertainty and licence/access details.
- [ ] Acquire MDB boundaries; choose a target vintage and validate spatial crosswalks, retaining weights and excluded geographies.
- [ ] Acquire DHET campus and contact-mode enrolment data; document uncertain geocoding.
- [ ] Freeze analysis specifications before running correlations; report Pearson/Spearman, N, confidence intervals, missingness and multiplicity policy.
- [ ] Multivariate models with election/province effects; design-aware uncertainty and spatial dependence sensitivity checks.
- [ ] MapLibre geographic views and independently labelled socioeconomic explorer, backed exclusively by verified outputs.

These phases are deliberately visible as not ingested. No fictitious data, sample scatterplots, p-values or regression coefficients are included in the delivered report.

## Outstanding: publication

- [ ] Authenticate the intended Cloudflare account and publish the reviewed build.
- [ ] Add R2 when large raw/spatial files need public distribution; retain original hashes and publisher rights.
- [ ] Configure deployment CI and periodic source-version review as a separately authorized operational task.

The local build requires no Cloudflare account. D1 and a Worker API are optional and currently unnecessary.
