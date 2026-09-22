/**
 * Line-art motifs for scenes that have no photograph.
 *
 * Every motif is inline SVG drawn in the scene's own accent colour. Nothing is
 * animated by CSS: the renderer screenshots one frame at a time after calling
 * window.__frame(t), so a CSS animation would be frozen at whatever the browser
 * felt like. ART_ENGINE below is spliced into that same function and drives the
 * drawing from the timestamp Node hands in, exactly like the text reveals.
 *
 * Markup contract, read by ART_ENGINE:
 *   data-seq="<n>"     order in the draw sequence (0,1,2...)
 *   data-art="draw"    stroke-dashoffset wipe - path/line/polyline/circle only
 *            "pop"     scale up from the centre
 *            "rise"    slide up while fading in
 *            "grow"    scale on Y from the bottom - bars
 *            "fade"    plain fade (default)
 *   data-loop="pulse"  keeps breathing once drawn
 *             "spin"   keeps rotating
 *             "dash"   marching dashes along the stroke
 *   data-origin="x y"  pivot in viewBox coordinates. Without it a transform
 *                      turns about the element's own bounding box, which for a
 *                      clock hand is the middle of the hand, not the spindle.
 */

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const svg = (body, extra = "") =>
  `<svg viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg" ${extra}>${body}</svg>`;

/**
 * Health Icons (resolvetosavelives/healthicons, CC0) as a second family, reached
 * as `art: "icon:<name>"`. 748 outline icons cover far more of medicine than the
 * hand-drawn set ever will.
 *
 * They are filled shapes, not strokes, so the stroke-dashoffset wipe that gives
 * the hand-drawn motifs their "drawn on screen" feel cannot apply - and with one
 * to three shapes each there is barely a sequence to stagger. The arc behind the
 * icon supplies that missing beat: it draws itself first, then the icon pops in
 * on top, so an imported icon enters the same way a hand-drawn one does.
 */
let HEALTH = null;
const ICON_SHAPES = /<(path|circle|rect|ellipse|polygon|polyline|line)\b/g;

export function healthIcon(name) {
  if (!HEALTH) HEALTH = require("@iconify-json/healthicons/icons.json");
  const ic = HEALTH.icons[name];
  if (!ic) throw new Error(`khong co icon y te: ${name}`);
  const w = ic.width ?? HEALTH.width ?? 48;
  const h = ic.height ?? HEALTH.height ?? 48;
  // Groups are left alone: transforming a <g> and its children both would
  // compound the scale. Only the leaf shapes are staged.
  let i = 1;
  const body = ic.body.replace(ICON_SHAPES, (_, tag) => `<${tag} data-seq="${i++}" data-art="pop"`);
  // The canvas is widened and the icon shrunk into the middle of it, so the arc
  // clears the glyph instead of slicing through it.
  const box = Math.min(w, h) * 1.42;
  const c = box / 2;
  const r = c * 0.92;
  const k = 0.8;
  return `<svg viewBox="0 0 ${box} ${box}" fill="none" xmlns="http://www.w3.org/2000/svg">` +
    `<path data-seq="0" data-art="draw" fill="none" stroke="currentColor" stroke-linecap="round" ` +
    `stroke-width="${(box * 0.017).toFixed(3)}" ` +
    `d="M ${c} ${(c - r).toFixed(2)} A ${r.toFixed(2)} ${r.toFixed(2)} 0 1 1 ` +
    `${(c - r).toFixed(2)} ${c}"/>` +
    `<g transform="translate(${c} ${c}) scale(${k}) translate(${-w / 2} ${-h / 2})">` +
    body + `</g></svg>`;
}

/** Shared stroke setup - colour comes from the scene through currentColor. */
const S = `stroke="currentColor" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"`;
const S4 = `stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"`;

