// 건물 위치(지번 → 좌표): 행정안전부 주소정보 '내비게이션용DB'(business.juso.go.kr 주소정보 제공) 파일을 사용자 PC에서 읽는다.
// - VWorld 지오코더는 쓰지 않는다(VWorld 약관 19조 6항: 받은 데이터 저장 금지). 주소정보 DB는 내려받아 쓰는 공개 자료이고
//   재배포 제한 조항이 없음을 사용자가 확인했다(도로명주소법 시행령 6조, 2026-11-26). 출처는 /about/#licenses 에 밝힌다.
// - 파일 배치: .cache/juso/ 아래에 압축을 푼 .txt 파일(서울·경기·인천). 하위 폴더도 찾는다.
// - 파일 형식은 '|' 구분, 머리글 없음. 열 위치를 외워 두지 않고 모양으로 찾는다(레이아웃이 바뀌어도 버티게):
//     법정동코드(10자리) | 시도 | 시군구 | 읍면동 | 리 | 산여부(0/1) | 지번본번 | 지번부번 | 도로명코드(12자리) | 도로명 | 지하여부 | 건물본번 | 건물부번 | … | X | Y(UTM-K) …
//   좌표는 뒤쪽에서 UTM-K 범위에 드는 숫자 두 개가 나란히 있는 첫 자리(건물 중심점). 좌표가 없는 행(관련지번 파일)은
//   도로명 건물 번호로 같은 건물의 좌표를 이어 준다.
// - 인코딩: UTF-8이 아니면 EUC-KR(CP949)로 읽는다.
import { createReadStream } from 'node:fs';
import { readdir, open } from 'node:fs/promises';
import { join } from 'node:path';

// ===== 지번 =====
/** '123-4', '123', '산 12-3', '123-0' → '123-4' · '123' · '산12-3' · '123'. 숫자가 없으면 null */
export function jibunKey(raw: unknown): string | null {
  const s = String(raw ?? '').replace(/\s+/g, '');
  const m = /^(산)?0*(\d{1,5})(?:-0*(\d{1,5}))?$/.exec(s);
  if (!m || m[2] === '0' && !m[3]) return null;
  const bu = m[3] && Number(m[3]) > 0 ? `-${Number(m[3])}` : '';
  return `${m[1] ?? ''}${Number(m[2])}${bu}`;
}
/** 지역코드 5자리 + 법정동(읍·면은 '읍 리') + 지번 */
export const placeKey = (code5: string, dong: string, jibun: string) => `${code5}|${dong.replace(/\s+/g, ' ').trim()}|${jibun}`;
/** 코드가 개편으로 달라도 맞출 수 있게 시·도 2자리로 한 번 더 */
export const looseKey = (code5: string, dong: string, jibun: string) => placeKey(code5.slice(0, 2), dong, jibun);

// ===== UTM-K(EPSG:5179, GRS80 횡메르카토르) → WGS84 =====
const A = 6378137, F = 1 / 298.257222101, K0 = 0.9996, LAT0 = 38 * Math.PI / 180, LON0 = 127.5 * Math.PI / 180, FE = 1_000_000, FN = 2_000_000;
const E2 = 2 * F - F * F, EP2 = E2 / (1 - E2), E4 = E2 * E2, E6 = E4 * E2;
const meridian = (p: number) => A * ((1 - E2 / 4 - 3 * E4 / 64 - 5 * E6 / 256) * p - (3 * E2 / 8 + 3 * E4 / 32 + 45 * E6 / 1024) * Math.sin(2 * p)
  + (15 * E4 / 256 + 45 * E6 / 1024) * Math.sin(4 * p) - (35 * E6 / 3072) * Math.sin(6 * p));
const M0 = meridian(LAT0);

