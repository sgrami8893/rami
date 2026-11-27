// 건물별 전월세 이력(2026-11-26). 원본 src/data/rent-buildings/{sido}.json(PC에서 npm run fetch-rent)을
// 빌드 때 시·군·구별 정적 JSON(/geo/rent-b/{sido}__{slug}.json)으로 나눈다. 건물마다 페이지를 만들지 않는다(Pages 파일 한도).
// 표시 원칙: 사실(계약 연월·금액·면적)만. 층·계약일(일) 없음. 위험·안전 판정 없음.
import type { BuildingFile, BuildingRow } from '../../scripts/lib/rent-buildings.ts';
import { RENT_PREVIEW, TOOLS } from '../config.ts';
const fileOf = (sido: string, slug: string) => `${sido}__${slug}`; // rent-geo.ts와 같은 규칙(순환 import 피함)

const real = Object.values(import.meta.glob<BuildingFile>('../data/rent-buildings/*.json', { eager: true, import: 'default' }));
const mock = Object.values(import.meta.glob<BuildingFile>('../data/rent-buildings.mock/*.json', { eager: true, import: 'default' }));
const LIVE = TOOLS.find((t) => t.slug === 'rent')?.status === 'live';
const picked: BuildingFile[] = RENT_PREVIEW ? (real.length ? real : mock) : LIVE ? real : [];
// 한 시·도가 여러 파일로 나뉠 수 있다(seoul-1.json …). 예전 통파일(seoul.json)이 남아 있어도 겹치지 않게 시·도마다 가장 새로 만든 묶음만 쓴다
const newest = new Map<string, string>();
for (const f of picked) if ((newest.get(f.sido) ?? '') < f.generatedAt) newest.set(f.sido, f.generatedAt);
const files = picked.filter((f) => f.generatedAt.slice(0, 13) === newest.get(f.sido)!.slice(0, 13));

const bySgg = new Map<string, { from: string; to: string; rows: BuildingRow[] }>();
for (const f of files) for (const r of f.b) {
  const k = fileOf(f.sido, r[0]);
  const g = bySgg.get(k) ?? { from: f.from, to: f.to, rows: [] };
  g.rows.push(r); bySgg.set(k, g);
}
export const HAS_BUILDINGS = bySgg.size > 0;
export const buildingFiles = () => [...bySgg.keys()];
/** 시·군·구·동별 건물 수(지도 요약에 '건물 N곳'을 먼저 보여 줄 때) */
export const buildingCount = (file: string, dong?: string) => { const g = bySgg.get(file); return g ? (dong ? g.rows.filter((r) => r[1] === dong).length : g.rows.length) : 0; };

/** 브라우저용: 시·군·구 slug는 파일 이름에 있으니 뺀다 → [동, 지번, 이름, 유형, 건축년도, 위도, 경도, 면적들] */
export function buildingCollection(file: string) {
  const g = bySgg.get(file);
  if (!g) return null;
  return { from: g.from, to: g.to, b: g.rows.map((r) => r.slice(1)) };
}

/** 동 상세 '건물별 거래' 탭 머리(2026-11-26 v2 합의): 최근 3년 3건 이상 거래된 건물만 금액 이력을 보여 주고, 1~2건 건물은 수만 센다 */
export const BLD_MIN = 3;
export function buildingSplit(file: string, dong: string) {
  const g = bySgg.get(file);
  let many = 0, few = 0;
  for (const r of g?.rows ?? []) {
    if (r[1] !== dong) continue;
    const n = (r[8] as number[][]).reduce((s, u) => s + Math.floor((u.length - 1) / 3), 0);
    if (n >= BLD_MIN) many++; else few++;
  }
  return { many, few };
}

/** 동 상세 '요즘 전월세 거래가 많은 건물'(2026-11-27 제미나이 합의, 기간은 클로드 수정).
 *  원자료가 계약 '연월'까지라 30일 단위로 셀 수 없고, 마지막 달은 신고 기한(계약 후 30일) 때문에 덜 잡힌다 → 최근 3개월로 센다.
 *  3건 이상인 건물만, 건수 많은 순. 표시는 건수(사실 숫자)만, 판정어·층 없음. */
export const BUSY_MONTHS = 3, BUSY_MIN = 3;
export type Busy = { id: string; name: string; jibun: string; t: 0 | 1 | 2; by: number; n: number };
export function busyBuildings(file: string, dong: string) {
  const g = bySgg.get(file);
  if (!g) return { list: [] as Busy[], from: '', to: '' };
  const span = (Number(g.to.slice(0, 4)) - Number(g.from.slice(0, 4))) * 12 + Number(g.to.slice(5, 7)) - Number(g.from.slice(5, 7));
  const min = span - BUSY_MONTHS + 1;
  const list: Busy[] = [];
  for (const r of g.rows) {
    if (r[1] !== dong) continue;
    let n = 0;
    for (const u of r[8] as number[][]) for (let i = 1; i + 2 < u.length; i += 3) if (u[i] >= min) n++;
    if (n >= BUSY_MIN) list.push({ id: `${file}|${r[1]}|${r[2]}|${r[4]}`, name: r[3] as string, jibun: r[2] as string, t: r[4] as 0 | 1 | 2, by: r[5] as number, n });
  }
  list.sort((a, b) => b.n - a.n || a.name.localeCompare(b.name, 'ko'));
  const ym = (k: number) => { const t = Number(g.from.slice(0, 4)) * 12 + Number(g.from.slice(5, 7)) - 1 + k; return `${Math.floor(t / 12)}.${String((t % 12) + 1).padStart(2, '0')}`; };
  return { list: list.slice(0, 10), from: ym(min), to: ym(span) };
}