export const ART = {
  /** Heartbeat trace over a heart outline - vitals, health in general. */
  pulse: svg(`
    <path ${S} data-seq="0" data-art="draw"
      d="M200 330 C 90 250, 60 170, 95 120 C 125 78, 180 82, 200 125
         C 220 82, 275 78, 305 120 C 340 170, 310 250, 200 330 Z"/>
    <path ${S} data-seq="1" data-art="draw" data-loop="dash"
      d="M60 205 H140 L162 150 L190 262 L216 196 L240 205 H345"/>
    <circle ${S4} data-seq="2" data-art="pop" data-loop="pulse" cx="345" cy="205" r="12"/>`),

  /** Shield with a tick - safety, data protection, protocol compliance. */
  shield: svg(`
    <path ${S} data-seq="0" data-art="draw"
      d="M200 55 L330 105 V205 C330 285, 272 330, 200 352 C128 330, 70 285, 70 205 V105 Z"/>
    <path ${S} data-seq="1" data-art="draw" d="M142 200 L184 243 L262 160"/>
    <circle ${S4} data-seq="2" data-art="pop" data-loop="pulse" cx="200" cy="203" r="128"
      stroke-dasharray="4 18" opacity="0"/>`),

  /** Neuron with a jolt travelling down the axon - nerve pain, shingles. */
  nerve: svg(`
    <circle ${S} data-seq="0" data-art="draw" cx="104" cy="228" r="40"/>
    <path ${S4} data-seq="1" data-art="draw" d="M76 200 L40 158 M64 228 H22 M78 258 L42 296"/>
    <path ${S4} data-seq="2" data-art="draw" d="M104 188 V142 M132 202 L166 166"/>
    <path ${S} data-seq="3" data-art="draw" d="M144 228 H344"/>
    <rect ${S4} data-seq="4" data-art="pop" x="164" y="210" width="44" height="36" rx="18"/>
    <rect ${S4} data-seq="5" data-art="pop" x="228" y="210" width="44" height="36" rx="18"/>
    <rect ${S4} data-seq="6" data-art="pop" x="292" y="210" width="44" height="36" rx="18"/>
    <path ${S4} data-seq="7" data-art="draw" d="M344 228 L380 196 M344 228 L380 260"/>
    <path ${S} data-seq="8" data-art="draw" data-loop="pulse"
      d="M232 150 L206 100 L254 100 L226 44"/>
    <path ${S4} data-seq="9" data-art="draw" data-loop="pulse"
      d="M158 128 C182 96, 178 62, 150 34"/>
    <path ${S4} data-seq="10" data-art="draw" data-loop="pulse"
      d="M300 128 C276 96, 280 62, 308 34"/>`),

  /** Fine needles standing in skin, with ripples - acupuncture, electro-acupuncture. */
  needle: svg(`
    <path ${S} data-seq="0" data-art="draw" d="M56 296 H344"/>
    <path ${S} data-seq="1" data-art="draw" d="M140 296 L114 122"/>
    <path ${S4} data-seq="2" data-art="draw" d="M100 120 H128 M102 104 H130 M104 88 H132"/>
    <path ${S} data-seq="3" data-art="draw" d="M200 296 V102"/>
    <path ${S4} data-seq="4" data-art="draw" d="M186 100 H214 M186 84 H214 M186 68 H214"/>
    <path ${S} data-seq="5" data-art="draw" d="M260 296 L286 122"/>
    <path ${S4} data-seq="6" data-art="draw" d="M272 120 H300 M274 104 H302 M276 88 H304"/>
    <path ${S4} data-seq="7" data-art="draw" data-loop="pulse"
      d="M144 326 C172 346, 228 346, 256 326"/>
    <path ${S4} data-seq="8" data-art="draw" data-loop="pulse"
      d="M110 356 C156 384, 244 384, 290 356"/>`),

  /** Blood drop above a reader - blood test, blood sugar, sampling. */
  drop: svg(`
    <path ${S} data-seq="0" data-art="draw"
      d="M200 30 C200 30, 272 122, 272 168 A72 72 0 0 1 128 168 C128 122, 200 30, 200 30 Z"/>
    <path ${S4} data-seq="1" data-art="draw" d="M164 174 C164 202, 186 220, 208 220"/>
    <rect ${S} data-seq="2" data-art="draw" x="72" y="272" width="212" height="92" rx="20"/>
    <path ${S4} data-seq="3" data-art="draw" d="M104 302 H180"/>
    <path ${S4} data-seq="4" data-art="draw" d="M104 332 H152"/>
    <path ${S4} data-seq="5" data-art="draw" data-loop="pulse" d="M210 318 L230 338 L264 294"/>
    <path ${S4} data-seq="6" data-art="draw" d="M284 318 H352"/>`),

  /** Clock with a sweeping hand - duration, delay, waiting, time saved. */
  clock: svg(`
    <circle ${S} data-seq="0" data-art="draw" cx="200" cy="208" r="140"/>
    <path ${S4} data-seq="1" data-art="draw" d="M200 88 V104 M320 208 H304 M200 328 V312 M80 208 H96"/>
    <path ${S} data-seq="2" data-art="draw" d="M200 208 V128"/>
    <path ${S} data-seq="3" data-art="draw" data-loop="spin" data-origin="200 208"
      d="M200 208 L262 248"/>
    <circle ${S4} data-seq="4" data-art="pop" cx="200" cy="208" r="10"/>`),

  /** Rows ticking off one by one - checklists, principles, criteria. */
  check: svg(`
    <rect ${S4} data-seq="0" data-art="rise" x="54" y="72" width="54" height="54" rx="12"/>
    <path ${S} data-seq="1" data-art="draw" d="M68 99 L82 113 L110 82"/>
    <path ${S4} data-seq="2" data-art="draw" d="M132 99 H346"/>
    <rect ${S4} data-seq="3" data-art="rise" x="54" y="176" width="54" height="54" rx="12"/>
    <path ${S} data-seq="4" data-art="draw" d="M68 203 L82 217 L110 186"/>
    <path ${S4} data-seq="5" data-art="draw" d="M132 203 H310"/>
    <rect ${S4} data-seq="6" data-art="rise" x="54" y="280" width="54" height="54" rx="12"/>
    <path ${S} data-seq="7" data-art="draw" d="M68 307 L82 321 L110 290"/>
    <path ${S4} data-seq="8" data-art="draw" d="M132 307 H334"/>`),

  /** Bars climbing under a trend arrow - results, effectiveness, growth. */
  chart: svg(`
    <path ${S} data-seq="0" data-art="draw" d="M62 62 V338 H344"/>
    <rect ${S4} data-seq="1" data-art="grow" x="96" y="250" width="44" height="88" rx="8"/>
    <rect ${S4} data-seq="2" data-art="grow" x="164" y="198" width="44" height="140" rx="8"/>
    <rect ${S4} data-seq="3" data-art="grow" x="232" y="146" width="44" height="192" rx="8"/>
    <rect ${S4} data-seq="4" data-art="grow" x="300" y="98" width="44" height="240" rx="8"/>
    <path ${S} data-seq="5" data-art="draw" d="M104 226 L186 172 L254 122 L330 74"/>
    <path ${S} data-seq="6" data-art="draw" d="M296 74 H330 V108"/>`),

  /** A record being scanned - medical records, review, screening. */
  doc: svg(`
    <path ${S} data-seq="0" data-art="draw"
      d="M96 48 H244 L304 108 V352 H96 Z"/>
    <path ${S4} data-seq="1" data-art="draw" d="M244 48 V108 H304"/>
    <path ${S4} data-seq="2" data-art="draw" d="M134 160 H266"/>
    <path ${S4} data-seq="3" data-art="draw" d="M134 206 H266"/>
    <path ${S4} data-seq="4" data-art="draw" d="M134 252 H214"/>
    <path ${S} data-seq="5" data-art="draw" data-loop="dash" d="M62 300 H338"/>
    <circle ${S} data-seq="6" data-art="pop" data-loop="pulse" cx="276" cy="284" r="48"/>
    <path ${S} data-seq="7" data-art="draw" d="M312 320 L352 360"/>`),

  /** Leaves over a decoction bowl - herbal medicine, traditional medicine. */
  herb: svg(`
    <path ${S} data-seq="0" data-art="draw"
      d="M74 268 H326 C326 322, 282 352, 200 352 C118 352, 74 322, 74 268 Z"/>
    <path ${S} data-seq="1" data-art="draw" d="M200 268 V182"/>
    <path ${S} data-seq="2" data-art="draw"
      d="M200 216 C154 216, 122 190, 118 146 C164 142, 196 168, 200 216 Z"/>
    <path ${S} data-seq="3" data-art="draw"
      d="M200 196 C246 196, 278 170, 282 126 C236 122, 204 148, 200 196 Z"/>
    <path ${S4} data-seq="4" data-art="draw" data-loop="pulse"
      d="M146 96 C168 72, 146 54, 164 32"/>
    <path ${S4} data-seq="5" data-art="draw" data-loop="pulse"
      d="M246 96 C268 72, 246 54, 264 32"/>`),

  /** Syringe with a dose arc - vaccination, injection, immunisation. */
  syringe: svg(`
    <path ${S} data-seq="0" data-art="draw" d="M96 304 L212 188"/>
    <path ${S} data-seq="1" data-art="draw"
      d="M196 172 L228 140 L316 228 L284 260 Z"/>
    <path ${S} data-seq="2" data-art="draw" d="M268 100 L356 188"/>
    <path ${S4} data-seq="3" data-art="draw" d="M300 132 L332 100 M252 180 L284 148"/>
    <path ${S4} data-seq="4" data-art="draw" d="M96 304 L64 336 M78 286 L110 318"/>
    <path ${S4} data-seq="5" data-art="draw" data-loop="pulse"
      d="M118 168 C86 136, 86 96, 118 62"/>
    <path ${S4} data-seq="6" data-art="draw" data-loop="pulse"
      d="M166 152 C146 130, 146 104, 166 82"/>`),

  /** Lungs with a windpipe - respiratory illness, pneumonia, COPD, asthma. */
  lungs: svg(`
    <path ${S} data-seq="0" data-art="draw" d="M200 52 V158"/>
    <path ${S4} data-seq="1" data-art="draw" d="M200 106 L152 140 M200 106 L248 140"/>
    <path ${S} data-seq="2" data-art="draw" data-loop="pulse"
      d="M180 150 C120 162, 78 214, 74 282 C72 322, 96 348, 130 344
         C162 340, 180 310, 180 268 Z"/>
    <path ${S} data-seq="3" data-art="draw" data-loop="pulse"
      d="M220 150 C280 162, 322 214, 326 282 C328 322, 304 348, 270 344
         C238 340, 220 310, 220 268 Z"/>`),

  /** Virus particle with spikes - influenza, infection, contagion. */
  virus: svg(`
    <circle ${S} data-seq="0" data-art="draw" cx="200" cy="200" r="92"/>
    <path ${S4} data-seq="1" data-art="draw" d="M200 108 V52 M200 292 V348"/>
    <path ${S4} data-seq="2" data-art="draw" d="M108 200 H52 M292 200 H348"/>
    <path ${S4} data-seq="3" data-art="draw" d="M135 135 L96 96 M265 265 L304 304"/>
    <path ${S4} data-seq="4" data-art="draw" d="M265 135 L304 96 M135 265 L96 304"/>
    <circle ${S4} data-seq="5" data-art="pop" data-loop="pulse" cx="200" cy="44" r="14"/>
    <circle ${S4} data-seq="6" data-art="pop" data-loop="pulse" cx="200" cy="356" r="14"/>
    <circle ${S4} data-seq="7" data-art="pop" data-loop="pulse" cx="44" cy="200" r="14"/>
    <circle ${S4} data-seq="8" data-art="pop" data-loop="pulse" cx="356" cy="200" r="14"/>
    <circle ${S4} data-seq="9" data-art="pop" cx="88" cy="88" r="12"/>
    <circle ${S4} data-seq="10" data-art="pop" cx="312" cy="312" r="12"/>
    <circle ${S4} data-seq="11" data-art="pop" cx="312" cy="88" r="12"/>
    <circle ${S4} data-seq="12" data-art="pop" cx="88" cy="312" r="12"/>
    <circle ${S4} data-seq="13" data-art="draw" cx="174" cy="182" r="20"/>
    <circle ${S4} data-seq="14" data-art="draw" cx="228" cy="224" r="16"/>`),

  /** Stethoscope - examination, consultation, the doctor's visit. */
  stetho: svg(`
    <path ${S} data-seq="0" data-art="draw"
      d="M116 56 V150 C116 206, 156 244, 206 244 C256 244, 296 206, 296 150 V56"/>
    <path ${S4} data-seq="1" data-art="draw" d="M96 48 H136 M276 48 H316"/>
    <path ${S} data-seq="2" data-art="draw" d="M206 244 V286 C206 330, 244 358, 286 358"/>
    <circle ${S} data-seq="3" data-art="pop" data-loop="pulse" cx="326" cy="342" r="40"/>
    <circle ${S4} data-seq="4" data-art="pop" cx="326" cy="342" r="16"/>`),

  /** Hospital block with a cross - the facility, departments, admission. */
  hospital: svg(`
    <path ${S} data-seq="0" data-art="draw" d="M70 348 H330"/>
    <path ${S} data-seq="1" data-art="draw" d="M96 348 V128 L200 62 L304 128 V348"/>
    <path ${S} data-seq="2" data-art="draw" d="M200 136 V196 M170 166 H230"/>
    <rect ${S4} data-seq="3" data-art="rise" x="132" y="228" width="44" height="44" rx="8"/>
    <rect ${S4} data-seq="4" data-art="rise" x="224" y="228" width="44" height="44" rx="8"/>
    <path ${S4} data-seq="5" data-art="draw" d="M176 348 V294 H224 V348"/>`),

  /** Brain with a spark - neurology, stroke, mental health, thinking. */
  brain: svg(`
    <path ${S} data-seq="0" data-art="draw"
      d="M200 92 C168 60, 112 68, 100 112 C64 124, 58 176, 88 198
         C74 236, 104 276, 144 270 C158 306, 212 310, 226 276"/>
    <path ${S} data-seq="1" data-art="draw"
      d="M200 92 C232 60, 288 68, 300 112 C336 124, 342 176, 312 198
         C326 236, 296 276, 256 270"/>
    <path ${S} data-seq="2" data-art="draw" d="M200 92 V300"/>
    <path ${S4} data-seq="3" data-art="draw" d="M200 150 C166 150, 152 170, 152 196"/>
    <path ${S4} data-seq="4" data-art="draw" d="M200 214 C236 214, 250 234, 250 258"/>
    <path ${S} data-seq="5" data-art="draw" data-loop="pulse"
      d="M200 300 V344 M200 344 L172 372 M200 344 L228 372"/>`),

  /** Bone - orthopaedics, fracture, joints, musculoskeletal. */
  bone: svg(`
    <path ${S} data-seq="0" data-art="draw"
      d="M126 274 L274 126"/>
    <path ${S} data-seq="1" data-art="draw"
      d="M126 274 C104 252, 72 262, 68 292 C40 300, 40 340, 68 348
         C76 376, 116 376, 124 348 C154 344, 164 312, 142 290 Z"/>
    <path ${S} data-seq="2" data-art="draw"
      d="M274 126 C296 148, 328 138, 332 108 C360 100, 360 60, 332 52
         C324 24, 284 24, 276 52 C246 56, 236 88, 258 110 Z"/>
    <path ${S4} data-seq="3" data-art="draw" data-loop="pulse"
      d="M186 176 L214 224 M214 176 L186 224"/>`),

  /** Eye with an iris - ophthalmology, screening, watching over. */
  eye: svg(`
    <path ${S} data-seq="0" data-art="draw"
      d="M40 200 C96 122, 154 84, 200 84 C246 84, 304 122, 360 200
         C304 278, 246 316, 200 316 C154 316, 96 278, 40 200 Z"/>
    <circle ${S} data-seq="1" data-art="draw" cx="200" cy="200" r="66"/>
    <circle ${S4} data-seq="2" data-art="pop" data-loop="pulse" cx="200" cy="200" r="26"/>
    <path ${S4} data-seq="3" data-art="draw" d="M200 84 V44 M96 116 L70 82 M304 116 L330 82"/>`),

  /** Tooth - dentistry, oral care. */
  tooth: svg(`
    <path ${S} data-seq="0" data-art="draw"
      d="M112 96 C140 64, 180 76, 200 88 C220 76, 260 64, 288 96
         C316 128, 306 190, 292 234 C280 272, 272 340, 250 344
         C228 348, 226 288, 200 288 C174 288, 172 348, 150 344
         C128 340, 120 272, 108 234 C94 190, 84 128, 112 96 Z"/>
    <path ${S4} data-seq="1" data-art="draw" d="M156 142 C176 128, 200 130, 216 142"/>
    <circle ${S4} data-seq="2" data-art="pop" data-loop="pulse" cx="278" cy="132" r="12"/>`),

  /** A single kidney with its ureter - nephrology, urology, dialysis. */
  kidney: svg(`
    <path ${S} data-seq="0" data-art="draw" data-loop="pulse"
      d="M232 54 C150 54, 84 120, 84 198 C84 276, 150 338, 232 338
         C280 338, 306 306, 288 270 C266 226, 266 168, 288 122 C306 86, 280 54, 232 54 Z"/>
    <path ${S4} data-seq="1" data-art="draw"
      d="M274 196 C250 196, 232 180, 226 156"/>
    <path ${S4} data-seq="2" data-art="draw"
      d="M274 196 C250 196, 232 212, 226 238"/>
    <path ${S} data-seq="3" data-art="draw" data-loop="dash"
      d="M288 210 C322 236, 332 300, 316 368"/>`)  ,

  /** Microscope - laboratory, pathology, microbiology, testing. */
  micro: svg(`
    <path ${S} data-seq="0" data-art="draw" d="M84 348 H316"/>
    <path ${S} data-seq="1" data-art="draw" d="M124 348 C124 274, 168 236, 214 230"/>
    <path ${S} data-seq="2" data-art="draw" d="M150 306 H272"/>
    <path ${S} data-seq="3" data-art="draw"
      d="M206 96 L262 68 L300 146 L244 174 Z"/>
    <path ${S4} data-seq="4" data-art="draw" d="M244 174 L268 224 L220 248 L196 198 Z"/>
    <path ${S4} data-seq="5" data-art="draw" d="M228 60 L282 34"/>
    <circle ${S4} data-seq="6" data-art="pop" data-loop="pulse" cx="120" cy="150" r="30"/>`),

  /** Capsule and tablet - medication, prescription, pharmacy. */
  pill: svg(`
    <path ${S} data-seq="0" data-art="draw"
      d="M96 212 L212 96 A82 82 0 0 1 328 212 L212 328 A82 82 0 0 1 96 212 Z"/>
    <path ${S} data-seq="1" data-art="draw" d="M154 154 L270 270"/>
    <circle ${S} data-seq="2" data-art="draw" cx="106" cy="322" r="58"/>
    <path ${S4} data-seq="3" data-art="draw" data-loop="pulse" d="M66 322 H146"/>`),

  /** Calendar with a marked day - appointments, schedule, periodic checks. */
  calendar: svg(`
    <rect ${S} data-seq="0" data-art="draw" x="62" y="88" width="276" height="256" rx="20"/>
    <path ${S} data-seq="1" data-art="draw" d="M62 160 H338"/>
    <path ${S4} data-seq="2" data-art="draw" d="M126 56 V112 M274 56 V112"/>
    <circle ${S4} data-seq="3" data-art="pop" cx="128" cy="208" r="12"/>
    <circle ${S4} data-seq="4" data-art="pop" cx="200" cy="208" r="12"/>
    <circle ${S4} data-seq="5" data-art="pop" cx="272" cy="208" r="12"/>
    <circle ${S4} data-seq="6" data-art="pop" cx="128" cy="276" r="12"/>
    <circle ${S} data-seq="7" data-art="pop" data-loop="pulse" cx="200" cy="276" r="30"/>
    <path ${S4} data-seq="8" data-art="draw" d="M186 276 L197 288 L216 264"/>`),

  /** Handset with call waves - hotline, booking by phone. */
  phone: svg(`
    <path ${S} data-seq="0" data-art="draw"
      d="M118 72 C96 72, 72 96, 72 124 C72 244, 156 328, 276 328
         C304 328, 328 304, 328 282 C328 268, 320 258, 306 252
         L256 232 C244 228, 232 232, 226 244 L212 268
         C170 248, 152 230, 132 188 L156 174 C168 168, 172 156, 168 144
         L148 94 C142 80, 132 72, 118 72 Z"/>
    <path ${S4} data-seq="1" data-art="draw" data-loop="pulse"
      d="M244 92 C282 92, 308 118, 308 156"/>
    <path ${S4} data-seq="2" data-art="draw" data-loop="pulse"
      d="M244 40 C312 40, 360 88, 360 156"/>`),

  /** Cupped hands holding a heart - care, support, compassion. */
  care: svg(`
    <path ${S} data-seq="0" data-art="draw" data-loop="pulse"
      d="M200 200 C150 162, 128 126, 148 100 C166 78, 194 84, 200 108
         C206 84, 234 78, 252 100 C272 126, 250 162, 200 200 Z"/>
    <path ${S} data-seq="1" data-art="draw"
      d="M64 214 C64 264, 96 312, 148 330 L200 348"/>
    <path ${S} data-seq="2" data-art="draw"
      d="M336 214 C336 264, 304 312, 252 330 L200 348"/>
    <path ${S4} data-seq="3" data-art="draw" d="M64 214 L110 258 M336 214 L290 258"/>`),

  /** Glass and droplets - hydration, fluids, nutrition advice. */
  water: svg(`
    <path ${S} data-seq="0" data-art="draw"
      d="M126 128 H274 L256 344 H144 Z"/>
    <path ${S} data-seq="1" data-art="draw" data-loop="dash"
      d="M136 224 C166 210, 200 238, 234 224 C252 216, 258 216, 266 220"/>
    <path ${S4} data-seq="2" data-art="draw" data-loop="pulse"
      d="M200 44 C200 44, 230 84, 230 104 A30 30 0 0 1 170 104 C170 84, 200 44, 200 44 Z"/>
    <path ${S4} data-seq="3" data-art="draw" d="M126 128 H274"/>`),

  /** Cigarette crossed out - tobacco-free, prevention, lifestyle. */
  nosmoke: svg(`
    <circle ${S} data-seq="0" data-art="draw" cx="200" cy="200" r="150"/>
    <path ${S} data-seq="1" data-art="draw" data-loop="pulse" d="M94 306 L306 94"/>
    <rect ${S4} data-seq="2" data-art="draw" x="96" y="210" width="184" height="46" rx="10"/>
    <path ${S4} data-seq="3" data-art="draw" d="M236 210 V256 M268 210 V256"/>
    <path ${S4} data-seq="4" data-art="draw" d="M294 178 C318 158, 318 130, 294 110"/>`),

  /** Bedside monitor with a trace - intensive care, observation after treatment. */
  monitor: svg(`
    <rect ${S} data-seq="0" data-art="draw" x="56" y="78" width="288" height="204" rx="18"/>
    <path ${S} data-seq="1" data-art="draw" data-loop="dash"
      d="M88 188 H144 L164 138 L190 240 L214 180 L236 188 H312"/>
    <path ${S4} data-seq="2" data-art="draw" d="M200 282 V320 M136 320 H264"/>
    <circle ${S4} data-seq="3" data-art="pop" data-loop="pulse" cx="312" cy="112" r="12"/>`),

  /** Chest film on a light box - radiology, CT, imaging. */
  xray: svg(`
    <rect ${S} data-seq="0" data-art="draw" x="72" y="48" width="256" height="304" rx="16"/>
    <path ${S} data-seq="1" data-art="draw" d="M200 96 V296"/>
    <path ${S4} data-seq="2" data-art="draw" d="M200 130 C160 132, 132 152, 124 178"/>
    <path ${S4} data-seq="3" data-art="draw" d="M200 130 C240 132, 268 152, 276 178"/>
    <path ${S4} data-seq="4" data-art="draw" d="M200 178 C154 180, 122 202, 114 232"/>
    <path ${S4} data-seq="5" data-art="draw" d="M200 178 C246 180, 278 202, 286 232"/>
    <path ${S4} data-seq="6" data-art="draw" d="M200 226 C150 228, 116 252, 108 284"/>
    <path ${S4} data-seq="7" data-art="draw" d="M200 226 C250 228, 284 252, 292 284"/>
    <path ${S4} data-seq="8" data-art="draw"
      d="M200 108 C142 112, 104 158, 100 226 C98 262, 106 290, 116 306"/>
    <path ${S4} data-seq="9" data-art="draw"
      d="M200 108 C258 112, 296 158, 300 226 C302 262, 294 290, 284 306"/>
    <path ${S4} data-seq="10" data-art="draw" data-loop="dash" d="M72 330 H328"/>`),

  /** Double helix - genetics, molecular testing, immunology. */
  dna: svg(`
    <path ${S} data-seq="0" data-art="draw" data-loop="pulse"
      d="M132 44 C132 108, 268 148, 268 200 C268 252, 132 292, 132 356"/>
    <path ${S} data-seq="1" data-art="draw" data-loop="pulse"
      d="M268 44 C268 108, 132 148, 132 200 C132 252, 268 292, 268 356"/>
    <path ${S4} data-seq="2" data-art="draw" d="M146 86 H254"/>
    <path ${S4} data-seq="3" data-art="draw" d="M172 128 H228"/>
    <path ${S4} data-seq="4" data-art="draw" d="M172 272 H228"/>
    <path ${S4} data-seq="5" data-art="draw" d="M146 314 H254"/>`),

  /** Three figures - the team, staff, the community. */
  team: svg(`
    <circle ${S} data-seq="0" data-art="draw" cx="200" cy="112" r="50"/>
    <path ${S} data-seq="1" data-art="draw"
      d="M128 268 C128 216, 160 184, 200 184 C240 184, 272 216, 272 268"/>
    <circle ${S4} data-seq="2" data-art="draw" cx="86" cy="176" r="38"/>
    <path ${S4} data-seq="3" data-art="draw"
      d="M30 306 C30 262, 54 236, 86 236 C102 236, 116 242, 126 254"/>
    <circle ${S4} data-seq="4" data-art="draw" cx="314" cy="176" r="38"/>
    <path ${S4} data-seq="5" data-art="draw"
      d="M370 306 C370 262, 346 236, 314 236 C298 236, 284 242, 274 254"/>`),

  /** Medal with a ribbon - awards, recognition, quality standards. */
  award: svg(`
    <circle ${S} data-seq="0" data-art="draw" cx="200" cy="146" r="96"/>
    <circle ${S4} data-seq="1" data-art="draw" cx="200" cy="146" r="56"/>
    <path ${S4} data-seq="2" data-art="draw" data-loop="pulse"
      d="M200 114 L210 138 L236 140 L216 158 L222 184 L200 170 L178 184 L184 158 L164 140 L190 138 Z"/>
    <path ${S} data-seq="3" data-art="draw" d="M142 230 L110 360 L200 312 L290 360 L258 230"/>`),

  /** Map pin - address, directions, where to come. */
  place: svg(`
    <path ${S} data-seq="0" data-art="draw"
      d="M200 46 C142 46, 96 92, 96 150 C96 226, 200 344, 200 344
         C200 344, 304 226, 304 150 C304 92, 258 46, 200 46 Z"/>
    <circle ${S} data-seq="1" data-art="draw" cx="200" cy="148" r="40"/>
    <path ${S4} data-seq="2" data-art="pop" data-loop="pulse"
      d="M120 352 C120 368, 156 380, 200 380 C244 380, 280 368, 280 352"/>`),

  /** Ring filled most of the way round - a share, a percentage, a proportion. */
  donut: svg(`
    <circle ${S4} data-seq="0" data-art="draw" cx="200" cy="200" r="130"
      stroke-dasharray="3 15"/>
    <path ${S} data-seq="1" data-art="draw" d="M200 70 A130 130 0 1 1 70 200"/>
    <path ${S4} data-seq="2" data-art="draw" d="M200 70 V128 M70 200 H128"/>
    <circle ${S4} data-seq="3" data-art="pop" data-loop="pulse" cx="200" cy="200" r="46"/>`),

  /** A line climbing between plotted points - trend over time. */
  trend: svg(`
    <path ${S} data-seq="0" data-art="draw" d="M62 62 V338 H344"/>
    <path ${S4} data-seq="1" data-art="draw" stroke-dasharray="4 14" d="M62 250 H344 M62 162 H344"/>
    <path ${S} data-seq="2" data-art="draw"
      d="M96 292 L164 238 L228 258 L292 146"/>
    <circle ${S4} data-seq="3" data-art="pop" cx="96" cy="292" r="12"/>
    <circle ${S4} data-seq="4" data-art="pop" cx="164" cy="238" r="12"/>
    <circle ${S4} data-seq="5" data-art="pop" cx="228" cy="258" r="12"/>
    <circle ${S} data-seq="6" data-art="pop" data-loop="pulse" cx="292" cy="146" r="18"/>`),

  /** Sanitiser bottle under drops - hygiene, disinfection, infection control. */
  wash: svg(`
    <path ${S} data-seq="0" data-art="draw" d="M200 126 V96 H262 V118"/>
    <path ${S4} data-seq="1" data-art="draw" d="M174 126 H226 V158 H174 Z"/>
    <rect ${S} data-seq="2" data-art="draw" x="132" y="158" width="136" height="202" rx="26"/>
    <rect ${S4} data-seq="3" data-art="draw" x="162" y="214" width="76" height="86" rx="10"/>
    <path ${S4} data-seq="4" data-art="draw" d="M200 234 V280 M177 257 H223"/>
    <path ${S4} data-seq="5" data-art="draw" data-loop="pulse"
      d="M300 50 C300 50, 324 84, 324 100 A24 24 0 0 1 276 100 C276 84, 300 50, 300 50 Z"/>
    <path ${S4} data-seq="6" data-art="draw" data-loop="pulse"
      d="M300 140 C300 140, 318 166, 318 178 A18 18 0 0 1 282 178 C282 166, 300 140, 300 140 Z"/>
    <path ${S4} data-seq="7" data-art="draw" data-loop="pulse"
      d="M86 96 C86 96, 110 130, 110 146 A24 24 0 0 1 62 146 C62 130, 86 96, 86 96 Z"/>`),

  /** Baby in arms - maternity, newborn care, paediatrics. */
  baby: svg(`
    <circle ${S} data-seq="0" data-art="draw" cx="196" cy="140" r="74"/>
    <path ${S4} data-seq="1" data-art="draw" d="M170 132 H182 M212 132 H224"/>
    <path ${S4} data-seq="2" data-art="draw" data-loop="pulse" d="M176 168 C190 182, 204 182, 218 168"/>
    <path ${S} data-seq="3" data-art="draw"
      d="M74 300 C104 240, 154 214, 200 214 C258 214, 312 248, 330 300"/>
    <path ${S4} data-seq="4" data-art="draw" d="M74 300 C120 344, 282 344, 330 300"/>
    <path ${S4} data-seq="5" data-art="draw" d="M196 66 C180 44, 206 30, 220 44"/>`),

  /** Nodes wired to a hub - system, integration, internal network. */
  network: svg(`
    <circle ${S} data-seq="0" data-art="pop" cx="200" cy="200" r="46"/>
    <path ${S4} data-seq="1" data-art="draw" data-loop="dash" d="M200 154 V72"/>
    <path ${S4} data-seq="2" data-art="draw" data-loop="dash" d="M234 233 L300 300"/>
    <path ${S4} data-seq="3" data-art="draw" data-loop="dash" d="M166 233 L100 300"/>
    <path ${S4} data-seq="4" data-art="draw" data-loop="dash" d="M246 200 H336"/>
    <path ${S4} data-seq="5" data-art="draw" data-loop="dash" d="M154 200 H64"/>
    <circle ${S4} data-seq="6" data-art="pop" cx="200" cy="56" r="22"/>
    <circle ${S4} data-seq="7" data-art="pop" cx="316" cy="316" r="22"/>
    <circle ${S4} data-seq="8" data-art="pop" cx="84" cy="316" r="22"/>
    <circle ${S4} data-seq="9" data-art="pop" cx="352" cy="200" r="22"/>
    <circle ${S4} data-seq="10" data-art="pop" cx="48" cy="200" r="22"/>`),
};

