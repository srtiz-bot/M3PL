#!/usr/bin/env node
// Final quality check for a rendered explainer.
// Usage: node scripts/qc.mjs <video.mp4> <episode qc.json>
// Exits 1 on any FAIL. Writes <video>.qc.md and <video>.contact.png.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';

const [video, specPath] = process.argv.slice(2);
if (!video || !specPath) {
  console.error('usage: node scripts/qc.mjs <video.mp4> <qc.json>');
  process.exit(2);
}
const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
const results = [];
const add = (status, name, detail) => results.push({status, name, detail});
const run = (cmd, args) => execFileSync(cmd, args, {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 << 20});
import {spawnSync} from 'node:child_process';
function require_spawn(cmd, args) {
  return spawnSync(cmd, args, {encoding: 'utf8', maxBuffer: 64 << 20}).stderr;
}

// 1. Container / stream facts
const probe = JSON.parse(run('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', video]));
const v = probe.streams.find((s) => s.codec_type === 'video');
const a = probe.streams.find((s) => s.codec_type === 'audio');
const [num, den] = v.r_frame_rate.split('/').map(Number);
const fps = num / den;
const dur = Number(probe.format.duration);
add(v.width === spec.width && v.height === spec.height ? 'PASS' : 'FAIL', 'Resolution', `${v.width}x${v.height} (want ${spec.width}x${spec.height})`);
add(Math.abs(fps - spec.fps) < 0.01 ? 'PASS' : 'FAIL', 'Frame rate', `${fps.toFixed(3)} fps`);
add(Math.abs(dur - spec.durationFrames / spec.fps) < 0.1 ? 'PASS' : 'FAIL', 'Duration', `${dur.toFixed(2)} s (want ${(spec.durationFrames / spec.fps).toFixed(2)} s)`);
add(v.codec_name === 'h264' && v.pix_fmt === 'yuv420p' ? 'PASS' : 'FAIL', 'Codec', `${v.codec_name} / ${v.pix_fmt} (social-safe = h264 / yuv420p)`);

// 2. Audio: narration must be present, untouched in length, and not clipped
if (spec.narration) {
  if (!a) add('FAIL', 'Narration', 'no audio stream in render');
  else {
    const src = JSON.parse(run('ffprobe', ['-v', 'error', '-show_format', '-of', 'json', spec.narration.file]));
    const srcDur = Number(src.format.duration);
    const end = (spec.narration.startFrame ?? 0) / spec.fps + srcDur;
    add(end <= dur + 0.05 ? 'PASS' : 'FAIL', 'Narration fits', `narration ends at ${end.toFixed(2)} s, video ${dur.toFixed(2)} s`);
    const loud = require_spawn('ffmpeg', ['-hide_banner', '-i', video, '-af', 'ebur128=peak=true', '-f', 'null', '-']);
    const I = /I:\s+(-?[\d.]+) LUFS/.exec(loud.split('Summary:').pop() ?? '')?.[1];
    const TP = /Peak:\s+(-?[\d.]+) dBFS/.exec(loud.split('Summary:').pop() ?? '')?.[1];
    add(TP !== undefined && Number(TP) <= -1 ? 'PASS' : 'WARN', 'True peak', `${TP} dBFS (target ≤ -1)`);
    add('INFO', 'Loudness', `${I} LUFS integrated (approved narration is not re-normalized; reference only)`);
  }
} else {
  add(a ? 'WARN' : 'INFO', 'Narration', a ? 'audio present but no narration declared' : 'silent render (no approved narration attached yet)');
}

// 3. On-screen text hold times: max(0.8 s, chars / 15 cps)
for (const [text, on, off] of spec.textItems) {
  const need = Math.max(0.8, text.replace(/\s+/g, ' ').length / 15);
  const have = (off - on) / spec.fps;
  add(have + 1e-6 >= need ? 'PASS' : 'FAIL', `Text hold: "${text}"`, `${have.toFixed(2)} s visible, needs ${need.toFixed(2)} s`);
}

