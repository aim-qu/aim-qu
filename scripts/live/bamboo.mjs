// 窓の外の竹林。障子に落ちる影も、障子をあけて見える竹も、同じこの竹林から作る。
// 稈は1マスに一本出るか出ないかで、マスの番号から決まるので、どの時刻でも同じ竹林になる。
// 座標はmmで、xは南を向いて右（西）が正、zは床からの高さ、dは障子からの距離

const f1 = (x) => (Math.round(x * 10) / 10).toString();

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const seedOf = (...n) => n.reduce((h, v) => Math.imul(h ^ (v | 0), 0x9E3779B1) >>> 0, 0x811C9DC5);

// 竹林の層。障子からの距離、稈の間隔と出やすさ、太さ、高さ、枝の出始め、葉の長さ、小枝の太さ
export const NEAR = { seed: 7, d: 1300, cell: 1100, prob: 0.55, dia: [32, 46], top: 6500, branchFrom: 1300, leaf: [115, 60], twig: 9 };
export const FAR = { seed: 31, d: 3200, cell: 900, prob: 0.5, dia: [24, 38], top: 7500, branchFrom: 1000, leaf: [100, 50], twig: 7 };
// 奥の竹林。外から見える時だけ使う。奥ほど下枝が落ちて、葉は高い所に残る
export const DEEP = [
  { seed: 71, d: 7800, cell: 480, prob: 0.6, dia: [45, 80], top: 10000, branchFrom: 3000, leaf: [110, 50], twig: 8 },
  { seed: 53, d: 5200, cell: 560, prob: 0.55, dia: [40, 70], top: 9000, branchFrom: 2300, leaf: [110, 50], twig: 8 },
];

// 竹を作る。枝は節から斜め上へ出て、先が葉の重みで垂れる。小枝は上下交互に出て、先に三〜六枚の葉の房をつける。
// xMin〜xMax、zMin〜zMaxは要る範囲で、その外の枝は作らない
export function grove(L, xMin, xMax, zMin, zMax) {
  const culms = [], branches = [], tufts = [];
  const droop = (a, k) => Math.atan2(Math.sin(a) - k, Math.cos(a));
  for (let i = Math.floor((xMin - 1000) / L.cell); i <= Math.ceil((xMax + 1000) / L.cell); i++) {
    const r = mulberry32(seedOf(L.seed, i));
    if (r() > L.prob) continue;
    const x0 = (i + 0.15 + 0.7 * r()) * L.cell;
    const D = L.dia[0] + r() * (L.dia[1] - L.dia[0]);
    const lean = (r() - 0.5) * 0.03;
    const top = L.top * (0.8 + 0.4 * r());
    const xAt = (z) => x0 + lean * z;
    const nodes = [];
    for (let z = 100 + r() * 160; z < top; z += (230 + r() * 110) * (1 + 0.6 * z / top)) nodes.push(z);
    culms.push({ i, xAt, D, top, nodes });
    nodes.forEach((z, k) => {
      if (z < L.branchFrom || z < zMin - 1100 || z > zMax + 400) return;
      const rb = mulberry32(seedOf(L.seed, i, k));
      const side = (k + i) % 2 ? 1 : -1;
      const len = (380 + 480 * rb()) * (1 - 0.35 * z / top);
      let a = side > 0 ? 0.5 + 0.35 * rb() : Math.PI - 0.5 - 0.35 * rb();
      let px = xAt(z) + side * D * 0.45, pz = z;
      // 同じ枝から出た小枝と葉の房には、同じ枝の番号を付けておく
      const bid = `${i}_${k}`;
      const pts = [[px, pz]];
      pts.bid = bid;
      for (let s = 0; s < 5; s++) {
        a += -side * (0.1 + 0.06 * rb()) + (rb() - 0.5) * 0.08;
        px += Math.cos(a) * len / 5;
        pz += Math.sin(a) * len / 5;
        pts.push([px, pz]);
        if (s >= 1) {
          const up = s % 2 ? 1 : -1;
          const ta = a + side * up * 0.75;
          const tl = len * (0.1 + 0.06 * rb());
          const tx = px + Math.cos(ta) * tl, tz = pz + Math.sin(ta) * tl;
          const twig = [[px, pz], [tx, tz]];
          twig.bid = bid;
          branches.push(twig);
          tufts.push(tuft(L, rb, tx, tz, droop(ta, 0.9), 3 + Math.floor(rb() * 3), bid));
        }
      }
      branches.push(pts);
      tufts.push(tuft(L, rb, px, pz, droop(a, 0.8), 4 + Math.floor(rb() * 3), bid));
    });
  }
  return { culms, branches, tufts };
}
function tuft(L, rb, x, z, dir, n, bid) {
  const leaves = [];
  const spread = Math.min(1, 4.5 / n);
  for (let j = 0; j < n; j++) {
    const a = dir + (j - (n - 1) / 2) * (0.34 + rb() * 0.14) * spread + (rb() - 0.5) * 0.25;
    const len = L.leaf[0] + rb() * L.leaf[1];
    leaves.push({ a, len, wid: len * (0.13 + rb() * 0.035) });
  }
  return { x, z, leaves, tone: rb(), bid };
}

// 竹の葉。根元から細長く伸び、根元寄り三割が一番幅広く、先は長く尖る。toは世界座標から画面座標への変換
export function leafD(x, z, a, len, wid, to) {
  const c = Math.cos(a), s = Math.sin(a);
  const p = (u, v) => { const q = to(x + u * c - v * s, z + u * s + v * c); return `${f1(q[0])} ${f1(q[1])}`; };
  return `M${p(0, 0)}Q${p(len * 0.28, wid * 0.9)} ${p(len * 0.74, wid * 0.36)}Q${p(len * 0.93, wid * 0.1)} ${p(len, 0)}`
    + `Q${p(len * 0.93, -wid * 0.1)} ${p(len * 0.74, -wid * 0.36)}Q${p(len * 0.28, -wid * 0.9)} ${p(0, 0)}Z`;
}
