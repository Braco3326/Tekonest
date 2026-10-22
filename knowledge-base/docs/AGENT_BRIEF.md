# Research agent brief (equipment files)

Repo root: `C:\Users\brro\dev\Tekonest`. You write ONE file: `knowledge-base/equipment/<your-file>.json`. Do not touch any other file. Do not run git.

## Non-negotiable rules
1. **Every URL you write must have appeared in one of your own tool results this session** (a WebSearch result or a page you fetched). Never write a URL from memory, never "guess" a manufacturer URL pattern. If you could not find it: `"not found"`.
2. **Every spec value must come from a page you actually read.** Copy the value with its units as the source states it (e.g. `"20 Hz – 20 kHz"`, `"-37.9 dBV/Pa (12.7 mV/Pa)"`). Do not compute, round or translate numbers. No spec from memory, even if you are sure.
3. Source priority: manufacturer page / official datasheet / manual (`verified-primary`) > standards body (AES/EBU/ITU/IEC) > official French education > reputable trade press, textbooks, large retailers like Thomann / Sweetwater / B&H (`verified-secondary`) > forums (`unverified`, flagged in notes).
4. Cross-check key specs (polar pattern, frequency response, connectors, phantom power, sample rates, I/O counts, power) against a second source when you can (a second manufacturer document such as the PDF manual counts, and so does a major retailer spec page). If values disagree, record both in `conflicts` and do not pick one silently.
5. `sources[].covers` lists exactly which fields that source supports, e.g. `["key_specs.frequency_response", "key_specs.polar_pattern", "connectors", "status"]`.
6. Manuals: find the OFFICIAL manufacturer user manual and datasheet (PDF or official web manual). Prefer a French version when one exists, and add English too. List all of them in `manuals[]`. Set `manual_url` to the French one if it exists, otherwise English. Never link third-party manual mirrors (manualslib etc.) as official. If you find only one of those, log it in `not_found_log` and leave `manual_url` "not found".
7. `year_introduced`: integer only if a source states it (secondary sources are fine, but add them to `sources` with covers `["year_introduced"]`); otherwise `"not found"`.
8. Do not copy long text from manuals or pages. `why_it_is_a_classic` and `notes` are your own short sentences (1–3 sentences). Only state claims a source supports ("industry standard" claims need a source, e.g. a trade-press article or the manufacturer's own claim, and the wording should say who claims it).
9. Real, existing models only. Choose the industry's reference "classic / must-know" models and cover EVERY sub_type assigned to you. Prefer gear common in French schools, studios, theatres, radio (Radio France, etc.) and live venues, plus gear cited in BTS MAV exams. Quality over count: if you run short on time, deliver fewer, fully sourced devices.
10. Access date for everything: `2026-10-22`.

## Ids and vocab
- `id`: kebab-case `brand-model`, e.g. `neumann-u87-ai`, `shure-sm58`. If the device exists in TekPractice `tekpractice-sim/content/catalog.json`, use EXACTLY its catalog id and set `tekpractice.in_catalog: true, catalog_id: "<id>"`. Existing catalog ids: yamaha-ql1, yamaha-rio3224-d2, shure-sm58, shure-sm57, qsc-k12-2, yamaha-dbr12, km-210-9, axia-iq, ev-re20, yellowtec-mika, yellowtec-litt, genelec-8030c, playout-pc, aeta-scoop5-s, aeta-scoopy-plus-s, ev-re50, avid-protools-hdx, avid-hd-io, focusrite-isa-one, grace-m905, neumann-u87-ai, switchcraft-studiopatch-9625, antelope-ocx-hd, mogami-gold-db25-xlrm.
- `category` / `sub_type`: from `knowledge-base/taxonomy.json` only. Read it first.
- `connectors[].connector` and `signal_types[]`: use the TekPractice ids (`tekpractice_connector_ids_existing`, `tekpractice_signal_ids_existing` in taxonomy.json) or the `proposed_connector_ids` / `proposed_signal_ids`. If you need an id that does not exist, use the closest one and explain it in `notes`. Do not edit taxonomy.json.
- `tekpractice.sim_value`: high/medium/low, plus a one-line reason, showing how useful the device would be as a TekPractice wiring device (distinctive connectors or signal lessons = high).

## File format
```json
{
  "file": "<your-file>.json",
  "category": "<taxonomy category id>",
  "generated": "2026-10-22",
  "selection_rationale": "why these models, 2-4 sentences",
  "not_found_log": [ { "device_id": "x", "what": "French manual", "searched": "neumann.com downloads, search 'U 87 Ai mode d emploi'" } ],
  "devices": [
    {
      "id": "neumann-u87-ai",
      "brand": "Neumann",
      "model": "U 87 Ai",
      "category": "microphones",
      "sub_type": "condenser-large-diaphragm",
      "technology": "Pressure-gradient large-diaphragm condenser, transformerless? (state only what source says)",
      "year_introduced": 1986,
      "status": "current",
      "why_it_is_a_classic": "...",
      "typical_uses": ["vocals", "voice-over", "..."],
      "key_specs": { "polar_pattern": ["omnidirectional", "cardioid", "figure-8"], "frequency_response": "...", "sensitivity": "...", "max_spl": "...", "impedance": "...", "phantom_power": "...", "weight": "...", "dimensions": "..." },
      "connectors": [ { "connector": "xlr3-m", "role": "mic output", "dir": "out", "signal": "mic-level", "count": 1 } ],
      "signal_types": ["mic-level", "phantom-48v"],
      "manual_url": "https://… (from your tool results)",
      "datasheet_url": "https://…",
      "product_page_url": "https://…",
      "manual_languages": ["en", "fr"],
      "manuals": [ { "url": "https://…", "title": "Operating manual", "language": "fr", "file_type": "pdf", "version_or_date": "as shown or 'not shown'", "official": true, "kind": "user-manual" } ],
      "sources": [ { "url": "https://…", "publisher": "Neumann", "accessed": "2026-10-22", "confidence": "verified-primary", "kind": "manufacturer", "covers": ["key_specs.frequency_response", "key_specs.polar_pattern"] } ],
      "notes": "",
      "conflicts": [ { "field": "key_specs.max_spl", "values": [ { "value": "117 dB", "source_url": "https://…" }, { "value": "127 dB", "source_url": "https://…" } ], "note": "different THD reference (0.5% vs pre-attenuation)" } ],
      "tekpractice": { "in_catalog": true, "catalog_id": "neumann-u87-ai", "proposed_new_connectors": [], "proposed_new_signals": [], "sim_value": "high", "sim_value_reason": "phantom power lesson R4" }
    }
  ]
}
```
(The example values above are illustrative; never copy them, research them.)

## Before you finish
Run `python knowledge-base/tools/validate.py --file <your-file>.json` from the repo root and fix every ERROR. Then reply with a short report: device count by sub_type, the number of devices with an official manual found, the number with a two-source cross-check, conflicts found, and anything you could not find. Keep the report under 250 words.

## Search budget (important)
WebSearch is capped for the whole session (200 calls, shared by all agents, refilling at about 100 per hour) and is often exhausted. Do not scrape search engines with curl and do not use proxy or reader services. Work mostly with WebFetch: start from the manufacturer's homepage or a known product page, download centre or `sitemap.xml`, and follow the links on the fetched pages (links seen in fetched pages count as tool-result URLs). Spend WebSearch calls only on what you cannot reach by navigation (at most about 10 per agent). If a search is refused, log the item with `searched: "search budget exhausted"`.

## Practical tips
- Manufacturer sites sometimes block fetches (403) or render via JS. Try the PDF datasheet URL from search results, the manufacturer's download centre, or a retailer page as the secondary source. If a page is blocked, you may still cite a URL that appeared in search results, but mark the source `confidence` based on what you could actually read (a search snippet alone counts as `verified-secondary` at most, and only for the values visible in the snippet).
- Work device by device and write the file incrementally (write after every few devices) so nothing is lost if you run out of context.
