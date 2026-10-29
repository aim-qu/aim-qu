// いまの空。東経135°・北緯35°で見上げた、その時刻の本当の星空を横長の一枚にする。
// 目盛りは入れず、天の川・月・明るい星と惑星がいちばんよく入る方角へ広角で向ける。
// 空の地と暗い星はJPEGに焼き込み、明るい星・惑星・月・流れ星をSVGで重ねて、星だけを瞬かせる。
// 星と星座の名前は二組に分け、交互にゆっくり浮かべては消す。名前の出ていない間は字の無い空に戻る

import { readFileSync } from 'node:fs';
import jpeg from 'jpeg-js';
import { bodies, precessor, horizontal, refraction, airmass, moonParallax, equatorialVecToGalactic, rev } from './astro.mjs';
import { STAR_JA, CLUSTER_JA, CON_JA, PLANET_JA, direction16 } from './names.mjs';

const STARS = JSON.parse(readFileSync(new URL('../../data/stars.json', import.meta.url), 'utf8'));

export const W = 1600, H = 660;
const RAD = Math.PI / 180, DEG = 180 / Math.PI;
// 横の画角は120°。平射図法なので、中心からの角度の半分の正接に比例して離れる
const K = (W / 2) / (2 * Math.tan(30 * RAD));

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const fract = (x) => x - Math.floor(x);
const f1 = (x) => (Math.round(x * 10) / 10).toString();
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const FONT_JA = "'Hiragino Kaku Gothic ProN','Hiragino Sans','Yu Gothic','Meiryo','Noto Sans CJK JP','Noto Sans JP',sans-serif";

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 三次元の値ノイズ
function h31(x, y, z) {
  x = fract(x * 0.1031); y = fract(y * 0.1031); z = fract(z * 0.1031);
  const d = x * (z + 31.32) + y * (y + 31.32) + z * (x + 31.32);
  x += d; y += d; z += d;
  return fract((x + y) * z);
}
function vn3(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), uz = fz * fz * (3 - 2 * fz);
  const a = mix(mix(h31(ix, iy, iz), h31(ix + 1, iy, iz), ux), mix(h31(ix, iy + 1, iz), h31(ix + 1, iy + 1, iz), ux), uy);
  const b = mix(mix(h31(ix, iy, iz + 1), h31(ix + 1, iy, iz + 1), ux), mix(h31(ix, iy + 1, iz + 1), h31(ix + 1, iy + 1, iz + 1), ux), uy);
  return mix(a, b, uz);
}
function fbm3(x, y, z, oct = 5) {
  let s = 0, a = 0.5;
  for (let i = 0; i < oct; i++) { s += a * vn3(x, y, z); x = x * 2.02 + 7.3; y = y * 2.02 + 7.3; z = z * 2.02 + 7.3; a *= 0.5; }
  return s;
}

// 銀経ごとの天の川の濃さ。中心のいて座側と、はくちょう座の濃い所を明るくする
function lonWeight(l) {
  const dl = l > 180 ? l - 360 : l;
  return 0.38 + 0.62 * Math.exp(-((dl / 52) ** 2)) + 0.3 * Math.exp(-(((l - 76) / 13) ** 2));
}

// 実際の天の川で目立つ所。銀経・銀緯（度）、銀経方向と銀緯方向の広がり、強さ
const STAR_CLOUDS = [
  [0, -2, 11, 6, 1.0], // 中心のふくらみ
  [1.5, -3.8, 5, 3.5, 0.9], // いて座の大きな星雲
  [12, -0.8, 2, 1.2, 0.55], // いて座の小さな星雲（M24）
  [27, -2.8, 3, 2, 0.7], // たて座の星雲
  [40, -2, 6, 3, 0.3], // わし座
  [77, 1.5, 9, 4, 0.75], // はくちょう座の星雲
  [118, 0, 16, 4, 0.22], // カシオペヤ座
];
// はくちょう座からわし座を通っていて座の手前まで帯を割る暗い裂け目。銀経ごとの中心の銀緯と半幅
const RIFT = [[-4, 6, 2.6], [10, 4.5, 2.6], [20, 3.5, 2.8], [30, 2.8, 2.6], [40, 2, 2.4], [50, 1.2, 2.4], [60, 1, 2.2], [70, 1.6, 2.4], [80, 1.5, 2.6], [90, 0.5, 2.2]];
function riftAt(dl, b) {
  if (dl < -10 || dl > 98) return 0;
  let i = 0;
  while (i < RIFT.length - 2 && dl > RIFT[i + 1][0]) i++;
  const [l0, b0, w0] = RIFT[i], [l1, b1, w1] = RIFT[i + 1];
  const t = clamp((dl - l0) / (l1 - l0));
  const bc = mix(b0, b1, t), w = mix(w0, w1, t);
  return smooth(-10, -2, dl) * smooth(98, 88, dl) * Math.exp(-(((b - bc) / w) ** 2));
}
// ほかの暗黒星雲。パイプ星雲、へびつかい座ρの雲
const DARK_CLOUDS = [[358, 5, 4, 2, 0.55], [3, 7, 3, 1.5, 0.45], [353, 16, 4, 3, 0.35]];
// 写真で赤く写る散光星雲。北アメリカ星雲、IC1396、干潟星雲、M16とM17、γ星のまわり、バラ星雲、オリオン大星雲
const RED_NEBULAE = [
  [85.6, -0.8, 1.1, 0.8, 0.5], [99.3, 3.7, 1.3, 1.3, 0.25], [6, -1.2, 0.5, 0.4, 0.6], [15.1, -0.7, 0.35, 0.3, 0.4],
  [17, 0.8, 0.35, 0.3, 0.3], [78.2, 2, 1.6, 1.2, 0.22], [206.3, -2.1, 0.6, 0.6, 0.3], [209, -19.4, 0.45, 0.45, 0.55],
];
const blob = (list, l, b, pick) => {
  let s = 0;
  for (const [l0, b0, sl, sb, a] of list) {
    const d = ((l - l0 + 540) % 360) - 180;
    const v = a * Math.exp(-((d / sl) ** 2) - (((b - b0) / sb) ** 2));
    s = pick ? Math.max(s, v) : s + v;
  }
  return s;
};

