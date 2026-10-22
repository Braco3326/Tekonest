"""Build the TEK Brain retrieval index (A5): tek-brain/index/chunks.jsonl + manifest.json.

Only the knowledge base's OWN-WORDS content is indexed (TEK Brain records and the
run-1 fundamentals explainers) — never copyrighted source text. Every chunk keeps
the URLs of the sources that back it, so the simulator coach and the site tutor
can cite chunk ids (see tek-brain/AI_USAGE.md).

Stdlib only.  python knowledge-base/tools/build_index.py
"""
import hashlib
import json
import re
import sys
import unicodedata
from collections import Counter
from datetime import date
from pathlib import Path

KB = Path(__file__).resolve().parent.parent
TB = KB / "tek-brain"
OUT = TB / "index"
MAX_CHARS = 1200
ENTITY_DIRS = {"concepts": "concept", "skills": "skill", "procedures": "procedure", "rules": "rule",
               "faults": "fault", "scenarios": "scenario", "glossary": "glossary"}
SENTENCE = re.compile(r"(?<=[.!?…])\s+")


def slugify(s):
    s = unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def chunk_text(text, max_chars):
    """Greedy sentence packing under max_chars; over-long sentences split on words."""
    text = " ".join(text.split())
    if len(text) <= max_chars:
        return [text] if text else []
    pieces = []
    for sent in SENTENCE.split(text):
        if len(sent) <= max_chars:
            pieces.append(sent)
            continue
        cur = ""
        for w in sent.split(" "):
            if cur and len(cur) + 1 + len(w) > max_chars:
                pieces.append(cur)
                cur = w
            else:
                cur = f"{cur} {w}" if cur else w
        if cur:
            pieces.append(cur)
    out, cur = [], ""
    for p in pieces:
        if cur and len(cur) + 1 + len(p) > max_chars:
            out.append(cur)
            cur = p
        else:
            cur = f"{cur} {p}" if cur else p
    if cur:
        out.append(cur)
    return out


def _urls(sources):
    seen = []
    for s in sources or []:
        u = s.get("url") if isinstance(s, dict) else None
        if u and u not in seen:
            seen.append(u)
    return seen


def _compose(kind, it):
    name = f"{it.get('name_fr') or it.get('term_fr') or it['id']}"
    en = it.get("name_en") or it.get("term_en")
    head = f"{name} ({en})." if en and en != name else f"{name}."
    if kind == "concept":
        parts = [head, it.get("definition", ""), it.get("explanation", "")]
        for f in it.get("formulas") or []:
            vars_ = ", ".join(f"{k} : {v}" for k, v in (f.get("vars") or {}).items())
            parts.append(f"Formule : {f['expr']}" + (f" ({vars_})." if vars_ else "."))
        return " ".join(p for p in parts if p)
    if kind == "skill":
        crit = " ".join(f"Critère : {c}" for c in it.get("success_criteria") or [])
        return f"{head} {it.get('description', '')} {crit}"
    if kind == "procedure":
        parts = [head, it.get("context", "")]
        for st in sorted(it.get("steps") or [], key=lambda s: s.get("n", 0)):
            mist = "; ".join(st.get("typical_mistakes") or [])
            parts.append(f"Étape {st.get('n')} : {st.get('action', '')} Résultat attendu : {st.get('expected_result', '')}"
                         + (f" Erreurs typiques : {mist}." if mist else ""))
        if it.get("safety_notes"):
            parts.append("Sécurité : " + "; ".join(it["safety_notes"]) + ".")
        return " ".join(p for p in parts if p)
    if kind == "fault":
        causes = "; ".join(f"{c['cause']} ({c.get('likelihood', '?')})" for c in it.get("probable_causes") or [])
        return (f"{head} Symptôme : {it.get('symptom', '')} Causes probables : {causes}. "
                f"Vérifications : {'; '.join(it.get('checks') or [])}. Corrections : {'; '.join(it.get('fixes') or [])}.")
    if kind == "rule":
        return (f"{head} Gravité : {it.get('severity')}. {it.get('explanation', '')} "
                f"Correction : {it.get('fix', '')}")
    if kind == "scenario":
        gear = ", ".join(g.get("role") or g.get("equipment_id", "") for g in it.get("required_gear") or [])
        return f"{head} {it.get('brief', '')} Matériel : {gear}."
    if kind == "glossary":
        return f"{head} {it.get('definition', '')}"
    raise ValueError(f"unknown kind {kind}")


