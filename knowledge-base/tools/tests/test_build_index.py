"""Tests for tools/build_index.py (A5 retrieval index). Stdlib unittest.
    python -m unittest discover -s knowledge-base/tools/tests -v
"""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import build_index as bi  # noqa: E402

SRC = {"url": "https://tech.ebu.ch/x", "publisher": "EBU", "accessed": "2026-10-22",
       "confidence": "verified-primary", "covers": ["definition"]}

FUND = """---
id: 99-test
title_fr: Test
---

# Titre (Title)

## En bref / In short
Le dBu vaut 0,775 V [2]. Deux sources égales donnent +3 dB [1][2].

## Formules (Formulas)
L = 20·log10(p/p0) [1]

## Sources
1. « A », Pub A, https://a.example/one, accessed 2026-10-22, verified-secondary
2. « B », Pub B, http://b.example/two, accessed 2026-10-22, verified-primary
"""


class ChunkText(unittest.TestCase):
    def test_short_text_is_one_chunk(self):
        self.assertEqual(bi.chunk_text("Une phrase.", 100), ["Une phrase."])

    def test_long_text_splits_on_sentences_under_the_limit(self):
        text = " ".join(f"Phrase numéro {i} assez longue pour compter." for i in range(60))
        parts = bi.chunk_text(text, 400)
        self.assertGreater(len(parts), 1)
        self.assertTrue(all(len(p) <= 400 for p in parts))
        self.assertEqual(" ".join(parts).split(), text.split())  # nothing lost or reordered


class EntityChunks(unittest.TestCase):
    def test_concept_chunk_cites_sources_and_concepts(self):
        item = {"id": "dbu", "name_fr": "dBu", "name_en": "dBu", "domain": "electricity-levels",
                "definition": "Niveau rapporté à 0,775 V.", "explanation": "Explication.",
                "formulas": [{"expr": "L = 20·log10(U/0,775)", "source_url": SRC["url"]}],
                "related_concepts": ["dbv"], "sources": [SRC]}
        [c] = bi.entity_chunks("concept", item)
        self.assertEqual(c["id"], "concept:dbu")
        self.assertIn("0,775 V", c["text"])
        self.assertIn("20·log10", c["text"])
        self.assertEqual(c["source_urls"], [SRC["url"]])
        self.assertEqual(c["concept_ids"], ["dbu", "dbv"])
        self.assertEqual(c["lang"], "fr")

    def test_procedure_steps_are_kept_in_order(self):
        item = {"id": "line-check", "name_fr": "Line check", "name_en": "Line check", "domain": "live-sound",
                "context": "Avant les musiciens.", "concept_ids": ["signal-flow"],
                "steps": [{"n": 2, "action": "Deuxième", "expected_result": "ok", "typical_mistakes": []},
                          {"n": 1, "action": "Première", "expected_result": "ok", "typical_mistakes": ["oubli"]}],
                "sources": [SRC]}
        text = bi.entity_chunks("procedure", item)[0]["text"]
        self.assertLess(text.index("Première"), text.index("Deuxième"))
        self.assertIn("oubli", text)

    def test_record_without_sources_is_rejected(self):
        with self.assertRaises(ValueError):
            bi.entity_chunks("concept", {"id": "x", "name_fr": "x", "definition": "d", "sources": []})


class Fundamentals(unittest.TestCase):
    def test_sections_become_chunks_citing_only_their_numbered_sources(self):
        chunks = bi.fundamentals_chunks("99-test", FUND)
        ids = [c["id"] for c in chunks]
        self.assertEqual(ids, ["fund:99-test:en-bref-in-short", "fund:99-test:formules-formulas"])
        self.assertEqual(chunks[0]["source_urls"], ["https://a.example/one", "http://b.example/two"])
        self.assertEqual(chunks[1]["source_urls"], ["https://a.example/one"])
        self.assertNotIn("Sources", " ".join(c["title"] for c in chunks))


class WholeIndex(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.chunks = bi.build(bi.KB)

    def test_ids_are_unique(self):
        ids = [c["id"] for c in self.chunks]
        self.assertEqual(len(ids), len(set(ids)))

    def test_every_chunk_has_a_source_and_text(self):
        for c in self.chunks:
            self.assertTrue(c["source_urls"], c["id"])
            self.assertTrue(c["text"].strip(), c["id"])
            self.assertLessEqual(len(c["text"]), bi.MAX_CHARS, c["id"])

    def test_covers_every_entity_type_and_the_fundamentals(self):
        kinds = {c["kind"] for c in self.chunks}
        self.assertTrue({"concept", "procedure", "fault", "rule", "scenario", "glossary", "fundamentals"} <= kinds)


if __name__ == "__main__":
    unittest.main()
