// 시·도 단위 조건 허브(2026-11-25 설계): /muin/{sido}/{24h|weekend|registry|family}/
// 이 파일은 JSON을 직접 읽지 않는다. astro.config(사이트맵 제외 목록)와 페이지가 같은 규칙을 쓰도록 순수 함수만 둔다.

export type HubCond = '24h' | 'weekend' | 'registry' | 'family';
export const HUB_CONDS: HubCond[] = ['24h', 'weekend', 'registry', 'family'];

interface K {
  sido: string; sigungu: string; is24h: boolean;
  openSat: boolean; openSun: boolean; openHoliday: boolean; docs: string[];
}

/** 시·군·구 페이지 필터 칩(?f=)과 같은 기준 */
export const HUB_PRED: Record<HubCond, (k: K) => boolean> = {
  '24h': (k) => k.is24h,
  weekend: (k) => k.openSat || k.openSun, // region-stats.json의 openWeekend와 같은 기준
  registry: (k) => k.docs.includes('registry'),
  family: (k) => k.docs.includes('family'),
};

export const HUB_LABEL: Record<HubCond, { short: string; h1: string; chip: string }> = {
  '24h': { short: '24시간', h1: '24시간 무인민원발급기', chip: '24시간 운영' },
  weekend: { short: '주말·공휴일', h1: '주말·공휴일 운영 무인민원발급기', chip: '주말·공휴일 운영' },
  registry: { short: '등기부등본', h1: '등기부등본 발급 무인민원발급기', chip: '등기부등본 발급' },
  family: { short: '가족관계증명서', h1: '가족관계증명서 발급 무인민원발급기', chip: '가족관계증명서 발급' },
};

/** 색인 기준: 20곳 이상, 3개 이상 시·군·구에 분포, 시·도 전체의 85% 이하(넘으면 시·도 페이지와 사실상 같은 목록) */
export const HUB_RULE = { minKiosks: 20, minRegions: 3, maxShare: 0.85 };

export function hubStats(all: K[], sido: string, cond: HubCond) {
  const inSido = all.filter((k) => k.sido === sido);
  const hit = inSido.filter(HUB_PRED[cond]);
  const regions = new Set(hit.map((k) => k.sigungu)).size;
  const share = inSido.length ? hit.length / inSido.length : 0;
  const indexable = hit.length >= HUB_RULE.minKiosks && regions >= HUB_RULE.minRegions && share <= HUB_RULE.maxShare;
  return { total: inSido.length, count: hit.length, regions, share, indexable };
}

export const hubPath = (sido: string, cond: HubCond) => `/muin/${sido}/${cond}/`;

/** 사이트맵에서 뺄 조건 허브 경로(색인 기준 미달) */
export function hubNoindexPaths(all: K[], sidos: string[]): string[] {
  return sidos.flatMap((s) => HUB_CONDS.filter((c) => {
    const st = hubStats(all, s, c);
    return st.count > 0 && !st.indexable;
  }).map((c) => hubPath(s, c)));
}