// 天の川の明るさ。銀河座標の向き（xが銀河中心、zが銀河北極）から。
// 帯と実際の星雲・暗黒星雲を置き、ノイズで縁とむらを崩す。戻り値は［輝度, 暖色の割合, 赤い星雲］
function milkyWay(g) {
  const sb = g[2];
  if (Math.abs(sb) > 0.6) return null;
  const l = rev(Math.atan2(g[1], g[0]) * DEG), b = Math.asin(sb) * DEG;
  const dl = l > 180 ? l - 360 : l;
  const n1 = fbm3(g[0] * 3.1, g[1] * 3.1, g[2] * 3.1);
  const n2 = fbm3(g[0] * 9.5 + 5, g[1] * 9.5 + 5, g[2] * 9.5 + 5);
  // 帯の厚みは中心に近いほど厚い
  const wb = 4.5 + 4 * Math.exp(-((dl / 40) ** 2)) + 3 * (n1 - 0.5);
  const band = Math.exp(-((b / wb) ** 2));
  const haze = Math.exp(-((b / 20) ** 2)) * (0.6 + 0.6 * n1);
  const lonK = lonWeight(l);
  const red = blob(RED_NEBULAE, l, b) * (0.5 + n2);
  if (band < 0.004 && Math.abs(b) > 12 && red < 0.002) return [0.012 * haze * lonK, 0, 0];
  const n3 = fbm3(g[0] * 26 + 2, g[1] * 26 + 2, g[2] * 26 + 2, 3);
  const grain = 0.6 * vn3(g[0] * 150, g[1] * 150, g[2] * 150) + 0.4 * vn3(g[0] * 310 + 9, g[1] * 310 + 9, g[2] * 310 + 9);
  // 星の雲のかたまり。中くらいのむらを強めに効かせて、帯がのっぺりしないようにする
  const clump = 0.45 + 1.1 * smooth(0.3, 0.74, n2);
  const clouds = blob(STAR_CLOUDS, l, b);
  let k = 0.13 * band * lonK * (0.4 + 0.9 * smooth(0.3, 0.72, n1)) * clump + 0.17 * clouds * clump;
  k *= (0.72 + 0.56 * n3) * (0.82 + 0.36 * grain);
  // 暗黒星雲。縁はノイズで崩し、中は帯の光をほとんど隠す。その上に細い筋をところどころに通す
  const nd = fbm3(g[0] * 16 + 4, g[1] * 16 + 4, g[2] * 16 + 4, 4);
  const darkSrc = Math.max(riftAt(dl, b + 2.2 * (n2 - 0.5)) * (0.55 + 0.45 * smooth(0.3, 0.6, n1)), blob(DARK_CLOUDS, l, b, true));
  const dark = smooth(0.1, 0.7, darkSrc * (0.3 + 1.4 * nd)) * 0.84;
  const ridge = 1 - Math.abs(2 * fbm3(g[0] * 12 + 7, g[1] * 12 + 7, g[2] * 12 + 7, 4) - 1);
  const lanes = smooth(0.82, 0.96, ridge) * band * (0.4 + 0.6 * smooth(0.4, 0.6, n1));
  const patches = smooth(0.52, 0.74, fbm3(g[0] * 7 + 11, g[1] * 7 + 11, g[2] * 7 + 11, 4)) * band;
  k *= (1 - dark) * (1 - lanes * 0.55) * (1 - patches * 0.3);
  const warm = clamp(1.2 * Math.exp(-((dl / 16) ** 2) - (((b + 2) / 9) ** 2)));
  return [k + 0.012 * haze * lonK, warm, red * (1 - dark * 0.8)];
}

