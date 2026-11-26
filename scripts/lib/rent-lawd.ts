// 전월세 실거래가 API 호출용 지역코드(LAWD_CD = 법정동코드 앞 5자리) → 동네콕콕 시·군·구 slug.
// 서울·경기 대부분은 기존 코드(기억 기준, 2026-11-25 작성). VERIFY 표시는 개편으로 코드가 바뀌었을 수 있는 곳:
//   - 인천 2026-07 개편(제물포구·영종구·서해구·검단구): 새 코드 미확인 → 옛 코드(중구·동구·서구)로 조회 후 법정동으로 새 구 판정.
//   - 부천시 2024-01 일반구 재설치, 화성시 2026 일반구 설치: 구별 코드 미확인 → 시 코드로 조회.
// 수집 스크립트(--codes)가 코드마다 건수를 찍어 주므로, 0건인 코드는 행정표준코드관리시스템(code.go.kr)에서 확인해 고친다.
import { SIGUNGU, type SidoSlug } from './regions.ts';

export interface Lawd { code: string; sido: SidoSlug; city: string; gu?: string; verify?: string }

const L = (code: string, sido: SidoSlug, city: string, gu?: string, verify?: string): Lawd => ({ code, sido, city, gu, verify });

export const LAWD: Lawd[] = [
  ...([
    ['11110', '종로구'], ['11140', '중구'], ['11170', '용산구'], ['11200', '성동구'], ['11215', '광진구'], ['11230', '동대문구'],
    ['11260', '중랑구'], ['11290', '성북구'], ['11305', '강북구'], ['11320', '도봉구'], ['11350', '노원구'], ['11380', '은평구'],
    ['11410', '서대문구'], ['11440', '마포구'], ['11470', '양천구'], ['11500', '강서구'], ['11530', '구로구'], ['11545', '금천구'],
    ['11560', '영등포구'], ['11590', '동작구'], ['11620', '관악구'], ['11650', '서초구'], ['11680', '강남구'], ['11710', '송파구'], ['11740', '강동구'],
  ] as const).map(([c, n]) => L(c, 'seoul', n)),
  L('41111', 'gyeonggi', '수원시', '장안구'), L('41113', 'gyeonggi', '수원시', '권선구'), L('41115', 'gyeonggi', '수원시', '팔달구'), L('41117', 'gyeonggi', '수원시', '영통구'),
  L('41131', 'gyeonggi', '성남시', '수정구'), L('41133', 'gyeonggi', '성남시', '중원구'), L('41135', 'gyeonggi', '성남시', '분당구'),
  L('41150', 'gyeonggi', '의정부시'), L('41171', 'gyeonggi', '안양시', '만안구'), L('41173', 'gyeonggi', '안양시', '동안구'),
  L('41190', 'gyeonggi', '부천시', undefined, '2024-01 일반구 재설치 후 구별 코드(41192·41194·41196 추정) 확인'),
  L('41210', 'gyeonggi', '광명시'), L('41220', 'gyeonggi', '평택시'), L('41250', 'gyeonggi', '동두천시'),
  L('41271', 'gyeonggi', '안산시', '상록구'), L('41273', 'gyeonggi', '안산시', '단원구'),
  L('41281', 'gyeonggi', '고양시', '덕양구'), L('41285', 'gyeonggi', '고양시', '일산동구'), L('41287', 'gyeonggi', '고양시', '일산서구'),
  L('41290', 'gyeonggi', '과천시'), L('41310', 'gyeonggi', '구리시'), L('41360', 'gyeonggi', '남양주시'), L('41370', 'gyeonggi', '오산시'),
  L('41390', 'gyeonggi', '시흥시'), L('41410', 'gyeonggi', '군포시'), L('41430', 'gyeonggi', '의왕시'), L('41450', 'gyeonggi', '하남시'),
  L('41461', 'gyeonggi', '용인시', '처인구'), L('41463', 'gyeonggi', '용인시', '기흥구'), L('41465', 'gyeonggi', '용인시', '수지구'),
  L('41480', 'gyeonggi', '파주시'), L('41500', 'gyeonggi', '이천시'), L('41550', 'gyeonggi', '안성시'), L('41570', 'gyeonggi', '김포시'),
  L('41590', 'gyeonggi', '화성시', undefined, '2026 일반구 설치 후 구별 코드 확인'),
  L('41610', 'gyeonggi', '광주시'), L('41630', 'gyeonggi', '양주시'), L('41650', 'gyeonggi', '포천시'), L('41670', 'gyeonggi', '여주시'),
  L('41800', 'gyeonggi', '연천군'), L('41820', 'gyeonggi', '가평군'), L('41830', 'gyeonggi', '양평군'),
  // 인천: 옛 코드로 조회하고, 개편 지역은 법정동으로 새 구를 정한다(incheonGu)
  L('28110', 'incheon', '중구', undefined, '2026-07 제물포구·영종구로 개편: 새 코드 확인'), L('28140', 'incheon', '동구', undefined, '2026-07 제물포구로 통합: 새 코드 확인'),
  L('28177', 'incheon', '미추홀구'), L('28185', 'incheon', '연수구'), L('28200', 'incheon', '남동구'), L('28237', 'incheon', '부평구'),
  L('28245', 'incheon', '계양구'), L('28260', 'incheon', '서구', undefined, '2026-07 서해구·검단구로 개편: 새 코드 확인'),
  L('28710', 'incheon', '강화군'), L('28720', 'incheon', '옹진군'),
  // 2026-11-26 사용자 PC 범위 탐색(--codes)으로 찾은 개편 후 코드. 화성 구 이름은 법정동으로 본 추정(페이지는 화성시로 묶음)
  L('41192', 'gyeonggi', '부천시', '원미구'), L('41194', 'gyeonggi', '부천시', '소사구'), L('41196', 'gyeonggi', '부천시', '오정구'),
  L('41591', 'gyeonggi', '화성시', '만세구'), L('41593', 'gyeonggi', '화성시', '효행구'), L('41595', 'gyeonggi', '화성시', '병점구'), L('41597', 'gyeonggi', '화성시', '동탄구'),
  L('28125', 'incheon', '제물포구'), L('28155', 'incheon', '영종구'), L('28275', 'incheon', '서해구'), L('28290', 'incheon', '검단구'),
];

