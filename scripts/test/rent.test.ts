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
  const { stats, unknown } = aggregate(ds, { now: new Date('2026-11-26T01:00:00Z') });
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

test('국토부 실거래가 API의 정상 코드 000을 받아들인다', async () => {
  const { parsePage } = await import('../lib/parking-api.ts');
  const p = parsePage('<response><header><resultCode>000</resultCode><resultMsg>OK</resultMsg></header><body><items><item><umdNm>역삼동</umdNm></item></items><totalCount>1</totalCount></body></response>');
  assert.equal(p.totalCount, 1);
  assert.equal(p.items[0].umdNm, '역삼동');
  assert.throws(() => parsePage('<response><header><resultCode>030</resultCode><resultMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</resultMsg></header></response>'));
});

test('개편 지역: 범위 탐색으로 찾은 새 코드도 시·군·구로 판정', async () => {
  const { regionOfDeal } = await import('../lib/rent-lawd.ts');
  assert.equal(regionOfDeal('41192', '심곡동')?.sigungu, 'bucheon-si');
  assert.equal(regionOfDeal('41593', '반송동')?.sigungu, 'hwaseong-si');
  assert.equal(regionOfDeal('28115', '운서동')?.sigunguName, '영종구');
  assert.equal(regionOfDeal('28265', '당하동')?.sigunguName, '검단구');
  assert.equal(regionOfDeal('28265', '청라동')?.sigunguName, '서해구');
  assert.equal(regionOfDeal('28116', '송림동')?.sigunguName, '제물포구');
  assert.equal(regionOfDeal('28110', '운서동')?.sigunguName, '영종구'); // 옛 코드(개편 전 달)
  assert.equal(regionOfDeal('99999', '어딘가'), null);
});

test('수집한 이번 달(신고 덜 들어옴)은 집계에서 뺀다', () => {
  const mk = (ym: string): Deal => ({ type: 'villa', code: '11680', dong: '역삼동', ym, deposit: 100, monthly: 0, area: 30, buildYear: null, renewal: null, usedRight: null });
  const { stats } = aggregate([mk('2025-11'), mk('2026-10'), mk('2026-11')], { now: new Date('2026-11-26T01:00:00Z') });
  assert.deepEqual([stats.from, stats.to], ['2025-11', '2026-10']);
  assert.equal(stats.areas.find((a) => a.dong === null)?.n, 2);
});

test('개편 후 코드를 표에 고정', async () => {
  const { regionOfDeal } = await import('../lib/rent-lawd.ts');
  assert.equal(regionOfDeal('41597', '반송동')?.subGu, '동탄구');
  assert.equal(regionOfDeal('28290', '당하동')?.sigunguName, '검단구');
  assert.equal(regionOfDeal('28125', '만석동')?.sigunguName, '제물포구');
});

test('범위는 P10~P90, 10건 미만이면 생략, 옛 파일은 P25~P75', async () => {
  const { bandText } = await import('../lib/rent.ts');
  const d = dist(Array.from({ length: 20 }, (_, i) => i + 1))!;
  assert.equal(bandText(d, String)?.label, '거래 80%가');
  assert.equal(bandText(dist([1, 2, 3, 4, 5]), String), null);
  const { p10, p90, ...old } = d;
  assert.equal(bandText(old as typeof d, String)?.label, '거래 절반이');
});

test('동 색인: 시·군·구에 10건+ 동이 4곳 이상이어야', async () => {
  const { dongIndexable } = await import('../lib/rent.ts');
  const mk = (dong: string | null, n: number) => ({ sido: 'seoul', sigungu: 'x', sigunguName: 'X구', dong, n, byType: {} }) as any;
  const three = { from: '', to: '', generatedAt: '', isMock: false, areas: [mk(null, 300), mk('가동', 100), mk('나동', 100), mk('다동', 100)] };
  assert.equal(dongIndexable(three, three.areas[1]), false);
  const four = { ...three, areas: [...three.areas, mk('라동', 10)] };
  assert.equal(dongIndexable(four, four.areas[1]), true);
});

test('기준금리 3.25%(2026-11-26 인상) → 전환율 상한 5.25%', async () => {
  const { BASE_RATE } = await import('../lib/rent-calc.ts');
  assert.equal(BASE_RATE, 3.25);
  assert.equal(conversionRate(), 5.25);
});

test('사이트맵 제외 경로는 페이지 noindex 기준과 같다', async () => {
  const { rentNoindexPaths } = await import('../lib/rent.ts');
  const mk = (dong: string | null, n: number) => ({ sido: 'seoul', sigungu: 'x', sigunguName: 'X구', dong, n, byType: {} }) as any;
  const s = { from: '', to: '', generatedAt: '', isMock: false, areas: [mk(null, 20), mk('가동', 12), mk('나동', 5)] };
  assert.deepEqual([...rentNoindexPaths(s)].sort(), ['/rent/seoul/x/', `/rent/seoul/x/${encodeURIComponent('가동')}/`]);
});