// B−Vから星の色。Ballesterosの式で温度にし、黒体の色を白へ寄せて彩度を控える
function starRGB(bv) {
  if (bv == null) bv = 0.6;
  const T = 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62));
  const t = T / 100;
  let r, g, b;
  if (t <= 66) { r = 255; g = 99.47 * Math.log(t) - 161.12; b = t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04; }
  else { r = 329.7 * (t - 60) ** -0.1332; g = 288.12 * (t - 60) ** -0.0755; b = 255; }
  return [r, g, b].map(v => mix(clamp(v / 255), 1, 0.5));
}
const hex = (c) => '#' + c.map(v => Math.round(clamp(v) * 255).toString(16).padStart(2, '0')).join('');

// 地平座標の向き。方位は北から東回り、zが天頂
const hvec = (az, alt) => [Math.cos(alt * RAD) * Math.cos(az * RAD), Math.cos(alt * RAD) * Math.sin(az * RAD), Math.sin(alt * RAD)];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// 方位az・高度altへ向けたカメラ。天頂の側を画面の上にする
function camera(az, alt) {
  const f = hvec(az, alt);
  const u = norm([-f[2] * f[0], -f[2] * f[1], 1 - f[2] * f[2]]);
  const r = norm(cross(u, f));
  return {
    az, alt,
    project(d) {
      const Z = dot(d, f);
      if (Z < -0.2) return null;
      const s = (2 * K) / (1 + Z);
      return [W / 2 + dot(d, r) * s, H / 2 - dot(d, u) * s];
    },
    unproject(x, y) {
      const a = (x - W / 2) / (2 * K), b = (H / 2 - y) / (2 * K);
      const q = 1 + a * a + b * b;
      const X = (2 * a) / q, Y = (2 * b) / q, Z = (2 - q) / q;
      return [X * r[0] + Y * u[0] + Z * f[0], X * r[1] + Y * u[1] + Z * f[1], X * r[2] + Y * u[2] + Z * f[2]];
    },
  };
}

// 地平座標の向きを、その時刻の赤道座標の向きに直す。Schlyterの地平座標を経由して方位の取り方の違いを吸収する
function horizonToEquatorial(lst, lat) {
  const sp = Math.sin(lat * RAD), cp = Math.cos(lat * RAD), st = Math.sin(lst * RAD), ct = Math.cos(lst * RAD);
  return (v) => {
    const xhor = -v[0], yhor = -v[1], zhor = v[2];
    const x = xhor * sp + zhor * cp, y = yhor, z = -xhor * cp + zhor * sp;
    return [ct * x + st * y, st * x - ct * y, z];
  };
}

function encodeJpeg(rgb, w, h, quality) {
  const data = Buffer.alloc(w * h * 4);
  for (let i = 0, j = 0; i < rgb.length; i += 3, j += 4) {
    data[j] = rgb[i]; data[j + 1] = rgb[i + 1]; data[j + 2] = rgb[i + 2]; data[j + 3] = 255;
  }
  return jpeg.encode({ data, width: w, height: h }, quality).data;
}