/**
 * Keyword -> motif, scanned in order. First hit wins, so the specific entries
 * have to come before the vague ones.
 */
const AUTO = [
  [/tiêm chủng|vắc ?xin|vaccine|mũi tiêm|chủng ngừa/i, "syringe"],
  [/cúm|vi ?rút|virus|lây lan|lây nhiễm|truyền nhiễm|dịch bệnh/i, "virus"],
  [/viêm phổi|hô hấp|phổi|hen|copd|đường thở|khó thở/i, "lungs"],
  [/châm cứu|điện châm|huyệt|kim châm/i, "needle"],
  [/thảo dược|bài thuốc|dược liệu|sắc thuốc|cổ truyền/i, "herb"],
  [/thần kinh|zona|đau rát|bỏng buốt|châm chích|điện giật|kinh lạc/i, "nerve"],
  [/sơ sinh|trẻ sơ sinh|em bé|thai kỳ|mang thai|sản khoa|nhi khoa/i, "baby"],
  [/não|đột quỵ|sọ|tâm thần|trí nhớ|nhận thức/i, "brain"],
  [/xương|khớp|gãy|chấn thương|cột sống|chỉnh hình/i, "bone"],
  [/mắt|thị lực|giác mạc|nhãn khoa|đục thủy tinh/i, "eye"],
  [/răng|hàm mặt|nha khoa|sâu răng/i, "tooth"],
  [/thận|tiết niệu|lọc máu|chạy thận|ghép thận/i, "kidney"],
  [/vi sinh|giải phẫu bệnh|kính hiển vi|nuôi cấy|mô bệnh học/i, "micro"],
  [/thuốc|kê đơn|liều|dược|viên nang/i, "pill"],
  [/lịch|đặt lịch|hẹn giờ|định kỳ|hằng năm|hàng tháng/i, "calendar"],
  [/hotline|điện thoại|gọi|liên hệ|tổng đài|đăng ký khám/i, "phone"],
  [/chăm sóc|tận tình|đồng hành|hỗ trợ|sẻ chia|giảm nhẹ/i, "care"],
  [/uống nước|bổ sung nước|mất nước|dinh dưỡng/i, "water"],
  [/thuốc lá|khói thuốc|hút thuốc|cai thuốc/i, "nosmoke"],
  [/hồi sức|theo dõi|monitor|tích cực|cấp cứu/i, "monitor"],
  [/chẩn đoán hình ảnh|x-quang|chụp ct|cộng hưởng từ|siêu âm|phim chụp/i, "xray"],
  [/gen|di truyền|adn|dna|miễn dịch|kháng thể/i, "dna"],
  [/đội ngũ|nhân lực|cán bộ|y bác sĩ|tập thể|cộng đồng/i, "team"],
  [/giải thưởng|thành tích|danh hiệu|vinh dự|cờ thi đua|chất lượng/i, "award"],
  [/địa chỉ|đường đi|bản đồ|vị trí|cơ sở|tại khoa/i, "place"],
  [/rửa tay|vệ sinh|khử khuẩn|nhiễm khuẩn|sát khuẩn/i, "wash"],
  [/bệnh viện|khoa phòng|trung tâm|toà nhà|nhập viện/i, "hospital"],
  [/thăm khám|khám bệnh|bác sĩ khám|tư vấn|ống nghe/i, "stetho"],
  [/đường huyết|xét nghiệm|lấy máu|tiểu đường|đái tháo đường|mẫu bệnh phẩm/i, "drop"],
  [/hồ sơ|bệnh án|rà soát|tầm soát|kiểm tra|sàng lọc|phát hiện/i, "doc"],
  [/an toàn|bảo vệ|bảo mật|dữ liệu|riêng tư|quy định/i, "shield"],
  [/tỉ lệ|phần trăm|%|một phần|cơ cấu/i, "donut"],
  [/xu hướng|theo thời gian|biểu đồ|diễn biến|thống kê/i, "trend"],
  [/kết quả|hiệu quả|tiết kiệm|tăng|giảm/i, "chart"],
  [/thời gian|kéo dài|chờ|phút|giờ|tháng|năm/i, "clock"],
  [/hệ thống|tích hợp|kết nối|nội bộ|máy chủ|phần mềm/i, "network"],
  [/tim mạch|huyết áp|nhịp tim|sức khỏe/i, "pulse"],
  [/nguyên tắc|tiêu chí|danh sách|các bước|lưu ý|khuyến cáo/i, "check"],
];

