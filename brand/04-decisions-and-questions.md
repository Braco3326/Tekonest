# Tekonest — decisions and open-questions register

> The founder's latest direct instructions take priority over older documents. Where sources conflict, both versions and their dates are kept below, and nothing is chosen silently. Nothing here is legal, financial, immigration or partnership advice.

## 1. Decisions the founder has made

| ID | Decision | Date | Evidence |
| --- | --- | --- | --- |
| D-01 | The brand name is **Tekonest**. Older spellings are kept in historical files | 21 Oct 2026 | FB-01 |
| D-02 | Tekonest is an umbrella of several services that may connect over time | 21 Oct 2026 | FB-02 |
| D-03 | The event programme, the learning platform and TekPractice are **current** visions. The two learning products are under development and not abandoned | 21 Oct 2026 | FB-03, FB-04 |
| D-04 | Everything about Tekonest lives in one repo, with one folder per service | 21 Oct 2026 | FB-09 |
| D-05 | Ahmad and Gabriel agreed to be cofounders. Roles and time are still open | 20 Oct 2026 | EV-21 |
| D-06 | Preferred venues are clubs and rented halls | 20 Oct 2026 | EV-34 |
| D-07 | For the structure, the priority is low-to-medium risk and low cost | 20 Oct 2026 | EV-86 |

**July decisions (dated; check whether they still hold)**

| ID | Decision | Date | Evidence |
| --- | --- | --- | --- |
| DJ-01 | TekPractice: "personal now, product later" (no accounts or payments at first) | 10–11 Jul 2026 | LT-08 |
| DJ-02 | Domain plan `technest.fr` + `sim.technest.fr`, later replaced by `teknest.fr` for the game | 15 Jul / 17 Jul 2026 | LT-06, LT-05 |
| DJ-03 | Theory site "paused until TekPractice is validated". **Replaced by D-03** | 17–18 Jul 2026 | LT-03, LT-04 |
| DJ-04 | Production tutor provider set to Gemini (free tier) | 15 Jul 2026 | LP-24, LP-25 |
| DJ-05 | TekPractice: "Focus & Patch" replaces drag-to-connect | 18 Jul 2026 | TP-36 |
| DJ-06 | Personal study documents are never committed (`/source` ignored) | 16 Jul 2026 | LP-42 |

## 2. Open decisions

| ID | Decision needed | Affects | Evidence |
| --- | --- | --- | --- |
| O-01 | Brand architecture: branded house, endorsed sub-brands, or separate brands | All | [umbrella §6](01-umbrella-vision.md) |
| O-02 | What "the website" is: an umbrella site, the learning platform, TekPractice, or a combination; and which domain | Learning, TekPractice, brand | FB-04, LT conflict 5 |
| O-03 | Legal structure (association, company, partner-led first event) and who the legal organiser is | Events, production, rental, any paid work | EV-83, EV-86 |
| O-04 | Cofounder roles and time; decision rule; conflict rule for Rebels deals | Events, network | EV-83, EV-20 |
| O-05 | Rebels model (A/B/C) and who negotiates for Rebels | Events | EV-28, EV-29 |
| O-06 | Pilot shape (size, price, €1,000 cap) | Events | EV-33, EV-35 |
| O-07 | Written fair-pay policy (see C-09) | Events, network, production | EV-53, EV-54 |
| O-08 | Pricing of the learning products: free core vs subscription vs B2B | Learning, TekPractice | LT conflict 7 |
| O-09 | Design direction for the learning products: dark studio vs white gallery, shared or separate | Learning, TekPractice | LT conflict 9 |
| O-10 | TekPractice assets: licence floor (CC0 only vs CC0 + CC-BY); AI image-to-3D; de-branding before commercial use | TekPractice | LT-68, TP-43, TP-44 |
| O-11 | TekPractice ADR-0002 (patchbay normalling) and the QL1 etherCON fix | TekPractice | TP-39, TP-47 |
| O-12 | Whether the education family and the live-culture family should connect (students or graduates in the network or on paid crews) | Learning, network, events | [service map L12](02-service-map.md) |
| O-13 | Whether production & crew services and equipment rental stay on the list | Production, rental | [services](services/) |

## 3. Conflicts between sources (dates kept)

