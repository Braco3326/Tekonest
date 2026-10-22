"""Validate TEK Brain files (knowledge-base/tek-brain/) against tek-brain/DESIGN.md.

Stdlib only. Usage (from repo root):
    python knowledge-base/tools/validate_tekbrain.py                  # everything
    python knowledge-base/tools/validate_tekbrain.py --domain safety  # one domain's files (+ refs checked globally)
    python knowledge-base/tools/validate_tekbrain.py --strict         # unresolved references become errors
    python knowledge-base/tools/validate_tekbrain.py --json           # machine-readable summary
Exit code 1 if any ERROR.
"""
import argparse
import json
import re
import sys
from pathlib import Path

KB = Path(__file__).resolve().parent.parent
TB = KB / "tek-brain"
CATALOG = KB.parent / "tekpractice-sim" / "content" / "catalog.json"

ID_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
URL_RE = re.compile(r"^https?://\S+$")
CONFIDENCE = {"verified-primary", "verified-secondary", "unverified"}
SOURCE_KIND = {"manufacturer", "standard", "education-official", "university", "trade-press",
               "retailer", "textbook", "forum", "regulator", "other"}
EPREUVES = {"E1", "E2", "E3", "E4", "E51", "E52", "E6"}
BLOCS = {"BC01", "BC02", "BC03", "BC04", None}
REVIEW = {"needs-oscar-review", "ok"}
CATALOG_RULES = {f"R{i}" for i in range(1, 9)}

ENTITIES = {
    "concepts": ("concept", ["id", "name_fr", "name_en", "domain", "definition", "explanation", "formulas",
                             "units", "related_concepts", "equipment_ids", "bts_mapping", "difficulty",
                             "sources", "conflicts", "review"]),
    "skills": ("skill", ["id", "name_fr", "name_en", "domain", "description", "level", "concept_ids",
                         "procedure_ids", "success_criteria", "bts_mapping", "sources", "review"]),
    "procedures": ("procedure", ["id", "name_fr", "name_en", "domain", "context", "duration_min",
                                 "equipment_ids", "concept_ids", "rule_ids", "steps", "safety_notes",
                                 "sources", "conflicts", "review"]),
    "rules": ("rule", ["id", "name_fr", "name_en", "domain", "catalog_rule", "status", "severity", "scope",
                       "condition", "explanation", "fix", "evaluable_now", "needs_catalog_fields",
                       "concept_ids", "sources", "review"]),
    "faults": ("fault", ["id", "name_fr", "name_en", "domain", "symptom", "contexts", "probable_causes",
                         "checks", "fixes", "rule_ids", "concept_ids", "equipment_ids", "sources", "review"]),
    "scenarios": ("scenario", ["id", "name_fr", "name_en", "domain", "brief", "room_id", "required_gear",
                               "signal_flow", "procedure_ids", "rule_ids", "difficulty", "estimated_time_min",
                               "bts_mapping", "sources", "review"]),
    "glossary": ("glossary", ["id", "term_fr", "term_en", "domain", "definition", "see_also", "sources"]),
}
ROOM_REQUIRED = ["id", "name_fr", "name_en", "family", "size", "description", "dimensions_m",
                 "coordinate_system", "surfaces", "rt60_s", "zones", "gear_positions", "power_points",
                 "patch_points", "openings", "lighting", "procedural", "licensed_dressing", "sources", "review"]
ZONE_KINDS = {"stage", "foh", "monitor-world", "control-room", "live-room", "iso-booth", "vocal-booth",
              "audience", "backstage", "gallery", "booth", "pit", "desk", "machine-room", "other"}
COND_OPS = {"eq", "ne", "in", "not_in", "includes", "excludes", "gt", "gte", "lt", "lte", "exists"}
PATH_ROOTS = ("src.", "dst.", "device.", "graph.", "room.", "session.")


class Report:
    def __init__(self):
        self.errors, self.warnings = [], []

    def err(self, msg):
        self.errors.append(msg)

    def warn(self, msg):
        self.warnings.append(msg)


