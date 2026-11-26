// '내 예산으로 갈 수 있는 동네'(2026-11-26 사용자·제미나이 2단계) 공통 계산. 본문 폼(RentBudget.astro)과 지도(rent-map.ts)가 함께 쓴다.
// - 판정은 최근 12개월 동별 실거래 '중위값'과 예산 비교뿐이에요. 매물·계약 가능 여부, 위험·안전 판단은 하지 않아요.
// - 거래가 적은 동(LOW건 미만)은 예산 안으로 세지 않아요(지도 '거래 적음' 회색과 같은 기준).
// - 상태는 주소(?b=j&dep=…)에도 남겨서 동 상세로 갔다가 뒤로 와도 그대로예요.
export type M = (number | null)[]; // [빌라 전세, 빌라 월세, 빌라 월세 보증금, 오피 전세, 오피 월세, 오피 월세 보증금]
export type Kind = 'j' | 'w';
export type BType = 'v' | 'o' | 'a';
export type Budget = { kind: Kind; dep: number; mon: number; type: BType };
export type Verdict =
  | { s: 'ok'; room: number; t: 'v' | 'o'; d: number; w: number | null; diff: number }
  | { s: 'over' }
  | { s: 'low' };

export const DEFAULT: Budget = { kind: 'j', dep: 20000, mon: 60, type: 'a' };
export const DEFAULT_W_DEP = 1000;
const clamp = (v: number, hi: number) => Math.max(0, Math.min(hi, Math.round(v)));
export const MAX_DEP = 300000; // 30억
export const MAX_MON = 1000;

export function parse(search: string): Budget | null {
  const q = new URLSearchParams(search);
  const k = q.get('b');
  if (k !== 'j' && k !== 'w') return null;
  const t = q.get('t');
  const num = (x: string | null, d: number) => (x !== null && x !== '' && Number.isFinite(Number(x)) ? Number(x) : d);
  return {
    kind: k,
    dep: clamp(num(q.get('dep'), k === 'j' ? DEFAULT.dep : DEFAULT_W_DEP), MAX_DEP),
    mon: clamp(num(q.get('mon'), DEFAULT.mon), MAX_MON),
    type: t === 'v' || t === 'o' ? t : 'a',
  };
}
export function query(b: Budget, extra: Record<string, string | null> = {}) {
  const q = new URLSearchParams({ b: b.kind, dep: String(b.dep) });
  if (b.kind === 'w') q.set('mon', String(b.mon));
  if (b.type !== 'a') q.set('t', b.type);
  for (const [k, v] of Object.entries(extra)) if (v) q.set(k, v);
  return `?${q}`;
}

/** 0~1 사이 여유 비율(상한이 0이면 값도 0일 때만 맞음) */
const ratio = (cap: number, v: number) => (cap > 0 ? (cap - v) / cap : v <= 0 ? 1 : -1);

function one(m: M, t: 'v' | 'o', b: Budget): Verdict | null {
  const o = t === 'v' ? 0 : 3;
  if (b.kind === 'j') {
    const j = m[o];
    if (j === null) return null;
    return j <= b.dep ? { s: 'ok', room: ratio(b.dep, j), t, d: j, w: null, diff: b.dep - j } : { s: 'over' };
  }
  const w = m[o + 1], d = m[o + 2];
  if (w === null || d === null) return null;
  return w <= b.mon && d <= b.dep ? { s: 'ok', room: Math.min(ratio(b.dep, d), ratio(b.mon, w)), t, d, w, diff: b.mon - w } : { s: 'over' };
}

/** 한 지역(동)의 예산 판정. 거래 적음 → low, 고른 유형 값이 없음 → low */
export function judge(p: { n: number; m: M }, low: number, b: Budget): Verdict {
  if (p.n < low) return { s: 'low' };
  const vs = (b.type === 'a' ? (['v', 'o'] as const) : [b.type]).map((t) => one(p.m, t, b)).filter((x): x is Verdict => x !== null);
  if (!vs.length) return { s: 'low' };
  const ok = vs.filter((x): x is Extract<Verdict, { s: 'ok' }> => x.s === 'ok').sort((a, c) => c.room - a.room);
  return ok[0] ?? { s: 'over' };
}

