// 빌라(연립·다세대)·오피스텔 전월세 실거래 API 수집 → 수도권 동별 통계(src/data/rent-stats.json).
// 정부 API는 해외 IP(클라우드)에서 막혀 있어 국내 PC에서 실행한다. 인증키는 주차장과 같은 .env 의 DATA_GO_KR_KEY
//   (공공데이터포털 일반 인증키는 계정 단위라 같은 키를 쓰되, 두 API 각각 '활용신청'이 승인돼 있어야 한다).
//
// 1) 응답 형식 확인(처음 한 번):  npm run fetch-rent -- --sample
//      → 두 API에서 강남구 지난달 5건씩 받아 필드명과 매핑 결과를 보여 주고 scripts/fixtures/out/rent-api-sample.json 저장
// 2) 지역코드 점검(선택):        npm run fetch-rent -- --codes   (코드별 지난달 건수, 0건이면 코드 확인 필요)
// 3) 전체 수집:                 npm run fetch-rent
//      → 최근 13개월 × 수도권 지역코드 × 2종류 호출(약 2,000회, 개발계정 하루 1만 회 안).
//        받은 원본은 .cache/rent/ 에 월별로 저장(커밋 안 함). 다시 실행하면 최근 2개월만 새로 받는다(신고 지연 반영).
//      → 통계만 src/data/rent-stats.json 에 저장(지번·건물명·층·계약일은 저장하지 않음). 확인 후 커밋.
// 옵션: --months 13  --delay 200  --refresh(캐시 무시)  --reprobe(개편 지역 새 코드 다시 찾기)  --force(안전장치 무시)
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { parsePage, redact, type Page } from './lib/parking-api.ts';
import { LAWD, PROBE_RANGES } from './lib/rent-lawd.ts';
import { normalizeDeal, missingFields, aggregate, type Deal, type HouseType } from './lib/rent.ts';

/** 엔드포인트. 오피스텔은 포털 15126475 페이지에서 확인(2026-11-25). 연립다세대(RH)는 같은 규칙으로 추정 → --sample로 확인 */
export const RENT_API: Record<HouseType, string> = {
  villa: 'https://apis.data.go.kr/1613000/RTMSDataSvcRHRent/getRTMSDataSvcRHRent',
  officetel: 'https://apis.data.go.kr/1613000/RTMSDataSvcOffiRent/getRTMSDataSvcOffiRent',
};

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(n);
const opt = (n: string, d: number) => { const i = args.indexOf(n); return i >= 0 ? Number(args[i + 1]) : d; };
const MONTHS = opt('--months', 13), DELAY = opt('--delay', 200), ROWS = 1000;
const CACHE = '.cache/rent', OUT = 'src/data/rent-stats.json', REPORT = 'src/data/rent.report.json', DEBUG_DIR = 'scripts/fixtures/out';
const KEY = (process.env.DATA_GO_KR_KEY ?? '').trim();
// process.exit()는 윈도우에서 fetch 연결이 닫히는 중에 libuv 오류(UV_HANDLE_CLOSING)를 낼 수 있어 쓰지 않는다.
// 중단은 Abort를 던지고 맨 아래 main().catch에서 메시지만 찍은 뒤 exitCode로 끝낸다.
class Abort extends Error {}
const fail = (msg: string): never => { throw new Abort(msg); };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const url = (t: HouseType, code: string, ym: string, page: number, rows: number) => {
  const k = /%[0-9A-Fa-f]{2}/.test(KEY) ? KEY : encodeURIComponent(KEY);
  return `${RENT_API[t]}?serviceKey=${k}&LAWD_CD=${code}&DEAL_YMD=${ym}&pageNo=${page}&numOfRows=${rows}`;
};

async function getPage(t: HouseType, code: string, ym: string, page: number, rows = ROWS): Promise<Page> {
  let last = '';
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url(t, code, ym, page, rows), { signal: AbortSignal.timeout(30_000) });
      const text = await res.text();
      if (res.status >= 500 || res.status === 429) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) fail(`HTTP ${res.status} ${text.slice(0, 200)}`);
      try { return parsePage(text); } catch (e) { fail(`${t} ${code} ${ym}: ${(e as Error).message}`); }
    } catch (e) {
      if (e instanceof Abort) throw e;
      last = (e as Error).message;
      if (attempt < 4) await sleep(2000 * 2 ** (attempt - 1));
    }
  }
  return fail(`${t} ${code} ${ym} ${page}페이지 4번 실패: ${last}`);
}

