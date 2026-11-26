// 주차 요금 계산(참고용). 표준데이터의 기본시간·기본요금·추가단위시간·추가단위요금·1일주차권을 그대로 적용한다.
// 원칙: 자료에 없는 규칙(감면·야간·회차 무료 등)은 만들지 않는다. 계산할 수 없으면 '요금 정보 없음'으로 둔다.
import type { ParkingLot } from './parking.ts';

export type FeeResult =
  | { status: 'free' }
  | { status: 'none'; reason: string }
  | { status: 'ok'; amount: number; capped: boolean; base: number; extraUnits: number };

export const DURATIONS = [
  { key: '30m', label: '30분', minutes: 30 },
  { key: '1h', label: '1시간', minutes: 60 },
  { key: '2h', label: '2시간', minutes: 120 },
  { key: '3h', label: '3시간', minutes: 180 },
  { key: 'day', label: '종일', minutes: null },
] as const;
export type DurationKey = (typeof DURATIONS)[number]['key'];

/** '종일'의 시간: 평일 운영시간이 있으면 그 길이, 24시간·정보 없음이면 24시간 */
export function dayMinutes(l: Pick<ParkingLot, 'hours'>) {
  const h = l.hours.weekday;
  if (!h || h === '24h') return 24 * 60;
  const toMin = (t: string) => { const [a, b] = t.split(':').map(Number); return a * 60 + b; };
  const d = toMin(h[1]) - toMin(h[0]);
  return d > 0 ? d : d + 24 * 60; // 22:00~06:00 같은 야간 운영
}

export function calcFee(l: Pick<ParkingLot, 'fee' | 'hours'>, minutes: number): FeeResult {
  const f = l.fee;
  if (f.type === 'free') return { status: 'free' };
  if (f.type === 'mixed') return { status: 'none', reason: '무료·유료 구역이 섞여 있어 현장 확인이 필요해요' };
  if (f.type === 'unknown') return { status: 'none', reason: '요금 정보 없음' };
  if (f.baseFee === null || f.baseMin === null || f.baseMin <= 0) {
    // 기본요금 없이 1일권만 있는 경우는 1일권 금액으로 안내할 수 없어(시간 조건 불명) 정보 없음 처리
    return { status: 'none', reason: '요금 정보 없음' };
  }
  // 유료인데 기본·추가 요금이 모두 0원인 자료는 입력 누락으로 보고 계산하지 않는다(무료로 오인 방지, 2026-11-27)
  if (f.baseFee === 0 && !f.unitFee) return { status: 'none', reason: '요금 정보 확인 필요' };
  let amount = f.baseFee, extraUnits = 0;
  if (minutes > f.baseMin) {
    if (!f.unitMin || f.unitMin <= 0 || f.unitFee === null) return { status: 'none', reason: `기본 ${f.baseMin}분 ${f.baseFee.toLocaleString('ko-KR')}원 이후 요금 정보 없음` };
    extraUnits = Math.ceil((minutes - f.baseMin) / f.unitMin);
    amount += extraUnits * f.unitFee;
  }
  let capped = false;
  if (f.dayPass !== null && f.dayPass > 0 && amount > f.dayPass) { amount = f.dayPass; capped = true; }
  return { status: 'ok', amount, capped, base: f.baseFee, extraUnits };
}

export const feeText = (r: FeeResult) =>
  r.status === 'free' ? '무료' : r.status === 'none' ? r.reason : `${r.amount.toLocaleString('ko-KR')}원`;

/** 정렬용 값: 무료 0, 계산 불가는 맨 뒤(Infinity) */
export const sortValue = (r: FeeResult) => (r.status === 'free' ? 0 : r.status === 'ok' ? r.amount : Number.POSITIVE_INFINITY);

/** 계산식 설명(화면 보조 문구) */
export function feeBreakdown(l: Pick<ParkingLot, 'fee'>, r: FeeResult) {
  if (r.status !== 'ok') return '';
  const f = l.fee; const w = (n: number) => `${n.toLocaleString('ko-KR')}원`;
  const parts = [`기본 ${f.baseMin}분 ${w(f.baseFee!)}`];
  if (r.extraUnits) parts.push(`추가 ${f.unitMin}분당 ${w(f.unitFee!)} × ${r.extraUnits}`);
  return parts.join(' + ') + (r.capped ? ` → 1일권 ${w(f.dayPass!)} 적용` : '');
}
