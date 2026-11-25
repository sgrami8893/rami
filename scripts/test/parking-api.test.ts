import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveMapping, toRow, parsePage, buildUrl, redact, API_FIELD } from '../lib/parking-api.ts';
import { FIELD } from '../lib/parking.ts';
import { readFileSync } from 'node:fs';
import { normalizeParking } from '../lib/parking.ts';

// 실제 응답 필드명(2026-11-25 사용자 제공 응답 기준, 오타 포함) 34개. 요청변수 표의 instt_code/instt_nm 대신 insttCode/insttNm으로 온다
const API_KEYS = ['prkplceNo', 'prkplceNm', 'prkplceSe', 'prkplceType', 'rdnmadr', 'lnmadr', 'prkcmprt', 'feedingSe', 'enforceSe', 'operDay',
  'weekdayOperOpenHhmm', 'weekdayOperColseHhmm', 'satOperOperOpenHhmm', 'satOperCloseHhmm', 'holidayOperOpenHhmm', 'holidayCloseOpenHhmm',
  'parkingchrgeInfo', 'basicTime', 'basicCharge', 'addUnitTime', 'addUnitCharge', 'dayCmmtktAdjTime', 'dayCmmtkt', 'monthCmmtkt', 'metpay',
  'spcmnt', 'institutionNm', 'phoneNumber', 'latitude', 'longitude', 'pwdbsPpkZoneYn', 'referenceDate', 'insttCode', 'insttNm'];

const sample = {
  prkplceNo: '123-4-000001', prkplceNm: '테헤란로 공영주차장', prkplceSe: '공영', prkplceType: '노외', rdnmadr: '서울특별시 강남구 테헤란로 10', lnmadr: '',
  prkcmprt: '120', feedingSe: '1', enforceSe: '미시행', operDay: '평일+토요일+공휴일', weekdayOperOpenHhmm: '09:00', weekdayOperColseHhmm: '21:00',
  satOperOperOpenHhmm: '09:00', satOperCloseHhmm: '18:00', holidayOperOpenHhmm: '', holidayCloseOpenHhmm: '', parkingchrgeInfo: '유료',
  basicTime: '30', basicCharge: '1000', addUnitTime: '10', addUnitCharge: '300', dayCmmtktAdjTime: '', dayCmmtkt: '', monthCmmtkt: '', metpay: '카드',
  spcmnt: '', institutionNm: '강남구도시관리공단', phoneNumber: '02-000-0000', latitude: '37.50', longitude: '127.04', pwdbsPpkZoneYn: 'Y',
  referenceDate: '2026-10-01', insttCode: '3220000', insttNm: '서울특별시 강남구',
};

test('요청변수 34개가 표준 헤더 34개와 1:1로 매핑된다', () => {
  assert.equal(API_KEYS.length, 34);
  assert.equal(Object.keys(FIELD).length, 34);
  const m = resolveMapping(API_KEYS);
  assert.equal(m.mode, 'english');
  assert.deepEqual(m.missingRequired, []);
  assert.deepEqual(m.missingOptional, []);
  assert.deepEqual(m.unknownKeys, []);
  assert.equal(new Set(Object.values(m.map)).size, 34);
  assert.equal(m.map.wdClose, 'weekdayOperColseHhmm');
  assert.equal(m.map.holClose, 'holidayCloseOpenHhmm');
  assert.equal(m.map.satOpen, 'satOperOperOpenHhmm');
  for (const k of Object.keys(API_FIELD)) assert.ok(API_FIELD[k as keyof typeof API_FIELD].length);
});

test('필드명 대소문자·밑줄이 달라도 찾고, 필수 필드가 빠지면 알린다', () => {
  const m = resolveMapping(API_KEYS.map((k) => (k === 'insttCode' ? 'instt_code' : k)));
  assert.equal(m.map.providerCode, 'instt_code');
  const m2 = resolveMapping(API_KEYS.filter((k) => k !== 'rdnmadr' && k !== 'latitude'));
  assert.equal(m2.missingRequired.length, 2);
});

test('한글 헤더 응답이면 그대로 쓴다', () => {
  const m = resolveMapping(Object.values(FIELD));
  assert.equal(m.mode, 'korean');
  assert.deepEqual(m.missingRequired, []);
});

