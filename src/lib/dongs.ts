// 동(읍·면·동) 페이지 규칙(2026-11-25). '역삼동 무인민원발급기' 같은 동 단위 검색에 대응한다.
// 기준: 같은 시·군·구 안 같은 동에 기기 5곳 이상 + 시·군·구 전체의 85% 이하(시·군·구 페이지와 거의 같은 중복 페이지 방지).
// 기준 미달 동은 페이지를 만들지 않고, 시·군·구 페이지의 동별 소제목(앵커)으로만 안내한다.
// 동 이름은 원천 지번주소에서 뽑은 법정동이라 행정동(역삼1동 등)과 다를 수 있다 → 화면에 밝힌다.
import { kiosks, stats, type Kiosk, type SidoSlug } from './data.ts';
import { regionStats, type RegionStats } from '../../scripts/lib/stats.ts';

export const DONG_RULE = { min: 5, maxShare: 0.85 };

export interface DongPage { sido: SidoSlug; sigungu: string; sigunguName: string; dong: string; kiosks: Kiosk[]; st: RegionStats }

const key = (s: string, g: string, d: string) => `${s}/${g}/${d}`;
export const DONG_PAGES: DongPage[] = (() => {
  const by = new Map<string, Kiosk[]>();
  for (const k of kiosks) if (k.dong) by.set(key(k.sido, k.sigungu, k.dong), [...(by.get(key(k.sido, k.sigungu, k.dong)) ?? []), k]);
  const out: DongPage[] = [];
  for (const [, ks] of by) {
    const k0 = ks[0];
    const total = stats.find((s) => s.sido === k0.sido && s.sigungu === k0.sigungu)?.total ?? ks.length;
    if (ks.length < DONG_RULE.min || ks.length / total > DONG_RULE.maxShare) continue;
    out.push({ sido: k0.sido, sigungu: k0.sigungu, sigunguName: k0.sigunguName, dong: k0.dong!, kiosks: [...ks].sort((a, b) => a.name.localeCompare(b.name, 'ko')), st: regionStats(ks)[0] });
  }
  return out.sort((a, b) => key(a.sido, a.sigungu, a.dong).localeCompare(key(b.sido, b.sigungu, b.dong), 'ko'));
})();

const index = new Map(DONG_PAGES.map((d) => [key(d.sido, d.sigungu, d.dong), d]));
export const dongPage = (sido: string, sigungu: string, dong: string | null | undefined) => (dong ? index.get(key(sido, sigungu, dong)) : undefined);
export const dongPagesIn = (sido: string, sigungu: string) => DONG_PAGES.filter((d) => d.sido === sido && d.sigungu === sigungu);
/** 링크용 경로(한글 동 이름은 퍼센트 인코딩) */
export const dongPath = (sido: string, sigungu: string, dong: string) => `/muin/${sido}/${sigungu}/${encodeURIComponent(dong)}/`;