def load_json(path, rep):
    try:
        return json.loads(path.read_text(encoding="utf-8-sig"))
    except Exception as e:  # noqa: BLE001
        rep.err(f"{path.relative_to(KB)}: invalid JSON: {e}")
        return None


def known_ids():
    """Ids that live outside tek-brain: KB equipment, catalog devices, connector/signal ids."""
    equip = set()
    for f in sorted((KB / "equipment").glob("*.json")):
        try:
            equip |= {d["id"] for d in json.loads(f.read_text(encoding="utf-8-sig")).get("devices", [])}
        except Exception:  # noqa: BLE001
            pass
    tax = json.loads((KB / "taxonomy.json").read_text(encoding="utf-8-sig"))
    conns = set(tax["tekpractice_connector_ids_existing"]) | {k for k in tax["proposed_connector_ids"] if not k.startswith("_")}
    sigs = set(tax["tekpractice_signal_ids_existing"]) | {k for k in tax["proposed_signal_ids"] if not k.startswith("_")}
    catalog_devices = set()
    if CATALOG.exists():
        catalog_devices = {d["id"] for d in json.loads(CATALOG.read_text(encoding="utf-8-sig"))["devices"]}
    models = set()
    mpath = KB / "3d-models.json"
    if mpath.exists():
        m = json.loads(mpath.read_text(encoding="utf-8-sig"))
        items = m.get("models", m.get("items", [])) if isinstance(m, dict) else m
        models = {x.get("id") for x in items if isinstance(x, dict) and x.get("id")}
    return equip | catalog_devices, conns, sigs, models


def check_sources(where, srcs, rep):
    if not isinstance(srcs, list) or not srcs:
        rep.err(f"{where}: needs at least one source")
        return set()
    urls = set()
    for j, s in enumerate(srcs):
        p = f"{where}.sources[{j}]"
        if not isinstance(s, dict):
            rep.err(f"{p}: not an object")
            continue
        for k in ("url", "publisher", "accessed", "confidence", "covers"):
            if k not in s:
                rep.err(f"{p}: missing '{k}'")
        if s.get("url") and not URL_RE.match(str(s["url"])):
            rep.err(f"{p}: bad url '{s.get('url')}'")
        if s.get("accessed") and not DATE_RE.match(str(s["accessed"])):
            rep.err(f"{p}: accessed must be YYYY-MM-DD")
        if s.get("confidence") not in CONFIDENCE:
            rep.err(f"{p}: bad confidence '{s.get('confidence')}'")
        if "kind" in s and s["kind"] not in SOURCE_KIND:
            rep.err(f"{p}: bad kind '{s['kind']}'")
        if "covers" in s and not isinstance(s["covers"], list):
            rep.err(f"{p}: covers must be a list")
        if s.get("url"):
            urls.add(s["url"])
    return urls


def check_bts(where, bts, rep):
    if not isinstance(bts, list):
        rep.err(f"{where}: bts_mapping must be a list")
        return
    for m in bts:
        if not isinstance(m, dict):
            rep.err(f"{where}: bts_mapping item not an object")
            continue
        if m.get("epreuve") not in EPREUVES:
            rep.err(f"{where}: bts epreuve '{m.get('epreuve')}' not in {sorted(EPREUVES)}")
        if m.get("bloc") not in BLOCS:
            rep.err(f"{where}: bts bloc '{m.get('bloc')}' invalid")
        if not isinstance(m.get("verified"), bool):
            rep.err(f"{where}: bts verified must be true/false")


def check_condition(where, c, rep, depth=0):
    if depth > 8:
        rep.err(f"{where}: condition nested too deep")
        return
    if not isinstance(c, dict):
        rep.err(f"{where}: condition must be an object")
        return
    keys = set(c)
    if keys & {"all", "any"}:
        for k in keys & {"all", "any"}:
            if not isinstance(c[k], list) or not c[k]:
                rep.err(f"{where}: '{k}' must be a non-empty list")
                continue
            for sub in c[k]:
                check_condition(where, sub, rep, depth + 1)
    elif "not" in keys:
        check_condition(where, c["not"], rep, depth + 1)
    else:
        if not str(c.get("path", "")).startswith(PATH_ROOTS):
            rep.err(f"{where}: condition path '{c.get('path')}' must start with one of {PATH_ROOTS}")
        if c.get("op") not in COND_OPS:
            rep.err(f"{where}: condition op '{c.get('op')}' not in {sorted(COND_OPS)}")
        if c.get("op") != "exists" and "value" not in c:
            rep.err(f"{where}: condition needs 'value'")


