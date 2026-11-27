// 시·군·구별 공유 미리보기 이미지(2026-11-27 제미나이 합의: 시·군·구 단위만, 동 화면은 소속 시·군·구 이미지를 쓴다).
// 숫자(시세)는 넣지 않는다: 데이터를 갱신해도 이미지가 틀리지 않게. 이름 + 그 시·군·구 동 경계 모양만.
// 실행(개발 PC·클라우드, 행정구역이 바뀔 때만): node scripts/og/rent-sgg.cjs  → public/og/rent/{sido}__{slug}.jpg (1200×630)
// 필요: playwright(크로미움). 사이트 빌드·배포에는 쓰지 않는다.
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..', '..');
const stats = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/rent-stats.json'), 'utf8'));
const SIDO = { seoul: '서울', gyeonggi: '경기', incheon: '인천' };
const OUT = path.join(ROOT, 'public/og/rent');
const font = 'file://' + path.join(ROOT, 'src/styles/fonts/pretendard/pretendard.css');
const LOGO = '<svg width="64" height="64" viewBox="0 0 24 24"><defs><linearGradient id="g" x1="0" y1="0" x2=".9" y2="1"><stop offset="0" stop-color="#6B1F57"/><stop offset="1" stop-color="#B23A5B"/></linearGradient></defs><path d="M12 23.2 8.7 19.4H6.4A4.4 4.4 0 0 1 2 15V6.4A4.4 4.4 0 0 1 6.4 2h11.2A4.4 4.4 0 0 1 22 6.4V15a4.4 4.4 0 0 1-4.4 4.4h-2.3Z" fill="url(#g)"/><circle cx="12" cy="10.7" r="4" fill="#fff"/><circle cx="12" cy="10.7" r="1.7" fill="#F59A4E"/></svg>';
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

function svgOf(fc, W, H, pad) {
  let x0 = 180, y0 = 90, x1 = -180, y1 = -90;
  const each = (g, fn) => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates).forEach((p) => p.forEach((r) => r.forEach(fn)));
  const k = Math.cos((37.5 * Math.PI) / 180);
  fc.features.forEach((f) => each(f.geometry, ([x, y]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }));
  const s = Math.min((W - pad * 2) / ((x1 - x0) * k), (H - pad * 2) / (y1 - y0));
  const ox = (W - (x1 - x0) * k * s) / 2, oy = (H - (y1 - y0) * s) / 2;
  const P = ([x, y]) => `${(ox + (x - x0) * k * s).toFixed(1)},${(oy + (y1 - y) * s).toFixed(1)}`;
  // 한 가지 색만 쓴다(사이트 지도에서 색은 시세 높낮이라, 여러 색이면 시세처럼 읽힐 수 있다)
  return fc.features.map((f) => {
    const d = (f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates).map((p) => p.map((r) => 'M' + r.map(P).join('L') + 'Z').join('')).join('');
    return `<path d="${d}" fill="#ECC3D3" stroke="#fff" stroke-width="2.2" stroke-linejoin="round"/>`;
  }).join('');
}

const html = (name, sd, n, svg) => `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${font}"><style>
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;overflow:hidden;font-family:"Pretendard Variable",sans-serif;letter-spacing:-.035em;color:#191F28;
 background:radial-gradient(900px 520px at 100% 0%,#F9DCE6 0%,rgba(249,220,230,0) 70%),radial-gradient(700px 500px at 0% 100%,#FFE9D6 0%,rgba(255,233,214,0) 70%),#FFF8F3}
.wrap{position:absolute;inset:0;padding:72px 84px;display:flex;flex-direction:column;width:690px}
.brand{display:flex;align-items:center;gap:18px}.brand svg{filter:drop-shadow(0 10px 18px rgba(107,31,87,.28))}
.wm{font-size:46px;font-weight:900}.wm b{color:#6B1F57;font-weight:900}
.sd{margin-top:54px;font-size:30px;font-weight:700;color:#6B1F57}
h1{margin-top:8px;font-size:${name.length > 5 ? 76 : 88}px;line-height:1.1;font-weight:850;letter-spacing:-.045em}
h1 .hl{background:linear-gradient(transparent 62%,#FBD3DF 62%,#FBD3DF 92%,transparent 92%)}
.sub{margin-top:18px;font-size:32px;font-weight:700;color:#333D4B}
.chips{margin-top:auto;display:flex;gap:12px}
.chip{height:52px;padding:0 22px;display:flex;align-items:center;border-radius:26px;background:#fff;box-shadow:0 2px 10px rgba(25,31,40,.07);font-size:24px;font-weight:700;color:#6B1F57}
.chip.k{background:#6B1F57;color:#fff}
.scene{position:absolute;right:56px;top:70px;width:460px;height:490px;border-radius:36px;background:#fff;box-shadow:0 30px 60px rgba(107,31,87,.16),0 4px 14px rgba(25,31,40,.06)}
</style></head><body><div class="wrap"><div class="brand">${LOGO}<span class="wm">동네<b>콕콕</b></span></div>
<p class="sd">${esc(sd)}</p><h1><span class="hl">${esc(name)}</span></h1><p class="sub">빌라·오피스텔 전월세 시세</p>
<div class="chips"><span class="chip k">동별 비교</span><span class="chip">전세</span><span class="chip">월세</span></div></div>
<div class="scene"><svg width="460" height="490" viewBox="0 0 460 490">${svg}</svg></div></body></html>`;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  const tmp = path.join(OUT, '.tmp.html');
  let n = 0;
  for (const a of stats.areas.filter((x) => x.dong === null)) {
    const f = path.join(ROOT, 'src/data/geo/emd', `${a.sido}__${a.sigungu}.json`);
    if (!fs.existsSync(f)) continue;
    const fc = JSON.parse(fs.readFileSync(f, 'utf8'));
    const dongs = stats.areas.filter((x) => x.dong !== null && x.sido === a.sido && x.sigungu === a.sigungu).length;
    fs.writeFileSync(tmp, html(a.sigunguName, SIDO[a.sido] ?? '', dongs, svgOf(fc, 460, 490, 34)));
    await p.goto('file://' + tmp); await p.evaluate(() => document.fonts.ready);
    await p.screenshot({ path: path.join(OUT, `${a.sido}__${a.sigungu}.jpg`), type: 'jpeg', quality: 86 });
    n++;
  }
  fs.unlinkSync(tmp); await b.close();
  console.log(`${n}장 → public/og/rent/`);
})();
