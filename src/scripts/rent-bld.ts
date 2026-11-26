// 전월세 동 상세 '건물별 거래' 탭(2026-11-26 v2, 사용자·제미나이 합의).
// - 최근 3년 3건 이상 거래된 건물만 목록·이력(1~2건 건물은 탭 머리에 수만). 건물 이름·지번으로 찾기, 최근 거래 순.
// - 건물을 누르면 같은 탭 안에서 이력(전용면적·전세/월세, 3년 선 그래프 + 표)으로 바뀌고 '← 건물 목록'으로 돌아온다.
// - 지도와: 목록에서 고르면 'rent:bld-focus'(지도가 그 건물로 이동·강조), 지도 핀을 누르면 'rent:bld-open'(여기서 연다).
// 표시 원칙: 층·호수·계약일(일)은 데이터에도 없다. 위험·안전 판정 없음. 화면은 textContent만 쓴다.
import { announce } from './copy.ts';
import { onPage } from './soft-nav.ts';

export const BLD_MIN = 3;
type Unit = { area: number; deals: { m: number; dep: number; mon: number }[] };
export type Bld = { id: string; file: string; dong: string; jibun: string; name: string; t: 0 | 1; by: number; lat: number | null; lng: number | null; units: Unit[]; n: number; last: number };
type Raw = { from: string; to: string; b: [string, string, string, 0 | 1, number, number | null, number | null, number[][]][] };
export type BldFile = { from: string; span: number; list: Bld[] };

const TYPE = ['빌라', '오피스텔'] as const;
const STEP = 20, TABLE_STEP = 12;
const cache = new Map<string, Promise<BldFile | null>>();
export const bldId = (file: string, dong: string, jibun: string, t: number) => `${file}|${dong}|${jibun}|${t}`;
/** 시·군·구 하나의 건물 자료(지도 핀과 탭이 함께 쓴다) */
export function loadBld(src: string, file: string): Promise<BldFile | null> {
  if (!cache.has(file)) cache.set(file, fetch(`${src}${file}.json`).then((r) => (r.ok ? (r.json() as Promise<Raw | null>) : null)).then((raw) => {
    if (!raw) return null;
    const list = raw.b.map(([dong, jibun, name, t, by, lat, lng, us]) => {
      const units = us.map((u) => { const deals = []; for (let i = 1; i + 2 < u.length; i += 3) deals.push({ m: u[i], dep: u[i + 1], mon: u[i + 2] }); return { area: u[0], deals }; });
      const all = units.flatMap((u) => u.deals);
      return { id: bldId(file, dong, jibun, t), file, dong, jibun, name, t, by, lat, lng, units, n: all.length, last: Math.max(...all.map((d) => d.m)) } as Bld;
    }).filter((b) => b.n >= BLD_MIN).sort((a, b) => b.last - a.last || b.n - a.n);
    const span = (Number(raw.to.slice(0, 4)) - Number(raw.from.slice(0, 4))) * 12 + Number(raw.to.slice(5, 7)) - Number(raw.from.slice(5, 7));
    return { from: raw.from, span: Math.max(1, span), list };
  }).catch(() => { cache.delete(file); return null; }));
  return cache.get(file)!;
}

const h = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text?: string) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
/** 만원 → '1억 3,000만' */
const amt = (v: number) => { const e = Math.floor(v / 10000), r = v % 10000; return `${e ? `${e}억` : ''}${e && r ? ' ' : ''}${r || !e ? `${r.toLocaleString('ko-KR')}만` : ''}`; };
const short = (v: number) => (v >= 10000 ? `${Math.round(v / 1000) / 10}억` : `${v.toLocaleString('ko-KR')}만`);
const ymText = (from: string, m: number) => { const t = Number(from.slice(0, 4)) * 12 + Number(from.slice(5, 7)) - 1 + m; return `${Math.floor(t / 12)}.${String((t % 12) + 1).padStart(2, '0')}`; };
const lastDeal = (b: Bld) => b.units.flatMap((u) => u.deals).filter((d) => d.m === b.last).sort((a, c) => c.dep - a.dep)[0];
const dealText = (d: { dep: number; mon: number }) => (d.mon ? `월세 ${short(d.dep)}/${d.mon}` : `전세 ${amt(d.dep)}`);

