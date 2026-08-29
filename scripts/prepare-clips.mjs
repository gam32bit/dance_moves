#!/usr/bin/env node
// Converts the raw phone clips in "Dance Moves/" into web-friendly assets in
// public/clips/ and writes an index.json the app seeds itself from.
//
// Usage: node scripts/prepare-clips.mjs
// Requires: ffmpeg + ffprobe on PATH.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readdir, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const run = promisify(execFile);

const SRC_DIR = path.resolve('Dance Moves');
const OUT_DIR = path.resolve('public/clips');

const VIDEO_RE = /\.(mov|mp4|m4v)$/i;

async function ffprobeCodec(file) {
  const { stdout } = await run('ffprobe', [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-show_entries', 'stream=codec_name',
    '-of', 'default=nw=1:nk=1',
    file,
  ]);
  return stdout.trim();
}

async function toMp4(src, dest) {
  const codec = await ffprobeCodec(src);
  const args = ['-y', '-i', src, '-movflags', '+faststart'];
  if (codec === 'h264') {
    // Already browser-safe: just remux, no re-encode.
    args.push('-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k');
  } else {
    // e.g. HEVC from newer iPhones — re-encode to H.264.
    args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '23',
              '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k');
  }
  args.push(dest);
  await run('ffmpeg', args);
}

async function poster(src, dest) {
  await run('ffmpeg', ['-y', '-ss', '1', '-i', src, '-frames:v', '1',
    '-vf', 'scale=640:-2', dest]);
}

async function main() {
  if (!existsSync(SRC_DIR)) {
    console.error(`Source folder not found: ${SRC_DIR}`);
    process.exit(1);
  }
  await mkdir(OUT_DIR, { recursive: true });

  const files = (await readdir(SRC_DIR)).filter((f) => VIDEO_RE.test(f)).sort();
  const index = [];

  for (const [i, name] of files.entries()) {
    const base = name.replace(VIDEO_RE, '');
    const src = path.join(SRC_DIR, name);
    const mp4 = `${base}.mp4`;
    const jpg = `${base}.jpg`;
    process.stdout.write(`[${i + 1}/${files.length}] ${name} -> ${mp4} … `);
    await toMp4(src, path.join(OUT_DIR, mp4));
    try {
      await poster(src, path.join(OUT_DIR, jpg));
    } catch {
      console.warn('(poster failed)');
    }
    index.push({
      clip: mp4,
      poster: existsSync(path.join(OUT_DIR, jpg)) ? jpg : null,
      originalName: name,
      defaultName: `Move ${String(i + 1).padStart(2, '0')}`,
    });
    console.log('done');
  }

  await writeFile(path.join(OUT_DIR, 'index.json'), JSON.stringify(index, null, 2));
  console.log(`\nWrote ${index.length} entries to public/clips/index.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
