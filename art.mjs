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
 */

const svg = (body, extra = "") =>
  `<svg viewBox="0 0 400 400" fill="none" xmlns="http://www.w3.org/2000/svg" ${extra}>${body}</svg>`;

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

  /** Needles into a point, with spreading ripples - acupuncture, electro-acupuncture. */
  needle: svg(`
    <circle ${S} data-seq="0" data-art="pop" cx="200" cy="248" r="13"/>
    <path ${S} data-seq="1" data-art="draw" d="M200 235 L128 96"/>
    <path ${S} data-seq="2" data-art="draw" d="M212 240 L300 112"/>
    <path ${S} data-seq="3" data-art="draw" d="M188 240 L96 186"/>
    <circle ${S4} data-seq="4" data-art="pop" data-loop="pulse" cx="200" cy="248" r="52" opacity="0"/>
    <circle ${S4} data-seq="5" data-art="pop" data-loop="pulse" cx="200" cy="248" r="92"
      stroke-dasharray="6 16" opacity="0"/>`),

  /** Drop over a test strip with a rising reading - blood test, blood sugar. */
  drop: svg(`
    <path ${S} data-seq="0" data-art="draw"
      d="M200 62 C200 62, 292 168, 292 224 A92 92 0 0 1 108 224 C108 168, 200 62, 200 62 Z"/>
    <path ${S4} data-seq="1" data-art="draw" d="M158 232 C158 268, 186 288, 214 288"/>
    <path ${S} data-seq="2" data-art="draw" data-loop="dash" d="M72 344 H328"/>
    <rect ${S4} data-seq="3" data-art="grow" x="112" y="300" width="26" height="40" rx="6"/>
    <rect ${S4} data-seq="4" data-art="grow" x="172" y="288" width="26" height="52" rx="6"/>
    <rect ${S4} data-seq="5" data-art="grow" x="232" y="272" width="26" height="68" rx="6"/>`),

  /** Clock with a sweeping hand - duration, delay, waiting, time saved. */
  clock: svg(`
    <circle ${S} data-seq="0" data-art="draw" cx="200" cy="208" r="140"/>
    <path ${S4} data-seq="1" data-art="draw" d="M200 88 V104 M320 208 H304 M200 328 V312 M80 208 H96"/>
    <path ${S} data-seq="2" data-art="draw" d="M200 208 V128"/>
    <path ${S} data-seq="3" data-art="draw" data-loop="spin" d="M200 208 L262 248"/>
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
  [/châm cứu|điện châm|huyệt|kim châm/i, "needle"],
  [/thảo dược|bài thuốc|dược liệu|sắc thuốc|cổ truyền/i, "herb"],
  [/thần kinh|zona|đau rát|bỏng buốt|châm chích|điện giật|kinh lạc/i, "nerve"],
  [/đường huyết|xét nghiệm|lấy máu|tiểu đường|đái tháo đường|mẫu bệnh phẩm/i, "drop"],
  [/hồ sơ|bệnh án|rà soát|tầm soát|kiểm tra|sàng lọc|phát hiện/i, "doc"],
  [/an toàn|bảo vệ|bảo mật|dữ liệu|riêng tư|quy định/i, "shield"],
  [/kết quả|hiệu quả|tiết kiệm|tăng|giảm|tỉ lệ|phần trăm|%/i, "chart"],
  [/thời gian|kéo dài|chờ|phút|giờ|tháng|năm/i, "clock"],
  [/hệ thống|tích hợp|kết nối|nội bộ|máy chủ|phần mềm/i, "network"],
  [/tim mạch|huyết áp|nhịp tim|sức khỏe|cấp cứu/i, "pulse"],
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
  if (want !== "auto") {
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

/** Dropped into every style sheet; the box itself is positioned per style. */
export const ART_CSS = `
 .artbox{display:flex;align-items:center;justify-content:center}
 .artbox svg{width:100%;height:100%;overflow:visible}
 .artbox [data-seq]{opacity:0;transform-box:fill-box;transform-origin:center}
 .artbox [data-art="grow"]{transform-origin:bottom}
`;

export const artBox = (name, cls = "") =>
  name ? `<div class="artbox ${cls}" id="art">${ART[name]}</div>` : "";
