const pptxgen = require('pptxgenjs');
const { applyTheme } = require('/mnt/skills/public/pptx/scripts/apply_theme.js');

const THEME = {
  name: 'Techonest Night',
  headFontFace: 'Arial Black',
  bodyFontFace: 'Calibri',
  colors: {
    dk1: '14111C', lt1: 'F6F2EA', dk2: '221D2E', lt2: 'C9C0D6',
    accent1: 'E8A33D', accent2: '9A4C7E', accent3: '3FA796', accent4: 'D9654B',
    accent5: '5E5770', accent6: 'A8551C', hlink: 'E8A33D', folHlink: 'C9C0D6',
  },
};
const HEX = THEME.colors;

const pres = new pptxgen();
pres.layout = 'LAYOUT_WIDE'; // 13.333 x 7.5
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.title = 'Techonest — Vision & Project Plan';
pres.author = 'Techonest cofounders (draft)';
pres.company = 'Techonest (project, not yet a legal entity)';
const C = pres.SchemeColor;
const S = pres.ShapeType;
const W = 13.333, M = 0.6, CW = W - 2 * M;
const FOOT = 'Techonest · internal draft for the three cofounders · 21 Oct 2026';

// ---------- layouts ----------
pres.defineSlideMaster({
  title: 'COVER',
  background: { color: HEX.dk1 },
  objects: [
    { placeholder: { options: { name: 'title', type: 'title', x: M, y: 2.35, w: 7.6, h: 1.3, fontFace: 'Arial Black', fontSize: 60, bold: true, align: 'left', color: C.background1, valign: 'top', margin: 0 }, text: '' } },
  ],
});
pres.defineSlideMaster({
  title: 'DARK',
  background: { color: HEX.dk1 },
  objects: [
    { placeholder: { options: { name: 'title', type: 'title', x: M, y: 0.72, w: 11.2, h: 0.95, fontFace: 'Arial Black', fontSize: 28, bold: true, align: 'left', color: C.background1, valign: 'top', margin: 0 }, text: '' } },
    { text: { text: FOOT, options: { x: M, y: 7.0, w: 9, h: 0.3, fontSize: 10, color: C.background2, margin: 0 } } },
  ],
  slideNumber: { x: 12.1, y: 7.0, w: 0.6, h: 0.3, fontSize: 10, color: C.background2, align: 'right' },
});
pres.defineSlideMaster({
  title: 'LIGHT',
  background: { color: HEX.lt1 },
  objects: [
    { placeholder: { options: { name: 'title', type: 'title', x: M, y: 0.72, w: 11.2, h: 0.95, fontFace: 'Arial Black', fontSize: 28, bold: true, align: 'left', color: C.text1, valign: 'top', margin: 0 }, text: '' } },
    { text: { text: FOOT, options: { x: M, y: 7.0, w: 9, h: 0.3, fontSize: 10, color: C.accent5, margin: 0 } } },
  ],
  slideNumber: { x: 12.1, y: 7.0, w: 0.6, h: 0.3, fontSize: 10, color: C.accent5, align: 'right' },
});
pres.defineSlideMaster({
  title: 'SECTION',
  background: { color: HEX.dk2 },
  objects: [
    { placeholder: { options: { name: 'title', type: 'title', x: M, y: 2.9, w: 9.5, h: 1.2, fontFace: 'Arial Black', fontSize: 40, bold: true, align: 'left', color: C.background1, valign: 'top', margin: 0 }, text: '' } },
    { text: { text: FOOT, options: { x: M, y: 7.0, w: 9, h: 0.3, fontSize: 10, color: C.background2, margin: 0 } } },
  ],
  slideNumber: { x: 12.1, y: 7.0, w: 0.6, h: 0.3, fontSize: 10, color: C.background2, align: 'right' },
});

// ---------- helpers ----------
let section = '';
function slide(master, title, eyebrow, notes) {
  const s = pres.addSlide({ masterName: master, sectionTitle: section });
  s.addText(title, { placeholder: 'title' });
  const dark = master !== 'LIGHT';
  if (eyebrow) s.addText(eyebrow.toUpperCase(), { x: M, y: 0.36, w: 10, h: 0.3, fontSize: 12, bold: true, charSpacing: 3, color: dark ? C.accent1 : C.accent6, margin: 0, isTextBox: true, objectName: 'eyebrow' });
  if (master === 'DARK' || master === 'LIGHT') motif(s, dark);
  if (notes) s.addNotes(notes);
  return s;
}
function motif(s, dark) { // two overlapping circles: the meeting of the two parts of Techonest
  s.addShape(S.ellipse, { x: 11.95, y: 0.42, w: 0.5, h: 0.5, fill: { color: C.accent1, transparency: dark ? 15 : 10 }, line: { type: 'none' }, objectName: 'motif-a' });
  s.addShape(S.ellipse, { x: 12.27, y: 0.42, w: 0.5, h: 0.5, fill: { color: C.accent2, transparency: 25 }, line: { type: 'none' }, objectName: 'motif-b' });
}
function newSection(t) { section = t; pres.addSection({ title: t }); }
function txt(s, text, o) { s.addText(text, Object.assign({ isTextBox: true, margin: 0, valign: 'top', fontSize: 16 }, o)); }
function box(s, x, y, w, h, fill, extra) { s.addShape(S.roundRect, Object.assign({ x, y, w, h, rectRadius: 0.12, fill: { color: fill }, line: { type: 'none' } }, extra || {})); }
function pill(s, text, x, y, w, fill, color) { s.addShape(S.roundRect, { x, y, w, h: 0.42, rectRadius: 0.21, fill: { color: fill }, line: { type: 'none' } }); txt(s, text, { x, y, w, h: 0.42, fontSize: 13, bold: true, color, align: 'center', valign: 'middle' }); }
function bullets(items, o) { return items.map((t, i) => ({ text: t, options: Object.assign({ bullet: true, breakLine: i < items.length - 1, paraSpaceAfter: 6 }, o || {}) })); }
const SRC = 'Sources checked 20–21 Oct 2026. ';

// =====================================================================
// MAIN DECK
// =====================================================================
newSection('Why Techonest');

// 1 Cover
{
  const s = pres.addSlide({ masterName: 'COVER', sectionTitle: section });
  s.addShape(S.ellipse, { x: 7.6, y: 0.9, w: 4.6, h: 4.6, fill: { color: C.accent1, transparency: 25 }, line: { type: 'none' }, objectName: 'cover-circle-nights' });
  s.addShape(S.ellipse, { x: 9.6, y: 2.2, w: 4.6, h: 4.6, fill: { color: C.accent2, transparency: 35 }, line: { type: 'none' }, objectName: 'cover-circle-network' });
  txt(s, 'INTERNAL DRAFT FOR THE THREE COFOUNDERS · 21 OCTOBER 2026', { x: M, y: 1.4, w: 7.5, h: 0.4, fontSize: 13, bold: true, charSpacing: 3, color: C.accent1 });
  s.addText('TECHONEST', { placeholder: 'title' });
  txt(s, 'Where cultures meet on a Paris stage — and the people who make the night get real, fairly paid work.', { x: M, y: 3.75, w: 7.0, h: 1.3, fontSize: 22, color: C.background1 });
  txt(s, 'Vision and project plan · idea stage · nothing with Rebels Collectif is agreed · all figures are estimates', { x: M, y: 6.55, w: 9.5, h: 0.4, fontSize: 13, color: C.background2 });
  s.addNotes('Purpose of this deck: give the three of us one shared picture of Techonest, then decide what to test first. Be explicit from the first minute: this is an idea with a plan to test it. There is no legal structure, no agreement with Rebels Collectif, no venue and no booked act. Every number later in the deck is an estimate until replaced by quotes.\n\nThe two circles are the visual motif of the deck: the nights (programming identity) and the network (artists and technicians) — the two parts of Techonest that should feed each other.');
}

// 2 Purpose
{
  const s = slide('DARK', 'Four things we should leave this meeting with', 'Why we are meeting', 'Frame the meeting. We are not approving a business plan; we are aligning on a vision, testing its assumptions, sharing work, and choosing the first test.\n\nThe status chips are deliberately blunt so that Gabriel and Ahmad see the real starting point. Roles and weekly time commitments of the three cofounders are still open — the deck never assigns them.');
  const items = [
    ['1', 'Understand', 'One shared picture of the vision: the nights and the network.'],
    ['2', 'Challenge', 'Test the assumptions behind demand, money, law and partners.'],
    ['3', 'Share the work', 'Agree who owns what, how much time each of us can give.'],
    ['4', 'Decide the first test', 'Choose what we check first — before money is committed.'],
  ];
  items.forEach((it, i) => {
    const x = M + i * 3.07;
    box(s, x, 1.95, 2.85, 3.0, C.text2);
    s.addShape(S.ellipse, { x: x + 0.3, y: 2.25, w: 0.7, h: 0.7, fill: { color: C.accent1 }, line: { type: 'none' } });
    txt(s, it[0], { x: x + 0.3, y: 2.25, w: 0.7, h: 0.7, fontSize: 22, bold: true, color: C.text1, align: 'center', valign: 'middle' });
    txt(s, it[1], { x: x + 0.3, y: 3.15, w: 2.3, h: 0.5, fontSize: 20, bold: true, color: C.background1 });
    txt(s, it[2], { x: x + 0.3, y: 3.7, w: 2.3, h: 1.1, fontSize: 15, color: C.background2 });
  });
  txt(s, 'Where we really are', { x: M, y: 5.35, w: 6, h: 0.4, fontSize: 16, bold: true, color: C.accent1 });
  const chips = ['Idea stage', 'No legal structure yet', 'No agreement with Rebels', 'Three cofounders · roles and time open', 'Up to €1,000 of cash'];
  let cx = M; const cw = [1.55, 2.45, 2.6, 3.5, 2.0];
  chips.forEach((c, i) => { pill(s, c, cx, 5.85, cw[i] - 0.15, C.text2, C.background1); cx += cw[i]; });
}

// 3 Two parts
{
  const s = slide('DARK', 'Two parts that make each other stronger', 'The idea', 'The long-term idea has two connected parts. (1) The nights: an event and cultural-programming identity with a recognisable artistic point of view. (2) The network: a trusted community that helps talented artists and technicians find, prepare for and deliver paid creative and technical projects.\n\nWhy they reinforce each other: every night creates paid slots, credits and footage for the network; the network brings skills, new acts and its own audiences back to the nights. This loop is a hypothesis we test at the pilot — it is not proven yet.\n\nDo not imply that every activity can start at once under one structure: the pilot tests the loop on a single night.');
  s.addShape(S.ellipse, { x: 2.4, y: 1.95, w: 4.4, h: 4.4, fill: { color: C.accent1, transparency: 20 }, line: { type: 'none' }, objectName: 'circle-nights' });
  s.addShape(S.ellipse, { x: 5.6, y: 1.95, w: 4.4, h: 4.4, fill: { color: C.accent2, transparency: 25 }, line: { type: 'none' }, objectName: 'circle-network' });
  txt(s, 'The nights', { x: 2.75, y: 3.2, w: 2.8, h: 0.5, fontSize: 24, bold: true, color: C.text1 });
  txt(s, 'Culturally mixed Paris events with a clear artistic point of view', { x: 2.75, y: 3.75, w: 2.8, h: 1.3, fontSize: 15, color: C.text1 });
  txt(s, 'The network', { x: 7.0, y: 3.2, w: 2.8, h: 0.5, fontSize: 24, bold: true, color: C.background1 });
  txt(s, 'Artists and technicians who find, prepare for and deliver paid projects', { x: 7.0, y: 3.75, w: 2.8, h: 1.3, fontSize: 15, color: C.background1 });
  txt(s, 'Paid slots, credits, footage →', { x: 10.3, y: 2.6, w: 2.4, h: 0.9, fontSize: 15, bold: true, color: C.accent1 });
  txt(s, '← Skills, new acts, their own audiences', { x: 10.3, y: 4.4, w: 2.4, h: 0.9, fontSize: 15, bold: true, color: C.background2 });
  txt(s, 'The loop is our hypothesis. The pilot tests it on one night.', { x: M, y: 6.45, w: 9, h: 0.4, fontSize: 14, italic: true, color: C.background2 });
}

