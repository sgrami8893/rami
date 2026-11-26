// 머리말 검색 시트용 작은 색인(2026-11-26 v2). 시·군·구마다 세 도구 주소 + 전월세 동 페이지.
// [이름, 설명(시·도 시·군·구), 검색 키(별칭), {r?, p?, m?}] — 지금 보는 도구의 주소가 먼저 쓰인다(SearchSheet).
import { SIGUNGU, SIDO, type SidoSlug } from '../../scripts/lib/regions.ts';
import { regionsIn, regionPath, subGuOf } from '../lib/data.ts';
import { SIDOS as PARKING_SIDOS, regionsOf as parkingRegionsOf, parkingPath } from '../lib/parking.ts';
import { HAS_PAGES, SIDOS as RENT_SIDOS, sigunguOf as rentSigunguOf, rentPath, DONG_PAGES } from '../lib/rent.ts';
import { TOOLS } from '../config.ts';

const ALIAS: Record<string, string> = {
  'gyeonggi/seongnam-si': '판교 위례 분당', 'gyeonggi/hwaseong-si': '동탄 봉담', 'gyeonggi/suwon-si': '광교', 'gyeonggi/anyang-si': '평촌', 'gyeonggi/gunpo-si': '산본',
  'gyeonggi/hanam-si': '미사 위례', 'gyeonggi/namyangju-si': '다산 별내', 'gyeonggi/paju-si': '운정', 'gyeonggi/goyang-si': '일산 삼송 원흥', 'gyeonggi/yongin-si': '수지 기흥 처인',
  'gyeonggi/gimpo-si': '한강신도시', 'seoul/songpa-gu': '위례 잠실', 'incheon/yeonsu-gu': '송도', 'incheon/seohae-gu': '청라 서구', 'incheon/geomdan-gu': '서구',
  'incheon/michuhol-gu': '남구', 'incheon/jemulpo-gu': '중구 동구', 'incheon/yeongjong-gu': '영종도',
};
const live = (s: string) => TOOLS.some((t) => t.slug === s && t.status === 'live');
export function GET() {
  type H = { r?: string; p?: string; m?: string };
  const sgg = new Map<string, { n: string; c: string; k: string; h: H }>();
  const put = (sido: SidoSlug, sg: string, key: keyof H, href: string) => {
    const id = `${sido}/${sg}`;
    const nm = SIGUNGU[sido].find((x) => x.slug === sg)?.name ?? sg;
    const e = sgg.get(id) ?? { n: nm, c: SIDO[sido].aliases[0], k: `${subGuOf(sido, sg).join(' ')} ${ALIAS[id] ?? ''}`.trim(), h: {} };
    e.h[key] = href; sgg.set(id, e);
  };
  if (live('rent') && HAS_PAGES) RENT_SIDOS.forEach((s) => rentSigunguOf(s).forEach((a) => put(s, a.sigungu, 'r', rentPath(s, a.sigungu))));
  if (live('parking')) PARKING_SIDOS.forEach((s) => parkingRegionsOf(s).forEach((r) => put(s, r.sigungu, 'p', parkingPath(s, r.sigungu))));
  if (live('muin')) (['seoul', 'gyeonggi', 'incheon'] as SidoSlug[]).forEach((s) => regionsIn(s).forEach((r) => put(s, r.sigungu, 'm', regionPath(s, r.sigungu))));
  const rows: [string, string, string, H][] = [...sgg.values()].map((e) => [e.n, e.c, e.k, e.h]);
  if (live('rent')) for (const a of DONG_PAGES) rows.push([a.dong!, `${SIDO[a.sido as SidoSlug].aliases[0]} ${a.sigunguName}`, '', { r: rentPath(a.sido, a.sigungu, a.dong) }]);
  return new Response(JSON.stringify(rows), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}
