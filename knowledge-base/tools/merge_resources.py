"""Merge learning-resources-candidates/*.json into learning-resources.json and
generate learning-resources-catalogue.md (A4, run 2).

Stdlib only. Idempotent: entries already present (same id) are kept as they are in
learning-resources.json (the base is the source of truth after the first merge, and it
carries the link-check fields); duplicate access links are skipped and logged.
    python knowledge-base/tools/merge_resources.py
"""
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

KB = Path(__file__).resolve().parent.parent
BASE = KB / "learning-resources.json"
FRAG_DIR = KB / "learning-resources-candidates"
CATALOGUE = KB / "learning-resources-catalogue.md"
CONCEPT_DIR = KB / "tek-brain" / "concepts"

TYPE_FR = {
    "book": "Livres", "book-chapter": "Chapitres de livres", "open-textbook": "Manuels libres (open textbooks)",
    "standard": "Normes et recommandations", "regulation": "Textes réglementaires", "official-guide": "Guides officiels",
    "official-education": "Ressources officielles de l'éducation", "official-training": "Formations officielles",
    "certification": "Certifications", "manufacturer-academy": "Académies de fabricants",
    "manufacturer-guide": "Guides de fabricants", "application-note": "Notes d'application", "white-paper": "Livres blancs",
    "manual": "Manuels d'utilisation", "course": "Cours en ligne (MOOC)", "online-course": "Cours en ligne (MOOC)",
    "open-courseware": "Open courseware universitaire", "academic-paper": "Articles scientifiques", "thesis": "Thèses et mémoires",
    "article": "Articles", "article-series": "Séries d'articles", "journal-issue": "Numéros de revues",
    "website": "Sites de référence", "video-channel": "Chaînes vidéo", "video": "Vidéos", "tool": "Outils",
    "software": "Logiciels", "technical-document": "Documents techniques", "test-material": "Matériel de test",
}


def load(p):
    return json.loads(p.read_text(encoding="utf-8-sig"))


def main():
    base = load(BASE)
    concepts = set()
    for f in CONCEPT_DIR.glob("*.json"):
        concepts |= {c["id"] for c in load(f)["items"]}

    by_id = {r["id"]: r for r in base["resources"]}
    links = {r.get("access_link"): r["id"] for r in base["resources"]}
    log, added = [], Counter()
    for frag in sorted(FRAG_DIR.glob("*.json")):
        data = load(frag)
        for r in data["resources"]:
            r = dict(r)
            r["added_by"] = data.get("agent", frag.stem)
            bad = [c for c in r.get("concept_ids", []) if c not in concepts]
            if bad:
                r["concept_ids"] = [c for c in r["concept_ids"] if c in concepts]
                log.append(f"{r['id']}: dropped unknown concept ids {bad}")
            link = r.get("access_link")
            if link in links and links[link] != r["id"]:
                log.append(f"{r['id']}: skipped, same access_link as {links[link]}")
                continue
            if r["id"] in by_id:
                # Already merged (or a run-1 id): the base file is now the source of truth —
                # it carries url_status/access_link_status written by check_urls.py.
                if by_id[r["id"]].get("added_by") is None:
                    log.append(f"{r['id']}: id already used by a run-1 entry, kept run-1 entry")
                continue
            by_id[r["id"]] = r
            links[link] = r["id"]
            added[r["added_by"]] += 1
        base.setdefault("not_found_log", [])
        for nf in data.get("not_found_log", []):
            if nf not in base["not_found_log"]:
                base["not_found_log"].append(nf)

    base["resources"] = list(by_id.values())
    base["merge_log_run2"] = log
    BASE.write_text(json.dumps(base, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    res = base["resources"]
    free = [r for r in res if r.get("free_or_paid") == "free"]
    groups = defaultdict(list)
    for r in res:
        groups[TYPE_FR.get(r.get("type"), r.get("type") or "Autres")].append(r)

    def lang_key(r):
        return (0 if r.get("language") == "fr" else 1, (r.get("title") or "").lower())

    lines = [
        "# Catalogue des ressources d'apprentissage",
        "",
        f"Généré par `tools/merge_resources.py` à partir de `learning-resources.json` ({len(res)} ressources, "
        f"dont **{len(free)} gratuites légalement**). Le guide commenté reste `learning-resources.md`.",
        "",
        "Légende : 🇫🇷 français, 🇬🇧 anglais, 🌐 multilingue · **Gratuit** = accès libre et légal (domaine public, licence ouverte, "
        "accès libre chez l'éditeur ou cours officiel gratuit). La colonne Licence reprend les conditions exactes.",
        "",
    ]
    flag = {"fr": "🇫🇷", "en": "🇬🇧"}
    for gname in sorted(groups, key=str.lower):
        items = sorted(groups[gname], key=lang_key)
        lines += [f"## {gname} ({len(items)})", "", "| Ressource | Langue | Niveau | Accès | Licence |", "|---|---|---|---|---|"]
        for r in items:
            title = re.sub(r"\|", "/", r.get("title") or r["id"])
            who = re.sub(r"\|", "/", str(r.get("author_or_publisher") or ""))
            link = r.get("access_link") or ""
            cell = f"[{title}]({link})" if link.startswith("http") else title
            fp = {"free": "**Gratuit**", "freemium": "Freemium", "paid": "Payant"}.get(r.get("free_or_paid"), str(r.get("free_or_paid")))
            lic = re.sub(r"\|", "/", str(r.get("licence") or ""))[:90]
            lines.append(f"| {cell}<br><sub>{who}</sub> | {flag.get(r.get('language'), '🌐')} | {r.get('level', '')} | {fp} | {lic} |")
        lines.append("")
    CATALOGUE.write_text("\n".join(lines), encoding="utf-8")

    print(json.dumps({"total": len(res), "free": len(free), "added": dict(added), "log_entries": len(log),
                      "fr": sum(1 for r in res if r.get("language") == "fr")}, ensure_ascii=False))


if __name__ == "__main__":
    main()
