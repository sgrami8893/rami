// 공영주차장(전국주차장정보표준데이터) API 수집 → 수도권만 정규화해 src/data/parking.json 저장.
// 정부 API는 해외 IP(클라우드)에서 막혀 있어서 국내 PC에서 실행한다.
//
// 준비(한 번만): 저장소 폴더에 .env 파일을 만들고 한 줄 넣기(.env는 .gitignore에 있어 커밋되지 않음)
//     DATA_GO_KR_KEY=포털의_일반_인증키
//
// 1) 응답 형식 확인(처음 한 번):  npm run fetch-parking -- --sample
//      → 응답 필드명과 매핑 결과를 보여 주고 scripts/fixtures/out/parking-api-sample.json 에 5건 저장
// 2) 전체 수집:                 npm run fetch-parking
//      → src/data/parking.json, src/data/parking.report.json 생성. 확인 후 git commit && git push
// 옵션: --rows 1000(페이지당 건수)  --force(건수 급감·합계 불일치 안전장치 무시)  --delay 300(호출 간격 ms)
//
// 멈추는 경우(데이터를 덮어쓰지 않음): 인증키 없음·오류, 필수 필드 매핑 실패, 총건수와 받은 건수 불일치,
//   필수값(이름·주소) 빠진 행 5% 초과, 이전보다 수도권 건수 10% 넘게 감소.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { buildUrl, parsePage, resolveMapping, toRow, redact, type Page } from './lib/parking-api.ts';
import { normalizeParking, type ParkingLot } from './lib/parking.ts';

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(n);
const opt = (n: string, d: number) => { const i = args.indexOf(n); return i >= 0 ? Number(args[i + 1]) : d; };
const SAMPLE = flag('--sample'), FORCE = flag('--force');
const ROWS = opt('--rows', 1000), DELAY = opt('--delay', 300);
const OUT = 'src/data/parking.json', REPORT = 'src/data/parking.report.json', DEBUG_DIR = 'scripts/fixtures/out';
const MAX_DROP = 0.1, MAX_BAD_ROWS = 0.05;

const KEY = (process.env.DATA_GO_KR_KEY ?? '').trim();
const fail = (msg: string): never => { console.error(`\n✗ 중단: ${redact(msg, KEY)}\n  (기존 ${OUT} 는 그대로예요)`); process.exit(1); };
if (!KEY) fail('환경변수 DATA_GO_KR_KEY 가 없어요. 저장소 폴더의 .env 파일에 DATA_GO_KR_KEY=인증키 를 넣고 npm run fetch-parking 으로 실행하세요.');

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 한 페이지 요청. 네트워크·5xx는 3번까지 다시 시도, API 오류(인증 등)는 바로 중단. */
async function getPage(pageNo: number, rows: number): Promise<Page> {
  let last = '';
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(buildUrl(KEY, pageNo, rows), { signal: AbortSignal.timeout(30_000), headers: { Accept: 'application/json' } });
      const text = await res.text();
      if (res.status >= 500 || res.status === 429) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) fail(`HTTP ${res.status} ${text.slice(0, 200)}`);
      try { return parsePage(text); } catch (e) { fail(`${pageNo}페이지: ${(e as Error).message}`); }
    } catch (e) {
      last = (e as Error).message;
      if (attempt < 4) { const wait = 2000 * 2 ** (attempt - 1); console.warn(`  ${pageNo}페이지 실패(${redact(last, KEY)}), ${wait / 1000}초 뒤 다시 시도`); await sleep(wait); }
    }
  }
  return fail(`${pageNo}페이지를 4번 시도했지만 실패: ${last}`);
}

await mkdir(DEBUG_DIR, { recursive: true });

if (SAMPLE) {
  const p = await getPage(1, 5);
  if (!p.items.length) fail('응답에 항목이 없어요');
  const m = resolveMapping(Object.keys(p.items[0]));
  console.log(`총 ${p.totalCount.toLocaleString('ko-KR')}건, 필드 ${Object.keys(p.items[0]).length}개 (${m.mode === 'korean' ? '한글' : '영문'} 필드명)`);
  console.log('응답 필드명:', Object.keys(p.items[0]).join(', '));
  console.log('필수 필드 매핑 실패:', m.missingRequired.length ? m.missingRequired.join(', ') : '없음');
  console.log('선택 필드 매핑 실패:', m.missingOptional.length ? m.missingOptional.join(', ') : '없음');
  console.log('매핑 안 된 응답 필드:', m.unknownKeys.length ? m.unknownKeys.join(', ') : '없음');
  await writeFile(`${DEBUG_DIR}/parking-api-sample.json`, JSON.stringify({ totalCount: p.totalCount, mapping: m, items: p.items }, null, 1));
  console.log(`\n예시 5건 저장: ${DEBUG_DIR}/parking-api-sample.json (이 파일 내용을 그대로 전달해 주면 매핑을 확정할게요)`);
  process.exit(0);
}