def entity_chunks(kind, item):
    urls = _urls(item.get("sources"))
    if not urls:
        raise ValueError(f"{kind}:{item.get('id')} has no source — refusing to index unsourced text")
    if kind == "concept":
        concepts = [item["id"]] + [c for c in item.get("related_concepts") or [] if c != item["id"]]
    elif kind == "glossary":
        concepts = list(item.get("see_also") or [])
    else:
        concepts = list(item.get("concept_ids") or [])
    parts = chunk_text(_compose(kind, item), MAX_CHARS)
    title = item.get("name_fr") or item.get("term_fr") or item["id"]
    out = []
    for i, text in enumerate(parts, 1):
        cid = f"{kind}:{item['id']}" if len(parts) == 1 else f"{kind}:{item['id']}#{i}"
        out.append({"id": cid, "kind": kind, "ref": item["id"], "domain": item.get("domain"), "title": title,
                    "text": text, "source_urls": urls, "concept_ids": concepts, "lang": "fr"})
    return out


def fundamentals_chunks(fid, md):
    body = re.sub(r"\A---\n.*?\n---\n", "", md, flags=re.S)
    sections = re.split(r"^## +", body, flags=re.M)[1:]
    numbered = {}
    for sec in sections:
        heading, _, text = sec.partition("\n")
        if heading.strip().lower().startswith("sources"):
            for m in re.finditer(r"^\s*(\d+)\.\s.*?(https?://[^\s,]+)", text, flags=re.M):
                numbered[int(m.group(1))] = m.group(2)
    out = []
    for sec in sections:
        heading, _, text = sec.partition("\n")
        heading = heading.strip()
        if heading.lower().startswith("sources"):
            continue
        cited = sorted({int(n) for n in re.findall(r"\[(\d+)\]", text)})
        urls = [numbered[n] for n in cited if n in numbered]
        if not urls:
            continue  # unsourced section (e.g. a reading list): not indexed
        plain = re.sub(r"[*_`#>|]", "", text)
        parts = chunk_text(plain, MAX_CHARS)
        base = f"fund:{fid}:{slugify(heading)}"
        for i, t in enumerate(parts, 1):
            out.append({"id": base if len(parts) == 1 else f"{base}#{i}", "kind": "fundamentals", "ref": fid,
                        "domain": None, "title": heading, "text": t, "source_urls": urls, "concept_ids": [], "lang": "fr"})
    return out


def build(kb):
    chunks = []
    for folder, kind in ENTITY_DIRS.items():
        for f in sorted((kb / "tek-brain" / folder).glob("*.json")):
            for it in json.loads(f.read_text(encoding="utf-8-sig"))["items"]:
                chunks.extend(entity_chunks(kind, it))
    for f in sorted((kb / "fundamentals").glob("[0-9]*.md")):
        chunks.extend(fundamentals_chunks(f.stem, f.read_text(encoding="utf-8")))
    return chunks


def main():
    chunks = build(KB)
    ids = [c["id"] for c in chunks]
    dupes = [i for i, n in Counter(ids).items() if n > 1]
    if dupes:
        print("duplicate chunk ids:", dupes[:10])
        return 1
    OUT.mkdir(exist_ok=True)
    data = "\n".join(json.dumps(c, ensure_ascii=False) for c in chunks) + "\n"
    (OUT / "chunks.jsonl").write_text(data, encoding="utf-8")
    manifest = {"generated": date.today().isoformat(), "total": len(chunks), "max_chars": MAX_CHARS,
                "by_kind": dict(Counter(c["kind"] for c in chunks)),
                "sha256": hashlib.sha256(data.encode("utf-8")).hexdigest(),
                "note": "Own-words KB content only. Cite chunk ids; see tek-brain/AI_USAGE.md."}
    (OUT / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(json.dumps({k: manifest[k] for k in ("total", "by_kind")}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(main())
