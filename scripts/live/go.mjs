// 石を返す。五路の盤で、押した石とその上下左右の石が白黒入れ替わる。すべて白にそろえると一局おわり。
// 盤の一目ずつが issue を開くリンクになっていて、issue が立つと GitHub Actions がこのスクリプトで石を返し、
// data/go.json と README の盤を書き換える。盤の絵は一目ずつの小さなSVGで、assets/go/ に置く。
// 使い方:
//   node scripts/live/go.mjs --tiles   一目の絵を書き出す（形を変えた時だけ）
//   node scripts/live/go.mjs --new     新しい一局を始める
//   node scripts/live/go.mjs --move    環境変数 ISSUE_TITLE と ISSUE_USER の一手を打ち、返事の文を標準出力に書く
//   node scripts/live/go.mjs           README の盤だけを書き直す

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const N = 5;
const COLS = 'ABCDE';
const REPO = 'aim-qu/aim-qu';
const STATE = new URL('../../data/go.json', import.meta.url);
const README = new URL('../../README.md', import.meta.url);
const TILES = new URL('../../assets/go/', import.meta.url);

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 押した目と上下左右を返す。stonesは1が黒、0が白
function flip(stones, r, c) {
  const out = stones.slice();
  for (const [dr, dc] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const rr = r + dr, cc = c + dc;
    if (rr >= 0 && rr < N && cc >= 0 && cc < N) out[rr * N + cc] ^= 1;
  }
  return out;
}

// 新しい一局。すべて白の盤から何手か返して作るので、必ず解ける
function newGame(game) {
  for (let s = 0; ; s++) {
    const r = mulberry32(game * 7919 + s);
    let stones = new Array(N * N).fill(0);
    const k = 6 + Math.floor(r() * 4), used = new Set();
    while (used.size < k) used.add(Math.floor(r() * N * N));
    for (const i of used) stones = flip(stones, Math.floor(i / N), i % N);
    const black = stones.reduce((a, b) => a + b, 0);
    if (black >= 7) return { game, stones, moves: [], started: new Date().toISOString() };
  }
}

