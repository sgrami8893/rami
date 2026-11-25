// Column alias dictionary: maps every known source header spelling to one canonical key.
// Confirmed = seen in 양산시_무인민원발급정보 / 안산시_무인민원발급기 file data (2026-11-25).
// Guessed  = expected in 전국무인민원발급정보표준데이터 but NOT yet confirmed; verify against the real CSV header.

export type CanonicalKey =
  | 'name' | 'locationDetail' | 'sido' | 'sigungu' | 'roadAddress' | 'jibunAddress'
  | 'lat' | 'lng' | 'hoursText'
  | 'weekdayOpen' | 'weekdayClose' | 'satOpen' | 'satClose' | 'holidayOpen' | 'holidayClose'
  | 'docsText' | 'docResident' | 'docFamily' | 'docRegistry'
  | 'inUse' | 'agency' | 'phone' | 'baseDate';

export const ALIASES: Record<CanonicalKey, string[]> = {
  name: ['설치장소', '발급기명', '설치장소명', '무인민원발급기명', '시설명'], // 설치장소 confirmed
  locationDetail: ['설치위치', '설치장소설명', '상세위치', '설치위치상세'], // 설치위치 confirmed
  sido: ['시도명', '시도'],
  sigungu: ['시군구명', '시군구'],
  roadAddress: ['소재지도로명주소', '도로명주소', '도로명 주소', '설치장소도로명주소'], // first + 도로명 주소 confirmed
  jibunAddress: ['소재지지번주소', '지번주소', '지번 주소', '설치장소지번주소'], // first + 지번 주소 confirmed
  lat: ['위도'], // confirmed
  lng: ['경도'], // confirmed
  hoursText: ['운영시간'], // confirmed
  weekdayOpen: ['평일운영시작시각', '평일운영시작시간'],
  weekdayClose: ['평일운영종료시각', '평일운영종료시간'],
  satOpen: ['토요일운영시작시각', '토요일운영시작시간'],
  satClose: ['토요일운영종료시각', '토요일운영종료시간'],
  holidayOpen: ['공휴일운영시작시각', '공휴일운영시작시간', '휴일운영시작시각'],
  holidayClose: ['공휴일운영종료시각', '공휴일운영종료시간', '휴일운영종료시각'],
  docsText: ['발급민원종류', '발급가능민원', '발급가능민원종류', '발급민원', '민원종류'], // 발급민원종류 confirmed
  docResident: ['공통서류'], // 안산 style per-document columns (confirmed)
  docFamily: ['가족관계등록부'],
  docRegistry: ['등기부등본'],
  inUse: ['사용여부', '운영여부', '사용유무'],
  agency: ['관리기관명'], // confirmed
  phone: ['전화번호', '관리기관전화번호'], // 전화번호 confirmed
  baseDate: ['데이터기준일자'], // confirmed
};

const norm = (s: string) => s.replace(/[\s_()·]/g, '').toLowerCase();

/** Build header -> canonical map and report headers we do not recognise. */
export function mapHeaders(headers: string[]) {
  const lookup = new Map<string, CanonicalKey>();
  for (const [key, names] of Object.entries(ALIASES) as [CanonicalKey, string[]][]) {
    for (const n of names) lookup.set(norm(n), key);
  }
  const mapping: Partial<Record<CanonicalKey, string>> = {};
  const unknown: string[] = [];
  for (const h of headers) {
    const key = lookup.get(norm(h));
    if (key && !mapping[key]) mapping[key] = h;
    else if (!key) unknown.push(h);
  }
  const missingRequired = (['name', 'roadAddress'] as CanonicalKey[]).filter((k) => !mapping[k]);
  return { mapping, unknown, missingRequired };
}

/** Read one canonical field from a raw record using the header mapping. */
export function pick(rec: Record<string, string>, mapping: Partial<Record<CanonicalKey, string>>, key: CanonicalKey): string {
  const h = mapping[key];
  return h ? (rec[h] ?? '').trim() : '';
}
