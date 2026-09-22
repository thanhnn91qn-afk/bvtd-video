/**
 * Where finished videos are written.
 *
 * One place, resolved in this order:
 *   1. --out=<thu muc> on the command line
 *   2. the path in out-dir.txt at the project root, if that file exists
 *   3. <project>/out
 *
 * out-dir.txt is machine-specific and git-ignored, so a checkout on another
 * machine falls back to the project's own out/ folder and still works.
 */
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";

export function resolveOutDir(root, argv = process.argv) {
  const flag = argv.find((a) => a.startsWith("--out="));
  if (flag) {
    const p = flag.slice(6).trim();
    return isAbsolute(p) ? p : join(root, p);
  }
  const cfg = join(root, "out-dir.txt");
  if (existsSync(cfg)) {
    const p = readFileSync(cfg, "utf8").split("\n")[0].trim();
    if (p) return isAbsolute(p) ? p : join(root, p);
  }
  return join(root, "out");
}

/**
 * Base file name for the finished videos. A scenes file may set `outName` in
 * its brand block so the delivered file is called what the clip is about
 * rather than what the build run was called.
 */
export function outBaseName(cfg, name) {
  const wanted = cfg?.brand?.outName ?? cfg?.outName;
  return (wanted && String(wanted).trim()) || `video-${name}`;
}
