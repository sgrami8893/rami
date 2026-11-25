// 데이터 갱신 (월 1~2회, 국내 PC에서 수동 실행):
//   1) https://file.localdata.go.kr 에서 무인민원발급기 CSV 2개 다운로드 (해외 IP는 차단됨)
//        - 무인민원발급기정보_설치정보조회.csv   (기기 목록, 필수)
//        - 무인민원발급기정보_발급제증명조회.csv (기기별 발급 서류, 권장)
//   2) npm run update-data -- <설치정보.csv> --docs <발급제증명.csv>
//   3) 콘솔 요약과 src/data/kiosks.report.json 의 diff 확인 -> git commit && git push (Cloudflare Pages 자동 빌드)
// Options: --out src/data/kiosks.json  --force (삭제 10% 초과 안전장치 무시)
// 좌표: 원천 데이터에 좌표가 없다. src/data/geocode-cache.json (도로명주소 -> [lat, lng]) 이 있으면 사용(지오코딩 스크립트는 2차 작업).
// 예전 형식(양산시형 컬럼, 가상 데이터)도 그대로 처리한다.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { decodeKorean, parseCsv, toRecords } from './lib/csv.ts';
import { mapHeaders } from './lib/aliases.ts';
import { normalizeRecord, dedupeIds, attachNearby, inferSubGu, type Kiosk, type Skip } from './lib/normalize.ts';
import { isInstallFile, isDocsFile, indexDocs, normalizeLocal, type DocsIndex } from './lib/localdata.ts';
import { regionStats } from './lib/stats.ts';
import { SIGUNGU, type SidoSlug } from './lib/regions.ts';
const SUBGU_CITIES = new Set((Object.keys(SIGUNGU) as SidoSlug[]).flatMap((s) => SIGUNGU[s].filter((g) => g.subGu?.length).map((g) => `${s}/${g.slug}`)));

const MAX_DELETE_RATIO = 0.1;
const args = process.argv.slice(2);
const flag = (n: string) => args.includes(n);
const opt = (n: string, d: string | null) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const out = opt('--out', 'src/data/kiosks.json')!;
const docsPath = opt('--docs', null);
const reportPath = out.replace(/\.json$/, '.report.json');
const cachePath = out.replace(/kiosks\.json$/, 'geocode-cache.json');
const optionValues = new Set([out, docsPath]);
const input = args.find((a) => !a.startsWith('--') && !optionValues.has(a));
if (!input) { console.error('사용법: npm run update-data -- <설치정보.csv> [--docs <발급제증명.csv>]'); process.exit(1); }

const load = async (p: string) => {
  const { text, encoding } = decodeKorean(new Uint8Array(await readFile(p)));
  return { encoding, ...toRecords(parseCsv(text)) };
};

const src = await load(input);
const report = { skips: [] as Skip[], hoursFailures: [] as string[], unknownDocs: new Map<string, number>() };
const kiosks: Kiosk[] = [];
let format: string;
let mappingInfo: unknown;
let unknownHeaders: string[] = [];

if (isInstallFile(src.headers)) {
  format = 'localdata';
  let docs: DocsIndex | null = null;
  if (docsPath) {
    const d = await load(docsPath);
    if (!isDocsFile(d.headers)) { console.error('--docs 파일 형식이 다릅니다. 헤더:', d.headers); process.exit(1); }
    docs = indexDocs(d.records);
  } else console.warn('경고: --docs 없이 실행 — 발급 서류는 등기·가족관계 구분만 반영됩니다.');
  let coords = new Map<string, [number, number]>();
  try { coords = new Map(Object.entries(JSON.parse(await readFile(cachePath, 'utf8'))) as [string, [number, number]][]); } catch { /* no cache yet */ }
  src.records.forEach((r, i) => { const k = normalizeLocal(r, docs, i + 2, report, coords); if (k) kiosks.push(k); });
  mappingInfo = { docsFile: !!docs, geocodeCacheEntries: coords.size };
} else {
  format = 'legacy';
  const { mapping, unknown, missingRequired } = mapHeaders(src.headers);
  if (missingRequired.length) { console.error('필수 컬럼을 찾지 못함:', missingRequired, '\n헤더:', src.headers); process.exit(1); }
  src.records.forEach((rec, i) => { const k = normalizeRecord(rec, mapping, i + 2, report); if (k) kiosks.push(k); });
  mappingInfo = mapping; unknownHeaders = unknown;
}

const collisions = dedupeIds(kiosks);
const subGuInferred = inferSubGu(kiosks);
attachNearby(kiosks);
kiosks.sort((a, b) => a.sido.localeCompare(b.sido) || a.sigungu.localeCompare(b.sigungu) || a.name.localeCompare(b.name, 'ko'));

let prev: Kiosk[] = [];
try { prev = JSON.parse(await readFile(out, 'utf8')); } catch { /* first run */ }
const prevIds = new Set(prev.map((k) => k.id));
const nextIds = new Set(kiosks.map((k) => k.id));
const removed = [...prevIds].filter((id) => !nextIds.has(id));
const added = [...nextIds].filter((id) => !prevIds.has(id));
const ratio = prev.length ? removed.length / prev.length : 0;

const byConf = { ok: 0, partial: 0, unknown: 0 };
kiosks.forEach((k) => byConf[k.hoursConfidence]++);
const summary = {
  format, encoding: src.encoding, sourceRows: src.records.length, kept: kiosks.length, idCollisions: collisions, subGuInferred,
  subGuMissing: kiosks.filter((k) => !k.subGu && SUBGU_CITIES.has(`${k.sido}/${k.sigungu}`)).length,
  headers: src.headers, mapping: mappingInfo, unknownHeaders,
  bySido: Object.fromEntries([...Map.groupBy(kiosks, (k) => k.sido)].map(([s, l]) => [s, l.length])),
  hoursConfidence: byConf, hoursParsedRate: kiosks.length ? +((byConf.ok + byConf.partial) / kiosks.length).toFixed(3) : 0,
  withCoords: kiosks.filter((k) => k.lat !== null).length,
  diff: { added: added.length, removed: removed.length, removedRatio: +ratio.toFixed(3) },
  skipsByReason: Object.fromEntries([...Map.groupBy(report.skips, (s) => s.reason)].map(([r, l]) => [r, l.length])),
  hoursFailuresSample: [...new Set(report.hoursFailures)].slice(0, 50),
  unknownDocItems: [...report.unknownDocs].sort((a, b) => b[1] - a[1]).slice(0, 50),
};

await mkdir(dirname(out), { recursive: true });
await writeFile(reportPath, JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ ...summary, headers: undefined, hoursFailuresSample: undefined, unknownDocItems: undefined, skipsByReason: undefined }, null, 2));
console.log('제외 사유:', summary.skipsByReason);

if (ratio > MAX_DELETE_RATIO && !flag('--force')) {
  console.error(`삭제 비율 ${(ratio * 100).toFixed(1)}% > ${MAX_DELETE_RATIO * 100}% — 원천 데이터 이상으로 보고 중단 (--force로 무시)`);
  process.exit(2);
}
const statsPath = out.replace(/kiosks\.json$/, 'region-stats.json');
await writeFile(out, JSON.stringify(kiosks));
await writeFile(statsPath, JSON.stringify(regionStats(kiosks), null, 2));
console.log(`wrote ${kiosks.length} kiosks -> ${out}, stats -> ${statsPath}, report -> ${reportPath}`);
if (removed.length) console.log('삭제된 id (상위 20):', removed.slice(0, 20));
