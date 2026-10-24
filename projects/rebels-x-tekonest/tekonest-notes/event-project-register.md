# Audit — `event-project/` (Tekonest / Techonest)

Audited 2026-10-21, read-only. Root: `event-project/`. All paths below are relative to that root.
Name note: files use "Techonest"; README says the name going forward is "Tekonest". 05 lists the spelling variants Techonest, Technonest, Technest, "Thechnest".

---

## A. Source list

| # | Path | Date | Description | Author type |
|---|---|---|---|---|
| S1 | `README.md` | Status line 21 Oct 2026 | Overview: idea, team, phases, pilot proposal, ground rules, gates A–E, open decisions, file index, rebuild instructions | AI-written synthesis of founder statements and later proposals (deck v2 numbers) |
| S2 | `docs/01-legal-structure-guide.md` | 20 Oct 2026 | Legal structures in France, titre de séjour, Rebels public profile, event rules, ranking, 300-ticket numbers check, questions for professionals | AI research + AI judgment ("my judgment"), citing official/secondary sources; restates founder inputs in an "assumptions" table |
| S3 | `docs/02-meeting-brief.md` | 20 Oct 2026 | Pre-read for Gabriel and Ahmad: five-minute summary, Rebels models 1–3, known/assumed/to-validate, decisions, 90-min agenda | AI-written, phrased in the founder's voice ("I will bring…") |
| S4 | `docs/03-working-project-plan.md` | 20 Oct 2026 | Detailed plan A–I: vision, evidence, project model (services table), governance, legal gates 1–4, financial plan (v1 scenarios), 30/60/90, risks, decision sheet | AI-written proposals/recommendations; facts sourced |
| S5 | `docs/04-deck-companion-notes.md` | 21 Oct 2026 | Decisions table, change log (deck v1→v2), assumption register, source list with page dates | AI-written |
| S6 | `docs/05-everything-explained.md` | 21 Oct 2026 (covers chat 20–21 Oct + "saved notes") | Record of founder statements only, plus 8 self-contradictions and 15 open gaps | AI-compiled record of founder statements (best source for founder claims) |
| S7 | `presentation/Techonest_Vision_and_Project_Plan.pptx` | 21 Oct 2026 (cover) | Deck v2: 35 slides (26 main + 9 appendix), speaker notes on every slide, 2 native charts | AI-written; built by build.js |
| S8 | `presentation/Techonest_Vision_and_Project_Plan.pdf` | file mtime 21 Oct 14:45 | PDF render of the deck: **35 pages = 35 pptx slides (matches)** | Export |
| S9 | `presentation/pptx-source/build.js` | 21 Oct 2026 (footer string) | 724-line pptxgenjs script; theme "Techonest Night"; hard-coded slide text and notes; writes to a scratchpad path and calls `applyTheme` from `/mnt/skills/public/pptx/scripts/apply_theme.js` (not portable, as README says) | Code (AI) |
| S10 | `presentation/slides-web/` (`deck.json` + 23 HTML slides) | deck.json `createdOnFiles` 2026-10-20T21:30Z | Earlier 23-slide web deck (v1). Uses v1 numbers (≈155 break-even, +240 expected, day −10 rule, models 0–3) | AI-written, superseded |
| S11 | `model/pilot_model.py` | undated (numbers match 21 Oct deck) | Python financial model for one night; prints only, writes no files | Code (AI) |

Outputs of S11 (run 2026-10-21, `python3 model/pilot_model.py`):
```
Cautious 110×€12: gross 1320, VAT 220, fees 66, SACEM 106, CNM 39, net 890, fixed 2130 (venue 400, 3×350), contrib −1240, BE 263
Base     180×€15: gross 2700, VAT 450, fees 135, SACEM 216, CNM 79, net 1820, fixed 2130 (4×350), contrib −310, BE 211
Strong   250×€18: gross 4500, VAT 750, fees 225, SACEM 360, CNM 131, net 3034, fixed 2530 (5×350), contrib +504, BE 208
net/ticket: 15@20% 10.11 · 15@5.5% 11.77 · 12@20% 8.09 · 18@20% 12.13
sensitivity (base fixed 2130; tickets 120/150/180/210/250):
  €12 [-1159,-916,-674,-431,-107] BE 263 · €15 [-916,-613,-310,-6,398] BE 211 · €18 [-674,-310,54,418,904] BE 176
pay 250 → +90 BE 171 · pay 350 → −310 BE 211 · pay 460 → −750 BE 254
VAT 5.5% → −11 BE 181
lean (150×€15, 3 paid, no security, no gear, mkt 150): contrib +237, fixed 1280, BE 127
aspiration night 300×€15 free venue → +504 (gross 4500); with €800 hire → −296
aspiration gross per month 13500, per year 162000
setup 500 · cash before base 930 · max exposure base 2630 · cancel at D−14 sunk 780
```

