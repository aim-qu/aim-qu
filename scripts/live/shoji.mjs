// 障子と候。東経135°・北緯35°の家の、南向きの窓の障子を部屋の中から見る。
// 外の竹の影が、その時刻の日差し（夜は月明かり）の向きどおりに紙へ落ちる。
// 薄曇りは影が淡く、厚い雲や雨の日は影が消える。風の強さで近い葉の影がそよぐ。夜は部屋の行灯が下から紙を照らす。
// 紙の一枡に、いまの七十二候を縦書きで書き、節気と候の朱印を押す。
// 紙・遠い竹の影・行灯の明かりはJPEGに焼き込み、近い竹の影・組子・字をSVGで重ねる。
// 絵を開いて三秒たつと、中の一枚がひとりでに左へあいて、外の竹林が水墨の絵で見える

import { readFileSync } from 'node:fs';
import jpeg from 'jpeg-js';
import { Resvg } from '@resvg/resvg-js';
import { bodies, horizontal, refraction, moonParallax, rev } from './astro.mjs';
import { mulberry32, seedOf, NEAR, FAR, grove, leafD } from './bamboo.mjs';
import { renderGarden } from './garden.mjs';

// 字の無い絵なので、描くたびにシステムの字体を読みに行かせない
const NO_FONTS = { font: { loadSystemFonts: false } };

const KOU = JSON.parse(readFileSync(new URL('../../data/kou72.json', import.meta.url), 'utf8'));
const GLYPHS = JSON.parse(readFileSync(new URL('../../data/glyphs.json', import.meta.url), 'utf8'));

export const W = 1600, H = 760;
const RAD = Math.PI / 180;
// 1mmあたりの画素。画面の上端は床から1700mm
const S = 0.72, Z1 = 1700, Z0 = Z1 - H / S;

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const mix = (a, b, t) => a + (b - a) * t;
const mix3 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const f1 = (x) => (Math.round(x * 10) / 10).toString();
const hex = (c) => '#' + c.map(v => Math.round(clamp(v) * 255).toString(16).padStart(2, '0')).join('');
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

