import { createReadStream, existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Readable } from "node:stream";
import { env } from "../env.js";

const AUDIO_DIR = join(process.cwd(), env.DATA_DIR, "audio");
mkdirSync(AUDIO_DIR, { recursive: true });

export async function saveAudioFile(userId: string, entryId: string, file: File) {
  const dir = join(AUDIO_DIR, userId);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${entryId}.webm`);
  const buf = Buffer.from(await file.arrayBuffer());
  writeFileSync(path, buf);
  return path;
}

export function readAudioFile(
  path: string,
): {
  stream: (range?: { start: number; end: number }) => Readable;
  size: number;
} | null {
  if (!existsSync(path)) return null;
  return {
    stream: (range) =>
      range
        ? createReadStream(path, { start: range.start, end: range.end })
        : createReadStream(path),
    size: statSync(path).size,
  };
}
