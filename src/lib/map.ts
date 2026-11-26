// 지도 핀 데이터 공통(주차장·무인민원발급기). 페이지는 mapOn()이 참일 때만 BaseLayout의 'map' 슬롯을 채운다
// (지도 설정이 없거나 좌표 있는 곳이 없으면 2단으로 나누지 않고 기존 한 줄 화면 그대로).
import { MAP } from '../config.ts';
import { kioskPath, type Kiosk } from './data.ts';
import { hoursLine } from './format.ts';

export interface MapPoint {
  id: string; name: string; lat: number; lng: number; href: string;
  /** 요약 카드 1줄(예: 평일 9~18 · 120면) */ meta?: string;
  /** 이름 위 작은 표시(예: 무료, 24시간) */ badge?: string;
  /** 도로명(없으면 지번) 주소: 카드 표시·주소 복사·네이버 지도 검색에 쓴다 */ addr?: string;
  /** 핀 알약에 쓰는 짧은 사실(예: 무료, 300원/5분, 24시간). 없으면 이름 첫 글자 대신 '·' */ tag?: string;
  /** 핀 색: free 초록, paid·mixed·info 짙은 회색 */ tone?: 'free' | 'paid' | 'mixed' | 'unknown' | 'info';
}

export const validPoints = <T extends { lat: number | null; lng: number | null }>(ps: T[]) =>
  ps.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && p.lat! > 33 && p.lat! < 39 && p.lng! > 124 && p.lng! < 132);

export const mapOn = (ps: { lat: number | null; lng: number | null }[]) => MAP.enabled && validPoints(ps).length > 0;

/** 무인민원발급기 → 지도 핀 */
export const kioskPoint = (k: Kiosk): MapPoint => ({
  id: k.id, name: k.name, lat: k.lat as number, lng: k.lng as number, href: kioskPath(k),
  badge: k.is24h ? '24시간' : undefined,
  tag: k.is24h ? '24시간' : '발급기', tone: 'info',
  meta: [k.hoursConfidence === 'unknown' ? '운영시간 확인 필요' : hoursLine(k.hours), k.locationDetail].filter(Boolean).join(' · '),
  addr: k.roadAddress || undefined,
});
