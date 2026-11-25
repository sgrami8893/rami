import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyFee, dayHours, normalizeParking, missingFields, FIELD, freeHubIndexable, lotIndexable, regionIndexable, type ParkingLot } from '../lib/parking.ts';

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

test('헤더 34개(잠정) 매핑과 필수 필드 검증', () => {
  const header = ['주차장관리번호', '주차장명', '주차장구분', '주차장유형', '소재지도로명주소', '소재지지번주소', '주차구획수', '급지구분', '부제시행구분', '운영요일', '평일운영시작시각', '평일운영종료시각', '토요일운영시작시각', '토요일운영종료시각', '공휴일운영시작시각', '공휴일운영종료시각', '요금정보', '주차기본시간', '주차기본요금', '추가단위시간', '추가단위요금', '1일주차권요금적용시간', '1일주차권요금', '월정기권요금', '결제방법', '특기사항', '관리기관명', '전화번호', '위도', '경도', '장애인전용주차구역보유여부', '데이터기준일자', '제공기관코드', '제공기관명'];
  assert.equal(header.length, 34);
  assert.deepEqual(Object.values(FIELD).filter((f) => !header.includes(f)), []); // FIELD의 모든 이름이 헤더에 있음
  assert.deepEqual(missingFields(header), []);
  assert.deepEqual(missingFields(header.filter((h) => h !== '위도')), ['위도']);
  const l = normalizeParking(row({ id: '123', providerCode: '3220000', name: 'A', road: '서울특별시 강남구 테헤란로 1', disabled: 'Y' }))!;
  assert.equal(l.id, '3220000-123'); assert.equal(l.disabledSpots, true);
});
