"""Strict adapters for archived IEC reports. All row locations are 1-based in exports."""
import io
import json
import re
from pathlib import Path
import xlrd
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data/raw/iec"
PROVINCES = ["Eastern Cape", "Free State", "Gauteng", "KwaZulu-Natal", "Limpopo", "Mpumalanga", "North West", "Northern Cape", "Western Cape"]


def key(value):
    return " ".join(str(value).upper().split())


def integer(value):
    if isinstance(value, str):
        value = value.replace(",", "").strip()
    number = float(value)
    if not number.is_integer() or number < 0:
        raise ValueError(f"Not a nonnegative count: {value}")
    return int(number)


def sheet(filename):
    # These official BIFF files have non-sector-aligned trailing bytes. xlrd can
    # read them; suppress only its diagnostic stream, not exceptions/validation.
    return xlrd.open_workbook(RAW / filename, logfile=io.StringIO()).sheet_by_index(0)


def detailed(year, ballot="national"):
    filename = f"{year}-{ballot}.xls" if year == 2024 else f"{year}-detailed.xls"
    s = sheet(filename)
    report_heading = ' '.join(str(v) for i in range(min(15,s.nrows)) for v in s.row_values(i))
    if str(year) not in report_heading or 'NATIONAL' not in report_heading.upper():
        raise ValueError(f"Wrong election in {filename}")
    if year == 2024 and f"{ballot.title()} Ballot" not in report_heading:
        raise ValueError(f"Wrong ballot in {filename}")
    header = next(i for i in range(s.nrows) if "Party Name" in s.row_values(i))
    names = s.row_values(header)
    name_col = names.index("Party Name")
    geography = s.row_values(header-1)
    total_col = geography.index("Total")
    cols = {p: geography.index(p) for p in PROVINCES}
    rows, totals = [], {}
    for i in range(header+1, s.nrows):
        cells = s.row_values(i)
        name = str(cells[name_col]).strip()
        if not name:
            continue
        if name.lower().startswith(("total", "spoilt", "registered")):
            try:
                totals[key(name)] = integer(cells[total_col])
            except ValueError:
                if "REGISTERED" not in key(name):
                    raise
            continue
        if not isinstance(cells[total_col], (int, float, str)):
            raise ValueError("Unexpected vote cell")
        # Abbreviation sometimes occupies the adjacent merged cell in Crystal exports.
        abbr_col = names.index("Abbr")
        abbr = next((str(cells[c]).strip() for c in range(abbr_col, min(cols.values())) if cells[c] != ""), "")
        rows.append({"party": key(name), "name": name, "abbreviation": abbr or name,
                     "votes": integer(cells[total_col]),
                     "provinceVotes": {p: integer(cells[c]) for p,c in cols.items()},
                     "sourceId": f"iec-{year}-{ballot}", "sourceRow": i+1})
    if len({r["party"] for r in rows}) != len(rows):
        raise ValueError("Duplicate party rows")
    if "TOTAL VALID VOTES" in totals and sum(r["votes"] for r in rows) != totals["TOTAL VALID VOTES"]:
        raise ValueError(f"{year}: party votes do not sum to published total")
    return rows, totals


def legacy_1994():
    text = PdfReader(RAW / "1994-results.pdf").pages[0].extract_text()
    rows = []
    province_order = ["Eastern Cape", "Mpumalanga", "KwaZulu-Natal", "Northern Cape", "Limpopo", "North West", "Free State", "Gauteng", "Western Cape"]
    for line in text.splitlines():
        cells = re.split(r"\s{2,}", line.strip())
        if len(cells) >= 11 and cells[0] != "TOTAL":
            try:
                counts = [integer(c.replace(" ", "")) for c in cells[1:11]]
            except ValueError:
                continue
            rows.append({"party": cells[0], "name": cells[0], "abbreviation": cells[0], "votes": counts[-1],
                         "provinceVotes": dict(zip(province_order, counts[:9])),
                         "officialSeats": integer(cells[11]) if len(cells)>11 else 0,
                         "sourceId": "iec-1994-results", "sourcePage": 1})
    if len(rows) != 19 or sum(r["votes"] for r in rows) != 19533498:
        raise ValueError("1994 PDF layout or totals changed")
    return rows, {"TOTAL VALID VOTES": 19533498}


