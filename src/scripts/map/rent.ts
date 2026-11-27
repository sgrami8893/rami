// 전월세 지도 v2(2026-11-26 '지도도 처음부터, 가장 편하게').
// 초점(focus)에 따라 무엇을 칠할지 정한다. 확대·축소로 범위가 저절로 바뀌지 않는다.
// - 처음(/, /rent/): 수도권 시·군·구 전부를 중위값 색 + '마포구 2.1억' 라벨
// - 시·도(/rent/seoul/): 그 시·도의 시·군·구만 색·라벨, 바깥은 흐린 회색(눌러서 이동 가능)
// - 시·군·구(/rent/seoul/mapo/): 그 시·군·구의 동만 색·라벨, 이웃 시·군·구는 흐린 회색
// - 동(/rent/seoul/mapo/망원동/): 위와 같고 그 동만 진한 테두리. '건물별 거래' 탭을 열면 건물 점을 찍는다
// 색은 따뜻한 한 방향 6단계, 거래 30건 미만·값 없음은 연회색 '거래 적음'. 라벨은 흰 알약(색만으로 정보를 주지 않음), 겹치면 거래 적은 쪽을 숨긴다.
// '내 예산' 결과가 있으면(rent:budget) 처음 화면의 시·군·구를 예산 안 동네 수로 칠한다.
// 사실 숫자만(중위값·건수), 위험·안전 판정 없음. 화면에 넣는 글자는 textContent·esc()만.
import type * as Leaflet from 'leaflet';
import { createMap, placeLabels, esc, LG, meIcon, reduced } from './base.ts';
import type { Ctx, Focus, Layer, Pick } from './shell.ts';
import { rentMode } from '../v2-rent-mode.ts';
import { announce } from '../copy.ts';
import { current as currentBudget, judge, loadIndex, countStep, ROOM_COLORS, OVER, type Budget } from '../rent-budget-core.ts';

type M = (number | null)[];
type SggP = { f: string; nm: string; sd: string; l: [number, number]; n: number; h: string | null; m: M };
type DongP = { k: string; c: string; l: [number, number]; n: number; h: string | null; m: M };
type Feat<P> = { type: 'Feature'; properties: P; geometry: GeoJSON.Geometry };
type SggFC = { features: Feat<SggP>[]; low: number; breaks: Record<string, number[]> };

const COLORS = ['#FDF0C4', '#FBCB7A', '#F59A4E', '#E4634A', '#B23A5B', '#6B1F57'];
const LOWC = '#E3E6EA';
/** 첫 화면 범위에서 뺄 먼 섬 지역 */
const FAR = new Set(['incheon__ongjin-gun']);
// 경계선(2026-11-27 사용자 '외곽선이 너무 하얘서 안 보임'): 흰 선 → 옅은 잉크 회색 가는 선. 고른 곳은 자두색. 굵기는 그대로 가늘게
const LINE = { color: '#3D4652', opacity: 0.45, weight: 1 };
const DIM = { fillColor: '#DDE1E6', fillOpacity: 0.28, color: '#8B95A1', weight: 1, opacity: 0.55 };
const short = (v: number) => (v >= 10000 ? `${(Math.round(v / 1000) / 10).toString()}억` : `${v.toLocaleString('ko-KR')}만`);
const fmt = (v: number, k: 'j' | 'w') => (k === 'j' ? short(v) : `월 ${v}만`);