// 4 Why it exists
{
  const s = slide('LIGHT', 'Why Techonest should exist, in human terms', 'Why', 'Speak about people, not markets. Both columns are illustrative descriptions of who we hope to serve.\n\nImportant: the claim that this mix of Arab, Afro and electronic music is under-served in Paris is a hypothesis from our own experience. We have no measured evidence of unmet demand yet. The demand tests later in the deck exist to check it.');
  const cols = [
    ['Someone in the audience', ['Hears a voice and percussion from the Middle East or the Maghreb lead into an Afro-house set — in one night, not three venues.', 'Feels the traditions are presented with their artists, not used as decoration.', 'Leaves with a reason to come back: a series with a point of view.']],
    ['Someone behind the stage', ['A student technician or early-career musician gets a paid slot, a clear brief and a contract.', 'Leaves with credits, footage and feedback they can show to the next employer.', 'Joins a network that calls them for the next project.']],
  ];
  cols.forEach((c, i) => {
    const x = M + i * 6.2;
    box(s, x, 1.95, 5.9, 3.95, 'FFFFFF', { shadow: { type: 'outer', blur: 6, offset: 1, angle: 90, color: '000000', opacity: 0.08 } });
    s.addShape(S.ellipse, { x: x + 0.35, y: 2.25, w: 0.4, h: 0.4, fill: { color: i === 0 ? C.accent1 : C.accent2 }, line: { type: 'none' } });
    txt(s, c[0], { x: x + 0.95, y: 2.22, w: 4.7, h: 0.5, fontSize: 20, bold: true, color: C.text1 });
    s.addText(bullets(c[1], { fontSize: 16, color: C.text1 }), { x: x + 0.35, y: 2.95, w: 5.25, h: 2.8, isTextBox: true, margin: 0, valign: 'top' });
  });
  box(s, M, 6.15, CW, 0.55, 'EFE4D3');
  txt(s, 'Hypothesis, not evidence: we believe this mix is under-served in Paris. Nothing has measured it yet.', { x: M + 0.3, y: 6.15, w: CW - 0.6, h: 0.55, fontSize: 15, bold: true, color: C.accent6, valign: 'middle' });
}

// 5 Cultural principles
{
  const s = slide('DARK', 'Traditions meet on stage — they are never the decor', 'The cultural concept', 'These four principles give the concept substance and protect it from cliché. They are proposals for the three of us to adopt, change or reject.\n\n1. Artists curate: the musicians who carry a tradition choose its repertoire and how it is presented.\n2. Context, not costume: no generic "oriental" or "tribal" styling; programme notes and credits say who is playing what and where it comes from.\n3. Real collaborations: crossovers (for example live percussion over a DJ set) are rehearsed between the artists, not stitched together.\n4. Fair pay is part of the art: on paid nights everyone is paid; this is a team policy that goes beyond the legal minimum.\n\nImagery: the deck uses abstract shapes only. Never use a stock photo that could be read as a Techonest event, a founder, a Rebels member or a booked performer.');
  const p = [
    ['Artists curate', 'The people who carry a tradition choose its repertoire and how it is shown.'],
    ['Context, not costume', 'No generic “world music” styling. Credits and programme notes name who plays what, and where it comes from.'],
    ['Real collaborations', 'Crossovers — live percussion over a DJ set — are rehearsed between the artists, not stitched together.'],
    ['Fair pay is part of the art', 'On paid nights everyone is paid. A team policy that goes further than the legal minimum.'],
  ];
  p.forEach((it, i) => {
    const x = M + (i % 2) * 6.2, y = 1.95 + Math.floor(i / 2) * 2.3;
    box(s, x, y, 5.9, 2.05, C.text2);
    s.addShape(S.ellipse, { x: x + 0.35, y: y + 0.38, w: 0.32, h: 0.32, fill: { color: i % 2 ? C.accent2 : C.accent1 }, line: { type: 'none' } });
    txt(s, it[0], { x: x + 0.85, y: y + 0.3, w: 4.8, h: 0.5, fontSize: 20, bold: true, color: C.background1 });
    txt(s, it[1], { x: x + 0.85, y: y + 0.85, w: 4.8, h: 1.1, fontSize: 15, color: C.background2 });
  });
}

// 6 Night journey
{
  const s = slide('DARK', 'One illustrative night: from a live voice to the dance floor', 'Concept — no acts or venue booked', 'This is a concept to make the idea concrete, not a booked programme. Times are illustrative.\n\nThe arc: doors open with the visual identity already present (projections, light, the crew filming), a live set of voice and percussion rooted in Middle Eastern and North African repertoire, a rehearsed crossover where live percussion plays over a DJ set, then a DJ programme moving through Afro-house and electronic music.\n\nFilming and editing run all night. The footage becomes promotion for the next night and portfolio material for every crew member, who is credited by name.\n\nAhmad leading the live set is a suggestion only — he has not agreed to perform.');
  const y = 3.35;
  s.addShape(S.line, { x: M + 0.3, y: y, w: CW - 0.6, h: 0, line: { color: C.background2, width: 1.5 } });
  const steps = [
    ['20:00', 'Doors', 'Visual identity on the walls; crew already filming'],
    ['21:00', 'Live set', 'Voice and percussion, Middle Eastern and North African repertoire'],
    ['22:15', 'Crossover', 'Live percussion over a DJ set, rehearsed together'],
    ['23:00', 'DJ programme', 'Afro-house into electronic'],
    ['After', 'Film and credits', 'Edit, publish, credit every crew member'],
  ];
  steps.forEach((st, i) => {
    const cx = M + 1.2 + i * ((CW - 2.4) / 4);
    s.addShape(S.ellipse, { x: cx - 0.22, y: y - 0.22, w: 0.44, h: 0.44, fill: { color: i === 2 ? C.accent2 : C.accent1 }, line: { color: HEX.dk1, width: 3 } });
    txt(s, st[0], { x: cx - 1.1, y: 2.35, w: 2.2, h: 0.5, fontSize: 22, bold: true, color: C.accent1, align: 'center' });
    txt(s, st[1], { x: cx - 1.15, y: 3.85, w: 2.3, h: 0.45, fontSize: 18, bold: true, color: C.background1, align: 'center' });
    txt(s, st[2], { x: cx - 1.15, y: 4.35, w: 2.3, h: 1.3, fontSize: 14, color: C.background2, align: 'center' });
  });
  box(s, M, 5.95, CW, 0.7, C.text2);
  txt(s, 'Filming and visual identity run all night: the footage promotes the next night and becomes every crew member’s portfolio.', { x: M + 0.3, y: 5.95, w: CW - 0.6, h: 0.7, fontSize: 15, color: C.background1, valign: 'middle' });
}

// 7 First audience + evidence ladder
{
  const s = slide('LIGHT', 'Who comes first — and what would prove they will pay', 'Audience and demand', 'Segments are hypotheses. (1) Rebels Collectif\'s house and Afro-house audience — only reachable if Rebels agrees to promote. (2) People in Paris who follow Arab, Middle Eastern and North African live music, including students. (3) Students and creatives from our schools and networks.\n\nWhy they would pay (hypothesis): a live-plus-DJ night that mixes scenes they usually find separately.\n\nEvidence ladder: an interest form costs nothing to fill in, so it is weak evidence. A waitlist with an e-mail is better, a free reservation better still, and a paid presale is the only strong proof of demand. The pilot\'s go/stop rule therefore counts paid presales only.');
  txt(s, 'Possible first audiences (hypotheses)', { x: M, y: 1.95, w: 6.3, h: 0.4, fontSize: 18, bold: true, color: C.text1 });
  s.addText(bullets([
    'Rebels’ house and Afro-house crowd — if Rebels agrees to promote',
    'People who follow Arab, Middle Eastern and North African live music in Paris',
    'Students and creatives from our schools and networks',
  ], { fontSize: 16, color: C.text1 }), { x: M, y: 2.45, w: 6.2, h: 2.0, isTextBox: true, margin: 0, valign: 'top' });
  txt(s, 'How we reach them', { x: M, y: 4.6, w: 6.3, h: 0.4, fontSize: 18, bold: true, color: C.text1 });
  txt(s, 'Rebels’ channels · artists’ own audiences · community groups · school networks · the footage from each night', { x: M, y: 5.05, w: 6.2, h: 0.9, fontSize: 16, color: C.text1 });
  txt(s, 'Evidence ladder', { x: 7.3, y: 1.95, w: 5.4, h: 0.4, fontSize: 18, bold: true, color: C.text1 });
  const lad = [['Paid presale', 'Strongest — the go/stop rule counts only these', C.accent1, C.text1], ['Free reservation', 'Stronger', 'E7C9A0', C.text1], ['Waitlist with e-mail', 'Better', 'EBDDCB', C.text1], ['Interest form', 'Weak — free to fill in', 'F0E8DC', C.text1]];
  lad.forEach((l, i) => {
    const w = 5.4 - i * 0.6, y = 2.5 + i * 0.95;
    box(s, 7.3, y, w, 0.8, l[2]);
    txt(s, l[0], { x: 7.5, y: y + 0.08, w: w - 0.3, h: 0.35, fontSize: 16, bold: true, color: l[3] });
    txt(s, l[1], { x: 7.5, y: y + 0.42, w: w - 0.3, h: 0.32, fontSize: 13, color: l[3] });
  });
}

// 8 Creator pathway
{
  const s = slide('DARK', 'The creator pathway starts at the pilot', 'The network', 'The pathway for every artist and technician, from first contact to the next opportunity. It can begin at the pilot even though a wider technician service is deferred.\n\nLawful contracts and pay: on a live-show night, artists and live-show technicians are employees of the organiser (Code du travail L7121-3 presumes paid performers are employees). Filming, editing, photo and marketing roles are not covered by GUSO and need their own treatment (employment, or invoices from a genuinely independent business — to confirm with an accountant).\n\nCredits, footage and written feedback are the "useful professional experience" the vision promises; they cost little and should be non-negotiable.');
  const st = ['Discovery', 'Selection', 'Briefing', 'Contract and pay', 'On the night', 'Credits and footage', 'Feedback', 'Next opportunity'];
  const sub = ['Open call, schools, artists’ referrals', 'Clear criteria, a short call', 'Written brief, rehearsal, safety', 'Lawful contract, agreed fee, paid on time', 'A named lead, breaks, a debrief', 'Named credits, files to keep', 'Written notes both ways', 'First call for the next project'];
  st.forEach((t, i) => {
    const col = i % 4, row = Math.floor(i / 4);
    const x = M + col * 3.07, y = 1.95 + row * 2.15;
    box(s, x, y, 2.8, 1.85, i === 3 ? C.accent1 : C.text2);
    txt(s, String(i + 1), { x: x + 0.25, y: y + 0.2, w: 0.6, h: 0.45, fontSize: 20, bold: true, color: i === 3 ? C.text1 : C.accent1 });
    txt(s, t, { x: x + 0.25, y: y + 0.65, w: 2.4, h: 0.4, fontSize: 17, bold: true, color: i === 3 ? C.text1 : C.background1 });
    txt(s, sub[i], { x: x + 0.25, y: y + 1.07, w: 2.4, h: 0.7, fontSize: 13, color: i === 3 ? C.text1 : C.background2 });
    if (col < 3) s.addShape(S.rightArrow, { x: x + 2.83, y: y + 0.8, w: 0.22, h: 0.25, fill: { color: C.background2 }, line: { type: 'none' } });
  });
  txt(s, 'Live-show artists and technicians are employees of the organiser. Filming, editing and marketing need their own treatment — to confirm.', { x: M, y: 6.35, w: CW, h: 0.5, fontSize: 14, italic: true, color: C.background2 });
}

newSection('People and partners');