/**
 * Resolve a scene's `art` field. "auto" reads the scene's own words and may
 * legitimately come back with nothing - a motif that does not match the line
 * is worse than a clean empty half, so no fallback is invented here.
 */
export function pickArt(scene) {
  const want = scene.art;
  if (!want || want === "none") return null;
  // `auto` only ever picks from the hand-drawn set: guessing among 748 imported
  // icons on keywords alone lands on the wrong one far too often.
  if (want !== "auto") {
    if (want.startsWith("icon:")) {
      healthIcon(want.slice(5));   // resolve now so a typo fails before rendering
      return want;
    }
    if (!ART[want]) throw new Error(`unknown art: ${want} (scene ${scene.id})`);
    return want;
  }
  const hay = [scene.headline, scene.kicker, scene.sub, ...(scene.lines || [])].join(" ");
  for (const [re, name] of AUTO) if (re.test(hay)) return name;
  return null;
}

/** Spliced into window.__frame - see the markup contract at the top. */
export const ART_ENGINE = `
  const artRoot = document.getElementById("art");
  if (artRoot) {
    const seq = artRoot.querySelectorAll("[data-seq]");
    const s0 = cfg.artStartMs || 300, step = cfg.artStepMs || 210, dur = cfg.artDrawMs || 620;
    let lastEnd = s0;
    for (let i = 0; i < seq.length; i++) {
      const el = seq[i];
      const at = s0 + (Number(el.dataset.seq) || 0) * step;
      lastEnd = Math.max(lastEnd, at + dur);
      const p = easeOutCubic(prog(tMs, at, at + dur));
      const mode = el.dataset.art || "fade";
      if (mode === "draw") {
        if (el.__len === undefined) el.__len = el.getTotalLength ? el.getTotalLength() : 0;
        // A dasharray set here would fight a decorative one in the markup, so
        // those elements keep theirs and just fade instead of wiping on.
        if (!el.getAttribute("stroke-dasharray")) {
          el.style.strokeDasharray = el.__len;
          el.style.strokeDashoffset = String(el.__len * (1 - p));
        }
        el.style.opacity = String(p > 0 ? 1 : 0);
      } else if (mode === "pop") {
        el.style.opacity = String(p);
        el.style.transform = "scale(" + (0.4 + 0.6 * p).toFixed(4) + ")";
      } else if (mode === "rise") {
        el.style.opacity = String(p);
        el.style.transform = "translateY(" + ((1 - p) * 26).toFixed(2) + "px)";
      } else if (mode === "grow") {
        el.style.opacity = String(p > 0 ? 1 : 0);
        el.style.transform = "scaleY(" + p.toFixed(4) + ")";
      } else {
        el.style.opacity = String(p);
      }
    }
    // Idle motion once the drawing has landed, so the half of the frame that
    // carries no photograph is never completely still.
    const t = Math.max(0, tMs - lastEnd) / 1000;
    for (const el of artRoot.querySelectorAll("[data-loop]")) {
      const kind = el.dataset.loop;
      // An explicit pivot has to switch to view-box coordinates, otherwise the
      // origin would still be read against the element's own bounding box.
      if (el.dataset.origin && !el.__pivoted) {
        const [ox, oy] = el.dataset.origin.split(/\\s+/);
        el.style.transformBox = "view-box";
        el.style.transformOrigin = ox + "px " + oy + "px";
        el.__pivoted = true;
      }
      if (kind === "pulse") {
        const k = 1 + 0.06 * Math.sin(t * 2.0);
        const base = el.dataset.art === "pop" ? "scale(" + k.toFixed(4) + ")" : "";
        el.style.transform = base || "scale(" + k.toFixed(4) + ")";
      } else if (kind === "spin") {
        el.style.transform = "rotate(" + (t * 42).toFixed(2) + "deg)";
      } else if (kind === "dash" && tMs >= lastEnd) {
        if (el.__len === undefined) el.__len = el.getTotalLength ? el.getTotalLength() : 0;
        el.style.strokeDasharray = "18 14";
        el.style.strokeDashoffset = String(-(t * 60) % 32);
      }
    }
  }
`;