def summary_2019():
    s = sheet("2019-seat-calculation.xls")
    if s.cell_value(2,21) != "Valid Votes National":
        raise ValueError("Unexpected 2019 schema")
    end = next(i for i in range(3,s.nrows) if s.cell_value(i,0) == "Total valid votes")
    rows = [{"party": key(s.cell_value(i,0)), "name": s.cell_value(i,0), "abbreviation": s.cell_value(i,0),
             "votes": integer(s.cell_value(i,21)), "officialSeats": integer(s.cell_value(i,22)),
             "provinceVotes": {p: integer(s.cell_value(i,1+2*j)) for j,p in enumerate(PROVINCES)},
             "officialRegionalSeats": {p: integer(s.cell_value(i,2+2*j)) for j,p in enumerate(PROVINCES)},
             "sourceId": "iec-2019-seats", "sourceRow": i+1} for i in range(3,end)]
    totals = {key(s.cell_value(i,0)): integer(s.cell_value(i,21)) for i in range(end,end+5)}
    if sum(r["votes"] for r in rows) != totals["TOTAL VALID VOTES"]:
        raise ValueError("2019 vote total mismatch")
    return rows, totals


def seat_table(year):
    if year == 1999:
        transcription = json.loads((ROOT / "data/transcriptions/1999-seats.json").read_text())
        return {key(p): n for p,n in transcription["seats"].items()}
    if year == 2024:
        result = {}
        for page in PdfReader(RAW / "2024-seat-calculation.pdf").pages:
            for line in page.extract_text(extraction_mode="layout").splitlines():
                match = re.match(r"^\s*(.+?)\s+((?:[\d*]+\s+){35}[\d*]+)\s*$", line)
                if match:
                    cells = match[2].split()
                    result[key(match[1])] = integer(cells[-3])
        result.pop("TOTAL", None)
        # This single party name wraps onto the following line in the PDF.
        if "SOUTH AFRICAN ROYAL KINGDOMS" in result:
            result["SOUTH AFRICAN ROYAL KINGDOMS ORGANIZATION"] = result.pop("SOUTH AFRICAN ROYAL KINGDOMS")
        if sum(result.values()) != 400:
            raise ValueError("2024 PDF seat extraction failed")
        return result
    s = sheet(f"{year}-seat-calculation.xls")
    name_col, total_col = (1,46) if year == 2014 else (2,47)
    if sum(integer(s.cell_value(i,total_col)) for i in range(17,s.nrows-1) if s.cell_value(i,name_col)) != 400:
        raise ValueError(f"{year}: expected 400 calculated seats")
    return {key(s.cell_value(i,name_col)): integer(s.cell_value(i,total_col)) for i in range(17,s.nrows-1) if s.cell_value(i,name_col)}


def elections():
    result = []
    for year in [1994,1999,2004,2009,2014,2019,2024]:
        if year == 1994:
            rows, totals = legacy_1994()
        elif year == 2019:
            rows, totals = summary_2019()
        else:
            rows, totals = detailed(year)
            seats = seat_table(year)
            for row in rows:
                row["officialSeats"] = seats[row["party"]]
        regional = None
        if year == 2024:
            regional, _ = detailed(year, "regional")
            regional_lookup = {r["party"]: r for r in regional}
            for row in rows:
                row["regionalVotes"] = regional_lookup.get(row["party"], {}).get("votes", 0)
        result.append({"year": year, "parties": rows, "totals": totals,
                       "seatSourceId": f"iec-{year}-" + ("results" if year == 1994 else "report" if year == 1999 else "seats"),
                       "regionalBallot": regional,
                       "allocationScope": "national_entitlement_no_overhang_no_list_exhaustion",
                       "voteTotal": sum(r["votes"] for r in rows)})
    return result