// 9 Cofounders
{
  const s = slide('LIGHT', 'Three cofounders, three different strengths', 'The team', 'What each person brings is taken only from what has been said so far; nothing here is a role anyone has accepted. Gabriel and Ahmad have agreed to be cofounders; their responsibilities and weekly time are still open.\n\nOscar: the founder\'s own description — organising events, audiovisual studies, DJing, singing, mixing and technical work. His name as used in this deck should be confirmed. His availability (a cycle of three work weeks and one school week, with evenings after 17:00 in school weeks) is from his own description and also needs confirmation.\n\nAhmad: singer and percussionist with a strong Middle Eastern musical background.\n\nGabriel: GrooveBox, a house DJ presented on the Rebels Collectif website as one of its two faces. This creates a conflict-of-interest question in any Techonest–Rebels deal.');
  const p = [
    ['Oscar', 'Founder', ['Event organising and audiovisual studies', 'DJ, singer, mixing, technical work', 'Availability to confirm']],
    ['Ahmad', 'Cofounder', ['Singer and percussionist', 'Strong Middle Eastern musical background', 'Role and time: open']],
    ['Gabriel', 'Cofounder', ['GrooveBox — house DJ', 'Part of Rebels Collectif', 'Role and time: open']],
  ];
  p.forEach((it, i) => {
    const x = M + i * 4.1;
    box(s, x, 1.95, 3.85, 3.2, 'FFFFFF', { shadow: { type: 'outer', blur: 6, offset: 1, angle: 90, color: '000000', opacity: 0.08 } });
    s.addShape(S.ellipse, { x: x + 0.3, y: 2.25, w: 0.75, h: 0.75, fill: { color: [C.accent1, C.accent2, C.accent3][i] }, line: { type: 'none' } });
    txt(s, it[0][0], { x: x + 0.3, y: 2.25, w: 0.75, h: 0.75, fontSize: 22, bold: true, color: C.text1, align: 'center', valign: 'middle' });
    txt(s, it[0], { x: x + 1.25, y: 2.25, w: 2.4, h: 0.45, fontSize: 22, bold: true, color: C.text1 });
    txt(s, it[1], { x: x + 1.25, y: 2.7, w: 2.4, h: 0.35, fontSize: 13, color: C.accent5 });
    s.addText(bullets(it[2], { fontSize: 15, color: C.text1 }), { x: x + 0.3, y: 3.3, w: 3.3, h: 1.75, isTextBox: true, margin: 0, valign: 'top' });
  });
  txt(s, 'To decide together', { x: M, y: 5.45, w: 6, h: 0.4, fontSize: 16, bold: true, color: C.accent6 });
  const chips = ['Weekly time', 'Governance', 'Money rules', 'Artistic direction', 'Membership / ownership', 'Conflicts of interest'];
  let cx = M; const cw = [1.7, 1.7, 1.75, 2.05, 2.6, 2.3];
  chips.forEach((c, i) => { pill(s, c, cx, 5.95, cw[i] - 0.15, 'EFE4D3', C.text1); cx += cw[i]; });
}

// 10 Rebels facts
{
  const s = slide('DARK', 'Rebels Collectif: what is public, what is not', 'The partner opportunity', SRC + '\n- rebelscollectif.com (homepage last modified 9 Mar 2025, © 2024): house / Afro-house DJ collective presented by Play House and GrooveBox; events sold through a Shotgun page; a press kit is linked (not opened). https://rebelscollectif.com/\n- Resident Advisor promoter page: past Paris events in 2025, including Fresh Groove at Le Klub (10 Oct 2025), a night at L\'Impasse (13 Jun 2025), Titi Palacio and La Récolte Citadine (spring 2025). https://ra.co/promoters/159396\n- No mentions légales on the website and no SIREN found under "Rebels Collectif" in public directories. Do not confuse with the association "REBELLES" (Paris 6e, social action) or Paris Country Rebels (line dance).\n\nNothing in the available material shows that Rebels has agreed to collaborate. Everything in the right column must be asked of both Rebels founders.');
  box(s, M, 1.95, 5.9, 3.9, C.text2);
  txt(s, 'Public — checked 20–21 Oct 2026', { x: M + 0.35, y: 2.2, w: 5.3, h: 0.45, fontSize: 18, bold: true, color: C.accent1 });
  s.addText(bullets(['Paris house and Afro-house DJ collective and label', 'Presented by Play House and GrooveBox', 'Tickets sold through Shotgun', '2025 nights at Le Klub, L’Impasse, Titi Palacio', 'No registered legal entity found'], { fontSize: 16, color: C.background1 }), { x: M + 0.35, y: 2.8, w: 5.3, h: 3.7, isTextBox: true, margin: 0, valign: 'top' });
  box(s, M + 6.2, 1.95, 5.93, 3.9, C.accent1);
  txt(s, 'Unconfirmed — ask both founders', { x: M + 6.55, y: 2.2, w: 5.3, h: 0.45, fontSize: 18, bold: true, color: C.text1 });
  s.addText(bullets(['Is Rebels a registered entity, and who decides for it?', 'Who held the licence, paid SACEM and insured past nights?', 'Real ticket numbers and prices of recent nights', 'Does Rebels want a joint night at all — on what terms?', 'Who represents Rebels while Gabriel represents Techonest?'], { fontSize: 16, color: C.text1 }), { x: M + 6.55, y: 2.8, w: 5.3, h: 3.7, isTextBox: true, margin: 0, valign: 'top' });
}

// 11 Collaboration models
{
  const s = slide('LIGHT', 'Three genuinely different ways to work with Rebels', 'Collaboration models — for discussion', 'Three distinct models, each answering the questions that cause disputes later: who is the legal organiser, who contracts and pays people, who holds ticket revenue, who carries the risk, and what must exist first.\n\nA — Rebels leads: lowest risk for Techonest; only possible if Rebels has a legal entity and can act as organiser. Techonest contributes a programme and crew for a fee — which itself requires Techonest to be able to invoice (to confirm).\nB — Co-production: one named legal organiser holds the tickets and contracts; a written co-production agreement shares costs and results. The CNM says the holder of the ticketing is the single declarant even in co-productions (cnm.fr/taxe, checked 21 Oct 2026).\nC — Techonest leads: needs Techonest to exist legally first; Rebels DJs are booked and paid like any other artists.\n\nConflict of interest: in every model a named Rebels person other than Gabriel (for example Play House) negotiates for Rebels; Gabriel takes part in discussions but does not decide on both sides. This is a proposal.');
  const rows = [
    ['', 'A · Rebels leads', 'B · Co-production', 'C · Techonest leads'],
    ['Legal organiser', 'Rebels', 'One named partner', 'Techonest'],
    ['Contracts and pays people', 'Rebels', 'The organiser', 'Techonest'],
    ['Holds ticket revenue', 'Rebels', 'The organiser, then shares by contract', 'Techonest'],
    ['Carries the risk', 'Rebels', 'Shared, as written', 'Techonest'],
    ['Techonest gets', 'A fee, experience, visibility', 'Shared result, joint brand', 'Control, its own brand'],
    ['Must exist first', 'Rebels as a legal entity', 'Agreement + a legal organiser', 'Techonest as a legal entity'],
  ];
  const tr = rows.map((r, ri) => r.map((c, ci) => ({ text: c, options: { bold: ri === 0 || ci === 0, fontSize: 15, color: ri === 0 ? HEX.lt1 : HEX.dk1, fill: { color: ri === 0 ? (ci === 2 ? HEX.accent2 : HEX.dk2) : (ci === 2 ? 'F1E3CF' : 'FFFFFF') }, valign: 'middle', margin: [4, 8, 4, 8] } })));
  s.addTable(tr, { x: M, y: 1.95, w: CW, colW: [2.6, 3.0, 3.4, 3.13], rowH: 0.56, border: { type: 'solid', pt: 0.75, color: 'E4DCCB' } });
  txt(s, 'In every model a Rebels person other than Gabriel — for example Play House — negotiates for Rebels. Proposal, not agreed.', { x: M, y: 6.1, w: CW, h: 0.6, fontSize: 15, bold: true, color: C.accent6 });
}

newSection('The pilot');

// 12 Pilot concept
{
  const s = slide('DARK', 'The pilot: one night, built to learn', 'Proposal — no date, venue or act confirmed', 'A proposal for discussion. Nothing here is booked or agreed.\n\nFormat: the illustrative night from slide 6. Size: 120–200 people, deliberately small so it can sell out. Venue requirements: a bar or club in Paris with its own sound system and licensed security, a bar-share deal rather than a hire fee, a written contract with cancellation terms, and clarity on whether the venue already holds a SACEM contract and a category 1 licence (récépissé valant licence — catégorie 1, exploitant de lieu), which also affects the VAT rate.\n\nStaffing in the lean configuration: 3 paid people (for example 2 artists and 1 live-show technician) plus the venue\'s own sound and security staff; more paid roles only if the budget allows. Timing: February–March 2027. Ticketing test: paid presale in two price tiers (for example an early-bird and a standard price) to learn price sensitivity.\n\nLearning questions on the right are what the pilot is for; making money is not its main purpose.');
  const rows = [['Format', 'Live voice and percussion → crossover → DJ programme'], ['Size', '120–200 people, small enough to sell out'], ['Venue needs', 'Own sound system and security, bar-share deal, cancellation terms'], ['Staffing', 'Lean: 3 paid people + the venue’s own staff'], ['Timing', 'February–March 2027 (proposal)'], ['Ticketing test', 'Paid presale in two price tiers']];
  rows.forEach((r, i) => {
    const y = 1.95 + i * 0.72;
    txt(s, r[0], { x: M, y, w: 2.1, h: 0.6, fontSize: 15, bold: true, color: C.accent1 });
    txt(s, r[1], { x: M + 2.2, y, w: 4.6, h: 0.65, fontSize: 15, color: C.background1 });
  });
  box(s, 7.75, 1.95, 4.98, 4.7, C.text2);
  txt(s, 'What the pilot must teach us', { x: 8.1, y: 2.2, w: 4.4, h: 0.45, fontSize: 18, bold: true, color: C.accent1 });
  s.addText(bullets(['Will people pay for this mix — at what price?', 'What does a lawful night really cost?', 'Does the creator pathway work in practice?', 'Do we and Rebels work well together?'], { fontSize: 16, color: C.background1 }), { x: 8.1, y: 2.8, w: 4.4, h: 3.6, isTextBox: true, margin: 0, valign: 'top' });
}

// 13 Go/stop
{
  const s = slide('LIGHT', 'One continuation threshold, one success target', 'Go / stop rules', 'This replaces the conflicting day −10 rules in the earlier drafts (one draft treated "break-even presales by day −10" as success, another treated "under 60 % of break-even at day −10" as the stop rule).\n\nNew rule (proposal):\n- Continuation threshold at D−14, timed to fall before the cancellation deadlines we negotiate in the venue and artist contracts: paid presales at least 50 % of break-even tickets, otherwise cancel or downsize within contract terms.\n- Success target at D−3: paid presales at least 75 % of break-even; final success = contribution at or above €0 after everyone is paid.\n\nBreak-even depends on the final configuration: about 127 tickets for the lean configuration at €15 (so threshold ≈ 64, target ≈ 95), about 211 for the base configuration.\n\nCancelling is not free: by D−14 we will have spent setup (≈ €200), part of the marketing (≈ €100) and probably a non-refundable insurance premium (≈ €80) — about €380 — plus any cancellation fees the venue and artist contracts allow. Those fees are a contract term to negotiate, not an assumption.');
  const y = 3.2;
  s.addShape(S.line, { x: M + 0.3, y, w: CW - 0.6, h: 0, line: { color: C.accent5, width: 1.5 } });
  const ms = [['D−28', 'Tickets on sale', 'Paid presale opens, two price tiers', null], ['D−14', 'Continuation threshold', 'Paid presales ≥ 50 % of break-even — else cancel or downsize within contract terms', C.accent4], ['D−3', 'Success target', 'Paid presales ≥ 75 % of break-even', C.accent3], ['Night', 'Final test', 'Contribution ≥ €0 after everyone is paid', C.accent1]];
  ms.forEach((m, i) => {
    const cx = M + 1.4 + i * 3.1;
    s.addShape(S.diamond, { x: cx - 0.25, y: y - 0.25, w: 0.5, h: 0.5, fill: { color: m[3] || C.accent5 }, line: { type: 'none' } });
    txt(s, m[0], { x: cx - 1.0, y: 2.2, w: 2.0, h: 0.5, fontSize: 22, bold: true, color: C.text1, align: 'center' });
    txt(s, m[1], { x: cx - 1.35, y: 3.65, w: 2.7, h: 0.4, fontSize: 16, bold: true, color: C.text1, align: 'center' });
    txt(s, m[2], { x: cx - 1.35, y: 4.1, w: 2.7, h: 1.2, fontSize: 14, color: C.text1, align: 'center' });
  });
  box(s, M, 5.6, CW, 1.05, 'EFE4D3');
  txt(s, [{ text: 'Cancelling is not free. ', options: { bold: true } }, { text: 'By D−14 about €380 is already spent (setup, part of the marketing, insurance) — plus whatever cancellation fees the venue and artist contracts allow. Those fees are a term to negotiate.' }], { x: M + 0.3, y: 5.6, w: CW - 0.6, h: 1.05, fontSize: 15, color: C.text1, valign: 'middle' });
}

