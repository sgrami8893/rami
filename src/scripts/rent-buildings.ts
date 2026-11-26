// 전월세 지도: 건물별 실거래 이력(2026-11-26, 정부 kgeop.go.kr 공개 방식 참고).
// - 동을 고르면 요약 아래에 그 동의 건물 목록(거래 많은 순, 이름·지번 찾기). 건물을 누르면 같은 칸이 건물 이력으로 바뀐다.
// - 아주 가까이(줌 BUILD_ZOOM+) 보면 좌표가 있는 건물을 핀(묶음)으로 보여 주고, 핀을 눌러도 이력이 열린다.
// - 이력: 전용면적 고르기, 전세/월세, 최근 3년 선 그래프(SVG, 표와 같은 값), 계약 연월·보증금·월세 표.
// 표시 원칙: 층·호수·계약일(일)은 데이터에도 없다. 위험·안전 판정 없음. 데이터는 우리 빌드 JSON, 화면은 textContent만 쓴다.
import type * as Leaflet from 'leaflet';
import { announce } from './copy.ts';

export const BUILD_ZOOM = 15;
type Unit = { area: number; deals: { m: number; dep: number; mon: number }[] };
export type Bld = { id: string; file: string; dong: string; jibun: string; name: string; t: 0 | 1; by: number; lat: number | null; lng: number | null; units: Unit[]; n: number; last: number };
type Raw = { from: string; to: string; b: [string, string, string, 0 | 1, number, number | null, number | null, number[][]][] };
type Ctx = {
  L: typeof Leaflet; map: Leaflet.Map; src: string; card: HTMLElement;
  /** 지금 화면에 걸친 시·군·구 파일 중 건물 자료가 있는 것 */ filesInView: () => string[];
  /** 배지용 '서울 마포구' */ place: (file: string) => string;
  /** 요약 칸(PC 왼쪽 패널 또는 모바일 지도 위 카드) */ box: () => HTMLElement;
  /** 이력에서 '동네 요약으로'를 눌렀는데 그 동 요약이 아직 없을 때 */ pickDong: (file: string, dong: string) => void;
};

