// 건물별 전월세 이력(2026-11-26, kgeop.go.kr 같은 정부 공개 방식을 따름).
// 저장하는 것: 시·군·구 slug, 법정동, 지번, 건물명, 유형, 건축년도, 건물 좌표(주소정보 DB), 전용면적별 [계약 연월, 보증금, 월세].
// 저장하지 않는 것: 층·동·호, 계약일(일), 계약기간, 갱신 여부. 위험·안전 판정 없음.
// 파일: src/data/rent-buildings/{sido}.json (시·도별로 나눠 깃허브 웹 업로드 25MB 한도 안에 둔다)
import { regionOfDeal } from './rent-lawd.ts';
import { lastMonths, type Deal } from './rent.ts';
import { placeKey } from './juso-geo.ts';
import type { SidoSlug } from './regions.ts';

/** 최근 몇 개월 이력을 남길지(정부 사이트 '최근 3년'에 맞춤) */
export const BUILDING_MONTHS = 36;
/** 면적 하나: [전용면적㎡(소수 1자리), 월 순번, 보증금, 월세, 월 순번, 보증금, 월세, …] (월 순번 = from부터 센 달 수, 0부터) */
export type Unit = number[];
/** 건물 한 곳: [시군구 slug, 법정동, 지번, 건물명, 유형(0 빌라·1 오피스텔), 건축년도(0=모름), 위도|null, 경도|null, 면적들] */
export type BuildingRow = [string, string, string, string, 0 | 1, number, number | null, number | null, Unit[]];
export interface BuildingFile { v: 1; sido: SidoSlug; from: string; to: string; generatedAt: string; isMock: boolean; b: BuildingRow[] }

export const monthIndex = (from: string, ym: string) => (Number(ym.slice(0, 4)) - Number(from.slice(0, 4))) * 12 + Number(ym.slice(5, 7)) - Number(from.slice(5, 7));
const mode = <T>(xs: T[]) => { const m = new Map<T, number>(); let best: T | undefined, bn = 0; for (const x of xs) { const n = (m.get(x) ?? 0) + 1; m.set(x, n); if (n > bn) { bn = n; best = x; } } return best; };

/** 실거래에서 좌표를 찾아야 할 지번 키 목록 */
export function neededPlaces(deals: Deal[]) {
  const s = new Set<string>();
  for (const d of deals) if (d.jibun) s.add(placeKey(d.code, d.dong, d.jibun));
  return s;
}

export function buildBuildings(all: Deal[], coord: (code: string, dong: string, jibun: string) => [number, number] | null, { months = BUILDING_MONTHS, isMock = false, now = new Date() } = {}) {
  const { from, to, deals } = lastMonths(all, months, now);
  const groups = new Map<string, { sido: SidoSlug; slug: string; ds: Deal[] }>();
  let noJibun = 0, unknown = 0;
  for (const d of deals) {
    if (!d.jibun) { noJibun++; continue; }
    const r = regionOfDeal(d.code, d.dong);
    if (!r) { unknown++; continue; }
    const k = `${r.sido}/${r.sigungu}/${d.dong}/${d.jibun}/${d.type}`;
    const g = groups.get(k) ?? { sido: r.sido, slug: r.sigungu, ds: [] };
    g.ds.push(d); groups.set(k, g);
  }
  const files = new Map<SidoSlug, BuildingFile>();
  let located = 0;
  for (const { sido, slug, ds } of groups.values()) {
    const d0 = ds[0];
    const name = mode(ds.map((d) => d.bname ?? '').filter(Boolean)) ?? '';
    const by = mode(ds.map((d) => d.buildYear).filter((x): x is number => x !== null)) ?? 0;
    const ll = mode(ds.map((d) => coord(d.code, d.dong, d.jibun!)).filter(Boolean).map((x) => x!.join(',')));
    const [lat, lng] = ll ? ll.split(',').map(Number) : [null, null];
    if (ll) located++;
    const units = new Map<number, Deal[]>();
    for (const d of ds) { const a = Math.round(d.area * 10) / 10; units.set(a, [...(units.get(a) ?? []), d]); }
    const u: Unit[] = [...units.entries()].sort((a, b) => a[0] - b[0]).map(([a, xs]) =>
      [a, ...xs.sort((x, y) => x.ym.localeCompare(y.ym) || x.deposit - y.deposit).flatMap((x) => [monthIndex(from, x.ym), x.deposit, x.monthly])]);
    const f = files.get(sido) ?? { v: 1, sido, from, to, generatedAt: new Date().toISOString(), isMock, b: [] };
    f.b.push([slug, d0.dong, d0.jibun!, name, d0.type === 'villa' ? 0 : 1, by, lat, lng, u]);
    files.set(sido, f);
  }
  for (const f of files.values()) f.b.sort((a, b) => `${a[0]}/${a[1]}/${a[2]}`.localeCompare(`${b[0]}/${b[1]}/${b[2]}`, 'ko'));
  return { from, to, files: [...files.values()], buildings: groups.size, located, deals: deals.length - noJibun - unknown, noJibun, unknown };
}