// 1) 전체 페이지 순회
const first = await getPage(1, ROWS);
const total = first.totalCount;
if (!total || !first.items.length) fail('총건수가 0이에요');
const pages = Math.ceil(total / ROWS);
console.log(`총 ${total.toLocaleString('ko-KR')}건, ${pages}페이지 수집 시작(페이지당 ${ROWS}건)`);
const items = [...first.items];
for (let n = 2; n <= pages; n++) {
  await sleep(DELAY);
  const p = await getPage(n, ROWS);
  items.push(...p.items);
  process.stdout.write(`\r  ${n}/${pages}페이지, ${items.length.toLocaleString('ko-KR')}건`);
}
console.log('');
if (items.length !== total && !FORCE) fail(`받은 건수(${items.length})가 총건수(${total})와 달라요. 다시 실행하거나 --force`);

// 2) 필드 매핑 검증
const keys = [...new Set(items.slice(0, 200).flatMap((i) => Object.keys(i)))];
const m = resolveMapping(keys);
if (m.missingRequired.length) fail(`필수 필드를 찾지 못했어요: ${m.missingRequired.join(', ')}. --sample 결과를 전달해 매핑을 고쳐야 해요.`);

// 3) 정규화(수도권만 남음: 지역 표가 수도권만 있어서 다른 지역은 null)
const rows = items.map((i) => toRow(i, m.map));
const bad = rows.filter((r) => !r['주차장명'] || !(r['소재지도로명주소'] || r['소재지지번주소'])).length;
if (bad / rows.length > MAX_BAD_ROWS && !FORCE) fail(`이름·주소가 빠진 행이 ${bad}건(${((bad / rows.length) * 100).toFixed(1)}%)이에요`);
const lots: ParkingLot[] = [];
const seen = new Map<string, number>();
for (const r of rows) {
  const l = normalizeParking(r);
  if (!l) continue;
  const c = seen.get(l.id) ?? 0; seen.set(l.id, c + 1);
  if (c) l.id = `${l.id}-${c + 1}`; // 같은 관리번호 중복은 뒤에 번호를 붙여 구분
  lots.push(l);
}
if (!lots.length) fail('수도권 주차장이 0곳이에요. 주소 필드 매핑을 확인하세요.');

// 4) 이전 데이터와 비교(급감 방지)
if (existsSync(OUT)) {
  const prev = JSON.parse(await readFile(OUT, 'utf8')) as ParkingLot[];
  if (prev.length && lots.length < prev.length * (1 - MAX_DROP) && !FORCE) fail(`수도권 건수가 ${prev.length} → ${lots.length}로 ${MAX_DROP * 100}% 넘게 줄었어요. 확인 후 --force`);
}

// 5) 저장
const count = <T extends string>(xs: T[]) => xs.reduce((a, x) => ((a[x] = (a[x] ?? 0) + 1), a), {} as Record<string, number>);
const report = {
  fetchedAt: new Date().toISOString(), nationalTotal: total, capitalArea: lots.length,
  bySido: count(lots.map((l) => l.sido)), feeType: count(lots.map((l) => l.fee.type)), kind: count(lots.map((l) => l.kind)),
  noCoord: lots.filter((l) => l.lat === null).length, flags: count(lots.flatMap((l) => l.flags)),
  baseDate: { min: lots.map((l) => l.baseDate).filter(Boolean).sort()[0] ?? null, max: lots.map((l) => l.baseDate).filter(Boolean).sort().at(-1) ?? null },
  duplicateIds: [...seen.values()].filter((v) => v > 1).length,
  mapping: { mode: m.mode, missingOptional: m.missingOptional, unknownKeys: m.unknownKeys },
};
await writeFile(OUT, JSON.stringify(lots));
await writeFile(REPORT, JSON.stringify(report, null, 1));
console.log(`\n✓ 전국 ${total.toLocaleString('ko-KR')}건 중 수도권 ${lots.length.toLocaleString('ko-KR')}곳 저장: ${OUT}`);
console.log(`  시·도별 ${JSON.stringify(report.bySido)} · 요금 ${JSON.stringify(report.feeType)} · 좌표 없음 ${report.noCoord}`);
console.log(`  요약: ${REPORT} (git diff로 확인 후 커밋)`);