// whenは名前入りの方に添える言葉（「いま」「今夜21時」）
export function renderSky({ date, lat, lon, when = 'いま' }) {
  const B = bodies(date);
  const lst = rev(B.gmst + lon);
  const toEq = horizonToEquatorial(lst, lat);
  const place = (ra, dec) => horizontal(ra, dec, lst, lat);

  const sun = place(B.sun.ra, B.sun.dec);
  const moonH = place(B.moon.ra, B.moon.dec);
  moonH.alt = moonParallax(moonH.alt, B.moon.rEarth);
  moonH.alt += refraction(moonH.alt);
  const sunV = hvec(sun.az, sun.alt), moonV = hvec(moonH.az, moonH.alt);
  const moonAge = rev(B.moon.lon - B.sun.lon) / 360 * 29.530588853;
  const twilight = smooth(-18, -4, sun.alt);
  const dusk = smooth(-16, -2, sun.alt);
  const moonUp = moonH.alt > -0.5;
  const moonLight = moonUp ? B.moon.illum ** 1.5 * clamp(Math.sin(Math.max(0, moonH.alt) * RAD) * 1.6 + 0.15) : 0;
  // 写る星の限界等級。写真に近い暗さまで入れ、薄明と月明かりで浅くする
  const limMag = 6.9 - twilight * 3.8 - moonLight * 2;

  // 恒星。カタログは明るい順に並んでいる
  const prec = precessor(date);
  const stars = [];
  for (const s of STARS) {
    if (s[2] > limMag) break;
    const { ra, dec } = prec(s[0], s[1]);
    const h = place(ra, dec);
    const alt = h.alt + refraction(h.alt);
    if (alt < 0.5) continue;
    const mag = s[2] + 0.28 * (airmass(alt) - 1);
    if (mag > limMag) continue;
    stars.push({ v: hvec(h.az, alt), alt, mag, bv: s[3], name: s[4], con: s[5] });
  }
  const planets = [];
  for (const key of ['mercury', 'venus', 'mars', 'jupiter', 'saturn']) {
    const p = B[key];
    const h = place(p.ra, p.dec);
    const alt = h.alt + refraction(h.alt);
    const mag = p.mag + 0.28 * (airmass(alt) - 1);
    if (alt > 1 && mag < limMag) planets.push({ key, name: PLANET_JA[key], v: hvec(h.az, alt), alt, mag });
  }

  // 向きを決める。天の川の濃い所、月、明るい星と惑星がよく入る向きを選び、地平線が入る向きは避ける。
  // 薄明のうちは、太陽の沈んだ側（明け方は昇る側）の空の色も見どころに数える
  const mwVis = (1 - twilight) ** 2 * (1 - 0.85 * moonLight);
  const faintVis = clamp((limMag - 6) / 0.9);
  const bright = stars.filter(s => s.mag < 1.8);
  let best = null;
  for (let alt = twilight > 0.2 ? 38 : 44; alt <= 68; alt += 6) {
    for (let az = 0; az < 360; az += 10) {
      const cam = camera(az, alt);
      let score = 0;
      for (let i = 0; i < 24; i++) {
        for (let j = 0; j < 10; j++) {
          const d = cam.unproject((i + 0.5) / 24 * W, (j + 0.5) / 10 * H);
          if (d[2] < 0.035) { score -= 3; continue; }
          if (dusk > 0) {
            const daz = Math.abs(((Math.atan2(d[1], d[0]) * DEG - sun.az + 540) % 360) - 180);
            score += 2.5 * dusk * Math.exp(-((daz / 50) ** 2)) * Math.exp(-Math.asin(d[2]) * DEG / 9);
          }
          const g = equatorialVecToGalactic(toEq(d));
          const l = rev(Math.atan2(g[1], g[0]) * DEG), ext = 10 ** (-0.4 * 0.28 * (airmass(Math.asin(d[2]) * DEG) - 1));
          score += (Math.exp(-((g[2] / 0.17) ** 2)) * lonWeight(l) + 2 * blob(STAR_CLOUDS, l, Math.asin(g[2]) * DEG)) * mwVis * ext * 1.2;
        }
      }
      const seen = (v) => { const p = cam.project(v); return p && p[0] > 50 && p[0] < W - 50 && p[1] > 40 && p[1] < H - 40; };
      for (const s of bright) if (seen(s.v)) score += (2 - s.mag) * 2.2;
      for (const p of planets) if (seen(p.v)) score += 4 + Math.max(0, -p.mag) * 1.5;
      // 月は端に寄るより、内側に入る向きを選ぶ
      if (moonUp && moonH.alt > 4) {
        const q = cam.project(moonV);
        if (q && q[0] > W * 0.14 && q[0] < W * 0.86 && q[1] > H * 0.16 && q[1] < H * 0.84) score += 9 + B.moon.illum * 6;
        else if (seen(moonV)) score += 3;
      }
      const daz = Math.abs(((az - sun.az + 540) % 360) - 180);
      score += 30 * dusk * Math.exp(-((daz / 45) ** 2));
      if (!best || score > best.score) best = { score, az, alt };
    }
  }
  const cam = camera(best.az, best.alt);
  const dir = direction16(best.az);

  // 空の地を画素ごとに作る
  const fr = new Float32Array(W * H), fg = new Float32Array(W * H), fb = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const v = cam.unproject(x + 0.5, y + 0.5);
      const alt = Math.max(0, Math.asin(clamp(v[2], -1, 1)) * DEG);
      const az = rev(Math.atan2(v[1], v[0]) * DEG);
      const up = 1 - alt / 90;
      // 夜空の地。天頂が最も暗く、地平に向かって大気光でわずかに明るむ
      const hz = up ** 4;
      let c0 = mix(0.018, 0.048, hz), c1 = mix(0.025, 0.06, hz), c2 = mix(0.052, 0.1, hz);
      const air = Math.exp(-(((alt - 8) / 7) ** 2));
      c0 += 0.006 * air; c1 += 0.012 * air; c2 += 0.01 * air;
      // 南から南東の地平。明石・神戸・大阪の街明かりがかすかに空を照らす
      const daz = Math.abs(((az - 145 + 540) % 360) - 180);
      const dome = Math.exp(-((daz / 42) ** 2)) * Math.exp(-alt / 7);
      c0 += 0.034 * dome; c1 += 0.025 * dome; c2 += 0.018 * dome;
      // 薄明。天頂は深い青、太陽の側の地平は橙から黄、反対側の地平に地球の影と、その上に薄紅の帯
      if (twilight > 0) {
        const sAz = Math.abs(((az - sun.az + 540) % 360) - 180);
        const side = Math.exp(-((sAz / 60) ** 2));
        const t = up ** 2.2;
        c0 = mix(c0, mix(0.07, 0.3, t), twilight); c1 = mix(c1, mix(0.12, 0.4, t), twilight); c2 = mix(c2, mix(0.26, 0.52, t), twilight);
        const glow = side * Math.exp(-alt / 7) * dusk * 0.85;
        c0 = mix(c0, 0.95, glow); c1 = mix(c1, 0.58, glow); c2 = mix(c2, 0.3, glow);
        const glow2 = side * Math.exp(-alt / 20) * dusk * 0.25;
        c0 = mix(c0, 0.7, glow2); c1 = mix(c1, 0.62, glow2); c2 = mix(c2, 0.62, glow2);
        const anti = Math.exp(-(((180 - sAz) / 70) ** 2)) * smooth(-9, -1, sun.alt);
        const belt = anti * Math.exp(-(((alt - 10) / 5.5) ** 2)) * 0.45;
        c0 = mix(c0, 0.62, belt); c1 = mix(c1, 0.46, belt); c2 = mix(c2, 0.55, belt);
        const shadow = anti * Math.exp(-((alt / 4.5) ** 2)) * 0.6;
        c0 = mix(c0, 0.16, shadow); c1 = mix(c1, 0.19, shadow); c2 = mix(c2, 0.32, shadow);
      }
      // 月明かり。空がわずかに青く明るみ、月のまわりに光の暈
      if (moonUp) {
        c0 += 0.028 * moonLight; c1 += 0.042 * moonLight; c2 += 0.08 * moonLight;
        const ang = Math.acos(clamp(dot(v, moonV), -1, 1)) * DEG;
        const mh = B.moon.illum * (Math.exp(-ang / 6) * 0.24 + Math.exp(-ang / 22) * 0.055);
        c0 += mh * 0.9; c1 += mh * 0.92; c2 += mh;
      }
      // 天の川。薄明・月明かり・地平の大気で淡くなる。明るい所は白く飛ばないよう丸める
      const ext = 10 ** (-0.4 * 0.28 * (airmass(alt) - 1));
      const mwK = 2.6 * mwVis * ext;
      if (mwK > 0.01) {
        const m = milkyWay(equatorialVecToGalactic(toEq(v)));
        if (m) {
          const lum = m[0] * mwK, tone = 0.36 * (1 - Math.exp(-lum / 0.36)), red = m[2] * mwK;
          c0 += tone * mix(0.98, 1.16, m[1]) + red * 0.09;
          c1 += tone * mix(0.96, 1.0, m[1]) + red * 0.02;
          c2 += tone * mix(1.06, 0.8, m[1]) + red * 0.04;
          // 帯の中の、一つずつは見分けられない暗い星
          if (h31(x * 0.7311 + 0.17, y * 1.3713 + 0.29, 3.7) < Math.min(0.12, lum * 0.35) * faintVis) {
            const s = 0.02 + 0.09 * h31(x * 1.917 + 0.5, y * 0.613 + 0.1, 8.3) ** 2;
            c0 += s; c1 += s * 0.98; c2 += s * 0.96;
          }
        }
      }
      const i = y * W + x;
      fr[i] = c0; fg[i] = c1; fb[i] = c2;
    }
  }

  // 暗い星は地の絵に焼き込む。光は小さなガウス形に広げ、明るさは光量の比を縮めて決める。
  // 月のそばの星は月明かりに埋もれて見えにくくする
  const lights = [];
  for (const s of stars) {
    const p = cam.project(s.v);
    if (!p || p[0] < -4 || p[0] > W + 4 || p[1] < -4 || p[1] > H + 4) continue;
    const near = moonUp ? B.moon.illum * (1 - smooth(1.5, 18, Math.acos(clamp(dot(s.v, moonV), -1, 1)) * DEG)) : 0;
    if (s.mag < 3.1) { lights.push({ ...s, x: p[0], y: p[1], near }); continue; }
    const flux = 0.85 * (10 ** (-0.4 * (s.mag - 3.1))) ** 0.6 * clamp((limMag - s.mag) / 0.8 + 0.3) * (1 - 0.85 * near);
    const sig = 0.7 + 0.13 * Math.max(0, 6.8 - s.mag);
    const col = starRGB(s.bv);
    const x0 = Math.floor(p[0] - 3), y0 = Math.floor(p[1] - 3);
    for (let yy = Math.max(0, y0); yy <= Math.min(H - 1, y0 + 6); yy++) {
      for (let xx = Math.max(0, x0); xx <= Math.min(W - 1, x0 + 6); xx++) {
        const dx = xx + 0.5 - p[0], dy = yy + 0.5 - p[1];
        const k = flux * Math.exp(-(dx * dx + dy * dy) / (2 * sig * sig));
        const j = yy * W + xx;
        fr[j] += k * col[0]; fg[j] += k * col[1]; fb[j] += k * col[2];
      }
    }
  }

  // 階調の縞を出さないよう、ごく細かい粒を混ぜてから8bitにする
  const rgb = new Uint8Array(W * H * 3);
  const grain = mulberry32(7331);
  for (let i = 0, p = 0; i < W * H; i++, p += 3) {
    const gr = (grain() - 0.5) * 0.007;
    rgb[p] = Math.round(clamp(fr[i] + gr) * 255);
    rgb[p + 1] = Math.round(clamp(fg[i] + gr) * 255);
    rgb[p + 2] = Math.round(clamp(fb[i] + gr) * 255);
  }
  const skyJpeg = encodeJpeg(rgb, W, H, 90).toString('base64');

  // 瞬きの型。低い星は強く、高い星は弱く。各型は不規則な段の並び
  const tw = mulberry32(2026);
  const kfs = [];
  for (let k = 0; k < 10; k++) {
    const strong = k >= 5;
    const n = 12 + Math.floor(tw() * 6);
    let s = `@keyframes t${k}{`;
    for (let i = 0; i <= n; i++) {
      const v = i === 0 || i === n ? 1 : (strong ? 0.45 + tw() * 0.55 : 0.76 + tw() * 0.24);
      s += `${Math.round((i / n) * 1000) / 10}%{opacity:${v.toFixed(2)}}`;
    }
    kfs.push(s + '}');
  }

  // 明るい星。暗い順に重ね、光のにじみごと瞬かせる
  const over = [];
  for (const s of lights.sort((a, b) => b.mag - a.mag)) {
    const col = hex(starRGB(s.bv));
    const r = 1.15 + 0.55 * (3.4 - s.mag);
    const op = 1 - 0.7 * s.near;
    const glow = clamp(0.24 + 0.2 * (2.2 - s.mag), 0.12, 0.7) * op;
    const k = (s.alt < 30 ? 5 : 0) + Math.floor(fract(s.x * 0.37 + s.y * 0.11) * 5);
    const dur = (1.6 + fract(s.x * 0.13 + s.y * 0.29) * 1.8).toFixed(2);
    const delay = (-fract(s.x * 0.71 + s.y * 0.53) * 3).toFixed(2);
    over.push(`<g class="tw" style="animation:t${k} ${dur}s linear ${delay}s infinite"><circle cx="${f1(s.x)}" cy="${f1(s.y)}" r="${f1(r * 5.5)}" fill="url(#halo)" opacity="${glow.toFixed(2)}"/><circle cx="${f1(s.x)}" cy="${f1(s.y)}" r="${f1(r)}" fill="${col}"${op < 0.99 ? ` opacity="${op.toFixed(2)}"` : ''}/></g>`);
  }

  // 惑星。瞬かない
  const shown = [];
  for (const p of planets) {
    const q = cam.project(p.v);
    if (!q || q[0] < -10 || q[0] > W + 10 || q[1] < -10 || q[1] > H + 10) continue;
    const col = { mercury: '#e6e0d4', venus: '#fffaf0', mars: '#f6b48c', jupiter: '#fbf0d6', saturn: '#f3e4bb' }[p.key];
    const r = clamp(1.7 + (1.2 - p.mag) * 0.55, 1.5, 3.6);
    over.push(`<circle cx="${f1(q[0])}" cy="${f1(q[1])}" r="${f1(r * 7)}" fill="url(#halo)" opacity=".42"/><circle cx="${f1(q[0])}" cy="${f1(q[1])}" r="${f1(r)}" fill="${col}"/>`);
    shown.push({ ...p, x: q[0], y: q[1], r });
  }

  // 月。見やすいよう実際より大きく描き、欠け方は太陽の方向から決める
  let moonAt = null;
  const mp = moonUp && moonH.alt > 0.3 ? cam.project(moonV) : null;
  if (mp && mp[0] > -30 && mp[0] < W + 30 && mp[1] > -30 && mp[1] < H + 30) {
    const t = norm(sunV.map((x, i) => x - moonV[i] * dot(sunV, moonV)));
    const sp = cam.project(norm(moonV.map((m, i) => m + t[i] * 0.02)));
    const ang = Math.atan2(sp[1] - mp[1], sp[0] - mp[0]) * DEG;
    const k = B.moon.illum, mr = 7.5, ex = mr * Math.abs(1 - 2 * k);
    const lit = `M0 ${-mr}A${mr} ${mr} 0 0 1 0 ${mr}A${f1(ex)} ${mr} 0 0 ${k >= 0.5 ? 1 : 0} 0 ${-mr}Z`;
    over.push(`<circle cx="${f1(mp[0])}" cy="${f1(mp[1])}" r="${f1(mr * 8)}" fill="url(#moonHalo)" opacity="${(0.25 + 0.75 * k).toFixed(2)}"/>`);
    over.push(`<g transform="translate(${f1(mp[0])} ${f1(mp[1])}) rotate(${f1(ang)})"><circle r="${mr}" fill="#2a3446" opacity=".72"/><path d="${lit}" fill="#fbf4e4"/></g>`);
    moonAt = { x: mp[0], y: mp[1], r: mr };
  }

  // 流れ星。散在流星を二つ、周期をずらして時々流す。尾は進む向きへ明るくなる
  const metStyle = [], metGrad = [], metLine = [];
  if (twilight < 0.6) {
    const mr = mulberry32(Math.floor(date.getTime() / 3600000));
    for (let i = 0; i < 2; i++) {
      const x0 = W * (0.12 + mr() * 0.76), y0 = H * (0.08 + mr() * 0.45);
      const a = Math.PI * (0.15 + mr() * 0.7);
      const len = 110 + mr() * 120;
      const x1 = x0 + Math.cos(a) * len, y1 = y0 + Math.sin(a) * len;
      const period = i ? 79 : 53, delay = 6 + mr() * 30;
      metStyle.push(`@keyframes m${i}{0%{opacity:0;stroke-dashoffset:${f1(len)}}0.5%{opacity:1}1.3%{opacity:.9}1.9%{opacity:0;stroke-dashoffset:${f1(-len)}}100%{opacity:0;stroke-dashoffset:${f1(-len)}}}`);
      metGrad.push(`<linearGradient id="mg${i}" gradientUnits="userSpaceOnUse" x1="${f1(x0)}" y1="${f1(y0)}" x2="${f1(x1)}" y2="${f1(y1)}"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".75" stop-color="#fff" stop-opacity=".5"/><stop offset="1" stop-color="#fffaf0"/></linearGradient>`);
      metLine.push(`<line class="met" style="animation:m${i} ${period}s linear ${delay.toFixed(1)}s infinite" x1="${f1(x0)}" y1="${f1(y0)}" x2="${f1(x1)}" y2="${f1(y1)}" stroke="url(#mg${i})" stroke-width="1.8" stroke-linecap="round" stroke-dasharray="${f1(len)} ${f1(len)}"/>`);
    }
  }

  const title = `${when}の${dir}の空`;
  const head = (label) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(label)}">