function chart(f: BldFile, deals: Unit['deals'], kind: 'j' | 'w', area: number) {
  const NS = 'http://www.w3.org/2000/svg';
  const W = 340, H = 180, l = 46, r = 12, t = 12, bt = 28;
  const val = (d: Unit['deals'][number]) => (kind === 'j' ? d.dep : d.mon);
  let lo = Math.min(...deals.map(val)), hi = Math.max(...deals.map(val));
  if (lo === hi) { lo = Math.max(0, lo * 0.8); hi = hi * 1.2 || 1; } else { const p = (hi - lo) * 0.15; lo = Math.max(0, lo - p); hi += p; }
  const x = (m: number) => l + (m / f.span) * (W - l - r), y = (v: number) => t + (1 - (v - lo) / (hi - lo)) * (H - t - bt);
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('class', 'mt-3 w-full'); svg.setAttribute('role', 'img');
  const sorted = [...deals].sort((a, c) => a.m - c.m);
  const fmt = (d: Unit['deals'][number]) => (kind === 'j' ? amt(val(d)) : `월 ${val(d)}만`);
  svg.setAttribute('aria-label', `${Math.round(area)}㎡ ${kind === 'j' ? '전세 보증금' : '월세'} 그래프: ${ymText(f.from, sorted[0].m)} ${fmt(sorted[0])}부터 ${ymText(f.from, sorted.at(-1)!.m)} ${fmt(sorted.at(-1)!)}까지 ${deals.length}건. 값은 아래 표에 있어요.`);
  const add = (tag: string, attrs: Record<string, string | number>, text?: string) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v)); if (text !== undefined) e.textContent = text; svg.appendChild(e); return e; };
  for (let i = 0; i <= 3; i++) {
    const v = lo + ((hi - lo) * i) / 3, yy = y(v);
    add('line', { x1: l, x2: W - r, y1: yy, y2: yy, stroke: '#EEF0F3', 'stroke-width': 1 });
    add('text', { x: l - 6, y: yy + 4, 'text-anchor': 'end', 'font-size': 11, fill: '#5F6B78' }, kind === 'j' ? short(Math.round(v / 100) * 100) : `${Math.round(v)}만`);
  }
  for (let m = 0; m <= f.span; m += 6) add('text', { x: x(m), y: H - 8, 'text-anchor': 'middle', 'font-size': 11, fill: '#5F6B78' }, ymText(f.from, m).slice(2));
  const months = [...new Set(sorted.map((d) => d.m))];
  const avg = months.map((m) => { const xs = sorted.filter((d) => d.m === m).map(val); return [m, xs.reduce((a, c) => a + c, 0) / xs.length] as const; });
  if (avg.length > 1) add('polyline', { points: avg.map(([m, v]) => `${x(m).toFixed(1)},${y(v).toFixed(1)}`).join(' '), fill: 'none', stroke: '#6B1F57', 'stroke-width': 2, 'stroke-linejoin': 'round' });
  for (const d of sorted) add('circle', { cx: x(d.m).toFixed(1), cy: y(val(d)).toFixed(1), r: 4, fill: '#6B1F57', stroke: '#fff', 'stroke-width': 1.5 });
  return svg;
}