/**
 * Idle motion, spliced into window.__frame after ART_ENGINE.
 *
 * Every reveal in this pipeline has landed within about two seconds, but a
 * narration often runs fifteen or twenty. Without this the frame simply freezes
 * for the rest of the sentence. Photo scenes are covered by the Ken Burns
 * scale; these are the text-only ones.
 *
 * Nothing here touches an element whose `transform` a reveal also writes -
 * that collision is what once dropped the photo frame out of centre. The
 * drifting targets are containers and decorations that no reveal owns; the
 * word and line waves are folded into the same loop that reveals them.
 */
export const IDLE_ENGINE = `
  {
    const it = tMs / 1000;
    // Soft colour blobs drifting against each other.
    for (const d of document.querySelectorAll(".deco, .deco2")) {
      const k = d.classList.contains("deco2") ? -1 : 1;
      d.style.transform = "translate(" + (Math.sin(it * 0.30) * 30 * k).toFixed(2) + "px,"
                        + (Math.cos(it * 0.22) * 24 * k).toFixed(2) + "px)";
    }
    // The motif breathes as a whole. The <svg> is used rather than .artbox,
    // because the box carries the centring transform in several styles.
    const artSvg = document.querySelector(".artbox svg");
    if (artSvg) {
      artSvg.style.transform = "translateY(" + (Math.sin(it * 0.55) * 10).toFixed(2) + "px)"
                             + " scale(" + (1 + 0.012 * Math.sin(it * 0.42)).toFixed(4) + ")";
    }
    // Gradient grounds pan slowly; the style opts in with data-pan.
    for (const g of document.querySelectorAll("[data-pan]")) {
      g.style.backgroundPosition = (50 + 22 * Math.sin(it * 0.18)).toFixed(2) + "% "
                                 + (50 + 18 * Math.cos(it * 0.15)).toFixed(2) + "%";
    }
  }
`;