test('응답 항목 → 한글 행 → 정규화', () => {
  const m = resolveMapping(Object.keys(sample));
  const lot = normalizeParking(toRow(sample, m.map));
  assert.ok(lot);
  assert.equal(lot.id, '3220000-123-4-000001');
  assert.equal(lot.sigungu, 'gangnam-gu');
  assert.deepEqual(lot.hours.weekday, ['09:00', '21:00']);
  assert.equal(lot.fee.type, 'paid');
  assert.equal(lot.disabledSpots, true);
});

test('응답 해석: items.item 배열·단건·빈값·오류', () => {
  const wrap = (items: unknown, total = 1) => JSON.stringify({ response: { header: { resultCode: '00', resultMsg: 'NORMAL_SERVICE' }, body: { items, totalCount: String(total), pageNo: '1', numOfRows: '10' } } });
  assert.equal(parsePage(wrap([sample])).items.length, 1);
  assert.equal(parsePage(wrap({ item: [sample, sample] }, 2)).items.length, 2);
  assert.equal(parsePage(wrap({ item: sample })).items.length, 1);
  assert.equal(parsePage(wrap('', 0)).items.length, 0);
  assert.equal(parsePage(wrap([sample], 18000)).totalCount, 18000);
  assert.throws(() => parsePage(JSON.stringify({ response: { header: { resultCode: '30', resultMsg: 'SERVICE_KEY_IS_NOT_REGISTERED_ERROR' } } })), /30/);
  assert.throws(() => parsePage('<OpenAPI_ServiceResponse><cmmMsgHeader><errMsg>SERVICE ERROR</errMsg><returnAuthMsg>SERVICE_KEY_IS_NOT_REGISTERED_ERROR</returnAuthMsg><returnReasonCode>30</returnReasonCode></cmmMsgHeader></OpenAPI_ServiceResponse>'), /SERVICE_KEY_IS_NOT_REGISTERED_ERROR/);
  assert.throws(() => parsePage('Unexpected errors'), /JSON이 아닌/);
});

test('인증키는 인코딩 규칙대로 붙고, 로그에서는 가려진다', () => {
  const dec = 'abc+/=def';
  const enc = 'abc%2B%2F%3Ddef';
  assert.match(buildUrl(dec, 2, 100), /serviceKey=abc%2B%2F%3Ddef&pageNo=2&numOfRows=100&type=json$/);
  assert.match(buildUrl(enc, 1, 10), /serviceKey=abc%2B%2F%3Ddef&/);
  const msg = redact(`fetch failed ${buildUrl(dec, 1, 1)} key=${dec}`, dec);
  assert.ok(!msg.includes('abc'), msg);
});

test('실제 XML 응답 픽스처: 빈 태그·24시간(00:00~23:59)·무료인데 기본시간 값·구획 0', () => {
  const page = parsePage(readFileSync(new URL('../fixtures/parking-api-sample.xml', import.meta.url), 'utf8'));
  assert.equal(page.totalCount, 19012);
  assert.equal(page.items.length, 2);
  const m = resolveMapping(Object.keys(page.items[0]));
  assert.deepEqual(m.missingRequired, []);
  assert.deepEqual(m.unknownKeys, []);
  const [a, b] = page.items.map((i) => normalizeParking(toRow(i, m.map))!);
  assert.equal(a.sigungu, 'pocheon-si');
  assert.equal(a.roadAddress, '');
  assert.equal(a.jibunAddress, '경기도 포천시 소흘읍 송우리 76-24');
  assert.equal(a.id, '5600000-236-2-000066');
  assert.equal(a.hours.weekday, '24h');
  assert.equal(a.hours.holiday, '24h');
  assert.deepEqual(a.flags, []);
  assert.equal(a.fee.type, 'free');
  assert.equal(a.fee.baseMin, null); // 무료면 basicTime=30 무시
  assert.equal(a.spaces, 18);
  assert.equal(a.disabledSpots, null);
  assert.equal(b.spaces, null); // 0 = 미상
  assert.equal(b.roadAddress, '경기도 포천시 관인면 관인로 14');
});
