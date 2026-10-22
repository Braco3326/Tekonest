# QA spot-check — 2026-10-22

Sample: 30 devices drawn with seed 20261022, plus 6 drawn with the same seed from the microphone and recorder files (2 each from microphones-condenser, microphones-dynamic-ribbon and recorders-playback). Total: 36 devices.

Method: I re-fetched every URL each record cites (sources, manual_url, datasheet_url, product_page_url): 131 URLs in all. HTML pages and PDFs were fetched with python requests and the PDF text was extracted with pypdf. Pages that returned 403 or 429 were retried with WebFetch (Adobe, UA, AKG). For each device I compared 3 to 5 key_specs word for word with the source. I also opened and identified the manual and datasheet, compared the status with the manufacturer page, and checked that each cited source supports the fields it claims to cover. Machine-readable results are in `spot-check.json`.

## Results

| Overall | Count |
|---|---|
| pass | 28 |
| minor-issues | 7 |
| fail | 1 |

- **Strict pass rate: 28/36 = 77.8 %.** Including minor issues: 35/36 = 97.2 %.
- Field verdicts (175 fields checked): 170 match, 3 partial, 1 mismatch, 1 unreachable.
- No spec value contradicted its cited source. The one mismatch is a lifecycle **status**.

| # | File | Device | Overall | Note |
|---|---|---|---|---|
| 1 | processors-dynamics-eq | dbx-160a | pass | discontinued confirmed |
| 2 | loudspeakers | db-audiotechnik-y10p | pass | FR manual 1.3 OK |
| 3 | di-splitters | palmer-pan-01 | pass | |
| 4 | broadcast-radio | clear-com-ms-702 | pass | |
| 5 | interfaces-converters-clocks | focusrite-scarlett-2i2-4th-gen | pass | |
| 6 | consoles-analog | soundcraft-signature-12-mtk | pass | discontinued confirmed |
| 7 | consoles-analog | allen-heath-zed-436 | pass | |
| 8 | accessories-mounting | km-210-9 | minor-issues | unsourced white SKU; manual language |
| 9 | processors-dynamics-eq | ssl-the-bus-plus | pass | |
| 10 | software | adobe-audition | pass | prices confirmed via WebFetch |
| 11 | loudspeakers | l-acoustics-x8 | pass | |
| 12 | cables-connectors | neutrik-nc3mxx | pass | |
| 13 | broadcast-radio | aeta-scoop5-s | pass | listed under "Anciens produits" |
| 14 | cables-connectors | mogami-w3080 | pass | max-length table ambiguous (partial) |
| 15 | cables-connectors | sommer-sc-mistral-mcf08 | pass | |
| 16 | consoles-digital | lawo-ruby | **fail** | status wrong |
| 17 | patchbays | switchcraft-studiopatch-9625 | pass | status from a retailer only |
| 18 | processors-dynamics-eq | universal-audio-teletronix-la-2a | minor-issues | manual hosted by a retailer |
| 19 | stageboxes-networking | yamaha-rio3224-d2 | pass | discontinued confirmed |
| 20 | patchbays | neutrik-nys-spp-l1 | pass | |
| 21 | measurement-tools | rtw-touchmonitor-tm7 | pass | cosmetic attribution fix |
| 22 | broadcast-radio | riedel-bolero | minor-issues | beltpack source is a discontinued SKU |
| 23 | processors-effects | bricasti-design-m7 | pass | |
| 24 | wireless-systems | sennheiser-ew-dx-em-2 | pass | |
| 25 | processors-effects | yamaha-spx2000 | pass | discontinued confirmed |
| 26 | cables-connectors | neutrik-nl4fxx-w-s | pass | |
| 27 | interfaces-converters-clocks | mutec-mc-3-plus | pass | |
| 28 | broadcast-radio | yellowtec-litt | minor-issues | document language "not stated" |
| 29 | consoles-analog | yamaha-mg10xu | minor-issues | no product page; status from a retailer |
| 30 | measurement-tools | nti-audio-xl3 | pass | |
| 31 | microphones-condenser | sennheiser-mkh-50 | pass | |
| 32 | microphones-condenser | neumann-tlm-107 | pass | |
| 33 | microphones-dynamic-ribbon | akg-d112-mkii | minor-issues | retailer-only sourcing |
| 34 | microphones-dynamic-ribbon | royer-r-121 | pass | |
| 35 | recorders-playback | sound-devices-mixpre-6-ii | minor-issues | manual hosted by a third party; no product page |
| 36 | recorders-playback | sound-devices-833 | pass | |

## Mismatches (must fix)

1. **consoles-digital.json / lawo-ruby: `status`**
   - Current value: `current`
   - Correct value: `discontinued`
   - Source: https://lawo.com/products/ruby/ (the same page the record cites for status) says: "This product is no longer available. Ruby has been replaced by the Lawo diamond Modular Broadcast Console."
   - Also add a note naming diamond as the successor.

## Partial or unverifiable items and recommended fixes

