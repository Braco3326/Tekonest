"""Validate knowledge-base equipment files against schema/device.schema.json + taxonomy.json.

Stdlib only. Usage (from repo root):
    python knowledge-base/tools/validate.py                 # all equipment/*.json
    python knowledge-base/tools/validate.py --file microphones-condenser.json
    python knowledge-base/tools/validate.py --json          # machine-readable summary
Exit code 1 if any ERROR.
"""
import argparse
import json
import re
import sys
from pathlib import Path

KB = Path(__file__).resolve().parent.parent
EQUIP = KB / "equipment"

REQUIRED_DEVICE = ["id", "brand", "model", "category", "sub_type", "technology", "year_introduced",
                   "status", "why_it_is_a_classic", "typical_uses", "key_specs", "connectors",
                   "signal_types", "manual_url", "datasheet_url", "product_page_url",
                   "manual_languages", "manuals", "sources", "notes", "conflicts", "tekpractice"]
REQUIRED_SOURCE = ["url", "publisher", "accessed", "confidence", "covers"]
CONFIDENCE = {"verified-primary", "verified-secondary", "unverified"}
STATUS = {"current", "discontinued", "not found"}
ID_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
URL_RE = re.compile(r"^https?://")


def load_taxonomy():
    tax = json.loads((KB / "taxonomy.json").read_text(encoding="utf-8"))
    cats = {c["id"]: {s["id"] for s in c["sub_types"]} for c in tax["categories"]}
    files = {f: c["id"] for c in tax["categories"] for f in c.get("equipment_files", [])}
    conns = set(tax["tekpractice_connector_ids_existing"]) | {k for k in tax["proposed_connector_ids"] if not k.startswith("_")}
    sigs = set(tax["tekpractice_signal_ids_existing"]) | {k for k in tax["proposed_signal_ids"] if not k.startswith("_")}
    return cats, files, conns, sigs


def is_url_or_nf(v):
    return isinstance(v, str) and (v == "not found" or URL_RE.match(v) is not None)


def validate_file(path, cats, files, conns, sigs, seen_ids):
    errs, warns = [], []
    rel = path.name
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception as e:  # noqa: BLE001
        return [f"{rel}: invalid JSON: {e}"], [], []
    for k in ["file", "category", "generated", "devices"]:
        if k not in data:
            errs.append(f"{rel}: missing top-level '{k}'")
    if rel not in files:
        errs.append(f"{rel}: not listed in taxonomy.json equipment_files")
    elif data.get("category") != files[rel]:
        errs.append(f"{rel}: category '{data.get('category')}' != taxonomy '{files[rel]}'")
    devices = data.get("devices", [])
    for i, d in enumerate(devices):
        did = d.get("id", f"#{i}")
        p = f"{rel}:{did}"
        for k in REQUIRED_DEVICE:
            if k not in d:
                errs.append(f"{p}: missing '{k}'")
        if not ID_RE.match(str(d.get("id", ""))):
            errs.append(f"{p}: id not kebab-case")
        if did in seen_ids:
            errs.append(f"{p}: duplicate id (also in {seen_ids[did]})")
        seen_ids[did] = rel
        cat = d.get("category")
        if cat not in cats:
            errs.append(f"{p}: unknown category '{cat}'")
        elif d.get("sub_type") not in cats[cat]:
            errs.append(f"{p}: unknown sub_type '{d.get('sub_type')}' for {cat}")
        if cat != data.get("category"):
            errs.append(f"{p}: device category differs from file category")
        if d.get("status") not in STATUS:
            errs.append(f"{p}: bad status '{d.get('status')}'")
        y = d.get("year_introduced")
        if not (isinstance(y, int) or y == "not found"):
            errs.append(f"{p}: year_introduced must be int or 'not found'")
        for k in ["manual_url", "datasheet_url", "product_page_url"]:
            if k in d and not is_url_or_nf(d[k]):
                errs.append(f"{p}: {k} must be http(s) URL or 'not found'")
        if not isinstance(d.get("key_specs", {}), dict):
            errs.append(f"{p}: key_specs must be an object")
        for c in d.get("connectors", []):
            cid = c.get("connector")
            if cid not in conns:
                errs.append(f"{p}: connector '{cid}' not in catalog or taxonomy proposed ids")
        for s in d.get("signal_types", []):
            if s not in sigs:
                errs.append(f"{p}: signal '{s}' not in catalog or taxonomy proposed ids")
        mans = d.get("manuals", [])
        for m in mans:
            if not is_url_or_nf(m.get("url", "")) or m.get("url") == "not found":
                errs.append(f"{p}: manual entry with bad url")
            if "language" not in m or "official" not in m:
                errs.append(f"{p}: manual entry missing language/official")
        mu = d.get("manual_url")
        if mu and mu != "not found" and mu not in [m.get("url") for m in mans]:
            warns.append(f"{p}: manual_url not listed in manuals[]")
        srcs = d.get("sources", [])
        if not srcs:
            errs.append(f"{p}: no sources")
        for j, s in enumerate(srcs):
            for k in REQUIRED_SOURCE:
                if k not in s:
                    errs.append(f"{p}: source[{j}] missing '{k}'")
            if s.get("confidence") not in CONFIDENCE:
                errs.append(f"{p}: source[{j}] bad confidence")
            if not DATE_RE.match(str(s.get("accessed", ""))):
                errs.append(f"{p}: source[{j}] accessed not YYYY-MM-DD")
            if not URL_RE.match(str(s.get("url", ""))):
                errs.append(f"{p}: source[{j}] url not http(s)")
        if not any(s.get("confidence") == "verified-primary" for s in srcs):
            warns.append(f"{p}: no verified-primary source")
        for cf in d.get("conflicts", []):
            if "field" not in cf or "values" not in cf:
                errs.append(f"{p}: conflict entry missing field/values")
    return errs, warns, devices


def two_source_keys(d):
    cover_count = {}
    for s in d.get("sources", []):
        if s.get("confidence") == "unverified":
            continue
        for c in set(s.get("covers", [])):
            cover_count[c] = cover_count.get(c, 0) + 1
    return {k for k, n in cover_count.items() if n >= 2}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--file")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()
    cats, files, conns, sigs = load_taxonomy()
    paths = [EQUIP / a.file] if a.file else sorted(EQUIP.glob("*.json"))
    seen, all_errs, all_warns, all_devs = {}, [], [], []
    for p in paths:
        e, w, devs = validate_file(p, cats, files, conns, sigs, seen)
        all_errs += e
        all_warns += w
        all_devs += devs
    if a.json:
        print(json.dumps({"files": len(paths), "devices": len(all_devs), "errors": all_errs, "warnings": all_warns}, ensure_ascii=False, indent=1))
    else:
        for e in all_errs:
            print("ERROR", e)
        for w in all_warns:
            print("WARN ", w)
        print(f"\n{len(paths)} file(s), {len(all_devs)} device(s), {len(all_errs)} error(s), {len(all_warns)} warning(s)")
    sys.exit(1 if all_errs else 0)


if __name__ == "__main__":
    main()