const TYPE = ['빌라', '오피스텔'] as const;
const LIST_STEP = 15, TABLE_STEP = 12;
const h = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text?: string) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
/** 만원 → '1억 3,000만' */
const amt = (v: number) => { const e = Math.floor(v / 10000), r = v % 10000; return `${e ? `${e}억` : ''}${e && r ? ' ' : ''}${r || !e ? `${r.toLocaleString('ko-KR')}만` : ''}`; };
const short = (v: number) => (v >= 10000 ? `${Math.round(v / 1000) / 10}억` : `${v.toLocaleString('ko-KR')}만`);
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createBuildings(ctx: Ctx) {
  const { L, map } = ctx;
  const data = new Map<string, { from: string; span: number; list: Bld[] }>();
  const loading = new Map<string, Promise<void>>();
  const byId = new Map<string, Bld>();
  const fromOf = (file: string) => data.get(file)?.from ?? '';
  const ymOf = (file: string, m: number) => { const f = fromOf(file); const t = Number(f.slice(0, 4)) * 12 + Number(f.slice(5, 7)) - 1 + m; return { y: Math.floor(t / 12), mo: (t % 12) + 1 }; };
  const ymText = (file: string, m: number) => { const { y, mo } = ymOf(file, m); return `${y}.${String(mo).padStart(2, '0')}`; };

  const load = (file: string) => {
    if (data.has(file)) return Promise.resolve();
    if (!loading.has(file)) loading.set(file, fetch(`${ctx.src}${file}.json`).then((r) => r.json() as Promise<Raw | null>).then((raw) => {
      if (!raw) return;
      const list = raw.b.map(([dong, jibun, name, t, by, lat, lng, us]) => {
        const units = us.map((u) => { const deals = []; for (let i = 1; i + 2 < u.length; i += 3) deals.push({ m: u[i], dep: u[i + 1], mon: u[i + 2] }); return { area: u[0], deals }; });
        const all = units.flatMap((u) => u.deals);
        const b: Bld = { id: `${file}|${dong}|${jibun}|${t}`, file, dong, jibun, name, t, by, lat, lng, units, n: all.length, last: Math.max(...all.map((d) => d.m)) };
        byId.set(b.id, b);
        return b;
      }).sort((a, b) => b.n - a.n || b.last - a.last);
      const span = (Number(raw.to.slice(0, 4)) - Number(raw.from.slice(0, 4))) * 12 + Number(raw.to.slice(5, 7)) - Number(raw.from.slice(5, 7));
      data.set(file, { from: raw.from, span: Math.max(1, span), list });
    }).catch(() => { loading.delete(file); }));
    return loading.get(file)!;
  };

  // ---- 핀 ----
  let cluster: Leaflet.MarkerClusterGroup | null = null;
  const markers = new Map<string, Leaflet.Marker>();
  let active: string | null = null;
  // 건물 핀(v3): 실거래 건수 알약 '12건'(주차장 핀과 같은 모양, 짙은 회색)
  const pinIcon = (b: Bld) => L.divIcon({ className: 'map-hit map-hit-tag', iconSize: [0, 0], iconAnchor: [0, 0], html: `<span class="map-tag map-tag-info">${b.n.toLocaleString('ko-KR')}건</span>` });
  const markerOf = (b: Bld) => {
    let m = markers.get(b.id);
    if (m) return m;
    m = L.marker([b.lat!, b.lng!], { icon: pinIcon(b), keyboard: true, title: '' });
    m.on('click', (e) => { L.DomEvent.stopPropagation(e); open(b, { fromMap: true }); });
    m.on('add', () => {
      const el = m!.getElement();
      if (!el) return;
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', `${b.name || '이름 없는 건물'} ${b.dong.split(' ').pop()} ${b.jibun}, ${TYPE[b.t]} 실거래 ${b.n}건, 이력 보기`);
      el.classList.toggle('is-active', b.id === active);
    });
    markers.set(b.id, m);
    return m;
  };
  const paint = () => markers.forEach((m, id) => m.getElement()?.classList.toggle('is-active', id === active));
  let pinsShown = false;
  async function refresh() {
    const near = map.getZoom() >= BUILD_ZOOM;
    if (!near) { if (cluster && map.hasLayer(cluster)) map.removeLayer(cluster); pinsShown = false; return; }
    if (!cluster) {
      await import('leaflet.markercluster');
      cluster = L.markerClusterGroup({
        showCoverageOnHover: false, maxClusterRadius: 50, spiderfyDistanceMultiplier: 1.6, disableClusteringAtZoom: 18, chunkedLoading: true,
        iconCreateFunction: (c) => { const n = c.getChildCount(); const sz = n < 10 ? 's' : n < 100 ? 'm' : 'l'; const hit = sz === 'l' ? 52 : 44;
          return L.divIcon({ className: 'map-hit', html: `<span class="map-cluster map-cluster-${sz}" aria-hidden="true"><b>${n.toLocaleString('ko-KR')}</b>곳</span><span class="sr-only">건물 ${n}곳 묶음, 눌러서 확대</span>`, iconSize: [hit, hit] }); },
      });
    }
    await Promise.all(ctx.filesInView().map(load));
    if (map.getZoom() < BUILD_ZOOM) return;
    const view = map.getBounds().pad(0.3);
    const want: Leaflet.Marker[] = [];
    for (const f of ctx.filesInView()) for (const b of data.get(f)?.list ?? []) if (b.lat !== null && b.lng !== null && view.contains([b.lat, b.lng])) want.push(markerOf(b));
    cluster.clearLayers();
    cluster.addLayers(want);
    if (!map.hasLayer(cluster)) cluster.addTo(map);
    pinsShown = want.length > 0;
    requestAnimationFrame(hideCovered);
  }
  /** 지도 위에 떠 있는 상자(전환 버튼·지역 선택·범례·카드·확대 버튼)에 가린 핀·묶음은 숨긴다(가려진 채 눌리거나 포커스되지 않게) */
  function hideCovered() {
    const root = map.getContainer().parentElement!;
    const boxes = [...root.querySelectorAll<HTMLElement>('.rm-toolbar > *, .rm-legend, .rm-card, .leaflet-control-zoom')].filter((x) => !x.closest('[hidden]') && x.offsetParent !== null).map((x) => x.getBoundingClientRect());
    for (const el of root.querySelectorAll<HTMLElement>('.leaflet-marker-pane .map-hit:not(.rm-label-wrap)')) {
      const r = ((el.firstElementChild as HTMLElement | null) ?? el).getBoundingClientRect(); // 보이는 알약·묶음(핀 래퍼는 크기 0)
      const hit = boxes.some((q) => r.left < q.right && r.right > q.left && r.top < q.bottom && r.bottom > q.top);
      el.style.visibility = hit ? 'hidden' : '';
      if (hit) el.setAttribute('tabindex', '-1'); else if (el.getAttribute('tabindex') === '-1') el.setAttribute('tabindex', '0');
    }
  }
  map.on('zoomend moveend', () => requestAnimationFrame(hideCovered));

  // ---- 동 요약 아래 건물 목록 ----
  const part = (el: HTMLElement, sel: string) => el.querySelector<HTMLElement>(sel);
  let current: { file: string; dong: string } | null = null;
  let lastTrigger: { id: string } | null = null;

  async function listDong(el: HTMLElement, file: string, dong: string) {
    current = { file, dong };
    const wrap = part(el, '.rp-blds');
    if (!wrap) return;
    await load(file);
    if (current?.file !== file || current.dong !== dong) return;
    const list = (data.get(file)?.list ?? []).filter((b) => b.dong === dong);
    if (!list.length) { wrap.hidden = true; return; }
    const ul = part(wrap, '.rp-blds-list')!, more = part(wrap, '.rp-blds-more') as HTMLButtonElement, q = wrap.querySelector<HTMLInputElement>('.rp-blds-q')!;
    part(wrap, '.rp-blds-meta')!.textContent = `건물 ${list.length.toLocaleString('ko-KR')}곳 · 최근 3년 거래 많은 순`;
    let shown = LIST_STEP;
    const draw = () => {
      const term = q.value.replace(/\s+/g, '');
      const hits = term ? list.filter((b) => `${b.name}${b.jibun}`.replace(/\s+/g, '').includes(term)) : list;
      ul.replaceChildren(...hits.slice(0, shown).map((b) => {
        const li = h('li');
        const btn = h('button', 'flex min-h-11 w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-bg');
        btn.type = 'button'; btn.dataset.bid = b.id;
        const txt = h('span', 'min-w-0 flex-1');
        txt.append(h('span', 'block truncate font-semibold text-ink', b.name || '이름 없는 건물'), h('span', 'block text-[length:calc(14px*var(--fs,1))] text-ink-3', `${b.jibun} · ${TYPE[b.t]}${b.by ? ` · ${b.by}년` : ''}`));
        btn.append(txt, h('span', 'shrink-0 text-[length:calc(14px*var(--fs,1))] font-semibold tabular-nums text-ink-2', `${b.n}건`));
        btn.addEventListener('click', () => open(b, { fromList: true }));
        li.append(btn); return li;
      }));
      if (!hits.length) ul.replaceChildren(h('li', 'px-2 py-2 text-cap text-ink-3', '찾는 건물이 없어요.'));
      more.hidden = hits.length <= shown;
      more.textContent = `더 보기 (${(hits.length - shown).toLocaleString('ko-KR')}곳 더)`;
    };
    q.value = '';
    q.oninput = () => { shown = LIST_STEP; draw(); };
    more.onclick = () => { shown += LIST_STEP * 2; draw(); };
    draw();
    wrap.hidden = false;
  }

  // ---- 건물 이력 ----
  let seq = 0;
  function chart(b: Bld, deals: Unit['deals'], kind: 'j' | 'w', area: number) {
    const NS = 'http://www.w3.org/2000/svg';
    const W = 340, H = 180, l = 46, r = 12, t = 12, bt = 28;
    const span = data.get(b.file)?.span ?? 35;
    const val = (d: Unit['deals'][number]) => (kind === 'j' ? d.dep : d.mon);
    let lo = Math.min(...deals.map(val)), hi = Math.max(...deals.map(val));
    if (lo === hi) { lo = Math.max(0, lo * 0.8); hi = hi * 1.2 || 1; } else { const p = (hi - lo) * 0.15; lo = Math.max(0, lo - p); hi += p; }
    const x = (m: number) => l + (m / span) * (W - l - r), y = (v: number) => t + (1 - (v - lo) / (hi - lo)) * (H - t - bt);
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('class', 'mt-3 w-full'); svg.setAttribute('role', 'img');
    const sorted = [...deals].sort((a, c) => a.m - c.m);
    const unit = kind === 'j' ? '전세 보증금' : '월세';
    svg.setAttribute('aria-label', `${Math.round(area)}㎡ ${unit} 그래프: ${ymText(b.file, sorted[0].m)} ${kind === 'j' ? amt(val(sorted[0])) : `월 ${val(sorted[0])}만`}부터 ${ymText(b.file, sorted.at(-1)!.m)} ${kind === 'j' ? amt(val(sorted.at(-1)!)) : `월 ${val(sorted.at(-1)!)}만`}까지 ${deals.length}건. 값은 아래 표에 있어요.`);
    const add = (tag: string, attrs: Record<string, string | number>, text?: string) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v)); if (text !== undefined) e.textContent = text; svg.appendChild(e); return e; };
    for (let i = 0; i <= 3; i++) {
      const v = lo + ((hi - lo) * i) / 3, yy = y(v);
      add('line', { x1: l, x2: W - r, y1: yy, y2: yy, stroke: '#E4E8EE', 'stroke-width': 1 });
      add('text', { x: l - 6, y: yy + 4, 'text-anchor': 'end', 'font-size': 11, fill: '#5F6B78' }, kind === 'j' ? short(Math.round(v / 100) * 100) : `${Math.round(v)}만`);
    }
    for (let m = 0; m <= span; m += 6) add('text', { x: x(m), y: H - 8, 'text-anchor': 'middle', 'font-size': 11, fill: '#5F6B78' }, ymText(b.file, m).slice(2));
    // 같은 달 여러 건은 평균으로 선을 잇고, 점은 거래마다 찍는다
    const months = [...new Set(sorted.map((d) => d.m))];
    const avg = months.map((m) => { const xs = sorted.filter((d) => d.m === m).map(val); return [m, xs.reduce((a, c) => a + c, 0) / xs.length] as const; });
    if (avg.length > 1) add('polyline', { points: avg.map(([m, v]) => `${x(m).toFixed(1)},${y(v).toFixed(1)}`).join(' '), fill: 'none', stroke: '#2563EB', 'stroke-width': 2, 'stroke-linejoin': 'round' });
    for (const d of sorted) add('circle', { cx: x(d.m).toFixed(1), cy: y(val(d)).toFixed(1), r: 4, fill: '#2563EB', stroke: '#fff', 'stroke-width': 1.5 });
    return svg;
  }

  function open(b: Bld, how: { fromMap?: boolean; fromList?: boolean } = {}) {
    const el = ctx.box();
    if (el !== ctx.card) ctx.card.hidden = true;
    el.hidden = false;
    part(el, '.rp-empty')?.setAttribute('hidden', '');
    part(el, '.rp-body')?.setAttribute('hidden', '');
    part(el, '.rp-blds')?.setAttribute('hidden', '');
    const box = part(el, '.rp-bld')!;
    active = b.id; paint();
    if (how.fromList) lastTrigger = { id: b.id };
    if (how.fromList && b.lat !== null && b.lng !== null) map.setView([b.lat, b.lng], Math.max(map.getZoom(), BUILD_ZOOM + 1), { animate: !reduced() });

    const id = ++seq;
    const units = new Map<number, Unit['deals']>(); // 정부 사이트처럼 ㎡ 정수로 묶는다
    for (const u of b.units) { const k = Math.round(u.area); units.set(k, [...(units.get(k) ?? []), ...u.deals]); }
    const areas = [...units.entries()].sort((a, c) => c[1].length - a[1].length || a[0] - c[0]);
    let area = areas[0][0];
    const pickKind = (ds: Unit['deals']) => (ds.filter((d) => d.mon === 0).length >= ds.filter((d) => d.mon > 0).length ? 'j' : 'w');
    let kind: 'j' | 'w' = pickKind(units.get(area)!);

    const back = h('button', 'flex min-h-11 items-center gap-1 rounded-xl px-2 text-[length:calc(15px*var(--fs,1))] font-semibold text-brand hover:bg-bg', '← 동네 요약으로');
    back.type = 'button';
    back.addEventListener('click', () => {
      active = null; paint();
      box.hidden = true;
      if (current && current.file === b.file && current.dong === b.dong && part(el, '.rp-name')?.textContent) {
        part(el, '.rp-body')?.removeAttribute('hidden');
        part(el, '.rp-blds')?.removeAttribute('hidden');
        const again = lastTrigger && el.querySelector<HTMLElement>(`[data-bid="${CSS.escape(lastTrigger.id)}"]`);
        (again ?? part(el, '.rp-name'))?.focus?.();
      } else ctx.pickDong(b.file, b.dong);
    });
    const badge = h('p', 'mt-1 text-cap font-semibold text-brand', `${ctx.place(b.file)} ${b.dong}`);
    const title = h('h3', 'pr-10 text-h2 font-bold leading-snug text-ink', b.name || '이름 없는 건물'); title.tabIndex = -1;
    const meta = h('p', 'mt-0.5 text-cap text-ink-3', `지번 ${b.jibun} · ${TYPE[b.t]}${b.by ? ` · ${b.by}년 지음` : ''} · 최근 3년 실거래 ${b.n}건`);

    const ctl = h('div', 'mt-3 flex flex-wrap items-center gap-2');
    const fs = h('fieldset', 'flex gap-0.5 rounded-xl bg-bg p-1');
    fs.append(h('legend', 'sr-only', '전세·월세'));
    const seg = 'relative flex min-h-11 min-w-[60px] cursor-pointer items-center justify-center rounded-[10px] px-3 text-[length:calc(15px*var(--fs,1))] font-semibold text-ink-2 has-checked:bg-ink has-checked:text-white has-focus-visible:outline-2 has-focus-visible:outline-brand';
    const radios = (['j', 'w'] as const).map((k) => {
      const lab = h('label', seg); const inp = h('input', 'sr-only'); inp.type = 'radio'; inp.name = `rb-kind-${id}`; inp.value = k;
      lab.append(inp, document.createTextNode(k === 'j' ? '전세' : '월세')); fs.append(lab); return inp;
    });
    const selWrap = h('label', 'flex min-h-11 items-center gap-1 rounded-xl bg-bg pl-3 pr-1 text-[length:calc(15px*var(--fs,1))] text-ink-2');
    selWrap.append(document.createTextNode('전용'));
    const sel = h('select', 'min-h-11 cursor-pointer rounded-[10px] bg-transparent pl-1 pr-2 font-semibold text-ink');
    sel.setAttribute('aria-label', '전용면적');
    sel.append(...areas.map(([a, ds]) => { const o = h('option', '', `${a}㎡ · ${ds.length}건`); o.value = String(a); return o; }));
    selWrap.append(sel);
    ctl.append(fs, selWrap);

    const body = h('div', '');
    const draw = () => {
      radios.forEach((r) => { r.checked = r.value === kind; });
      sel.value = String(area);
      const ds = units.get(area)!.filter((d) => (kind === 'j' ? d.mon === 0 : d.mon > 0)).sort((a, c) => c.m - a.m || c.dep - a.dep);
      if (!ds.length) { body.replaceChildren(h('p', 'mt-3 rounded-xl bg-bg px-3 py-3 text-cap text-ink-2', `이 면적은 최근 3년 ${kind === 'j' ? '전세' : '월세'} 거래가 없어요.`)); return; }
      const table = h('table', 'mt-3 w-full text-left text-cap tabular-nums');
      table.append(h('caption', 'sr-only', `${area}㎡ ${kind === 'j' ? '전세' : '월세'} 실거래(최근 계약부터)`));
      const head = h('tr', 'text-ink-3');
      for (const c of ['계약', '보증금', ...(kind === 'w' ? ['월세'] : [])]) { const th = h('th', 'py-1 font-medium', c); th.scope = 'col'; head.append(th); }
      const thead = h('thead'); thead.append(head);
      const tb = h('tbody', 'text-ink [&_td]:py-1.5 [&_td]:pr-2 [&_tr]:border-t [&_tr]:border-line');
      let shown = TABLE_STEP;
      const more = h('button', 'mt-2 flex min-h-11 w-full items-center justify-center rounded-xl bg-bg text-[length:calc(15px*var(--fs,1))] font-semibold text-ink-2');
      more.type = 'button';
      const rows = () => {
        tb.replaceChildren(...ds.slice(0, shown).map((d) => {
          const tr = h('tr');
          tr.append(h('td', '', ymText(b.file, d.m)), h("td", "", `${amt(d.dep)} 원`), ...(kind === 'w' ? [h('td', '', `월 ${d.mon.toLocaleString('ko-KR')}만 원`)] : []));
          return tr;
        }));
        more.hidden = ds.length <= shown; more.textContent = `더 보기 (${ds.length - shown}건 더)`;
      };
      more.addEventListener('click', () => { shown += TABLE_STEP * 3; rows(); });
      rows();
      table.append(thead, tb);
      body.replaceChildren(chart(b, ds, kind, area), table, more);
    };
    radios.forEach((r) => r.addEventListener('change', () => { kind = r.value as 'j' | 'w'; draw(); }));
    sel.addEventListener('change', () => { area = Number(sel.value); kind = pickKind(units.get(area)!); draw(); });
    draw();
    const note = h('p', 'mt-3 text-[length:calc(13px*var(--fs,1))] leading-relaxed text-ink-3', '계약 연월 기준 국토교통부 신고 실거래예요. 층·호수는 보여 주지 않아요. 신고 뒤 해제·정정된 거래가 남아 있을 수 있어요.');
    box.replaceChildren(back, badge, title, meta, ctl, body, note);
    box.hidden = false;
    if (el !== ctx.card) el.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' });
    if (!how.fromMap || el === ctx.card) title.focus({ preventScroll: el !== ctx.card });
    announce(`${b.name || '건물'} 실거래 이력을 보여 줘요.`);
    requestAnimationFrame(hideCovered);
  }

  /** 다른 동·시군구 요약으로 바뀔 때 건물 칸을 비운다 */
  function reset(el: HTMLElement) {
    const d = part(el, '.rp-bld'); if (d) { d.hidden = true; d.replaceChildren(); }
    const w = part(el, '.rp-blds'); if (w) w.hidden = true;
    current = null;
    if (active) { active = null; paint(); }
    requestAnimationFrame(hideCovered);
  }
  return { refresh, listDong, reset, hideCovered, get pinsShown() { return pinsShown; } };
}
