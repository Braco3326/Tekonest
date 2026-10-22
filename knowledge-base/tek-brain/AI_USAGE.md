# TEK Brain for AI: retrieval, citation and exam rules (A5)

The retrieval index lets the TekPractice coach (ADR-0006) and the learning-site tutor answer from TEK Brain and cite what they used. It contains **only the knowledge base's own words**: TEK Brain records and the run-1 fundamentals explainers. No copyrighted text from manuals, books or standards is indexed. Each chunk carries the URLs of the sources that back it.

## Files

| File | What |
|---|---|
| `index/chunks.jsonl` | One JSON object per line (1,832 chunks at build time) |
| `index/manifest.json` | Count per kind, build date, sha256 of `chunks.jsonl` |
| `../tools/build_index.py` | Rebuilds the index (stdlib, tested by `tools/tests/test_build_index.py`) |

Chunk fields: `id`, `kind` (concept, skill, procedure, rule, fault, scenario, glossary, fundamentals), `ref` (the record or fundamentals id), `domain`, `title`, `text` (≤ 1,200 characters, French with English terms), `source_urls[]`, `concept_ids[]`, `lang`.

Chunk ids are stable while the record id is stable:
- `concept:inverse-square-law`
- `procedure:line-check#2` (second part of a long record)
- `fund:02-decibels-gain-staging:formules-formulas`

Rebuild after any KB change:
```
python knowledge-base/tools/validate_tekbrain.py --strict
python knowledge-base/tools/build_index.py
python -m unittest discover -s knowledge-base/tools/tests
```

## How to retrieve

1. **Start from what the learner is doing, not from free text.** In TekPractice that is the rule that fired (R1–R8 or a proposed rule), the devices involved and the current graph.
   - Map a catalog rule to its TEK Brain mirror: the record in `rules/*.json` whose `catalog_rule` equals the R-id.
   - Take that rule's `concept_ids`, then the faults and procedures that list the rule in `rule_ids`.
   - Chunks whose `ref` or `concept_ids` hit that set are the candidate context.
2. **Then rank by text.** Keyword or BM25 ranking over `title` and `text` is enough at this size; embeddings are optional later. Keep the top 3–6 chunks, at most about 4,000 characters of context.
3. **Prefer reviewed content.** Records labelled `needs-oscar-review` in the KB (regulation, safety, exam-like statements) may be used, but the answer must state the limit (for example « à vérifier sur le texte officiel ») and never present them as exam facts.

## How to cite

- The model may cite only chunks it was given, as `[kb:<chunk id>]`, for example `[kb:concept:phantom-power]`. It may also cite `[R1]`…`[R8]` and `[catalog:<id>]` as today.
- At least one citation per answer. A reply citing a chunk id that was not in its context is rejected, the same rule `validateReply` applies to rules and devices today.
- The UI can turn `[kb:…]` into a link to the KB record and its `source_urls`. Learners see the real source (EBU, manufacturer manual, Légifrance…), never only "the AI said so".

## Pedagogy rules (non-negotiable)

1. **Exam mode: the coach says nothing.** No hint, no explanation, no citation and no "Pourquoi ?" button (ADR-0006: `examMode` hides the coach). This rule overrides everything below.
2. **Socratic outside exams.** Explain the physical or professional *why*, then ask one or two guiding questions. Never name the exact port to plug or the exact action to take; the learner finds it.
3. **Grounded only.** No fact, device, value or regulation that is not in the given chunks or catalog context. If the context is not enough, say so.
4. **French first.** Keep English technical terms in parentheses, as the KB does.
5. **Safety and regulation.** For hearing limits, electrical safety and rigging, quote the KB value with its source and recommend checking the official text. Never improvise a threshold.

## Learning site (tutor)

The same chunks feed the site tutor. The tutor may answer course questions in "learn" mode (still grounded and cited), but must refuse to solve graded exercises or past-paper questions in an assessment context. That mirrors exam mode.