def validate_item(folder, it, where, rep, refs):
    """Per-entity checks. refs collects (kind, id, where) to resolve later."""
    entity = ENTITIES[folder][0]
    if entity != "glossary":
        if it.get("review") not in REVIEW:
            rep.err(f"{where}: review must be one of {sorted(REVIEW)}")
    urls = check_sources(where, it.get("sources"), rep)
    for k in ("conflicts",):
        if k in it and not isinstance(it[k], list):
            rep.err(f"{where}: {k} must be a list")
    if "bts_mapping" in it:
        check_bts(where, it["bts_mapping"], rep)
    for key, kind in (("related_concepts", "concept"), ("concept_ids", "concept"), ("see_also", "concept"),
                      ("procedure_ids", "procedure"), ("rule_ids", "rule"), ("equipment_ids", "equipment")):
        v = it.get(key)
        if v is None:
            continue
        if not isinstance(v, list):
            rep.err(f"{where}: {key} must be a list")
            continue
        for x in v:
            refs.append((kind, x, where))

    if entity == "concept":
        d = it.get("difficulty")
        if not (isinstance(d, int) and 1 <= d <= 5):
            rep.err(f"{where}: difficulty must be int 1-5")
        for j, f in enumerate(it.get("formulas", []) or []):
            if not isinstance(f, dict) or not f.get("expr"):
                rep.err(f"{where}.formulas[{j}]: needs 'expr'")
                continue
            if f.get("source_url") not in urls:
                rep.err(f"{where}.formulas[{j}]: source_url must be one of the record's sources")
    elif entity == "skill":
        if it.get("level") not in {"beginner", "bts", "pro"}:
            rep.err(f"{where}: level must be beginner|bts|pro")
        if not it.get("success_criteria"):
            rep.err(f"{where}: success_criteria must not be empty")
    elif entity == "procedure":
        steps = it.get("steps")
        if not isinstance(steps, list) or len(steps) < 2:
            rep.err(f"{where}: steps needs at least 2 items")
        else:
            for j, s in enumerate(steps):
                for k in ("n", "preconditions", "action", "expected_result", "typical_mistakes"):
                    if k not in s:
                        rep.err(f"{where}.steps[{j}]: missing '{k}'")
        dm = it.get("duration_min")
        if dm is not None and not isinstance(dm, (int, float)):
            rep.err(f"{where}: duration_min must be a number or null")
    elif entity == "rule":
        cr = it.get("catalog_rule")
        if cr is not None and cr not in CATALOG_RULES:
            rep.err(f"{where}: catalog_rule must be R1..R8 or null")
        if it.get("status") not in {"existing", "proposed"}:
            rep.err(f"{where}: status must be existing|proposed")
        if it.get("status") == "existing" and cr is None:
            rep.err(f"{where}: existing rule needs catalog_rule")
        if it.get("severity") not in {"error", "warning", "info"}:
            rep.err(f"{where}: bad severity")
        if it.get("scope") not in {"connection", "device", "graph", "room", "session"}:
            rep.err(f"{where}: bad scope")
        check_condition(f"{where}.condition", it.get("condition"), rep)
        if not isinstance(it.get("evaluable_now"), bool):
            rep.err(f"{where}: evaluable_now must be true/false")
        if it.get("evaluable_now") is False and not it.get("needs_catalog_fields"):
            rep.warn(f"{where}: evaluable_now=false but needs_catalog_fields is empty")
    elif entity == "fault":
        pcs = it.get("probable_causes")
        if not isinstance(pcs, list) or not pcs:
            rep.err(f"{where}: probable_causes must not be empty")
        else:
            for j, pc in enumerate(pcs):
                if not isinstance(pc, dict) or "cause" not in pc or pc.get("likelihood") not in {"high", "medium", "low"}:
                    rep.err(f"{where}.probable_causes[{j}]: needs cause + likelihood high|medium|low")
        if not it.get("checks"):
            rep.err(f"{where}: checks must not be empty")
    elif entity == "scenario":
        d = it.get("difficulty")
        if not (isinstance(d, int) and 1 <= d <= 5):
            rep.err(f"{where}: difficulty must be int 1-5")
        if it.get("room_id") is not None:
            refs.append(("room", it["room_id"], where))
        for g in it.get("required_gear", []) or []:
            if not isinstance(g, dict) or "equipment_id" not in g:
                rep.err(f"{where}: required_gear items need equipment_id")
            else:
                refs.append(("equipment", g["equipment_id"], where))
        sf = it.get("signal_flow") or {}
        nodes = {n.get("id") for n in sf.get("nodes", []) if isinstance(n, dict)}
        if not nodes:
            rep.err(f"{where}: signal_flow.nodes must not be empty")
        for n in sf.get("nodes", []):
            if isinstance(n, dict) and n.get("equipment_id"):
                refs.append(("equipment", n["equipment_id"], where))
        for e in sf.get("edges", []):
            if e.get("from") not in nodes or e.get("to") not in nodes:
                rep.err(f"{where}: signal_flow edge {e.get('from')}->{e.get('to')} uses unknown node")
            if e.get("signal"):
                refs.append(("signal", e["signal"], where))
            if e.get("connector"):
                refs.append(("connector", e["connector"], where))


