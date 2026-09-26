"""Regional and compensatory baseline audit using published seat reports.

Scope is deliberately separate from the national-only browser simulator.
Fail closed for winning independents or regional overhangs until those rules
and candidate-list fixtures have been independently verified.
"""
import re
from pypdf import PdfReader
from .parsers import RAW, PROVINCES, integer, key, sheet
from .allocation import allocate, allocate_region, perturb, AllocationTie, UnsupportedAllocation


def published_breakdown(year):
    rows = {}
    if year in (2004, 2009, 2014):
        s = sheet(f"{year}-seat-calculation.xls")
        headings = s.row_values(15)
        cols = {p: headings.index(p) for p in PROVINCES}
        name_col = 1 if year == 2014 else 2
        pr_col, total_col = (43, 46) if year == 2014 else (44, 47)
        for i in range(17, s.nrows):
            name = key(s.cell_value(i, name_col))
            if not name:
                continue
            rows[name] = {"regional": {p: integer(s.cell_value(i,c)) for p,c in cols.items()},
                          "compensatory": integer(s.cell_value(i,pr_col)),
                          "total": integer(s.cell_value(i,total_col)), "sourceRow": i+1}
    elif year == 2019:
        s = sheet("2019-seat-calculation.xls")
        end = next(i for i in range(3,s.nrows) if s.cell_value(i,0) == "Total valid votes")
        for i in range(3,end+1):
            name = "TOTAL" if i == end else key(s.cell_value(i,0))
            rows[name] = {"regional": {p:integer(s.cell_value(i,2+2*j)) for j,p in enumerate(PROVINCES)},
                          "compensatory":integer(s.cell_value(i,23)),
                          "total":integer(s.cell_value(i,22)), "sourceRow":i+1}
    elif year == 2024:
        aliases = {"SOUTH AFRICAN ROYAL KINGDOMS":"SOUTH AFRICAN ROYAL KINGDOMS ORGANIZATION",
                   "RAMOBA LEHLOHONOLO BLESSINGS ANSWER -":"RAMOBA LEHLOHONOLO BLESSINGS ANSWER - 501784"}
        for page_index, page in enumerate(PdfReader(RAW / "2024-seat-calculation.pdf").pages):
            for line in page.extract_text(extraction_mode="layout").splitlines():
                match = re.match(r"^\s*(.+?)\s+((?:[\d*]+\s+){35}[\d*]+)\s*$",line)
                if not match:
                    continue
                name = key(match[1])
                name = aliases.get(name,name)
                cells = match[2].split()
                count = lambda i: 0 if cells[i] == "*" else integer(cells[i])
                if name in rows:
                    raise ValueError("Duplicate seat-report row: " + name)
                rows[name] = {"regional":{p:count(3*j) for j,p in enumerate(PROVINCES)},
                              "contested":{p:cells[3*j] != "*" for j,p in enumerate(PROVINCES)},
                              "compensatory":count(30), "total":count(33), "sourcePage":page_index+1}
    else:
        return None
    totals = rows.pop("TOTAL")
    if sum(totals["regional"].values()) != 200 or totals["compensatory"] != 200 or totals["total"] != 400:
        raise ValueError(f"Unexpected published seat capacities in {year}")
    for province in PROVINCES:
        if sum(r["regional"][province] for r in rows.values()) != totals["regional"][province]:
            raise ValueError(f"Seat-column sum mismatch in {year}, {province}")
    return {"capacities":totals["regional"], "rows":rows, "sourceId":f"iec-{year}-seats"}


def calculate_breakdown(election, capacities):
    national = {p["party"]:p["votes"] for p in election["parties"]}
    regional_rows = election["regionalBallot"] if election["year"] == 2024 else election["parties"]
    regional = {province:allocate_region({p["party"]:p["provinceVotes"][province] for p in regional_rows},capacity)
                for province,capacity in capacities.items()}
    independent_seats = {p:sum(region.get(p,0) for region in regional.values())
                         for p in {r["party"] for r in regional_rows} - national.keys()}
    if any(independent_seats.values()):
        raise UnsupportedAllocation("Winning independent requires cap, forfeiture and multi-region rules")
    overall = allocate({p["party"]:p["votes"]+p.get("regionalVotes",0) for p in election["parties"]})
    compensatory = {p:overall[p]-sum(region.get(p,0) for region in regional.values()) for p in national}
    if any(n < 0 for n in compensatory.values()):
        raise UnsupportedAllocation("Regional overhang requires a recalculated national allocation")
    if sum(compensatory.values()) != 200:
        raise ValueError("Compensatory seats must sum to 200")
    return {"regional":regional,"compensatory":compensatory,"overall":overall}


def audit(election):
    published = published_breakdown(election["year"])
    if published is None:
        return {"year":election["year"],"status":"not_ingested",
                "reason":"Regional seat fixtures for this election are not yet archived."}
    calculated = calculate_breakdown(election,published["capacities"])
    parties = {p["party"] for p in election["parties"]}
    candidates = {p["party"] for p in (election["regionalBallot"] or election["parties"])}
    if candidates != published["rows"].keys():
        raise ValueError("Seat and vote candidate sets differ")
    regional_cells = 0
    for name, expected in published["rows"].items():
        for province, seats in expected["regional"].items():
            if calculated["regional"][province][name] != seats:
                raise ValueError(f"{election['year']} regional mismatch: {province}, {name}")
            regional_cells += 1
        if calculated["compensatory"].get(name,0) != expected["compensatory"] or calculated["overall"].get(name,0) != expected["total"]:
            raise ValueError(f"{election['year']} compensatory/overall mismatch: {name}")
    return {"year":election["year"],"status":"passed","regionalCellsMatched":regional_cells,
            "compensatoryRowsMatched":len(parties), "regionalSeatTotal":200,"compensatorySeatTotal":200,
            "capacities":published["capacities"],"sourceId":published["sourceId"],
            "scope":"Observed baseline; no candidate-list exhaustion, regional overhang or independent wins",
            "calculated":calculated,"oneBallotChecks":one_ballot_checks(election,published)}


def one_ballot_checks(election, published):
    """Regional seat composition only; not an overall-assembly probability.

    Test additions, removals and every directed switch among contestants in
    each region. The seat report's '*' marker excludes non-contestants.
    """
    rows = election["regionalBallot"] or election["parties"]
    result = {"tested":0,"byMechanism":{"add":0,"abstain":0,"switch":0},"changes":[],"ties":[],
              "scope":"Regional seat composition, one ballot, observed candidate eligibility"}
    for province, seats in published["capacities"].items():
        votes = {r["party"]:r["provinceVotes"][province] for r in rows
                 if published["rows"][r["party"]].get("contested",{}).get(province,True)}
        baseline = allocate_region(votes,seats)
        for party in votes:
            for mechanism in ("add","abstain","switch"):
                if mechanism != "add" and votes[party] == 0:
                    continue
                for destination in (votes if mechanism == "switch" else [None]):
                    if destination == party:
                        continue
                    result["tested"] += 1
                    result["byMechanism"][mechanism] += 1
                    scenario = {"province":province,"party":party,"mechanism":mechanism,"destination":destination}
                    try:
                        altered = allocate_region(perturb(votes,party,1,mechanism,destination),seats)
                    except AllocationTie:
                        result["ties"].append(scenario)
                        continue
                    if altered != baseline:
                        result["changes"].append({**scenario,"seats":altered})
    return result
