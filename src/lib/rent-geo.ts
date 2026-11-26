// 전월세 지도(단계구분도) 데이터: 단순화한 법정동 경계(src/data/geo, scripts/geo/build-boundaries.py) + 전월세 통계를
// 빌드 때 합쳐 정적 JSON(/geo/rent/*.json)으로 낸다. 통계를 새로 올리면 빌드만 다시 하면 된다(경계는 그대로).
// 경계 출처: 도로명주소 기반 법정동 경계(행정안전부 주소정보, /about/#licenses). 좌표는 소수 5자리(약 1m)로 줄였다.
// 표시 원칙: 사실 숫자(중위값·건수)만. 위험·안전 판정 없음. 지번·건물명·층·계약일 없음.
import { stats, rentPath, hasDongPage, sidoShort, periodText, RENT_RULE, type RentArea } from './rent.ts';
import type { SidoSlug } from '../../scripts/lib/regions.ts';

type Geo = { type: 'FeatureCollection'; features: { type: 'Feature'; properties: Record<string, unknown>; geometry: unknown }[] };
const emdFiles = import.meta.glob<Geo>('../data/geo/emd/*.json', { import: 'default' });
const sggFile = import.meta.glob<Geo>('../data/geo/sgg.json', { import: 'default' });

/** 색칠 지표 6종: [빌라 전세, 빌라 월세(월), 빌라 월세 보증금, 오피스텔 전세, 오피스텔 월세(월), 오피스텔 월세 보증금] 중위값(만원) */
export const METRICS = ['vj', 'vw', 'vd', 'oj', 'ow', 'od'] as const;
const metrics = (a: RentArea | undefined) => {
  const v = a?.byType.villa, o = a?.byType.officetel;
  return [v?.jeonse?.median, v?.wolse?.monthly?.median, v?.wolse?.deposit?.median, o?.jeonse?.median, o?.wolse?.monthly?.median, o?.wolse?.deposit?.median].map((x) => x ?? null);
};
/** 거래 적음(회색): 동 페이지 색인 기준과 같은 최근 12개월 INDEX_MIN건 미만 */
export const LOW_N = RENT_RULE.INDEX_MIN;
export const fileOf = (sido: string, slug: string) => `${sido}__${slug}`;

/** 색 구간 경계 5개(6단계): 색칠되는 동(거래 LOW_N건 이상)의 분위수. 전세 1,000만·월세 5만 단위로 반올림 */
function breaks(i: number) {
  const xs = stats.areas.filter((a) => a.dong !== null && a.n >= LOW_N).map((a) => metrics(a)[i]).filter((x): x is number => x !== null).sort((a, b) => a - b);
  if (xs.length < 6) return [];
  const step = METRICS[i].endsWith('w') ? 5 : 1000;
  const out: number[] = [];
  for (const p of [1, 2, 3, 4, 5]) {
    const v = Math.round(xs[Math.floor((xs.length - 1) * p / 6)] / step) * step;
    if (v > (out.at(-1) ?? 0)) out.push(v);
  }
  return out;
}

export async function sggCollection() {
  const load = Object.values(sggFile)[0];
  if (!load) return null;
  const geo = await load();
  const features = geo.features.map((f) => {
    const { sido, slug, l } = f.properties as { sido: SidoSlug; slug: string; l: number[] };
    const a = stats.areas.find((x) => x.dong === null && x.sido === sido && x.sigungu === slug);
    return { ...f, properties: { f: fileOf(sido, slug), nm: a?.sigunguName ?? slug, sd: sidoShort(sido), l, n: a?.n ?? 0, h: a ? rentPath(sido, slug) : null, m: metrics(a) } };
  });
  return { type: 'FeatureCollection', period: periodText(), low: LOW_N, breaks: Object.fromEntries(METRICS.map((k, i) => [k, breaks(i)])), features };
}

export const emdFileNames = () => Object.keys(emdFiles).map((p) => p.split('/').pop()!.replace(/\.json$/, ''));

export async function emdCollection(file: string) {
  const load = emdFiles[`../data/geo/emd/${file}.json`];
  if (!load) return null;
  const geo = await load();
  const [sido, slug] = file.split('__');
  const features = geo.features.map((f) => {
    const { k, c, l } = f.properties as { k: string; c: string; l: number[] };
    const a = stats.areas.find((x) => x.dong === k && x.sido === sido && x.sigungu === slug);
    return { ...f, properties: { k, c, l, n: a?.n ?? 0, h: a && hasDongPage(a) ? rentPath(sido, slug, k) : null, m: metrics(a) } };
  });
  return { type: 'FeatureCollection', features };
}
