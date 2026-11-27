// 빌라(연립·다세대)·오피스텔 전월세 실거래 API 수집 → 수도권 동별 통계(src/data/rent-stats.json).
// 정부 API는 해외 IP(클라우드)에서 막혀 있어 국내 PC에서 실행한다. 인증키는 주차장과 같은 .env 의 DATA_GO_KR_KEY
//   (공공데이터포털 일반 인증키는 계정 단위라 같은 키를 쓰되, 두 API 각각 '활용신청'이 승인돼 있어야 한다).
//
// 1) 응답 형식 확인(처음 한 번):  npm run fetch-rent -- --sample
//      → 두 API에서 강남구 지난달 5건씩 받아 필드명과 매핑 결과를 보여 주고 scripts/fixtures/out/rent-api-sample.json 저장
// 2) 지역코드 점검(선택):        npm run fetch-rent -- --codes   (코드별 지난달 건수, 0건이면 코드 확인 필요)
// 3) 전체 수집:                 npm run fetch-rent
//      → 최근 37개월 × 수도권 지역코드 × 2종류 호출(처음 약 6,000회, API별로 나뉘어 개발계정 하루 1만 회 안).
//        받은 원본은 .cache/rent/ 에 월별로 저장(커밋 안 함). 다시 실행하면 최근 2개월만 새로 받는다(신고 지연 반영).
//      → 동 통계(최근 12개월): src/data/rent-stats.json
//      → 건물별 이력(최근 36개월, 2026-11-26): src/data/rent-buildings/{seoul,gyeonggi,incheon}.json
//         지번·건물명·계약 연월·금액·면적만. 층·계약일(일)은 저장하지 않는다.
//         건물 좌표는 .cache/juso/ 에 풀어 둔 주소정보 '내비게이션용DB'(.txt)에서 찾는다(없으면 좌표 없이 목록만).
// 4) 주소 파일 점검(선택):       npm run fetch-rent -- --geo-check   (.cache/juso/ 첫 줄들을 어떻게 읽었는지 보여 줌)
// 옵션: --months 37  --delay 200  --refresh(캐시 무시)  --reprobe(개편 지역 새 코드 다시 찾기)  --force(안전장치 무시)
//       --fresh 3(최근 몇 개월을 새로 받을지, 기본 2. 자동 갱신은 신고 기한 30일을 넉넉히 덮도록 3)
//       --apt-auto(아파트 API를 한 번 시험해 활용신청이 승인돼 있으면 --apt처럼 아파트도 받음. 자동 갱신용)
// 자동 갱신(.github/workflows/data-refresh.yml): GitHub Actions가 매주 이 스크립트를 --fresh 3 --apt-auto 로 돌린다.
//   주소정보 DB가 없으므로 건물 좌표는 지난번 src/data/rent-buildings/ 파일에서 이어받는다(새 건물만 좌표 없음).
//   캐시(.cache/rent)에는 RENT_FIELD 필드만 남긴다(층·계약일 없음).
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { parsePage, redact, type Page } from './lib/parking-api.ts';
import { LAWD, PROBE_RANGES } from './lib/rent-lawd.ts';
import { normalizeDeal, missingFields, aggregate, slimItem, type Deal, type HouseType } from './lib/rent.ts';
import { buildBuildings, neededPlaces, prevCoords, BUILDING_MONTHS, type BuildingFile } from './lib/rent-buildings.ts';
import { loadJusoGeo, parseJusoLine, utmkToWgs84 } from './lib/juso-geo.ts';

/** 엔드포인트. 오피스텔은 포털 15126475 페이지에서 확인(2026-11-25). 연립다세대(RH)는 같은 규칙으로 추정 → --sample로 확인 */
export const RENT_API: Record<HouseType, string> = {
  villa: 'https://apis.data.go.kr/1613000/RTMSDataSvcRHRent/getRTMSDataSvcRHRent',
  officetel: 'https://apis.data.go.kr/1613000/RTMSDataSvcOffiRent/getRTMSDataSvcOffiRent',
  // 아파트 전월세(데이터 15126474, --apt 일 때만). 같은 DATA_GO_KR_KEY로 '활용신청'이 따로 승인돼 있어야 한다
  apt: 'https://apis.data.go.kr/1613000/RTMSDataSvcAptRent/getRTMSDataSvcAptRent',
};

const args = process.argv.slice(2);
const flag = (n: string) => args.includes(n);
const opt = (n: string, d: number) => { const i = args.indexOf(n); return i >= 0 ? Number(args[i + 1]) : d; };
const MONTHS = opt('--months', BUILDING_MONTHS + 1), DELAY = opt('--delay', 200), ROWS = 1000, FRESH = Math.max(1, opt('--fresh', 2));
const CACHE = '.cache/rent', JUSO = '.cache/juso', BOUT = 'src/data/rent-buildings', OUT = 'src/data/rent-stats.json', REPORT = 'src/data/rent.report.json', DEBUG_DIR = 'scripts/fixtures/out';
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
// --apt: 아파트 전월세도 받아 건물별 이력에 넣는다(동 통계에는 안 넣음). 호출 수가 약 1.5배가 된다
const TYPES: HouseType[] = ['villa', 'officetel', ...(process.argv.includes('--apt') ? ['apt' as HouseType] : [])];