def validate_room(path, rep, refs, seen):
    data = load_json(path, rep)
    if data is None:
        return
    where = f"rooms/{path.name}"
    for k in ROOM_REQUIRED:
        if k not in data:
            rep.err(f"{where}: missing '{k}'")
    rid = data.get("id")
    if not ID_RE.match(str(rid)):
        rep.err(f"{where}: id not kebab-case")
    if path.stem != rid:
        rep.err(f"{where}: file name must equal id '{rid}'")
    if rid in seen:
        rep.err(f"{where}: duplicate room id")
    seen.add(rid)
    if data.get("size") not in {"small", "medium", "large"}:
        rep.err(f"{where}: size must be small|medium|large")
    if data.get("review") not in REVIEW:
        rep.err(f"{where}: bad review")
    dims = data.get("dimensions_m") or {}
    for axis in ("length", "width", "height"):
        a = dims.get(axis)
        if not isinstance(a, dict) or not all(isinstance(a.get(k), (int, float)) for k in ("min", "typical", "max")):
            rep.err(f"{where}: dimensions_m.{axis} needs numeric min/typical/max")
        elif not (a["min"] <= a["typical"] <= a["max"]):
            rep.err(f"{where}: dimensions_m.{axis} must satisfy min <= typical <= max")
    rt = data.get("rt60_s")
    if rt != "not found":
        if not isinstance(rt, dict) or not isinstance(rt.get("min"), (int, float)) or not isinstance(rt.get("max"), (int, float)):
            rep.err(f"{where}: rt60_s needs numeric min/max or 'not found'")
        elif rt.get("source_url") and rt["source_url"] not in {s.get("url") for s in data.get("sources", []) if isinstance(s, dict)}:
            rep.err(f"{where}: rt60_s.source_url must be one of the sources")
    zone_ids = set()
    L = (dims.get("length") or {}).get("typical")
    W = (dims.get("width") or {}).get("typical")
    for z in data.get("zones", []) or []:
        if z.get("kind") not in ZONE_KINDS:
            rep.err(f"{where}: zone kind '{z.get('kind')}' invalid")
        r = z.get("rect_m")
        if not (isinstance(r, list) and len(r) == 4 and all(isinstance(v, (int, float)) for v in r)):
            rep.err(f"{where}: zone {z.get('id')} rect_m must be [x, z, w, d]")
        elif isinstance(L, (int, float)) and isinstance(W, (int, float)):
            x, zz, w, d = r
            if abs(x) + w / 2 > W / 2 + 0.01 or abs(zz) + d / 2 > L / 2 + 0.01:
                rep.warn(f"{where}: zone {z.get('id')} extends outside the typical room footprint")
        zone_ids.add(z.get("id"))
    for g in data.get("gear_positions", []) or []:
        if g.get("zone") not in zone_ids:
            rep.err(f"{where}: gear_position zone '{g.get('zone')}' not in zones")
        p = g.get("position_m")
        if not (isinstance(p, list) and len(p) == 3):
            rep.err(f"{where}: gear_position position_m must be [x, y, z]")
        if g.get("equipment_id"):
            refs.append(("equipment", g["equipment_id"], where))
    for mid in data.get("licensed_dressing", []) or []:
        refs.append(("model", mid, where))
    check_sources(where, data.get("sources"), rep)


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--domain")
    ap.add_argument("--strict", action="store_true")
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args(argv)
    rep = Report()

    domains = {d["id"] for d in json.loads((TB / "domains.json").read_text(encoding="utf-8-sig"))["domains"]}
    equip, conns, sigs, models = known_ids()
    ids = {k: {} for k in ("concept", "skill", "procedure", "rule", "fault", "scenario", "glossary")}
    refs, counts = [], {}

    for folder, (entity, required) in ENTITIES.items():
        for path in sorted((TB / folder).glob("*.json")) if (TB / folder).exists() else []:
            data = load_json(path, rep)
            if data is None:
                continue
            rel = f"{folder}/{path.name}"
            if data.get("entity") != entity:
                rep.err(f"{rel}: entity must be '{entity}'")
            if data.get("domain") not in domains or path.stem != data.get("domain"):
                rep.err(f"{rel}: domain '{data.get('domain')}' must be a domains.json id equal to the file name")
            if not DATE_RE.match(str(data.get("generated", ""))):
                rep.err(f"{rel}: generated must be YYYY-MM-DD")
            items = data.get("items")
            if not isinstance(items, list):
                rep.err(f"{rel}: items must be a list")
                continue
            in_scope = args.domain is None or data.get("domain") == args.domain
            counts[entity] = counts.get(entity, 0) + len(items)
            for i, it in enumerate(items):
                iid = it.get("id", f"#{i}") if isinstance(it, dict) else f"#{i}"
                where = f"{rel}:{iid}"
                if not isinstance(it, dict):
                    rep.err(f"{where}: item not an object")
                    continue
                if iid in ids[entity]:
                    rep.err(f"{where}: duplicate {entity} id (also in {ids[entity][iid]})")
                ids[entity][iid] = rel
                if not in_scope:
                    continue
                for k in required:
                    if k not in it:
                        rep.err(f"{where}: missing '{k}'")
                if not ID_RE.match(str(iid)):
                    rep.err(f"{where}: id not kebab-case")
                if it.get("domain") != data.get("domain"):
                    rep.err(f"{where}: item domain differs from file domain")
                validate_item(folder, it, where, rep, refs)

    rooms = set()
    if (TB / "rooms").exists():
        for path in sorted((TB / "rooms").glob("*.json")):
            validate_room(path, rep, refs, rooms)
    counts["room"] = len(rooms)

    pools = {"concept": set(ids["concept"]), "procedure": set(ids["procedure"]), "rule": set(ids["rule"]),
             "equipment": equip, "room": rooms, "signal": sigs, "connector": conns, "model": models}
    unresolved = 0
    for kind, rid, where in refs:
        if rid not in pools[kind]:
            unresolved += 1
            msg = f"{where}: unresolved {kind} reference '{rid}'"
            (rep.err if args.strict else rep.warn)(msg)

    summary = {"counts": counts, "errors": len(rep.errors), "warnings": len(rep.warnings),
               "unresolved_refs": unresolved}
    if args.json:
        print(json.dumps({**summary, "error_list": rep.errors, "warning_list": rep.warnings}, ensure_ascii=False, indent=1))
    else:
        for e in rep.errors:
            print("ERROR", e)
        for w in rep.warnings:
            print("WARN ", w)
        print(json.dumps(summary, ensure_ascii=False))
    return 1 if rep.errors else 0


if __name__ == "__main__":
    sys.exit(main())
