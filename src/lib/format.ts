import type { Hours, Range } from '../../scripts/lib/hours.ts';
import { DOC_LABELS, type DocCode } from '../../scripts/lib/docs.ts';
import { REPORT_FORM } from '../config.ts';

const t = (s: string) => (s.endsWith(':00') ? String(+s.slice(0, 2)) : `${+s.slice(0, 2)}:${s.slice(3)}`);
export const fmtRange = (r: Range | null | undefined) =>
  r === undefined ? '확인 필요' : r === null ? '휴무' : r[0] === '00:00' && r[1] === '24:00' ? '24시간' : `${t(r[0])}~${t(r[1])}시`;

/** One-line summary, merging days with identical hours: "평일 7~22시 · 토·일·공휴일 9~18시". */
export function hoursLine(h: Hours): string {
  const labels: [keyof Hours, string][] = [['weekday', '평일'], ['sat', '토'], ['sun', '일'], ['holiday', '공휴일']];
  const groups: { names: string[]; v: string }[] = [];
  for (const [k, name] of labels) {
    const v = fmtRange(h[k]);
    const g = groups.find((x) => x.v === v);
    if (g) g.names.push(name); else groups.push({ names: [name], v });
  }
  if (groups.length === 1) return groups[0].v === '24시간' ? '연중 24시간' : `매일 ${groups[0].v}`;
  return groups.map((g) => `${g.names.join('·')} ${g.v}`).join(' · ');
}

export const docLabel = (d: DocCode) => DOC_LABELS[d];
export const docOrder: DocCode[] = [
  'resident', 'family', 'registry', 'land', 'tax', 'nationalTax', 'health', 'pension', 'employment', 'vehicle',
  'removedRecord', 'education', 'military', 'veterans', 'welfare', 'farm', 'traffic', 'passport', 'fishery', 'other',
];
/** 카드에 보여 줄 주요 서류(나머지는 "외 N종"). */
export const KEY_DOCS: DocCode[] = ['resident', 'family', 'registry', 'land', 'tax', 'nationalTax', 'health'];
export const sortDocs = (ds: DocCode[]) => docOrder.filter((d) => ds.includes(d));

export const km = (m: number) => (m < 1000 ? `${m}m` : `${(m / 1000).toFixed(1)}km`);

// ---------- external links ----------
const enc = encodeURIComponent;
export const kakaoTo = (name: string, lat: number, lng: number) => `https://map.kakao.com/link/to/${enc(name)},${lat},${lng}`;
export const kakaoMap = (name: string, lat: number, lng: number) => `https://map.kakao.com/link/map/${enc(name)},${lat},${lng}`;
/** 좌표가 없을 때: 카카오맵 검색 결과로 연결 */
export const kakaoSearch = (address: string) => `https://map.kakao.com/link/search/${enc(address)}`;
export const naverSearch = (address: string, name: string) => `https://map.naver.com/p/search/${enc(`${address} ${name}`)}`;

/** Google Form prefill link with kiosk id + name only (no personal data); null until REPORT_FORM is configured. */
export function reportUrl(id: string, name: string): string | null {
  const { formId, entries } = REPORT_FORM;
  if (!formId) return null;
  const p = new URLSearchParams({ usp: 'pp_url', [entries.id]: id, [entries.name]: name });
  return `https://docs.google.com/forms/d/e/${formId}/viewform?${p}`;
}