newSection('The money');

// 14 Where the money goes (bar chart)
{
  const s = slide('LIGHT', 'In the base case, €2,700 of tickets leaves a €310 gap', 'One night, base case — estimates', 'Base case: 180 paid tickets at €15 = €2,700 gross ticket sales (TTC). Deductions: VAT at 20 % = €450 (if the reduced 5.5 % rate applies, see appendix); ticketing fees ≈ 5 % = €135; SACEM placeholder ≈ 8 % = €216 (quote needed); CNM tax 3.5 % of ticket receipts excluding VAT = €79 (applicability to confirm with the CNM). Net receipts = €1,820.\n\nEvent costs: 4 paid people at ≈ €350 employer cost each = €1,400; licensed security €300; marketing €200; gear and transport €150; event insurance €80; venue €0 (bar-share deal). Total €2,130.\n\nContribution = €1,820 − €2,130 = −€310. The base case loses money. The lean configuration (venue provides sound and security, 3 paid people, 150 tickets) leaves about +€237.\n\nAll cost lines are estimates to replace with quotes.');
  const labels = ['VAT (20 %)', 'Ticketing fees', 'SACEM (est.)', 'CNM tax', '4 paid people', 'Security', 'Marketing', 'Gear, transport', 'Insurance'];
  const vals = [450, 135, 216, 79, 1400, 300, 200, 150, 80];
  s.addChart(pres.ChartType.bar, [{ name: 'Cost, €', labels, values: vals }], {
    x: M, y: 1.9, w: 7.6, h: 4.9, barDir: 'bar', catAxisOrientation: 'maxMin',
    chartColors: [HEX.accent2], showValue: true, dataLabelPosition: 'outEnd', dataLabelFontSize: 12, dataLabelColor: HEX.dk1, dataLabelFormatCode: '€#,##0',
    catAxisLabelColor: HEX.dk1, catAxisLabelFontSize: 13, catAxisLabelFontFace: '+mn-lt', dataLabelFontFace: '+mn-lt', valAxisLabelFontFace: '+mn-lt', valAxisHidden: true,
    valGridLine: { style: 'none' }, catGridLine: { style: 'none' }, showLegend: false,
    showTitle: true, title: 'Where €2,700 of ticket sales goes (base case, €)', titleFontSize: 14, titleColor: HEX.dk1, titleFontFace: '+mn-lt',
  });
  box(s, 8.6, 1.95, 4.13, 4.75, C.text1);
  txt(s, 'Gross ticket sales', { x: 8.9, y: 2.2, w: 3.6, h: 0.35, fontSize: 14, color: C.background2 });
  txt(s, '€2,700', { x: 8.9, y: 2.55, w: 3.6, h: 0.6, fontSize: 30, bold: true, color: C.background1, fontFace: 'Arial Black' });
  txt(s, 'Net receipts after VAT, fees, rights', { x: 8.9, y: 3.3, w: 3.6, h: 0.35, fontSize: 14, color: C.background2 });
  txt(s, '€1,820', { x: 8.9, y: 3.65, w: 3.6, h: 0.6, fontSize: 30, bold: true, color: C.background1, fontFace: 'Arial Black' });
  txt(s, 'Contribution after event costs', { x: 8.9, y: 4.4, w: 3.6, h: 0.35, fontSize: 14, color: C.background2 });
  txt(s, '−€310', { x: 8.9, y: 4.75, w: 3.6, h: 0.6, fontSize: 30, bold: true, color: C.accent4, fontFace: 'Arial Black' });
  txt(s, 'A loss. The lean pilot (venue’s own sound and security, 3 paid people, 150 tickets) leaves ≈ +€237.', { x: 8.9, y: 5.5, w: 3.6, h: 1.1, fontSize: 13, color: C.background1 });
}

// 15 Scenarios table
{
  const s = slide('LIGHT', 'Four scenarios for one night', 'Estimates — every line needs a quote', 'All four columns use the same formulas; inputs are in appendix A7.\n\nNet receipts = gross − VAT − (ticketing 5 % + SACEM 8 % of gross + CNM 3.5 % of receipts excluding VAT). Contribution = net receipts − event costs. Break-even tickets = event costs ÷ net receipts per ticket (€10.11 per €15 ticket at 20 % VAT; €8.09 at €12; €12.13 at €18).\n\nChecks: Cautious 1,320 − 220 − 210 = 890; 890 − (400 + 1,050 + 300 + 380) = −1,240. Base 2,700 − 450 − 430 = 1,820; 1,820 − 2,130 = −310. Strong 4,500 − 750 − 716 = 3,034; 3,034 − 2,530 = +504. Lean 2,250 − 375 − 358 = 1,517; 1,517 − 1,280 = +237.\n\nThe lean column is the recommended pilot configuration because its fixed costs (€1,280) are the only ones compatible with €1,000 of available cash once costs are shared.');
  const h = ['Per night, €', 'Cautious', 'Base', 'Strong', 'Lean pilot'];
  const r = [
    ['Paid tickets × price', '110 × €12', '180 × €15', '250 × €18', '150 × €15'],
    ['Gross ticket sales', '1,320', '2,700', '4,500', '2,250'],
    ['VAT at 20 %', '−220', '−450', '−750', '−375'],
    ['Fees, SACEM, CNM', '−210', '−430', '−716', '−358'],
    ['Net receipts', '890', '1,820', '3,034', '1,517'],
    ['Venue', '−400', '0', '0', '0'],
    ['Paid people (≈ €350 each)', '−1,050 (3)', '−1,400 (4)', '−1,750 (5)', '−1,050 (3)'],
    ['Security', '−300', '−300', '−300', '0 (venue)'],
    ['Marketing, insurance, gear', '−380', '−430', '−480', '−230'],
    ['Contribution', '−1,240', '−310', '+504', '+237'],
    ['Break-even, paid tickets', '≈ 263', '≈ 211', '≈ 208', '≈ 127'],
  ];
  const rows = [h.map((c, i) => ({ text: c, options: { bold: true, color: HEX.lt1, fill: { color: i === 4 ? HEX.accent6 : HEX.dk2 }, align: i ? 'right' : 'left' } }))]
    .concat(r.map((row, ri) => row.map((c, ci) => ({ text: c, options: { bold: ri === 9 || ri === 4 || ci === 0, color: (ri === 9 && ci > 0) ? (c.startsWith('−') ? HEX.accent4 : '2E7D6B') : HEX.dk1, fill: { color: ri === 9 ? 'EFE4D3' : (ci === 4 ? 'FBF3E6' : 'FFFFFF') }, align: ci ? 'right' : 'left' } }))));
  s.addTable(rows, { x: M, y: 1.9, w: CW, colW: [3.73, 2.1, 2.1, 2.1, 2.1], rowH: 0.38, fontSize: 15, border: { type: 'solid', pt: 0.75, color: 'E4DCCB' }, margin: [3, 8, 3, 8], valign: 'middle' });
  txt(s, 'Contribution is before setup costs and before any founder pay. Results in red are losses.', { x: M, y: 6.6, w: CW, h: 0.3, fontSize: 11, color: C.accent5 });
}

// 16 Sensitivity chart
{
  const s = slide('DARK', 'Price and attendance move the result most', 'Sensitivity — base costs of €2,130', 'Line chart: contribution of one night with the base cost structure (€2,130 of event costs) for 120 to 250 paid tickets at €12, €15 and €18.\n\nValues (€): at €12: −1,159 / −916 / −674 / −431 / −107; at €15: −916 / −613 / −310 / −6 / +398; at €18: −674 / −310 / +54 / +418 / +904 for 120 / 150 / 180 / 210 / 250 tickets.\n\nBreak-even: €12 → 263 tickets; €15 → 211; €18 → 176.\n\nOther sensitivities at 180 tickets and €15: pay of €250 per person → +€90 (break-even 171); €460 → −€750 (break-even 254). If the 5.5 % VAT rate applies → −€11 (break-even 181). Whether 5.5 % applies depends on the venue holding a category 1 licence, a paid artist physically present, original music performed, and a ticket sold before entry (BOFiP BOI-TVA-LIQ-30-20-40, checked 21 Oct 2026).');
  const L = ['120', '150', '180', '210', '250'];
  s.addChart(pres.ChartType.line, [
    { name: '€12 ticket', labels: L, values: [-1159, -916, -674, -431, -107] },
    { name: '€15 ticket', labels: L, values: [-916, -613, -310, -6, 398] },
    { name: '€18 ticket', labels: L, values: [-674, -310, 54, 418, 904] },
  ], {
    x: M, y: 1.9, w: 8.0, h: 4.9, chartColors: [HEX.lt2, HEX.accent1, HEX.accent3], lineSize: 3, lineDataSymbol: 'circle', lineDataSymbolSize: 8,
    showLegend: true, legendPos: 'b', legendColor: HEX.lt1, legendFontSize: 13, legendFontFace: '+mn-lt',
    catAxisLabelColor: HEX.lt2, valAxisLabelColor: HEX.lt2, catAxisLabelFontSize: 13, valAxisLabelFontSize: 12, catAxisLabelFontFace: '+mn-lt', valAxisLabelFontFace: '+mn-lt',
    valAxisLabelFormatCode: '€#,##0', valGridLine: { color: '3A3448', size: 0.75 }, catGridLine: { style: 'none' },
    showCatAxisTitle: true, catAxisTitle: 'Paid tickets', catAxisTitleColor: HEX.lt2, catAxisTitleFontSize: 12,
    showTitle: true, title: 'Contribution of one night, €', titleColor: HEX.lt1, titleFontSize: 14, titleFontFace: '+mn-lt',
  });
  box(s, 9.0, 1.95, 3.73, 4.75, C.text2);
  txt(s, 'Break-even, paid tickets', { x: 9.3, y: 2.2, w: 3.2, h: 0.4, fontSize: 16, bold: true, color: C.accent1 });
  const be = [['€12', '263'], ['€15', '211'], ['€18', '176']];
  be.forEach((b, i) => { txt(s, b[0], { x: 9.3, y: 2.75 + i * 0.6, w: 1.2, h: 0.5, fontSize: 18, color: C.background2 }); txt(s, b[1], { x: 10.5, y: 2.72 + i * 0.6, w: 1.9, h: 0.5, fontSize: 22, bold: true, color: C.background1, align: 'right' }); });
  txt(s, 'At 180 × €15: pay of €250 → +€90; pay of €460 → −€750; 5.5 % VAT → −€11.', { x: 9.3, y: 4.7, w: 3.2, h: 1.8, fontSize: 14, color: C.background1 });
}