/** 한 지역·한 달 전체(1,000건 넘으면 페이지 순회) */
async function getMonth(t: HouseType, code: string, ym: string) {
  const first = await getPage(t, code, ym, 1);
  const items = [...first.items];
  for (let p = 2; p <= Math.ceil(first.totalCount / ROWS); p++) { await sleep(DELAY); items.push(...(await getPage(t, code, ym, p)).items); }
  if (items.length !== first.totalCount && !flag('--force')) fail(`${t} ${code} ${ym}: 받은 건수 ${items.length} ≠ 총건수 ${first.totalCount}`);
  return items;
}

const ymList = (n: number) => {
  const d = new Date(); const out: string[] = [];
  for (let i = 0; i < n; i++) { const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1)); out.push(`${x.getUTCFullYear()}${String(x.getUTCMonth() + 1).padStart(2, '0')}`); }
  return out.reverse();
};
const TYPES: HouseType[] = ['villa', 'officetel'];

/** 개편 지역의 새 코드 찾기: PROBE_RANGES 안에서 지난달 거래가 있는 코드. 결과는 .cache/rent/codes.json 에 저장해 다시 쓰고, --reprobe 로 새로 찾는다 */
async function discoverCodes(verbose = false): Promise<string[]> {
  const file = `${CACHE}/codes.json`;
  if (existsSync(file) && !flag('--reprobe') && !verbose) return JSON.parse(await readFile(file, 'utf8'));
  const known = new Set(LAWD.map((l) => l.code));
  const ym = ymList(2)[0];
  const found: string[] = [];
  for (const r of PROBE_RANGES) {
    console.log(`  ${r.label} 새 코드 찾는 중(${r.from}~${r.to})…`);
    for (let c = r.from; c <= r.to; c++) {
      const code = String(c);
      if (known.has(code)) continue;
      const res: { t: HouseType; n: number; dongs: string[] }[] = [];
      for (const t of TYPES) {
        try { const p = await getPage(t, code, ym, 1, 20); res.push({ t, n: p.totalCount, dongs: p.items.map((i) => String(i.umdNm ?? '')) }); }
        catch { res.push({ t, n: 0, dongs: [] }); } // 없는 코드가 오류로 오면 0건으로 본다
        await sleep(DELAY);
      }
      if (res.some((x) => x.n > 0)) {
        found.push(code);
        const dongs = [...new Set(res.flatMap((x) => x.dongs))].filter(Boolean).slice(0, 6).join('·');
        console.log(`  ✓ ${code}: 빌라 ${res[0].n} · 오피스텔 ${res[1].n} (${dongs})`);
      }
    }
  }
  await mkdir(CACHE, { recursive: true });
  await writeFile(file, JSON.stringify(found));
  return found;
}

