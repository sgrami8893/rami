import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calcFee, dayMinutes, feeText, sortValue, feeBreakdown } from '../lib/parking-fee.ts';
import { normalizeParking, FIELD } from '../lib/parking.ts';
import { parsePage, resolveMapping, toRow } from '../lib/parking-api.ts';

const fee = (o: Partial<Record<string, number | null>> & { type?: string }) => ({
  hours: { weekday: ['09:00', '18:00'] as [string, string], sat: null, holiday: null },
  fee: { type: (o.type ?? 'paid') as 'paid', baseMin: 30, baseFee: 1000, unitMin: 10, unitFee: 300, dayPass: null, monthly: null, ...o },
});

test('기본시간 안은 기본요금, 넘으면 추가단위 올림', () => {
  const l = fee({});
  assert.deepEqual(calcFee(l, 30), { status: 'ok', amount: 1000, capped: false, base: 1000, extraUnits: 0 });
  assert.equal((calcFee(l, 31) as any).amount, 1300); // 1분 넘어도 1단위
  assert.equal((calcFee(l, 60) as any).amount, 1000 + 3 * 300);
  assert.equal((calcFee(l, 120) as any).amount, 1000 + 9 * 300);
  assert.equal(feeBreakdown(l, calcFee(l, 120)), '기본 30분 1,000원 + 추가 10분당 300원 × 9');
});

test('1일권 상한', () => {
  const l = fee({ dayPass: 5000 });
  const r = calcFee(l, 180) as any;
  assert.equal(r.amount, 5000); assert.equal(r.capped, true);
  assert.match(feeBreakdown(l, r), /1일권 5,000원 적용/);
  assert.equal((calcFee(l, 60) as any).capped, false);
});

test('무료·혼합·정보 없음', () => {
  assert.equal(feeText(calcFee(fee({ type: 'free' }), 120)), '무료');
  assert.equal(calcFee(fee({ type: 'mixed' }), 60).status, 'none');
  assert.equal(feeText(calcFee(fee({ type: 'unknown' }), 60)), '요금 정보 없음');
  assert.equal(feeText(calcFee(fee({ baseFee: null }), 60)), '요금 정보 없음');
  assert.equal(feeText(calcFee(fee({ baseMin: 0 }), 60)), '요금 정보 없음');
  // 기본요금만 있고 추가 단위가 비면, 기본시간 안은 계산하고 넘으면 정보 없음
  const partial = fee({ unitMin: null, unitFee: null });
  assert.equal(feeText(calcFee(partial, 30)), '1,000원');
  assert.match(feeText(calcFee(partial, 60)), /이후 요금 정보 없음/);
  assert.equal(sortValue(calcFee(fee({ type: 'free' }), 120)), 0);
  assert.equal(sortValue(calcFee(fee({ type: 'unknown' }), 120)), Infinity);
});

test('종일 = 평일 운영시간 길이(24시간·정보 없음은 24시간, 야간 운영은 자정을 넘김)', () => {
  assert.equal(dayMinutes({ hours: { weekday: ['09:00', '18:00'], sat: null, holiday: null } }), 540);
  assert.equal(dayMinutes({ hours: { weekday: '24h', sat: null, holiday: null } }), 1440);
  assert.equal(dayMinutes({ hours: { weekday: null, sat: null, holiday: null } }), 1440);
  assert.equal(dayMinutes({ hours: { weekday: ['22:00', '06:00'], sat: null, holiday: null } }), 480);
});

test('실제 응답 형식: 빈 태그 요금·23:59 종료·무료인데 basicTime=30', () => {
  const page = parsePage(readFileSync(new URL('../fixtures/parking-api-sample.xml', import.meta.url), 'utf8'));
  const m = resolveMapping(Object.keys(page.items[0]));
  const l = normalizeParking(toRow(page.items[0], m.map))!;
  assert.equal(l.hours.weekday, '24h');
  assert.equal(dayMinutes(l), 1440);
  assert.equal(feeText(calcFee(l, 120)), '무료');
  // 같은 행을 유료로 바꾸고 요금 칸이 빈 태그면 '요금 정보 없음'
  const paidEmpty = normalizeParking({ ...toRow(page.items[0], m.map), [FIELD.feeInfo]: '유료' })!;
  assert.equal(paidEmpty.fee.baseMin, 30);
  assert.equal(feeText(calcFee(paidEmpty, 120)), '요금 정보 없음');
});

test('무료 허브 색인 기준·운영시간 변환', async () => {
  const { freeSigunguIndexable, lotHours } = await import('../lib/parking.ts');
  const { isOpenAt } = await import('../lib/hours.ts');
  const mk = (type: string) => ({ fee: { type } }) as never;
  assert.equal(freeSigunguIndexable([...Array(5)].map(() => mk('free')).concat([mk('paid')])).indexable, true); // 5/6 = 83%
  assert.equal(freeSigunguIndexable([...Array(5)].map(() => mk('free'))).indexable, false); // 100% → 중복 페이지
  assert.equal(freeSigunguIndexable([...Array(4)].map(() => mk('free')).concat([mk('paid'), mk('paid')])).indexable, false); // 4곳
  const h = lotHours({ hours: { weekday: '24h', sat: ['09:00', '13:00'], holiday: null } });
  const at = (ymd: string, dow: number, minutes: number) => isOpenAt(h, { ymd, dow, minutes }, new Set(['2026-12-25']));
  assert.equal(at('2026-11-25', 3, 23 * 60 + 59), true); // 평일 24시간
  assert.equal(at('2026-11-28', 6, 14 * 60), false); // 토 13시 마감
  assert.equal(at('2026-11-29', 0, 10 * 60), null); // 일요일 = 공휴일 시간 정보 없음 → 판정 불가
});
