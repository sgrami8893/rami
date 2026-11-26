// 건물별 전월세 이력(2026-11-26). 원본 src/data/rent-buildings/{sido}.json(PC에서 npm run fetch-rent)을
// 빌드 때 시·군·구별 정적 JSON(/geo/rent-b/{sido}__{slug}.json)으로 나눈다. 건물마다 페이지를 만들지 않는다(Pages 파일 한도).
// 표시 원칙: 사실(계약 연월·금액·면적)만. 층·계약일(일) 없음. 위험·안전 판정 없음.
import type { BuildingFile, BuildingRow } from '../../scripts/lib/rent-buildings.ts';
import { RENT_PREVIEW, TOOLS } from '../config.ts';
const fileOf = (sido: string, slug: string) => `${sido}__${slug}`; // rent-geo.ts와 같은 규칙(순환 import 피함)

const real = Object.values(import.meta.glob<BuildingFile>('../data/rent-buildings/*.json', { eager: true, import: 'default' }));
const mock = Object.values(import.meta.glob<BuildingFile>('../data/rent-buildings.mock/*.json', { eager: true, import: 'default' }));
const LIVE = TOOLS.find((t) => t.slug === 'rent')?.status === 'live';
const files: BuildingFile[] = RENT_PREVIEW ? (real.length ? real : mock) : LIVE ? real : [];

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
