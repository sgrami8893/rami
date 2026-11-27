import { test } from 'node:test';
import assert from 'node:assert/strict';
import { jibunKey, utmkToWgs84, wgs84ToUtmk, parseJusoLine } from '../lib/juso-geo.ts';
import { buildBuildings, monthIndex } from '../lib/rent-buildings.ts';
import { normalizeDeal, type Deal } from '../lib/rent.ts';

test('지번 정규화', () => {
  assert.equal(jibunKey('123-4'), '123-4');
  assert.equal(jibunKey('0123-0'), '123');
  assert.equal(jibunKey('산 12-3'), '산12-3');
  assert.equal(jibunKey(' 45 '), '45');
  assert.equal(jibunKey(''), null);
  assert.equal(jibunKey('0'), null);
  assert.equal(jibunKey('12*'), null);
});

test('UTM-K ↔ WGS84', () => {
  const [lat, lng] = utmkToWgs84(1_000_000, 2_000_000);
  assert.ok(Math.abs(lat - 38) < 1e-7 && Math.abs(lng - 127.5) < 1e-7);
  for (const [a, b] of [[37.5665, 126.978], [37.2636, 127.0286], [37.4563, 126.7052]]) {
    const [x, y] = wgs84ToUtmk(a, b);
    const [a2, b2] = utmkToWgs84(x, y);
    assert.ok(Math.abs(a - a2) < 1e-6 && Math.abs(b - b2) < 1e-6, `${a},${b}`);
  }
  // 서울시청 근처는 UTM-K로 대략 x 95만·y 195만
  const [x, y] = wgs84ToUtmk(37.5665, 126.978);
  assert.ok(x > 950_000 && x < 958_000 && y > 1_948_000 && y < 1_956_000, `${x},${y}`);
});

test('주소 DB 한 줄: 열 위치를 모양으로 찾는다', () => {
  const [x, y] = wgs84ToUtmk(37.556, 126.905);
  const row = ['1144012400', '서울특별시', '마포구', '망원동', '', '0', '0412', '0007', '114403113012', '월드컵로', '0', '25', '0', '1144071000', '망원1동', '03960', '', '20120101', '0', '', '', '', '', '', String(x.toFixed(6)), String(y.toFixed(6)), '953000', '1951000'].join('|');
  const r = parseJusoLine(row)!;
  assert.equal(r.code5, '11440'); assert.equal(r.dong, '망원동'); assert.equal(r.jibun, '412-7');
  assert.equal(r.road, '114403113012/0/25/0');
  assert.ok(r.xy && Math.abs(r.xy[0] - x) < 1);
  const ri = parseJusoLine(['4157025023', '경기도', '김포시', '통진읍', '마송리', '1', '12', '0', '415703000001', '도로', '0', '1', '0'].join('|'))!;
  assert.equal(ri.dong, '통진읍 마송리'); assert.equal(ri.jibun, '산12'); assert.equal(ri.xy, null);
  assert.equal(parseJusoLine('헤더|아님'), null);
});

test('건물별 이력: 층은 저장하지 않고, 연월·금액·면적만', () => {
  const item = { sggCd: '11440', umdNm: '망원동', jibun: '412-7', mhouseNm: '망원하우스', floor: '3', dealYear: '2026', dealMonth: '5', dealDay: '20', deposit: '13,000', monthlyRent: '0', excluUseAr: '46.12', buildYear: '2015' };
  const d = normalizeDeal(item, 'villa')!;
  assert.equal(d.jibun, '412-7'); assert.equal(d.bname, '망원하우스');
  assert.ok(!JSON.stringify(d).includes('"floor"'));
  const ds: Deal[] = [d, { ...d, ym: '2025-05', deposit: 15000 }, { ...d, ym: '2024-04', deposit: 12000, monthly: 30, area: 46.3 }];
  const r = buildBuildings(ds, () => [37.556, 126.905], { now: new Date(Date.UTC(2026, 10, 20)) });
  assert.equal(r.buildings, 1); assert.equal(r.located, 1);
  const f = r.files[0];
  assert.equal(f.sido, 'seoul'); assert.equal(f.from, '2023-06'); assert.equal(f.to, '2026-05');
  const [slug, dong, jibun, name, t, by, lat, lng, units] = f.b[0];
  assert.deepEqual([slug, dong, jibun, name, t, by, lat, lng], ['mapo-gu', '망원동', '412-7', '망원하우스', 0, 2015, 37.556, 126.905]);
  assert.deepEqual(units, [[46.1, monthIndex('2025-05', '2025-05') + 23, 15000, 0, 35, 13000, 0], [46.3, 10, 12000, 30]]);
  const text = JSON.stringify(f);
  assert.ok(!/floor|"3층"|dealDay|"20"/.test(text));
});

test('내비게이션용DB 건물 파일(지번 없음, 도로명 + 좌표)도 읽고, 관련지번 줄과 같은 키를 만든다', () => {
  const [x, y] = wgs84ToUtmk(37.556, 126.905);
  // 건물 파일 모양(추정): 법정동코드 | 시도 | 시군구 | 읍면동 | 도로명코드 | 도로명 | 지하 | 본번 | 부번 | 우편번호 | 건물관리번호 | … | 중심 X | 중심 Y
  const b = parseJusoLine(['1144012400', '서울특별시', '마포구', '망원동', '114403113012', '월드컵로', '0', '25', '0', '03951', '1144012400104120007000001', '망원하우스', '공동주택', '4', '0', String(x), String(y)].join('|'))!;
  assert.equal(b.jibun, null); assert.equal(b.road, '114403113012/0/25/0'); assert.ok(b.xy && Math.abs(b.xy[0] - x) < 1);
  // 관련지번 파일 모양: 지번 뒤 도로명코드 | 지하 | 본번 | 부번 (도로명 글자 없음)
  const j = parseJusoLine(['1144012400', '서울특별시', '마포구', '망원동', '', '0', '412', '7', '114403113012', '0', '25', '0'].join('|'))!;
  assert.equal(j.jibun, '412-7'); assert.equal(j.road, b.road); assert.equal(j.xy, null);
});

test('지난번 건물 파일 좌표 이어받기(자동 갱신)', async () => {
  const { prevCoords } = await import('../lib/rent-buildings.ts');
  const p = prevCoords([{ sido: 'seoul', b: [['gangnam-gu', '역삼동', '123-4', 'A빌라', 0, 2010, 37.5, 127.03, []], ['gangnam-gu', '역삼동', '5', '', 0, 0, null, null, []]] }]);
  assert.equal(p.size, 1);
  assert.deepEqual(p.lookup('11680', '역삼동', '123-4'), [37.5, 127.03]);
  assert.equal(p.lookup('11680', '역삼동', '5'), null);
  assert.equal(p.lookup('11650', '역삼동', '123-4'), null); // 다른 구
});

test('캐시용 슬림 항목: 층·계약일 제거', async () => {
  const { slimItem } = await import('../lib/rent.ts');
  const s = slimItem({ sggCd: '11680', umdNm: '역삼동', dealYear: '2026', dealMonth: '10', dealDay: '3', floor: '4', deposit: '1,000', monthlyRent: '50', excluUseAr: '30', jibun: '1', mhouseNm: 'A', contractTerm: '26.01~28.01' });
  assert.equal('floor' in s, false); assert.equal('dealDay' in s, false); assert.equal('contractTerm' in s, false);
  assert.equal(s.deposit, '1,000'); assert.equal(s.mhouseNm, 'A');
});
