import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, toRecords, decodeKorean } from '../lib/csv.ts';
import { mapHeaders } from '../lib/aliases.ts';
import { parseDocs, docsFromFlags } from '../lib/docs.ts';
import { resolveRegion, regionTitle } from '../lib/regions.ts';
import { normalizeRecord, dedupeIds, attachNearby, kioskId, distanceM, type Kiosk } from '../lib/normalize.ts';

// Synthetic fixture in the 양산시 column layout. Names/addresses are made up for tests.
const CSV = [
  '설치장소,설치위치,운영시간,발급민원종류,소재지도로명주소,소재지지번주소,관리기관명,전화번호,위도,경도,데이터기준일자',
  '테스트구청,1층 로비,"평일 07:00~22:00, 토·일·공휴일 09:00~18:00","주민등록등초본, 가족관계증명서, 토지대장",서울특별시 강남구 테스트로 1,서울특별시 강남구 역삼동 100-1,서울특별시 강남구청,0234230000,37.5172,127.0473,2025-11-30',
  '테스트구청,지하1층 민원실,24시간,"등기부등본, 지방세 납세증명",서울특별시 강남구 테스트로 1,서울특별시 강남구 역삼동 100-1,서울특별시 강남구청,02-3423-0000,37.5173,127.0474,2025.11.30',
  '분당테스트센터,입구,평일 09:00~18:00,병적증명서,경기도 성남시 분당구 테스트로 2,경기도 성남시 분당구 정자동 1,성남시,0317290000,37.36,127.11,20251130',
  '부산테스트,1층,24시간,주민등록,부산광역시 해운대구 테스트로 3,,부산,0510000000,35.16,129.16,2025-11-30',
].join('\r\n');

function build() {
  const { headers, records } = toRecords(parseCsv(CSV));
  const { mapping, unknown, missingRequired } = mapHeaders(headers);
  const report = { skips: [] as any[], hoursFailures: [] as string[], unknownDocs: new Map<string, number>() };
  const list = records.map((r, i) => normalizeRecord(r, mapping, i + 2, report)).filter(Boolean) as Kiosk[];
  return { list, report, unknown, missingRequired };
}

test('headers map with no unknowns', () => {
  const { unknown, missingRequired } = build();
  assert.deepEqual(unknown, []);
  assert.deepEqual(missingRequired, []);
});

test('normalizes rows and drops non-수도권', () => {
  const { list, report } = build();
  assert.equal(list.length, 3);
  assert.equal(report.skips[0].reason, 'outside 수도권 or unknown 시군구');
  const [a, b, c] = list;
  assert.equal(a.sido, 'seoul'); assert.equal(a.sigungu, 'gangnam-gu'); assert.equal(a.dong, '역삼동');
  assert.deepEqual(a.docs, ['resident', 'family', 'land']);
  assert.equal(a.phone, '02-3423-0000'); assert.equal(b.baseDate, '2025-11-30');
  assert.equal(b.is24h, true); assert.deepEqual(b.docs, ['registry', 'tax']);
  assert.equal(c.subGu, '분당구'); assert.equal(c.sigungu, 'seongnam-si');
  assert.deepEqual(c.docs, ['other']);
  assert.equal(report.unknownDocs.get('병적증명서'), 1);
});

test('same building, different floor -> different ids', () => {
  const { list } = build();
  assert.notEqual(list[0].id, list[1].id);
  assert.match(list[0].id, /^[0-9a-f]{8}$/);
  assert.equal(kioskId('서울 강남구 테스트로 1', '테스트구청', '1층 로비'), kioskId('서울 강남구 테스트로1', '테스트구청', '1층로비'));
});

test('fully duplicated rows get -2 suffix', () => {
  const { list } = build();
  const dup = [list[0], { ...list[0] }];
  assert.equal(dedupeIds(dup), 1);
  assert.equal(dup[1].id, `${dup[0].id}-2`);
});

test('nearby within 2km, nearest first, excludes self', () => {
  const { list } = build();
  attachNearby(list);
  assert.deepEqual(list[0].nearby!.map((n) => n.id), [list[1].id]);
  assert.ok(list[0].nearby![0].m < 20);
  assert.deepEqual(list[2].nearby, []);
  assert.ok(Math.abs(distanceM({ lat: 37.5665, lng: 126.978 }, { lat: 37.4979, lng: 127.0276 }) - 8780) < 200);
});

test('docs parsing edge cases', () => {
  assert.deepEqual(parseDocs('등기부등본').docs, ['registry']);
  assert.deepEqual(parseDocs('주민등록표 등본').docs, ['resident']);
  assert.deepEqual(docsFromFlags({ resident: 'Y', family: 'N', registry: '가능' }), ['resident', 'registry']);
});

test('region title includes 일반구 names', () => {
  assert.equal(regionTitle('gyeonggi', 'seongnam-si'), '성남시(수정구·중원구·분당구) 무인민원발급기 위치·운영시간');
  assert.equal(regionTitle('seoul', 'gangnam-gu'), '강남구 무인민원발급기 위치·운영시간');
  assert.equal(resolveRegion('인천광역시 중구 테스트로 1(신포동)')?.sigungu, 'jemulpo-gu'); // 2026-07 개편 전 구명
  assert.equal(resolveRegion('인천광역시 중구 공항로 272(운서동)')?.sigungu, 'yeongjong-gu');
  assert.equal(resolveRegion('인천광역시 서구 청마로19번길 5(당하동)')?.sigungu, 'geomdan-gu');
  assert.equal(resolveRegion('인천광역시 서구 경서로55번길 7(경서동)')?.sigungu, 'seohae-gu');
  assert.equal(resolveRegion('인천광역시 서해구 서곶로 307, 서구청 (심곡동)')?.sigungu, 'seohae-gu');
  assert.equal(resolveRegion('서울 중구 테스트로 1')?.sido, 'seoul');
});

test('CP949 bytes decode', () => {
  const bytes = new Uint8Array([0xbc, 0xb3, 0xc4, 0xa1, 0xc0, 0xe5, 0xbc, 0xd2]); // "설치장소" in EUC-KR
  assert.deepEqual(decodeKorean(bytes), { text: '설치장소', encoding: 'euc-kr' });
});

test('region stats aggregate', async () => {
  const { regionStats } = await import('../lib/stats.ts');
  const { list } = build();
  const [gn, sn] = regionStats(list).sort((a, b) => b.sido.localeCompare(a.sido));
  assert.equal(gn.sigungu, 'gangnam-gu'); assert.equal(gn.total, 2); assert.equal(gn.is24h, 1);
  assert.equal(gn.openWeekend, 2); assert.equal(gn.openAfter22, 2); assert.equal(gn.docs.registry, 1);
  assert.deepEqual(gn.byDong, { '역삼동': 2 });
  assert.deepEqual(sn.bySubGu, { '수정구': 0, '중원구': 0, '분당구': 1 });
  assert.equal(sn.openWeekend, 0);
});