// 4. Black frames / frozen stretches
const black = require_spawn('ffmpeg', ['-hide_banner', '-i', video, '-vf', 'blackdetect=d=0.1:pix_th=0.1', '-an', '-f', 'null', '-']);
const blacks = [...black.matchAll(/black_start:([\d.]+)/g)].map((m) => m[1]);
add(blacks.length ? 'FAIL' : 'PASS', 'Black frames', blacks.length ? `at ${blacks.join(', ')} s` : 'none');
const frz = require_spawn('ffmpeg', ['-hide_banner', '-i', video, '-vf', 'freezedetect=n=0.0005:d=1.2', '-an', '-f', 'null', '-']);
const freezes = [...frz.matchAll(/freeze_start: ([\d.]+)/g)].map((m) => Number(m[1]));
add(freezes.length ? 'WARN' : 'PASS', 'Dead air (≥1.2 s with no motion)', freezes.length ? `starts at ${freezes.map((x) => x.toFixed(2)).join(', ')} s` : 'none');

// 5. Abrupt jumps: frame-to-frame luma difference spikes outside planned cuts
const diff = require_spawn('ffmpeg', ['-hide_banner', '-i', video, '-vf', 'tblend=all_mode=difference,signalstats,metadata=print:key=lavfi.signalstats.YAVG', '-an', '-f', 'null', '-']);
const ys = [...diff.matchAll(/YAVG=([\d.]+)/g)].map((m) => Number(m[1]));
const sorted = [...ys].sort((x, y) => x - y);
const median = sorted[Math.floor(sorted.length / 2)] || 0;
const inCut = (f) => spec.plannedCuts.some(([s, e]) => f >= s - 1 && f <= e + 1);
const spikes = ys
  .map((y, i) => ({f: i + 1, y}))
  .filter(({f, y}) => !inCut(f) && y > Math.max(4, median * 6));
add(spikes.length ? 'WARN' : 'PASS', 'Abrupt changes outside planned cuts', spikes.length ? spikes.map((s) => `f${s.f} (Δ${s.y.toFixed(1)})`).join(', ') : `none (median Δ${median.toFixed(2)}, max ${Math.max(...ys).toFixed(1)})`);

// 6. Contact sheet for human review (every 0.5 s)
const sheet = video.replace(/\.mp4$/, '.contact.png');
require_spawn('ffmpeg', ['-hide_banner', '-y', '-i', video, '-vf', `fps=2,scale=270:-1,tile=10x${Math.ceil((dur * 2) / 10)}`, '-frames:v', '1', sheet]);
add(fs.existsSync(sheet) ? 'INFO' : 'WARN', 'Contact sheet', sheet);

// Manual checklist the script cannot judge
const manual = [
  'Saúl matches the approved look (looks.ts) in every scene',
  'No whole-body bobbing; gestures travel shoulder → elbow → wrist',
  'Every headline readable on a phone at arm’s length',
  'Visual beats land on the narration words they illustrate',
  'No third-party characters, logos or app UI copied from references',
  'Spanish copy reviewed (accents, ¿¡, “EE. UU.” spacing)',
];

const icon = {PASS: '✅', FAIL: '❌', WARN: '⚠️', INFO: 'ℹ️'};
const md = [
  `# QC — ${spec.episode}`,
  '',
  `File: \`${video}\``,
  '',
  '| | Check | Detail |',
  '|---|---|---|',
  ...results.map((r) => `| ${icon[r.status]} | ${r.name} | ${r.detail} |`),
  '',
  '## Manual sign-off',
  ...manual.map((m) => `- [ ] ${m}`),
  '',
].join('\n');
fs.writeFileSync(video.replace(/\.mp4$/, '.qc.md'), md);
console.log(md);
process.exit(results.some((r) => r.status === 'FAIL') ? 1 : 0);