// 17 Cash and exposure (fixed crowding)
{
  const s = slide('DARK', 'Four numbers that decide how big the pilot can be', 'Cash and exposure — estimates', 'Definitions:\n- Setup costs (≈ €200): bank account, visuals and website, small admin. Creating an association is free.\n- Cash needed before the night (≈ €630 in the base case): setup + marketing + event insurance + gear deposits. Ticket income may only arrive after the event — the payout timing of the ticketing platform must be confirmed.\n- Maximum contractual exposure (≈ €2,330 in the base case): what Techonest would owe if every contract is signed and nobody buys a ticket = all event costs (€2,130) + setup (€200).\n- Lean pilot with costs shared 50/50 with a partner: event costs €1,280 ÷ 2 = €640, + setup €200 = €840 — the only configuration that fits within the €1,000 available.\n\nFounder income is a separate question (next slide): none of these numbers is money a founder earns.');
  const n = [['€200', 'Setup before anything', 'Bank, visuals, admin. Creating an association is free.'], ['€630', 'Cash out before the night', 'Base case. Ticket money may arrive only after the event — to confirm.'], ['€2,330', 'Worst case, base pilot', 'Every contract signed and no tickets sold.'], ['€840', 'Worst case, lean pilot shared 50/50', 'The only configuration that fits the €1,000 we have.']];
  n.forEach((it, i) => {
    const x = M + (i % 2) * 6.2, y = 1.95 + Math.floor(i / 2) * 2.4;
    box(s, x, y, 5.9, 2.15, i === 3 ? C.accent1 : C.text2);
    txt(s, it[0], { x: x + 0.35, y: y + 0.25, w: 2.6, h: 0.9, fontSize: 40, bold: true, fontFace: 'Arial Black', color: i === 3 ? C.text1 : C.accent1 });
    txt(s, it[1], { x: x + 3.0, y: y + 0.3, w: 2.65, h: 0.8, fontSize: 17, bold: true, color: i === 3 ? C.text1 : C.background1 });
    txt(s, it[2], { x: x + 0.35, y: y + 1.25, w: 5.2, h: 0.8, fontSize: 14, color: i === 3 ? C.text1 : C.background2 });
  });
}

// 18 Founder income and aspiration
{
  const s = slide('LIGHT', '€13,500 a month is ticket sales, not income', 'The aspiration, honestly', 'The original ambition: three events a month × 300 tickets × €15 average = €13,500 gross ticket sales a month (€162,000 a year) before every cost. It is a future aspiration, not a validated forecast and not personal income.\n\nWith the strong-scenario cost structure, a 300-ticket night at €15 leaves about +€504 if the venue charges no hire fee, and about −€296 with an €800 hire fee. At that volume the organiser would also need a récépissé valant licence and could not rely on the association tax franchise (see appendix).\n\nHow money can reach founders: pay for real work — a cachet as a performer or paid hours as a live-show technician — on a lawful contract, within Oscar\'s 964 hours a year (student titre de séjour, Service-Public F2713). An association cannot distribute profits; paying its leaders is limited (BOFiP BOI-IS-CHAMP-10-50-10-20: up to three-quarters of the SMIC per leader without affecting disinterested management; more only above €200,000 of resources).\n\nStudy fees: the amount was not given — fill in the blank. Number of paid nights needed ≈ annual fees ÷ net pay per night. Realistic only after the pilot proves demand.');
  box(s, M, 1.95, 5.9, 4.7, C.text1);
  txt(s, 'The aspiration', { x: M + 0.35, y: 2.2, w: 5.2, h: 0.4, fontSize: 16, bold: true, color: C.accent1 });
  txt(s, '3 × 300 × €15', { x: M + 0.35, y: 2.7, w: 5.2, h: 0.7, fontSize: 30, bold: true, fontFace: 'Arial Black', color: C.background1 });
  txt(s, '= €13,500 gross ticket sales a month, before every cost. A future goal, not a forecast.', { x: M + 0.35, y: 3.5, w: 5.2, h: 0.9, fontSize: 16, color: C.background1 });
  txt(s, 'One 300-ticket night leaves ≈ +€504 with a free venue, ≈ −€296 with an €800 hire fee. At that volume a licence is needed and the tax franchise cannot be relied on.', { x: M + 0.35, y: 4.55, w: 5.2, h: 1.9, fontSize: 14, color: C.background2 });
  txt(s, 'How money can reach founders', { x: 6.9, y: 1.95, w: 5.8, h: 0.4, fontSize: 18, bold: true, color: C.text1 });
  s.addText(bullets(['Pay for real work: a cachet as performer, hours as a technician — on a lawful contract', 'For Oscar: inside 964 salaried hours a year', 'Never a share of the profits of an association', 'A good night’s surplus funds the next night'], { fontSize: 16, color: C.text1 }), { x: 6.9, y: 2.45, w: 5.8, h: 2.6, isTextBox: true, margin: 0, valign: 'top' });
  box(s, 6.9, 5.25, 5.83, 1.4, 'EFE4D3');
  txt(s, 'Study fees of €[____] a year ÷ net pay per night of €[____] = [__] paid nights. Realistic only after the pilot proves demand.', { x: 7.15, y: 5.25, w: 5.35, h: 1.4, fontSize: 15, bold: true, color: C.text1, valign: 'middle' });
}

newSection('Structure and the law');

// 19 Structure framework
{
  const s = slide('DARK', 'Choosing a structure: judge each option against our goals', 'Decision framework — not settled', 'A decision framework, not a legal conclusion. Words, not colours, carry the ratings.\n\n- Association loi 1901: fits the cultural mission and community; can employ people; cannot distribute profits; tax exemption is not automatic (see appendix A5); Oscar sitting on its board while on a student titre de séjour needs an immigration-law check.\n- Partner-led first event: Rebels (if it has a legal entity) acts as organiser; Techonest needs no structure for the first test but owns nothing yet.\n- Company later (SAS or similar): the right tool for a repeatable business with ownership, investors and a production service; administrative load and accounting from day one; running it on a student titre is doubtful (titre must allow a professional activity — Service-Public F36612 and F22494).\n\nMicro-entreprise is excluded for Oscar on a student titre (Service-Public F36612, verified 7 Apr 2026: "cannot combine the status of student and micro-entrepreneur").');
  const head = ['Our goal', 'Association loi 1901', 'Partner-led first event', 'Company later (SAS)'];
  const rows = [
    ['Cultural mission, community', 'Strong fit', 'Partner’s mission leads', 'Possible, less natural'],
    ['Paid work for artists, technicians', 'Yes, as employer', 'Partner employs', 'Yes, as employer'],
    ['Founder income', 'Pay for work only; leaders’ pay limited', 'Paid by the partner for work', 'Salary or dividends'],
    ['Ownership, governance', 'Members, no owners', 'Partner decides', 'Shareholders'],
    ['Tax', 'Exemption not automatic', 'Partner’s issue', 'Commercial taxes'],
    ['Admin load', 'Low to medium', 'Lowest for us', 'High'],
    ['Fits Oscar’s titre', 'To confirm', 'Yes, as employee within 964 h', 'Doubtful now'],
    ['Scale: series, services', 'Limited by tax and licence rules', 'Not ours', 'Best'],
  ];
  const tr = [head.map((c, i) => ({ text: c, options: { bold: true, color: i ? HEX.dk1 : HEX.lt1, fill: { color: i ? HEX.accent1 : HEX.dk2 } } }))]
    .concat(rows.map(r => r.map((c, ci) => ({ text: c, options: { bold: ci === 0, color: HEX.lt1, fill: { color: ci === 0 ? HEX.dk2 : '2B2538' } } }))));
  s.addTable(tr, { x: M, y: 1.9, w: CW, colW: [3.1, 3.0, 3.0, 3.03], rowH: 0.5, fontSize: 15, border: { type: 'solid', pt: 0.75, color: '3A3448' }, margin: [3, 8, 3, 8], valign: 'middle' });
  txt(s, 'Micro-entreprise is not open to Oscar on a student titre de séjour (Service-Public).', { x: M, y: 6.55, w: CW, h: 0.35, fontSize: 14, italic: true, color: C.background2 });
}

// 20 Legal checkpoints
{
  const s = slide('LIGHT', 'Five legal facts that shape the plan', 'Checkpoints — details in the appendix', SRC + '\n1. Licence: an association whose principal activity is live performance must declare online at least one month before starting (récépissé de déclaration d\'entrepreneur de spectacles vivants, valant licence — Code du travail L7122-3). Organisers whose principal activity is not live performance may give up to six performances a year without it; from the seventh they must declare. Ministère de la Culture, Plateforme des entrepreneurs de spectacles vivants, fiche 4.2. Principal activity is judged from the statutes and actual activity.\n2. GUSO: "réservé aux employeurs qui n\'ont pas pour activité principale" the production or presentation of shows; it covers artists and technicians of a live show (guso.fr). An association whose object is organising events may therefore not be eligible. Filming, editing and marketing are not live-show roles.\n3. Tax: an association is outside commercial taxes only if its management is disinterested, it does not compete with businesses in similar conditions (the 4P test), or its lucrative activities stay ancillary — non-lucrative activities significantly predominant and lucrative receipts ≤ €81,051 in 2026 (BOFiP actualité 5 Aug 2026; BOI-IS-CHAMP-10-50-20-20).\n4. Student work: up to 964 h a year of salaried work; the student card does not allow self-employment; exceeding the limit can lead to withdrawal or non-renewal of the titre (Service-Public F2713). Unpaid work in place of paid work is not a workaround.\n5. Worker lending: "Toute opération à but lucratif ayant pour objet exclusif le prêt de main-d\'oeuvre est interdite" (L8241-1). A genuine production service with its own know-how, supervision and price may be lawful — to confirm with a labour lawyer.');
  const rows = [
    ['Licence', 'If live shows are our principal activity, we must declare before the first show. Otherwise up to 6 shows a year without.', 'DRAC Île-de-France'],
    ['GUSO', 'Only for employers whose principal activity is not shows; covers live-show artists and technicians — not filming, editing, marketing.', 'GUSO / France Travail'],
    ['Tax', 'An association is not automatically tax-free below €81,051: management, competition and activity mix count too.', 'Accountant, tax office'],
    ['Oscar’s work', '≤ 964 salaried hours a year; no self-employment on a student card. Unpaid work is not a workaround.', 'Immigration lawyer'],
    ['Lending workers', 'Profit on lending workers is banned. A defined production service may be lawful.', 'Labour lawyer'],
  ];
  const tr = [['Topic', 'What it means for Techonest', 'Confirm with'].map((c, i) => ({ text: c, options: { bold: true, color: HEX.lt1, fill: { color: HEX.dk2 } } }))]
    .concat(rows.map(r => r.map((c, ci) => ({ text: c, options: { bold: ci === 0, color: HEX.dk1, fill: { color: 'FFFFFF' } } }))));
  s.addTable(tr, { x: M, y: 1.9, w: CW, colW: [2.2, 7.3, 2.63], rowH: [0.45, 0.85, 0.85, 0.85, 0.85, 0.85], fontSize: 15, border: { type: 'solid', pt: 0.75, color: 'E4DCCB' }, margin: [4, 8, 4, 8], valign: 'middle' });
}

newSection('The plan');

// 21 Three horizons
{
  const s = slide('DARK', 'Three horizons: earn the right to the next one', 'From now to 2028', 'Three horizons, each unlocked by evidence from the one before.\n\nNow (October–December 2026): cofounder alignment, legal checks (immigration, DRAC/GUSO, accountant), community building (artist and technician call), the Rebels discussion, and demand tests that end in paid presales.\nPilot and first season (January–June 2027): one feasible, properly organised night, then a limited season of a few nights only if the pilot meets its targets.\nLater (2027–28 and beyond): a repeatable event series; a production or technician service assessed separately (legal model, prohibition on for-profit worker lending); equipment investment only when rentals are proven to cost more than owning.\n\nThe Gate E review in June 2027 also coincides with Oscar\'s residence-status planning for 2027–28.');
  const cols = [
    ['Now', 'Oct – Dec 2026', ['Cofounder roles and time', 'Legal checks: immigration, DRAC, GUSO, accountant', 'Artist and technician call', 'Rebels discussion', 'Demand tests up to paid presales'], C.accent1],
    ['Pilot and first season', 'Jan – Jun 2027', ['One lawful, lean pilot night', 'Creator pathway run for real', 'Settle, review, decide', 'A few more nights only if targets are met'], C.accent2],
    ['Later', '2027 – 28 and beyond', ['Repeatable event series', 'Production or technician service, assessed separately', 'Equipment only when it beats renting', 'Structure for the scale'], C.accent3],
  ];
  cols.forEach((c, i) => {
    const x = M + i * 4.1;
    box(s, x, 1.95, 3.85, 4.75, C.text2);
    s.addShape(S.ellipse, { x: x + 0.3, y: 2.25, w: 0.42, h: 0.42, fill: { color: c[3] }, line: { type: 'none' } });
    txt(s, c[0], { x: x + 0.9, y: 2.2, w: 2.8, h: 0.5, fontSize: 20, bold: true, color: C.background1 });
    txt(s, c[1], { x: x + 0.9, y: 2.7, w: 2.8, h: 0.35, fontSize: 14, color: C.accent1 });
    s.addText(bullets(c[2], { fontSize: 15, color: C.background1 }), { x: x + 0.3, y: 3.3, w: 3.3, h: 3.2, isTextBox: true, margin: 0, valign: 'top' });
  });
}

