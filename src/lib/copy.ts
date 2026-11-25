// Page titles, descriptions and summary paragraphs (templates from Gemini, 2026-11-25).
import { subGuOf, type RegionStats, type SidoSlug } from './data.ts';
import { SIDO } from '../../scripts/lib/regions.ts';
import type { Kiosk } from '../../scripts/lib/normalize.ts';

const sidoFull = (s: SidoSlug) => SIDO[s].name;

const n = (x: number) => x.toLocaleString('ko-KR');
/** 묶음 단위: 일반구가 있는 시는 구별, 군은 읍·면별, 나머지는 동별 */
const groupUnit = (st: RegionStats) => (subGuOf(st.sido, st.sigungu).length ? '구별로' : st.sigunguName.endsWith('군') ? '읍·면별로' : '동별로');

// ① 메인 (/muin/) — '실시간'은 쓰지 않는다: 기기 상태가 아니라 공개된 운영시간으로 계산한 값이다.
export const homeTitle = (total: number) => `수도권 무인민원발급기 ${n(total)}곳 위치·운영시간 | 지금 운영시간인 곳 찾기`;
export const homeDescription = (total: number) =>
  `서울·경기·인천 무인민원발급기 ${n(total)}곳의 운영시간 기준 지금 운영 여부, 24시간·주말 운영, 등기부등본·가족관계증명서 발급 가능 기기를 한눈에 확인하세요.`;

// ② 시/도
export interface SidoTotals { total: number; is24h: number; openWeekend: number; registry: number }
export const sidoTitle = (s: SidoSlug, t: SidoTotals) => `${SIDO_SHORT[s]} 무인민원발급기 ${n(t.total)}곳 | 24시간·주말 운영 위치`;
export const sidoDescription = (s: SidoSlug, t: SidoTotals) =>
  `${sidoFull(s)} 무인민원발급기 ${n(t.total)}곳의 위치와 운영시간을 시·군·구별로 정리했습니다. 24시간 ${n(t.is24h)}곳, 주말·공휴일 운영 ${n(t.openWeekend)}곳, 등기부등본 발급 기기를 바로 찾아보세요.`;

// ③ 시/군/구
export function regionPageTitle(st: RegionStats): string {
  const gu = subGuOf(st.sido, st.sigungu);
  if (gu.length) return `${st.sigunguName}(${gu.join('·')}) 무인민원발급기 위치·24시간·주말 운영`;
  return st.is24h > 0
    ? `${st.sigunguName} 무인민원발급기 위치·운영시간 (24시간 ${st.is24h}곳·주말 ${st.openWeekend}곳)`
    : `${st.sigunguName} 무인민원발급기 위치·운영시간 (총 ${st.total}곳·주말 ${st.openWeekend}곳)`;
}

export const regionDescription = (st: RegionStats) =>
  `${sidoFull(st.sido)} ${st.sigunguName} 무인민원발급기 ${st.total}곳의 운영시간과 발급 가능 서류 안내. 24시간 ${st.is24h}곳, 주말·공휴일 ${st.openWeekend}곳, 등기부등본 ${st.docs.registry ?? 0}곳을 ${groupUnit(st)} 확인하세요.`;

export function regionSummary(st: RegionStats): string {
  const gu = subGuOf(st.sido, st.sigungu);
  const s = [`${sidoFull(st.sido)} ${st.sigunguName}에는 무인민원발급기가 ${st.total}곳 있습니다.`];
  if (gu.length) s.push(`구별로는 ${gu.map((g) => `${g} ${st.bySubGu[g] ?? 0}곳`).join(', ')}입니다.`);
  s.push(
    (st.is24h > 0 ? `24시간 이용할 수 있는 곳은 ${st.is24h}곳이며, ` : '24시간 운영 기기는 없으며, ') +
      `주말·공휴일에 운영하는 곳은 ${st.openWeekend}곳, 밤 10시 이후에도 이용할 수 있는 곳은 ${st.openAfter22}곳입니다.`,
  );
  s.push(`법원 발급 서류(등기부등본·가족관계증명서) 중 등기부등본을 뗄 수 있는 기기는 ${st.docs.registry ?? 0}곳입니다.`);
  if (st.latestBaseDate) s.push(`(데이터 기준일: ${st.latestBaseDate})`);
  return s.join(' ');
}

// ④ 기기 상세
/** 도로명주소 괄호 안에 상세위치가 이미 있으면 다시 붙이지 않는다. */
const detailOf = (k: Kiosk) => (k.locationDetail && !k.roadAddress.includes(k.locationDetail) ? k.locationDetail : '');
export const kioskTitle = (k: Kiosk) => {
  const loc = k.locationDetail && k.locationDetail.length <= 16 ? `(${k.locationDetail})` : '';
  const area = k.name.includes(k.sigunguName.replace(/[시군구]$/, '')) ? '' : ` - ${k.sigunguName}`;
  return `${k.name} 무인민원발급기${loc} 운영시간·발급 서류${area}`;
};
export const kioskDescription = (k: Kiosk) => {
  const d = detailOf(k);
  return `${k.sigunguName} ${k.name} 무인민원발급기 안내. ${k.roadAddress}${d ? ` ${d}` : ''}. 요일별 운영시간, 등기부등본·가족관계증명서 발급 여부와 같은 동네의 다른 기기를 확인하세요.`;
};

export const SIDO_URL_NAME: Record<SidoSlug, string> = { seoul: '서울', gyeonggi: '경기', incheon: '인천' };
const SIDO_SHORT = SIDO_URL_NAME;