function showHistory(box: HTMLElement, f: BldFile, b: Bld, back: () => void) {
  const units = new Map<number, Unit['deals']>();
  for (const u of b.units) { const k = Math.round(u.area); units.set(k, [...(units.get(k) ?? []), ...u.deals]); }
  const areas = [...units.entries()].sort((a, c) => c[1].length - a[1].length || a[0] - c[0]);
  let area = areas[0][0];
  const pickKind = (ds: Unit['deals']) => (ds.filter((d) => d.mon === 0).length >= ds.filter((d) => d.mon > 0).length ? 'j' : 'w');
  let kind: 'j' | 'w' = pickKind(units.get(area)!);
  const btn = h('button', 'v-back', '← 건물 목록'); btn.type = 'button'; btn.addEventListener('click', back);
  const title = h('h3', 'mt-1 text-h2 font-bold leading-snug text-ink', b.name || '이름 없는 건물'); title.tabIndex = -1;
  const meta = h('p', 'mt-0.5 text-cap text-ink-3', `지번 ${b.jibun} · ${TYPE[b.t]}${b.by ? ` · ${b.by}년 지음` : ''} · 최근 3년 ${b.n}건`);
  const ctl = h('div', 'mt-3 flex flex-wrap items-center gap-2');
  const seg = h('div', 'v-seg'); seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', '전세·월세');
  const kb = (['j', 'w'] as const).map((k) => { const x = h('button', '', k === 'j' ? '전세' : '월세'); x.type = 'button'; x.addEventListener('click', () => { kind = k; draw(); }); seg.append(x); return x; });
  const selWrap = h('label', 'flex min-h-11 items-center gap-1 rounded-xl bg-bg pl-3 pr-1 text-[length:calc(15px*var(--fs,1))] text-ink-2');
  selWrap.append(document.createTextNode('전용'));
  const sel = h('select', 'min-h-11 cursor-pointer rounded-[10px] bg-transparent pl-1 pr-2 font-semibold text-ink');
  sel.setAttribute('aria-label', '전용면적');
  sel.append(...areas.map(([a, ds]) => { const o = h('option', '', `${a}㎡ · ${ds.length}건`); o.value = String(a); return o; }));
  selWrap.append(sel); ctl.append(seg, selWrap);
  const body = h('div');
  const draw = () => {
    kb.forEach((x, i) => x.setAttribute('aria-pressed', String((i === 0 ? 'j' : 'w') === kind)));
    sel.value = String(area);
    const ds = units.get(area)!.filter((d) => (kind === 'j' ? d.mon === 0 : d.mon > 0)).sort((a, c) => c.m - a.m || c.dep - a.dep);
    if (!ds.length) { body.replaceChildren(h('p', 'mt-3 rounded-xl bg-bg px-3 py-3 text-cap text-ink-2', `이 면적은 최근 3년 ${kind === 'j' ? '전세' : '월세'} 거래가 없어요.`)); return; }
    const table = h('table', 'v-tbl mt-3');
    table.append(h('caption', 'sr-only', `${area}㎡ ${kind === 'j' ? '전세' : '월세'} 실거래(최근 계약부터)`));
    const head = h('tr');
    for (const c of ['계약', '보증금', ...(kind === 'w' ? ['월세'] : [])]) { const th = h('th', c === '계약' ? '' : 'r', c); th.scope = 'col'; head.append(th); }
    const thead = h('thead'); thead.append(head);
    const tb = h('tbody');
    let shown = TABLE_STEP;
    const more = h('button', 'v-more'); more.type = 'button';
    const rows = () => {
      tb.replaceChildren(...ds.slice(0, shown).map((d) => { const tr = h('tr'); tr.append(h('td', 'num', ymText(f.from, d.m)), h('td', 'r num b', amt(d.dep)), ...(kind === 'w' ? [h('td', 'r num', `월 ${d.mon}만`)] : [])); return tr; }));
      more.hidden = ds.length <= shown; more.textContent = `${ds.length - shown}건 더 보기`;
    };
    more.addEventListener('click', () => { shown += TABLE_STEP * 3; rows(); });
    rows(); table.append(thead, tb);
    body.replaceChildren(chart(f, ds, kind, area), table, more);
  };
  sel.addEventListener('change', () => { area = Number(sel.value); kind = pickKind(units.get(area)!); draw(); });
  draw();
  const note = h('p', 'mt-3 text-[length:calc(13px*var(--fs,1))] leading-relaxed text-ink-3', '계약 연월 기준 국토교통부 신고 실거래예요. 층·호수는 보여 주지 않아요. 신고 뒤 해제·정정된 거래가 남아 있을 수 있어요.');
  box.replaceChildren(btn, title, meta, ctl, body, note);
  title.focus();
  announce(`${b.name || '건물'} 실거래 이력을 보여 줘요.`);
}