// 22 90-day plan
{
  const s = slide('LIGHT', 'The next 90 days, phase by phase', 'Usable plan — will change after the first meeting', 'Each phase lists its deliverables, who decides (to agree — no role is assigned here), what it depends on, the evidence required, and the gate that closes it.\n\nPhase 1 (to ≈ 19 Nov 2026): roles, weekly time and decision rules written down; first answers from Rebels; immigration-law check booked for Oscar; EICAR asked in writing about equipment and students. Gate A: roles, structure path and Rebels model agreed.\nPhase 2 (to ≈ 19 Dec 2026): legal organiser identified (association statutes, or Rebels as organiser); DRAC/GUSO question answered for our model; three venue conversations; quotes for security, insurance, SACEM, payroll; artist and technician call launched. Gate B: a legal organiser and one written venue offer.\nPhase 3 (to ≈ 18 Jan 2027): budget from real quotes within the cap; co-production agreement drafted; date and line-up proposed; ticketing set up. Gate: commit only if the budget fits the €1,000 cap; otherwise downsize or wait.');
  const head = ['Phase', 'Deliverables', 'Decided by', 'Depends on', 'Evidence needed', 'Gate'];
  const rows = [
    ['1 · Align\nto ≈ 19 Nov', 'Roles, time, decision rules written; EICAR asked', 'All three', 'Meeting held', 'Each states hours and roles', 'A · roles, structure path, Rebels model'],
    ['2 · Set up\nto ≈ 19 Dec', 'Legal organiser; venue talks; quotes; artist call', '[to agree]', 'Rebels answers; legal checks', 'DRAC/GUSO answer; written venue offer', 'B · organiser + venue offer'],
    ['3 · Commit or wait\nto ≈ 18 Jan', 'Budget from quotes; agreement draft; ticketing', 'All three', 'Quotes; organiser exists', 'Budget within €1,000 cap', 'Book only if it fits'],
  ];
  const tr = [head.map(c => ({ text: c, options: { bold: true, color: HEX.lt1, fill: { color: HEX.dk2 } } }))]
    .concat(rows.map(r => r.map((c, ci) => ({ text: c, options: { bold: ci === 0, color: HEX.dk1, fill: { color: ci === 5 ? 'F1E3CF' : 'FFFFFF' } } }))));
  s.addTable(tr, { x: M, y: 1.9, w: CW, colW: [1.9, 2.6, 1.45, 2.0, 2.2, 1.98], rowH: [0.45, 1.25, 1.25, 1.25], fontSize: 14, border: { type: 'solid', pt: 0.75, color: 'E4DCCB' }, margin: [4, 6, 4, 6], valign: 'top' });
  txt(s, 'Community work runs in parallel: the artist and technician call starts in phase 2, before any event is booked.', { x: M, y: 6.3, w: CW, h: 0.45, fontSize: 15, bold: true, color: C.accent6 });
}

// 23 Roadmap Gantt
{
  const s = slide('DARK', 'Roadmap to June 2027: two tracks, five gates', 'Event production and community building', 'Months October 2026 to June 2027. Production track: Align (Oct–Nov), Set up (Nov–Dec), Prepare the pilot (Dec–Feb), Pilot night (Feb–Mar), Limited season (Apr–Jun, only if Gate D passes). Community track: artist and technician call (Nov–Jan), demand tests up to paid presales (Dec–Feb), creator pathway run at the pilot (Feb–Mar), credits, footage and feedback published (Mar–Apr), network list version 1 (Apr–Jun).\n\nGates: A (mid-Nov, roles and model), B (mid-Dec, organiser + venue offer), C (D−14, continuation threshold), D (after the pilot review: season or stop), E (June: structure for 2027–28, together with Oscar\'s residence-status planning).\n\nThe plan is expected to change after the first meeting.');
  const months = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
  const x0 = M + 2.1, mw = (CW - 2.1) / 9;
  months.forEach((m, i) => { txt(s, m, { x: x0 + i * mw, y: 1.9, w: mw, h: 0.35, fontSize: 13, bold: true, color: C.background2, align: 'center' }); s.addShape(S.line, { x: x0 + i * mw, y: 2.3, w: 0, h: 4.25, line: { color: '3A3448', width: 0.75 } }); });
  txt(s, 'Production', { x: M, y: 2.4, w: 2, h: 0.35, fontSize: 14, bold: true, color: C.accent1 });
  txt(s, 'Community', { x: M, y: 4.55, w: 2, h: 0.35, fontSize: 14, bold: true, color: C.accent2 });
  const bar = (label, a, b, y, col, tc) => { s.addShape(S.roundRect, { x: x0 + a * mw + 0.03, y, w: (b - a) * mw - 0.06, h: 0.36, rectRadius: 0.08, fill: { color: col }, line: { type: 'none' } }); txt(s, label, { x: x0 + a * mw + 0.1, y, w: (b - a) * mw - 0.15, h: 0.36, fontSize: 12, bold: true, color: tc, valign: 'middle' }); };
  bar('Align', 0, 1.6, 2.4, C.accent1, C.text1);
  bar('Set up', 1.6, 2.6, 2.82, C.accent1, C.text1);
  bar('Prepare the pilot', 2.4, 4.7, 3.24, C.accent1, C.text1);
  bar('Pilot night', 4.3, 5.7, 3.66, C.accent6, C.background1);
  bar('Limited season, if Gate D passes', 6.0, 9.0, 4.08, C.accent5, C.background1);
  bar('Artist and technician call', 1.0, 3.8, 4.55, C.accent2, C.background1);
  bar('Demand tests to paid presales', 2.3, 5.0, 4.97, C.accent2, C.background1);
  bar('Pathway at the pilot', 4.3, 6.0, 5.39, C.accent2, C.background1);
  bar('Credits and feedback', 5.3, 7.0, 5.81, C.accent2, C.background1);
  bar('Network list v1', 6.5, 9.0, 6.23, C.accent2, C.background1);
  const gates = [['A', 1.5], ['B', 2.55], ['C', 4.5], ['D', 6.0], ['E', 8.85]];
  gates.forEach(g => { const gx = x0 + g[1] * mw; s.addShape(S.diamond, { x: gx - 0.16, y: 6.62, w: 0.32, h: 0.32, fill: { color: C.background1 }, line: { type: 'none' } }); txt(s, g[0], { x: gx - 0.16, y: 6.62, w: 0.32, h: 0.32, fontSize: 10, bold: true, color: C.text1, align: 'center', valign: 'middle' }); });
  txt(s, 'Gates', { x: M, y: 6.6, w: 2, h: 0.35, fontSize: 14, bold: true, color: C.background1 });
}

// 24 Risks
{
  const s = slide('LIGHT', 'The six risks that matter most', 'Risk register — ratings are judgment', 'Ratings are our judgment, not data. Early signs tell us when a risk is materialising.\n\n1. Too few paid tickets — high likelihood, high impact. Sign: presales below the D−14 threshold. Response: lean configuration, small room, presale tiers, stop rule.\n2. No legal organiser — medium, high. Sign: no answer from Rebels and no association by Gate B. Response: decide the structure path at Gate A.\n3. Unpaid or percentage-based work on a paid night — medium, high. Legally, paid performers are presumed employees; unpaid amateurs in a lucrative show are allowed only with a convention, a declaration and annual caps, and technicians cannot be amateurs (Ministère de la Culture, déclaration de représentations avec participation d\'artistes amateurs). Team policy goes further: everyone on a paid night is paid.\n4. Oscar\'s titre de séjour — low to medium, high. Response: immigration-law check; track hours.\n5. Someone injured — low, high. Response: venue contract, CNAPS-licensed security (a specific card applies above 300 people, décret 2022-592), insurance, trained rigging.\n6. Conflict over Gabriel\'s double role — medium, medium. Response: written rule; another Rebels person negotiates.');
  const head = ['Risk', 'Likelihood', 'Impact', 'Early sign', 'Response'];
  const rows = [
    ['Too few paid tickets', 'High', 'High', 'Below the D−14 threshold', 'Lean set-up, small room, stop rule'],
    ['No legal organiser', 'Medium', 'High', 'Nothing in place by Gate B', 'Choose the structure path at Gate A'],
    ['Unpaid or % pay on a paid night', 'Medium', 'High', 'Pay discussed only after the night', 'Written fair-pay policy; contracts first'],
    ['Oscar’s titre de séjour', 'Low–medium', 'High', 'Hours drifting above plan', 'Lawyer check; track hours'],
    ['Someone injured', 'Low', 'High', 'Crowding, improvised rigging', 'Venue contract, licensed security, insurance'],
    ['Gabriel’s double role', 'Medium', 'Medium', 'Disputes over shares or credit', 'Written rule; another Rebels negotiator'],
  ];
  const tr = [head.map(c => ({ text: c, options: { bold: true, color: HEX.lt1, fill: { color: HEX.dk2 } } }))]
    .concat(rows.map(r => r.map((c, ci) => ({ text: c, options: { bold: ci === 0 || ((ci === 1 || ci === 2) && c === 'High'), color: (ci === 1 || ci === 2) && c === 'High' ? HEX.accent6 : HEX.dk1, fill: { color: 'FFFFFF' } } }))));
  s.addTable(tr, { x: M, y: 1.9, w: CW, colW: [3.0, 1.5, 1.2, 3.0, 3.43], rowH: 0.66, fontSize: 15, border: { type: 'solid', pt: 0.75, color: 'E4DCCB' }, margin: [4, 8, 4, 8], valign: 'middle' });
}

newSection('Decide');

// 25 Decisions
{
  const s = slide('DARK', 'Seven decisions for our first meeting', 'Decide together', 'These are the decisions only the three of us can make. Where the deck makes a proposal, it is labelled as one; no adviser has made a recommendation.\n\n1. Roles and weekly time of each cofounder.\n2. How we decide: consensus first, then a recorded majority; a conflict-of-interest rule for Techonest–Rebels deals.\n3. Which structure path we explore first: association, partner-led first event, or waiting.\n4. Which Rebels model we propose (A, B or C), and who we ask to represent Rebels.\n5. The pilot\'s shape: lean configuration, size, price range, the €1,000 cap.\n6. Money rules: who advances costs, spend limit without a vote (proposal: €100), no profit shares, a written fair-pay policy.\n7. Artistic direction: who curates the programme, and how the artists of each tradition are involved.');
  const d = ['Roles and weekly time', 'How we decide, and the conflict rule', 'Structure path to explore first', 'Rebels model to propose, and our counterpart', 'Pilot shape: size, price, €1,000 cap', 'Money rules and a fair-pay policy', 'Who leads artistic direction'];
  d.forEach((t, i) => {
    const col = i % 4, row = Math.floor(i / 4);
    const x = M + col * 3.07, y = 1.95 + row * 2.4;
    box(s, x, y, 2.85, 2.15, i === 6 ? C.accent2 : C.text2);
    txt(s, String(i + 1), { x: x + 0.3, y: y + 0.25, w: 0.8, h: 0.6, fontSize: 28, bold: true, fontFace: 'Arial Black', color: C.accent1 });
    txt(s, t, { x: x + 0.3, y: y + 0.95, w: 2.3, h: 1.1, fontSize: 17, bold: true, color: C.background1 });
  });
  box(s, M + 3 * 3.07, 1.95 + 2.4, 2.85, 2.15, C.accent1);
  txt(s, 'Record each decision, an owner and a date before we leave the room.', { x: M + 3 * 3.07 + 0.3, y: 1.95 + 2.4 + 0.3, w: 2.3, h: 1.6, fontSize: 16, bold: true, color: C.text1 });
}