---

## B. Evidence register

Type key: **FS** founder statement/decision (only where S6 or another doc attributes it to the founder) · **P** proposal · **R** research finding (cited source) · **E** estimate · **IF** implementation fact · **I** inference.

| ID | Claim | Source | Date | Type |
|---|---|---|---|---|
| EV-01 | Techonest is a brand/project idea created by the founder, not necessarily a registered entity, based in Paris | S6 "Identity" | 20 Oct | FS |
| EV-02 | Core idea: connect technicians and give opportunities to technicians who don't find work and love événementiel | S6 "Identity" | 20 Oct | FS |
| EV-03 | Fields covered: filming, editing, marketing, sound, image, DJs, musicians | S6 "Identity" | 20 Oct | FS |
| EV-04 | Belief: "diversity creates richness and harmony" | S6; S1 §1 | 20 Oct | FS |
| EV-05 | Cultural focus: mostly Arab culture from the Middle East to Morocco, and Paris, but also Afro and others; "all of the world's cultures and art" | S6 | 20 Oct | FS |
| EV-06 | Long-term shape restated: two connected parts — event/cultural-programming identity + trusted network for paid creative/technical projects | S6 (rebuild brief); S1 §1; S7 slide 3 | 21 Oct | FS (restated in rebuild brief) |
| EV-07 | Ethics: fairly paid opportunities and useful professional experience for artists and technicians | S6 (rebuild brief) | 21 Oct | FS |
| EV-08 | Nights↔network loop (paid slots/credits/footage ↔ skills/new acts/audiences) is a hypothesis to test at the pilot | S7 slide 3 + notes; S1 §1 | 21 Oct | P / I |
| EV-09 | Problem statements (Paris rarely mixes Arab/Afro/electronic; young technicians struggle to get paid work) are hypotheses, not measured facts; no traceable demand statistic found | S3 "What Techonest is"; S7 slide 4; S5 "Sources" | 20–21 Oct | I (explicitly unverified) |
| EV-10 | Four cultural principles: artists curate; context not costume; rehearsed real collaborations; fair pay part of the art | S7 slide 5 | 21 Oct | P |
| EV-11 | Illustrative night: 20:00 doors → 21:00 live voice+percussion → 22:15 crossover → 23:00 Afro-house/electronic DJ → film, edit, credit crew | S7 slide 6 | 21 Oct | P |
| EV-12 | First audiences (hypotheses): Rebels' house/Afro-house crowd; followers of Arab/MENA live music; students/creatives | S7 slide 7; S4 §G | 20–21 Oct | P |
| EV-13 | Evidence ladder: interest form (weak) < waitlist < free reservation < paid presale (only one counted for go/stop) | S7 slide 7 | 21 Oct | P |
| EV-14 | Creator pathway, 8 steps: discovery → selection → briefing → contract/pay → night → credits/footage → feedback → next opportunity | S7 slide 8 | 21 Oct | P |
| EV-15 | Oscar: gérant; plays, sings, DJs, mixes, all-round technician; could be hired by Techonest | S6 "People" | 20 Oct | FS |
| EV-16 | Founder name "Oscar" to be verified before documents are shared | S6; S5; S7 slide 28 notes | 21 Oct | FS (brief) / open |
| EV-17 | Ahmad: cofounder, singer and percussionist, rich Middle Eastern musical background | S6 | 20 Oct | FS |
| EV-18 | Ahmad leading the live set is a suggestion only; he has not agreed to perform | S7 slide 6 notes; S10 pilot.html | 21 Oct | P |
| EV-19 | Gabriel: cofounder; GrooveBox | S6 | 20 Oct | FS |
| EV-20 | Gabriel's Rebels role creates a conflict-of-interest question in any Techonest–Rebels deal | S6 (rebuild brief) | 21 Oct | FS |
| EV-21 | Gabriel and Ahmad agreed cofounders ("yes"); responsibilities and time open | S6; S5 register | 20–21 Oct | FS |
| EV-22 | Rebels Collectif public profile: Paris house/Afro-house DJ collective & label by Play House and GrooveBox; Shotgun ticketing; site modified 9 Mar 2025 | S2 "Rebels"; S7 slide 10 — rebelscollectif.com | 20 Oct | R |
| EV-23 | Rebels 2025 nights: Le Klub (10 Oct 2025), L'Impasse (13 Jun 2025), Titi Palacio, La Récolte Citadine (spring 2025); very few RA followers | S2; S7 slide 10 — ra.co/promoters/159396 | 20 Oct | R |
| EV-24 | No registered legal entity / SIREN / mentions légales found for Rebels; not to be confused with "REBELLES" (Paris 6e) or Paris Country Rebels | S2; S7 slide 10 notes — societe.com, net1901 | 20 Oct | R |
| EV-25 | GrooveBox's photo file is named "gab", "consistent with Gabriel" | S2 "Rebels" | 20 Oct | I |
| EV-26 | Founder said Rebels is an association/collective; plans to associate with them for 2026–27; partnership not to be assumed | S6 "People" | 20 Oct | FS |
| EV-27 | Nothing agreed with Rebels; no evidence Rebels has agreed to collaborate | S1 status; S3; S7 slides 1, 10 | 20–21 Oct | IF (status) |
| EV-28 | Rebels models (deck v2): A Rebels leads (fee to Techonest) · B co-production with one named legal organiser · C Techonest leads (Rebels DJs booked as artists) | S7 slide 11 | 21 Oct | P |
| EV-29 | Deck proposes model B; a Rebels person other than Gabriel (e.g. Play House) negotiates for Rebels | S5 decisions #4; S7 slide 11 | 21 Oct | P |
| EV-30 | Earlier numbering: 1 Rebels produces · 2 Techonest produces · 3 co-production; plan recommends 3 (or 1 if no structure); model 0 = don't organise, Oscar/Ahmad take paid gigs at Rebels nights (fallback) | S3; S4 §C, §I.3; S10 models.html | 20 Oct | P |
| EV-31 | CNM: holder of the ticketing is the single declarant even in co-productions | S7 slide 11 notes, slide 32 — cnm.fr/taxe | 21 Oct | R |
| EV-32 | Pilot format: live voice/percussion → rehearsed crossover → DJ programme | S1 §4; S7 slide 12 | 21 Oct | P |
| EV-33 | Pilot size 120–200 people; Feb–Mar 2027; lean staffing 3 paid + venue staff; venue with own sound/security, bar-share, cancellation terms; two-tier paid presale | S1 §4; S7 slide 12 | 21 Oct | P |
| EV-34 | Venue preference: clubs and rented halls (salles) | S6 | 20 Oct | FS |
| EV-35 | Budget cap €1,000 maximum at risk | S1; S4 "decisions first"; S7 slides 12, 17, 25 | 20–21 Oct | P (based on FS €1,000) |
| EV-36 | Founder can put in €1,000 personally; prefers to start with no budget "because we can" | S6 "money" | 20 Oct | FS |
| EV-37 | Go/stop v2: D−28 sales open; D−14 paid presales ≥ 50 % of break-even else cancel/downsize; D−3 ≥ 75 %; night contribution ≥ €0 after everyone paid | S1 §4; S7 slide 13; S5 change log | 21 Oct | P |
| EV-38 | Lean thresholds: BE ≈127 → D−14 ≈64, D−3 ≈95 tickets | S7 slide 13 notes | 21 Oct | E |
| EV-39 | Cancel by D−14 costs ≈ €380 (setup ≈200 + marketing ≈100 + insurance ≈80) + contract cancellation fees | S7 slide 13; S5 change log | 21 Oct | E |
| EV-40 | Base case 180×€15: gross €2,700, net €1,820, costs €2,130, contribution −€310 | S7 slides 14–15; model output | 21 Oct | E / IF (model reproduces) |
| EV-41 | Four scenarios: Cautious −1,240 (BE≈263), Base −310 (≈211), Strong +504 (≈208), Lean +237 (≈127) | S7 slide 15; S1 §4 (127, 211); model | 21 Oct | E / IF |
| EV-42 | Net receipts per ticket at 20 % VAT: €12→8.09, €15→10.11, €18→12.13; €15 at 5.5 %→11.77 | S7 slides 15, 33; model | 21 Oct | IF |
| EV-43 | Sensitivity at 180×€15: pay €250→+90 (BE 171), €460→−750 (BE 254), 5.5 % VAT→−11 (BE 181); BE €12/15/18 = 263/211/176 | S7 slide 16; model | 21 Oct | IF |
| EV-44 | Model inputs: SACEM ≈8 % (placeholder), ticketing ≈5 %, CNM 3.5 % excl. VAT, pay ≈€350 (range 250–460), security €300, marketing €150–250, insurance €80, gear €0–150, setup ≈€200 | S7 slide 33; S5 register; S11 constants | 21 Oct | E (CNM/VAT = legal rates) |
| EV-45 | Cash/exposure: setup ≈€200; cash out before night ≈€630; base worst case ≈€2,330; lean shared 50/50 worst case ≈€840 — only configuration fitting €1,000 | S7 slide 17 | 21 Oct | E |
| EV-46 | v1 plan scenarios (superseded): Cautious 100×12 −1,221 (BE≈251), Expected 180×15 +240 (≈156), Ambitious 280×18 +1,468 (≈159), pay €300 | S4 §F; S10 numbers.html | 20 Oct | E (superseded) |
| EV-47 | v1 headline: ≈155 tickets break-even with free venue + 3 paid; 260–300 with hire + 5 paid; half-full night can lose >€1,000; worst ≈€1,200 + €600 setup ≈€1,800 | S3 "numbers"; S4 §F; S10 breakeven/riskcap | 20 Oct | E (superseded) |
| EV-48 | Founder target: 3 events/month, 300 tickets/event, avg €15 → €13,500/month | S6 "Activities" | 20 Oct | FS |
| EV-49 | €13,500/month = gross ticket sales, not income (≈€162,000/yr); "aspiration, not a forecast" | S1 §4; S2 red flag 4; S7 slide 18 | 20–21 Oct | I / E |
| EV-50 | One 300×€15 night: +€504 free venue, −€296 with €800 hire (deck); legal club case −€286, free venue + 5.5 % VAT +€1,211, 150 tickets −€1,803, "current plan" (volunteers, no VAT) +€2,478 (legal guide) | S7 slide 18; S2 "Numbers check" | 20–21 Oct | E |
| EV-51 | Money purpose: pay study fees "when everything goes as planned"; profits recycled into projects | S6 | 20 Oct | FS |
| EV-52 | Study-fee amount not given; deck leaves formula blank (fees ÷ net pay per night) | S6 gaps; S7 slide 18 | 21 Oct | IF (gap) |
| EV-53 | Technicians: unpaid (bénévolat) when an event does badly, a percentage when it does well, via a chart and règlement intérieur | S6 "People" | 20 Oct | FS |
| EV-54 | Docs replace that with: on paid nights everyone is paid; no unpaid or percentage work; no profit shares; written fair-pay policy | S1 §5; S3 "One rule"; S4 §A tensions, Gate 3; S7 slides 5, 24, 25 | 20–21 Oct | P (team policy) + R (legal basis) |
| EV-55 | Volunteers allowed only in non-profits; only real expenses refunded; percentage pay = pay → requalification / travail dissimulé | S2 red flag 2 — DREETS bénévolat PDF; Associathèque pseudo-bénévolat | 20 Oct | R |
| EV-56 | Paid performers presumed employees (Code du travail L7121-3); an invoice does not avoid this | S2 "Rules"; S4 §B — Unédic circular | 20 Oct | R |
| EV-57 | Unpaid amateurs in a lucrative show only with convention, declaration 2 months ahead and caps (5 performances, 10 %, 10/amateur/12 months); technicians cannot be amateurs | S7 slide 30 notes — Ministère de la Culture amateurs page | 21 Oct | R |
| EV-58 | Licence v1: above 6 performances/year the entrepreneur de spectacles declaration is mandatory; receipt valid 5 years; number on tickets | S2; S3; S4 — Artcena; Culture.gouv | 20 Oct | R |
| EV-59 | Licence v2: if live shows are the principal activity, declare ≥1 month before the **first** show; 6-show allowance only for accessory activity | S1 §5; S7 slides 20, 30 — L7122-3; Culture PLATESV fiche 4.2 | 21 Oct | R |
| EV-60 | Declarant qualification: bac+2/120 ECTS, 6 months' live-show experience, or 125 h training; categories 1/2/3 | S7 slide 30 — Culture fiches notices | 21 Oct | R |
| EV-61 | GUSO v2: reserved for employers whose principal activity is not shows; covers live-show artists (cachet) and technicians (hours) only — not filming/editing/marketing | S7 slides 8, 20, 30 — guso.fr (21 Oct) | 21 Oct | R |
| EV-62 | GUSO v1: free single payroll for occasional organisers (≤6 shows); "everyone paid through GUSO", including Oscar within 964 h | S2 Recommendation §3; S4 Gate 3 — Associathèque focus; justice.fr GUSO fiche | 20 Oct | R + P (superseded in part) |
| EV-63 | Association: created free; lowest-risk start = association loi 1901, Oscar unpaid president, ≤6 co-produced events, SAS revisited 2027 | S2 Summary/Recommendation — Associathèque | 20 Oct | P ("my judgment") |
| EV-64 | Association tax franchise €81,051 (2026); v2 adds disinterested management, 4P test, predominance; leaders' pay ≤ ¾ SMIC unless resources > €200,000; up to 6 charity events not counted | S2; S7 slides 20, 31 — BOFiP actualité 5 Aug 2026; BOI-IS-CHAMP-10-50-10-20, -20-20 | 20–21 Oct | R |
| EV-65 | Student titre: salaried work ≤964 h/yr (≈60 % of full time); employer declares hire ≥2 working days before; exceeding can cost the titre; Algerian students differ | S2 — R5221-26 (OPPBTP copy); S7 slide 29 — Service-Public F2713 | 20–21 Oct | R |
| EV-66 | No micro-entreprise / self-employment on a student titre | S2; S3; S7 slides 19, 29 — justice.fr mirror; Service-Public Entreprendre F36612 | 20–21 Oct | R |
| EV-67 | Leading an SAS/SARL on a student titre is "doubtful" — needs a lawyer | S2 — LegalPlace (secondary); S7 slide 19 notes — F36612, F22494 | 20–21 Oct | R (secondary) / I |
| EV-68 | Founder: will use the 964 h "the best way possible, then continue as a volunteer" | S6 "money" | 20 Oct | FS |
| EV-69 | Founder plans a multi-year culture/entertainment titre for 2027–28 | S6 | 20 Oct | FS |
| EV-70 | Talent card "profession artistique et culturelle": ≥70 % SMIC/month (€1,306.91), ≥51 % from artistic activity, contracts ≥3 months/12 with works-of-the-mind companies, up to 4 years; Paris refusals on the 51 % test | S7 slide 29 — F16922; S2 — Val-d'Oise checklist, TA Paris 2025 | 20–21 Oct | R |
| EV-71 | "Paid, declared artistic contracts build your 2027 file; unpaid work builds nothing" | S2 titre section | 20 Oct | I ("my judgment") |
| EV-72 | Ticket VAT 5.5 % for concerts; 20 % in drinks venues unless category 1 licence, paid artist present, original music, ticket before entry; DJ sets only if genuine artistic creation | S2; S7 slide 32 — Artcena; BOFiP BOI-TVA-LIQ-30-20-40 | 20–21 Oct | R |
| EV-73 | CNM tax 3.5 % of receipts excl. VAT; not collected under €80/yr; DJ-night scope to confirm | S7 slide 32 — cnm.fr/taxe; S2 — AN QE 68445 (older) | 20–21 Oct | R |
| EV-74 | SACEM: % of receipts (entries + 50 % bar income per example grid); 20 % reduction if declared in advance; SACEM site unreachable from research tools | S2; S5 — AN QE 34968; example grid PDF | 20–21 Oct | R |
| EV-75 | Security: CNAPS-licensed agents; specific card above 300 people | S7 slides 24, 32 — Décret 2022-592 | 21 Oct | R |
| EV-76 | For-profit lending of workers is banned (L8241-1); a genuine production service with own know-how/supervision/price "may be lawful" — labour lawyer | S4 §A; S7 slide 20 — Code du travail L8241-1 | 20–21 Oct | R + I |
| EV-77 | Biggest founder worry: someone getting injured; docs answer with venue contract, RC organisateur insurance, no unpaid/uninsured rigging | S6; S2 "Injury" | 20 Oct | FS + P |
| EV-78 | School equipment: rented + some free from school this year; gather school technicians; docs: only with written EICAR permission | S6; S1 §5; S4 Gate 2 | 20 Oct | FS + P |
| EV-79 | Schedule: 3 weeks work / 1 week school; evenings after 17:00 in school weeks | S6; S5 "To verify" | 20 Oct | FS (to verify) |
| EV-80 | Roadmap gates: A mid-Nov 2026 roles/structure/Rebels model · B mid-Dec legal organiser + written venue offer · C D−14 continue/downsize/cancel · D after pilot season (≤6) or stop · E June 2027 structure 2027–28 | S1 §6; S7 slides 22–23 | 21 Oct | P |
| EV-81 | 90-day phases: Align (to ≈19 Nov), Set up (to ≈19 Dec), Commit or wait (to ≈18 Jan 2027; book only within €1,000 cap) | S4 §G; S7 slide 22 | 20–21 Oct | P |
| EV-82 | Governance: consensus then recorded majority; €100 spend limit without vote; Gabriel discusses but doesn't vote on Rebels deals; two people see every payment; surplus stays for next night | S4 §D, §I.6; S5 decisions; S7 slide 25 | 20–21 Oct | P |
| EV-83 | Seven open decisions: roles/time; decision & conflict rule; structure path; Rebels model + counterpart; pilot shape; money rules + fair pay; artistic direction | S1 §7; S5; S7 slide 25 | 21 Oct | IF (open) |
| EV-84 | Top risks: too few tickets (H/H); no legal organiser (M/H); unpaid/% pay (M/H); Oscar's titre (L–M/H); injury (L/H); Gabriel double role (M/M) | S7 slide 24; S4 §H | 20–21 Oct | I (judgment ratings) |
| EV-85 | "Strongest arguments against": even a good night earns a few hundred euros, won't pay fees this year; Rebels' public activity looks thin after Oct 2025 | S4 §H | 20 Oct | I |
| EV-86 | Structure undecided (association / entreprise / société); founder priority: low-to-medium risk, low cost | S6 | 20 Oct | FS |
| EV-87 | Association running cost est. €300–800/yr; SAS ≈€252 HT setup, €1,200–2,500/yr; CAE 8–12 % of billing | S2 side-by-side — Swim Legal, Hayot (setup); rest estimates | 20 Oct | E / R |
| EV-88 | Startup budget (association route) ≈€100–600; monthly between events €0–75 | S4 §F | 20 Oct | E |
| EV-89 | Deck v2 change log: 23→26+9 slides; base case −310 instead of +240 (pay 350 vs 300, 4 vs 3 people, gear 150 vs 100) | S5; S7 slide 35 | 21 Oct | IF |
| EV-90 | "An adviser recommends" removed — no identifiable adviser made recommendations | S5 change log | 21 Oct | IF |