async function main() {
  if (!KEY) fail('환경변수 DATA_GO_KR_KEY 가 없어요. .env 파일에 DATA_GO_KR_KEY=인증키 를 넣고 다시 실행하세요.');
  await mkdir(DEBUG_DIR, { recursive: true });

  /** 예시 파일은 깃허브에 올려도 되게 지번·건물명·층·일자 값을 가린다(필드명은 그대로 남김) */
  const SENSITIVE = /jibun|지번|bonbun|bubun|roadnm|도로명|^(mhouseNm|offiNm|aptNm|연립다세대|단지|단지명)$|floor|층|dealDay|^일$/i;
  const mask = (it: Record<string, unknown>) => Object.fromEntries(Object.entries(it).map(([k, v]) => [k, SENSITIVE.test(k) && v !== '' ? '(가림)' : v]));

  if (flag('--sample')) {
    const ym = ymList(2)[0];
    const out: Record<string, unknown> = {};
    for (const t of TYPES) {
      const p = await getPage(t, '11680', ym, 1, 5);
      const keys = p.items[0] ? Object.keys(p.items[0]) : [];
      console.log(`\n[${t}] 강남구 ${ym} 총 ${p.totalCount}건 · 응답 필드: ${keys.join(', ') || '(항목 없음)'}`);
      if (p.items[0]) console.log(`  필수 필드 매핑 실패: ${missingFields(p.items[0]).join(', ') || '없음'}`);
      out[t] = { totalCount: p.totalCount, fields: keys, items: p.items.map(mask) };
    }
    await writeFile(`${DEBUG_DIR}/rent-api-sample.json`, JSON.stringify(out, null, 1));
    console.log(`\n예시 저장: ${DEBUG_DIR}/rent-api-sample.json (지번·건물명·층·일자는 가려져 있어요. 이 파일을 깃허브에 올려 주면 매핑을 확정할게요)`);
    return;
  }

  if (flag('--codes')) {
    const ym = ymList(2)[0];
    for (const l of LAWD) {
      const n = await Promise.all(TYPES.map(async (t) => (await getPage(t, l.code, ym, 1, 1)).totalCount));
      console.log(`${l.code} ${l.city}${l.gu ? ` ${l.gu}` : ''}: 빌라 ${n[0]} · 오피스텔 ${n[1]}${n[0] + n[1] === 0 ? '  ← 0건: 코드 확인' : ''}${l.verify ? `  (확인: ${l.verify})` : ''}`);
      await sleep(DELAY);
    }
    console.log('\n개편 지역 새 코드 찾기:');
    const found = await discoverCodes(true);
    console.log(`→ 새 코드 ${found.length}개: ${found.join(', ') || '없음'}. 이 화면 아래쪽을 복사해 보내 주세요.`);
    return;
  }

  // 전체 수집(월별 캐시)
  await mkdir(CACHE, { recursive: true });
  const months = ymList(MONTHS);
  const fresh = new Set(months.slice(-2));
  const deals: Deal[] = [];
  let calls = 0, bad = 0, raw = 0;
  const extra = await discoverCodes();
  const codes = [...LAWD.map((l) => l.code), ...extra];
  console.log(`지역코드 ${codes.length}개(개편 지역 새 코드 ${extra.length}개 포함) × ${months.length}개월 × 2종류`);
  for (const t of TYPES) for (const code of codes) for (const ym of months) {
    const l = { code };
    const file = `${CACHE}/${t}-${l.code}-${ym}.json`;
    let items: Record<string, unknown>[];
    if (existsSync(file) && !fresh.has(ym) && !flag('--refresh')) items = JSON.parse(await readFile(file, 'utf8'));
    else { items = await getMonth(t, l.code, ym); calls++; await writeFile(file, JSON.stringify(items)); await sleep(DELAY); }
    if (items[0] && missingFields(items[0]).length) fail(`필수 필드를 찾지 못했어요(${t}): ${missingFields(items[0]).join(', ')}. --sample 결과를 전달해 주세요.`);
    for (const it of items) { raw++; const d = normalizeDeal(it, t, l.code); if (d) deals.push(d); else bad++; }
    process.stdout.write(`\r  ${t} ${l.code} ${ym} · 누적 ${raw.toLocaleString('ko-KR')}건 · 새 호출 ${calls}`);
  }
  console.log('');
  if (bad / Math.max(raw, 1) > 0.05 && !flag('--force')) fail(`정규화 실패 ${bad}건(${((bad / raw) * 100).toFixed(1)}%)`);

  const { stats, unknown } = aggregate(deals, { months: 12 });
  if (existsSync(OUT) && !flag('--force')) {
    const prev = JSON.parse(await readFile(OUT, 'utf8'));
    const n = (s: typeof stats) => s.areas.filter((a) => a.dong === null).reduce((x, a) => x + a.n, 0);
    if (n(prev) && n(stats) < n(prev) * 0.8) fail(`총 거래가 ${n(prev)} → ${n(stats)}로 20% 넘게 줄었어요. 확인 후 --force`);
  }
  const report = {
    fetchedAt: stats.generatedAt, period: [stats.from, stats.to], rawItems: raw, normalized: deals.length, dropped: bad, unknownRegion: unknown, discoveredCodes: extra,
    bySigungu: Object.fromEntries(stats.areas.filter((a) => a.dong === null).map((a) => [`${a.sido}/${a.sigunguName}`, a.n])),
    byType: Object.fromEntries(TYPES.map((t) => [t, deals.filter((d) => d.type === t).length])),
    sigungu: stats.areas.filter((a) => a.dong === null).length, dongs: stats.areas.filter((a) => a.dong !== null).length,
    dongsOver10: stats.areas.filter((a) => a.dong !== null && a.n >= 10).length, dongsOver30: stats.areas.filter((a) => a.dong !== null && a.n >= 30).length,
  };
  await writeFile(OUT, JSON.stringify(stats));
  await writeFile(REPORT, JSON.stringify(report, null, 1));
  console.log(`\n✓ ${stats.from}~${stats.to} 거래 ${deals.length.toLocaleString('ko-KR')}건 → 시·군·구 ${report.sigungu}곳, 동 ${report.dongs}곳(10건+ ${report.dongsOver10}, 30건+ ${report.dongsOver30})`);
  console.log(`  요약: ${REPORT} (이 파일을 전달해 주면 페이지 기준을 확정할게요)`);
}

main().catch((e) => {
  console.error(e instanceof Abort ? `\n✗ 중단: ${redact(e.message, KEY)}\n  (기존 ${OUT} 는 그대로예요)` : e);
  process.exitCode = 1;
});