// 26 Commitment
{
  const s = slide('DARK', 'Before we leave: who does what, by when', 'Our commitment', 'Fill in the owner and date columns live in the meeting. The owners shown as "[ ]" are blank on purpose: no task is assigned to Gabriel or Ahmad before they accept it. Oscar\'s two tasks concern his own situation and studies.\n\nChecks with Rebels: legal status, decision-makers, past licence/SACEM/insurance practice, ticket history, interest in a joint night, and their negotiator.\nChecks with advisers: immigration lawyer (Oscar\'s board role and paid hours), DRAC Île-de-France and GUSO (licence and payroll for our model), an accountant (tax position, VAT rate), a labour lawyer before any technician service.');
  const head = ['Task', 'Owner', 'By'];
  const rows = [
    ['Ask Rebels: legal status, decision-makers, ticket history, interest', '[ ]', '[ ]'],
    ['Book an immigration-law check on board role and paid hours', 'Oscar', '[ ]'],
    ['Ask EICAR in writing about equipment and student participation', 'Oscar', '[ ]'],
    ['Ask DRAC and GUSO which rules apply to our model', '[ ]', '[ ]'],
    ['Draft the fair-pay policy and the artist and technician call', '[ ]', '[ ]'],
    ['Shortlist three venues that fit the lean configuration', '[ ]', '[ ]'],
  ];
  const tr = [head.map(c => ({ text: c, options: { bold: true, color: HEX.dk1, fill: { color: HEX.accent1 } } }))]
    .concat(rows.map(r => r.map((c, ci) => ({ text: c, options: { bold: ci === 0, color: HEX.lt1, fill: { color: '2B2538' } } }))));
  s.addTable(tr, { x: M, y: 1.9, w: 8.6, colW: [6.0, 1.3, 1.3], rowH: 0.6, fontSize: 15, border: { type: 'solid', pt: 0.75, color: '3A3448' }, margin: [4, 8, 4, 8], valign: 'middle' });
  box(s, 9.55, 1.95, 3.18, 4.2, C.accent1);
  txt(s, 'We meet again', { x: 9.85, y: 2.25, w: 2.6, h: 0.45, fontSize: 18, bold: true, color: C.text1 });
  txt(s, '[date]', { x: 9.85, y: 2.8, w: 2.6, h: 0.7, fontSize: 30, bold: true, fontFace: 'Arial Black', color: C.text1 });
  txt(s, '90 minutes, to close Gate A: roles, structure path, Rebels model.', { x: 9.85, y: 3.7, w: 2.6, h: 2.2, fontSize: 15, color: C.text1 });
}

// =====================================================================
// APPENDIX
// =====================================================================
newSection('Appendix');
{
  const s = pres.addSlide({ masterName: 'SECTION', sectionTitle: section });
  s.addText('Appendix', { placeholder: 'title' });
  txt(s, 'A1 Assumptions and open questions · A2–A5 Legal detail · A6 Financial inputs · A7 Sources · A8 Change log', { x: M, y: 4.2, w: 11, h: 0.9, fontSize: 18, color: C.background2 });
  s.addNotes('Supporting material. The main deck can be presented without it; every legal and financial claim in the main deck is traceable to these pages and to the speaker notes.');
}

// A1 Assumption register
{
  const s = slide('LIGHT', 'A1 · What is confirmed, proposed, estimated or to verify', 'Assumption and open-question register', 'Categories: confirmed facts (from the founder\'s own statements in chat or from a source checked 20–21 Oct 2026); founder goals; proposals in this deck; estimates; external facts needing verification.\n\nName: the founder is called Oscar in this deck because that is how he introduced himself in the planning conversation; confirm before sharing.\nFull register with owners is in the companion notes delivered with this deck.');
  const rows = [
    ['Confirmed', 'Three agreed cofounders (Oscar, Gabriel, Ahmad); student titre de séjour; up to €1,000 cash; Rebels’ public profile; legal rules cited in A2–A6'],
    ['Founder goals', 'Culturally mixed nights; fairly paid work for creators; help with study fees; a culture or entertainment titre for 2027–28; 3 nights a month at 300 × €15 one day'],
    ['Proposals', 'Lean pilot; go / stop thresholds; collaboration models A–C; fair-pay policy; spend limit €100; conflict rule for Gabriel'],
    ['Estimates', 'Pay ≈ €350 per person; SACEM ≈ 8 %; ticketing ≈ 5 %; security €300; marketing, gear, insurance; attendance and prices'],
    ['To verify', 'Oscar’s name, schedule and exact titre; Rebels’ legal status and interest; venue terms; school equipment permission; VAT rate; CNM scope for DJ nights; GUSO eligibility'],
  ];
  const tr = rows.map(r => [{ text: r[0], options: { bold: true, color: HEX.lt1, fill: { color: HEX.dk2 } } }, { text: r[1], options: { color: HEX.dk1, fill: { color: 'FFFFFF' } } }]);
  s.addTable(tr, { x: M, y: 1.9, w: CW, colW: [2.3, 9.83], rowH: 0.92, fontSize: 15, border: { type: 'solid', pt: 0.75, color: 'E4DCCB' }, margin: [5, 8, 5, 8], valign: 'middle' });
}

// A2 Residence and work
{
  const s = slide('LIGHT', 'A2 · Oscar’s residence status and work', 'Legal detail — to confirm with an immigration lawyer', SRC + '\n- Service-Public F2713 (verified 18 Apr 2024): a non-EU student may work up to 964 h a year (60 % of the legal annual working time) as an employee, "à titre accessoire"; the employer declares the hire to the préfecture at least 2 working days before; the student card does not allow self-employment; exceeding the limit can lead to withdrawal or non-renewal. Algerian students follow different rules (certificat de résidence, 50 % limit, work permit). https://www.service-public.gouv.fr/particuliers/vosdroits/F2713\n- Service-Public Entreprendre F36612 (verified 7 Apr 2026): a student on a student titre cannot combine student and micro-entrepreneur status. https://entreprendre.service-public.gouv.fr/vosdroits/F36612\n- Service-Public F16922 (verified 1 Jun 2026), carte de séjour pluriannuelle « talent – profession artistique et culturelle »: for performers or authors; resources at least 70 % of the full-time gross SMIC per month of stay (€1,306.91), at least 51 % from the artistic activity; employed applicants need contracts totalling at least 3 months over 12 months with companies whose main activity is creating or exploiting works of the mind; valid up to 4 years. https://www.service-public.gouv.fr/particuliers/vosdroits/F16922\n- Service-Public F17319 (verified 1 Jun 2026), carte « recherche d\'emploi / création d\'entreprise »: after a master-level French degree, 1 year, allows creating a company linked to the studies. https://www.service-public.gouv.fr/particuliers/vosdroits/F17319\n\nTo confirm: whether contracts with Techonest (if not principally a show company) or with Rebels would count toward the talent card\'s employment condition.');
  const rows = [
    ['Salaried work now', 'Up to 964 h a year, as an employee; the employer declares the hire to the préfecture first', 'Service-Public F2713'],
    ['Self-employment now', 'Not allowed on a student card — no micro-entreprise', 'F2713; F36612'],
    ['Going over 964 h', 'Can lead to withdrawal or refusal to renew the titre. Unpaid work is not a workaround', 'F2713'],
    ['Talent card, artistic (2027–28 goal)', '≥ 70 % of full-time gross SMIC a month (€1,306.91), ≥ 51 % from the artistic activity; up to 4 years', 'F16922'],
    ['After a master’s degree', '1-year card to look for work or create a company linked to the studies', 'F17319'],
  ];
  const tr = [['Question', 'Rule (official source)', 'Source'].map(c => ({ text: c, options: { bold: true, color: HEX.lt1, fill: { color: HEX.dk2 } } }))]
    .concat(rows.map(r => r.map((c, ci) => ({ text: c, options: { bold: ci === 0, color: HEX.dk1, fill: { color: 'FFFFFF' } } }))));
  s.addTable(tr, { x: M, y: 1.9, w: CW, colW: [3.0, 6.9, 2.23], rowH: [0.45, 0.8, 0.7, 0.8, 0.8, 0.7], fontSize: 15, border: { type: 'solid', pt: 0.75, color: 'E4DCCB' }, margin: [4, 8, 4, 8], valign: 'middle' });
  txt(s, 'To confirm: would contracts with Techonest or Rebels count toward the talent card’s employment condition?', { x: M, y: 6.4, w: CW, h: 0.45, fontSize: 14, bold: true, color: C.accent6 });
}

// A3 Live performance rules
{
  const s = slide('LIGHT', 'A3 · Live-performance rules: licence, GUSO, amateurs', 'Legal detail — to confirm with DRAC Île-de-France and GUSO', SRC + '\n- Code du travail L7122-3 (updated 1 Oct 2019): the activity is subject to a declaration producing a « récépissé de déclaration d\'entrepreneur de spectacles vivants, valant licence ». https://code.travail.gouv.fr/code-du-travail/l7122-3\n- Ministère de la Culture, PLATESV fiche 4.2: a legal person whose principal activity is live performance must declare online at least one month before starting; for an accessory activity, up to six performances a year need no formality, and from the seventh the activity must be declared; principal activity is judged from statutes, actual activity and possibly the NAF code. https://www.culture.gouv.fr/thematiques/theatre-spectacles/pour-les-professionnels/plateforme-des-entrepreneurs-de-spectacles-vivants/fiche-4.2.-que-dois-je-declarer-selon-mon-activite-et-mon-statut-juridique\n- Ministère de la Culture, fiches notices: the declarant must hold a higher-education diploma (bac+2 or 120 ECTS), six months of professional live-performance experience, or 125 hours of training; categories 1 (venue operator), 2 (producer, employer of the artists), 3 (presenter); no fee is mentioned.\n- GUSO (guso.fr, checked 21 Oct 2026): reserved for employers whose principal activity is not the production or presentation of shows; covers artists and technicians hired for a live show; free and mandatory for those employers; artists are paid by cachet, technicians declared in hours. https://www.guso.fr/information/accueil\n- Amateurs (Ministère de la Culture, déclaration de représentations avec participation d\'artistes amateurs): unpaid amateurs in a lucrative show only with a convention with the State or a local authority, an online declaration two months ahead, clear mention on communication, and caps (5 performances with individual amateurs, 10 % of the organiser\'s lucrative performances, 10 per amateur per 12 months); technicians cannot be amateurs.\n- Presumption of employment: Code du travail L7121-3 (Unédic circular).');
  const rows = [
    ['Licence', 'Principal activity = shows → declare ≥ 1 month before the first show. Otherwise ≤ 6 shows a year without; from the 7th, declare', 'Culture, fiche 4.2'],
    ['Who can declare', 'Someone with bac+2, 6 months’ live-show experience, or 125 h of training', 'Culture, fiches notices'],
    ['GUSO', 'Only employers whose principal activity is not shows. Live-show artists (cachet) and technicians (hours)', 'guso.fr'],
    ['Other roles', 'Filming, editing, photo, marketing: not GUSO — employment or a genuine independent invoice', 'To confirm'],
    ['Amateurs', 'Unpaid only with a convention, a declaration and caps. Technicians cannot be amateurs', 'Culture'],
  ];
  const tr = [['Topic', 'Rule', 'Source'].map(c => ({ text: c, options: { bold: true, color: HEX.lt1, fill: { color: HEX.dk2 } } }))]
    .concat(rows.map(r => r.map((c, ci) => ({ text: c, options: { bold: ci === 0, color: HEX.dk1, fill: { color: 'FFFFFF' } } }))));
  s.addTable(tr, { x: M, y: 1.9, w: CW, colW: [2.2, 7.6, 2.33], rowH: [0.45, 0.8, 0.7, 0.8, 0.7, 0.7], fontSize: 15, border: { type: 'solid', pt: 0.75, color: 'E4DCCB' }, margin: [4, 8, 4, 8], valign: 'middle' });
  txt(s, 'Consequence: an association created to organise events may need the licence from its first show and may not be able to use GUSO.', { x: M, y: 6.3, w: CW, h: 0.5, fontSize: 14, bold: true, color: C.accent6 });
}