/** 동 상세 페이지의 탭 칸(#rent-bld[data-file][data-dong][data-src]) */
function mountTab() {
  const root = document.getElementById('rent-bld');
  if (!root || root.dataset.ready) return;
  root.dataset.ready = '1';
  const { file = '', dong = '', src = '/geo/rent-b/' } = root.dataset;
  const listBox = root.querySelector<HTMLElement>('.bld-list')!;
  const hist = root.querySelector<HTMLElement>('.bld-hist')!;
  const ul = root.querySelector<HTMLElement>('.bld-rows')!;
  const q = root.querySelector<HTMLInputElement>('.bld-q')!;
  const more = root.querySelector<HTMLButtonElement>('.bld-more')!;
  const msg = root.querySelector<HTMLElement>('.bld-msg')!;
  let f: BldFile | null = null;
  let list: Bld[] = [];
  let shown = STEP;
  let lastId: string | null = null;
  const draw = () => {
    const term = q.value.replace(/\s+/g, '');
    const hits = term ? list.filter((b) => `${b.name}${b.jibun}`.replace(/\s+/g, '').includes(term)) : list;
    ul.replaceChildren(...hits.slice(0, shown).map((b) => {
      const row = h('div', 'v-row'); row.dataset.bid = b.id;
      const t = h('div', 't');
      const name = h('button', 'n text-left', b.name || '이름 없는 건물'); name.type = 'button';
      name.addEventListener('click', () => open(b));
      name.addEventListener('mouseenter', () => document.dispatchEvent(new CustomEvent('rent:bld-hover', { detail: b.id })));
      t.append(name, h('span', 's', `${b.jibun} · ${TYPE[b.t]} · 3년 ${b.n}건`));
      const d = lastDeal(b);
      const v = h('div', 'val'); v.append(document.createTextNode(dealText(d)), h('small', '', `${ymText(f!.from, b.last)} 계약`));
      row.append(t, v);
      row.addEventListener('click', (e) => { if (e.target !== name) open(b); });
      return row;
    }));
    msg.hidden = hits.length > 0;
    msg.textContent = list.length ? '찾는 건물이 없어요.' : '최근 3년 3건 이상 거래된 건물이 없어요.';
    more.hidden = hits.length <= shown;
    more.textContent = `${Math.min(STEP, hits.length - shown)}곳 더 보기`;
  };
  const back = () => {
    hist.hidden = true; hist.replaceChildren(); listBox.hidden = false;
    document.dispatchEvent(new CustomEvent('rent:bld-focus', { detail: null }));
    (lastId ? ul.querySelector<HTMLElement>(`[data-bid="${CSS.escape(lastId)}"] button`) : q)?.focus();
  };
  const open = (b: Bld) => {
    if (!f) return;
    lastId = b.id;
    listBox.hidden = true; hist.hidden = false;
    showHistory(hist, f, b, back);
    document.dispatchEvent(new CustomEvent('rent:bld-focus', { detail: { id: b.id, lat: b.lat, lng: b.lng } }));
  };
  q.addEventListener('input', () => { shown = STEP; draw(); });
  more.addEventListener('click', () => { shown += STEP; draw(); });
  void loadBld(src, file).then((x) => {
    f = x; list = (x?.list ?? []).filter((b) => b.dong === dong);
    root.querySelector<HTMLElement>('.bld-loading')?.remove();
    draw();
    const want = decodeURIComponent(location.hash.match(/^#bld=(.+)$/)?.[1] ?? '');
    const hit = want && list.find((b) => b.id === want);
    if (hit) { document.querySelector<HTMLElement>('[role="tab"][aria-controls="tab-bld"]')?.click(); open(hit); }
  });
  // 지도 핀을 누르면(같은 동) 탭을 열고 그 건물 이력을 보여 준다
  const onOpen = (e: Event) => {
    if (!document.contains(root)) { document.removeEventListener('rent:bld-open', onOpen); return; }
    const id = (e as CustomEvent<string>).detail;
    const b = list.find((x) => x.id === id);
    if (!b) return;
    document.querySelector<HTMLElement>('[role="tab"][aria-controls="tab-bld"]')?.click();
    open(b);
  };
  document.addEventListener('rent:bld-open', onOpen);
}
export function initBldTab() { onPage(mountTab); }
