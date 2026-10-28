// 障子を一枚あけた所から見える外を、水墨に淡彩を差した一幅の絵として描く。
// 竹は障子に影を落としていたのと同じ竹林で、近い竹ほど濃墨、遠い竹ほど淡墨でにじむ。
// 稈は節ごとに一筆で引いて節の所を白く残し、葉は「个」「介」の形に寄せて筆を押してから抜く。
// 地面は描かず、下は霧と遠山の薄墨に溶かす。空はその時刻と天気の淡い色で刷き、夜は月を白く抜く。
// 動かない所はJPEGにし、降る雨や雪、時々落ちる葉だけをSVGで動かす

import jpeg from 'jpeg-js';
import { Resvg } from '@resvg/resvg-js';
import { mulberry32, seedOf, NEAR, FAR, DEEP, grove } from './bamboo.mjs';

// 字の無い絵なので、描くたびにシステムの字体を読みに行かせない
const NO_FONTS = { font: { loadSystemFonts: false } };

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const mix = (a, b, t) => a + (b - a) * t;
const mix3 = (a, b, t) => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const f1 = (x) => (Math.round(x * 10) / 10).toString();
const hex = (c) => '#' + c.map(v => Math.round(clamp(v) * 255).toString(16).padStart(2, '0')).join('');

// 目は障子から2.5m奥、畳に座った高さ（床から0.8m）にあり、まっすぐ南を見ている
const CAM_D = 2500, EYE_Z = 800;
const PAPER = [0.955, 0.94, 0.9];

function h21(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function vn1(x) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return mix(h21(i, 0.5), h21(i + 1, 0.5), u);
}

// 絵の地の色。空の上と地平のあたり、遠山、墨の濃さの掛け目
function palette(L) {
  const cloud = L.cloud, day = L.day;
  const moonK = L.moon.alt > 0 ? L.B.moon.illum * smooth(0, 15, L.moon.alt) : 0;
  let top = L.wet ? [0.76, 0.77, 0.78] : mix3([0.8, 0.86, 0.9], [0.86, 0.86, 0.85], cloud);
  let low = L.wet ? [0.84, 0.84, 0.83] : mix3([0.93, 0.93, 0.9], [0.9, 0.9, 0.88], cloud);
  // 夜は藍を刷いた暗い地。月があれば少し明るい
  const nightTop = mix3([0.2, 0.22, 0.29], [0.3, 0.33, 0.42], moonK), nightLow = mix3([0.27, 0.28, 0.33], [0.4, 0.42, 0.48], moonK);
  top = mix3(nightTop, top, day); low = mix3(nightLow, low, day);
  // 夕暮れと明け方は地平に代赭色を差す
  const tw = Math.exp(-(((L.sun.alt + 1) / 4.5) ** 2)) * (1 - 0.7 * cloud);
  low = mix3(low, [0.94, 0.8, 0.66], tw * 0.8);
  top = mix3(top, [0.7, 0.72, 0.82], tw * 0.6);
  const mount = mix3([0.66, 0.7, 0.74], [0.2, 0.22, 0.28], 1 - day);
  return { top, low, mount, tw, moonK, day, ink: mix(1, 0.75, 1 - day) };
}