// A4 Association tax and founder pay
{
  const s = slide('LIGHT', 'A4 · Association tax and paying founders', 'Legal detail — to confirm with an accountant', SRC + '\n- BOFiP BOI-IS-CHAMP-10-50-10-20 (7 Jun 2017): non-lucrativity requires disinterested management — run voluntarily, no direct or indirect distribution of profits, no allocation of assets to members; leaders may be paid up to three-quarters of the SMIC each without affecting it; above that, pay is possible only for organisations with more than €200,000 of resources (1 leader), €500,000 (2) or €1,000,000 (3), and at the earliest in the fourth year. Activities that compete with businesses in similar conditions are tested on the 4P: produit, public, prix, publicité. https://bofip.impots.gouv.fr/bofip/2358-PGP.html/identifiant=BOI-IS-CHAMP-10-50-10-20-20170607\n- BOFiP BOI-IS-CHAMP-10-50-20-20: the franchise for ancillary lucrative activities requires disinterested management, non-lucrative activities that stay significantly predominant, and lucrative receipts under the annual threshold; receipts from up to six charity or support events a year are not counted; if a condition fails, the organisation is taxable from 1 January of that year.\n- BOFiP actualité 5 Aug 2026: threshold €81,051 for 2026. https://bofip.impots.gouv.fr/node/381801\n\nPay for work vs profit: paying someone a fair wage for real work under a contract is not a distribution of profit; giving members a share of the surplus is. A board member who is also paid as a performer counts toward the leaders\' pay rules — to confirm.');
  const rows = [
    ['Disinterested management', 'Run voluntarily; no distribution of profits in any form; leaders’ pay ≤ ¾ SMIC each, unless resources exceed €200,000'],
    ['Competition with businesses', 'Ticketed nights compete with clubs: the 4P test (product, public, price, advertising) decides'],
    ['Franchise', 'Only if non-profit activities stay significantly predominant and lucrative receipts ≤ €81,051 in 2026'],
    ['Charity or support events', 'Receipts of up to 6 such events a year are not counted — to confirm whether ours qualify'],
    ['Pay vs profit', 'A fair wage for real work is fine; a share of the surplus is not'],
  ];
  const tr = rows.map(r => [{ text: r[0], options: { bold: true, color: HEX.lt1, fill: { color: HEX.dk2 } } }, { text: r[1], options: { color: HEX.dk1, fill: { color: 'FFFFFF' } } }]);
  s.addTable(tr, { x: M, y: 1.9, w: CW, colW: [3.3, 8.83], rowH: 0.85, fontSize: 15, border: { type: 'solid', pt: 0.75, color: 'E4DCCB' }, margin: [5, 8, 5, 8], valign: 'middle' });
  txt(s, 'Sources: BOFiP BOI-IS-CHAMP-10-50-10-20 and -20-20; BOFiP actualité 5 Aug 2026 (threshold).', { x: M, y: 6.3, w: CW, h: 0.4, fontSize: 12, color: C.accent5 });
}

// A5 Ticket taxes, rights, safety
{
  const s = slide('LIGHT', 'A5 · Ticket taxes, music rights, safety, equipment', 'Legal detail — to confirm per venue', SRC + '\n- VAT (BOFiP BOI-TVA-LIQ-30-20-40): 5.5 % for concerts and variety shows; in venues where drinks are served during the show the normal rate applies, unless the venue holds a drinks licence and a category 1 licence, original music is performed live with at least one paid artist physically present, and a ticket is sold before entry; DJ sets qualify only when they are a genuine act of artistic creation. Dance floors and discothèques: BOI-TVA-LIQ-30-20-50. https://bofip.impots.gouv.fr/bofip/167-PGP.html/identifiant=BOI-TVA-LIQ-30-20-40-20200923\n- CNM tax (cnm.fr/taxe, checked 21 Oct 2026): 3.5 % of ticket receipts excluding VAT, owed by any organiser holding the ticketing (single declarant in co-productions); declare by the end of the third month after the show, whatever the amount; not collected under €80 a year per payer; electronic music is included in "variétés" — DJ nights to confirm with the CNM. https://cnm.fr/taxe/\n- SACEM: the official website could not be accessed from our research tools; a government answer to a parliamentary question describes rights as a percentage of receipts with a 20 % reduction when declared in advance (Assemblée nationale QE 34968). Get a quote, and ask whether the venue already holds a SACEM contract.\n- Security: private-security agents need a CNAPS professional card; a specific card exists for events above 300 people (décret 2022-592). https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000045631922\n- Insurance and equipment: organiser liability insurance is required by venues in practice; school equipment only with written permission covering commercial use and damage.');
  const rows = [
    ['VAT on tickets', '5.5 % for concerts; normal rate in drinks venues unless the venue holds a category 1 licence and a paid artist plays original music', 'BOFiP'],
    ['CNM tax', '3.5 % of receipts excl. VAT, owed by whoever holds the ticketing; DJ nights to confirm', 'cnm.fr'],
    ['SACEM', 'A percentage of receipts; cheaper if declared in advance; the venue may already hold a contract', 'Get a quote'],
    ['Security', 'CNAPS-licensed agents; a specific card above 300 people', 'Décret 2022-592'],
    ['Insurance, equipment', 'Organiser liability insurance; school gear only with written permission for commercial use', 'Venue, EICAR'],
  ];
  const tr = [['Topic', 'Rule', 'Source'].map(c => ({ text: c, options: { bold: true, color: HEX.lt1, fill: { color: HEX.dk2 } } }))]
    .concat(rows.map(r => r.map((c, ci) => ({ text: c, options: { bold: ci === 0, color: HEX.dk1, fill: { color: 'FFFFFF' } } }))));
  s.addTable(tr, { x: M, y: 1.9, w: CW, colW: [2.4, 7.5, 2.23], rowH: [0.45, 0.85, 0.75, 0.75, 0.75, 0.8], fontSize: 15, border: { type: 'solid', pt: 0.75, color: 'E4DCCB' }, margin: [4, 8, 4, 8], valign: 'middle' });
}

// A6 Financial inputs
{
  const s = slide('LIGHT', 'A6 · Financial inputs and what still needs a quote', 'Model assumptions', 'Every input of the financial model. Legal rates are marked; everything else is an estimate to replace with a quote.\n\nFormulas: VAT = gross − gross ÷ (1 + rate). Fees = 5 % × gross. SACEM = 8 % × gross. CNM = 3.5 % × (gross ÷ (1 + VAT rate)). Net receipts = gross − VAT − fees − SACEM − CNM. Contribution = net receipts − (venue + paid people + security + marketing + insurance + gear). Break-even tickets = event costs ÷ net receipts per ticket.\n\nNet receipts per ticket at 20 % VAT: €12 → €8.09; €15 → €10.11; €18 → €12.13. At 5.5 % VAT, €15 → €11.77.');
  const rows = [
    ['VAT', '20 % base; 5.5 % if eligible', 'Legal rate', 'Venue licence, accountant'],
    ['CNM tax', '3.5 % of receipts excl. VAT', 'Legal rate', 'CNM: do DJ nights count?'],
    ['SACEM', '≈ 8 % of gross', 'Placeholder', 'SACEM quote'],
    ['Ticketing fees', '≈ 5 % of gross', 'Estimate', 'Platform terms, payout timing'],
    ['Paid person, employer cost', '≈ €350 (range €250–460)', 'Estimate', 'Payroll simulation'],
    ['Security', '€300 or venue’s own', 'Estimate', 'Venue, two quotes'],
    ['Marketing · insurance · gear', '€150–250 · €80 · €0–150', 'Estimate', 'Quotes'],
    ['Setup', '≈ €200', 'Estimate', 'Bank offers'],
  ];
  const tr = [['Input', 'Value used', 'Type', 'To replace with'].map(c => ({ text: c, options: { bold: true, color: HEX.lt1, fill: { color: HEX.dk2 } } }))]
    .concat(rows.map(r => r.map((c, ci) => ({ text: c, options: { bold: ci === 0, color: HEX.dk1, fill: { color: 'FFFFFF' } } }))));
  s.addTable(tr, { x: M, y: 1.9, w: CW, colW: [3.3, 3.6, 1.9, 3.33], rowH: 0.52, fontSize: 15, border: { type: 'solid', pt: 0.75, color: 'E4DCCB' }, margin: [3, 8, 3, 8], valign: 'middle' });
}

// A7 Sources
{
  const s = slide('LIGHT', 'A7 · Sources (checked 20–21 October 2026)', 'Every material external claim', 'All links were opened on 20–21 October 2026 unless marked. Some secondary sources used in the earlier drafts were replaced by primary sources here. The SACEM website could not be accessed from the research tools; its rates must be obtained directly.');
  const left = [
    'Service-Public F2713 — student work, 964 h (verified 18 Apr 2024)',
    'Service-Public Entreprendre F36612 — students and micro-entreprise (7 Apr 2026)',
    'Service-Public F16922 — talent card, artistic profession (1 Jun 2026)',
    'Service-Public F17319 — job search / company creation card (1 Jun 2026)',
    'Code du travail L7122-3 — récépissé valant licence',
    'Ministère de la Culture — PLATESV fiche 4.2 and fiches notices',
    'Ministère de la Culture — amateurs in lucrative shows',
    'guso.fr — who may use GUSO',
  ];
  const right = [
    'Code du travail L8241-1 — for-profit worker lending',
    'Code du travail L7121-3 — performers presumed employees (Unédic circular)',
    'BOFiP BOI-IS-CHAMP-10-50-10-20 — non-lucrativity, leaders’ pay',
    'BOFiP BOI-IS-CHAMP-10-50-20-20 and actualité 5 Aug 2026 — €81,051',
    'BOFiP BOI-TVA-LIQ-30-20-40 — VAT on shows',
    'cnm.fr/taxe — tax on music and variety shows',
    'Décret 2022-592 — security card above 300 people',
    'rebelscollectif.com · ra.co/promoters/159396 — Rebels',
  ];
  s.addText(bullets(left, { fontSize: 14, color: C.text1 }), { x: M, y: 1.95, w: 5.9, h: 4.8, isTextBox: true, margin: 0, valign: 'top' });
  s.addText(bullets(right, { fontSize: 14, color: C.text1 }), { x: M + 6.2, y: 1.95, w: 5.93, h: 4.8, isTextBox: true, margin: 0, valign: 'top' });
}

// A8 Change log
{
  const s = slide('DARK', 'A8 · What changed from the previous deck', 'Change log', 'Main changes from the 23-slide draft:\n1. Narrative rebuilt around the two connected parts (nights and network) with an illustrative night, an audience and evidence ladder, and a creator pathway.\n2. Legal content corrected against primary sources: the licence is needed from the first show if live performance is the principal activity (not only above six shows); GUSO is reserved for employers whose principal activity is not shows and covers live-show artists and technicians only; the association tax franchise has conditions beyond the €81,051 threshold; leaders\' pay limits added; amateur rules added; "an adviser recommends" removed.\n3. Financial model rebuilt with explicit formulas and four scenarios; the base case is now a loss (−€310) instead of +€240, because pay is estimated at €350 instead of €300 and four paid people are assumed. Cash needed, maximum exposure and founder income are now separate.\n4. Conflicting day −10 rules replaced by a D−14 continuation threshold and a D−3 success target, with cancellation costs made explicit.\n5. Crowded "Three numbers" slide replaced by a 2 × 2 layout with one number per block.\n6. Compliance detail moved to the appendix; decisions and a commitment slide close the main deck.');
  const ch = [
    ['Narrative', 'Built around the nights and the network, with a night journey and a creator pathway'],
    ['Law', 'Licence, GUSO, association tax and founder pay corrected against primary sources'],
    ['Money', 'Rebuilt model: base case is now a loss of €310; cash, exposure and income separated'],
    ['Go / stop', 'One D−14 continuation threshold and one D−3 success target; cancellation costs explicit'],
    ['Design', 'Fewer tables and cards, two diagrams, native charts, the crowded numbers slide fixed'],
  ];
  ch.forEach((c, i) => {
    const y = 1.95 + i * 0.92;
    txt(s, c[0], { x: M, y, w: 2.4, h: 0.8, fontSize: 18, bold: true, color: C.accent1 });
    txt(s, c[1], { x: M + 2.6, y, w: 9.5, h: 0.8, fontSize: 16, color: C.background1 });
  });
}

(async () => {
  const out = '/tmp/claude-0/-home-claude/c4f5fa49-8e7e-57a8-a29e-b0011dbb8df4/scratchpad/pptx/Techonest_Vision_and_Project_Plan.pptx';
  await pres.writeFile({ fileName: out });
  await applyTheme(out, THEME);
  console.log('written', out);
})();
