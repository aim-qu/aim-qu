// 天体の位置。太陽・月・惑星はPaul Schlyterの「How to compute planetary positions」
// （https://stjarnhimlen.se/comp/ppcomp.html）の軌道要素と摂動項で求める。精度は惑星で1分角、月で1〜2分角ほど。
// 恒星はJ2000の座標を歳差（Meeus 21章）で今の分点へ移す。どれも最後は観測地の地平座標（方位は北から東回り）にする

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;
const sin = (d) => Math.sin(d * RAD);
const cos = (d) => Math.cos(d * RAD);
const atan2 = (y, x) => Math.atan2(y, x) * DEG;
const asin = (x) => Math.asin(Math.max(-1, Math.min(1, x))) * DEG;
export const rev = (x) => ((x % 360) + 360) % 360;

// Schlyterの日数。2000年1月0.0日UT（1999年12月31日0時UT）を0とする
export function dayNumber(date) {
  return (date.getTime() - Date.UTC(1999, 11, 31)) / 86400000;
}
export const julianDay = (d) => 2451543.5 + d;

const obliquity = (d) => 23.4393 - 3.563e-7 * d;

const ELEMENTS = {
  sun: (d) => ({ N: 0, i: 0, w: 282.9404 + 4.70935e-5 * d, a: 1, e: 0.016709 - 1.151e-9 * d, M: 356.0470 + 0.9856002585 * d }),
  moon: (d) => ({ N: 125.1228 - 0.0529538083 * d, i: 5.1454, w: 318.0634 + 0.1643573223 * d, a: 60.2666, e: 0.0549, M: 115.3654 + 13.0649929509 * d }),
  mercury: (d) => ({ N: 48.3313 + 3.24587e-5 * d, i: 7.0047 + 5.0e-8 * d, w: 29.1241 + 1.01444e-5 * d, a: 0.387098, e: 0.205635 + 5.59e-10 * d, M: 168.6562 + 4.0923344368 * d }),
  venus: (d) => ({ N: 76.6799 + 2.4659e-5 * d, i: 3.3946 + 2.75e-8 * d, w: 54.891 + 1.38374e-5 * d, a: 0.72333, e: 0.006773 - 1.302e-9 * d, M: 48.0052 + 1.6021302244 * d }),
  mars: (d) => ({ N: 49.5574 + 2.11081e-5 * d, i: 1.8497 - 1.78e-8 * d, w: 286.5016 + 2.92961e-5 * d, a: 1.523688, e: 0.093405 + 2.516e-9 * d, M: 18.6021 + 0.5240207766 * d }),
  jupiter: (d) => ({ N: 100.4542 + 2.76854e-5 * d, i: 1.303 - 1.557e-7 * d, w: 273.8777 + 1.64505e-5 * d, a: 5.20256, e: 0.048498 + 4.469e-9 * d, M: 19.895 + 0.0830853001 * d }),
  saturn: (d) => ({ N: 113.6634 + 2.3898e-5 * d, i: 2.4886 - 1.081e-7 * d, w: 339.3939 + 2.97661e-5 * d, a: 9.55475, e: 0.055546 - 9.499e-9 * d, M: 316.967 + 0.0334442282 * d }),
};

// 離心近点角。Newton法で0.0001度まで詰める
function eccentricAnomaly(M, e) {
  let E = M + e * DEG * sin(M) * (1 + e * cos(M));
  for (let k = 0; k < 20; k++) {
    const E1 = E - (E - e * DEG * sin(E) - M) / (1 - e * cos(E));
    if (Math.abs(E1 - E) < 1e-4) return E1;
    E = E1;
  }
  return E;
}

// 軌道面上の位置から、黄道座標の直交成分と黄経・黄緯・距離を出す
function orbitPosition(el) {
  const M = rev(el.M);
  const E = eccentricAnomaly(M, el.e);
  const xv = el.a * (cos(E) - el.e);
  const yv = el.a * Math.sqrt(1 - el.e * el.e) * sin(E);
  const v = atan2(yv, xv);
  const r = Math.hypot(xv, yv);
  const vw = v + el.w;
  const x = r * (cos(el.N) * cos(vw) - sin(el.N) * sin(vw) * cos(el.i));
  const y = r * (sin(el.N) * cos(vw) + cos(el.N) * sin(vw) * cos(el.i));
  const z = r * sin(vw) * sin(el.i);
  return { lon: rev(atan2(y, x)), lat: atan2(z, Math.hypot(x, y)), r };
}

const toRect = (lon, lat, r) => [r * cos(lon) * cos(lat), r * sin(lon) * cos(lat), r * sin(lat)];

