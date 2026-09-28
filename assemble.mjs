/**
 * Joins the rendered scene clips into the finished videos, with a transition
 * between scenes instead of a hard cut.
 *
 * Transitions are ffmpeg's own `xfade`. HyperFrames ships transition blocks
 * too, but those need the outgoing and incoming scene inside one page, and this
 * pipeline renders every scene to its own clip - so the blend happens here, on
 * the clips, instead.
 *
 * A transition overlaps the tail of one clip with the head of the next, so the
 * video gets shorter by the overlap at every join. The narration is cut the
 * same way to stay in sync. Nothing spoken is lost as long as the overlap fits
 * inside the silent gap every scene already ends with (GAP_SEC) - which is why
 * the duration is clamped to that gap.
 */
import { writeFile, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

/** Calm ones only: this is hospital material, not a music promo. */
export const TRANSITIONS = [
  "fade", "smoothleft", "circleopen", "slideup", "wipeleft",
  "smoothup", "fadewhite", "radial", "dissolve", "smoothright",
];

/** Every name ffmpeg's xfade accepts, for validating a scene's `transition`. */
export const XFADE_NAMES = new Set([
  "fade", "wipeleft", "wiperight", "wipeup", "wipedown", "slideleft", "slideright",
  "slideup", "slidedown", "circlecrop", "rectcrop", "distance", "fadeblack", "fadewhite",
  "radial", "smoothleft", "smoothright", "smoothup", "smoothdown", "circleopen",
  "circleclose", "vertopen", "vertclose", "horzopen", "horzclose", "dissolve", "pixelize",
  "diagtl", "diagtr", "diagbl", "diagbr", "hlslice", "hrslice", "vuslice", "vdslice",
  "hblur", "fadegrays", "wipetl", "wipetr", "wipebl", "wipebr", "squeezeh", "squeezev",
  "zoomin", "fadefast", "fadeslow",
]);

/**
 * Transition into scene i (i >= 1). A scene may name one with `transition`, or
 * turn it off with "none"; otherwise the calm set is walked in order so a clip
 * never repeats the same join twice in a row.
 */
function transitionInto(scenes, i, off) {
  if (off) return null;
  const want = scenes[i].transition;
  if (want === "none") return null;
  return want || TRANSITIONS[(i - 1) % TRANSITIONS.length];
}

export async function assemble({ scenes, fps, gap, exec, root, name, outDir, base, transDur = 0.4, off = false,
                                 music = null, musicVol = 0.16, sfxOff = false, sfxVol = 1 }) {
  // Clip length as rendered (whole frames), not the float the renderer aimed for,
  // or the offsets drift by a fraction of a frame per join.
  const len = scenes.map((s) => s.frames / fps);
  const d = Math.max(0, Math.min(transDur, gap - 0.05));
  const joins = scenes.map((_, i) => (i === 0 ? null : transitionInto(scenes, i, off || d === 0)));
  // overlap[i] = how much of clip i's tail is shared with clip i+1
  const overlap = scenes.map((_, i) => (i + 1 < scenes.length && joins[i + 1] ? d : 0));

  // --- narration, cut to match the video ----------------------------------------
  const aArgs = ["-y", "-hide_banner", "-loglevel", "error"];
  const parts = [], labels = [];
  scenes.forEach((s, i) => {
    aArgs.push("-i", s.wav);
    const keep = (len[i] - overlap[i]).toFixed(4);
    parts.push(`[${i}:a]aresample=44100,aformat=sample_fmts=fltp:channel_layouts=mono,` +
      `apad=whole_dur=${len[i].toFixed(4)},atrim=0:${keep},asetpts=N/SR/TB[a${i}]`);
    labels.push(`[a${i}]`);
  });
  const voiceWav = join(root, "build", `voice-${name}.wav`);
  aArgs.push("-filter_complex",
    `${parts.join(";")};${labels.join("")}concat=n=${scenes.length}:v=0:a=1[out]`,
    "-map", "[out]", "-ar", "44100", "-ac", "1", voiceWav);
  await exec("ffmpeg", aArgs, { maxBuffer: 1 << 24 });

  // --- video ----------------------------------------------------------------------
  const silent = join(outDir, `${base}-silent.mp4`);
  if (joins.every((j) => !j)) {
    // No transitions anywhere: the old stream-copy concat, no re-encode.
    const listFile = join(root, "build", `clips-${name}.txt`);
    await writeFile(listFile, scenes.map((s) => `file '${s.clip.replace(/\\/g, "/")}'`).join("\n"), "utf8");
    await exec("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error",
      "-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", silent], { maxBuffer: 1 << 24 });
  } else {
    const vArgs = ["-y", "-hide_banner", "-loglevel", "error"];
    const f = [];
    scenes.forEach((s, i) => {
      vArgs.push("-i", s.clip);
      // xfade needs identical timebase and frame rate on both inputs.
      f.push(`[${i}:v]fps=${fps},settb=AVTB,format=yuv420p[s${i}]`);
    });
    let cur = "[s0]";
    let t = len[0];
    for (let i = 1; i < scenes.length; i++) {
      const out = `[v${i}]`;
      if (joins[i]) {
        f.push(`${cur}[s${i}]xfade=transition=${joins[i]}:duration=${d}:offset=${(t - d).toFixed(4)}${out}`);
        t += len[i] - d;
      } else {
        f.push(`${cur}[s${i}]concat=n=2:v=1:a=0${out}`);
        t += len[i];
      }
      cur = out;
    }
    vArgs.push("-filter_complex", f.join(";"), "-map", cur,
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p",
      "-r", String(fps), "-movflags", "+faststart", silent);
    await exec("ffmpeg", vArgs, { maxBuffer: 1 << 24 });
  }

  const withAudio = join(outDir, `${base}.mp4`);
  const total = len.reduce((a, b) => a + b, 0) - overlap.reduce((a, b) => a + b, 0);

  // Where each scene starts on the final timeline. A transition into scene i
  // runs from starts[i] for d seconds, so its middle is starts[i] + d/2.
  const starts = [0];
  for (let i = 1; i < scenes.length; i++) starts.push(starts[i - 1] + len[i - 1] - overlap[i - 1]);

  const cues = sfxOff ? [] : await sfxCues(scenes, joins, starts, d, root, sfxVol);

  // One graph for every case: narration, then optional effects, then optional
  // music. Inputs: 0 video, 1 narration, 2.. effects, last music.
  const inArgs = ["-i", silent, "-i", voiceWav];
  // Mono to stereo by copying the channel. Letting aformat upmix applies a
  // -3 dB pan law, which quietly made every narration 3 dB softer.
  const f = ["[1:a]aresample=44100,pan=stereo|c0=c0|c1=c0[vo]"];
  let bus = "[vo]";
  if (cues.length) {
    const tags = ["[vo]"];
    cues.forEach((c, k) => {
      inArgs.push("-i", c.file);
      const ms = Math.round(c.at * 1000);
      f.push(`[${2 + k}:a]aresample=44100,${c.mono ? "pan=stereo|c0=c0|c1=c0" : "aformat=channel_layouts=stereo"},` +
        `volume=${c.gainDb.toFixed(1)}dB,adelay=${ms}|${ms}[x${k}]`);
      tags.push(`[x${k}]`);
    });
    // effects join the voice bus, so the music ducks under them as well
    f.push(`${tags.join("")}amix=inputs=${tags.length}:duration=first:normalize=0[vb]`);
    bus = "[vb]";
  }
  if (music) {
    // Music bed ducked by the voice bus itself: a sidechain compressor pulls the
    // music down whenever something is speaking or sounding, and lets it back up
    // in the pauses. Looped to length, faded in and out.
    const mi = 2 + cues.length;
    inArgs.push("-stream_loop", "-1", "-i", music);
    const fadeOut = Math.max(0, total - 2.5).toFixed(3);
    f.push(`${bus}asplit=2[mainb][scb]`,
      `[${mi}:a]aformat=sample_rates=44100:channel_layouts=stereo,volume=${musicVol}[m0]`,
      "[m0][scb]sidechaincompress=threshold=0.02:ratio=12:attack=20:release=450:makeup=1[md]",
      `[md]afade=t=in:d=1.5,afade=t=out:st=${fadeOut}:d=2.5[mf]`,
      "[mainb][mf]amix=inputs=2:duration=first:normalize=0[aout]");
  } else {
    f.push(`${bus}anull[aout]`);
  }
  await exec("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", ...inArgs,
    "-filter_complex", f.join(";"), "-map", "0:v:0", "-map", "[aout]",
    "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-t", total.toFixed(3),
    "-movflags", "+faststart", withAudio], { maxBuffer: 1 << 24 });

  return { silent, withAudio, joins: joins.filter(Boolean), cues: cues.map((c) => `${c.name}@${c.at.toFixed(2)}s`) };
}

/**
 * One sound per scene at most, on the way into it: `scene.sfx` names a sound
 * from assets/sfx/sfx.json (the director fills it in when left to "auto").
 * The sound is placed so its loudest moment lands where the transition (or
 * the cut) begins - the silent gap between two lines of narration.
 */
async function sfxCues(scenes, joins, starts, d, root, vol) {
  const libPath = join(root, "assets", "sfx", "sfx.json");
  if (!existsSync(libPath)) return [];
  const lib = JSON.parse(await readFile(libPath, "utf8"));
  const volDb = 20 * Math.log10(Math.max(1e-4, vol));
  const out = [];
  scenes.forEach((s, i) => {
    if (i === 0 || !s.sfx || s.sfx === "none" || s.sfx === "auto") return;
    const e = lib[s.sfx];
    if (!e) return;
    // The peak lands where the transition begins, not at its middle: that is
    // the quiet moment between two lines. The next scene's narration starts
    // about 70 ms in, and a sound peaking mid-transition sat on its first word.
    const hit = starts[i];
    out.push({ name: s.sfx, file: join(root, "assets", "sfx", e.file), mono: !!e.mono,
      at: Math.max(0, hit - e.peak), gainDb: e.gainDb + volDb });
  });
  return out;
}
