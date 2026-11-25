// Operating-hours model, parsers (split columns or free text) and the "open now" check.
// Shared by the build pipeline and the client script (keep it dependency-free).

/** [open, close] as "HH:MM". close may be "24:00"; close < open means the range runs past midnight. */
export type Range = [string, string];
/** Range = open, null = closed that day, undefined = unknown. */
export type Slot = Range | null | undefined;
export type DayKey = 'weekday' | 'sat' | 'sun' | 'holiday';
export type Hours = Partial<Record<DayKey, Range | null>>;
export type Confidence = 'ok' | 'partial' | 'unknown';
export interface ParsedHours { hours: Hours; confidence: Confidence; is24h: boolean }

const DAYS: DayKey[] = ['weekday', 'sat', 'sun', 'holiday'];
const FULL: Range = ['00:00', '24:00'];

// ---------- time helpers ----------

/** "7", "7:5", "0700", "07:00", "7시", "7시30분", "오후 10시" -> "HH:MM" (or null). */
export function normTime(raw: string): string | null {
  let s = raw.trim();
  const pm = /오후/.test(s);
  const am = /오전/.test(s);
  s = s.replace(/오전|오후/g, '').trim();
  let h: number, m: number;
  let mt: RegExpMatchArray | null;
  if ((mt = s.match(/^(\d{1,2})\s*시\s*(?:(\d{1,2})\s*분)?$/))) { h = +mt[1]; m = mt[2] ? +mt[2] : 0; }
  else if ((mt = s.match(/^(\d{1,2}):(\d{1,2})(?::\d{2})?$/))) { h = +mt[1]; m = +mt[2]; }
  else if ((mt = s.match(/^(\d{2})(\d{2})$/))) { h = +mt[1]; m = +mt[2]; }
  else if ((mt = s.match(/^(\d{1,2})$/))) { h = +mt[1]; m = 0; }
  else return null;
  if (pm && h < 12) h += 12;
  if (am && h === 12) h = 0;
  if (h > 24 || m > 59 || (h === 24 && m > 0)) return null;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export const toMin = (t: string) => +t.slice(0, 2) * 60 + +t.slice(3, 5);

/** Two times -> Range, folding "00:00~00:00" to closed and "00:00~23:59/24:00" to 24h. */
function makeRange(a: string | null, b: string | null): Range | null | undefined {
  if (!a || !b) return undefined;
  if (a === '00:00' && b === '00:00') return null; // 표준데이터 관행: 휴무를 00:00~00:00 으로 적는 경우
  if (a === '00:00' && (b === '23:59' || b === '24:00')) return [...FULL];
  if (a === b) return null;
  return [a, b];
}

// ---------- parser 1: split columns (평일/토요일/공휴일 시작·종료) ----------

export function parseColumns(c: {
  weekdayOpen?: string; weekdayClose?: string; satOpen?: string; satClose?: string;
  holidayOpen?: string; holidayClose?: string;
}): ParsedHours {
  const r = (a?: string, b?: string) => (a || b ? makeRange(normTime(a ?? ''), normTime(b ?? '')) : undefined);
  const weekday = r(c.weekdayOpen, c.weekdayClose);
  const sat = r(c.satOpen, c.satClose);
  const holiday = r(c.holidayOpen, c.holidayClose);
  const hours: Hours = {};
  if (weekday !== undefined) hours.weekday = weekday;
  if (sat !== undefined) hours.sat = sat;
  if (holiday !== undefined) { hours.holiday = holiday; hours.sun = holiday; } // 일요일 = 공휴일 시간
  return finish(hours, weekday !== undefined && sat !== undefined && holiday !== undefined ? 'ok' : 'partial');
}

// ---------- parser 1b: localdata 표준 (평일·공휴일 시작/종료 + 운영시간참고내용) ----------
// 실제 원천(file.localdata.go.kr)은 토·일 컬럼이 없다. 규칙:
//  - 평일 = 평일 컬럼. 공휴일 = 공휴일 컬럼(비어 있으면 휴무로 보고 partial).
//  - 토·일 = 공휴일 컬럼 값(휴일 운영시간으로 간주). 참고내용에 토/일/주말/공휴일이 명시되면 그 값이 우선.
//  - 서류별 발급시간을 적은 참고내용(등기부·가족관계 등)은 운영시간 해석에서 제외.
//  - "근무시간 외 이용 불가"는 평일 09~18시로 본다(partial).
export function parseStandard(c: {
  weekdayOpen?: string; weekdayClose?: string; holidayOpen?: string; holidayClose?: string; note?: string;
}): ParsedHours {
  const r = (a?: string, b?: string) => (a || b ? makeRange(normTime(a ?? ''), normTime(b ?? '')) : undefined);
  let weekday = r(c.weekdayOpen, c.weekdayClose);
  const holidayCol = r(c.holidayOpen, c.holidayClose);
  const note = c.note ?? '';
  const docNote = /등기|가족관계|제적|발급가능\s*서류/.test(note);
  const explicit = docNote ? {} : explicitDays(note);
  let confidence: Confidence = holidayCol !== undefined ? 'ok' : 'partial';

  if (/근무\s*시간\s*외|업무\s*시간\s*외/.test(note)) { weekday = ['09:00', '18:00']; confidence = 'partial'; }
  if (weekday === undefined && explicit.weekday !== undefined) weekday = explicit.weekday;
  const base = holidayCol === undefined ? null : holidayCol;
  const hours: Hours = {
    weekday: weekday ?? undefined,
    sat: 'sat' in explicit ? explicit.sat! : base,
    sun: 'sun' in explicit ? explicit.sun! : base,
    holiday: 'holiday' in explicit ? explicit.holiday! : base,
  };
  if (hours.weekday === undefined) { delete hours.weekday; confidence = 'unknown'; }
  if (holidayCol === undefined && ('sat' in explicit || 'sun' in explicit || 'holiday' in explicit)) confidence = confidence === 'unknown' ? 'unknown' : 'ok';
  return finish(hours, confidence);
}

// ---------- parser 2: free text (운영시간 한 칸) ----------

// Longest labels first. Each label maps to the day keys it covers.
const LABELS: [RegExp, DayKey[]][] = [
  [/매일|연중무휴|전일|365일|상시/, ['weekday', 'sat', 'sun', 'holiday']],
  [/평일|주중|월\s*[~\-]\s*금(?:요일)?|월요일\s*[~\-]\s*금요일/, ['weekday']],
  [/주말|토\s*[·,\/~\-]\s*일(?:요일)?/, ['sat', 'sun']],
  [/토요일|토(?![지])/, ['sat']],
  [/일요일/, ['sun']],
  [/(?:법정)?공휴일|휴일|명절/, ['holiday']],
  [/(?<![매주휴])일(?=\s*[:)\]]|\s+\d)/, ['sun']], // bare "일" only when directly followed by a time
];
const LABEL_RE = new RegExp(LABELS.map(([re]) => `(${re.source})`).join('|'), 'g');
const CONNECTOR = /^[\s·,\/및과와&ㆍ・]*$/;
const TIME = String.raw`(?:오전|오후)?\s*\d{1,2}(?::\d{1,2}|\s*시(?:\s*\d{1,2}\s*분)?)?|\d{4}`;
const RANGE_RE = new RegExp(`(${TIME})\\s*~\\s*(${TIME})`);
const CLOSED_RE = /휴무|휴관|미운영|미가동|운영\s*안\s*함|운영\s*[xX×]|운영하지|불가|없음|중지|미설치|제외|미발급/;
const H24_RE = /24\s*시간/;