// 一目の絵。盤の端と隅は線が内側にだけ伸びる。白石は蛤、黒石は那智黒のつもりで、艶は控えめにする
function tileSvg(pos, color, mark) {
  const up = !pos.includes('t'), down = !pos.includes('b'), left = !pos.includes('l'), right = !pos.includes('r');
  const lines = `M${left ? 0 : 60} 60H${right ? 120 : 60}M60 ${up ? 0 : 60}V${down ? 120 : 60}`;
  const stone = color === 'b'
    ? '<circle cx="60" cy="60" r="44" fill="url(#bk)"/><ellipse cx="46" cy="42" rx="15" ry="9" fill="#fff" opacity=".07" transform="rotate(-30 46 42)"/>'
    : '<circle cx="60" cy="60" r="44" fill="url(#wh)" stroke="#8b8378" stroke-width="1.1"/>';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120">
<defs>
<filter id="fib" filterUnits="userSpaceOnUse" x="0" y="0" width="120" height="120"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="${'tlrbc'.indexOf(pos[0]) + 3}"/><feColorMatrix type="matrix" values="0 0 0 0 0.34  0 0 0 0 0.29  0 0 0 0 0.21  0 0 0 0.1 0"/></filter>
<filter id="sh" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.6"/></filter>
<radialGradient id="bk" cx=".42" cy=".38" r=".7"><stop offset="0" stop-color="#2e2b28"/><stop offset=".7" stop-color="#1c1a18"/><stop offset="1" stop-color="#121110"/></radialGradient>
<radialGradient id="wh" cx=".42" cy=".38" r=".72"><stop offset="0" stop-color="#fbf8f1"/><stop offset=".72" stop-color="#efe9de"/><stop offset="1" stop-color="#ddd5c7"/></radialGradient>
</defs>
<rect width="120" height="120" fill="#ece3d1"/>
<rect width="120" height="120" filter="url(#fib)"/>
<path d="${lines}" stroke="#4a4239" stroke-opacity=".5" stroke-width="2"/>
<circle cx="62" cy="64" r="44" fill="#3a3024" opacity=".22" filter="url(#sh)"/>
${stone}
${mark ? '<circle cx="60" cy="60" r="5.5" fill="#b8341f"/>' : ''}
</svg>
`;
}
const posOf = (r, c) => (r === 0 ? 't' : r === N - 1 ? 'b' : '') + (c === 0 ? 'l' : c === N - 1 ? 'r' : '') || 'c';

function writeTiles() {
  mkdirSync(TILES, { recursive: true });
  for (const pos of ['tl', 't', 'tr', 'l', 'c', 'r', 'bl', 'b', 'br']) {
    for (const color of ['b', 'w']) {
      for (const mark of [false, true]) writeFileSync(new URL(`${pos}-${color}${mark ? '-m' : ''}.svg`, TILES), tileSvg(pos, color, mark));
    }
  }
}

const cellName = (r, c) => `${COLS[c]}${r + 1}`;
const issueUrl = (cell) => `https://github.com/${REPO}/issues/new?title=${encodeURIComponent(`石を返す　${cell}`)}&body=${encodeURIComponent(`このまま送信すると、${cell}の石とその上下左右の石が返ります。\n一分ほどでREADMEの盤が書き換わり、このissueは自動で閉じます。`)}`;
const fmtDate = (iso) => { const d = new Date(new Date(iso).getTime() + 9 * 3600000); return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日`; };

// READMEの盤の段。一目ずつリンクにした絵を五つずつ並べ、下に決まりを一行、棋譜は折りたたむ
export function goBlock(state) {
  const last = state.moves.at(-1);
  const rows = [];
  for (let r = 0; r < N; r++) {
    const cells = [];
    for (let c = 0; c < N; c++) {
      const color = state.stones[r * N + c] ? 'b' : 'w';
      const mark = last && last.cell === cellName(r, c);
      cells.push(`<a href="${issueUrl(cellName(r, c))}"><img src="./assets/go/${posOf(r, c)}-${color}${mark ? '-m' : ''}.svg" width="64" alt="${cellName(r, c)} ${color === 'b' ? '黒' : '白'}"></a>`);
    }
    rows.push(cells.join(' '));
  }
  const black = state.stones.reduce((a, b) => a + b, 0);
  const kifu = state.moves.slice(-8).reverse().map(m => `${m.n}手目　${m.cell}　@${m.user}　${fmtDate(m.at)}`);
  const past = (state.history ?? []).slice(-5).reverse().map(h => `第${h.game}局　${h.moves}手で白にそろう（${h.players}人で）　${fmtDate(h.at)}`);
  return `<!-- live:go -->
<p align="center">
${rows.join('<br>\n')}
</p>

<p align="center"><sub>石を押すと、その石と上下左右の石が返ります。すべて白にそろえると一局おわり。いま第${state.game}局、黒が${black}個。</sub></p>

<details>
<summary><sub>棋譜</sub></summary>

${kifu.length ? kifu.map(s => `- ${s}`).join('\n') : '- まだ一手も打たれていません'}
${past.length ? '\n' + past.map(s => `- ${s}`).join('\n') : ''}

</details>
<!-- /live:go -->`;
}

function writeBlock(state) {
  let readme = readFileSync(README, 'utf8');
  const re = /<!-- live:go -->[\s\S]*?<!-- \/live:go -->/;
  const block = goBlock(state);
  readme = re.test(readme) ? readme.replace(re, block) : `${readme.trimEnd()}\n\n${block}\n`;
  writeFileSync(README, readme);
}
const save = (state) => writeFileSync(STATE, JSON.stringify(state, null, 1) + '\n');

const args = process.argv.slice(2);
if (args.includes('--tiles')) {
  writeTiles();
} else if (args.includes('--new')) {
  const state = newGame(1);
  state.history = [];
  save(state);
  writeBlock(state);
} else if (args.includes('--move')) {
  // issueのタイトルと書いた人は外から来る値なので、形を確かめてから使う
  const state = JSON.parse(readFileSync(STATE, 'utf8'));
  const m = /^\s*石を返す\s*([A-Ea-e])\s*([1-5])\s*$/.exec(process.env.ISSUE_TITLE ?? '');
  const user = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(process.env.ISSUE_USER ?? '') ? process.env.ISSUE_USER : 'someone';
  if (!m) {
    console.log('盤の目が読み取れませんでした。READMEの盤の石を押して開いたissueを、そのまま送ってください。');
    process.exit(0);
  }
  const c = COLS.indexOf(m[1].toUpperCase()), r = +m[2] - 1, cell = cellName(r, c);
  state.stones = flip(state.stones, r, c);
  state.moves.push({ n: state.moves.length + 1, cell, user, at: new Date().toISOString() });
  let reply = `${cell}の石と上下左右の石を返しました。第${state.game}局の${state.moves.length}手目です。`;
  if (state.stones.every(s => s === 0)) {
    const players = new Set(state.moves.map(x => x.user)).size;
    state.history = [...(state.history ?? []), { game: state.game, moves: state.moves.length, players, at: new Date().toISOString() }];
    reply += `\n\nすべて白にそろいました。第${state.game}局は${state.moves.length}手、${players}人でおわりです。続けて第${state.game + 1}局を並べました。`;
    Object.assign(state, newGame(state.game + 1));
  } else {
    reply += `\n黒はあと${state.stones.reduce((a, b) => a + b, 0)}個です。`;
  }
  save(state);
  writeBlock(state);
  console.log(reply);
} else {
  writeBlock(JSON.parse(readFileSync(STATE, 'utf8')));
}