---

## C. Non-event service ideas

| Service | What sources say | For whom | Status / phase | Citations |
|---|---|---|---|---|
| **Artist & technician network / community** | One of the two core parts: a "trusted network" that helps artists and technicians find, prepare for and deliver paid creative/technical projects. Built via an artist and technician call, creator pathway (8 steps), credits/footage/feedback, "network list v1" (Apr–Jun 2027). Phase 1 includes "building a community list". | Student/early-career technicians, DJs, musicians, filmers, editors, marketers | **Now** (community build in parallel with pilot) | S6 Identity; S1 §1, §3; S4 §A; S7 slides 3, 8, 21, 23 |
| **Technician coordination for other organisers** | Founder's Activity 2 ("finding and coordinating technicians for other organisers"). Docs: out of phase 1; supplying technicians for a margin risks illegal worker lending (L8241-1); later possibly "introductions" where organisers hire/invoice directly, or a defined production service — labour lawyer first. Separately, **technical coordination for Rebels' nights paid as a fee** is listed phase 1–2 and as a low-cost test. Crew coordination for Techonest's own nights is phase 1. | Organisers and venues (later); Rebels | **Later, assessed separately** (own nights: now; Rebels fee: 1–2; others: 2+) | S6; S1 §3; S3 "will not do yet"; S4 §A, §C table, §H tests; S7 slides 20, 21 |
| **Equipment rental** | Founder's Activity 4; equipment rented/borrowed this year, invest in own later. Docs: phase 3+, needs owned gear and insurance; "equipment only when it beats renting"; no purchases in phase 1. | Organisers | **Later, assessed separately** | S6; S1 §3; S4 §A, §C; S7 slide 21 |
| **Production services (filming, editing, marketing)** | Founder listed filming/editing/marketing as network fields; rebuild brief: "a production service for other organisers" later, "not all at once under one arrangement". Within nights: crew films all night, footage = promotion + portfolio. Legal: these roles are not GUSO — employment or genuine independent invoice, to confirm. SAS named as the right tool for "a production service". | Own nights (now); other organisers (later) | Roles at the pilot **now**; external service **later, assessed separately** | S6; S7 slides 6, 8, 19 notes, 21, 30 |
| **Oscar's own sound/video/lighting/DJ work** | Founder's Activity 3; he could be hired by Techonest. Docs: only as salaried work within 964 h; CAE suggested "if most income is own DJ/tech services"; Model 0: paid gigs at Rebels nights. | Oscar | Now, within 964 h; CAE unconfirmed | S6; S2 ranking #3; S4 §C model 0 |
| **Personal projects** | Founder's Activity 5, "still being developed"; content unknown (listed as gap). | — | Undefined | S6 Activities, gaps |
| **Themed year (Halloween etc.) / own event series** | Founder: "a themed year, e.g. Halloween and other themed events". Docs: own series is "later", repeatable series 2027–28 after pilot and gates. | Audiences | **Later** | S6; S1 §3; S3; S7 slide 21 |
| **Bar share / venue fee** | Phase 1 revenue line by venue deal. | Venue pays | Proposal | S4 §C |

