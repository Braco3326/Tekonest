# Accessibility, asset rights and French web-copy conventions (Tekonest umbrella site)

Scope: France/EU, as of Oct. 2026. Not legal advice. Each item is marked **[LOI]** (legal obligation), **[NORME]** (W3C/standard text) or **[BONNE PRATIQUE]** (good practice / recommendation).

## 1. WCAG 2.2 AA — which success criteria matter most, with exact thresholds

### Takeaway
WCAG 2.2 is a W3C Recommendation (current dated version 12 Dec. 2024). For a static marketing/cultural site the high-impact AA criteria are contrast (4.5:1 text, 3:1 large text and UI/graphics), reflow at 320 CSS px, text spacing, visible and non-obscured focus, 24×24 CSS px targets, no drag-only interactions, and declared page language. Animation-from-interaction (2.3.3) is AAA, so `prefers-reduced-motion` is good practice beyond AA, while 2.2.2 (pause/stop/hide for auto-moving content > 5 s) is mandatory at level A.

### Cited Findings
- [NORME] Current version: "W3C Recommendation 12 December 2024" (REC-WCAG22-20241212); WCAG 2.2 removed 4.1.1 Parsing — [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [NORME] **1.4.3 Contrast (Minimum), AA**: text ≥ **4.5:1**; "Large-scale text and images of large-scale text have a contrast ratio of at least **3:1**"; large-scale = "at least **18 point or 14 point bold**" (≈ 24 CSS px / 18.66 CSS px bold) — [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [NORME] **1.4.11 Non-text Contrast, AA**: UI components and graphical objects ≥ **3:1** "against adjacent color(s)" (borders of inputs, icons, focus rings, buttons without text-contrast fill) — [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [NORME] **1.4.10 Reflow, AA**: no 2-D scrolling at a width equivalent to **320 CSS pixels** (vertical scrolling content) or height **256 CSS pixels** (horizontal scrolling content) — [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [NORME] **1.4.12 Text Spacing, AA**: no loss of content when the user sets line height ≥ **1.5×** font size, paragraph spacing ≥ **2×**, letter spacing ≥ **0.12×**, word spacing ≥ **0.16×** — [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [NORME] **1.4.13 Content on Hover or Focus, AA**: hover/focus pop-ups must be dismissible "without moving pointer hover or keyboard focus" (plus hoverable and persistent) — [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [NORME] **2.2.2 Pause, Stop, Hide, A**: any moving/blinking/scrolling info that starts automatically and "lasts more than five seconds" needs a mechanism to pause, stop or hide it (relevant to hero carousels, marquee tickers, background video) — [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [NORME] **2.3.1 Three Flashes, A**: nothing flashes "more than three times in any one second period" — [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [NORME] **2.3.3 Animation from Interactions is Level AAA**: "Motion animation triggered by interaction can be disabled" — [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [NORME] **2.4.7 Focus Visible, AA**: keyboard focus indicator must be visible — [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [NORME] **2.4.11 Focus Not Obscured (Minimum), AA** (new in 2.2): "When a user interface component receives keyboard focus, the component is not **entirely** hidden due to author-created content" (sticky headers, cookie banners, chat bubbles) — [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [NORME] **2.4.13 Focus Appearance is AAA** (focus indicator ≥ 3:1 between focused/unfocused states) — useful target but not required for AA — [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [NORME] **2.5.7 Dragging Movements, AA** (new): all drag functionality must be achievable "by a single pointer without dragging" unless essential (e.g. sliders/carousels need prev/next buttons) — [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [NORME] **2.5.8 Target Size (Minimum), AA** (new): targets ≥ **24 × 24 CSS px**, except: *Spacing* (a 24 px-diameter circle centred on each undersized target doesn't intersect another target/circle), *Equivalent* (another compliant control on the page does the same), *Inline* (in a sentence/constrained by line-height), *User agent control*, *Essential* — [W3C Understanding 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
- [NORME] **3.2.6 Consistent Help, Level A** (new): if help mechanisms (human contact details, contact mechanism, self-help option, automated contact) repeat across pages, they must appear "in the same order relative to other page content"; "This criterion does not require that a site provide a help mechanism" — [W3C Understanding 3.2.6](https://www.w3.org/WAI/WCAG22/Understanding/consistent-help.html)

### Inferences
- Design tokens: body text ≥ 4.5:1; display headings ≥ 24 px (or ≥ 18.66 px bold) may go to 3:1; input borders, icon buttons, focus outlines ≥ 3:1 against adjacent colours. Status badges like "en préparation" are text → 4.5:1.
- A sticky header must not fully cover focused elements (use `scroll-padding-top`).
- Carousels: provide buttons (2.5.7) and pause if auto-advancing (2.2.2). Honour `prefers-reduced-motion` as good practice for 2.3.3 (AAA) and vestibular comfort.
- Keep the "Contact" link in the same place in header/footer on every page (3.2.6).
- Set `<html lang="fr">`; mark English fragments with `lang="en"` (3.1.1 / 3.1.2), and switch to `lang="en"` on future English pages.

### Gaps
- The normative text of 3.1.1 (Language of Page, A) and 3.1.2 (Language of Parts, AA) and 3.3.7/3.3.8 could not be retrieved in the fetch (page truncation). From the W3C spec (not re-verified in this session): 3.1.1 "The default human language of each Web page can be programmatically determined"; 3.1.2 requires the same for each passage/phrase, except proper names, technical terms, words of indeterminate language and vernacularised words — [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/). Verify before quoting.
- No MDN/CSS source fetched for `prefers-reduced-motion`; it's a standard CSS media query (Media Queries Level 5).

## 2. RGAA 4.1 and the European Accessibility Act — who is obliged, and good practice for a small project

### Takeaway
A small Paris project (association or micro-business, < 10 staff and ≤ 2 M€ turnover/balance) is **not legally obliged** to comply with the EAA for its services, and the RGAA's legal scope (loi 2005, art. 47) targets public bodies and large companies. Even so, aiming for WCAG 2.2 AA (≈ RGAA 4.1.2 + 2.2 extras) and publishing a short accessibility statement is good practice and makes later growth easier.

### Cited Findings
- [LOI] The EAA rules apply in France "depuis le 28 juin 2025"; covered services include e-commerce, telephony, audiovisual media services, transport, consumer banking, e-books, 112 — [DGCCRF](https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques/professionnels-vos-produits-et-services-doivent-etre-conformes-la-directive-accessibilite)
- [LOI] Legal basis: Directive (UE) 2019/882; décret n° 2023-931 du 9 octobre 2023; arrêté du 9 octobre 2023; Code de la consommation L.412-13, D.412-49 to D.412-62, R.451-4-I — [DGCCRF](https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques/professionnels-vos-produits-et-services-doivent-etre-conformes-la-directive-accessibilite)
- [LOI] Exemption: service providers with fewer than 10 employees and turnover or balance sheet "inférieur à 2 millions d'euros" have no accessibility obligation under this regime — [DGCCRF](https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques/professionnels-vos-produits-et-services-doivent-etre-conformes-la-directive-accessibilite)
- [LOI] Reference standard EN 301 549 V3.2.1; RGAA 4.x and WCAG 2.1 listed as further reading; non-compliance = contravention de 5e classe, fines of 7 500 € per violation, injunctions possible — [DGCCRF](https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques/professionnels-vos-produits-et-services-doivent-etre-conformes-la-directive-accessibilite)
- [LOI] Covered service providers must publish information on how they meet accessibility requirements (e.g. audit reports) — [DGCCRF](https://www.economie.gouv.fr/dgccrf/les-fiches-pratiques/professionnels-vos-produits-et-services-doivent-etre-conformes-la-directive-accessibilite)
- [LOI] RGAA's original scope (loi 2005-102 art. 47, décret 2019-768) covers public services and private companies above a turnover threshold (commonly cited as 250 M€) — [Décret 2019-768 (copy hosted by CFDT)](https://www.cfdt-ufetam.org/wp-content/uploads/2023/03/decret_2019-768_24-07-19_accessibilite_handicapes_services_com_en_ligne.pdf); [Sénat question 2023](https://www.senat.fr/questions/base/2023/qSEQ230104785.html) (not fetched in full; the threshold should be verified)

### Inferences
- Tekonest's umbrella site is an information site, not (yet) e-commerce or ticketing. If ticket sales or bookings with payment are added later, it moves into "commerce électronique" under the EAA, but the micro-business exemption still applies while below 10 staff / 2 M€.
- Good practice: target WCAG 2.2 AA, add a "Déclaration d'accessibilité" page (state the standard used, known limits, and a contact for reporting barriers). This also gives the help mechanism for 3.2.6.

### Gaps
- Didn't fetch the RGAA page on numerique.gouv.fr directly to confirm the current RGAA version (4.1.2) and the exact private-sector threshold; flagged above.
- Whether an *association* (rather than a company) counts as a "prestataire de services" under the EAA wasn't confirmed by an official source.

## 3. French inclusive writing (écriture inclusive) and accessibility

### Takeaway
The point médian ("artiste·s") is badly rendered by screen readers and is opposed by the main French blind-users federation. It's also discouraged for official texts by the 2017 circular. A warm, inclusive alternative is **épicène wording first** ("les artistes", "l'équipe technique", "toute personne"), **full doublets** when needed ("techniciennes et techniciens"), and **no point médian** in UI copy.

### Cited Findings
- [Position] Fédération des aveugles de France communiqué (20 Nov. 2017): écriture inclusive is "proprement indéchiffrable par nos lecteurs d'écrans" and creates "une langue illisible, incompréhensible", especially for dyslexic readers — [Handicap.fr, 22 Nov. 2017](https://informations.handicap.fr/a-ecriture-inclusive-accessible-10358.php); [Aveugles de France CP](https://aveuglesdefrance.org/app/uploads/2021/03/CP_Non-au-melange-des-genres_Ecriture-inclusive_Aveugles-de-France.pdf)
- [Contradicting view] FFDys president Nathalie Groh said it is "n'est pas une entrave majeure" for dyslexic readers — [Handicap.fr](https://informations.handicap.fr/a-ecriture-inclusive-accessible-10358.php)
- [Position] The Académie française called inclusive writing a mortal danger ("péril mortel") to the French language (2017) — [Handicap.fr](https://informations.handicap.fr/a-ecriture-inclusive-accessible-10358.php)
- [LOI/administration only] Circulaire du 21 novembre 2017 (Premier ministre): asks administrations not to use "écriture dite inclusive", "en particulier pour les textes destinés à être publiés au Journal officiel"; at the same time it requires feminised job titles ("doit être systématiquement féminisé") and recommends doublets like "le candidat ou la candidate" in recruitment notices — [Légifrance JORFTEXT000036068906](https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000036068906)

### Inferences
- The circular binds the State administration, not private organisations: for Tekonest it is guidance, not law.
- Practical rules for the copy team:
  1. Use épicène nouns and collectives first: "les artistes", "les membres", "le public", "l'équipe", "les personnes intéressées", "vous".
  2. Address the reader directly ("vous", "rejoignez-nous") — this avoids most gendered forms and fits the "warm, direct" tone.
  3. When a gendered noun is unavoidable, use a full doublet in alphabetical or alternating order: "techniciennes et techniciens", "organisatrices et organisateurs".
  4. Avoid point médian, parentheses ("technicien(ne)s") and slashes in UI text, buttons and headings.
  5. Use feminised titles for named women ("la régisseuse", "l'autrice").

### Gaps
- Haut Conseil à l'Égalité guide and the 2021 Blanquer circular (education) weren't fetched; they're not needed for the recommendation.
- I found no recent (2024–2026) test data on how NVDA/JAWS/VoiceOver read the point médian; the 2017 federation position is the main source.

## 4. French typography rules for web copy

### Takeaway
Put a non-breaking space (ideally a narrow one, U+202F) before `; : ! ?` and inside « », and use only French guillemets. Put accents on capitals ("À", "É"). Use a decimal comma, a space as thousands separator, and a non-breaking space before % and €.

### Cited Findings
- Non-breaking space before `;`, `:`, `!`, `?` and `»`, and after `«`; espace fine ≈ 1/4 em; if fine isn't available, at least an espace insécable — [Debian, La typographie française](https://www.debian.org/international/french/typographie)
- Only French guillemets « » should be used; other quote types are "à proscrire" (Debian's house rule) — [Debian](https://www.debian.org/international/french/typographie)
- Capitals take accents ("É", "À"); prefer real accented characters to HTML entities — [Debian](https://www.debian.org/international/french/typographie)
- Académie française: "On veille donc, en bonne typographie, à utiliser systématiquement les capitales accentuées, y compris la préposition À" — [Académie française, Questions de langue](https://dictionnaire-academie.fr/article/QDL005)
- Non-breaking space before % ("100 %"); decimal comma ("3,14"); thousands grouped by spaces ("1 000 000") but not for years ("1950") — [Blog du Modérateur](https://www.blogdumoderateur.com/regles-ponctuation-typographie/)
- Ellipsis: no space before, space after; "M." (not "Mr.") for Monsieur — [Blog du Modérateur](https://www.blogdumoderateur.com/regles-ponctuation-typographie/)

### Inferences
- Web implementation: put U+202F (narrow no-break space) or U+00A0 in the source text, or insert it automatically at build time. Watch for `text-transform: uppercase`: it keeps accents only if the source text has them, so write lowercase source with accents.
- Usual conventions (not verified by a fetched source in this session; check against the *Lexique des règles typographiques en usage à l'Imprimerie nationale*): amounts "25 €", "12,50 €" (symbol after, non-breaking space); hours "20 h", "20 h 30" (also seen: "20h30" in event marketing); dates "22 octobre 2026" or abbreviated "22 oct. 2026" (lowercase month, no leading zero on the day), "1er" for the first; "XXIe siècle"; "n°".

### Gaps
- No primary source fetched for currency, hours, date abbreviations or ordinal formatting. The Imprimerie nationale lexicon isn't freely online; the listed conventions above need checking.

## 5. Image rights in France and free stock licences

### Takeaway
In France, publishing a recognisable person's image needs their (written) consent, except for public-event crowds where nobody is singled out. Unsplash and Pexels grant broad, free copyright licences but **don't guarantee model/property releases or trademark clearance**. Pexels explicitly forbids implying endorsement. Stock photos of "people" shouldn't be presented as Tekonest's own community.

### Cited Findings
- [LOI] Publishing a photo of a recognisable person requires their agreement; for adults "il est nécessaire d'avoir votre accord écrit" in private places, and in public places when the person is isolated. Consent to being photographed isn't consent to publication. Legal basis: Code civil art. 9 (vie privée) — [Service-public.fr F32103](https://www.service-public.gouv.fr/particuliers/vosdroits/F32103)
- [LOI] Exception: consent is not needed for a photo of a "manifestation publique" when the person isn't shown individually, or for news events, provided dignity is respected and there's no commercial use — [Service-public.fr F32103](https://www.service-public.gouv.fr/particuliers/vosdroits/F32103)
- [LOI] Penalty cited: publishing without consent "sanctionné d'un an d'emprisonnement et de 15 000 € d'amende" (this refers to images taken in a private setting, under Code pénal 226-1/226-2) — [Service-public.fr F32103](https://www.service-public.gouv.fr/particuliers/vosdroits/F32103)
- [Licence] Unsplash: "irrevocable, nonexclusive, worldwide copyright license to download, copy, modify, distribute… including for commercial purposes, without permission from or attributing the photographer"; not allowed: "compile images from Unsplash to replicate a similar or competing service" — [Unsplash License](https://unsplash.com/license)
- [Licence] Unsplash on releases: contributors "agree that images uploaded to Unsplash have model releases" but "there is no reasonable way for us to monitor"; it "cannot make any guarantees about the scope of permitted uses"; logos/objects "may have copyright or trademark protection"; users should contact the contributor to check for a model/property release — [Unsplash Help: Releases and trademarks](https://help.unsplash.com/en/articles/2612329-releases-and-trademark)
- [Licence] Pexels: free to use, no attribution required, can modify; NOT allowed: "Identifiable people may not appear in a bad light or in a way that is offensive"; "Don't sell unaltered copies"; "Don't imply endorsement of your product by people or brands on the imagery"; no redistribution on other stock/wallpaper platforms; don't use as part of a trademark/business name — [Pexels License](https://www.pexels.com/license/)

### Inferences
- Event photos of Tekonest's own events: get a written image-release form from performers, technicians and anyone featured individually. Wide crowd shots are lower risk; put a notice at the entrance as good practice (not a legal substitute for individual consent).
- Using stock people as "our artists / our technicians / our clients" is misleading (and with Pexels, can amount to implied endorsement). Prefer abstract/scene/equipment imagery, illustrations, or clearly labelled placeholders ("Image d'illustration") until real, consented photos exist.
- Keep a simple asset register (source URL, licence, date, release status) for every image.

### Gaps
- Wikimedia Commons CC licences were not fetched. Known general rule (to verify on [Wikimedia Commons: Reusing content](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia)): CC BY / CC BY-SA require attribution (author, licence, link) and BY-SA requires share-alike for adaptations; Commons states that personality rights and trademarks aren't covered by the copyright licence.
- Didn't fetch the full Unsplash Terms of Service text.

## 6. Fonts: SIL OFL and Google Fonts / GDPR

### Takeaway
OFL fonts can be self-hosted commercially with no visible credit required. Ship the licence (keep it with the font files / in metadata). Subsetting or converting to WOFF2 can count as modification, which affects Reserved Font Names. Loading Google Fonts from Google's servers sends visitors' IP addresses to Google; a German court (LG München I, 2022) found this unlawful without consent → **self-host**.

### Cited Findings
- [Licence] No acknowledgement required in artwork: "No. Font authors may appreciate being mentioned…" (OFL FAQ 1.1.2) — [OFL FAQ](https://openfontlicense.org/ofl-faq/)
- [Licence] Web hosting allowed "as long as you make the full font package available" (1.8); the package includes copyright notices and licence info (1.7); a link to the licence in metadata is legally sufficient but the FAQ recommends including the full OFL text (1.10) — [OFL FAQ](https://openfontlicense.org/ofl-faq/)
- [Licence] Format change "normally is considered modification, and Reserved Font Names (RFNs) cannot be used" (2.2); WOFF may keep the name only if the font data is unchanged except for WOFF compression (2.2.1); subsetting is permitted but "would not normally allow the use of RFNs" (2.6) unless Functional Equivalence is preserved (2.7–2.8) — [OFL FAQ](https://openfontlicense.org/ofl-faq/)
- [Licence] Commercial use in design work: "Yes" (1.1); fonts can't be sold on their own (3.3) — [OFL FAQ](https://openfontlicense.org/ofl-faq/)
- [Jurisprudence, DE] LG München I, 20.01.2022, Az. 3 O 17493/20: the site passed the visitor's IP address to Google through Google Fonts without consent; IP addresses are personal data; the court awarded **100 € immaterial damages** and threatened a fine of up to 250 000 € for repeat violations; the IHK recommends hosting fonts locally — [IHK Bergisches Land](https://www.ihk.de/bergische/recht-und-steuern/wettbewerbsrecht/google-fonts-5646176)

### Inferences
- Recommendation: download the OFL fonts and serve WOFF2 from your own domain. Add `OFL.txt` next to the font files (e.g. `/fonts/OFL.txt`) and a credits line in the legal notice page (optional, good practice). If you subset a font with a Reserved Font Name, either keep Functional Equivalence or rename the font family in your CSS/font files to be safe.
- The Munich ruling is German, not French. GDPR applies in France too, though, so the same risk reasoning is generally applied by EU practitioners. I found no French CNIL decision specific to Google Fonts in this session.

### Gaps
- No CNIL/French court source on Google Fonts was found; the IHK page is a secondary summary of the ruling.

## 7. Forms in a prototype without a backend — GDPR basics and honest labelling

### Takeaway
In a prototype, don't collect data you can't process: disable or clearly label forms as non-functional. When email collection goes live, show first-level information at the point of collection (who, why, rights, link to privacy policy), get consent through an unticked box, and offer an unsubscribe link in every email.

### Cited Findings
- [LOI] The CNIL publishes model data-collection forms with information notices (first-level information at collection plus a link to full information) — [CNIL: Exemples de formulaire de collecte](https://cnil.fr/fr/exemples-de-formulaire-de-collecte-de-donnees-caractere-personnel) (page could not be fetched in this session; content not verified)
- [Secondary] Example compliant RGPD forms (2026) — [donneespersonnelles.fr](https://donneespersonnelles.fr/exemple-formulaire-rgpd) (not fetched)

### Inferences
- Under GDPR art. 13 the notice must include controller identity and contact, purposes, legal basis, recipients, retention period, and data-subject rights incl. the right to complain to the CNIL (general GDPR knowledge; the CNIL pages couldn't be fetched to quote).
- For B2C email newsletters, French law (CPCE art. L.34-5) requires prior consent; an unticked checkbox or a dedicated "S'inscrire" action with clear purpose wording is the usual way (verify on the CNIL "prospection commerciale par courrier électronique" page — fetch failed).
- Honest prototype labelling (good practice): replace the submit button with a disabled state plus visible text, e.g. "Inscriptions bientôt ouvertes — formulaire en préparation", or a `mailto:` link. Don't fake a "Merci, c'est envoyé !" success message. If a disabled button is used, keep the explanatory text visible (not just a tooltip) and ensure contrast ≥ 4.5:1 for that text (disabled controls are exempt from 1.4.3, but the explanation is not). For services: badges like "En préparation" / "En développement" should be text, not colour-only.

### Gaps
- Both CNIL pages (form examples and email prospection) failed to load (server error / robots), so the exact CNIL model wording and the L.34-5 details are unverified here and should be checked directly.
