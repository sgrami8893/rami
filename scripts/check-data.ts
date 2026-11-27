// 자동 갱신 이상치 검사(2026-11-27). 새로 받은 src/data 파일을 지난번 커밋(HEAD)과 비교해
// 건수가 갑자기 줄거나 기간이 뒤로 가는 등 이상하면 실패(exit 1)해서 배포를 막는다.
//   npm run check-data                 # 결과를 화면에 표로
//   npm run check-data -- --out f.md   # 같은 내용을 파일로도(GitHub Actions 요약·알림 이슈용)
// 기준은 아래 LIMITS 한 곳. 일부러 크게 바뀐 경우(지역 개편 등)는 PC에서 확인 후 직접 올리면 된다.
import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

export const LIMITS = {
  rentTotalDrop: 0.15, // 동 통계 전체 거래 15% 넘게 감소
  rentSggDrop: 0.5, rentSggMin: 300, // 거래 300건 이상이던 시·군·구가 절반 넘게 감소
  buildingsDrop: 0.15, // 건물 수 15% 넘게 감소
  locatedMin: 0.8, locatedWarn: 0.95, // 좌표 있는 건물 비율
  parkingDrop: 0.1, parkingSidoDrop: 0.25,
  fileMaxMB: 95, // GitHub 파일 한도 100MB
};

const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const errors: string[] = [], warns: string[] = [], rows: string[] = [];
const pct = (a: number, b: number) => (b ? `${(((a - b) / b) * 100).toFixed(1)}%` : '-');
const fmt = (n: number) => n.toLocaleString('ko-KR');

function headJson<T>(path: string): T | null {
  try { return JSON.parse(execFileSync('git', ['show', `HEAD:${path}`], { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 })); } catch { return null; }
}
async function curJson<T>(path: string): Promise<T | null> {
  if (!existsSync(path)) return null;
  try { return JSON.parse(await readFile(path, 'utf8')); } catch (e) { errors.push(`${path} JSON이 깨졌어요: ${(e as Error).message}`); return null; }
}
const row = (name: string, before: number, after: number) => rows.push(`| ${name} | ${fmt(before)} | ${fmt(after)} | ${pct(after, before)} |`);

// ---- 전월세 동 통계 ----
type Area = { sido: string; sigunguName: string; dong: string | null; n: number };
type Stats = { from: string; to: string; areas: Area[] };
const s0 = headJson<Stats>('src/data/rent-stats.json'), s1 = await curJson<Stats>('src/data/rent-stats.json');
if (s1) {
  const sgg = (s: Stats) => new Map(s.areas.filter((a) => a.dong === null).map((a) => [`${a.sido}/${a.sigunguName}`, a.n]));
  const tot = (s: Stats) => [...sgg(s).values()].reduce((x, y) => x + y, 0);
  if (s0) {
    row(`전월세 거래(${s0.from}~${s0.to} → ${s1.from}~${s1.to})`, tot(s0), tot(s1));
    if (s1.to < s0.to) errors.push(`전월세 기간 끝이 ${s0.to} → ${s1.to}로 뒤로 갔어요`);
    if (tot(s1) < tot(s0) * (1 - LIMITS.rentTotalDrop)) errors.push(`전월세 거래가 ${fmt(tot(s0))} → ${fmt(tot(s1))}건으로 ${LIMITS.rentTotalDrop * 100}% 넘게 줄었어요`);
    const a = sgg(s0), b = sgg(s1);
    for (const [k, n] of a) {
      const m = b.get(k) ?? 0;
      if (n >= LIMITS.rentSggMin && m < n * (1 - LIMITS.rentSggDrop)) errors.push(`${k} 거래가 ${fmt(n)} → ${fmt(m)}건으로 절반 넘게 줄었어요`);
    }
    row('전월세 동 수', s0.areas.length - a.size, s1.areas.length - b.size);
  }
}

// ---- 건물별 이력(보고서 기준) ----
type Report = { buildings?: { buildings: number; located: number; deals: number }; byType?: Record<string, number> };
const r0 = headJson<Report>('src/data/rent.report.json'), r1 = await curJson<Report>('src/data/rent.report.json');
if (r1?.buildings) {
  const b1 = r1.buildings, ratio = b1.located / Math.max(b1.buildings, 1);
  if (r0?.buildings) {
    row('건물 수', r0.buildings.buildings, b1.buildings);
    row('좌표 있는 건물', r0.buildings.located, b1.located);
    if (b1.buildings < r0.buildings.buildings * (1 - LIMITS.buildingsDrop)) errors.push(`건물 수가 ${fmt(r0.buildings.buildings)} → ${fmt(b1.buildings)}로 크게 줄었어요`);
    for (const [t, n] of Object.entries(r0.byType ?? {})) if (n > 1000 && !(r1.byType?.[t])) errors.push(`${t} 거래가 사라졌어요(${fmt(n)} → 0)`);
  }
  if (ratio < LIMITS.locatedMin) errors.push(`좌표 있는 건물이 ${(ratio * 100).toFixed(1)}%뿐이에요`);
  else if (ratio < LIMITS.locatedWarn) warns.push(`좌표 있는 건물이 ${(ratio * 100).toFixed(1)}%로 줄었어요. 시간 날 때 PC에서 npm run fetch-rent 로 새 건물 좌표를 채워 주세요`);
}
const bdir = 'src/data/rent-buildings';
if (existsSync(bdir)) for (const f of await readdir(bdir)) {
  const mb = (await stat(`${bdir}/${f}`)).size / 1024 / 1024;
  if (mb > LIMITS.fileMaxMB) errors.push(`${bdir}/${f}가 ${mb.toFixed(1)}MB라 GitHub 한도(100MB)에 가까워요`);
  if (/\.json$/.test(f)) await curJson(`${bdir}/${f}`);
}

// ---- 주차장 ----
type Lot = { sido: string };
const p0 = headJson<Lot[]>('src/data/parking.json'), p1 = await curJson<Lot[]>('src/data/parking.json');
if (p1 && p0) {
  row('공영주차장', p0.length, p1.length);
  if (p1.length < p0.length * (1 - LIMITS.parkingDrop)) errors.push(`주차장이 ${fmt(p0.length)} → ${fmt(p1.length)}곳으로 크게 줄었어요`);
  const by = (xs: Lot[]) => xs.reduce((m, l) => m.set(l.sido, (m.get(l.sido) ?? 0) + 1), new Map<string, number>());
  const a = by(p0), b = by(p1);
  for (const [k, n] of a) if (n >= 100 && (b.get(k) ?? 0) < n * (1 - LIMITS.parkingSidoDrop)) errors.push(`${k} 주차장이 ${fmt(n)} → ${fmt(b.get(k) ?? 0)}곳으로 크게 줄었어요`);
}

const md = [
  errors.length ? '### ✗ 이상치가 있어 배포하지 않았어요' : '### ✓ 데이터 검사 통과',
  '', '| 항목 | 이전 | 새로 | 변화 |', '|---|---:|---:|---:|', ...rows, '',
  ...errors.map((e) => `- ✗ ${e}`), ...warns.map((w) => `- ⚠ ${w}`),
].join('\n');
console.log(md);
if (outIdx >= 0) await writeFile(args[outIdx + 1], md + '\n');
if (errors.length) process.exitCode = 1;