function cleanText(raw: string): string {
  return raw
    .replace(/[！-～]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0)) // 전각 -> 반각
    .replace(/[∼〜～–—]|(?<=\d)\s*-\s*(?=\d)|(?<=[시분])\s*-\s*(?=[오\d])/g, '~')
    .replace(/익일\s*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function slotFromSegment(seg: string): Range | null | undefined {
  if (H24_RE.test(seg)) return [...FULL];
  const m = seg.match(RANGE_RE);
  if (m) return makeRange(normTime(m[1]), normTime(m[2]));
  if (CLOSED_RE.test(seg)) return null;
  return undefined;
}

type Group = { days: Set<DayKey>; end: number; start: number };

/** Day labels and the hours written right after each label (no filling of unmentioned days). */
function scan(text: string): { groups: Group[]; hours: Hours; anyUnknown: boolean } {
  // 1) Find labels and merge adjacent ones joined only by connectors ("토·일·공휴일", "주말 및 공휴일").
  const groups: Group[] = [];
  for (const m of text.matchAll(LABEL_RE)) {
    const idx = m.slice(1).findIndex((g) => g !== undefined);
    const days = LABELS[idx][1];
    const start = m.index!;
    const end = start + m[0].length;
    const prev = groups[groups.length - 1];
    if (prev && CONNECTOR.test(text.slice(prev.end, start))) {
      days.forEach((d) => prev.days.add(d));
      prev.end = end;
    } else groups.push({ days: new Set(days), start, end });
  }

  const hours: Hours = {};
  let anyUnknown = false;
  // 2) Each group owns the text up to the next group (falls back to the previous group's slot when empty,
  //    e.g. "평일, 토요일 09:00~18:00" is handled by merging; "평일 07~22 / 주말 동일" is not).
  groups.forEach((g, i) => {
    const seg = text.slice(g.end, i + 1 < groups.length ? groups[i + 1].start : text.length);
    let slot = slotFromSegment(seg);
    if (slot === undefined && /동일|같음/.test(seg) && i > 0) {
      const prevDay = [...groups[i - 1].days][0];
      slot = hours[prevDay];
    }
    if (slot === undefined) anyUnknown = true;
    else g.days.forEach((d) => { if (!(d in hours)) hours[d] = slot; });
  });
  return { groups, hours, anyUnknown };
}

/** Only the days a note explicitly labels, e.g. "주말휴무" -> {sat:null, sun:null}. */
export function explicitDays(raw: string): Hours {
  const text = cleanText(raw ?? '');
  return text ? scan(text).hours : {};
}

export function parseText(raw: string): ParsedHours {
  const text = cleanText(raw ?? '');
  if (!text) return finish({}, 'unknown');

  const { groups, hours, anyUnknown } = scan(text);

  if (groups.length === 0) {
    // No day labels: "07:00~22:00", "24시간", "청사 운영시간과 동일".
    const slot = slotFromSegment(text);
    if (slot && slot[0] === '00:00' && slot[1] === '24:00') {
      DAYS.forEach((d) => (hours[d] = [...FULL]));
      return finish(hours, 'ok');
    }
    if (slot) { hours.weekday = slot; return finish(hours, 'partial'); } // 주말 여부 불명
    if (/근무\s*시간|청사|업무\s*시간|기관\s*운영/.test(text)) {
      hours.weekday = ['09:00', '18:00'];
      hours.sat = null; hours.sun = null; hours.holiday = null;
      return finish(hours, 'partial');
    }
    return finish({}, 'unknown');
  }

  // Text before the first label that carries a time applies to weekdays ("07:00~22:00 (주말 휴무)").
  if (!('weekday' in hours)) {
    const lead = slotFromSegment(text.slice(0, groups[0].start));
    if (lead !== undefined) hours.weekday = lead;
  }

  // 3) Fill days the text never mentions.
  const mentioned = DAYS.filter((d) => d in hours);
  if (!('sun' in hours) && 'sat' in hours && 'holiday' in hours && hours.sat === null && hours.holiday === null) hours.sun = null;
  if (!('holiday' in hours) && 'sun' in hours) hours.holiday = hours.sun; // 공휴일은 일요일과 같게 본다
  if (!('sun' in hours) && 'holiday' in hours) hours.sun = hours.holiday;
  let filled = false;
  for (const d of DAYS) {
    if (!(d in hours) && 'weekday' in hours) { hours[d] = null; filled = true; } // 평일만 적혀 있으면 주말은 휴무로 본다
  }
  const confidence: Confidence = anyUnknown || mentioned.length === 0 ? (mentioned.length ? 'partial' : 'unknown')
    : filled ? 'partial' : 'ok';
  return finish(hours, confidence);
}

function finish(hours: Hours, confidence: Confidence): ParsedHours {
  const is24h = DAYS.every((d) => { const s = hours[d]; return !!s && s[0] === '00:00' && s[1] === '24:00'; });
  return { hours, confidence, is24h };
}

// ---------- open-now check (KST) ----------

export interface KstNow { ymd: string; dow: number; minutes: number }

/** Current wall-clock time in Asia/Seoul regardless of the viewer's time zone. */
export function kstNow(date: Date = new Date()): KstNow {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23',
    }).formatToParts(date).map((p) => [p.type, p.value]),
  );
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
  return { ymd: `${parts.year}-${parts.month}-${parts.day}`, dow, minutes: +parts.hour * 60 + +parts.minute };
}

function dayKey(dow: number, isHoliday: boolean): DayKey {
  if (isHoliday) return 'holiday';
  return dow === 0 ? 'sun' : dow === 6 ? 'sat' : 'weekday';
}

const prevYmd = (ymd: string) => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

/** true = open, false = closed, null = cannot tell. `holidays` holds "YYYY-MM-DD" strings. */
export function isOpenAt(hours: Hours, now: KstNow, holidays: Set<string>): boolean | null {
  const today = hours[dayKey(now.dow, holidays.has(now.ymd))];
  const yKey = dayKey((now.dow + 6) % 7, holidays.has(prevYmd(now.ymd)));
  const yesterday = hours[yKey];
  // Spill-over from a range that crossed midnight yesterday.
  if (yesterday) {
    const [o, c] = yesterday.map(toMin);
    if (c < o && now.minutes < c) return true;
  }
  if (today === undefined) return null;
  if (today === null) return false;
  const [o, c] = today.map(toMin);
  return c < o ? now.minutes >= o : now.minutes >= o && now.minutes < c;
}