---

## D. Learning platform / simulator links

None. No file in `event-project/` links to or mentions a learning platform, course or simulator product. The only "simulator" mentions are the **GUSO online simulator** (to estimate payroll cost: S4 §B, §F, task 8; S5 "Payroll / GUSO simulation"). The local `model/pilot_model.py` is a calculation script, not a simulator UI.

---

## E. Conflicts and contradictions

1. **Volunteer/percentage pay vs "everyone paid".** Founder: technicians unpaid if an event does badly, percentage if well, via règlement intérieur (S6 "People"). Founder's own later brief: "fairly paid opportunities" (S6). All docs: no unpaid or percentage work on paid nights (S1 §5, S3, S4, S7). Legal basis: DREETS/Associathèque (S2). S6 contradiction #1.
2. **964 h then volunteering vs being paid by Techonest.** Founder will "continue as a volunteer" after 964 h (S6) vs "Techonest gets paid / could hire yourself". S2 calls it "the riskiest idea"; S7 slide 20 "unpaid work is not a workaround" (F2713). S6 contradiction #2.
3. **No budget vs €1,000.** S6 contradiction #3; docs treat €1,000 as the cap (S1, S4, S7).
4. **"Gérant" vs association president** (S6 #4; S2 recommends unpaid president).
5. **€13,500/month framed as revenue** by founder vs "gross ticket sales, not income" (S6 #5; S1; S7 slide 18).
6. **Rebels status.** Founder: an association (S6) vs no registered entity found (S2, S7 slide 10).
7. **Gabriel's role in Rebels.** S2 calls him "a co-founder of Rebels"; S7 says "part of Rebels / one of its two faces"; S6 records only "GrooveBox" + "his role with Rebels" (link to Gabriel partly inferred from a "gab" filename, S2).
8. **Licence rule changed.** S2/S3/S4/S10: licence needed above 6 shows; S1/S7 (v2): needed from the first show if shows are the principal activity (S5 change log admits the correction).
9. **GUSO changed.** S2/S4: "everyone paid through GUSO", incl. Oscar, ≤6 shows. S7 v2: GUSO only if principal activity is not shows, and not for filming/editing/marketing — an events association "may not be able to use GUSO" (slide 30). The association recommendation (S2/S3) relies on GUSO.
10. **Association tax** "pays no commercial taxes under €81,051" (S3 "Known") vs v2 "not automatic" (S7 slides 20, 31).
11. **Break-even / result figures differ by doc version:** S3 ≈155 (free venue, 3 paid) & 260–300 (hire, 5 paid); S4 ≈156 & +240 expected; S1/S7 ≈211 base & ≈127 lean, base −310. Cautious −1,221 (S4) vs −1,240 (S7). Strong/Ambitious +1,468 (280×18, S4) vs +504 (250×18, S7).
12. **300-ticket night:** S2 −€286 (club, hire €800, 4×€460, 20 % VAT) vs S7 slide 18 −€296 (€800 hire, 5×€350) and +€504 (free venue). Different input sets; both labelled estimates.
13. **Go/stop timing:** S4/S10 day −10 (success = break-even presales by D−10; stop if <60 %); S1/S7 D−14 ≥50 % and D−3 ≥75 % (S7 slide 13 notes acknowledge earlier drafts conflicted).
14. **Pilot size/timing:** S3 150–250 people, Jan–Mar 2027; S4 150–250 (decision sheet ≈200, Feb–Mar); S1/S7 120–200, Feb–Mar 2027.
15. **Worst-case exposure:** S4 ≈€1,800 (1,200 + 600 setup) vs S7 €2,330 base / €840 lean shared.
16. **Cancel-at-D−14 sunk cost:** S7 ≈€380; S4 300–500 at D−10; model prints €780 (see F).
17. **Rebels model labels:** 1/2/3 (+0) in S3/S4 vs A/B/C in S7; S3 Model 2 = "Techonest produces" while S7 B = co-production. Recommendation consistent in substance (co-production) but labels shift.
18. **Adviser attribution:** S3 lists association as "My adviser's recommendation"; S2 "my judgment"; S5 says no identifiable adviser made recommendations.
19. **Micro-entreprise source labelled "Service-Public"** in S3 but linked to a justice.fr mirror; S7 uses the primary F36612.
20. **Name:** Techonest / Technonest / Technest / Thechnest (S6) vs Tekonest (S1).

---

## F. Unverified items and model-vs-docs check

**Could not verify (no external checks performed in this audit; docs themselves flag):** all legal citations were not re-opened; Rebels' legal status, decision-makers, ticket history, interest; any cost line (SACEM, security, venue, insurance, pay) — all estimates; VAT rate applicable; CNM scope for DJ nights; whether Oscar may sit on an association board on his titre; his nationality/titre mention; EICAR equipment terms; whether Techonest/Rebels contracts count for the talent card; market demand (no data); founder name; study-fee amount; whether Gabriel is formally a Rebels co-founder.

**Model vs docs/deck:**
- **Match:** all four scenarios (−1,240 / −310 / +504 / +237), break-evens (263 / 211 / 208 / 127), net per ticket (8.09 / 10.11 / 12.13 / 11.77), sensitivity grid and BE 263/211/176, pay sensitivity (+90/−750, BE 171/254), VAT 5.5 % (−11, BE 181), aspiration +504 / −296, €13,500/month and €162,000/yr, lean fixed €1,280. README's 127 / 211 match.
- **Mismatch (setup):** model `setup` dict sums to **€500** (bank 60, insurance_annual 300, visuals 50, misc 90), while the deck (slides 17, 33) uses **setup ≈ €200**. Consequently model prints cash-before-base **€930** vs deck **€630**; max exposure **€2,630** vs deck **€2,330**; cancel-at-D−14 sunk **€780** vs deck **≈€380** (deck formula: setup 200 + half marketing 100 + insurance 80; model: full marketing 200 + insurance 80 + setup 500). Difference in exposure = €300 = the annual insurance line in the model's setup.
- **Not computed by model:** lean 50/50 worst case €840 (deck arithmetic 1,280/2 + 200 is correct given setup €200).
- **v1 figures** (S3, S4, S10: +240, ≈155/156, −1,221, +1,468) are not reproduced by the current model; S5/S7 change log says they were superseded (pay €300, 3 people, gear €100). I did not re-derive v1 figures.
- **Legal-guide numbers check (S2)** re-added by hand: B −286, C +1,211, D −1,803 correct; A +2,477 (doc says +2,478, rounding).
- Deck PDF 35 pages = pptx 35 slides; content not compared page by page.

---

## G. Plain-language summary

1. `event-project/` is an idea-stage plan, written by Claude on 20–21 Oct 2026 from Oscar's statements.
2. Tekonest = culturally mixed Paris nights (Arab/MENA, Afro, electronic) + a network of paid artists and technicians.
3. Team: Oscar (founder), Ahmad (singer/percussionist), Gabriel/GrooveBox (house DJ, linked to Rebels Collectif); roles and time not agreed.
4. Nothing is agreed with Rebels, which has no registered entity found publicly.
5. The proposal is one lean pilot night, 120–200 people, Feb–Mar 2027, €12–18 tickets, €1,000 cap, D−14/D−3 presale rules.
6. Estimates: lean pilot breaks even ≈127 tickets (+€237 at 150); base case loses €310; the model reproduces these.
7. Oscar's 3×300×€15 = €13,500/month is gross sales, not income; one 300-ticket night roughly breaks even or loses money.
8. His ideas of unpaid/percentage pay and volunteering past 964 h are rejected by all docs as legally risky.
9. Technician coordination, equipment rental and production services are deferred, to be assessed separately (worker-lending ban, L8241-1).
10. Legal guidance was revised between 20 and 21 Oct (licence, GUSO, tax); older docs and the web deck carry outdated rules and numbers, and the model's setup cost (€500) disagrees with the deck (€200).
