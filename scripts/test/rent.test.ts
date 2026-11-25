import { test } from 'node:test';
import assert from 'node:assert/strict';
import { brokerFee, dealAmount, conversionRate, depositToMonthlyWon } from '../lib/rent-calc.ts';
import { normalizeDeal, aggregate, dist, K_MIN, manwon, type Deal } from '../lib/rent.ts';

test('월세 거래금액: 보증금+월세×100, 5천만 미만이면 ×70', () => {
  assert.equal(dealAmount(1000, 50), 6000);   // 1,000 + 5,000 = 6,000만
  assert.equal(dealAmount(500, 40), 3300);    // 500 + 4,000 = 4,500 < 5,000 → 500 + 2,800
  assert.equal(dealAmount(20000, 0), 20000);
});

test('주택 임대차 중개보수 상한과 한도', () => {
  assert.equal(brokerFee(3000, 0).maxFeeWon, 150_000);      // 3천만 × 0.5% = 15만
  assert.equal(brokerFee(4900, 0).maxFeeWon, 200_000);      // 24.5만 → 한도 20만
  assert.equal(brokerFee(4900, 0).capped, true);
  assert.equal(brokerFee(9000, 0).maxFeeWon, 300_000);      // 36만 → 한도 30만
  assert.equal(brokerFee(20000, 0).maxFeeWon, 600_000);     // 2억 × 0.3%
  assert.equal(brokerFee(60000, 0).rate, 0.004);            // 6억은 6억~12억 구간
  assert.equal(brokerFee(150000, 0).rate, 0.006);
});

test('오피스텔 요율', () => {
  assert.equal(brokerFee(20000, 0, 'officetel-qualified').maxFeeWon, 800_000);
  assert.equal(brokerFee(20000, 0, 'officetel-other').maxFeeWon, 1_800_000);
  assert.equal(brokerFee(20000, 0, 'officetel-other').negotiable, true);
});

test('전환율 상한 = min(10%, 기준금리+2%)', () => {
  assert.equal(conversionRate(3), 5);
  assert.equal(conversionRate(9), 10);
  assert.equal(depositToMonthlyWon(1000, 5), 41_666); // 1천만 × 5% / 12
});

test('API 항목 정규화: 영문·한글 필드명, 쉼표 금액', () => {
  const a = normalizeDeal({ sggCd: '11680', umdNm: '역삼동', dealYear: '2026', dealMonth: '9', deposit: '20,000', monthlyRent: '0', excluUseAr: '33.5', contractType: '갱신', useRRRight: '사용', buildYear: '2015' }, 'villa');
  assert.deepEqual(a, { type: 'villa', code: '11680', dong: '역삼동', ym: '2026-09', deposit: 20000, monthly: 0, area: 33.5, buildYear: 2015, renewal: 'renew', usedRight: true });
  const b = normalizeDeal({ 지역코드: '11440', 법정동: ' 망원동 ', 년: '2026', 월: '10', 보증금액: '1,000', 월세금액: '60', 전용면적: '19.8' }, 'officetel');
  assert.equal(b?.dong, '망원동');
  assert.equal(b?.monthly, 60);
  assert.equal(normalizeDeal({ sggCd: '11680', umdNm: '역삼동', dealYear: '2026', dealMonth: '9', deposit: '0', monthlyRent: '0', excluUseAr: '30' }, 'villa'), null);
});

test(`통계 칸은 ${K_MIN}건 미만이면 숨긴다`, () => {
  assert.equal(dist([1, 2]), null);
  assert.equal(dist([1, 2, 3])?.median, 2);
});

test('집계: 최근 12개월, 시·군·구 + 동', () => {
  const mk = (ym: string, dong: string, dep: number, mon = 0): Deal => ({ type: 'villa', code: '11680', dong, ym, deposit: dep, monthly: mon, area: 30, buildYear: null, renewal: null, usedRight: null });
  const ds = [mk('2025-09', '역삼동', 1), mk('2025-10', '역삼동', 100), mk('2026-09', '역삼동', 200), mk('2026-09', '삼성동', 300), { ...mk('2026-09', '어딘가', 1), code: '99999' }];
  const { stats, unknown } = aggregate(ds);
  assert.equal(stats.from, '2025-10');
  assert.equal(unknown, 1);
  assert.equal(stats.areas.find((a) => a.dong === null)?.n, 3);
  assert.equal(stats.areas.find((a) => a.dong === '역삼동')?.n, 2);
});

test('만원 표기', () => {
  assert.equal(manwon(23000), '2억 3,000만 원');
  assert.equal(manwon(10000), '1억 원');
  assert.equal(manwon(500), '500만 원');
});