/** 여유가 많을수록 진한 5단계(지도 단계구분도의 따뜻한 색 중 크림 다음부터 → 회색과 확실히 구분) */
export const ROOM_BREAKS = [0.1, 0.2, 0.35, 0.5];
export const ROOM_COLORS = ['#FBCB7A', '#F59A4E', '#E4634A', '#B23A5B', '#6B1F57'];
export const roomStep = (r: number) => { let i = 0; while (i < ROOM_BREAKS.length && r >= ROOM_BREAKS[i]) i++; return i; };
/** 시·군·구 단계: 예산 안 동네 수 5단계 */
export const COUNT_BREAKS = [3, 6, 11, 21];
export const countStep = (c: number) => { let i = 0; while (i < COUNT_BREAKS.length && c >= COUNT_BREAKS[i]) i++; return i; };
/** 예산 초과(회색). 제미나이 제안 #E5E8EB. 경계선은 회청색으로 따로 그려 이웃 칸과 구분 */
export const OVER = '#E5E8EB';

/** 만원 → '2.1억', '9,500만' */
export const short = (v: number) => (v >= 10000 ? `${(Math.round(v / 1000) / 10).toString()}억` : `${v.toLocaleString('ko-KR')}만`);
/** 만원 → '2억 1,000만 원' */
export const won = (v: number) => {
  if (v === 0) return '0원';
  const e = Math.floor(v / 10000), r = v % 10000;
  return `${e ? `${e}억` : ''}${e && r ? ' ' : ''}${r ? `${r.toLocaleString('ko-KR')}만` : ''} 원`;
};
export const typeName = (t: 'v' | 'o') => (t === 'v' ? '빌라' : '오피스텔');
export const budgetText = (b: Budget) => {
  const ty = b.type === 'a' ? '빌라·오피스텔' : typeName(b.type);
  return b.kind === 'j' ? `${ty} 전세 ${won(b.dep)} 이하` : `${ty} 월세 보증금 ${won(b.dep)}·월 ${b.mon}만 원 이하`;
};

// ---- 전체 동 목록(/geo/rent/dongs.json): 본문 목록·지도 시·군·구 집계가 함께 쓴다 ----
export type DongRow = { f: string; k: string; n: number; m: M; h: string | null };
export type Index = { low: number; sgg: Record<string, [string, string, string | null]>; d: DongRow[] };
let idx: Promise<Index> | null = null;
export function loadIndex(src = '/geo/rent/'): Promise<Index> {
  idx ??= fetch(`${src}dongs.json`).then((r) => r.json() as Promise<{ low: number; sgg: Index['sgg']; d: [string, string, number, M, string | null][] }>)
    .then((x) => ({ low: x.low, sgg: x.sgg, d: x.d.map(([f, k, n, m, h]) => ({ f, k, n, m, h })) }))
    .catch((e) => { idx = null; throw e; });
  return idx;
}

// ---- 지금 예산 상태(모듈 하나를 함께 쓰므로 지도가 늦게 그려져도 읽을 수 있다) ----
let cur: Budget | null = null;
let scope: { sido: string | null } | null = null;
export const current = () => cur;
export function setBudget(b: Budget | null) {
  cur = b;
  document.dispatchEvent(new CustomEvent('rent:budget', { detail: b }));
}
/** 본문에서 시·도를 고르면 지도 범위도 옮긴다(지도가 아직 없으면 그릴 때 쓴다) */
export const pendingScope = () => { const s = scope; scope = null; return s; };
export function askScope(sido: string | null) {
  scope = { sido };
  document.dispatchEvent(new CustomEvent('rent:scope', { detail: { sido } }));
}