const YEONGJONG = ['중산동', '운남동', '운서동', '운북동', '을왕동', '남북동', '덕교동', '무의동'];
const GEOMDAN = ['마전동', '당하동', '원당동', '불로동', '대곡동', '오류동', '왕길동', '금곡동'];
function incheonGu(city: string, dong: string): string {
  if (city === '중구') return YEONGJONG.includes(dong) ? '영종구' : '제물포구';
  if (city === '동구') return '제물포구';
  if (city === '서구') return GEOMDAN.includes(dong) ? '검단구' : '서해구';
  return city;
}

// 개편으로 새 코드가 생긴 곳(2026-11-26 --codes에서 옛 코드 0건 확인: 부천 41190, 화성 41590, 인천 28110·28140·28260).
// 새 코드를 몰라서 수집 스크립트가 아래 범위를 훑어 거래가 있는 코드를 찾는다(discoverCodes). 옛 코드는 지난달 거래용으로 계속 조회.
export const PROBE_RANGES: { from: number; to: number; label: string }[] = [
  { from: 41191, to: 41199, label: '부천시 일반구' },
  { from: 41591, to: 41599, label: '화성시 일반구' },
  { from: 28100, to: 28299, label: '인천 개편 구' },
];
const SEOHAE = ['가정동', '가좌동', '석남동', '신현동', '원창동', '연희동', '공촌동', '경서동', '백석동', '시천동', '검암동', '청라동'];
/** 범위 탐색으로 찾은(표에 없는) 코드 → 시·군·구 이름. 부천·화성은 시 단위, 인천은 법정동으로 새 구 판정 */
function discoveredCity(code: string, dong: string): { sido: SidoSlug; name: string } | null {
  const n = Number(code);
  if (n >= 41191 && n <= 41199) return { sido: 'gyeonggi', name: '부천시' };
  if (n >= 41591 && n <= 41599) return { sido: 'gyeonggi', name: '화성시' };
  if (n >= 28100 && n <= 28299) {
    const name = YEONGJONG.includes(dong) ? '영종구' : GEOMDAN.includes(dong) ? '검단구' : SEOHAE.includes(dong) ? '서해구' : '제물포구';
    return { sido: 'incheon', name };
  }
  return null;
}

const byCode = new Map(LAWD.map((l) => [l.code, l]));

/** API 응답의 지역코드 + 법정동 → 동네콕콕 지역. 모르는 코드면 null(수집 보고서에 남긴다). */
export function regionOfDeal(code: string, dong: string) {
  const l = byCode.get(code);
  const hit = l ? { sido: l.sido, name: l.sido === 'incheon' ? incheonGu(l.city, dong) : l.city } : discoveredCity(code, dong);
  if (!hit) return null;
  const sg = SIGUNGU[hit.sido].find((x) => x.name === hit.name);
  if (!sg) return null;
  return { sido: hit.sido, sigungu: sg.slug, sigunguName: sg.name, subGu: l?.gu ?? null };
}
