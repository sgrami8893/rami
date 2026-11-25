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
  return { ymd: d.toISOString().slice(0, 10), dow: (now.dow + days) % 7, minutes: 0 };
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
