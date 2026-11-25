// Adapter for the real source files from file.localdata.go.kr (confirmed 2026-11-25):
//   1) 무인민원발급기정보_설치정보조회.csv   — one row per kiosk (CP949)
//   2) 무인민원발급기정보_발급제증명조회.csv — one row per kiosk × document (CP949, ~570k rows)
// Join key: (개방자치단체코드, 관리번호) == (개방자치단체코드, 발급기번호).
// The source has NO coordinates; lat/lng come from the geocode cache when available.
import { parseStandard } from './hours.ts';
import { MENU_TO_DOC, type DocCode } from './docs.ts';
import { resolveRegion } from './regions.ts';
import { kioskId, type Kiosk, type Skip } from './normalize.ts';

export const INSTALL_HEADERS = ['개방자치단체코드', '관리번호', '발급기명', '설치장소주소', '평일운영시작시각'];
export const DOCS_HEADERS = ['개방자치단체코드', '발급기번호', '초기메뉴명', '민원사무분류명'];
export const isInstallFile = (headers: string[]) => INSTALL_HEADERS.every((h) => headers.includes(h));
export const isDocsFile = (headers: string[]) => DOCS_HEADERS.every((h) => headers.includes(h));

export const sourceKey = (orgCode: string, no: string) => `${orgCode}-${no}`;

export interface DocsIndex { menus: Map<string, Set<string>>; names: Map<string, Set<string>> }

export function indexDocs(records: Record<string, string>[]): DocsIndex {
  const menus = new Map<string, Set<string>>();
  const names = new Map<string, Set<string>>();
  for (const r of records) {
    const k = sourceKey(r['개방자치단체코드'], r['발급기번호']);
    (menus.get(k) ?? menus.set(k, new Set()).get(k)!).add(r['초기메뉴명']);
    (names.get(k) ?? names.set(k, new Set()).get(k)!).add(r['민원사무분류명']);
  }
  return { menus, names };
}

/** "도로명주소(법정동)[지번주소]" -> parts */
export function splitAddress(raw: string): { road: string; jibun: string } {
  const m = raw.match(/^(.*?)\s*\[(.*)\]\s*$/);
  return m ? { road: m[1].trim(), jibun: m[2].replace(/번지$/, '').trim() } : { road: raw.trim(), jibun: '' };
}

const A11Y: [string, string][] = [
  ['시각장애인용키패드', '시각장애인용 키패드'], ['시각장애인용음성안내', '음성 안내'], ['청각장애인용화면안내', '청각장애인용 화면 안내'],
  ['점자라벨부착', '점자 라벨'], ['이어폰소켓', '이어폰 소켓'], ['촉각(전자)모니터', '촉각 모니터'], ['화면확대기능', '화면 확대'],
  ['휠체어사용자조작', '휠체어 사용자 조작'],
];
const yes = (v: string) => /^(제공|부착|가능|Y)$/i.test((v ?? '').trim());

export interface ExtraFields {
  sourceKey: string; placeType: string; infoUrl: string | null; hoursNote: string;
  a11y: string[]; docCount: number; docNames?: string[];
}
export type LocalKiosk = Kiosk;

export function normalizeLocal(
  r: Record<string, string>, docs: DocsIndex | null, row: number,
  report: { skips: Skip[]; hoursFailures: string[]; unknownDocs: Map<string, number> },
  coords: Map<string, [number, number]>,
): LocalKiosk | null {
  const name = r['발급기명']?.trim();
  const { road, jibun } = splitAddress(r['설치장소주소'] ?? '');
  if (!name || !road) { report.skips.push({ reason: 'missing name/address', row, name }); return null; }
  if (r['사용여부명'] && r['사용여부명'] !== '사용') { report.skips.push({ reason: 'not in use', row, name }); return null; }
  // 재외공관 기기는 관리 구청 주소로 등록돼 있어 국내 목록에 넣으면 오해를 부른다.
  if (/대사관|영사관|총영사관|대표부/.test(`${name} ${r['설치장소상세위치']}`)) { report.skips.push({ reason: 'overseas mission', row, name }); return null; }

  const region = resolveRegion(road, jibun);
  if (!region) { report.skips.push({ reason: 'outside 수도권 or unknown 시군구', row, name }); return null; }

  const note = (r['운영시간참고내용'] ?? '').trim();
  const parsed = parseStandard({
    weekdayOpen: r['평일운영시작시각'], weekdayClose: r['평일운영종료시각'],
    holidayOpen: r['공휴일운영시작시각'], holidayClose: r['공휴일운영종료시각'], note,
  });
  const fmt = (a: string, b: string) => (a || b ? `${a}~${b === '2400' ? '24:00' : b}` : '정보 없음');
  const hoursRaw = `평일 ${fmt(r['평일운영시작시각'], r['평일운영종료시각'])}, 공휴일 ${fmt(r['공휴일운영시작시각'], r['공휴일운영종료시각'])}${note ? ` (${note})` : ''}`;
  if (parsed.confidence === 'unknown') report.hoursFailures.push(hoursRaw);

  const key = sourceKey(r['개방자치단체코드'], r['관리번호']);
  const menus = docs?.menus.get(key) ?? new Set<string>();
  const codes = new Set<DocCode>();
  for (const m of menus) {
    const c = MENU_TO_DOC[m];
    if (c) codes.add(c);
    else if (m) report.unknownDocs.set(m, (report.unknownDocs.get(m) ?? 0) + 1);
  }
  // 등기·가족관계는 설치정보의 발급구분 컬럼을 기준으로 한다(메뉴 목록과 다른 기기가 일부 있음).
  codes.delete('registry'); codes.delete('family');
  if (r['등기사항증명서발급구분'] === '발급') codes.add('registry');
  if (r['가족관계삭제발급구분'] === '발급') codes.add('family');

  const locationDetail = (r['설치장소상세위치'] ?? '').trim();
  const id = kioskId(road, name, locationDetail);
  const c = coords.get(road);
  const h = parsed.hours;
  const docNames = docs?.names.get(key);
  return {
    id, name, locationDetail, ...region,
    roadAddress: road, jibunAddress: jibun || null,
    lat: c ? c[0] : null, lng: c ? c[1] : null,
    hoursRaw, hours: h, hoursConfidence: parsed.confidence,
    is24h: parsed.is24h, openSat: !!h.sat, openSun: !!h.sun, openHoliday: !!h.holiday,
    docsRaw: [...menus].filter(Boolean).join(', '), docs: [...codes],
    agency: r['관리기관명'] ?? '', phone: null,
    baseDate: (r['최종수정시점'] ?? '').slice(0, 10) || null,
    sourceKey: key, placeType: r['설치장소위치'] ?? '', infoUrl: /^https?:\/\//.test(r['설치운영URL'] ?? '') ? r['설치운영URL'] : null,
    hoursNote: note,
    a11y: A11Y.filter(([col]) => yes(r[col])).map(([, label]) => label),
    docCount: docNames?.size ?? 0,
  };
}