/**
 * Folded into the word loop: after every word has popped in, a slow wave keeps
 * travelling along the line so a long sentence never reads as a frozen card.
 */
export const IDLE_WORD = `
      if (p >= 1) {
        const w = 1 + 0.022 * Math.sin(tMs / 1000 * 1.9 - i * 0.45);
        el.style.transform = "translateY(" + (Math.sin(tMs / 1000 * 1.5 - i * 0.4) * 2.2).toFixed(2)
                           + "px) scale(" + w.toFixed(4) + ")";
      }
`;

/** Same idea for the stacked list: a reading pulse runs down the rows. */
export const IDLE_LINE = `
      if (p >= 1) {
        const ph = tMs / 1000 * 1.25 - i * 0.55;
        lines[i].style.opacity = String((0.84 + 0.16 * (0.5 + 0.5 * Math.sin(ph))).toFixed(3));
        lines[i].style.transform = "translateX(" + (Math.sin(ph) * 3.2).toFixed(2) + "px)";
      }
`;

/** Dropped into every style sheet; the box itself is positioned per style. */
export const ART_CSS = `
 .artbox{display:flex;align-items:center;justify-content:center}
 .artbox svg{width:100%;height:100%;overflow:visible}
 .artbox [data-seq]{opacity:0;transform-box:fill-box;transform-origin:center}
 .artbox [data-art="grow"]{transform-origin:bottom}
`;

/**
 * The `icon` class marks an imported Health Icon so a style can place it
 * differently. The hand-drawn motifs are sparse line work and sit happily as a
 * faint wash behind text; a filled icon at the same opacity just turns into a
 * smudge the words sit on top of.
 */
export const artBox = (name, cls = "") => {
  if (!name) return "";
  const imported = name.startsWith("icon:");
  const body = imported ? healthIcon(name.slice(5)) : ART[name];
  return `<div class="artbox ${imported ? "icon " : ""}${cls}" id="art">${body}</div>`;
};