export function utmkToWgs84(x: number, y: number): [number, number] {
  const M = M0 + (y - FN) / K0;
  const mu = M / (A * (1 - E2 / 4 - 3 * E4 / 64 - 5 * E6 / 256));
  const e1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2));
  const p1 = mu + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu) + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu)
    + (151 * e1 ** 3 / 96) * Math.sin(6 * mu) + (1097 * e1 ** 4 / 512) * Math.sin(8 * mu);
  const s = Math.sin(p1), c = Math.cos(p1), t = Math.tan(p1);
  const C1 = EP2 * c * c, T1 = t * t, N1 = A / Math.sqrt(1 - E2 * s * s), R1 = A * (1 - E2) / (1 - E2 * s * s) ** 1.5, D = (x - FE) / (N1 * K0);
  const lat = p1 - (N1 * t / R1) * (D ** 2 / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 ** 2 - 9 * EP2) * D ** 4 / 24 + (61 + 90 * T1 + 298 * C1 + 45 * T1 ** 2 - 252 * EP2 - 3 * C1 ** 2) * D ** 6 / 720);
  const lon = LON0 + (D - (1 + 2 * T1 + C1) * D ** 3 / 6 + (5 - 2 * C1 + 28 * T1 - 3 * C1 ** 2 + 8 * EP2 + 24 * T1 ** 2) * D ** 5 / 120) / c;
  return [lat * 180 / Math.PI, lon * 180 / Math.PI];
}
/** 시험용 정방향(WGS84 → UTM-K) */
export function wgs84ToUtmk(latDeg: number, lonDeg: number): [number, number] {
  const p = latDeg * Math.PI / 180, l = lonDeg * Math.PI / 180;
  const s = Math.sin(p), c = Math.cos(p), t = Math.tan(p);
  const N = A / Math.sqrt(1 - E2 * s * s), T = t * t, C = EP2 * c * c, Aa = (l - LON0) * c;
  const x = FE + K0 * N * (Aa + (1 - T + C) * Aa ** 3 / 6 + (5 - 18 * T + T * T + 72 * C - 58 * EP2) * Aa ** 5 / 120);
  const y = FN + K0 * (meridian(p) - M0 + N * t * (Aa * Aa / 2 + (5 - T + 9 * C + 4 * C * C) * Aa ** 4 / 24 + (61 - 58 * T + T * T + 600 * C - 330 * EP2) * Aa ** 6 / 720));
  return [x, y];
}

// ===== 한 줄 읽기 =====
export interface JusoRow { code5: string; dong: string; jibun: string | null; road: string | null; xy: [number, number] | null }
const isX = (v: number) => v > 600_000 && v < 1_500_000;
const isY = (v: number) => v > 1_300_000 && v < 2_300_000;
const numOrNaN = (s: string | undefined) => (s && /^-?\d+(\.\d+)?$/.test(s.trim()) ? Number(s) : NaN);

/** 한 줄 → 지번(있으면)·도로명 건물 키·좌표(있으면).
 *  2026-11 내비게이션용DB에서 match_build_*(건물 중심 좌표, 지번 없음)가 0줄로 읽혀 좌표가 하나도 안 붙었다(사용자 PC).
 *  그래서 지번 열이 없는 줄도 '도로명코드(12자리) + 지하여부 + 건물본번 + 부번'과 좌표만 있으면 받는다.
 *  도로명코드 뒤에 도로명 글자가 있는 형식·없는 형식을 모두 받는다. 열 위치는 외우지 않고 모양으로 찾는다. */
export function parseJusoLine(line: string): JusoRow | null {
  const f = line.split('|').map((x) => x.trim());
  if (f.length < 6) return null;
  // 도로명 건물 키
  let road: string | null = null, after = -1;
  const r = f.findIndex((x, j) => j > 0 && /^\d{12}$/.test(x));
  if (r > 0) {
    let k = r + 1;
    if (f[k] !== undefined && !/^\d+$/.test(f[k])) k++; // 도로명 글자
    if ((f[k] === '0' || f[k] === '1') && /^\d+$/.test(f[k + 1] ?? '') && /^\d*$/.test(f[k + 2] ?? '')) {
      road = `${f[r]}/${f[k]}/${Number(f[k + 1])}/${Number(f[k + 2] || 0)}`;
      after = k + 3;
    }
  }
  // 좌표: 도로명 건물 번호 뒤에서 UTM-K 범위 숫자 두 개가 나란히 있는 첫 자리(건물 중심점)
  let xy: [number, number] | null = null;
  for (let j = Math.max(after, 1); j < f.length - 1; j++) {
    const x = numOrNaN(f[j]), y = numOrNaN(f[j + 1]);
    if (isX(x) && isY(y)) { xy = [x, y]; break; }
  }
  // 지번(관련지번 파일): 법정동코드(10) | 시도 | 시군구 | 읍면동 | 리 | 산여부 | 본번 | 부번
  const i = f.slice(0, 3).findIndex((x) => /^\d{10}$/.test(x));
  let code5 = '', dong = '', jibun: string | null = null;
  if (i >= 0) {
    const emd = f[i + 3] ?? '', ri = f[i + 4] ?? '', san = f[i + 5] ?? '';
    code5 = f[i].slice(0, 5); dong = ri ? `${emd} ${ri}` : emd;
    if (emd && (san === '0' || san === '1') && /^\d+$/.test(f[i + 6] ?? '')) jibun = jibunKey(`${san === '1' ? '산' : ''}${f[i + 6]}-${f[i + 7] || '0'}`);
  }
  if (!jibun && !(road && xy)) return null;
  return { code5, dong, jibun, road, xy };
}