/** 개편 지역의 새 코드 찾기: PROBE_RANGES 안에서 지난달 거래가 있는 코드. 결과는 .cache/rent/codes.json 에 저장해 다시 쓰고, --reprobe 로 새로 찾는다 */
async function discoverCodes(verbose = false): Promise<string[]> {
  const file = `${CACHE}/codes.json`;
  if (existsSync(file) && !flag('--reprobe') && !verbose) return JSON.parse(await readFile(file, 'utf8'));
  // 캐시가 없으면(자동 갱신 첫 실행) 지난번 요약 파일에 남은 코드를 쓴다
  if (!flag('--reprobe') && !verbose && existsSync(REPORT)) {
    const prev = JSON.parse(await readFile(REPORT, 'utf8')).discoveredCodes;
    if (Array.isArray(prev) && prev.length) { await mkdir(CACHE, { recursive: true }); await writeFile(file, JSON.stringify(prev)); return prev; }
  }
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

  if (flag('--geo-check')) {
    const { readdir, readFile: rf } = await import('node:fs/promises');
    const files = (await readdir(JUSO, { recursive: true }).catch(() => [] as string[])).filter((f) => /\.txt$/i.test(String(f)));
    if (!files.length) fail(`${JUSO} 폴더에 .txt 파일이 없어요. 주소정보 내비게이션용DB 압축을 이 폴더에 풀어 주세요.`);
    // 종류별(match_build·match_jibun·그 밖) 서울 파일을 먼저 보여 준다
    const pickF = [...new Set([...files.filter((f) => /seoul/i.test(String(f))), ...files])].slice(0, 6);
    for (const f of pickF) {
      const buf = await rf(`${JUSO}/${f}`);
      let text: string; try { text = new TextDecoder('utf-8', { fatal: true }).decode(buf.subarray(0, 200_000)); } catch { text = new TextDecoder('euc-kr').decode(buf.subarray(0, 200_000)); }
      const lines = text.split(/\r?\n/).slice(0, 400);
      const ok = lines.map(parseJusoLine).filter(Boolean);
      console.log(`\n[${f}] 앞 ${lines.length}줄 중 읽음 ${ok.length}줄, 좌표 있음 ${ok.filter((r) => r!.xy).length}줄`);
      // 형식 확인용: 첫 줄 원문(공개 주소 자료) 앞부분과 칸 수
      console.log(`  첫 줄(${(lines[0] ?? '').split('|').length}칸): ${(lines[0] ?? '').slice(0, 240)}`);
      for (const r of ok.slice(0, 2)) console.log(`  ${r!.code5} ${r!.dong} ${r!.jibun ?? '(지번 없음)'} ${r!.road ?? ''}${r!.xy ? ` → ${utmkToWgs84(...r!.xy).map((v) => v.toFixed(5)).join(', ')}` : ' (좌표 없음)'}`);
    }
    console.log('\n이 화면을 복사해 보내 주면 확인할게요.');
    return;
  }

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
  if (flag('--apt-auto') && !TYPES.includes('apt')) {
    try { await getPage('apt', '11680', ymList(2)[0], 1, 1); TYPES.push('apt'); console.log('아파트 API 사용 가능 → 아파트도 받아요'); }
    catch (e) { console.log(`아파트 API는 건너뛰어요(활용신청 전이거나 오류): ${redact((e as Error).message, KEY).slice(0, 120)}`); }
  }
  const months = ymList(MONTHS);
  const fresh = new Set(months.slice(-FRESH));
  const deals: Deal[] = [];
  let calls = 0, bad = 0, raw = 0;
  const extra = await discoverCodes();
  const codes = [...LAWD.map((l) => l.code), ...extra];
  console.log(`지역코드 ${codes.length}개(개편 지역 새 코드 ${extra.length}개 포함) × ${months.length}개월 × ${TYPES.length}종류`);
  for (const t of TYPES) for (const code of codes) for (const ym of months) {
    const l = { code };
    const file = `${CACHE}/${t}-${l.code}-${ym}.json`;
    let items: Record<string, unknown>[];
    if (existsSync(file) && !fresh.has(ym) && !flag('--refresh')) items = JSON.parse(await readFile(file, 'utf8'));
    else { items = (await getMonth(t, l.code, ym)).map(slimItem); calls++; await writeFile(file, JSON.stringify(items)); await sleep(DELAY); }
    if (items[0] && missingFields(items[0]).length) fail(`필수 필드를 찾지 못했어요(${t}): ${missingFields(items[0]).join(', ')}. --sample 결과를 전달해 주세요.`);
    for (const it of items) { raw++; const d = normalizeDeal(it, t, l.code); if (d) deals.push(d); else bad++; }
    process.stdout.write(`\r  ${t} ${l.code} ${ym} · 누적 ${raw.toLocaleString('ko-KR')}건 · 새 호출 ${calls}`);
  }
  console.log('');
  if (bad / Math.max(raw, 1) > 0.05 && !flag('--force')) fail(`정규화 실패 ${bad}건(${((bad / raw) * 100).toFixed(1)}%)`);

  // 동 통계(빌라·오피스텔 중위값)는 아파트를 빼고 만든다
  const { stats, unknown } = aggregate(deals.filter((d) => d.type !== 'apt'), { months: 12 });
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
  // ---- 건물별 이력 ----
  const need = neededPlaces(deals);
  console.log(`\n건물 위치 찾는 중: 지번 ${need.size.toLocaleString('ko-KR')}곳 (${JUSO}/)`);
  const geo = await loadJusoGeo(JUSO, need, (s) => console.log(s));
  // 지난번 건물 파일 좌표(주소 DB가 없을 때·DB에서 못 찾은 지번의 대체). 아래에서 예전 파일을 지우기 전에 읽는다
  const { readdir: rd, unlink } = await import('node:fs/promises');
  const prevFiles: BuildingFile[] = [];
  for (const f of await rd(BOUT).catch(() => [] as string[])) if (/\.json$/.test(f)) { try { prevFiles.push(JSON.parse(await readFile(`${BOUT}/${f}`, 'utf8'))); } catch { /* 깨진 파일은 무시 */ } }
  const prev = prevCoords(prevFiles);
  if (!geo.files.length) console.log(`  ${JUSO}/ 에 주소 파일이 없어 지난번 건물 파일 좌표 ${prev.size.toLocaleString('ko-KR')}곳을 이어받아요(새 건물은 좌표 없이 목록만).`);
  let fromPrev = 0;
  const bld = buildBuildings(deals, (c, d, j) => { const a = geo.lookup(c, d, j); if (a) return a; const b = prev.lookup(c, d, j); if (b) fromPrev++; return b; });
  await mkdir(BOUT, { recursive: true });
  const bsizes: Record<string, number> = {};
  // 깃허브 웹 업로드 한도(파일당 25MB): 22MB를 넘으면 시·군·구 단위로 나눠 seoul-1.json, seoul-2.json … 으로 쓴다(2026-11-27, 아파트 포함 대비).
  // 사이트는 rent-buildings/*.json 을 모두 읽어 sido 값으로 합치므로 이름은 상관없다. 예전 파일은 지운다.
  for (const old of await rd(BOUT).catch(() => [] as string[])) if (/\.json$/.test(old)) await unlink(`${BOUT}/${old}`);
  const LIMIT = 22 * 1024 * 1024;
  for (const f of bld.files) {
    const whole = JSON.stringify(f);
    bsizes[f.sido] = Math.round(whole.length / 1024);
    if (whole.length <= LIMIT) { await writeFile(`${BOUT}/${f.sido}.json`, whole); continue; }
    const bySgg = new Map<string, typeof f.b>();
    for (const r of f.b) bySgg.set(r[0], [...(bySgg.get(r[0]) ?? []), r]);
    const parts: (typeof f.b)[] = [[]]; let size = 0;
    for (const rows of bySgg.values()) {
      const n = JSON.stringify(rows).length;
      if (size + n > LIMIT && parts.at(-1)!.length) { parts.push([]); size = 0; }
      parts.at(-1)!.push(...rows); size += n;
    }
    for (const [i, b] of parts.entries()) await writeFile(`${BOUT}/${f.sido}-${i + 1}.json`, JSON.stringify({ ...f, b }));
    console.log(`  ${f.sido}: ${Math.round(whole.length / 1024 / 1024)}MB라 ${parts.length}개 파일로 나눴어요(${f.sido}-1.json …). 모두 올려 주세요.`);
  }
  const bReport = { period: [bld.from, bld.to], buildings: bld.buildings, located: bld.located, deals: bld.deals, noJibun: bld.noJibun, jusoFiles: geo.files.length, jusoRows: geo.rows, coordLookupsFromPrevious: fromPrev, fileKB: bsizes };

  await writeFile(OUT, JSON.stringify(stats));
  await writeFile(REPORT, JSON.stringify({ ...report, buildings: bReport }, null, 1));
  console.log(`✓ 건물 ${bld.buildings.toLocaleString('ko-KR')}곳(좌표 ${bld.located.toLocaleString('ko-KR')}곳) · ${bld.from}~${bld.to} 거래 ${bld.deals.toLocaleString('ko-KR')}건 → ${BOUT}/ (${Object.entries(bsizes).map(([k, v]) => `${k} ${Math.round(v / 1024 * 10) / 10}MB`).join(', ')})`);
  console.log(`\n✓ ${stats.from}~${stats.to} 거래 ${deals.length.toLocaleString('ko-KR')}건 → 시·군·구 ${report.sigungu}곳, 동 ${report.dongs}곳(10건+ ${report.dongsOver10}, 30건+ ${report.dongsOver30})`);
  console.log(`  요약: ${REPORT} (이 파일을 전달해 주면 페이지 기준을 확정할게요)`);
}

main().catch((e) => {
  console.error(e instanceof Abort ? `\n✗ 중단: ${redact(e.message, KEY)}\n  (기존 ${OUT} 는 그대로예요)` : e);
  process.exitCode = 1;
});
