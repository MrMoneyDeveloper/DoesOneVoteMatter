"""Offline build: validate sources -> normalize -> reproduce seats -> export."""
import csv
import hashlib
import json
import statistics
from pathlib import Path
from .allocation import allocate, perturb, AllocationTie, below_half_threshold, first_change
from .download import ROOT, digest, signature
from .parsers import elections
from .regional import audit as regional_audit

EXPECTED_COUNTS = {1994:19,1999:16,2004:21,2009:26,2014:29,2019:48,2024:52}
EXPECTED_TOTALS = {1994:19533498,1999:15977142,2004:15612671,2009:17680729,2014:18402497,2019:17437379,2024:16077342}


def validate_sources():
    manifest = json.loads((ROOT / "data/data-manifest.json").read_text())
    required = json.loads((ROOT / "data/sources.json").read_text())["files"]
    indexed = {f["id"]: f for f in manifest["files"]}
    for source in required:
        if source["id"] not in indexed:
            raise ValueError("Missing provenance: " + source["id"])
        entry = indexed[source["id"]]
        path = ROOT / entry["path"]
        if digest(path) != entry["sha256"] or not signature(path.read_bytes(), entry["format"]):
            raise ValueError("Integrity check failed: " + entry["id"])
    return manifest


def allocation_votes(election):
    return {p["party"]: p["votes"] + p.get("regionalVotes",0) for p in election["parties"]}


def seat_deltas(baseline, changed):
    """Compact, explicit explanation of which entitlements moved."""
    return [
        {
            "party": party,
            "before": baseline[party],
            "after": changed[party],
            "delta": changed[party] - baseline[party],
        }
        for party in baseline
        if baseline[party] != changed[party]
    ]


