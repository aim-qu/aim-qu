// 一時間ごとに書き直す絵。空は、日が沈んでいれば「いまの空」、昼間は「今夜21時の空」を描く。
// 障子はいまの日差しと天気で描く。天気はOpen-Meteoから取り、取れなければ薄曇りの晴れとして描く。
// 試す時は --at=2026-10-26T21:00+09:00 で時刻を、--weather=clear|cloudy|rain で天気を差し替えられる

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { renderSky } from './sky.mjs';
import { renderShoji } from './shoji.mjs';
import { bodies, horizontal, rev } from './astro.mjs';

const LAT = 35, LON = 135;
const OUT = new URL('../../live/', import.meta.url);
const README = new URL('../../README.md', import.meta.url);

const arg = (name) => process.argv.find(a => a.startsWith(`--${name}=`))?.split('=').slice(1).join('=');

function sunAltAt(date) {
  const B = bodies(date);
  return horizontal(B.sun.ra, B.sun.dec, rev(B.gmst + LON), LAT).alt;
}

// いまの天気。雲量（%）、WMOの天気コード、直前15分の降水量（mm）、地上10mの風速（km/h）
async function fetchWeather() {
  const forced = { clear: { cloud: 5, code: 0, precip: 0, wind: 8 }, cloudy: { cloud: 65, code: 3, precip: 0, wind: 14 }, rain: { cloud: 100, code: 63, precip: 1.2, wind: 18 } }[arg('weather')];
  if (forced) return forced;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}`
    + '&current=cloud_cover,weather_code,precipitation,wind_speed_10m&timezone=Asia%2FTokyo';
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const c = (await res.json()).current;
    return { cloud: c.cloud_cover, code: c.weather_code, precip: c.precipitation, wind: c.wind_speed_10m };
  } catch (e) {
    console.warn('天気を取得できませんでした:', e.message);
    return null;
  }
}

const at = arg('at');
const now = at ? new Date(at) : new Date(Math.floor(Date.now() / 60000) * 60000);
let when, chart;
if (sunAltAt(now) < -0.8) {
  when = 'いま';
  chart = now;
} else {
  // 日本時間の今日の21時（UTCの12時）
  const j = new Date(now.getTime() + 9 * 3600000);
  when = '今夜21時';
  chart = new Date(Date.UTC(j.getUTCFullYear(), j.getUTCMonth(), j.getUTCDate(), 12, 0));
}

const t0 = performance.now();
const { svg, named, info } = renderSky({ date: chart, lat: LAT, lon: LON, when });
mkdirSync(OUT, { recursive: true });
writeFileSync(new URL('sky.svg', OUT), svg);
writeFileSync(new URL('sky-names.svg', OUT), named);
console.log(`${info.title}  sky.svg ${(svg.length / 1024).toFixed(0)} KB  sky-names.svg ${(named.length / 1024).toFixed(0)} KB  ${(performance.now() - t0).toFixed(0)} ms`);

// READMEの空の段。印の間だけを書き換え、ほかの段には触れない。
// 昼のあいだは同じ「今夜21時」の絵なので、印の値も変わらず書き換えも起きない
const stamp = Math.floor(chart.getTime() / 3600000).toString(36);
const block = `<!-- live:sky -->
<p align="center"><img src="./live/sky.svg?v=${stamp}" width="100%" alt="${info.title}（東経${LON}°・北緯${LAT}°）"></p>

<details>
<summary><sub>星の名前</sub></summary>
<p align="center"><img src="./live/sky-names.svg?v=${stamp}" width="100%" alt="同じ空に月・惑星・明るい星・星座の名前を重ねたもの"></p>
</details>
<!-- /live:sky -->`;

// 障子。光は一時間ごとに変わるので、印も一時間ごとに変える
const weather = await fetchWeather();
const shoji = renderShoji({ date: now, weather, lat: LAT, lon: LON });
writeFileSync(new URL('shoji.svg', OUT), shoji.svg);
writeFileSync(new URL('shoji-open.svg', OUT), shoji.open);
writeFileSync(new URL('state.json', OUT), JSON.stringify({ generated: now.toISOString(), chart: chart.toISOString(), ...info, shoji: { weather, ...shoji.info } }, null, 2) + '\n');
console.log(`${shoji.info.kou.name}  shoji.svg ${(shoji.svg.length / 1024).toFixed(0)} KB`);
const kou = shoji.info.kou;
const hourStamp = Math.floor(now.getTime() / 3600000).toString(36);
const shojiBlock = `<!-- live:shoji -->
<p align="center"><img src="./live/shoji.svg?v=${hourStamp}" width="100%" alt="障子に映る竹の影。七十二候の${kou.sekki}${kou.kou}「${kou.name}（${kou.yomi}）」"></p>

<details>
<summary><sub>障子をあける</sub></summary>
<p align="center"><img src="./live/shoji-open.svg?v=${hourStamp}" width="100%" alt="障子を一枚あけて見た外の竹林を、水墨の絵にしたもの"></p>
</details>
<!-- /live:shoji -->`;

let readme = readFileSync(README, 'utf8');
for (const [name, text] of [['sky', block], ['shoji', shojiBlock]]) {
  const re = new RegExp(`<!-- live:${name} -->[\\s\\S]*?<!-- \\/live:${name} -->`);
  readme = re.test(readme) ? readme.replace(re, text) : `${readme.trimEnd()}\n\n${text}\n`;
}
writeFileSync(README, readme);
