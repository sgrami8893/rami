// "운영시간 내/외" badges (기기 실제 상태가 아니라 공개된 운영시간으로 계산), evaluated in KST on load and every minute.
import { isOpenAt, kstNow, toMin, type Hours, type KstNow } from '../../scripts/lib/hours.ts';
import holidaysJson from '../data/holidays.json';

const holidays = new Set<string>(
  Object.entries(holidaysJson).filter(([k]) => /^\d{4}$/.test(k)).flatMap(([, v]) => v as string[]),
);
const DOW = ['일', '월', '화', '수', '목', '금', '토'];

function shift(now: KstNow, days: number): KstNow {
  const d = new Date(`${now.ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return { ymd: d.toISOString().slice(0, 10), dow: (((now.dow + days) % 7) + 7) % 7, minutes: 0 };
}

/** Next opening time within 7 days, e.g. "내일 07:00". */
export function nextOpen(h: Hours, now: KstNow): string | null {
  for (let d = 0; d <= 7; d++) {
    const day = shift(now, d);
    const key = holidays.has(day.ymd) ? 'holiday' : day.dow === 0 ? 'sun' : day.dow === 6 ? 'sat' : 'weekday';
    const r = h[key];
    if (!r) continue;
    if (d === 0 && toMin(r[0]) <= now.minutes) continue;
    const when = d === 0 ? '오늘' : d === 1 ? '내일' : `${DOW[day.dow]}요일`;
    return `${when} ${r[0]}`;
  }
  return null;
}

const keyOf = (d: KstNow): keyof Hours => (holidays.has(d.ymd) ? 'holiday' : d.dow === 0 ? 'sun' : d.dow === 6 ? 'sat' : 'weekday');

/** 운영시간 안일 때 끝나는 시각: "오늘 22:00까지" / 자정을 넘기면 "내일 01:00까지" */
export function closesAt(h: Hours, now: KstNow): string | null {
  const y = h[keyOf(shift(now, -1))];
  if (y && toMin(y[1]) < toMin(y[0]) && now.minutes < toMin(y[1])) return `오늘 ${y[1]}까지`;
  const r = h[keyOf(now)];
  if (!r) return null;
  if (toMin(r[1]) < toMin(r[0])) return `내일 ${r[1]}까지`;
  return r[1] === '24:00' ? '오늘 자정까지' : `오늘 ${r[1]}까지`;
}

/** 운영시간 안일 때 종료까지 남은 분(자정 넘김 포함). 운영시간 밖이거나 정보가 없으면 null */
export function minutesLeft(h: Hours, now: KstNow): number | null {
  const y = h[keyOf(shift(now, -1))];
  if (y && toMin(y[1]) < toMin(y[0]) && now.minutes < toMin(y[1])) return toMin(y[1]) - now.minutes;
  const r = h[keyOf(now)];
  if (!r) return null;
  const o = toMin(r[0]), c = toMin(r[1]);
  if (c < o) return now.minutes >= o ? 1440 - now.minutes + c : null;
  return now.minutes >= o && now.minutes < c ? c - now.minutes : null;
}
/** 95 → "1시간 35분", 40 → "40분", 120 → "2시간" */
export const fmtLeft = (m: number) => (m < 60 ? `${m}분` : `${Math.floor(m / 60)}시간${m % 60 ? ` ${m % 60}분` : ''}`);
/** 종료까지 3시간 이하일 때만 남은 시간을 보여 준다 */
export const LEFT_LIMIT = 180;

const BADGE = {
  open: ['운영시간 내', 'bg-ok-bg', 'text-ok'],
  closed: ['운영시간 외', 'bg-off-bg', 'text-off'],
  unknown: ['시간 확인 필요', 'bg-off-bg', 'text-warn'],
} as const;

export type OpenState = keyof typeof BADGE;

/** Updates every .kiosk card under `root`; returns the KST time used. */
export function refreshOpenState(root: ParentNode = document): KstNow {
  const now = kstNow();
  root.querySelectorAll<HTMLElement>('.kiosk').forEach((el) => {
    let hours: Hours;
    try { hours = JSON.parse(el.dataset.hours || '{}') as Hours; } catch { hours = {} as Hours; } // 깨진 값이면 '확인 필요'로 처리
    const r = el.dataset.conf === 'unknown' ? null : isOpenAt(hours, now, holidays);
    const state: OpenState = r === null ? 'unknown' : r ? 'open' : 'closed';
    el.dataset.open = state;
    const badge = el.querySelector<HTMLElement>('.open-badge');
    if (badge) {
      const [label, bg, fg] = BADGE[state];
      badge.textContent = label;
      badge.className = `open-badge badge ${bg} ${fg}`;
    }
    // 목록 행: 기본 HTML의 운영시간 문구를 지금 기준 문구로 바꾼다(24시간·미확인은 그대로). 한 줄 고정이라 CLS 없음.
    const rel = el.querySelector<HTMLElement>('.rel-time');
    if (rel) {
      const t = el.dataset.f24h || state === 'unknown' ? null : state === 'open' ? closesAt(hours, now) : nextOpen(hours, now);
      // 곧 끝나면 "1시간 20분 뒤 종료"(같은 한 줄 길이라 줄바꿈·CLS 없음), 1시간 이하이면 주의 색
      const left = state === 'open' && !el.dataset.f24h ? minutesLeft(hours, now) : null;
      const soon = left !== null && left <= LEFT_LIMIT;
      rel.textContent = soon ? `${fmtLeft(left!)} 뒤 종료` : t ? (state === 'open' ? t : `${t} 열림`) : (rel.dataset.default ?? '');
      rel.classList.toggle('text-warn', soon && left! <= 60);
    }
    const next = el.querySelector<HTMLElement>('.next-open');
    if (next) {
      const n = state === 'closed' ? nextOpen(hours, now) : null;
      next.textContent = n ? `다음 운영: ${n}` : '';
      next.classList.toggle('hidden', !n);
    }
  });
  return now;
}

/** 오늘(KST)이 운영시간 표의 어느 줄인지: 공휴일 > 일 > 토 > 평일 */
export function todayKey(now: KstNow = kstNow()): keyof Hours {
  return holidays.has(now.ymd) ? 'holiday' : now.dow === 0 ? 'sun' : now.dow === 6 ? 'sat' : 'weekday';
}

/** 지금(KST) 운영시간 안인지: true/false, 정보가 없으면 null */
export const isOpenNow = (h: Hours, now: KstNow = kstNow()) => isOpenAt(h, now, holidays);