// 二次元の値ノイズ
function h21(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function vn2(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  return mix(mix(h21(ix, iy), h21(ix + 1, iy), ux), mix(h21(ix, iy + 1), h21(ix + 1, iy + 1), ux), uy);
}
function fbm2(x, y, oct = 4) {
  let s = 0, a = 0.5;
  for (let i = 0; i < oct; i++) { s += a * vn2(x, y); x = x * 2.03 + 5.1; y = y * 2.03 + 1.7; a *= 0.5; }
  return s;
}

// いまの候。太陽の黄経を立春の315°から5°ずつ区切る
export function kouOf(date) {
  const B = bodies(date);
  return KOU[Math.floor(rev(B.sun.lon - 315) / 5) % 72];
}

// 障子に当たる光の向き。南向きの壁なので、方位は南から西回りに測る。
// 物の影は、壁からの距離dに対して横へ -d·tx、下へ d·tz ずれる
function source(alt, az) {
  const dA = ((az - 180 + 540) % 360) - 180;
  const cosInc = Math.cos(alt * RAD) * Math.cos(dA * RAD);
  if (alt <= 0 || cosInc <= 0.03) return null;
  return { alt, dA, cosInc, tx: Math.tan(dA * RAD), tz: Math.tan(alt * RAD) / Math.cos(dA * RAD) };
}

// 半影のぼけ（画素）。太陽も月も見かけの径は約0.53°で、半影の幅をガウスのσに直し、紙の中での散りを足す
const penumbra = (d) => d * 0.0093 * S / 3.5 + 0.8;

// 一つの層の影の形。稈は節の輪を少し太く、枝と小枝は線、葉は房ごとにまとめる
function shadowShapes(L, src) {
  const dx = -L.d * src.tx, dz = -L.d * src.tz;
  const to = (x, z) => [(x + dx) * S, (Z1 - (z + dz)) * S];
  const g = grove(L, -dx, W / S - dx, Z0 - dz, Z1 - dz);
  const inView = (q, m) => q[0] > -m && q[0] < W + m && q[1] > -m && q[1] < H + m;
  const culms = [];
  for (const c of g.culms) {
    const zb = Z0 - dz - 200, zt = Math.min(c.top, Z1 - dz + 200);
    if (zt <= zb) continue;
    const a = to(c.xAt(zb) - c.D / 2, zb), b = to(c.xAt(zt) - c.D / 2, zt), e = to(c.xAt(zt) + c.D / 2, zt), f = to(c.xAt(zb) + c.D / 2, zb);
    if (Math.max(a[0], b[0], e[0], f[0]) < -20 || Math.min(a[0], b[0], e[0], f[0]) > W + 20) continue;
    let d = `M${f1(a[0])} ${f1(a[1])}L${f1(b[0])} ${f1(b[1])}L${f1(e[0])} ${f1(e[1])}L${f1(f[0])} ${f1(f[1])}Z`;
    for (const z of c.nodes) {
      if (z < zb || z > zt) continue;
      const p = to(c.xAt(z) - c.D * 0.6, z + 9), q = to(c.xAt(z) + c.D * 0.6, z - 9);
      d += `M${f1(p[0])} ${f1(p[1])}H${f1(q[0])}V${f1(q[1])}H${f1(p[0])}Z`;
    }
    culms.push(d);
  }
  const branches = [];
  for (const b of g.branches) {
    const pts = b.map(([x, z]) => to(x, z));
    if (!pts.some(q => inView(q, 40))) continue;
    branches.push('M' + pts.map(q => `${f1(q[0])} ${f1(q[1])}`).join('L'));
  }
  const tufts = [];
  for (const t of g.tufts) {
    const pivot = to(t.x, t.z);
    if (!inView(pivot, 220)) continue;
    tufts.push({ pivot, d: t.leaves.map(l => leafD(t.x, t.z, l.a, l.len, l.wid, to)).join('') });
  }
  return { culms, branches, tufts };
}

// 障子の割り付け（画面座標）。引き違いの召し合わせを560と1193.6に置き、一枚の幅は880mm
const PANEL_W = 880 * S;
const JOINTS = [560 - PANEL_W, 560, 560 + PANEL_W, 560 + 2 * PANEL_W];
const STILE = 16, BAR = 6.5;
const ROWS = [1620, 1350, 1080, 810].map(z => (Z1 - z) * S);
const colsOf = (p) => {
  const inner = PANEL_W - 2 * STILE, cw = (inner - 2 * BAR) / 3;
  return [p + STILE + cw, p + STILE + 2 * cw + BAR];
};
// 字を書く枡：中の一枚の真ん中の列、上から二段目
const CELL = (() => {
  const [c1, c2] = colsOf(JOINTS[1]);
  return { x: c1 + BAR, y: ROWS[1] + BAR / 2, w: c2 - c1 - BAR, h: ROWS[2] - ROWS[1] - BAR };
})();

const RAIN = new Set([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99]);
const SNOW = new Set([71, 73, 75, 77, 85, 86]);

// 光の具合。紙の色は、空からの明かり（影の所）に直射を足したもの。夜は行灯が加わる
function lighting(date, weather, lat, lon) {
  const B = bodies(date);
  const lst = rev(B.gmst + lon);
  const sun = horizontal(B.sun.ra, B.sun.dec, lst, lat);
  sun.alt += refraction(sun.alt);
  const moon = horizontal(B.moon.ra, B.moon.dec, lst, lat);
  moon.alt = moonParallax(moon.alt, B.moon.rEarth);
  moon.alt += refraction(moon.alt);
  const cloud = weather ? clamp((weather.cloud ?? 0) / 100) : 0.15;
  const wet = !!weather && ((weather.precip ?? 0) > 0.05 || RAIN.has(weather.code));
  const snow = !!weather && SNOW.has(weather.code);
  const fog = !!weather && (weather.code === 45 || weather.code === 48);
  const clear = wet || snow || fog ? 0 : 1 - cloud ** 1.6;
  const day = smooth(-10, 6, sun.alt);

  let src = null;
  const s = source(sun.alt, sun.az);
  if (s) src = { ...s, kind: 'sun', k: clear * clamp(s.cosInc * 1.3) * smooth(0, 5, sun.alt) };
  else if (day < 0.2) {
    const m = source(moon.alt, moon.az);
    if (m) src = { ...m, kind: 'moon', k: clear * clamp(m.cosInc * 1.3) * B.moon.illum ** 1.3 * smooth(1, 10, moon.alt) };
  }
  if (src && src.k < 0.04) src = null;

  // 影の所の紙。昼の晴れは空の青みをわずかに帯び、曇りと雨は灰色、夜は暗い紺。薄明は少し暖かい。
  // 紙は透かすと少し黄みがかるので、最後に紙の色を掛ける
  const dayDiffuse = wet ? [0.6, 0.62, 0.64] : snow ? [0.82, 0.83, 0.84] : mix3([0.66, 0.69, 0.73], [0.8, 0.8, 0.79], cloud);
  let diffuse = mix3([0.075, 0.09, 0.125], dayDiffuse, day);
  const dusk = Math.exp(-(((sun.alt - 1) / 5) ** 2));
  diffuse = mix3(diffuse, [diffuse[0] * 1.12, diffuse[1], diffuse[2] * 0.9], dusk * (1 - cloud));
  // 直射。日が低いほど赤く、月は青白い
  const sunCol = mix3([0.46, 0.27, 0.1], [0.34, 0.31, 0.25], smooth(3, 30, sun.alt));
  let direct = src ? (src.kind === 'sun' ? sunCol : [0.14, 0.17, 0.22]).map(v => v * src.k) : [0, 0, 0];
  diffuse = diffuse.map((v, i) => v * PAPER_TINT[i]);
  direct = direct.map((v, i) => v * PAPER_TINT[i]);
  const lit = diffuse.map((v, i) => v + direct[i]);
  // 行灯。日没から夜明けまで。雨の日は昼でも部屋が暗いので、弱めに灯す。23時を過ぎると少し落とす
  const jstHour = (date.getUTCHours() + 9) % 24;
  const lamp = clamp(1 - day + (wet ? 0.3 : 0)) * (jstHour >= 23 || jstHour < 5 ? 0.72 : 1);
  return { sun, moon, B, cloud, wet, snow, fog, day, src, diffuse, direct, lit, lamp, wind: weather?.wind ?? 6 };
}

// 紙を透かした光の色
const PAPER_TINT = [1, 0.965, 0.9];
// 行灯の明かりの広がり。字の枡の下の床、画面の外に置く。障子からの距離（mm）は組子の影のずれに使う
const LAMP_AT = [720, 990], LAMP_COL = [0.95, 0.72, 0.45], LAMP_D = 900;
const lampFall = (x, y) => 1 / (1 + (Math.hypot(x - LAMP_AT[0], y - LAMP_AT[1]) / 430) ** 2);

function encodeJpeg(rgb, w, h, quality) {
  const data = Buffer.alloc(w * h * 4);
  for (let i = 0, j = 0; i < rgb.length; i += 3, j += 4) {
    data[j] = rgb[i]; data[j + 1] = rgb[i + 1]; data[j + 2] = rgb[i + 2]; data[j + 3] = 255;
  }
  return jpeg.encode({ data, width: w, height: h }, quality).data;
}

// SVGを描いてアルファだけを取り出す
function alphaOf(body) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${body}</svg>`;
  const px = new Resvg(svg, NO_FONTS).render().pixels;
  const a = new Float32Array(W * H);
  for (let i = 0; i < a.length; i++) a[i] = px[i * 4 + 3] / 255;
  return a;
}

// 紙の繊維。透かすと楮の繊維の束が細く暗く、薄い所が明るく見える。毎回同じ紙
let fiberCache = null;
function fibers() {
  if (fiberCache) return fiberCache;
  const r = mulberry32(4242);
  const curve = (n, w0, w1, op0, op1) => {
    let s = '';
    for (let i = 0; i < n; i++) {
      const x = r() * W, y = r() * H, a = r() * Math.PI * 2, len = 14 + r() ** 2 * 80;
      const bx = x + Math.cos(a) * len, by = y + Math.sin(a) * len;
      const cx = (x + bx) / 2 + (r() - 0.5) * len * 0.6, cy = (y + by) / 2 + (r() - 0.5) * len * 0.6;
      s += `<path d="M${f1(x)} ${f1(y)}Q${f1(cx)} ${f1(cy)} ${f1(bx)} ${f1(by)}" stroke-width="${(w0 + r() * (w1 - w0)).toFixed(2)}" stroke-opacity="${(op0 + r() * (op1 - op0)).toFixed(2)}"/>`;
    }
    return s;
  };
  fiberCache = {
    dark: alphaOf(`<g fill="none" stroke="#000" stroke-linecap="round">${curve(2600, 0.4, 1.1, 0.25, 0.7)}</g>`),
    light: alphaOf(`<g fill="none" stroke="#000" stroke-linecap="round">${curve(700, 0.8, 2.2, 0.2, 0.5)}</g>`),
  };
  return fiberCache;
}

// 紙のJPEG。遠い竹の影はぼかしてここで落とす
function paper(L, far) {
  const fib = fibers();
  let farCov = null;
  if (far) {
    const sig = penumbra(FAR.d);
    farCov = alphaOf(`<filter id="b" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="${sig.toFixed(2)}"/></filter>`
      + `<g filter="url(#b)" fill="#000" stroke="#000" stroke-linecap="round">${far.culms.map(d => `<path d="${d}" stroke="none"/>`).join('')}`
      + `<path d="${far.branches.join('')}" fill="none" stroke-width="${(FAR.twig * S).toFixed(1)}"/>${far.tufts.map(t => `<path d="${t.d}" stroke="none"/>`).join('')}</g>`);
  }
  const rgb = new Uint8Array(W * H * 3);
  for (let y = 0; y < H; y++) {
    // 壁の上の方ほど空がよく見えて、わずかに明るい
    const skyK = 0.94 + 0.1 * (1 - y / H);
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const dk = farCov ? 1 - farCov[i] * 0.92 : 1;
      const lf = L.lamp * lampFall(x, y);
      const cloudy = 1 + 0.045 * (fbm2(x / 90, y / 90) - 0.5) + 0.02 * (fbm2(x / 18 + 30, y / 18) - 0.5);
      const t = cloudy * (1 - 0.032 * fib.dark[i] + 0.022 * fib.light[i]);
      for (let c = 0; c < 3; c++) {
        const v = (L.diffuse[c] * skyK + L.direct[c] * dk) * t + LAMP_COL[c] * lf * (0.92 + 0.08 * t);
        rgb[i * 3 + c] = Math.round(clamp(v) * 255);
      }
    }
  }
  return encodeJpeg(rgb, W, H, 86).toString('base64');
}

// 縦書き。小書きの仮名は字送りの右上へ寄せる
const SMALL = new Set([...'ぁぃぅぇぉっゃゅょゎ']);
function vertical(text, x, y, size, gap, fill, cls, t0, step) {
  let out = '', cy = y, t = t0;
  for (const ch of text) {
    const d = GLYPHS[ch];
    if (!d) throw new Error(`字形がありません: ${ch}`);
    const sx = x - size / 2 + (SMALL.has(ch) ? size * 0.13 : 0), sy = cy - (SMALL.has(ch) ? size * 0.13 : 0);
    out += `<path class="${cls}" style="animation-delay:${t.toFixed(2)}s" transform="translate(${f1(sx)} ${f1(sy)}) scale(${(size / 1000).toFixed(4)})" d="${d}" fill="${fill}"/>`;
    cy += size * gap;
    t += step;
  }
  return { svg: out, end: cy, t };
}

export function renderShoji({ date, weather, lat, lon }) {
  const L = lighting(date, weather, lat, lon);
  const kou = kouOf(date);
  const near = L.src ? shadowShapes(NEAR, L.src) : null;
  const far = L.src ? shadowShapes(FAR, L.src) : null;
  const paperJpeg = paper(L, far);

  // 近い影の色。紙に掛け合わせる比で、行灯の明かりは竹に遮られないぶん薄まる
  const lampMean = LAMP_COL.map(v => v * L.lamp * 0.3);
  const mul = L.diffuse.map((v, i) => (v + lampMean[i]) / (L.lit[i] + lampMean[i]));
  const sig = penumbra(NEAR.d);

  // そよぎ。風速（km/h）で振れ幅を決め、房ごとに型と周期をずらす
  const amp = clamp(1.4 + L.wind * 0.15, 1.4, 6.5);
  const sw = mulberry32(99);
  const kfs = [];
  for (let k = 0; k < 6; k++) {
    let s = `@keyframes w${k}{`;
    const n = 4 + Math.floor(sw() * 3);
    for (let i = 0; i <= n; i++) s += `${Math.round(i / n * 100)}%{transform:rotate(${(i === 0 || i === n ? 0 : (sw() * 2 - 0.6) * amp).toFixed(2)}deg)}`;
    kfs.push(s + '}');
  }
  // 落ちる葉の影。時々一枚、くるくる回りながら紙の上を落ちていく。
  // 縦の動きは影でもそのまま縦に写るので、紙の高さ約1mを三、四秒で抜ける
  const fall = mulberry32(seedOf(11, Math.floor(date.getTime() / 3600000)));
  const fallers = [];
  if (L.src) {
    [31, 53].forEach((period, i) => {
      const dur = 3.2 + fall() * 1.4, delay = 3 + i * 9 + fall() * 6;
      const len = (NEAR.leaf[0] + fall() * NEAR.leaf[1]) * S, wid = len * (0.14 + fall() * 0.03);
      const x0 = W * (0.12 + fall() * 0.76), drift = (fall() - 0.35) * 280;
      const spin = (fall() < 0.5 ? -1 : 1) * (300 + fall() * 360), a0 = fall() * 180;
      const p = dur / period * 100, n = 9;
      let kf = `@keyframes f${i}{`;
      for (let k = 0; k <= n; k++) {
        const t = k / n;
        const x = x0 + drift * t + Math.sin(t * Math.PI * 2.6 + i) * 34, y = -90 + (H + 180) * t;
        const a = a0 + spin * t + Math.sin(t * Math.PI * 5) * 25;
        kf += `${(p * t).toFixed(2)}%{transform:translate(${f1(x)}px,${f1(y)}px) rotate(${a.toFixed(1)}deg);opacity:${k === 0 || k === n ? 0 : 1}}`;
      }
      kfs.push(kf + `100%{transform:translate(${f1(x0 + drift)}px,${H + 90}px);opacity:0}}`);
      const d = leafD(0, -len / 2, Math.PI / 2, len, wid, (x, z) => [x, -z]);
      fallers.push(`<path class="sw" style="animation:f${i} ${period}s linear ${delay.toFixed(1)}s infinite;opacity:0" d="${d}"/>`);
    });
  }

  let shadowSvg = '';
  if (near && near.tufts.length + near.culms.length + fallers.length) {
    const tufts = near.tufts.map((t, i) => {
      const r = mulberry32(seedOf(5, Math.round(t.pivot[0]), Math.round(t.pivot[1])));
      const dur = (2.8 + r() * 2.6).toFixed(2), delay = (-r() * 5).toFixed(2);
      return `<path class="sw" style="transform-origin:${f1(t.pivot[0])}px ${f1(t.pivot[1])}px;animation:w${i % 6} ${dur}s ease-in-out ${delay}s infinite" d="${t.d}"/>`;
    }).join('');
    shadowSvg = `<g style="mix-blend-mode:multiply"><g filter="url(#pen)" fill="${hex(mul)}">`
      + near.culms.map(d => `<path d="${d}"/>`).join('')
      + `<path d="${near.branches.join('')}" fill="none" stroke="${hex(mul)}" stroke-width="${(NEAR.twig * S).toFixed(1)}" stroke-linecap="round"/>`
      + tufts + fallers.join('') + '</g></g>';
  }

  // 組子と框。部屋の側は障子からの照り返しで明るみ、夜は行灯に照らされる。
  // 正面から少し外れた桟は、紙に照らされた側面がわずかに見える
  const room = 0.3 * lum(L.diffuse) + 0.42 * lum(L.lit);
  const woodDay = [0.8, 0.69, 0.53].map(v => v * room);
  const woodLamp = [0.78, 0.5, 0.24].map(v => v * L.lamp);
  const rim = L.lit.map((v, i) => mix(v, woodDay[i], 0.3));
  const woodFill = L.lamp > 0.02 ? 'url(#wood)' : hex(woodDay);

  // 字。候の名を右に、読みを左に。dxは障子をあけて枡が動いた分
  const ink = '#1c1a17';
  const nameSize = 40, yomiSize = 15.5;
  const light = clamp(lum(L.lit) * 1.15 + L.lamp * 0.35);
  const sealCol = hex([0.72, 0.17, 0.1].map(v => v * mix(0.45, 1, light)));
  const writing = (dx) => {
    const top = CELL.y + 16, nx = CELL.x + dx + CELL.w * 0.67;
    const name = vertical(kou.name, nx, top, nameSize, 1.04, ink, 'ch', 0.6, 0.32);
    // 長い読みは、data/kou72.json に決めた言葉の切れ目で二行にする
    const yomi = [...kou.yomi];
    const lines = kou.br ? [yomi.slice(0, kou.br).join(''), yomi.slice(kou.br).join('')] : [kou.yomi];
    let t = name.t + 0.25, ys = '';
    lines.forEach((line, i) => {
      const v = vertical(line, nx - 42 - i * 21, top + 5, yomiSize, 1.06, '#2a2722', 'ch', t, 0.07);
      ys += v.svg; t = v.t;
    });
    // 朱印。白文で、右の行に節気、左の行に初候・次候・末候
    const sz = 34, sx = CELL.x + dx + 16, sy = CELL.y + CELL.h - 16 - sz, gs = 13.5;
    const sealChars = [[kou.sekki[0], 0, 0], [kou.sekki[1], 0, 1], [kou.kou[0], 1, 0], [kou.kou[1], 1, 1]];
    const seal = `<g class="seal" style="animation-delay:${(t + 0.3).toFixed(2)}s"><rect x="${f1(sx)}" y="${f1(sy)}" width="${sz}" height="${sz}" fill="${sealCol}"/>`
      + sealChars.map(([ch, col, row]) => `<path transform="translate(${f1(sx + sz - 3.2 - gs - col * (gs + 0.6))} ${f1(sy + 3 + row * (gs + 0.8))}) scale(${(gs / 1000).toFixed(4)})" d="${GLYPHS[ch]}" fill="#f6e9dc"/>`).join('')
      + '</g>';
    return name.svg + ys + seal;
  };

  // 絵を開いて三秒たつと、中の一枚を左へ引いて左の一枚に重ねる。引くのは框と組子と字で、
  // 紙に落ちる竹の影はその場に残る。影は外の竹と日差しで決まるので、紙が動いても動かない。
  // あいた所は、引く一枚の右の框と一緒に左へ動く切り抜きを作り、その中で外の絵だけを止めたまま見せる。
  // 重なった所は紙が二重になって少し暗い
  const side = frameShapes([JOINTS[0], JOINTS[2]]);
  const mid = frameShapes([JOINTS[1]]);
  const gx0 = JOINTS[1], gx1 = JOINTS[2];
  const garden = renderGarden({ L, date, x0: gx0, x1: gx1, H, S, Z1 });
  // 召し合わせの細い隙間は、引く一枚の両端に付けて一緒に動かす
  const midGaps = [gx0, gx1].map(x => `M${f1(x - 1.2)} 0h2.4V${H}h-2.4Z`).join('');
  // 夜は行灯の光で組子の影が紙に落ちる。組子は紙から15mm手前にあるので、影は行灯から離れる向きへ少し広がる。
  // 引く一枚の分は乗算にせず、同じくらいの濃さの黒を重ねる。動かす要素の中では、下の紙と乗算できないことがあるため
  const lampScale = `translate(${LAMP_AT[0]} ${LAMP_AT[1]}) scale(${(1 + 15 / (LAMP_D - 15)).toFixed(4)}) translate(${-LAMP_AT[0]} ${-LAMP_AT[1]})`;
  const barShade = (bars, fill, op, blend) => L.lamp > 0.05
    ? `<g${blend ? ' style="mix-blend-mode:multiply"' : ''} opacity="${(op * clamp(L.lamp)).toFixed(2)}"><path filter="url(#lampPen)" transform="${lampScale}" d="${bars.join('')}" fill="${fill}"/></g>`
    : '';
  const shift = f1(PANEL_W);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="障子に映る竹の影と、七十二候「${kou.name}」。三秒たつと一枚があいて、外の竹林が見える">
<defs>
<style>
${kfs.join('\n')}
${garden.kfs.join('\n')}
.sw{transform-box:view-box}
.ch{animation:ink .7s ease-out both}
.seal{animation:ink .5s ease-out both}
.mv,.mvb{animation:1.8s cubic-bezier(.45,0,.2,1) 3s both}
.mv{animation-name:pull}.mvb{animation-name:stay}
@keyframes ink{from{opacity:0}to{opacity:1}}
@keyframes pull{from{transform:translateX(0)}to{transform:translateX(-${shift}px)}}
@keyframes stay{from{transform:translateX(0)}to{transform:translateX(${shift}px)}}
@media (prefers-reduced-motion:reduce){.sw,.ch,.seal{animation:none!important}.mv{animation:none!important;transform:translateX(-${shift}px)}.mvb{animation:none!important;transform:translateX(${shift}px)}}
</style>
<filter id="pen" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation="${sig.toFixed(2)}"/></filter>
<filter id="lampPen" x="-2%" y="-2%" width="104%" height="104%"><feGaussianBlur stdDeviation="2.2"/></filter>
${garden.defs}
<clipPath id="midArea"><rect x="${f1(gx0)}" width="${shift}" height="${H}"/></clipPath>
<clipPath id="reveal"><rect x="${f1(gx1)}" width="${shift}" height="${H}"/></clipPath>
<clipPath id="leftArea"><rect x="${f1(JOINTS[0])}" width="${shift}" height="${H}"/></clipPath>
<radialGradient id="wood" gradientUnits="userSpaceOnUse" cx="${LAMP_AT[0]}" cy="${LAMP_AT[1]}" r="1500">
${[0, 0.25, 0.5, 0.75, 1].map(o => `<stop offset="${o}" stop-color="${hex(woodDay.map((v, i) => v + woodLamp[i] * lampFall(LAMP_AT[0] + o * 1500, LAMP_AT[1])))}"/>`).join('')}
</radialGradient>
</defs>
<image href="data:image/jpeg;base64,${paperJpeg}" width="${W}" height="${H}"/>
${shadowSvg}
${barShade(side.bars, '#5b4a3a', 0.55, true)}
<g clip-path="url(#midArea)"><g class="mv"><g clip-path="url(#reveal)"><g class="mvb"><image href="data:image/jpeg;base64,${garden.jpg}" x="${f1(gx0)}" width="${garden.w}" height="${H}"/>${garden.sprites}${garden.overlay}</g></g></g></g>
<path d="${side.rims.join('')}" fill="${hex(rim)}" opacity=".8"/>
<path d="${side.bars.join('')}" fill="${woodFill}"/>
<g clip-path="url(#leftArea)"><rect class="mv" x="${f1(gx0)}" width="${shift}" height="${H}" fill="#000" opacity=".16"/></g>
<g class="mv">
${barShade(mid.bars, '#000', 0.39, false)}
<path d="${mid.rims.join('')}" fill="${hex(rim)}" opacity=".8"/>
<path d="${mid.bars.join('')}" fill="${woodFill}"/>
<path d="${midGaps}" fill="#000" opacity=".22"/>
${writing(0)}
</g>
</svg>
`;

  return {
    svg,
    info: {
      kou: { n: kou.n, name: kou.name, yomi: kou.yomi, sekki: kou.sekki, kou: kou.kou },
      light: L.src ? { kind: L.src.kind, k: +L.src.k.toFixed(2), dA: +L.src.dA.toFixed(1), alt: +L.src.alt.toFixed(1) } : null,
      sunAlt: +L.sun.alt.toFixed(1), cloud: L.cloud, wet: L.wet, wind: L.wind, lamp: +L.lamp.toFixed(2),
    },
  };
}

// 組子と框の形。panelsは障子の左端の位置。隣り合う二枚の框は並んで召し合わせになり、境に細い隙間の影ができる
function frameShapes(panels) {
  const bars = [], rims = [], gaps = [];
  const rimW = (dx) => clamp(Math.abs(dx) / 800 * 4.2, 0, 4.2);
  const vrim = (a, b, k) => {
    const rw = rimW((a + b) / 2 - W / 2) * k;
    rims.push(`M${f1(b < W / 2 ? b : a - rw)} 0h${f1(rw)}V${H}h${f1(-rw)}Z`);
  };
  for (const p of panels) {
    const q = p + PANEL_W;
    bars.push(`M${f1(p)} 0h${STILE}V${H}h${-STILE}Z`, `M${f1(q - STILE)} 0h${STILE}V${H}h${-STILE}Z`);
    vrim(p, p + STILE, 1.8);
    vrim(q - STILE, q, 1.8);
    if (panels.some(o => Math.abs(o - q) < 0.5)) gaps.push(`M${f1(q - 1.2)} 0h2.4V${H}h-2.4Z`);
    for (const cx of colsOf(p)) {
      bars.push(`M${f1(cx)} 0h${BAR}V${H}h${-BAR}Z`);
      vrim(cx, cx + BAR, 1);
    }
    const x0 = p + STILE, x1 = q - STILE;
    for (const ry of ROWS) {
      bars.push(`M${f1(x0)} ${f1(ry - BAR / 2)}H${f1(x1)}v${BAR}H${f1(x0)}Z`);
      const rh = rimW((ry - H / 2) * 1.6);
      rims.push(`M${f1(x0)} ${f1(ry < H / 2 ? ry + BAR / 2 : ry - BAR / 2 - rh)}H${f1(x1)}v${f1(rh)}H${f1(x0)}Z`);
    }
  }
  return { bars, rims, gaps };
}