// 黄道直交座標から赤経・赤緯
function eclipticToEquatorial([x, y, z], ecl) {
  const ye = y * cos(ecl) - z * sin(ecl);
  const ze = y * sin(ecl) + z * cos(ecl);
  return { ra: rev(atan2(ye, x)), dec: atan2(ze, Math.hypot(x, ye)), dist: Math.hypot(x, y, z) };
}

function sunState(d) {
  const el = ELEMENTS.sun(d);
  const M = rev(el.M);
  const E = eccentricAnomaly(M, el.e);
  const xv = cos(E) - el.e;
  const yv = Math.sqrt(1 - el.e * el.e) * sin(E);
  const lon = rev(atan2(yv, xv) + el.w);
  const r = Math.hypot(xv, yv);
  return { lon, r, M, w: el.w, xs: r * cos(lon), ys: r * sin(lon) };
}

// 太陽・月・惑星の赤道座標（分点は観測時のもの）
export function bodies(date) {
  const d = dayNumber(date);
  const ecl = obliquity(d);
  const sun = sunState(d);
  const out = {};
  out.sun = { ...eclipticToEquatorial(toRect(sun.lon, 0, sun.r), ecl), lon: sun.lon };

  // 月。摂動項を黄経・黄緯・距離に足す
  const me = ELEMENTS.moon(d);
  const mp = orbitPosition(me);
  const Ms = rev(sun.M), Mm = rev(me.M), Nm = rev(me.N);
  const Ls = rev(Ms + sun.w), Lm = rev(Mm + me.w + Nm);
  const D = rev(Lm - Ls), F = rev(Lm - Nm);
  const mlon = mp.lon - 1.274 * sin(Mm - 2 * D) + 0.658 * sin(2 * D) - 0.186 * sin(Ms) - 0.059 * sin(2 * Mm - 2 * D)
    - 0.057 * sin(Mm - 2 * D + Ms) + 0.053 * sin(Mm + 2 * D) + 0.046 * sin(2 * D - Ms) + 0.041 * sin(Mm - Ms)
    - 0.035 * sin(D) - 0.031 * sin(Mm + Ms) - 0.015 * sin(2 * F - 2 * D) + 0.011 * sin(Mm - 4 * D);
  const mlat = mp.lat - 0.173 * sin(F - 2 * D) - 0.055 * sin(Mm - F - 2 * D) - 0.046 * sin(Mm + F - 2 * D)
    + 0.033 * sin(F + 2 * D) + 0.017 * sin(2 * Mm + F);
  const mr = mp.r - 0.58 * cos(Mm - 2 * D) - 0.46 * cos(2 * D);
  out.moon = { ...eclipticToEquatorial(toRect(mlon, mlat, mr), ecl), lon: rev(mlon), lat: mlat, rEarth: mr, diam: 1873.7 * 60 / mr };
  // 満ち欠け。位相角は太陽と月の黄経・黄緯の離角から
  const elong = Math.acos(cos(sun.lon - mlon) * cos(mlat)) * DEG;
  out.moon.elong = elong;
  out.moon.illum = (1 - cos(elong)) / 2;
  out.moon.waxing = rev(mlon - sun.lon) < 180;

  // 惑星。木星と土星は互いの摂動を足す
  const Mj = rev(ELEMENTS.jupiter(d).M), Msat = rev(ELEMENTS.saturn(d).M);
  for (const name of ['mercury', 'venus', 'mars', 'jupiter', 'saturn']) {
    const p = orbitPosition(ELEMENTS[name](d));
    let { lon, lat } = p;
    if (name === 'jupiter') {
      lon += -0.332 * sin(2 * Mj - 5 * Msat - 67.6) - 0.056 * sin(2 * Mj - 2 * Msat + 21) + 0.042 * sin(3 * Mj - 5 * Msat + 21)
        - 0.036 * sin(Mj - 2 * Msat) + 0.022 * cos(Mj - Msat) + 0.023 * sin(2 * Mj - 3 * Msat + 52) - 0.016 * sin(Mj - 5 * Msat - 69);
    } else if (name === 'saturn') {
      lon += 0.812 * sin(2 * Mj - 5 * Msat - 67.6) - 0.229 * cos(2 * Mj - 4 * Msat - 2) + 0.119 * sin(Mj - 2 * Msat - 3)
        + 0.046 * sin(2 * Mj - 6 * Msat - 69) + 0.014 * sin(Mj - 3 * Msat + 32);
      lat += -0.020 * cos(2 * Mj - 4 * Msat - 2) + 0.018 * sin(2 * Mj - 6 * Msat - 49);
    }
    const h = toRect(lon, lat, p.r);
    const g = [h[0] + sun.xs, h[1] + sun.ys, h[2]];
    const eq = eclipticToEquatorial(g, ecl);
    // 等級。位相角は太陽・惑星・地球の三角形から
    const R = eq.dist, s = sun.r;
    const FV = Math.acos(Math.max(-1, Math.min(1, (p.r * p.r + R * R - s * s) / (2 * p.r * R)))) * DEG;
    const base = { mercury: [-0.36, 0.027], venus: [-4.34, 0.013], mars: [-1.51, 0.016], jupiter: [-9.25, 0.014], saturn: [-9.0, 0.044] }[name];
    let mag = base[0] + 5 * Math.log10(p.r * R) + base[1] * FV;
    if (name === 'mercury') mag += 2.2e-13 * FV ** 6;
    if (name === 'venus') mag += 4.2e-7 * FV ** 3;
    if (name === 'saturn') {
      const los = atan2(g[1], g[0]), las = atan2(g[2], Math.hypot(g[0], g[1]));
      const B = asin(sin(las) * cos(28.06) - cos(las) * sin(28.06) * sin(los - (169.51 + 3.82e-5 * d)));
      mag += -2.6 * Math.abs(sin(B)) + 1.2 * sin(B) ** 2;
      eq.ringTilt = B;
    }
    out[name] = { ...eq, mag, phase: (1 + cos(FV)) / 2, diam: { mercury: 6.74, venus: 16.92, mars: 9.36, jupiter: 196.94, saturn: 165.6 }[name] / R };
  }
  // 恒星時（度）。Schlyterの式で、太陽の平均黄経から求める
  out.gmst = rev(Ls + 180 + (((date.getTime() / 3600000) % 24 + 24) % 24) * 15);
  out.d = d;
  return out;
}