export async function mount(ctx: Ctx): Promise<Layer> {
  const { canvas, pane } = ctx;
  const src = canvas.dataset.src || '/geo/rent/';
  const bsrc = canvas.dataset.bsrc || '';
  let focus = JSON.parse(canvas.dataset.focus || '{}') as Focus;
  const [{ L, map }, sgg] = await Promise.all([createMap(canvas), fetch(`${src}sgg.json`).then((r) => r.json() as Promise<SggFC | null>)]);
  if (!sgg) throw new Error('rent geo missing');
  const emd = new Map<string, Promise<{ features: Feat<DongP>[] } | null>>();
  const loadEmd = (file: string) => {
    if (!emd.has(file)) emd.set(file, fetch(`${src}${encodeURIComponent(file)}.json`).then((r) => (r.ok ? r.json() : null)).catch(() => { emd.delete(file); return null; }));
    return emd.get(file)!;
  };

  // ---- 값·색 ----
  const mode = () => rentMode();
  const idx = () => { const m = mode(); return (m.t === 'v' ? 0 : 3) + (m.k === 'j' ? 0 : 1); };
  const metric = () => { const m = mode(); return `${m.t}${m.k}`; };
  const valueOf = (p: { n: number; m: M }) => (p.n >= sgg.low ? p.m[idx()] : null);
  const colorOf = (v: number | null) => {
    if (v === null) return LOWC;
    const b = sgg.breaks[metric()] ?? [];
    let i = 0; while (i < b.length && v >= b[i]) i++;
    return COLORS[Math.min(i, 5)];
  };
  const kindLabel = () => { const m = mode(); return `${m.t === 'v' ? '빌라' : '오피스텔'} ${m.k === 'j' ? '전세' : '월세'}`; };

  // ---- 내 예산(처음 화면만) ----
  let budget: Budget | null = currentBudget();
  let counts: Map<string, number> | null = null;
  const loadCounts = async () => {
    if (!budget) { counts = null; return; }
    const ix = await loadIndex(src);
    const c = new Map<string, number>();
    for (const d of ix.d) if (judge(d, ix.low, budget).s === 'ok') c.set(d.f, (c.get(d.f) ?? 0) + 1);
    counts = c;
  };

  // ---- 칸 ----
  const fill = map.getPane('v2-fill') ? 'v2-fill' : undefined;
  const sggByF = new Map<string, Leaflet.Path & { feature: Feat<SggP> }>();
  const dongByK = new Map<string, Leaflet.Path & { feature: Feat<DongP> }>();
  let dongLayer: Leaflet.GeoJSON | null = null;
  let dongFile: string | null = null;
  const fileOf = () => (focus.sido && focus.slug ? `${focus.sido}__${focus.slug}` : null);
  const level = () => (focus.dong ? 'dong' : focus.slug ? 'sgg' : focus.sido ? 'sido' : 'home');
  const sidoOf = (f: string) => f.split('__')[0];
  /** 목록 줄의 data-key와 같은 값: 처음 화면은 '시도__시군구', 시·도 화면은 시·군·구 slug */
  const sggKey = (f: string) => (level() === 'home' ? f : f.split('__')[1]);
  /** 이 시·군·구가 지금 색칠 대상인가(아니면 흐린 이웃) */
  const sggActive = (f: string) => level() === 'home' || (level() === 'sido' && sidoOf(f) === focus.sido);

  const sggStyle = (p: SggP): Leaflet.PathOptions => {
    if (!sggActive(p.f)) {
      // 지금 시·군·구(동 단계)는 채우지 않고 바깥 테두리만(동 칸이 위에 깔림)
      if (p.f === fileOf()) return { fillOpacity: 0, color: '#6B1F57', weight: 2, opacity: 0.75, className: 'rm-edge' }; // 검정 테두리 없음(2026-11-26 사용자)
      return DIM;
    }
    if (budget && level() === 'home') {
      const c = counts?.get(p.f) ?? 0;
      return { fillColor: c ? ROOM_COLORS[countStep(c)] : OVER, fillOpacity: c ? 0.5 : 0.45, ...LINE };
    }
    const v = valueOf(p);
    return { fillColor: colorOf(v), fillOpacity: v === null ? 0.45 : 0.5, ...LINE };
  };
  const dongStyle = (p: DongP): Leaflet.PathOptions => {
    const v = valueOf(p);
    const sel = focus.dong === p.k;
    // 동 단계(건물 알약이 주인공)는 칸을 옅게: 알약·배경지도가 묻히지 않게
    if (level() === 'dong') return { fillColor: colorOf(v), fillOpacity: sel ? 0.25 : 0.3, ...LINE };
    return { fillColor: colorOf(v), fillOpacity: v === null ? 0.45 : sel ? 0.75 : 0.5, ...LINE };
  };

  // 강조선(마우스·고른 동): 맨 위 칸에 흰 3px + 그림자. 누를 수 없음
  const lines = L.layerGroup().addTo(map);
  let ghost: Leaflet.Layer | null = null;
  let selLine: Leaflet.Layer | null = null;
  const outline = (g: GeoJSON.Geometry, sel: boolean) => L.geoJSON(g as GeoJSON.GeoJsonObject, { pane: 'v2-line', interactive: false,
    style: { color: sel ? '#6B1F57' : '#191F28', weight: sel ? 2.5 : 2, opacity: sel ? 1 : 0.7, fill: false, className: sel ? 'rm-sel' : 'rm-hov' } });
  // 고른 동·마우스 칸: 검정선 대신 흰 선 + 은은한 그림자(고른 동은 자두색 번짐)로 '떠오른' 느낌(2026-11-26 사용자 '검정 외곽선 구려')

  // ---- 라벨 ----
  const labels = L.layerGroup().addTo(map);
  let labelItems: { m: Leaflet.Marker; pri: number; w: number; h: number }[] = [];
  // 라벨 v3(2026-11-26 '지도 더 편하게·예쁘게'): 이름(작은 회색) + 값 배지(그 칸의 단계 색, 진한 두 단계는 흰 글자). 칸 채움은 옅게 → 숫자가 주인공
  const DARK = new Set(['#B23A5B', '#6B1F57']);
  const addLabel = (ll: [number, number], name: string, val: string | null, pri: number, muted = false, color?: string, sel = false) => {
    const w = Math.max(name.length, (val ?? '').length) * 13 + 20;
    const m = L.marker([ll[0], ll[1]], { interactive: false, keyboard: false, icon: L.divIcon({ className: 'mv-lbl-wrap', iconSize: [0, 0],
      html: `<span class="mv-lbl${muted ? ' is-muted' : ''}${sel ? ' is-sel' : ''}"><b>${esc(name)}</b>${val ? `<i style="--c:${color ?? '#fff'};--t:${color && DARK.has(color) ? '#fff' : '#191F28'}">${esc(val)}</i>` : ''}</span>` }) });
    m.addTo(labels);
    labelItems.push({ m, pri, w, h: val ? 46 : 24 });
  };
  const layoutLabels = () => {
    const sorted = [...labelItems].sort((a, b) => b.pri - a.pri);
    placeLabels(sorted.map((it) => { const pt = map.latLngToContainerPoint(it.m.getLatLng()); return { el: it.m.getElement()!, x: pt.x, y: pt.y, w: it.w, h: it.h }; }).filter((x) => x.el));
  };
  map.on('zoomend moveend', layoutLabels);

  const drawLabels = () => {
    labels.clearLayers(); labelItems = [];
    const k = mode().k;
    if (level() === 'home' || level() === 'sido') {
      for (const f of sgg.features) {
        const p = f.properties;
        if (!sggActive(p.f)) continue;
        if (budget && level() === 'home') { const c = counts?.get(p.f) ?? 0; addLabel(p.l, p.nm, c ? `${c}곳` : null, c * 1000 + p.n, !c, c ? ROOM_COLORS[countStep(c)] : undefined); continue; }
        const v = valueOf(p);
        addLabel(p.l, p.nm, v === null ? null : fmt(v, k), p.n, v === null, colorOf(v));
      }
    } else if (dongLayer) {
      for (const [, lyr] of dongByK) {
        const p = lyr.feature.properties;
        if (level() === 'dong' && focus.dong === p.k) continue; // 고른 동 이름은 위치 줄에 있고, 이름표가 건물 알약을 가린다
        const v = valueOf(p);
        addLabel(p.l, p.k, v === null ? null : fmt(v, k), (focus.dong === p.k ? 1e9 : 0) + p.n, v === null, colorOf(v), focus.dong === p.k);
      }
    }
    requestAnimationFrame(layoutLabels);
  };

  // ---- 고르기·마우스 ----
  const pickOf = (p: SggP | DongP, isDong: boolean): Pick => {
    const name = isDong ? (p as DongP).k : `${(p as SggP).sd} ${(p as SggP).nm}`;
    const key = isDong ? (p as DongP).k : sggKey((p as SggP).f);
    if (!isDong && budget && level() === 'home') {
      const c = counts?.get((p as SggP).f) ?? 0;
      return { key, title: name, value: c ? `예산 안 동네 ${c}곳` : '예산 안 동네 없음', sub: `최근 12개월 거래 ${p.n.toLocaleString('ko-KR')}건`, href: p.h };
    }
    const v = valueOf(p);
    const m = mode();
    const dep = m.k === 'w' ? p.m[idx() + 1] : null;
    // 거래가 적어 동 페이지가 없거나 숫자가 없는 동: 막다른 카드 대신 그 시·군·구 시세로 보낸다
    const up = isDong && (v === null || !p.h) ? sggByF.get(fileOf() ?? '')?.feature.properties : undefined;
    const upHref = up?.h && up.h !== location.pathname ? up.h : null;
    return {
      key, title: name, href: upHref ?? p.h,
      linkLabel: upHref ? `${up!.nm} 전체 시세 보기` : undefined,
      value: v === null ? undefined : m.k === 'j' ? `${kindLabel()} 중위 ${short(v)}` : `${kindLabel()} 중위 ${dep !== null ? `${short(dep)} / ` : ''}월 ${v}만`,
      sub: `최근 12개월 거래 ${p.n.toLocaleString('ko-KR')}건`,
      note: v === null ? `${p.n ? '거래가 적어 숫자를 비교하지 않아요.' : '최근 12개월 거래가 없어요.'}${upHref ? ' 시·군·구 전체 시세는 볼 수 있어요.' : ''}` : undefined,
    };
  };
  const tip = (pk: Pick) => {
    const d = document.createElement('div');
    const t = document.createElement('strong'); t.className = 'rm-tip-path'; t.textContent = pk.title;
    const s = document.createElement('span'); s.className = 'rm-tip-val'; s.textContent = pk.value ?? pk.note ?? '';
    d.append(t, s);
    return d;
  };
  const TIP = { sticky: true, direction: 'top' as const, offset: [0, -14] as [number, number], className: 'rm-tip', opacity: 1 };
  const showGhost = (g: GeoJSON.Geometry | null) => { if (ghost) lines.removeLayer(ghost); ghost = g ? outline(g, false).addTo(lines) : null; };
  const bind = (lyr: Leaflet.Path, isDong: boolean) => {
    const f = (lyr as unknown as { feature: Feat<SggP | DongP> }).feature;
    if (LG.matches) lyr.bindTooltip(() => tip(pickOf(f.properties, isDong)), TIP); // 모바일은 툴팁 없이 카드 한 장
    lyr.on('mouseover', () => {
      const p = f.properties;
      const active = isDong || sggActive((p as SggP).f);
      if (!LG.matches) { lyr.closeTooltip(); return; }
      if (active || (p as SggP).f !== fileOf()) showGhost(f.geometry);
      ctx.hovered(isDong ? (p as DongP).k : sggKey((p as SggP).f));
    });
    lyr.on('mouseout', () => { showGhost(null); ctx.hovered(null); });
    lyr.on('click', (e) => {
      L.DomEvent.stopPropagation(e);
      if (!LG.matches) lyr.closeTooltip(); // 모바일은 카드 한 장만
      const p = f.properties;
      if (!isDong && (p as SggP).f === fileOf()) return; // 지금 시·군·구 테두리(속은 동 칸)
      ctx.pick(pickOf(p, isDong), (e as Leaflet.LeafletMouseEvent).originalEvent instanceof KeyboardEvent);
    });
  };

  const sggLayer = L.geoJSON(sgg as unknown as GeoJSON.GeoJsonObject, { pane: fill, style: (f) => sggStyle((f as Feat<SggP>).properties),
    onEachFeature: (f, lyr) => { sggByF.set((f as Feat<SggP>).properties.f, lyr as never); bind(lyr as Leaflet.Path, false); } }).addTo(map);

  // ---- 동 칸(시·군·구·동 단계) ----
  const drawDongs = async () => {
    const file = level() === 'sgg' || level() === 'dong' ? fileOf() : null;
    if (file === dongFile) { dongLayer?.setStyle((f) => dongStyle((f as Feat<DongP>).properties)); return; }
    dongLayer?.remove(); dongLayer = null; dongByK.clear(); dongFile = file;
    if (!file) return;
    const fc = await loadEmd(file);
    if (!fc || dongFile !== file) return;
    dongLayer = L.geoJSON(fc as unknown as GeoJSON.GeoJsonObject, { pane: fill, style: (f) => dongStyle((f as Feat<DongP>).properties),
      onEachFeature: (f, lyr) => { dongByK.set((f as Feat<DongP>).properties.k, lyr as never); bind(lyr as Leaflet.Path, true); } }).addTo(map);
  };

  // ---- 범례 ----
  const legend = pane.querySelector<HTMLElement>('.mv-legend');
  const drawLegend = () => {
    if (!legend) return;
    legend.hidden = false;
    const title = legend.querySelector('.mv-legend-t')!, bar = legend.querySelector('.mv-legend-bar')!, lo = legend.querySelector('.mv-legend-lo')!, hi = legend.querySelector('.mv-legend-hi')!;
    const note = legend.querySelector<HTMLElement>('.mv-legend-note')!;
    if (budget && level() === 'home') {
      title.textContent = '예산 안 동네 수';
      bar.innerHTML = ROOM_COLORS.map((c) => `<span style="background:${c}"></span>`).join('');
      lo.textContent = '적음'; hi.textContent = '많음';
      note.textContent = '회색: 예산 안 동네 없음';
      return;
    }
    const b = sgg.breaks[metric()] ?? [];
    const k = mode().k;
    title.textContent = `${kindLabel()} 중위`;
    bar.innerHTML = COLORS.map((c) => `<span style="background:${c}"></span>`).join('');
    lo.textContent = b.length ? `${fmt(b[0], k)} 미만` : '';
    hi.textContent = b.length ? `${fmt(b[b.length - 1], k)} 이상` : '';
    note.textContent = '회색: 거래 적음(30건 미만)';
  };

  // ---- 화면 맞추기 ----
  const fit = (animate: boolean) => {
    let b: Leaflet.LatLngBounds | null = null;
    if (level() === 'dong') {
      const d = dongByK.get(focus.dong!);
      if (d) { map.fitBounds((d as unknown as Leaflet.Polygon).getBounds(), { padding: [64, 64], maxZoom: 14, animate }); return; }
    }
    if (level() === 'sgg' || level() === 'dong') { const s = sggByF.get(fileOf()!); if (s) b = (s as unknown as Leaflet.Polygon).getBounds(); }
    else {
      // 수도권·시도 첫 화면: 먼 섬(옹진군: 백령·연평 등)은 범위 계산에서 뺀다. 넣으면 서해로 치우쳐 서울·경기가 오른쪽에 작게 보인다(2026-11-27 사용자)
      for (const [f, lyr] of sggByF) {
        if (FAR.has(f) || (level() === 'sido' && sidoOf(f) !== focus.sido)) continue;
        const bb = (lyr as unknown as Leaflet.Polygon).getBounds(); b = b ? b.extend(bb) : L.latLngBounds(bb.getSouthWest(), bb.getNorthEast());
      }
    }
    if (!b) b = sggLayer.getBounds();
    // 왼쪽 위 범례·오른쪽 아래 확대 버튼에 가리지 않게 여백
    const pad = { paddingTopLeft: L.point(24, 56), paddingBottomRight: L.point(48, 16) };
    // 수도권 첫 화면: 확대 단계는 범례·버튼 여백을 빼고 정하되, 가운데는 수도권 범위의 한가운데(여백 때문에 한쪽으로 밀리지 않게, 2026-11-27 사용자)
    if (level() === 'home') { map.setView(b.getCenter(), map.getBoundsZoom(b, false, pad.paddingTopLeft.add(pad.paddingBottomRight)), { animate }); return; }
    map.fitBounds(b, level() === 'sido' ? { ...pad, animate } : { padding: [24, 24], animate });
  };

  const drawSel = () => {
    if (selLine) lines.removeLayer(selLine);
    selLine = null;
    const d = focus.dong ? dongByK.get(focus.dong) : null;
    if (d) selLine = outline(d.feature.geometry, true).addTo(lines);
  };

  // ---- 건물 알약(동 단계에서 항상, 2026-11-27 사용자 '건물별 거래 활용이 어려워' → 제미나이 13:45 합의) ----
  // - 흰 알약 'N건'(최근 3년 계약 건수). 3건 미만 건물은 원래대로 안 찍는다(목록 기준과 같음).
  // - 화면에서 44px 안에 겹치는 건물은 'N곳' 한 알약으로 묶는다. 누르면 그 범위로 확대, 최대로 확대해도 같은 자리면 시트에 그 건물들 목록.
  // - 건물이 많은 동은 화면에 보이는 알약을 거래 많은 순 20개(묶음 포함)까지만. 확대하면 더 보인다.
  type B = import('../rent-bld.ts').Bld;
  const bldGroup = L.layerGroup().addTo(map);
  const bldMarkers = new Map<string, Leaflet.Marker>();
  let bldList: B[] = [];
  let activeBld: string | null = null;
  const BLD_CAP = 20, BLD_R = 44;
  const layoutBld = () => {
    bldGroup.clearLayers(); bldMarkers.clear();
    if (!bldList.length || level() !== 'dong') return;
    const view = map.getBounds().pad(0.05);
    const groups: { pt: Leaflet.Point; items: B[] }[] = [];
    for (const b of bldList) { // 이미 요즘 거래 많은 순
      if (!view.contains([b.lat!, b.lng!])) continue;
      const pt = map.latLngToContainerPoint([b.lat!, b.lng!]);
      const g = groups.find((x) => x.pt.distanceTo(pt) < BLD_R);
      if (g) g.items.push(b); else groups.push({ pt, items: [b] });
    }
    const shown = groups.slice(0, BLD_CAP);
    const ag = activeBld ? groups.find((g) => g.items.some((b) => b.id === activeBld)) : null;
    if (ag && !shown.includes(ag)) shown.push(ag);
    shown.forEach((g, i) => {
      const one = g.items.length === 1, b = g.items[0];
      const on = g.items.some((x) => x.id === activeBld);
      const label = one ? `${b.n}건` : `${g.items.length}곳`;
      const name = one ? `${b.name || '이름 없는 건물'}, 최근 3년 전월세 ${b.n}건` : `건물 ${g.items.length}곳 묶음`;
      const ll = one ? L.latLng(b.lat!, b.lng!) : L.latLngBounds(g.items.map((x) => [x.lat!, x.lng!] as [number, number])).getCenter();
      const m = L.marker(ll, { keyboard: true, title: name, zIndexOffset: on ? 3000 : 1000 - i,
        icon: L.divIcon({ className: 'mv-bpin-wrap', iconSize: [0, 0], html: `<span class="mv-bpin${one ? '' : ' is-grp'}${on ? ' is-on' : ''}">${esc(label)}</span>` }) });
      m.on('add', () => { const el = m.getElement(); el?.setAttribute('role', 'button'); el?.setAttribute('aria-label', name); });
      m.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        if (one) { document.dispatchEvent(new CustomEvent('rent:bld-open', { detail: b.id })); return; }
        const bb = L.latLngBounds(g.items.map((x) => [x.lat!, x.lng!] as [number, number]));
        const same = bb.getNorthEast().distanceTo(bb.getSouthWest()) < 3;
        if (same || map.getZoom() >= map.getMaxZoom()) { document.dispatchEvent(new CustomEvent('rent:bld-group', { detail: g.items.map((x) => x.id) })); return; }
        map.fitBounds(bb, { padding: [72, 72], maxZoom: map.getMaxZoom(), animate: !reduced() });
      });
      if (LG.matches && one) m.bindTooltip(b.name || b.jibun, { direction: 'top', offset: [0, -18], className: 'rm-tip' });
      m.addTo(bldGroup);
      for (const x of g.items) bldMarkers.set(x.id, m);
    });
  };
  map.on('moveend zoomend', () => { if (bldList.length) layoutBld(); });
  const drawBld = async () => {
    bldList = [];
    if (level() !== 'dong' || !bsrc) { layoutBld(); return; }
    const { loadBld } = await import('../rent-bld.ts');
    const f = await loadBld(bsrc, fileOf()!);
    if (!f || level() !== 'dong') return;
    bldList = f.list.filter((b) => b.dong === focus.dong && b.lat !== null && b.lng !== null);
    layoutBld();
  };
  const ac = new AbortController();
  const sig = { signal: ac.signal };
  document.addEventListener('rent:bld-focus', (e) => {
    const d = (e as CustomEvent<{ id: string; lat: number | null; lng: number | null } | null>).detail;
    activeBld = d?.id ?? null;
    if (d?.lat != null && d.lng != null) map.setView([d.lat, d.lng], Math.max(map.getZoom(), 17), { animate: !reduced() });
    layoutBld();
  }, sig);
  document.addEventListener('rent:bld-hover', (e) => {
    const id = (e as CustomEvent<string>).detail;
    bldMarkers.get(id)?.openTooltip();
  }, sig);

  // ---- 다시 그리기 ----
  const restyle = () => { sggLayer.setStyle((f) => sggStyle((f as Feat<SggP>).properties)); dongLayer?.setStyle((f) => dongStyle((f as Feat<DongP>).properties)); drawLabels(); drawLegend(); };
  const apply = async (animate: boolean) => {
    if (budget && level() === 'home' && !counts) await loadCounts();
    sggLayer.setStyle((f) => sggStyle((f as Feat<SggP>).properties));
    await drawDongs();
    drawSel(); drawLabels(); drawLegend(); fit(animate);
    void drawBld();
  };
  document.addEventListener('rent:mode', restyle, sig);
  document.addEventListener('rent:budget', (e) => {
    budget = (e as CustomEvent<Budget | null>).detail;
    void loadCounts().then(() => { restyle(); if (budget) announce('지도를 예산 안 동네 수로 칠했어요.'); });
  }, sig);
  map.on('click', () => { /* 빈 곳: 아무것도 안 함 */ });
  let meMarker: Leaflet.Marker | null = null;
  let touched = false;
  map.on('dragstart', () => { touched = true; });
  for (const ev of ['wheel', 'touchstart', 'keydown']) map.getContainer().addEventListener(ev, () => { touched = true; }, { passive: true, ...sig });
  map.zoomControl?.getContainer()?.addEventListener('click', () => { touched = true; }, sig);
  await apply(false);

  return {
    focus(f) { focus = f; touched = false; showGhost(null); void apply(true); },
    hover(key) {
      if (!key) { showGhost(null); return; }
      const d = dongByK.get(key) ?? (focus.sido ? sggByF.get(`${focus.sido}__${key}`) : undefined) ?? sggByF.get(key);
      showGhost(d ? d.feature.geometry : null);
    },
    me(pt) {
      meMarker?.remove();
      meMarker = L.marker([pt.lat, pt.lng], { icon: meIcon(L), interactive: false, keyboard: false, zIndexOffset: 2000 }).addTo(map);
    },
    // 모바일은 지도 화면이 열리면서 크기가 바뀐다: 아직 손대지 않았으면 새 크기로 다시 맞춘다(첫 화면이 확대돼 잘려 보이던 문제)
    resize() { map.invalidateSize(); if (!touched) fit(false); },
    reveal() {
      // 고른 건물 > 고른 동 순으로, 지금 보이는 칸(가장자리 12% 안쪽) 밖이면 그쪽으로 옮긴다
      const m = activeBld ? bldMarkers.get(activeBld) : null; // 묶음이어도 그 알약 자리
      const d = focus.dong ? dongByK.get(focus.dong) : null;
      const at = m ? m.getLatLng() : d ? (d as unknown as Leaflet.Polygon).getBounds().getCenter() : null;
      if (at && !map.getBounds().pad(-0.12).contains(at)) map.panTo(at, { animate: !reduced() });
    },
    destroy() { ac.abort(); map.remove(); },
  };
}
