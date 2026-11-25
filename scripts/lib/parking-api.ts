// 공공데이터포털 '전국주차장정보표준데이터' API(tn_pubr_prkplce_info_api) 응답 → 표준데이터 한글 헤더 행으로 변환.
// 영문 필드명(API_FIELD 첫 번째 후보)은 포털 '요청변수' 목록 원문 그대로다(2026-11-25 확인, 오타 포함: weekdayOperColseHhmm,
//    satOperOperOpenHhmm, holidayCloseOpenHhmm). 실제 응답 예시(npm run fetch-parking -- --sample)로 한 번 더 확인한다.
//    필수 필드가 하나라도 매핑되지 않으면 수집 스크립트가 멈춘다(잘못된 데이터 배포 방지).
// 인증키는 코드·저장소·로그 어디에도 남기지 않는다: 환경변수 DATA_GO_KR_KEY로만 읽고, 오류 메시지의 URL은 redact()로 가린다.
import { FIELD, REQUIRED_FIELDS } from './parking.ts';

export const API_ENDPOINT = 'https://api.data.go.kr/openapi/tn_pubr_prkplce_info_api';

type FieldKey = keyof typeof FIELD;
/** 표준데이터 필드 → 영문 응답 필드명 후보(실제 API에 오타 필드명이 있는 경우까지 후보로 둔다) */
export const API_FIELD: Record<FieldKey, string[]> = {
  id: ['prkplceNo'], name: ['prkplceNm'], kind: ['prkplceSe'], lotType: ['prkplceType'],
  road: ['rdnmadr'], jibun: ['lnmadr'], spaces: ['prkcmprt'],
  wdOpen: ['weekdayOperOpenHhmm'], wdClose: ['weekdayOperColseHhmm', 'weekdayOperCloseHhmm'],
  satOpen: ['satOperOperOpenHhmm', 'satOperOpenHhmm'], satClose: ['satOperCloseHhmm'],
  holOpen: ['holidayOperOpenHhmm'], holClose: ['holidayCloseOpenHhmm', 'holidayOperCloseHhmm', 'holidayCloseHhmm'],
  feeInfo: ['parkingchrgeInfo', 'parkingChrgeInfo'], baseMin: ['basicTime'], baseFee: ['basicCharge'],
  unitMin: ['addUnitTime'], unitFee: ['addUnitCharge'], dayPassHours: ['dayCmmtktAdjTime'], dayPass: ['dayCmmtkt'],
  monthly: ['monthCmmtkt'], payment: ['metpay'], note: ['spcmnt'], agency: ['institutionNm'], phone: ['phoneNumber'],
  lat: ['latitude'], lng: ['longitude'], disabled: ['pwdbsPpkZoneYn'], baseDate: ['referenceDate'],
  grade: ['feedingSe'], oddEven: ['enforceSe'], days: ['operDay'], providerCode: ['insttCode', 'instt_code'], providerName: ['insttNm', 'instt_nm'], // 실제 응답은 insttCode/insttNm(요청변수 표는 instt_code/instt_nm)
};

const norm = (k: string) => k.toLowerCase().replace(/[_\s]/g, '');

/** 응답 항목의 키 목록으로 필드 매핑을 정한다. 한글 헤더면 그대로, 영문이면 API_FIELD 후보에서 찾는다. */
export function resolveMapping(keys: string[]) {
  const byNorm = new Map(keys.map((k) => [norm(k), k]));
  const korean = keys.some((k) => /[가-힣]/.test(k));
  const map = {} as Record<FieldKey, string | null>;
  for (const f of Object.keys(FIELD) as FieldKey[]) {
    map[f] = korean ? (keys.includes(FIELD[f]) ? FIELD[f] : null) : (API_FIELD[f].map((c) => byNorm.get(norm(c))).find(Boolean) ?? null);
  }
  const used = new Set(Object.values(map).filter(Boolean));
  return {
    mode: korean ? 'korean' : 'english',
    map,
    missingRequired: REQUIRED_FIELDS.filter((f) => !map[f]).map((f) => `${FIELD[f]}(${API_FIELD[f].join('|')})`),
    missingOptional: (Object.keys(FIELD) as FieldKey[]).filter((f) => !map[f] && !REQUIRED_FIELDS.includes(f)).map((f) => FIELD[f]),
    unknownKeys: keys.filter((k) => !used.has(k)),
  };
}