// ===== 파일 훑기 =====
/** 수도권이 아닌 시·도 파일(전국 DB를 통째로 풀어 둔 경우). 이름에 시·도가 없는 파일은 읽는다(2026-11-27, 메모리·시간 절약) */
const OTHER_SIDO = /busan|daegu|gwangju|daejeon|ulsan|sejong|gangwon|chungbuk|chungnam|chungcheong|jeonbuk|jeonnam|jeolla|gyeongbuk|gyeongnam|gyeongsang|jeju/i;
export const isCapitalFile = (name: string) => !OTHER_SIDO.test(name.replace(/^.*[\\/]/, ''));
async function txtFiles(dir: string): Promise<string[]> {
  let out: string[] = [];
  let ents;
  try { ents = await readdir(dir, { withFileTypes: true }); } catch { return []; }
  for (const e of ents) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out = out.concat(await txtFiles(p));
    else if (/\.txt$/i.test(e.name) && isCapitalFile(e.name)) out.push(p);
  }
  return out.sort();
}
async function detectEncoding(file: string) {
  const h = await open(file, 'r');
  try {
    const buf = Buffer.alloc(1 << 20);
    const { bytesRead } = await h.read(buf, 0, buf.length, 0);
    const end = buf.subarray(0, bytesRead).lastIndexOf(10);
    try { new TextDecoder('utf-8', { fatal: true }).decode(buf.subarray(0, end > 0 ? end : bytesRead)); return 'utf-8'; } catch { return 'euc-kr'; }
  } finally { await h.close(); }
}
async function eachLine(file: string, enc: string, fn: (line: string) => void) {
  const dec = new TextDecoder(enc);
  let rest = '';
  for await (const chunk of createReadStream(file, { highWaterMark: 1 << 20 })) {
    const text = rest + dec.decode(chunk as Buffer, { stream: true });
    const lines = text.split(/\r?\n/);
    rest = lines.pop() ?? '';
    for (const l of lines) fn(l);
  }
  rest += dec.decode();
  if (rest) fn(rest);
}

export interface GeoIndex { files: string[]; rows: number; withXY: number; lookup(code5: string, dong: string, jibun: string): [number, number] | null }

/** need: 실거래에 나온 지번만 기억한다(메모리 절약). 좌표는 WGS84 소수 5자리(약 1m). */
export async function loadJusoGeo(dir: string, need: Set<string>, log: (s: string) => void = () => {}): Promise<GeoIndex> {
  const files = await txtFiles(dir);
  const exact = new Map<string, [number, number]>();
  const loose = new Map<string, [number, number] | false>(); // false = 같은 시·도에 같은 동·지번이 둘 이상(모호)
  const roadXY = new Map<string, [number, number]>();
  const pending: { k: string; lk: string; road: string }[] = [];
  const needLoose = new Set([...need].map((k) => { const [c, d, j] = k.split('|'); return looseKey(c, d, j); }));
  let rows = 0, withXY = 0;
  // 도로명 건물 좌표는 필요한 시·도(도로명코드 앞 2자리)만 기억한다(전국 파일을 다 풀어도 메모리가 넘치지 않게)
  const sidoNeed = new Set([...need].map((k) => k.slice(0, 2)));
  const put = (k: string, lk: string, xy: [number, number]) => {
    const ll = utmkToWgs84(xy[0], xy[1]).map((v) => Math.round(v * 1e5) / 1e5) as [number, number];
    if (need.has(k) && !exact.has(k)) exact.set(k, ll);
    if (needLoose.has(lk)) { const prev = loose.get(lk); loose.set(lk, prev === undefined ? ll : prev && Math.abs(prev[0] - ll[0]) + Math.abs(prev[1] - ll[1]) < 0.002 ? prev : false); }
  };
  for (const file of files) {
    const enc = await detectEncoding(file);
    let n = 0, nxy = 0;
    await eachLine(file, enc, (line) => {
      const r = parseJusoLine(line);
      if (!r) return;
      rows++; n++;
      if (r.xy) { withXY++; nxy++; if (r.road && sidoNeed.has(r.road.slice(0, 2)) && !roadXY.has(r.road)) roadXY.set(r.road, r.xy); }
      if (!r.jibun) return; // 건물 파일(좌표만): 도로명 키로 아래에서 잇는다
      const k = placeKey(r.code5, r.dong, r.jibun), lk = looseKey(r.code5, r.dong, r.jibun);
      if (r.xy) put(k, lk, r.xy);
      else if (r.road && (need.has(k) || needLoose.has(lk))) pending.push({ k, lk, road: r.road });
    });
    log(`  ${file} (${enc}) ${n.toLocaleString('ko-KR')}줄, 좌표 ${nxy.toLocaleString('ko-KR')}줄`);
  }
  let linked = 0;
  for (const p of pending) { const xy = roadXY.get(p.road); if (xy) { put(p.k, p.lk, xy); linked++; } }
  log(`  도로명 건물 좌표 ${roadXY.size.toLocaleString('ko-KR')}곳, 지번에 이은 것 ${linked.toLocaleString('ko-KR')}건`);
  roadXY.clear(); pending.length = 0; // 큰 임시 표는 바로 비운다
  return {
    files, rows, withXY,
    lookup(code5, dong, jibun) {
      return exact.get(placeKey(code5, dong, jibun)) ?? (loose.get(looseKey(code5, dong, jibun)) || null);
    },
  };
}