2. **accessories-mounting.json / km-210-9**
   - `key_specs.article_number` lists `21090-326-76 pure white`, but no cited source shows it. The product page and datasheet show only 21090-300-55 (black). The installation instructions list -300-02 (chrome) and -300-87 (basalt grey). Remove the white SKU or source it. Source: https://www.k-m.de/media/ab/ac/71/1790942461/Aufstellanleitung_838b6c74f7bc5fcbb2aecaca44b445b8.pdf?ts=1790942461
   - `manuals[0].language`: change `de` to `multi` (de+en). The installation instructions are bilingual.
3. **processors-dynamics-eq.json / universal-audio-teletronix-la-2a: `manuals[0].url`**
   - The current copy is a retailer-hosted file: https://www.adorama.com/col/productManuals/UALA2AD.pdf. The content is UA's genuine manual.
   - Replace it with a copy hosted by UA and set `manual_url`. If UA hosts no copy, set `official: false`.
4. **broadcast-radio.json / riedel-bolero: `sources[1]`**
   - All `beltpack_*` specs cite https://www.riedel.net/produkt/intercom/bolero/bolero-6-key-beltpack-standard-1-9ghz/, a page for SKU 1430020 that is marked **Discontinued**.
   - Re-source these specs from the current beltpack variant, or add a note that they come from the discontinued Standard 1.9 GHz beltpack.
5. **broadcast-radio.json / yellowtec-litt: `manuals[0].language` and `manuals[2].language`**
   - Change `not stated` to `en`.
6. **consoles-analog.json / yamaha-mg10xu: `product_page_url`**
   - Change `not found` to the official Yamaha MG10XU page.
   - Status is currently backed only by https://www.thomannmusic.com/yamaha_mg10_xu.htm and a generic series index. Re-derive it from the Yamaha model page.
7. **microphones-dynamic-ribbon.json / akg-d112-mkii**
   - The only source is a retailer: https://www.thomann.fr/akg_d_112_mkii.htm. Its values (cardioid, 20–17,000 Hz, 210 Ω, 320 g, 150×70×115 mm) agree with the KB.
   - No manufacturer verification was possible: akg.com returned HTTP 403.
   - Add an AKG product page and spec sheet, then fill `sensitivity` and `max_spl`, which are currently "not found".
8. **recorders-playback.json / sound-devices-mixpre-6-ii**
   - `product_page_url`: change `not found` to https://www.sounddevices.com/product/mixpre-6-ii/. I verified this page (HTTP 200, no discontinued marker).
   - `manual_url`: the only manual is a third-party re-host at https://sites.bu.edu/ftpc/files/2025/08/SoundDevices_MixPre368manual.pdf (Sound Devices MixPre II User Guide v9.01; the specs match). Replace it with the official Sound Devices user guide.
9. **Cosmetic, overall stays pass:**
   - rtw-touchmonitor-tm7 `key_specs.power` says "Binder 710 per product page". It should say "per data sheet".
   - mogami-w3080 `max_suggested_length` relies on a table with merged cells. The 150 m reading is plausible but ambiguous.

## Manual and datasheet checks

- Every manual_url and datasheet_url that was present opened (HTTP 200), was the manufacturer's document for the right model, and was in the stated language. The exceptions are the language labels in items 2 and 5.
- The RTW manual is a ZIP. It returned HTTP 200 and was not opened.
- Shared multi-model manuals are correctly used and do cover the model: d&b Y7P/Y10P, Soundcraft Sig 10/12/12MTK, A&H ZED-420/428/436, K&M multi-stand sheet.
- SSL's file is named `The_Bus_User_Guide_1.1.pdf`, but its cover reads "THE BUS+", so it is correct.
- Two `datasheet_url` values point to HTML spec pages rather than documents: Bricasti `m7_specs.php` and Yamaha SPX2000 `specs.html`. This is acceptable but inconsistent with the field name.

## Patterns

- **Status is the weakest field.** The only hard error is a "current" device whose own cited page says it was replaced (Lawo ruby). Three more records (Switchcraft 9625, Yamaha MG10XU, AKG D112 MKII) base "current" on retailer stock pages, not manufacturer pages. Recommendation: derive status only from manufacturer pages and grep them for "no longer available", "discontinued", "replaced by", "Anciens produits" and "Old range".
- **Status can differ between a system and its parts.** Riedel Bolero (system current, cited beltpack SKU discontinued) and Royer (R-121 current, "R-121 Live" discontinued) show that a discontinued marker on a page may belong to a variant or a "similar products" tile. The K&M page was a false positive of this kind. Check which product the marker belongs to before acting on it.
- **Retailer and third-party hosting is the main sourcing weakness, not the values.** Every retailer-sourced or re-hosted spec I checked still matched the manufacturer text (Thomann, Markertek, FrontEndAudio, the Adorama-hosted UA manual, the BU-hosted Sound Devices manual). I saw no retailer-derived spec drift in this sample. The problem is provenance: AKG D112 MKII has no manufacturer source at all, and two manuals are third-party copies.
- **Manufacturer-sourced records were near-perfect.** No spec value taken from a manufacturer page or PDF disagreed with that source.
- **Language metadata is sometimes left as "not stated" or recorded too narrowly** (Yellowtec, K&M) even though the document language is obvious.
