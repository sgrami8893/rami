import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyFee, dayHours, normalizeParking, FIELD, freeHubIndexable, lotIndexable, regionIndexable, type ParkingLot } from '../lib/parking.ts';

// NOTE: 손으로 만든 행이다. 실제 CSV 헤더·행을 받으면 교체한다.
test('무료 판정: 요금정보 무료 + 요금 0/빈값만 free', () => {
  assert.deepEqual(classifyFee('무료', [null, 0]), { type: 'free', conflict: false });
  assert.deepEqual(classifyFee('무료', [500]), { type: 'unknown', conflict: true });
  assert.equal(classifyFee('유료', [600]).type, 'paid');
  assert.equal(classifyFee('', [0]).type, 'unknown');
});
test('운영시간', () => {
  assert.equal(dayHours('00:00', '24:00').h, '24h');
  assert.deepEqual(dayHours('00:00', '00:00'), { h: '24h', ambiguous: true });
  assert.deepEqual(dayHours('0900', '1800').h, ['09:00', '18:00']);
  assert.equal(dayHours('', '').h, null);
});
const row = (o: Partial<Record<keyof typeof FIELD, string>>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [FIELD[k as keyof typeof FIELD], v]));
test('정규화: 지역·좌표 범위', () => {
  const l = normalizeParking(row({ name: 'A', road: '서울특별시 강남구 테헤란로 1', lat: '37.5', lng: '127.0', feeInfo: '무료' }))!;
  assert.equal(l.sido, 'seoul'); assert.equal(l.sigungu, 'gangnam-gu'); assert.equal(l.fee.type, 'free');
  const far = normalizeParking(row({ name: 'B', road: '서울특별시 강남구 테헤란로 1', lat: '35.1', lng: '129.0' }))!;
  assert.equal(far.lat, null); assert.ok(far.flags.includes('coordOutOfRange'));
  assert.equal(normalizeParking(row({ name: 'C', road: '부산광역시 해운대구 1' })), null);
});
test('색인 기준', () => {
  const mk = (sg: string, fee: 'free' | 'paid') => ({ sido: 'seoul', sigungu: sg, fee: { type: fee } }) as unknown as ParkingLot;
  const lots = [...Array(10)].flatMap((_, i) => [mk(`a${i % 4}`, 'free'), mk(`a${i % 4}`, 'free'), mk('b', 'paid')]);
  const st = freeHubIndexable(lots, 'seoul');
  assert.equal(st.count, 20); assert.equal(st.indexable, true);
  assert.equal(freeHubIndexable(lots.filter((l) => l.fee.type === 'free'), 'seoul').indexable, false); // 100% 무료 → 시·도 페이지와 같은 목록
  assert.equal(regionIndexable(2), false);
  assert.equal(lotIndexable({ roadAddress: 'x', fee: { type: 'unknown' }, hours: { weekday: null, sat: null, holiday: null } } as unknown as ParkingLot), false);
});
