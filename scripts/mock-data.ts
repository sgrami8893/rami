// Generates a FAKE CSV (양산시 컬럼 형식) and runs it through the real pipeline, so the site can be
// built before the real CSV exists. Every name/address/phone here is invented. Replace with real data
// via `npm run update-data -- <real.csv>`.
import { writeFile, mkdir, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';

let seed = 42;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
const pickOne = <T>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];

const HOURS = [
  '평일 07:00~22:00, 토·일·공휴일 09:00~18:00',
  '평일 09:00~18:00 (주말 및 공휴일 휴무)',
  '24시간',
  '평일 07:00~23:00, 토요일 09:00~18:00, 일요일 휴무',
  '연중무휴 06:00~23:00',
  '평일 09:00~18:00',
  '청사 운영시간과 동일',
];
const DOCS = [
  '주민등록등초본, 가족관계증명서, 토지대장, 건축물대장, 지방세 납세증명',
  '주민등록등초본, 가족관계증명서, 등기부등본',
  '주민등록등초본, 토지대장',
  '주민등록등초본, 가족관계증명서, 등기부등본, 지방세 납세증명, 병적증명서',
];
const PLACES = ['주민센터', '행정복지센터', '구청 민원실', '역 대합실', '병원 로비', '도서관', '우체국'];
const FLOORS = ['1층 민원실 입구', '1층 로비', '지하 1층 대합실', '2층 복도'];

// [sido text, 시군구, 일반구?, 동 list, centre lat, lng, count]
const AREAS: [string, string, string | null, string[], number, number, number][] = [
  ['서울특별시', '강남구', null, ['역삼동', '삼성동', '대치동', '논현동', '개포동'], 37.4979, 127.0476, 12],
  ['서울특별시', '마포구', null, ['서교동', '공덕동', '망원동'], 37.5585, 126.9145, 6],
  ['서울특별시', '서초구', null, ['서초동', '반포동'], 37.4875, 127.0128, 5],
  ['경기도', '성남시', '분당구', ['정자동', '서현동', '수내동'], 37.3700, 127.1210, 6],
  ['경기도', '성남시', '수정구', ['태평동', '신흥동'], 37.4400, 127.1370, 3],
  ['경기도', '성남시', '중원구', ['성남동'], 37.4310, 127.1520, 2],
  ['인천광역시', '연수구', null, ['송도동', '연수동'], 37.3990, 126.6720, 4],
];

const header = '설치장소,설치위치,운영시간,발급민원종류,소재지도로명주소,소재지지번주소,관리기관명,전화번호,위도,경도,데이터기준일자';
const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
const rows: string[] = [header];
let n = 1;
for (const [sido, sgg, gu, dongs, lat, lng, count] of AREAS) {
  for (let i = 0; i < count; i++) {
    const dong = pickOne(dongs);
    const name = `샘플 ${dong.replace(/동$/, '')} ${pickOne(PLACES)}`;
    const area = [sido, sgg, gu].filter(Boolean).join(' ');
    rows.push([
      q(name), q(pickOne(FLOORS)), q(pickOne(HOURS)), q(pickOne(DOCS)),
      q(`${area} 샘플로 ${n}`), q(`${area} ${dong} ${100 + n}`), q(`${sgg} (샘플)`), '02-000-0000',
      (lat + (rnd() - 0.5) * 0.03).toFixed(6), (lng + (rnd() - 0.5) * 0.03).toFixed(6), '2025-11-30',
    ].join(','));
    n++;
  }
}

await mkdir('scripts/fixtures', { recursive: true });
await writeFile('scripts/fixtures/mock.csv', rows.join('\r\n'));
await rm('src/data/kiosks.json', { force: true });
// 실데이터(src/data)를 덮어쓰지 않도록 별도 폴더에 쓴다. 화면 확인용으로 쓰려면 --out 을 src/data/kiosks.json 으로 바꿔 실행.
execFileSync('node', ['scripts/build-data.ts', 'scripts/fixtures/mock.csv', '--out', 'scripts/fixtures/out/kiosks.json', '--force'], { stdio: 'inherit' });
