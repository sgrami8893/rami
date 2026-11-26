// 지역 틀(경계) 공통 데이터(2026-11-26 사용자 '경계는 다른 콘텐츠에도 각각 알맞게').
// 주차장·무인민원발급기·전월세 지도가 함께 쓰는 '통계 없는' 경계: 시·도 외곽선, 시·군·구 경계, 시·군·구별 법정동 경계.
// 원본은 scripts/geo/build-boundaries.py 결과(src/data/geo). 출처: 도로명주소 기반 경계(행정안전부 주소정보, /about/#licenses).
type Geo = { type: 'FeatureCollection'; features: { type: 'Feature'; properties: Record<string, unknown>; geometry: unknown }[] };
const emdFiles = import.meta.glob<Geo>('../data/geo/emd/*.json', { import: 'default' });
const sggFile = import.meta.glob<Geo>('../data/geo/sgg.json', { import: 'default' });
const sidoFile = import.meta.glob<Geo>('../data/geo/sido.json', { import: 'default' });

const fc = (features: Geo['features']) => ({ type: 'FeatureCollection', features });
/** 경계가 있는 시·군·구 파일 이름(sido__slug) */
export const areaFiles = () => Object.keys(emdFiles).map((k) => k.split('/').pop()!.replace(/\.json$/, ''));
export const hasArea = (sido: string, slug?: string) => (slug ? areaFiles().includes(`${sido}__${slug}`) : areaFiles().some((f) => f.startsWith(`${sido}__`)));
export async function sidoOutlines() { const g = await Object.values(sidoFile)[0]?.(); return fc(g?.features ?? []); }
export async function sggOutlines() {
  const g = await Object.values(sggFile)[0]?.();
  return fc((g?.features ?? []).map((f) => ({ ...f, properties: { f: `${f.properties.sido}__${f.properties.slug}` } })));
}
export async function emdOutlines(file: string) {
  const g = await emdFiles[`../data/geo/emd/${file}.json`]?.();
  return fc((g?.features ?? []).map((f) => ({ ...f, properties: { k: f.properties.k } })));
}