| ID | Conflict | Versions and dates | Status |
| --- | --- | --- | --- |
| C-01 | **Brand name** | Tech Nest / Teknest (Jul 2026) · Techonest (20 Oct) · **Tekonest** (21 Oct) | Resolved by D-01. File names keep the old spellings |
| C-02 | **Brand scope** | BTS Son success platform with 2 products (Jul) · events + network (20 Oct) · umbrella of both (21 Oct) | Resolved by D-02 |
| C-03 | **Learning platform status** | "Site DONE, deployed" (15 Jul) · "PAUSED until TekPractice validated" (17–18 Jul) · "current, under development" (21 Oct) | Resolved by D-03 |
| C-04 | **Domain** | `technest.fr` planned (15 Jul) · `teknest.fr` for the game (17 Jul) · `teknest.fr` as the site's canonical URL (16 Jul) · README URL `tech-nest-web-gamma.vercel.app` | Open: O-02 |
| C-05 | **"Not a game" vs "The Educative Game"** | 15 Jul vs 16–18 Jul | Open: naming/positioning |
| C-06 | **AI coach status** | "Not started" (Final Report, 18 Jul) vs built with no key (NIGHT_LOG / ADR-0006, 17 Jul). Code confirms it is built and off by default | Resolved by code inspection |
| C-07 | **Monetisation** | No payments (11 Jul) · keep courses free (11–13 Jul) · free taster then subscription (16–17 Jul) · benchmark €7–14/month (7 Jul) | Open: O-08 |
| C-08 | **Design** | Dark studio-grade site (13–15 Jul) vs one white system "site+jeu" (16–17 Jul) | Open: O-09 |
| C-09 | **Pay for technicians** | Founder: unpaid if a night goes badly, a percentage if it goes well (20 Oct) · founder: "fairly paid opportunities" (21 Oct) · all docs: everyone is paid, no percentage, on a legal basis (20–21 Oct) | Open: O-07. Founder confirmation needed |
| C-10 | **Founder volunteering after 964 h** | Founder intends to continue as a volunteer (20 Oct) vs docs: "unpaid work is not a workaround" (21 Oct) | Open: needs advice from an immigration lawyer |
| C-11 | **Licence and GUSO rules** | Licence only above 6 shows; everyone paid through GUSO (20 Oct docs `01`–`03`) vs from the first show if shows are the main activity; GUSO only if shows are not the main activity (21 Oct deck) | 21 Oct version is newer; still not legal advice |
| C-12 | **Pilot numbers** | Break-even ≈155, +€240 expected (20 Oct) vs ≈211 base / ≈127 lean, −€310 base (21 Oct) | 21 Oct numbers are current; all are estimates |
| C-13 | **Model vs deck setup cost** | `pilot_model.py` uses €500 setup; deck uses ≈€200. Cash before the night €930 vs €630; exposure €2,630 vs €2,330; cancel at D−14 €780 vs ≈€380 | Open: reconcile |
| C-14 | **Rebels status** | Founder: an association/collective (20 Oct) vs no registered entity found publicly (20 Oct research) | Open |
| C-15 | **Gabriel's role in Rebels** | "Co-founder of Rebels" (legal guide) vs "part of Rebels" (deck); the link partly rests on an inferred file name | Open |
| C-16 | **E3 format and coefficient** | Learning code and July research: E3 PTES coefficient 4, 6 h (3 h + 3 h) vs the founder's BTS study-project instructions (outside this repo, Oct 2026): E3/TES coefficient 3, 3 h | Open: verify against the official arrêté |
| C-17 | **Who validated the learning content** | "Validated 15 Jul 2026 by the project owner (diplômé BTS Métiers du Son)" vs the founder described as a current student | Open |
| C-18 | **Origin and ownership of the learning products** | STATUS.md (15 Jul): "started as" another person's vision; Prompt-0.5 mentions that person's catalogue "v0.2" (11 Jul) vs all later docs naming Oscar as the founder | Open: confirm ownership |
| C-19 | **Founder name** | Event docs flag "Oscar" to be verified before documents are shared (21 Oct) | Open |
| C-20 | **Stale README facts** | learning-platform README says "28 tests" (57 exist) and gives the vercel.app URL as production | Noted. Not edited (code-folder doc) |

## 4. Top questions for the founder (max 7, in priority order)

1. **Brand architecture.** Should services carry "Tekonest" in their names, be sub-brands "by Tekonest" (TekPractice, Tekskol, a name for the nights), or stay separate brands?
2. **The website.** In the "website-creation phase", which site do you mean: an umbrella Tekonest site, the learning platform, TekPractice, or one site holding several? Which domain?
3. **Ownership.** July files say the learning products "started as" another person's vision, and that "the project owner (diplômé BTS Son)" validated the content. Who owns these ideas and this code, and who validated it?
4. **Connection between the families.** Should BTS students and graduates connect to the network and the paid event crews, or should the two families stay independent?
5. **Priority for the next 3 months.** Event pilot preparation, stabilising TekPractice and the learning site, or both? With what weekly time?
6. **Fair pay as a Tekonest-wide rule.** Do you confirm "everyone who works on a paid night is paid; no unpaid or percentage-based work" for all services?
7. **Learning-product pricing.** Free core (Dante-style), subscription, or school/B2B deals?
