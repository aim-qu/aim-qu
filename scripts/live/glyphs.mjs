// 七十二候の字形。候の名・読み・節気に出てくる字だけを Noto Serif JP から輪郭にして data/glyphs.json に書く。
// 毎時の書き直しでは動かさない。字の一覧が変わった時に手元で一度だけ動かす。
// 使い方: node scripts/live/glyphs.mjs <NotoSerifJPのフォントファイル>

import { readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const font = process.argv[2];
if (!font) throw new Error('フォントファイルを指定してください');
const kou = JSON.parse(readFileSync(new URL('../../data/kou72.json', import.meta.url), 'utf8'));
const chars = new Set('初次末候');
for (const k of kou) for (const c of k.name + k.yomi + k.sekki) chars.add(c);

// 千分の一em単位の整数に丸め、同じ点が続く直線は省く
function compact(d) {
  const tokens = d.match(/[MLQCZ]|-?\d+(?:\.\d+)?/g);
  const out = [];
  let last = '';
  for (let i = 0; i < tokens.length;) {
    const cmd = tokens[i++];
    const n = { M: 2, L: 2, Q: 4, C: 6, Z: 0 }[cmd];
    const nums = tokens.slice(i, i + n).map(v => Math.round(+v));
    i += n;
    const s = cmd + nums.join(' ');
    if (cmd === 'L' && s === last) continue;
    out.push(s);
    last = s;
  }
  return out.join('').replace(/ -/g, '-');
}

// 一字ずつ、1000単位のem箱（上端0・下端1000）に収まる位置で描かせて輪郭を取る
const glyphs = {};
for (const c of [...chars].sort()) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1000"><text x="0" y="880" font-family="Noto Serif JP" font-size="1000">${c}</text></svg>`;
  const tree = new Resvg(svg, { font: { fontFiles: [font], loadSystemFonts: false, defaultFontFamily: 'Noto Serif JP' } }).toString();
  const ds = [...tree.matchAll(/ d="([^"]+)"/g)].map(m => m[1]);
  if (!ds.length) throw new Error(`字形が取れません: ${c}`);
  glyphs[c] = compact(ds.join(' '));
}
const json = '{\n' + Object.entries(glyphs).map(([c, d]) => `${JSON.stringify(c)}:${JSON.stringify(d)}`).join(',\n') + '\n}\n';
writeFileSync(new URL('../../data/glyphs.json', import.meta.url), json);
console.log(`${Object.keys(glyphs).length}字 ${(json.length / 1024).toFixed(0)} KB`);