<defs>
<style>
${kfs.join('\n')}
.met{opacity:0}
${metStyle.join('\n')}
.na,.nb{opacity:0;animation:28s ease-in-out infinite both}
.na{animation-name:na}.nb{animation-name:nb}
@keyframes na{0%,8%{opacity:0}19%,40%{opacity:1}51%,100%{opacity:0}}
@keyframes nb{0%,51%{opacity:0}62%,84%{opacity:1}95%,100%{opacity:0}}
@media (prefers-reduced-motion:reduce){.tw,.met{animation:none!important}.met{display:none}.na,.nb{animation:none!important;opacity:1}}
text{font-family:${FONT_JA}}
</style>
<radialGradient id="halo"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".22" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
<radialGradient id="moonHalo"><stop offset="0" stop-color="#fff6e6" stop-opacity=".55"/><stop offset=".3" stop-color="#fff6e6" stop-opacity=".14"/><stop offset="1" stop-color="#fff6e6" stop-opacity="0"/></radialGradient>
${metGrad.join('\n')}
</defs>
<image href="data:image/jpeg;base64,${skyJpeg}" width="${W}" height="${H}"/>
${over.join('\n')}
${metLine.join('\n')}`;

  // 名前。月・惑星・一等星くらいまでの星とすばるで一組、星座をいくつかと見出しでもう一組にする。
  // 重ならない所にだけ置き、浮かべる時は左の名前から右へ少しずつ遅らせる
  const boxes = [];
  const textW = (t, size, ls = 0) => [...t].reduce((w, ch) => w + (ch.charCodeAt(0) > 255 ? size : size * 0.6) + ls * size, 0);
  const free = (b) => b[0] > 12 && b[2] < W - 12 && b[1] > 12 && b[3] < H - 12 && boxes.every(o => b[0] > o[2] || b[2] < o[0] || b[1] > o[3] || b[3] < o[1]);
  const objLabels = [], conLabels = [];
  const breathe = (cls, x) => `class="${cls}" style="animation-delay:${(clamp(x / W) * 1.2).toFixed(2)}s"`;
  const put = (x, y, gap, text, size, fill) => {
    const w = textW(text, size, 0.08);
    for (const [ox, oy, anchor] of [[gap, -gap * 0.6, 'start'], [-gap, -gap * 0.6, 'end'], [gap, gap * 0.6 + size * 0.8, 'start'], [-gap, gap * 0.6 + size * 0.8, 'end']]) {
      const x0 = anchor === 'start' ? x + ox : x + ox - w;
      const b = [x0 - 2, y + oy - size, x0 + w + 2, y + oy + 4];
      if (!free(b)) continue;
      boxes.push(b);
      objLabels.push(`<text ${breathe('na', x)} x="${f1(x + ox)}" y="${f1(y + oy)}" text-anchor="${anchor}" font-size="${size}" fill="${fill}" letter-spacing=".08em">${esc(text)}</text>`);
      return;
    }
  };
  const noteSize = 19, note = `${title}　東経${lon}°・北緯${lat}°`;
  boxes.push([W / 2 - textW(note, noteSize, 0.3) / 2 - 8, H - 46, W / 2 + textW(note, noteSize, 0.3) / 2 + 8, H]);
  for (const s of lights) boxes.push([s.x - 5, s.y - 5, s.x + 5, s.y + 5]);
  for (const p of shown) boxes.push([p.x - p.r - 3, p.y - p.r - 3, p.x + p.r + 3, p.y + p.r + 3]);
  if (moonAt) {
    boxes.push([moonAt.x - 12, moonAt.y - 12, moonAt.x + 12, moonAt.y + 12]);
    put(moonAt.x, moonAt.y, 18, '月', 24, '#fbf4e4');
  }
  for (const p of [...shown].sort((a, b) => a.mag - b.mag)) put(p.x, p.y, 14, p.name, 22, '#e8c99a');
  for (const s of [...lights].sort((a, b) => a.mag - b.mag)) {
    if (s.mag < 1.6 && STAR_JA[s.name]) put(s.x, s.y, 13, STAR_JA[s.name], 20, 'rgba(241,237,228,.82)');
  }
  // 星団は中の明るい星の位置に名前を置く。地平に近くて暗く写る時も付ける
  for (const s of stars) {
    if (!s.name || !CLUSTER_JA[s.name]) continue;
    const p = cam.project(s.v);
    if (p) put(p[0], p[1], 15, CLUSTER_JA[s.name], 20, 'rgba(241,237,228,.82)');
  }
  const groups = new Map();
  for (const s of stars) {
    if (s.mag > 4 || !s.con) continue;
    const p = cam.project(s.v);
    if (!p || p[0] < 80 || p[0] > W - 80 || p[1] < 50 || p[1] > H - 60) continue;
    if (!groups.has(s.con)) groups.set(s.con, []);
    groups.get(s.con).push(p);
  }
  const cons = [...groups.entries()].filter(([, v]) => v.length >= 4).sort((a, b) => b[1].length - a[1].length).slice(0, 6);
  for (const [con, ps] of cons) {
    const name = CON_JA[con];
    if (!name) continue;
    // 星座の重心から、明るい星や他の名前に掛からない所を近い順に探す
    const cx = ps.reduce((a, p) => a + p[0], 0) / ps.length, cy = ps.reduce((a, p) => a + p[1], 0) / ps.length;
    const w = textW(name, 19, 0.32);
    for (const [ox, oy] of [[0, 0], [0, 36], [0, -36], [70, 18], [-70, 18], [0, 72], [0, -72], [110, -30], [-110, -30]]) {
      const x = cx + ox, y = cy + oy;
      const b = [x - w / 2 - 4, y - 19, x + w / 2 + 4, y + 6];
      if (!free(b)) continue;
      boxes.push(b);
      conLabels.push(`<text ${breathe('nb', x)} x="${f1(x)}" y="${f1(y)}" text-anchor="middle" font-size="19" fill="rgba(232,201,154,.58)" letter-spacing=".32em">${esc(name)}</text>`);
      break;
    }
  }
  conLabels.push(`<text ${breathe('nb', W / 2)} x="${W / 2}" y="${H - 22}" text-anchor="middle" font-size="${noteSize}" fill="rgba(232,201,154,.78)" letter-spacing=".3em">${esc(note)}</text>`);

  return {
    svg: `${head(title)}\n${objLabels.join('\n')}\n${conLabels.join('\n')}\n</svg>\n`,
    info: {
      az: best.az, alt: best.alt, dir, title,
      sunAlt: sun.alt,
      moon: { az: moonH.az, alt: moonH.alt, illum: B.moon.illum, age: moonAge, inFrame: !!moonAt },
      planets: shown.map(p => p.name),
      stars: stars.length,
    },
  };
}
