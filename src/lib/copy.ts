// Page titles, descriptions and summary paragraphs (templates from Gemini, 2026-11-25).
import { subGuOf, type RegionStats, type SidoSlug } from './data.ts';
import { SIDO } from '../../scripts/lib/regions.ts';
import type { Kiosk } from '../../scripts/lib/normalize.ts';

const sidoFull = (s: SidoSlug) => SIDO[s].name;

// ① 메인
export const homeTitle = '수도권 무인민원발급기 위치·운영시간 조회 | 지금 열린 곳 찾기';
export const homeDescription = (total: number) =>
  `서울·경기·인천 무인민원발급기 총 ${total}곳의 실시간 운영 여부, 24시간·주말 운영, 등기부등본·가족관계증명서 발급 가능 기기를 한눈에 확인하세요.`;

// ② 시/도
export interface SidoTotals { total: number; is24h: number; openWeekend: number; registry: number }
export const sidoTitle = (s: SidoSlug, t: SidoTotals) => `${sidoFull(s)} 무인민원발급기 위치·24시간·주말 운영 조회 (${t.total}곳)`;
export const sidoDescription = (s: SidoSlug, t: SidoTotals) =>
  `${sidoFull(s)} 전체 무인민원발급기 ${t.total}대의 위치와 운영시간을 시·군·구별로 정리했습니다. 24시간(${t.is24h}곳), 주말 운영(${t.openWeekend}곳), 등기부등본 발급 기기를 바로 찾아보세요.`;

// ③ 시/군/구
export function regionPageTitle(st: RegionStats): string {
  const gu = subGuOf(st.sido, st.sigungu);
  if (gu.length) return `${st.sigunguName}(${gu.join('·')}) 무인민원발급기 위치·24시간·주말 운영`;
  return st.is24h > 0
    ? `${st.sigunguName} 무인민원발급기 위치·운영시간 (24시간 ${st.is24h}곳·주말)`
    : `${st.sigunguName} 무인민원발급기 위치·운영시간 (총 ${st.total}곳·주말 운영)`;
}

export const regionDescription = (st: RegionStats) =>
  `${sidoFull(st.sido)} ${st.sigunguName} 무인민원발급기 ${st.total}곳의 실시간 운영 여부와 발급 가능 서류 안내. 24시간 ${st.is24h}곳, 주말·공휴일 ${st.openWeekend}곳, 등기부등본 ${st.docs.registry ?? 0}곳을 동별로 확인하세요.`;

export function regionSummary(st: RegionStats): string {
  const gu = subGuOf(st.sido, st.sigungu);
  const s = [`${sidoFull(st.sido)} ${st.sigunguName}에는 총 ${st.total}대의 무인민원발급기가 운영 중입니다.`];
  if (gu.length) s.push(`구별로는 ${gu.map((g) => `${g} ${st.bySubGu[g] ?? 0}대`).join(', ')}입니다.`);
  s.push(
    (st.is24h > 0 ? `24시간 이용 가능한 곳은 ${st.is24h}곳이며, ` : '현재 24시간 운영 기기는 없으며, ') +
      `주말·공휴일에 문을 여는 곳은 ${st.openWeekend}곳, 밤 10시 이후 이용 가능한 곳은 ${st.openAfter22}곳입니다.`,
  );
  s.push(`법원 등기부등본 발급이 가능한 기기는 ${st.docs.registry ?? 0}곳입니다.`);
  if (st.latestBaseDate) s.push(`(데이터 기준일: ${st.latestBaseDate})`);
  return s.join(' ');
}

// ④ 기기 상세
export const kioskTitle = (k: Kiosk) => `${k.name} 무인민원발급기 운영시간·발급서류·위치 (${k.sigunguName})`;
export const kioskDescription = (k: Kiosk) =>
  `${k.roadAddress}${k.locationDetail ? `(${k.locationDetail})` : ''} ${k.name} 무인민원발급기의 요일별 운영시간, 등기부등본·가족관계증명서 발급 여부 및 주변 대체 기기 정보를 확인하세요.`;

export const SIDO_URL_NAME: Record<SidoSlug, string> = { seoul: '서울', gyeonggi: '경기', incheon: '인천' };