def build():
    manifest = validate_sources()
    data = elections()
    regional_validation = [regional_audit(e) for e in data]
    validation = []
    pivotality = []
    switch_checks = []
    for e in data:
        y = e["year"]
        if len(e["parties"]) != EXPECTED_COUNTS[y] or e["voteTotal"] != EXPECTED_TOTALS[y]:
            raise ValueError(f"Unexpected {y} row count / national vote total")
        votes = allocation_votes(e)
        baseline = allocate(votes)
        expected = {p["party"]:p["officialSeats"] for p in e["parties"]}
        if baseline != expected or sum(expected.values()) != 400:
            raise ValueError(f"Official seat reproduction failed in {y}")
        validation.append({"year":y,"parties":len(votes),"matched":len(votes),"seats":400,"status":"passed","scope":e["allocationScope"]})
        national = {p["party"]:p["votes"] for p in e["parties"]}
        switch_check = {"year": y, "tested": 0, "changes": [], "ties": []}
        for origin in national:
            for destination in national:
                if origin == destination:
                    continue
                switch_check["tested"] += 1
                try:
                    switched = allocate(perturb(votes,origin,1,"switch",destination))
                    if switched != baseline:
                        switch_check["changes"].append([origin,destination])
                except AllocationTie:
                    switch_check["ties"].append([origin,destination])
        switch_checks.append(switch_check)
        for p in e["parties"]:
            party = p["party"]
            p["share"] = p["votes"]/e["voteTotal"]*100
            for action in ["add", "abstain"]:
                altered = perturb(national, party, 1, action)
                av = {name:n+next(r.get("regionalVotes",0) for r in e["parties"] if r["party"]==name) for name,n in altered.items()}
                try:
                    simulated = allocate(av)
                    changed = simulated != baseline
                except AllocationTie:
                    changed = None
                pivotality.append({"year":y,"party":party,"action":action,"k":1,"shareChangePP":(altered[party]/sum(altered.values())-national[party]/sum(national.values()))*100,"entitlementChanged":changed,"ballot":"national"})
        shares = [p["votes"]/e["voteTotal"] for p in e["parties"]]
        e["metrics"] = {
            "effectiveParties":1/sum(s*s for s in shares),
            "concentration":sum(s*s for s in shares),
            "oneBallotWeightPP":100/e["voteTotal"],
            "smoothSeatEquivalent":400/e["voteTotal"],
            "averageBallotsPerSeat":e["voteTotal"]/400,
        }
        anc = next(p for p in e["parties"] if p["party"] in ("ANC","AFRICAN NATIONAL CONGRESS"))
        e["anc"] = {"share":anc["share"],"votes":anc["votes"],"seats":anc["officialSeats"],"belowHalf":{m:below_half_threshold(national,anc["party"],m) for m in ["switch","opposition_add","abstain"]}}
    training = [e["anc"]["share"] for e in data if e["year"]<=2019]
    mean, sd = statistics.mean(training), statistics.stdev(training)
    swings = [{"from":a["year"],"to":b["year"],"changePP":b["anc"]["share"]-a["anc"]["share"],"annualisedPP":(b["anc"]["share"]-a["anc"]["share"])/(b["year"]-a["year"])} for a,b in zip(data,data[1:])]
    history = {"trainingYears":[1994,1999,2004,2009,2014,2019],"n":6,"mean":mean,"sampleSD":sd,"thresholdDistanceSD":(mean-50)/sd,"holdoutYear":2024,"holdoutShare":data[-1]["anc"]["share"],"holdoutDistanceSD":(data[-1]["anc"]["share"]-mean)/sd,"swings":swings,"interpretation":"Descriptive historical distance; not a probability, significance test or election forecast. 2024 was already known when this retrospective split was specified."}
    # Bound expensive retrospective searches. These are entitlement boundaries,
    # not proof of candidate assignment, local outcomes, or future pivotality.
    thresholds = []
    for e in data:
        if e["year"] == 2024:
            continue
        votes = allocation_votes(e)
        baseline = allocate(votes)
        anc = next(p for p in votes if p in ("ANC","AFRICAN NATIONAL CONGRESS"))
        for action in ["add","abstain"]:
            for criterion, metric in [
                ("vector", "first_entitlement_vector_change"),
                ("party_change", "first_selected_party_seat_change"),
            ]:
                found = first_change(
                    votes,
                    anc,
                    mechanism=action,
                    limit=50000,
                    criterion=criterion,
                )
                record = {
                    "year":e["year"],
                    "party":anc,
                    "action":action,
                    "metric":metric,
                    "scope":(
                        "first change anywhere in the national entitlement vector"
                        if criterion == "vector"
                        else "first change in the selected party national entitlement"
                    ),
                    **found,
                }
                if found.get("seats") is not None:
                    record["changes"] = seat_deltas(baseline, found["seats"])
                    record["selectedPartyDelta"] = found["seats"][anc] - baseline[anc]
                thresholds.append(record)
    bundle = {
        "schemaVersion":2,
        "analysisUnit":"counted ballot",
        "terminology":{
            "oneVoteMeaning":"Unless explicitly labelled voter-level, one vote in this report means one counted ballot.",
            "voterBallotDistinction":"A voter and a ballot are not always interchangeable. In 2024 a voter could cast multiple ballots, while the current national counterfactual engine perturbs one counted national ballot at a time.",
        },
        "elections":data,
        "history":history,
        "validation":validation,
        "regionalValidation":regional_validation,
        "pivotality":pivotality,
        "switchChecks":switch_checks,
        "thresholds":thresholds,
        "sources":manifest["files"],
        "limitations":[
            "Browser simulations use national entitlements; candidate-list exhaustion, regional overhang, and independent-winning counterfactuals are not implemented.",
            "Regional and compensatory baselines are independently reproduced for 2004-2024; 1994/1999 regional fixtures remain outstanding.",
            "2024 simulations change only one national ballot and hold regional votes fixed; this is not yet a complete voter-level 2024 simulation.",
            "Minimum-threshold outputs distinguish the first change anywhere in the entitlement vector from the first seat change of the selected party.",
            "Socioeconomic data and boundary crosswalks are not yet ingested; no correlations or causal claims are published.",
        ],
    }
    output = ROOT / "data/processed"
    output.mkdir(parents=True,exist_ok=True)
    public = ROOT / "public/data"
    public.mkdir(parents=True,exist_ok=True)
    encoded = json.dumps(bundle,indent=2,ensure_ascii=False)+"\n"
    (output / "report.json").write_text(encoded,encoding="utf-8")
    (public / "report.json").write_text(encoded,encoding="utf-8")
    with (public / "elections.csv").open("w",newline="",encoding="utf-8") as f:
        writer = csv.DictWriter(f,fieldnames=["year","party","votes","share","officialSeats","sourceId"])
        writer.writeheader()
        for e in data:
            for p in e["parties"]:
                writer.writerow({"year":e["year"],**{k:p[k] for k in writer.fieldnames if k!="year"}})
    (output / "validation.json").write_text(json.dumps(validation,indent=2)+"\n")
    (output / "regional-validation.json").write_text(json.dumps(regional_validation,indent=2)+"\n")
    with (public / "regional-seats.csv").open("w",newline="",encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["year","province","party_or_candidate","calculated_seats","sourceId"])
        for audit in regional_validation:
            if audit["status"] == "passed":
                for province, seats in audit["calculated"]["regional"].items():
                    for name, count in seats.items():
                        writer.writerow([audit["year"],province,name,count,audit["sourceId"]])
    print(f"Verified {len(data)} elections, {sum(len(e['parties']) for e in data)} party-election records, all 2,800 national seat entitlements.")
    print(f"Verified {sum(a.get('regionalCellsMatched',0) for a in regional_validation)} regional seat cells and 200 compensatory seats in each of five elections (2004-2024).")
    print(f"Export SHA-256: {hashlib.sha256(encoded.encode()).hexdigest()}")


if __name__ == "__main__":
    build()
