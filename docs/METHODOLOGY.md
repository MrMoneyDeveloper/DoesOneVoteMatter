# Methods and limits

## Research question

What mathematical effect does a changed ballot have on historical national vote shares and seat entitlements, and how does a specified collective change compare with observed electoral variation?

The deterministic calculation and a future socioeconomic study are separate. No causal or individual-level behavioural inference is made here.

## Reproduction contract

The program calculates from vote counts; published seats are used only as expected test outputs. All seven national seat-entitlement vectors match, including zero-seat parties. This proves reproduction of these observations, not correctness for all legally possible elections.

National entitlement quota: `floor(valid party allocation votes / 401) + 1` when no independent seats are reserved. First assign `floor(party votes / quota)`. Award up to five remaining seats by largest integer remainders, then award remaining seats to the largest `party votes / seats already awarded`, updating after each award. Exact integer/rational comparisons are used. An exact tie affecting the allocation raises an unresolved-tie result instead of an invented alphabetical or random rule.

Sources: IEC `seat-rules.pdf`, IEC `2024-rules.pdf`, and the [Electoral Act Schedule 1A](https://www.elections.org.za/content/Documents/Laws-and-regulations/Elections/Electoral-Act-73-of-1998-as-Amended/). For historical legal context see the [1993 Constitution, Schedule 2](https://www.gov.za/documents/constitution/constitution-republic-south-africa-act-200-1993-repealed-28-jan-1994). This is an analytical model, not legal advice.

The engine does not implement list exhaustion, regional overhang redistribution, tie adjudication, or an independent candidate winning a regional seat. Pre-2024 simulations perturb the national aggregate without specifying a region; 2024 changes only the national ballot with the observed regional vote fixed. Seat-map outputs are explicitly labelled **national entitlements under these exclusions**. Largest-party thresholds, full regional-seat perturbations and unrestricted MEVP-seat/MEVP-majority searches remain future work.

## Source versions and special cases

### Regional and compensatory baseline audit

`pipeline/regional.py` separately reproduces the nine regional allocations for 2004, 2009, 2014, 2019 and 2024. Regional capacities are read from the published seat-report total rows, not inferred from calculated output. Regional quota is `floor(regional valid votes / (regional seats + 1)) + 1`; all remaining seats use largest remainders, without the national five-seat cap. Compensatory seats equal the overall entitlement minus the sum of regional seats. Both IEC guide worked examples have independent regression tests.

All 1,638 published regional party/candidate cells and 176 party compensatory rows match. For 2024, regional votes include independents in the regional denominator. The original seat-report `*` markers identify non-contestants; wrapped names are explicitly joined. No independent wins a seat in the observed fixture. The audit rejects winning-independent and regional-overhang scenarios rather than silently applying an incomplete rule. Candidate-list exhaustion is not modelled.

50,960 one-ballot regional scenarios were checked: additions, available-vote removals and directed switches among eligible contestants within each region. None changed regional seat composition or created a cutoff tie. These checks concern the regional component alone and make no claim about a future pivotality probability. The browser's counterfactual simulator remains a national-entitlement model. 1994/1999 regional fixtures are still missing.

- 1994: parse national table on page 1 of the IEC historical PDF. All 19 parties, vote total 19,533,498 and seats were visually checked. Blank seat cells mean zero. Province name changes are display mappings, not boundary crosswalks.
- 1999: votes from detailed IEC XLS. Official seats transcribed from the scanned 1999 IEC report, PDF page 74 / printed page 78; all 16 rows visually checked. The registry stores the original PDF bytes, while transcription is versioned code/data.
- 2004/2009/2014: separate detailed vote and seat-calculation XLS files. Compare the **S (calculated)** overall seat column, not A (assigned). The 2004 workbook has 400 calculated and 399 assigned seats; this distinction is preserved. The reproduced ACDP/AZAPO national entitlements are 7/1. See the [2004 Electoral Court correction](https://www3.saflii.org/za/cases/ZAEC/2004/2.html).
- 2019: the vote-and-seat summary XLS supplies national votes, seats, provincial counts, quota and turnout.
- 2024: national and regional party ballots are combined for national entitlements. Independent regional votes do not enter the party denominator. The observed election has no independent seats; counterfactual independent wins are not modelled. The national XLS reports 16,077,342 valid votes and 6,459,284 ANC votes (results timestamp 21 June 2024). Do not substitute earlier live-result snapshots. The seat PDF reports 6 June 2024. Its full 400-seat totals match these votes. The XLS labelled as the national seat report exposed only regional totals, so it is not used as the overall fixture.

Raw files are byte-pinned in `data-manifest.json`. Normal builds reject changed bytes. Original names and counts are retained. Uppercasing and whitespace normalization align identical names within an election; old parties are not merged into new parties. Source ID plus page/row is retained on records. Publisher totals are checked independently of calculated sums where present.

## One ballot and collective changes

Unless a voter-level scenario is explicitly labelled, “one vote” in the interface means one counted ballot. This distinction matters in 2024 because one voter could cast multiple ballots. The current national counterfactual engine perturbs one counted national ballot while holding the observed regional ballot fixed.

For party votes A and total V:

- Add k party ballots: `(A+k)/(V+k)`.
- k party voters abstain: `(A-k)/(V-k)`.
- Switch k from A to B: `(A-k)/V`, `(B+k)/V`.

Party marginal effect is the counterfactual share minus `A/V`, multiplied by 100 to express **percentage points**. The ballot-weight quantity `100/V` is not the same as an added party vote's marginal share effect. For scale only, the report also calculates a smooth proportional seat-equivalent of `400/V` seats per ballot and `V/400` average ballots per seat. These are continuous reference quantities, not claims that fractional seats are actually allocated.

Strictly below 50% requires `2A' < V'`. For A initially at or above half:

- Switching: `floor((2A-V)/2)+1`.
- New opposition ballots: `2A-V+1`.
- ANC abstention: `2A-V+1`, subject to enough votes and a positive remaining total.

2019 values: 1,307,786 switches; 2,615,572 additional opposition ballots; 2,615,572 ANC abstentions. These are vote-share thresholds, not seat-majority thresholds.

Minimum threshold searches exhaustively test k from 1 through 50,000 for ANC addition and abstention in 1994–2019. Two metrics are published separately: `first_entitlement_vector_change`, the first point where any party entitlement changes, and `first_selected_party_seat_change`, the first point where the selected party's own entitlement changes. The engine also supports directional selected-party, majority-status and unique-largest-party criteria for future threshold mapping. Search stops at the first qualifying change or at the first unresolved allocation tie. `not_found_within_bound` and `tie` have null k, never zero. No binary search is used: monotonicity is not assumed for the allocation method.

A regression test locks the counterintuitive 1994 ANC addition boundary: +17,256 ANC ballots preserves the reproduced entitlement vector, while +17,257 changes it from ANC 252 / AMP 0 to ANC 251 / AMP 1 under the validated entitlement algorithm. Because this looks paradoxical, the result is treated as an explicit algorithmic boundary case rather than silently generalized into a claim that more votes normally reduce a party's seats.

## Historical variation

ANC shares are recomputed from raw national counts. Training-period label refers to 1994–2019 (six elections). Mean, sample SD (`n-1`), sigma distance to 50%, first differences and annualised percentage-point differences are descriptive. The 2024 observation is excluded from those summary estimates.

The split is **retrospective**, selected after the 2024 result was public; it is not a prospective forecast or preregistered experiment. Six dependent, trending observations do not establish a normal distribution or a pivotality probability. No normal-tail probabilities, national significance tests or causality claims are shown.

Historical test: do one-ballot perturbations cross a national entitlement boundary in the realised election results? A verified seat change is a counterexample. No single-ballot change in the included calculations establishes only a deterministic statement about those tested states. It is not a future pivotality probability and cannot establish the philosophical or normative value of participation.

## Geography and future statistical analysis

Province comparison uses national ballots cast in a province, not votes for its provincial legislature. Overseas votes are separate where provided. No municipal name joins, spatial interpolation or time-series boundary equivalence are assumed.

Future correlations require validated units, years, boundary versions and matched denominators. Census/GHS literacy measures must not be silently replaced by education; digital access must not be called digital literacy. QLFS requires survey weights and design-aware uncertainty. Campus exposure must use contact enrolment, not distance enrolment. Area-level correlations do not identify individual voting behaviour (ecological fallacy). Fixed effects and adjustment for observed variables do not establish causation.
