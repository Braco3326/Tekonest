"""Merge the A3 3D candidate fragments into 3d-models.json (run 2). Stdlib only.

- Backfills `id` and `kind` on run-1 entries (fields kept as they were).
- Adds every candidate from 3d-models/candidates/<agent>.json, de-duplicated by model_url.
- Appends <agent>.downloads.json to 3d-models/downloads.json and <agent>.CREDITS.md to
  3d-models/CREDITS.md (each only once — idempotent).
- Writes 3d-models-catalogue.md and fills `licensed_dressing` in tek-brain/rooms/*.json
  with COMMITTED (redistributable) models whose room_ids name that room.
    python knowledge-base/tools/merge_3d.py
"""
import json
import re
import unicodedata
from collections import Counter, defaultdict
from pathlib import Path

KB = Path(__file__).resolve().parent.parent
MODELS = KB / "3d-models.json"
DIR = KB / "3d-models"
CAND = DIR / "candidates"
ROOMS = KB / "tek-brain" / "rooms"
ROOM_WORDS = re.compile(r"studio|room|stage|theat|hall|church|booth|auditor|arena|club|venue|salle|scène|plateau|chapel", re.I)


def slug(s):
    s = unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")[:60]


def load(p):
    return json.loads(p.read_text(encoding="utf-8-sig"))


def main():
    data = load(MODELS)
    models = data["models"]
    used = set()
    prefix = {"Sketchfab": "sf", "Poly Haven": "ph", "Poly Pizza": "pp"}
    for m in models:  # run-1 backfill
        if not m.get("id"):
            base = f"{prefix.get(m.get('source_site'), 'm')}-{slug(m.get('title') or m.get('device_id') or 'model')}"
            mid, n = base, 2
            while mid in used:
                mid, n = f"{base}-{n}", n + 1
            m["id"] = mid
        used.add(m["id"])
        if not m.get("kind"):
            m["kind"] = "device" if m.get("device_id") else ("room" if ROOM_WORDS.search(m.get("title") or "") else "prop")
        m.setdefault("room_ids", [])

    urls = {m.get("model_url") for m in models}
    added, dup = Counter(), 0
    for frag in sorted(CAND.glob("*.json")):
        if frag.name.endswith(".downloads.json"):
            continue
        fd = load(frag)
        for m in fd["models"]:
            if m.get("model_url") in urls or m.get("id") in used:
                dup += 1
                continue
            m["added_by"] = fd.get("agent", frag.stem)
            models.append(m)
            urls.add(m.get("model_url"))
            used.add(m["id"])
            added[m["added_by"]] += 1
        for nf in fd.get("not_found_log", []):
            data.setdefault("not_found_log", []).append(nf)

    # downloads + credits (idempotent)
    dl_path = DIR / "downloads.json"
    downloads = load(dl_path)
    have = {d["file"] for d in downloads}
    for frag in sorted(CAND.glob("*.downloads.json")):
        for d in load(frag):
            if d["file"] not in have and (DIR / d["file"]).exists():
                downloads.append(d)
                have.add(d["file"])
    dl_path.write_text(json.dumps(downloads, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    credits_path = DIR / "CREDITS.md"
    credits = credits_path.read_text(encoding="utf-8")
    for frag in sorted(CAND.glob("*.CREDITS.md")):
        marker = f"<!-- merged: {frag.name} -->"
        if marker not in credits:
            credits += f"\n\n{marker}\n" + frag.read_text(encoding="utf-8").strip() + "\n"
    credits_path.write_text(credits, encoding="utf-8")

    committed = {d["file"] for d in downloads}
    by_url = {d.get("model_url"): d["file"] for d in downloads}
    for m in models:
        f = f"{m['id']}.glb"
        hit = f if f in committed else by_url.get(m.get("model_url"))
        m["committed_file"] = f"3d-models/{hit}" if hit else None
    # Committed files with no catalogue entry (run 1 stored them in downloads.json only).
    linked = {m["committed_file"] for m in models if m["committed_file"]}
    for d in downloads:
        if f"3d-models/{d['file']}" in linked:
            continue
        stem = d["file"].rsplit(".", 1)[0]
        use = (d.get("intended_use") or "").lower()
        models.append({
            "id": stem, "kind": "device" if any(w in use for w in ("mic", "speaker", "desk", "console", "amp")) and "room:" not in use else "prop",
            "title": stem.replace("-", " "), "source_site": d.get("source_site"), "model_url": d.get("model_url"),
            "author": d.get("author"), "licence": d.get("licence"), "licence_url": d.get("licence_url"),
            "attribution_text_required": d.get("attribution_text"), "polygon_count": d.get("triangles_if_known"),
            "shows_brand_logos": d.get("shows_brand_logos"), "redistribution_allowed": "yes (committed, see CREDITS.md)",
            "suitable_for_tekpractice": "yes", "quality_notes": d.get("intended_use"), "accessed": d.get("accessed"),
            "room_ids": [], "device_id": None, "committed_file": f"3d-models/{d['file']}", "added_by": "run1-downloads",
        })
    data["counts"] = {"total": len(models), "by_kind": dict(Counter(m["kind"] for m in models)),
                      "committed_files": sum(1 for m in models if m["committed_file"])}
    MODELS.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    # rooms: licensed dressing = committed models tagged for the room
    by_room = defaultdict(list)
    for m in models:
        if m.get("committed_file"):
            for r in m.get("room_ids") or []:
                by_room[r].append(m["id"])
    for rf in ROOMS.glob("*.json"):
        room = load(rf)
        room["licensed_dressing"] = sorted(set(by_room.get(room["id"], [])))
        rf.write_text(json.dumps(room, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    # catalogue page
    lines = ["# Catalogue 3D (TekPractice)", "",
             f"Généré par `tools/merge_3d.py` : {len(models)} candidats, dont **{data['counts']['committed_files']} fichiers .glb "
             "redistribuables commités** (CC0 / CC-BY, crédits dans `3d-models/CREDITS.md`). Tous les autres sont des liens seulement.", "",
             "⚠️ Les licences Sketchfab des agents du run 2 viennent de l'API de recherche (l'API par modèle était limitée en débit) : "
             "à revérifier sur la page du modèle avant tout téléchargement.", ""]
    groups = defaultdict(list)
    for m in models:
        groups[m["kind"]].append(m)
    for kind in sorted(groups):
        items = sorted(groups[kind], key=lambda m: (m.get("committed_file") is None, (m.get("title") or "").lower()))
        lines += [f"## {kind} ({len(items)})", "", "| Modèle | Source | Licence | Logos | TekPractice | Fichier |", "|---|---|---|---|---|---|"]
        for m in items:
            t = re.sub(r"\|", "/", m.get("title") or m["id"])
            lines.append(f"| [{t}]({m.get('model_url', '')}) | {m.get('source_site', '')} | {m.get('licence', '')} | "
                         f"{m.get('shows_brand_logos', '')} | {m.get('suitable_for_tekpractice', '')} | {m.get('committed_file') or '—'} |")
        lines.append("")
    (KB / "3d-models-catalogue.md").write_text("\n".join(lines), encoding="utf-8")
    print(json.dumps({"total": len(models), "added": dict(added), "duplicates_skipped": dup, **data["counts"],
                      "rooms_with_dressing": sum(1 for v in by_room.values() if v)}, ensure_ascii=False))


if __name__ == "__main__":
    main()
