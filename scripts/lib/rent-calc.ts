// 전월세 계산기(참고용). 브라우저와 빌드 양쪽에서 쓴다(의존성 없음).
//
// 1) 중개보수 상한(임대차)
//   주택: 「공인중개사법 시행규칙」 별표1(2021-10-19 신설) 주택 임대차 등 상한요율. 서울시 「주택 중개보수 등에 관한 조례」 별표1(2021-12-30 시행)도 같은 요율.
//     5천만 원 미만 0.5%(한도 20만 원) · 5천만~1억 0.4%(한도 30만 원) · 1억~6억 0.3% · 6억~12억 0.4% · 12억~15억 0.5% · 15억 이상 0.6%
//   오피스텔: 시행규칙 제20조제4항. 전용 85㎡ 이하 + 전용 입식 부엌·수세식 화장실·목욕시설을 모두 갖춘 경우 0.4%, 그 밖에는 0.9% 이내 협의.
//   거래금액: 보증금 + 월세×100. 그 합이 5천만 원 미만이면 보증금 + 월세×70 (시행규칙 제20조제5항).
//   상한이라 실제 보수는 이 금액 안에서 협의한다. 부가가치세는 별도(중개사무소 과세 유형에 따라 다름).
// 2) 전월세 전환율(보증금 → 월세): 「주택임대차보호법」 제7조의2, 시행령 제9조.
//   상한 = min(연 10%, 한국은행 기준금리 + 연 2%). 계약 기간 중 보증금 일부를 월세로 바꿀 때 적용되는 상한이고,
//   새 계약의 시세 비율이 아니다 → 화면에 '법정 상한 기준 참고 계산'으로 밝힌다.
// 요율·기준금리가 바뀌면 이 파일의 상수만 고친다(BASE_RATE_CHECKED 날짜도 함께).

export const HOUSE_RENT_BRACKETS = [
  { under: 5_000, rate: 0.005, cap: 20 }, // 단위: 만원
  { under: 10_000, rate: 0.004, cap: 30 },
  { under: 60_000, rate: 0.003, cap: null },
  { under: 120_000, rate: 0.004, cap: null },
  { under: 150_000, rate: 0.005, cap: null },
  { under: Infinity, rate: 0.006, cap: null },
] as const;
export const OFFICETEL_RATE = { qualified: 0.004, other: 0.009 } as const;

/** 한국은행 기준금리(연 %). 2026-11-26 금통위 결과에 따라 갱신할 것 */
// 2026-11-26 금융통화위원회 3.00% → 3.25% 인상(같은 날 확인). 전환율 상한 5.25%
export const BASE_RATE = 3.25;
export const BASE_RATE_CHECKED = '2026-11-26';
export const CONVERSION = { cap: 10, spread: 2 } as const;

/** 중개보수 계산용 거래금액(만원) */
export function dealAmount(deposit: number, monthly: number) {
  if (!monthly) return deposit;
  const a = deposit + monthly * 100;
  return a < 5_000 ? deposit + monthly * 70 : a;
}

export type Property = 'house' | 'officetel-qualified' | 'officetel-other';
export interface BrokerFee { amount: number; rate: number; capManwon: number | null; maxFeeWon: number; capped: boolean; negotiable: boolean }

/** 만원 × 요율 → 원(부동소수 오차를 피하려고 천분율 정수로 계산) */
const feeWon = (amountManwon: number, rate: number) => Math.floor((amountManwon * 10_000 * Math.round(rate * 1000)) / 1000);

/** 중개보수 상한(원 단위, 1원 미만 버림). 입력은 만원. */
export function brokerFee(deposit: number, monthly: number, property: Property = 'house'): BrokerFee {
  const amount = dealAmount(Math.max(0, deposit), Math.max(0, monthly));
  if (property !== 'house') {
    const rate = property === 'officetel-qualified' ? OFFICETEL_RATE.qualified : OFFICETEL_RATE.other;
    return { amount, rate, capManwon: null, maxFeeWon: feeWon(amount, rate), capped: false, negotiable: property === 'officetel-other' };
  }
  const b = HOUSE_RENT_BRACKETS.find((x) => amount < x.under)!;
  const raw = feeWon(amount, b.rate);
  const capWon = b.cap === null ? Infinity : b.cap * 10_000;
  return { amount, rate: b.rate, capManwon: b.cap, maxFeeWon: Math.min(raw, capWon), capped: raw > capWon, negotiable: false };
}

/** 법정 전환율 상한(연 %) */
export const conversionRate = (baseRate = BASE_RATE) => Math.min(CONVERSION.cap, baseRate + CONVERSION.spread);

/** 보증금 일부(만원)를 월세로 바꿀 때 월세 상한(원) */
export const depositToMonthlyWon = (manwon: number, ratePct = conversionRate()) => Math.floor((manwon * 10_000 * ratePct) / 100 / 12);
/** 월세(만원)를 보증금으로 환산(만원). 참고 계산 */
export const monthlyToDepositManwon = (monthlyManwon: number, ratePct = conversionRate()) => Math.round((monthlyManwon * 12 * 100) / ratePct);