/** 응답 항목 하나 → normalizeParking()이 받는 한글 헤더 행 */
export function toRow(item: Record<string, unknown>, map: Record<FieldKey, string | null>): Record<string, string> {
  const row: Record<string, string> = {};
  for (const f of Object.keys(FIELD) as FieldKey[]) {
    const src = map[f]; const v = src ? item[src] : undefined;
    row[FIELD[f]] = v === null || v === undefined ? '' : String(v).trim();
  }
  return row;
}

export interface Page { items: Record<string, unknown>[]; totalCount: number }

/** 표준데이터 API 응답 본문 해석. 오류(인증키 오류는 JSON을 요청해도 XML로 올 때가 있음)는 Error로 던진다. */
export function parsePage(text: string): Page {
  const t = text.trim();
  if (t.startsWith('<')) return parseXmlPage(t);
  let j: any;
  try { j = JSON.parse(t); } catch { throw new Error(`JSON이 아닌 응답: ${t.slice(0, 120)}`); }
  const header = j?.response?.header ?? j?.header;
  if (header && !['00', '0', 'INFO-000'].includes(String(header.resultCode))) throw new Error(`API 오류 ${header.resultCode} ${header.resultMsg ?? ''}`.trim());
  const body = j?.response?.body ?? j?.body;
  if (!body) throw new Error('응답에 body가 없어요');
  const raw = body.items?.item ?? body.items ?? [];
  const items = (Array.isArray(raw) ? raw : [raw]).filter((x: unknown) => x && typeof x === 'object');
  return { items, totalCount: Number(body.totalCount ?? 0) };
}

const unescapeXml = (v: string) => v.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&amp;/g, '&');
const pickTag = (xml: string, tag: string) => xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))?.[1];

/** XML 응답(2026-11-25 실제 응답 확인: <response><header><resultCode>00 … <items><item><prkplceNo>…). 빈 값은 <rdnmadr/> 같은 빈 태그. */
export function parseXmlPage(t: string): Page {
  const code = pickTag(t, 'resultCode') ?? pickTag(t, 'returnReasonCode');
  if (code !== '00') {
    const msg = pickTag(t, 'returnAuthMsg') ?? pickTag(t, 'errMsg') ?? pickTag(t, 'resultMsg') ?? 'XML 응답';
    throw new Error(`API 오류 ${code ?? ''} ${msg}`.trim());
  }
  const items: Record<string, unknown>[] = [];
  for (const m of t.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const item: Record<string, string> = {};
    for (const f of m[1].matchAll(/<([A-Za-z_][\w]*)\s*\/>|<([A-Za-z_][\w]*)>([\s\S]*?)<\/\2>/g)) {
      if (f[1]) item[f[1]] = ''; else item[f[2]] = unescapeXml(f[3]).trim();
    }
    items.push(item);
  }
  return { items, totalCount: Number(pickTag(t, 'totalCount') ?? 0) };
}

/** 인증키: 포털의 Encoding 키(%2B 등 포함)는 그대로, Decoding 키는 URL 인코딩해서 붙인다. */
export function buildUrl(key: string, pageNo: number, numOfRows: number) {
  const k = /%[0-9A-Fa-f]{2}/.test(key) ? key : encodeURIComponent(key);
  return `${API_ENDPOINT}?serviceKey=${k}&pageNo=${pageNo}&numOfRows=${numOfRows}&type=json`;
}

/** 로그·오류 메시지에서 인증키를 가린다 */
export const redact = (s: string, key?: string) => {
  let out = s.replace(/serviceKey=[^&\s]+/gi, 'serviceKey=***');
  if (key) for (const k of [key, encodeURIComponent(key)]) out = out.split(k).join('***');
  return out;
};
