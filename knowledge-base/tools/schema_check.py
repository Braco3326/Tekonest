"""Check TEK Brain files against schema/tek-brain.schema.json and schema/room.schema.json.

Stdlib only: a small JSON Schema (2020-12) subset interpreter covering the keywords those
schemas use (type, required, properties, items, prefixItems, enum, const, pattern,
minimum/maximum, exclusiveMinimum, minItems/maxItems, $ref incl. cross-file, oneOf,
allOf, if/then). It proves the schemas match the real data; validate_tekbrain.py stays
the authority for cross-references.
    python knowledge-base/tools/schema_check.py
"""
import json
import re
import sys
from pathlib import Path

KB = Path(__file__).resolve().parent.parent
SCHEMAS = {p.name: json.loads(p.read_text(encoding="utf-8")) for p in (KB / "schema").glob("*.schema.json")}
TYPES = {"object": dict, "array": list, "string": str, "boolean": bool, "null": type(None)}


def resolve(ref, root):
    file, _, frag = ref.partition("#")
    doc = SCHEMAS[file] if file else root
    node = doc
    for part in [p for p in frag.split("/") if p]:
        node = node[part]
    return node, doc


def is_type(v, t):
    if t == "integer":
        return isinstance(v, int) and not isinstance(v, bool)
    if t == "number":
        return isinstance(v, (int, float)) and not isinstance(v, bool)
    return isinstance(v, TYPES[t])


def check(v, s, root, path, errs):
    if "$ref" in s:
        node, doc = resolve(s["$ref"], root)
        check(v, node, doc, path, errs)
    if "type" in s:
        ts = s["type"] if isinstance(s["type"], list) else [s["type"]]
        if not any(is_type(v, t) for t in ts):
            errs.append(f"{path}: expected {ts}, got {type(v).__name__}")
            return
    if "const" in s and v != s["const"]:
        errs.append(f"{path}: expected const {s['const']!r}")
    if "enum" in s and v not in s["enum"]:
        errs.append(f"{path}: {v!r} not in enum")
    if isinstance(v, str) and "pattern" in s and not re.search(s["pattern"], v):
        errs.append(f"{path}: {v!r} does not match {s['pattern']}")
    if isinstance(v, (int, float)) and not isinstance(v, bool):
        if "minimum" in s and v < s["minimum"]:
            errs.append(f"{path}: {v} < {s['minimum']}")
        if "maximum" in s and v > s["maximum"]:
            errs.append(f"{path}: {v} > {s['maximum']}")
        if "exclusiveMinimum" in s and v <= s["exclusiveMinimum"]:
            errs.append(f"{path}: {v} <= {s['exclusiveMinimum']}")
    if isinstance(v, dict):
        for k in s.get("required", []):
            if k not in v:
                errs.append(f"{path}: missing {k!r}")
        for k, sub in s.get("properties", {}).items():
            if k in v:
                check(v[k], sub, root, f"{path}.{k}", errs)
    if isinstance(v, list):
        if len(v) < s.get("minItems", 0):
            errs.append(f"{path}: fewer than {s['minItems']} items")
        if "maxItems" in s and len(v) > s["maxItems"]:
            errs.append(f"{path}: more than {s['maxItems']} items")
        prefix = s.get("prefixItems", [])
        for i, item in enumerate(v):
            sub = prefix[i] if i < len(prefix) else s.get("items")
            if sub:
                check(item, sub, root, f"{path}[{i}]", errs)
    for sub in s.get("allOf", []):
        check(v, sub, root, path, errs)
    if "oneOf" in s:
        ok = 0
        for sub in s["oneOf"]:
            e = []
            check(v, sub, root, path, e)
            ok += not e
        if ok != 1:
            errs.append(f"{path}: matches {ok} of oneOf (needs exactly 1)")
    if "if" in s:
        e = []
        check(v, s["if"], root, path, e)
        if not e and "then" in s:
            check(v, s["then"], root, path, errs)


def main():
    errs, n = [], 0
    tb = SCHEMAS["tek-brain.schema.json"]
    for f in sorted((KB / "tek-brain").glob("*/*.json")):
        if f.parent.name in ("rooms", "index"):
            continue
        check(json.loads(f.read_text(encoding="utf-8-sig")), tb, tb, f"{f.parent.name}/{f.name}", errs)
        n += 1
    room = SCHEMAS["room.schema.json"]
    for f in sorted((KB / "tek-brain" / "rooms").glob("*.json")):
        check(json.loads(f.read_text(encoding="utf-8-sig")), room, room, f"rooms/{f.name}", errs)
        n += 1
    for e in errs[:50]:
        print("ERROR", e)
    print(json.dumps({"files": n, "errors": len(errs)}))
    return 1 if errs else 0


if __name__ == "__main__":
    sys.exit(main())