export function renderGarden({ L, date, x0, x1, H, S, Z1 }) {
  const P = palette(L);
  const w = Math.round(x1 - x0);
  const horizon = (Z1 - EYE_Z) * S;
  const proj = (d) => {
    const k = CAM_D / (CAM_D + d);
    return { k, to: (x, z) => [800 - x0 + (x - 800 / S) * S * k, horizon + (EYE_Z - z) * S * k] };
  };
  const range = (d) => {
    const k = CAM_D / (CAM_D + d);
    return { xMin: 800 / S + (x0 - 800) / (S * k), xMax: 800 / S + (x1 - 800) / (S * k), zMin: EYE_Z - (H - horizon) / (S * k), zMax: EYE_Z + horizon / (S * k) };
  };
  const defs = [], body = [];
  const region = `filterUnits="userSpaceOnUse" x="-40" y="-40" width="${w + 80}" height="${H + 80}"`;
  // 墨のにじみ。輪郭をわずかに揺らしてぼかす
  const wetDef = `<filter id="wet" ${region}><feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="5" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="3.2" xChannelSelector="R" yChannelSelector="G" result="d"/><feGaussianBlur in="d" stdDeviation="0.7"/></filter>`;
  defs.push(wetDef);
  for (const [id, sd] of [['far1', 1.4], ['far2', 2.6], ['mist', 5]]) {
    defs.push(`<filter id="${id}" ${region}><feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="2" seed="9" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="5" xChannelSelector="R" yChannelSelector="G" result="d"/><feGaussianBlur in="d" stdDeviation="${sd}"/></filter>`);
  }
  // 渇筆。稈を縦に走るかすれ
  defs.push(`<filter id="dryN" ${region}><feTurbulence type="fractalNoise" baseFrequency="0.8 0.02" numOctaves="2" seed="11"/><feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -3.2 2.1"/></filter>`);
  defs.push(`<mask id="dry" maskUnits="userSpaceOnUse" x="-60" y="-60" width="${w + 120}" height="${H + 120}"><rect x="-60" y="-60" width="${w + 120}" height="${H + 120}" fill="#fff"/><rect width="${w}" height="${H}" filter="url(#dryN)" opacity=".35"/></mask>`);

  // 地。上から下へ空の淡彩を刷き、紙の地合いを残す
  defs.push(`<linearGradient id="sky" x1="0" y1="0" x2="0" y2="${H}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${hex(P.top)}"/><stop offset=".62" stop-color="${hex(P.low)}"/><stop offset="1" stop-color="${hex(mix3(P.low, PAPER, 0.5 * P.day))}"/></linearGradient>`);
  body.push(`<rect width="${w}" height="${H}" fill="url(#sky)"/>`);
  defs.push(`<filter id="grain" ${region}><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="2"/><feColorMatrix type="matrix" values="0 0 0 0 0.4  0 0 0 0 0.38  0 0 0 0 0.33  0 0 0 0.16 0"/></filter>`);
  body.push(`<rect width="${w}" height="${H}" filter="url(#grain)"/>`);

  // 月。夜、南の空にある時だけ、地を白く抜いて置く。欠け方は本物
  if (P.day < 0.4 && L.moon.alt > 0) {
    const dA = ((L.moon.az - 180 + 540) % 360) - 180;
    if (Math.abs(dA) < 80) {
      const mx = w * (0.5 + dA / 200), my = H * (0.12 + 0.25 * (1 - clamp(L.moon.alt / 60))), mr = 30;
      const k = L.B.moon.illum, ex = mr * Math.abs(1 - 2 * k), lit = L.B.moon.waxing ? 1 : -1;
      defs.push(`<radialGradient id="mh"><stop offset="0" stop-color="${hex(PAPER)}" stop-opacity=".5"/><stop offset="1" stop-color="${hex(PAPER)}" stop-opacity="0"/></radialGradient>`);
      body.push(`<circle cx="${f1(mx)}" cy="${f1(my)}" r="${mr * 3.2}" fill="url(#mh)" opacity="${(0.3 + 0.5 * k).toFixed(2)}"/>`);
      // 輝いている側は、上弦なら右（西）、下弦なら左
      body.push(`<g transform="translate(${f1(mx)} ${f1(my)}) scale(${lit} 1)" filter="url(#wet)"><circle r="${mr}" fill="${hex(mix3(P.top, PAPER, 0.25))}"/><path d="M0 ${-mr}A${mr} ${mr} 0 0 1 0 ${mr}A${f1(ex)} ${mr} 0 0 ${k >= 0.5 ? 1 : 0} 0 ${-mr}Z" fill="${hex(PAPER)}"/></g>`);
    }
  }

  // 遠山。地平の上に薄墨を二度刷く。奥ほど淡く、上の縁にだけ墨がたまる
  [[0.55, 46, 340, 0.45, 'far2'], [0.8, 22, 210, 0.6, 'far1']].forEach(([depth, amp, scale, op, f], i) => {
    let d = `M-30 ${H}`;
    for (let x = -30; x <= w + 30; x += 12) d += `L${x} ${f1(horizon - 14 - amp * vn1((x + x0) / scale + i * 7) - amp * 0.3 * vn1((x + x0) / (scale * 0.3) + 3))}`;
    d += `L${w + 30} ${H}Z`;
    body.push(`<path d="${d}" fill="${hex(mix3(P.mount, P.low, 1 - depth))}" opacity="${(op * mix(1, 0.8, 1 - P.day)).toFixed(2)}" filter="url(#${f})"/>`);
  });

  // 竹。奥の層から。墨の濃さは層ごとに決め、重なる所は乗算で濃くなる
  const layers = [
    { L: DEEP[0], ink: 0.78, leafInk: 0.74, filt: 'far2', keep: 0.6 },
    { L: DEEP[1], ink: 0.66, leafInk: 0.6, filt: 'far1', keep: 0.75 },
    { L: FAR, ink: 0.46, leafInk: 0.4, filt: 'wet', keep: 1, sway: true },
    { L: NEAR, ink: 0.26, leafInk: 0.18, filt: 'wet', keep: 1, sway: true },
  ];
  const sprites = [];
  const tone = (v, tint) => hex(mix3([v, v, v * 1.02], tint, 0.12).map(x => x * P.ink + (1 - P.ink) * 0.02));
  const leafTint = [0.45, 0.55, 0.4], culmTint = [0.5, 0.56, 0.44];
  for (const Ly of layers) {
    const { k, to } = proj(Ly.L.d);
    const r = range(Ly.L.d);
    const g = grove(Ly.L, r.xMin, r.xMax, Math.max(0, r.zMin), r.zMax);
    let parts = '', fills = '';
    for (const c of g.culms) {
      const keep = mulberry32(seedOf(Ly.L.seed, c.i, 7))();
      if (keep > Ly.keep) continue;
      const cw = Math.max(2, c.D * S * k * 1.15);
      // 稈は節ごとに下から一筆。筆の入りと抜きで両端がわずかに太く、中ほどは墨が薄い
      const nodes = [0, ...c.nodes.filter(z => z < c.top)];
      for (let n = 0; n < nodes.length - 1; n++) {
        const za = nodes[n], zb = nodes[n + 1];
        const pa = to(c.xAt(za), za), pb = to(c.xAt(zb), zb);
        if (pb[1] > H + 20 || pa[1] < -20 || Math.max(pa[0], pb[0]) < -cw - 10 || Math.min(pa[0], pb[0]) > w + cw + 10) continue;
        const gap = Math.max(1.5, cw * 0.28);
        const yb = pa[1] - gap / 2, yt = pb[1] + gap / 2;
        if (yb - yt < 2) continue;
        const hw = cw / 2, fl = cw * 0.06, mid = (yb + yt) / 2, xb = pa[0], xt = pb[0];
        const seg = `M${f1(xb - hw - fl)} ${f1(yb)}Q${f1((xb + xt) / 2 - hw + fl)} ${f1(mid)} ${f1(xt - hw - fl)} ${f1(yt)}`
          + `Q${f1(xt)} ${f1(yt + fl * 2)} ${f1(xt + hw + fl)} ${f1(yt)}Q${f1((xb + xt) / 2 + hw - fl)} ${f1(mid)} ${f1(xb + hw + fl)} ${f1(yb)}Q${f1(xb)} ${f1(yb - fl * 2)} ${f1(xb - hw - fl)} ${f1(yb)}Z`;
        const t = Ly.ink + (mulberry32(seedOf(c.i, n))() - 0.5) * 0.06;
        const gid = `cg${Ly.L.seed}_${c.i}_${n}`;
        defs.push(`<linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="0" y1="${f1(yb)}" x2="0" y2="${f1(yt)}"><stop offset="0" stop-color="${tone(t - 0.08, culmTint)}"/><stop offset=".45" stop-color="${tone(t + 0.07, culmTint)}"/><stop offset="1" stop-color="${tone(t - 0.04, culmTint)}"/></linearGradient>`);
        fills += `<path d="${seg}" fill="url(#${gid})"/>`;
        // 墨は筆の縁にたまる
        parts += `<path d="${seg}" fill="none" stroke="${tone(t - 0.14, culmTint)}" stroke-width="${f1(Math.max(0.6, cw * 0.1))}" opacity=".32"/>`;
        // 節。白く残した間に、少し反った短い一筆
        if (n > 0) {
          const q = to(c.xAt(za), za), nw = cw * 0.62;
          parts += `<path d="M${f1(q[0] - nw)} ${f1(q[1] + gap * 0.1)}Q${f1(q[0])} ${f1(q[1] - gap * 0.9)} ${f1(q[0] + nw)} ${f1(q[1] + gap * 0.1)}" fill="none" stroke="${tone(t - 0.2, culmTint)}" stroke-width="${f1(Math.max(0.7, cw * 0.13))}" stroke-linecap="round"/>`;
        }
      }
    }
    // 渇筆のかすれは層ごとに一度だけ掛ける
    if (fills) parts = `<g mask="url(#dry)">${fills}</g>` + parts;
    // 枝と小枝は細く速い線。葉は房の中で手前の葉ほど濃く、奥の葉は淡い
    const twig = Math.max(0.5, Ly.L.twig * S * k * 0.7);
    const branchInk = (list) => {
      const d = list.map(b => 'M' + b.map(([x, z]) => to(x, z)).map(q => `${f1(q[0])} ${f1(q[1])}`).join('L')).join('');
      return d ? `<path d="${d}" fill="none" stroke="${tone(Ly.ink - 0.06, culmTint)}" stroke-width="${f1(twig)}" stroke-linecap="round" opacity=".85"/>` : '';
    };
    const leafInk = (list) => list.map(t => t.leaves.map((lf, j) => {
      const v = Ly.leafInk + (j % 2 ? 0.1 : -0.04) + (t.tone - 0.5) * 0.08;
      return `<path d="${inkLeaf(t.x, t.z, lf.a, lf.len, lf.wid, to, (j % 2 ? 1 : -1) * (0.5 + t.tone))}" fill="${tone(v, leafTint)}"/>`;
    }).join('')).join('');
    const near = (t) => { const p = to(t.x, t.z); return p[0] > -150 && p[0] < w + 150 && p[1] > -150 && p[1] < H + 150; };
    if (Ly.sway) {
      // 手前の二層は、枝ごとに小枝と葉をまとめて小さな絵にし、枝の根元を軸にそよがせる
      const groups = new Map();
      const of = (bid) => groups.get(bid) ?? groups.set(bid, { br: [], tf: [] }).get(bid);
      for (const b of g.branches) of(b.bid).br.push(b);
      for (const t of g.tufts) if (near(t)) of(t.bid).tf.push(t);
      const reach = (Ly.L.leaf[0] + Ly.L.leaf[1]) * S * k + 14;
      for (const grp of groups.values()) {
        if (!grp.tf.length) continue;
        const pts = [...grp.br.flat().map(([x, z]) => to(x, z)), ...grp.tf.map(t => to(t.x, t.z))];
        const bx = Math.max(-8, Math.floor(Math.min(...pts.map(q => q[0])) - reach)), by = Math.floor(Math.min(...pts.map(q => q[1])) - reach);
        const bx1 = Math.min(w + 8, Math.ceil(Math.max(...pts.map(q => q[0])) + reach)), by1 = Math.ceil(Math.max(...pts.map(q => q[1])) + reach);
        if (bx1 - bx < 12 || by1 - by < 12 || by1 < 0 || by > H) continue;
        const main = grp.br.find(b => b.length > 2) ?? grp.br[0];
        sprites.push({ box: [bx, by, bx1 - bx, by1 - by], pivot: to(...main[0]), filt: Ly.filt, ink: branchInk(grp.br) + leafInk(grp.tf) });
      }
    } else {
      parts += branchInk(g.branches) + leafInk(g.tufts.filter(near));
    }
    if (parts) body.push(`<g style="mix-blend-mode:multiply" filter="url(#${Ly.filt})">${parts}</g>`);
  }

  // 霧。下ほど紙の白に溶ける
  const mistCol = mix3(P.low, PAPER, 0.6 * P.day);
  defs.push(`<linearGradient id="mistG" x1="0" y1="${f1(horizon - 140)}" x2="0" y2="${H}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${hex(mistCol)}" stop-opacity="0"/><stop offset=".55" stop-color="${hex(mistCol)}" stop-opacity=".55"/><stop offset="1" stop-color="${hex(mistCol)}" stop-opacity=".9"/></linearGradient>`);
  body.push(`<rect width="${w}" height="${H}" fill="url(#mistG)" filter="url(#mist)"/>`);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${H}" viewBox="0 0 ${w} ${H}"><defs>${defs.join('')}</defs>${body.join('')}</svg>`;
  const px = new Resvg(svg, NO_FONTS).render().pixels;
  const data = Buffer.alloc(w * H * 4);
  for (let i = 0; i < w * H; i++) {
    data[i * 4] = px[i * 4]; data[i * 4 + 1] = px[i * 4 + 1]; data[i * 4 + 2] = px[i * 4 + 2]; data[i * 4 + 3] = 255;
  }
  const jpg = jpeg.encode({ data, width: w, height: H }, 88).data.toString('base64');

  // そよぐ枝の小さな絵。あけた所の外には描かず、下の方は地の絵と同じだけ霧に溶かす。
  // 地の絵に乗算で重ねるので、墨が重なった所は濃くなる。根元を軸に、風の強さに応じて小さく揺れる
  const ampB = clamp(0.5 + L.wind * 0.06, 0.5, 2.4);
  const sw = mulberry32(77);
  const kfs = [];
  for (let n = 0; n < 6; n++) {
    let s = `@keyframes b${n}{`;
    const m = 4 + Math.floor(sw() * 3);
    for (let i = 0; i <= m; i++) s += `${Math.round(i / m * 100)}%{transform:rotate(${(i === 0 || i === m ? 0 : (sw() * 2 - 0.6) * ampB).toFixed(2)}deg)}`;
    kfs.push(s + '}');
  }
  const mistMask = `<linearGradient id="mg" x1="0" y1="${f1(horizon - 140)}" x2="0" y2="${H}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff"/><stop offset=".55" stop-color="#737373"/><stop offset="1" stop-color="#1a1a1a"/></linearGradient>`
    + `<mask id="mm" maskUnits="userSpaceOnUse" x="-40" y="-40" width="${w + 80}" height="${H + 80}"><rect x="-40" y="-40" width="${w + 80}" height="${H + 80}" fill="url(#mg)"/></mask>`;
  const spriteSvg = sprites.map((sp, i) => {
    const [bx, by, bw, bh] = sp.box;
    // にじみのフィルタは、この小さな絵の範囲ちょうどで取る（範囲が絵からはみ出すと変位の計算が合わない）
    const wetHere = wetDef.replace(region, `filterUnits="userSpaceOnUse" x="${bx}" y="${by}" width="${bw}" height="${bh}"`);
    // 墨の縁はもともとにじんでいるので、六割の細かさで描いて引き伸ばしても目立たない。そのぶん軽くなる
    const one = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(bw * 0.6)}" height="${Math.ceil(bh * 0.6)}" viewBox="${bx} ${by} ${bw} ${bh}"><defs>${wetHere}${mistMask}<clipPath id="op"><rect width="${w}" height="${H}"/></clipPath></defs>`
      + `<g clip-path="url(#op)"><g mask="url(#mm)"><g style="mix-blend-mode:multiply" filter="url(#wet)">${sp.ink}</g></g></g></svg>`;
    const png = new Resvg(one, NO_FONTS).render().asPng().toString('base64');
    const r = mulberry32(seedOf(8, i, Math.round(sp.pivot[0])));
    return `<image href="data:image/png;base64,${png}" x="${bx + x0}" y="${by}" width="${bw}" height="${bh}" class="sw" style="transform-origin:${f1(sp.pivot[0] + x0)}px ${f1(sp.pivot[1])}px;animation:b${i % 6} ${(3.4 + r() * 2.8).toFixed(2)}s ease-in-out ${(-r() * 6).toFixed(2)}s infinite;mix-blend-mode:multiply"/>`;
  }).join('');

  // 降る物。雨は細い墨の筋が斜めに、雪は紙の白の粒がゆっくり。二枚を縦に重ねて途切れずに回す
  const over = [];
  const pr = mulberry32(seedOf(13, Math.floor(date.getTime() / 3600000)));
  if (L.wet || L.snow) {
    const slant = clamp(L.wind / 40, 0.1, 0.6);
    let marks = '';
    const n = L.snow ? 70 : 90;
    for (let i = 0; i < n; i++) {
      const x = x0 - 60 + pr() * (w + 120), y = pr() * H;
      if (L.snow) marks += `<circle cx="${f1(x)}" cy="${f1(y)}" r="${f1(1.4 + pr() * 2.2)}"/>`;
      else { const len = 30 + pr() * 40; marks += `<path d="M${f1(x)} ${f1(y)}l${f1(-len * slant)} ${f1(len)}"/>`; }
    }
    kfs.push(`@keyframes fallP{from{transform:translate(0,${-H}px)}to{transform:translate(${L.snow ? f1(-H * slant * 0.3) : 0}px,0)}}`);
    const style = L.snow ? `fill="${hex(PAPER)}" opacity=".9"` : `stroke="${hex(mix3(P.top, [0.2, 0.2, 0.22], 0.45))}" stroke-width="1" opacity=".5"`;
    over.push(`<g class="sw" style="animation:fallP ${L.snow ? 9 : 0.7}s linear infinite" ${style}><g>${marks}</g><g transform="translate(0 ${H})">${marks}</g></g>`);
  }
  // 時々落ちてくる葉。墨の一筆が、くるくる回りながら霧の中へ消える
  const k = CAM_D / (CAM_D + 2000);
  [23, 41].forEach((period, i) => {
    const dur = 3 + pr() * 1.4, delay = 2 + i * 7 + pr() * 5;
    const len = (110 + pr() * 40) * S * k, wid = len * 0.17;
    const xs = x0 + w * (0.15 + pr() * 0.7), drift = (pr() - 0.4) * 160;
    const spin = (pr() < 0.5 ? -1 : 1) * (360 + pr() * 360), a0 = pr() * 180, p = dur / period * 100, n = 9;
    let kf = `@keyframes g${i}{`;
    for (let j = 0; j <= n; j++) {
      const t = j / n;
      kf += `${(p * t).toFixed(2)}%{transform:translate(${f1(xs + drift * t + Math.sin(t * Math.PI * 2.4 + i) * 26)}px,${f1(-60 + (H * 0.95) * t)}px) rotate(${(a0 + spin * t).toFixed(1)}deg);opacity:${j === 0 || j === n ? 0 : j > n * 0.7 ? 0.5 : 0.9}}`;
    }
    kfs.push(kf + `100%{transform:translate(${f1(xs + drift)}px,${H}px);opacity:0}}`);
    over.push(`<path class="sw" style="animation:g${i} ${period}s linear ${delay.toFixed(1)}s infinite;opacity:0;mix-blend-mode:multiply" d="${inkLeaf(0, -len / 2, Math.PI / 2, len, wid, (x, z) => [x, -z], 0.6)}" fill="${tone(0.32, leafTint)}"/>`);
  });

  return { jpg, w, defs: '', kfs, overlay: over.join(''), sprites: spriteSvg };
}

// 墨竹の葉の一筆。筆先を置いてすぐ押し、腹で幅を出してから細く抜く。bendは葉の反り
function inkLeaf(x, z, a, len, wid, to, bend) {
  const c = Math.cos(a), s = Math.sin(a);
  const pt = (u, v) => { const q = to(x + u * c - v * s, z + u * s + v * c); return [q[0], q[1]]; };
  const n = 10, left = [], right = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = t * len;
    const hw = wid * 0.5 * (t < 0.22 ? 0.25 + 0.75 * Math.sqrt(t / 0.22) : (1 - (t - 0.22) / 0.78) ** 0.85);
    const vc = bend * wid * 0.9 * Math.sin(Math.PI * t) * (1 - t * 0.3);
    left.push(pt(u, vc + hw)); right.push(pt(u, vc - hw));
  }
  const pts = [...left, ...right.reverse()];
  return 'M' + pts.map(q => `${f1(q[0])} ${f1(q[1])}`).join('L') + 'Z';
}