// J2000の赤経・赤緯を、その日の分点へ移す（Meeus 21.4）
export function precessor(date) {
  const T = (julianDay(dayNumber(date)) - 2451545.0) / 36525;
  const zeta = (2306.2181 * T + 0.30188 * T * T + 0.017998 * T ** 3) / 3600;
  const z = (2306.2181 * T + 1.09468 * T * T + 0.018203 * T ** 3) / 3600;
  const theta = (2004.3109 * T - 0.42665 * T * T - 0.041833 * T ** 3) / 3600;
  const ct = cos(theta), st = sin(theta);
  return (ra0, dec0) => {
    const a = ra0 + zeta;
    const A = cos(dec0) * sin(a);
    const B = ct * cos(dec0) * cos(a) - st * sin(dec0);
    const C = st * cos(dec0) * cos(a) + ct * sin(dec0);
    return { ra: rev(atan2(A, B) + z), dec: asin(C) };
  };
}

// 赤道座標から地平座標。lstは地方恒星時（度）、方位は北から東回り
export function horizontal(ra, dec, lst, lat) {
  const ha = lst - ra;
  const x = cos(ha) * cos(dec), y = sin(ha) * cos(dec), z = sin(dec);
  const xh = x * sin(lat) - z * cos(lat);
  const zh = x * cos(lat) + z * sin(lat);
  return { az: rev(atan2(y, xh) + 180), alt: asin(zh) };
}

// 大気差（Sæmundssonの式、Meeus 16.4）。真の高度に足すと見かけの高度になる
export function refraction(alt) {
  if (alt < -2) return 0;
  return 1.02 / Math.tan((alt + 10.3 / (alt + 5.11)) * RAD) / 60;
}

// 大気の通り道の長さ（Pickering 2002）。地平線近くの星が暗くなる分に使う
export function airmass(alt) {
  const h = Math.max(alt, 0.5);
  return 1 / Math.sin((h + 244 / (165 + 47 * h ** 1.1)) * RAD);
}

// 月の地心から観測地への視差。地平座標の高度だけを直す（Schlyter 13章）
export function moonParallax(altGeo, rEarth) {
  const mpar = Math.asin(1 / rEarth) * DEG;
  return altGeo - mpar * cos(altGeo);
}

// 赤道座標（J2000）から銀河座標。HipparcosのJ2000→銀河の回転行列
const GAL = [
  [-0.0548755604, -0.8734370902, -0.4838350155],
  [0.4941094279, -0.44482963, 0.7469822445],
  [-0.867666149, -0.1980763734, 0.4559837762],
];
export function equatorialVecToGalactic(v) {
  return [
    GAL[0][0] * v[0] + GAL[0][1] * v[1] + GAL[0][2] * v[2],
    GAL[1][0] * v[0] + GAL[1][1] * v[1] + GAL[1][2] * v[2],
    GAL[2][0] * v[0] + GAL[2][1] * v[1] + GAL[2][2] * v[2],
  ];
}
export const radec2vec = (ra, dec) => [cos(dec) * cos(ra), cos(dec) * sin(ra), sin(dec)];
export const vec2radec = (v) => ({ ra: rev(atan2(v[1], v[0])), dec: asin(v[2]) });
