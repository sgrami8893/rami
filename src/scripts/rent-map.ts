// 전월세 단계구분도(2026-11-26 사용자·제미나이 합의 설계).
// - 넓게 보면(줌 12 미만) 시·군·구, 가까이 보면 법정동(읍·면은 리)을 중위값 색으로 칠하고 '망원동 2.1억' 숫자 라벨을 함께 단다(색만으로 정보를 주지 않음).
// - 동 경계는 시·군·구별 정적 JSON을 지도를 옮길 때(moveend, 디바운스) 화면에 걸친 곳만 받는다.
// - 거래가 LOW건 미만이거나 고른 유형의 값이 없으면 회색 '거래 적음'.
// - 동을 누르면 테두리를 강조하고, PC는 왼쪽 패널(#rent-pick), 모바일은 지도 위 카드에 요약과 동 페이지 링크를 보여 준다.
// - 라벨은 키보드로도 고를 수 있는 버튼(마커)이고, 서로 겹치면 거래가 적은 쪽을 숨긴다.
// - 건물별 실거래(rent-buildings.ts): 동 요약 아래 건물 목록, 줌 15+ 건물 핀, 누르면 이력(그래프·표). 층·계약일 없음.
// 표시 원칙: 사실 숫자만(중위값·건수). 위험·안전 판정 없음. 보안: 데이터는 빌드 JSON, 화면에는 textContent·esc()만 쓴다.
import type * as Leaflet from 'leaflet';
import { baseMap } from './map-base.ts';
import { announce } from './copy.ts';
import { picker } from './map-picker.ts';
import type { MapApi } from './map-panel.ts';
import { createBuildings, BUILD_ZOOM } from './rent-buildings.ts';
import { createFrame, getGeo, AREA_SRC } from './map-frame.ts';

type M = (number | null)[]; // [빌라 전세, 빌라 월세, 빌라 월세 보증금, 오피 전세, 오피 월세, 오피 월세 보증금]
type SggP = { f: string; nm: string; sd: string; l: [number, number]; n: number; h: string | null; m: M; b?: number };
type DongP = { k: string; c: string; l: [number, number]; n: number; h: string | null; m: M; b?: number };
type FC<P> = { type: 'FeatureCollection'; features: { type: 'Feature'; properties: P; geometry: GeoJSON.Geometry }[] };
type SggFC = FC<SggP> & { period: string; low: number; breaks: Record<string, number[]> };
type Focus = { sido?: string; slug?: string; dong?: string };

const DONG_ZOOM = 12;      // 이 줌부터 동 단위
const SIDO_ZOOM = 10;      // 이 줌부터 화면 가운데의 시·도만(시·군·구 단계)
const LOW_LABEL_ZOOM = 14; // '거래 적음' 라벨은 이만큼 가까이서만
// 파랑 6단계(밝음→진함). 라벨은 흰 바탕 알약이라 칸 색과 상관없이 글자 대비 4.5:1 이상
// 2026-11-26 사용자 '1도 모르겠음' → 단계 사이 밝기 차이를 크게(한 색상 파랑 100→700 중 6단계, 밝은→진한). 색각이상에서도 밝기 차이로 구분된다
// 2026-11-26 사용자 '파랑 계열 별로' → 따뜻한 한 방향 색(크림→호박→산호→자두, YlOrRd·magma 계열). 파랑·초록 배경지도와 겹치지 않고,
// 밝기가 단계마다 크게 달라 색각이상에서도 순서가 보인다
const COLORS = ['#FDF0C4', '#FBCB7A', '#F59A4E', '#E4634A', '#B23A5B', '#6B1F57'];
const GREY = '#D5D9DE';
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** 만원 → 라벨용 짧은 금액(2.1억, 9,500만) */
const short = (v: number) => (v >= 10000 ? `${(Math.round(v / 1000) / 10).toString()}억` : `${v.toLocaleString('ko-KR')}만`);
/** 만원 → 요약용 금액(2억 1,000만 원) */
const won = (v: number | null) => {
  if (v === null) return '-';
  const e = Math.floor(v / 10000), r = v % 10000;
  return `${e ? `${e}억` : ''}${e && r ? ' ' : ''}${r ? `${r.toLocaleString('ko-KR')}만` : ''} 원`;
};

type Type = 'v' | 'o'; type Kind = 'j' | 'w';
const idx = (t: Type, k: Kind) => (t === 'v' ? 0 : 3) + (k === 'j' ? 0 : 1);
const valueText = (v: number, k: Kind) => (k === 'j' ? short(v) : `월 ${v}만`);

export async function mountRent(pane: HTMLElement, canvas: HTMLElement): Promise<MapApi> {
  const src = canvas.dataset.src || '/geo/rent/';
  const focus = JSON.parse(canvas.dataset.focus || '{}') as Focus;
  const [{ L, map }, sgg] = await Promise.all([
    baseMap(canvas),
    fetch(`${src}sgg.json`).then((r) => r.json() as Promise<SggFC | null>),
  ]);
  if (!sgg) throw new Error('rent geo missing');
  const legend = pane.querySelector<HTMLElement>('.rm-legend');
  const card = pane.querySelector<HTMLElement>('.rm-card')!;
  // 왼쪽 패널 요약 칸은 본문이 바뀌면(soft-nav) 새 요소가 되므로 매번 찾는다
  const sideEl = () => document.getElementById('rent-pick');
  const side = sideEl();
  let type: Type = 'v', kind: Kind = 'j';
  const read = () => {
    type = (pane.querySelector<HTMLInputElement>('input[name="rm-type"]:checked')?.value as Type) ?? 'v';
    kind = (pane.querySelector<HTMLInputElement>('input[name="rm-kind"]:checked')?.value as Kind) ?? 'j';
  };
  read();
  if (legend) legend.hidden = false;
  if (side) side.hidden = false;

  // ---- 보는 범위(사용자 요청 2026-11-26): 시·도를 고르면 그 시·도만, 시·군·구를 고르면 그 시·군·구의 동만 보이고
  // 다른 지역의 색·라벨은 줌과 상관없이 숨긴다. 선택 상자·'위로' 버튼으로 한 단계씩 올라간다 ----
  let scopeSido: string | null = null;
  let scopeSgg: string | null = null;
  let levelBtns: HTMLButtonElement[] = [];
  const sidoOf = (f: string) => f.split('__')[0];
  const fileOfKey = (key: string) => key.split('__').slice(0, 2).join('__');
  const inScope = (f: string) => (scopeSgg ? f === scopeSgg : scopeSido ? sidoOf(f) === scopeSido : true);
  const isNear = () => Boolean(scopeSgg) || map.getZoom() >= DONG_ZOOM;
  const metric = () => `${type}${kind === 'j' ? 'j' : 'w'}`;
  const valueOf = (p: { n: number; m: M }) => (p.n >= sgg.low ? p.m[idx(type, kind)] : null);
  const colorOf = (v: number | null) => {
    if (v === null) return GREY;
    const b = sgg.breaks[metric()] ?? [];
    let i = 0; while (i < b.length && v >= b[i]) i++;
    return COLORS[Math.min(i, COLORS.length - 1)];
  };

  // ---- 마우스를 올린 곳 이름·값(사용자 요청 2026-11-26): '서울 마포구 망원동' + 고른 유형의 중위값 ----
  const kindLabel = () => `${type === 'v' ? '빌라' : '오피스텔'} ${kind === 'j' ? '전세' : '월세'}`;
  const tipEl = (path: string, p: { n: number; m: M }) => {
    const d = document.createElement('div');
    const t = document.createElement('strong'); t.className = 'rm-tip-path'; t.textContent = path;
    const v = valueOf(p);
    const s = document.createElement('span'); s.className = 'rm-tip-val';
    s.textContent = v === null ? (p.n ? `거래 적음 · ${p.n}건` : '최근 12개월 거래 없음') : `${kindLabel()} 중위 ${kind === 'j' ? short(v) : `월 ${v}만`} · ${p.n.toLocaleString('ko-KR')}건`;
    d.append(t, s);
    return d;
  };
  const TIP = { sticky: true, direction: 'top' as const, offset: [0, -14] as [number, number], className: 'rm-tip', opacity: 1 };
  // 경계 스타일 v3(2026-11-26 사용자 '경계 색 세련되게'): 검은 선 없음. 동 경계 흰 1.25px(90%), 마우스 올리면 파랑 2px + 채움 살짝 진하게,
  // v4(2026-11-26 사용자 '경계선이 꼭 시커매야 하나', '포커스해도 경계선이 안 보여'): 고른 곳·마우스 올린 곳은 흰 3px + 어두운 부드러운 그림자(CSS .rm-glow)
  // 를 맨 앞으로. 어떤 칸 색 위에서도 보인다. 바깥 틀은 map-frame.ts의 중간 회청색
  const PICK = '#FFFFFF', SLATE = '#475569';
  const HOVER = { color: PICK, weight: 3, opacity: 1, fillOpacity: 0.75 };
  const lift = (l: Leaflet.Path) => { l.setStyle(HOVER); (l.getElement() as Element | undefined)?.classList.add('rm-glow'); l.bringToFront(); };
  // 경계 가독성(2026-11-26 사용자 '경계가 잘 안 보여'): 회색 배경지도 위에 진한 채움 + 흰 경계 2px, 시·군·구 경계는 진한 선
  // 2026-11-26 사용자 '너무 진해, 투명도 올려' → 배경지도가 비치게 0.6
  const FILL = 0.6;

  // ---- 범례 ----
  const drawLegend = () => {
    if (!legend) return;
    const b = sgg.breaks[metric()] ?? [];
    const title = legend.querySelector('.rm-legend-title');
    if (title) title.textContent = `${type === 'v' ? '빌라' : '오피스텔'} ${kind === 'j' ? '전세' : '월세(월)'} 중위값`;
    const bar = legend.querySelector<HTMLElement>('.rm-legend-bar')!;
    const ticks = legend.querySelector<HTMLElement>('.rm-legend-ticks')!;
    bar.replaceChildren(...COLORS.slice(0, b.length + 1).map((c) => { const s = document.createElement('span'); s.style.background = c; return s; }));
    ticks.replaceChildren(...b.map((v, i) => { const s = document.createElement('span'); s.textContent = kind === 'j' ? short(v) : `${v}만`; s.style.left = `${((i + 1) / (b.length + 1)) * 100}%`; return s; }));
    const sr = legend.querySelector('.rm-legend-sr');
    if (sr) sr.textContent = `색이 진할수록 높아요. 구간 경계: ${b.map((v) => (kind === 'j' ? short(v) : `${v}만`)).join(', ')}. 회색은 최근 12개월 거래 ${sgg.low}건 미만이에요.`;
  };

  // ---- 도형 ----
  const sggLayer = L.geoJSON(sgg as unknown as GeoJSON.FeatureCollection, {
    style: (f) => ({ color: '#FFFFFF', weight: 1.5, opacity: 0.75, lineJoin: 'round', lineCap: 'round', fillColor: colorOf(valueOf((f!.properties as SggP))), fillOpacity: FILL }),
    onEachFeature: (f, layer) => {
      const p = f.properties as SggP;
      layer.on('click', (e) => { L.DomEvent.stopPropagation(e); pickSgg(p, layer as Leaflet.Polygon); });
      layer.bindTooltip(() => tipEl(`${p.sd} ${p.nm}`, p), TIP);
      layer.on('mouseover', () => { if (!isNear() && inScope(p.f)) lift(layer as Leaflet.Path); });
      layer.on('mouseout', () => restyle());
    },
  }).addTo(map);
  const sggByFile = new Map<string, { p: SggP; layer: Leaflet.Polygon }>();
  sggLayer.eachLayer((l) => { const p = (l as Leaflet.Polygon).feature!.properties as SggP; sggByFile.set(p.f, { p, layer: l as Leaflet.Polygon }); });
  // ---- 지역 틀(2026-11-26 사용자 '한 단계 들어갈 때마다 바깥 테두리'): 시·군·구 단계는 그 시·도 외곽선, 동 단계는 그 시·군·구 외곽선.
  // 틀 바깥은 옅은 막으로 덮는다(map-frame.ts, 주차장·무인발급기 지도와 같은 모양) ----
  const frame = createFrame(L, map);
  let sidoFC: Awaited<ReturnType<typeof getGeo>> = null;
  const updateFrame = () => {
    const g = scopeSgg ? (sggByFile.get(scopeSgg)?.layer.feature?.geometry as GeoJSON.Polygon | undefined)
      : scopeSido ? sidoFC?.features.find((x) => x.properties.sido === scopeSido)?.geometry : undefined;
    frame.set(g ?? null);
  };
  void getGeo(`${AREA_SRC}sido.json`).then((x) => { sidoFC = x; updateFrame(); });

  const dongGroup = L.featureGroup();
  const loaded = new Map<string, Leaflet.GeoJSON>();
  const loading = new Map<string, Promise<void>>();
  const dongs = new Map<string, { p: DongP; layer: Leaflet.Polygon; sg: SggP }[]>(); // 키: 파일__동이름 (화성 '능동'처럼 같은 이름 조각이 여럿일 수 있음)
  const dongStyle = (p: DongP) => ({ color: '#FFFFFF', weight: 1.25, opacity: 0.7, lineJoin: 'round' as const, fillColor: colorOf(valueOf(p)), fillOpacity: FILL });
  const loadFile = (f: string) => {
    if (loaded.has(f)) return Promise.resolve();
    if (!loading.has(f)) loading.set(f, fetch(`${src}${f}.json`).then((r) => r.json() as Promise<FC<DongP> | null>).then((fc) => {
      if (!fc) return;
      const sg = sggByFile.get(f)!.p;
      const layer = L.geoJSON(fc as unknown as GeoJSON.FeatureCollection, {
        style: (ft) => dongStyle(ft!.properties as DongP),
        onEachFeature: (ft, l) => {
          const p = ft.properties as DongP;
          const key = `${f}__${p.k}`;
          dongs.set(key, [...(dongs.get(key) ?? []), { p, layer: l as Leaflet.Polygon, sg }]);
          l.on('click', (e) => { L.DomEvent.stopPropagation(e); pickDong(key); });
          l.bindTooltip(() => tipEl(`${sg.sd} ${sg.nm} ${p.k}`, p), TIP);
          l.on('mouseover', () => { if (key !== selected) lift(l as Leaflet.Path); });
          l.on('mouseout', () => { if (key !== selected) (l as Leaflet.Path).setStyle(dongStyle(p)); });
        },
      });
      loaded.set(f, layer);
      if (inScope(f)) dongGroup.addLayer(layer);
    }).catch(() => { loading.delete(f); }));
    return loading.get(f)!;
  };

  let blds: ReturnType<typeof createBuildings> | null = null;

  // ---- 라벨(키보드로 고를 수 있는 버튼) ----
  const labels = L.layerGroup().addTo(map);
  type Lab = { id: string; at: [number, number]; name: string; value: string | null; n: number; pick: () => void; active: boolean; layer: Leaflet.Polygon; color: string };
  const labelIcon = (b: Lab) => L.divIcon({
    className: 'rm-label-wrap', iconSize: undefined,
    // 라벨 v3(2026-11-26 사용자 '라벨 폰트·박스 이쁘고 가독성 좋게'): 칸 색 점 + 이름(흐린 600) + 값(진한 700, 조금 크게)
    html: `<span class="rm-label${b.value ? '' : ' is-low'}${b.active ? ' is-active' : ''}"><span class="rm-label-dot" style="background:${b.color}"></span><span class="rm-label-name">${esc(b.name)}</span><span class="rm-label-val">${esc(b.value ?? '거래 적음')}</span></span>`,
  });
  const drawLabels = () => {
    labels.clearLayers();
    const z = map.getZoom();
    const view = map.getBounds().pad(0.1);
    const list: Lab[] = [];
    if (!isNear()) {
      for (const { p } of sggByFile.values()) {
        if (!inScope(p.f)) continue;
        const v = valueOf(p);
        list.push({ id: p.f, at: p.l, name: p.nm, value: v === null ? null : valueText(v, kind), color: colorOf(v), n: p.n, pick: () => pickSgg(p, sggByFile.get(p.f)!.layer), active: false, layer: sggByFile.get(p.f)!.layer });
      }
    } else {
      for (const [key, parts] of dongs) {
        const { p, sg } = parts[0];
        if (!inScope(sg.f) || !view.contains(p.l)) continue;
        const v = valueOf(p);
        if (v === null && z < LOW_LABEL_ZOOM) continue;
        if (blds?.pinsShown && z >= BUILD_ZOOM && key !== selected) continue; // 건물 핀과 겹치지 않게
        // 리 단위(읍·면)는 '봉담읍 와우리' → 라벨은 '와우리'
        list.push({ id: key, at: p.l, name: p.k.split(' ').pop()!, value: v === null ? null : valueText(v, kind), color: colorOf(v), n: p.n + (v === null ? 0 : 1e6), pick: () => pickDong(key), active: key === selected, layer: parts[0].layer });
        void sg;
      }
    }
    list.sort((a, b) => Number(b.active) - Number(a.active) || b.n - a.n);
    // 지도 위 떠 있는 상자(전환 버튼·범례·확대 버튼·요약 카드)와 지도 바깥으로 걸치는 라벨은 숨긴다
    const frame = canvas.getBoundingClientRect();
    const placed: DOMRect[] = [...pane.querySelectorAll<HTMLElement>('.rm-toolbar > *, .rm-legend, .rm-card, .leaflet-control-zoom')].filter((x) => !x.closest('[hidden]') && x.offsetParent !== null).map((x) => x.getBoundingClientRect());
    for (const b of list) {
      if (!view.contains(b.at)) continue;
      const m = L.marker(b.at, { icon: labelIcon(b), keyboard: true, title: '', riseOnHover: true, zIndexOffset: b.active ? 1000 : 0 });
      m.on('click', (e) => { L.DomEvent.stopPropagation(e); b.pick(); });
      labels.addLayer(m);
      const el = m.getElement()!;
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label', `${b.name} ${b.value ?? '거래 적음'}, 요약 보기`);
      // 키보드로 라벨에 오면 마우스를 올린 것과 같은 이름·값 풍선을 띄운다
      el.addEventListener('focus', () => b.layer.openTooltip(b.at));
      el.addEventListener('blur', () => b.layer.closeTooltip());
      const r = (el.firstElementChild as HTMLElement).getBoundingClientRect(); // 보이는 알약(래퍼는 크기 0)
      const out = r.left < frame.left + 2 || r.right > frame.right - 2 || r.top < frame.top + 2 || r.bottom > frame.bottom - 2;
      // 라벨 사이 여백을 넉넉히(가로 10px·세로 8px) 둬서 낮은 줌에서는 라벨 수가 저절로 줄어든다
      const hit = out || placed.some((q) => r.left < q.right + 10 && r.right + 10 > q.left && r.top < q.bottom + 8 && r.bottom + 8 > q.top);
      if (hit) labels.removeLayer(m); else placed.push(r);
    }
  };

  // ---- 화면 갱신(줌 단계·동 파일 불러오기) ----
  let selected: string | null = null;
  let selectedSgg: string | null = null;
  const restyle = () => {
    const near = isNear();
    sggLayer.eachLayer((l) => { const f = (l as Leaflet.Polygon).feature!.properties as SggP; ((l as Leaflet.Path).getElement() as Element | undefined)?.classList.toggle('rm-glow', !near && f.f === selectedSgg); });
    sggLayer.setStyle((f) => {
      const p = f!.properties as SggP;
      if (!inScope(p.f)) return { stroke: false, fill: false };
      return near
        // 동 단계: 고른 시·군·구 테두리는 틀(map-frame)이 그리므로 여기서는 범위를 안 정했을 때만 옅은 선
        ? (scopeSgg ? { stroke: false, fill: false } : { stroke: true, fill: false, color: SLATE, weight: 1.25, opacity: 0.4, fillOpacity: 0, fillColor: GREY })
        : { stroke: true, fill: true, color: '#FFFFFF', weight: p.f === selectedSgg ? 3 : 1.5, opacity: p.f === selectedSgg ? 1 : 0.75, fillColor: colorOf(valueOf(p)), fillOpacity: FILL };
    });
    if (!near && selectedSgg) sggByFile.get(selectedSgg)?.layer.bringToFront();
    for (const [key, parts] of dongs) for (const { p, layer } of parts) {
      layer.setStyle(key === selected ? { ...dongStyle(p), color: PICK, weight: 3, opacity: 1 } : dongStyle(p));
      (layer.getElement() as Element | undefined)?.classList.toggle('rm-glow', key === selected);
      if (key === selected) layer.bringToFront();
    }
  };
  let timer = 0;
  const refresh = () => {
    const near = isNear();
    updateFrame(); syncLevel();
    // 범위 밖 시·군·구의 동은 그리지 않는다
    for (const [f, layer] of loaded) {
      if (inScope(f) && !dongGroup.hasLayer(layer)) dongGroup.addLayer(layer);
      if (!inScope(f) && dongGroup.hasLayer(layer)) dongGroup.removeLayer(layer);
    }
    if (near && !map.hasLayer(dongGroup)) { dongGroup.addTo(map); sggLayer.bringToFront(); }
    if (!near && map.hasLayer(dongGroup)) map.removeLayer(dongGroup);
    if (near) {
      const view = map.getBounds();
      const need = [...sggByFile.values()].filter(({ p, layer }) => inScope(p.f) && layer.getBounds().intersects(view)).map(({ p }) => p.f);
      Promise.all(need.map(loadFile)).then(() => {
        for (const [f, layer] of loaded) if (!inScope(f) && dongGroup.hasLayer(layer)) dongGroup.removeLayer(layer);
        restyle(); drawLabels();
      });
    }
    restyle(); drawLabels();
    blds?.refresh().then(() => drawLabels());
    // 시·군·구 경계선은 동 위에서 클릭을 막지 않게
    sggLayer.eachLayer((l) => { const el = (l as Leaflet.Path).getElement() as HTMLElement | undefined; if (el) el.style.pointerEvents = near || !inScope((l as Leaflet.Polygon).feature!.properties.f) ? 'none' : ''; });
  };
  map.on('moveend', () => { clearTimeout(timer); timer = window.setTimeout(() => { autoScope(); refresh(); }, 180); });

  // ---- 요약 ----
  const box = () => { const s = sideEl(); return s && s.offsetParent !== null ? s : card; };
  const fill = (el: HTMLElement, o: { badge: string; name: string; n: number; m: M; href: string | null; linkText: string }) => {
    const q = <T extends HTMLElement>(s: string) => el.querySelector<T>(s)!;
    q('.rp-badge').textContent = o.badge;
    q('.rp-name').textContent = o.name;
    q('.rp-meta').textContent = o.n ? `최근 12개월 실거래 ${o.n.toLocaleString('ko-KR')}건${o.n < sgg.low ? ' · 거래 적음' : ''}` : '최근 12개월 거래가 없어요';
    const rows: [string, number | null, number | null, number | null][] = [['빌라', o.m[0], o.m[2], o.m[1]], ['오피스텔', o.m[3], o.m[5], o.m[4]]];
    q('.rp-rows').replaceChildren(...rows.map(([t, j, d, w]) => {
      const tr = document.createElement('tr');
      const th = document.createElement('th'); th.scope = 'row'; th.textContent = t;
      const a = document.createElement('td'); a.textContent = won(j);
      const b = document.createElement('td'); b.textContent = w === null ? '-' : `${won(d)} / 월 ${w}만 원`;
      tr.append(th, a, b); return tr;
    }));
    const link = q<HTMLAnchorElement>('.rp-link');
    link.hidden = !o.href;
    if (o.href) { link.href = o.href; link.textContent = o.linkText; }
    el.hidden = false;
    blds?.reset(el);
    el.querySelector('.rp-empty')?.setAttribute('hidden', '');
    el.querySelector('.rp-body')?.removeAttribute('hidden');
  };
  const closeCard = () => {
    selected = null; selectedSgg = null;
    blds?.reset(box());
    card.hidden = true;
    restyle(); drawLabels();
  };
  card.querySelector('.rp-close')?.addEventListener('click', closeCard);
  card.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); closeCard(); } });
  map.on('click', () => { if (selected || selectedSgg) closeCard(); });

  const show = (o: Parameters<typeof fill>[1]) => {
    const el = box();
    if (el !== card) card.hidden = true;
    fill(el, o);
    if (el !== card) el.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    announce(`${o.name} 요약을 보여 줘요.`);
  };
  function pickSgg(p: SggP, layer: Leaflet.Polygon) {
    selected = null; selectedSgg = p.f;
    setScope(sidoOf(p.f), p.f, false);
    skipAuto = true;
    show({ badge: p.sd, name: p.nm, n: p.n, m: p.m, href: p.h, linkText: `${p.nm} 시세 자세히 보기` });
    map.fitBounds(layer.getBounds(), { padding: [24, 24], maxZoom: 13.5 });
  }
  function pickDong(key: string) {
    const parts = dongs.get(key);
    if (!parts) return;
    const { p, sg } = parts[0];
    selected = key; selectedSgg = null;
    if (scopeSgg !== sg.f) setScope(sidoOf(sg.f), sg.f, false);
    syncSelect(sg.f, p.k);
    show({ badge: `${sg.sd} ${sg.nm}`, name: p.k, n: p.n, m: p.m, href: p.h ?? sg.h, linkText: p.h ? `${p.k.split(' ').pop()} 시세 자세히 보기` : `${sg.nm} 전체 보기` });
    if (blds && p.b) void blds.listDong(box(), sg.f, p.k).then(() => requestAnimationFrame(() => blds?.hideCovered()));
    restyle(); drawLabels();
  }

  // ---- 건물별 실거래 이력(2026-11-26). 자료가 있을 때만(data-bsrc) ----
  const bsrc = canvas.dataset.bsrc;
  blds = bsrc ? createBuildings({
    L, map, src: bsrc, card,
    filesInView: () => { const v = map.getBounds(); return [...sggByFile.values()].filter(({ p, layer }) => p.b && inScope(p.f) && layer.getBounds().intersects(v)).map(({ p }) => p.f); },
    place: (f) => { const p = sggByFile.get(f)?.p; return p ? `${p.sd} ${p.nm}` : ''; },
    box,
    pickDong: (f, dong) => loadFile(f).then(() => pickDong(`${f}__${dong}`)),
  }) : null;

  // ---- 지역 선택: 이동 경로 칩(시·도 › 시·군·구 › 동) + 목록 팝업(map-picker.ts). 지도에서 고르면 칩도 따라 바뀐다 ----
  const ko = (a: string, b: string) => a.localeCompare(b, 'ko');
  // 옹진군은 섬이 서해 멀리까지 흩어져 있어 인천 전체에 맞추면 지도가 바다만 보인다 → 화면 맞추기에서만 뺀다(색칠·선택은 그대로)
  const FIT_SKIP = new Set(['incheon__ongjin-gun']);
  const boundsOf = (pred: (f: string) => boolean) => { const b = L.latLngBounds([]); for (const { p, layer } of sggByFile.values()) if (pred(p.f) && !FIT_SKIP.has(p.f)) b.extend(layer.getBounds()); return b; };
  const allBounds = () => boundsOf(() => true);
  const sidoBounds = (sido: string) => boundsOf((f) => sidoOf(f) === sido);
  const sidoName = (sido: string) => [...sggByFile.values()].find(({ p }) => sidoOf(p.f) === sido)?.p.sd ?? '';
  const metaOf = (p: { n: number; m: M }) => { const v = valueOf(p); return v === null ? '거래 적음' : valueText(v, kind); };
  const SIDO_ORDER = ['seoul', 'gyeonggi', 'incheon'];
  const pk = (k: string) => pane.querySelector<HTMLElement>(`.rm-pick-${k}`);
  let curDong: string | null = null;
  const pSido = pk('sido') && picker(pk('sido')!, {
    items: () => [{ value: '', label: '전체 지역' }, ...SIDO_ORDER.filter((x) => sidoName(x)).map((x) => ({ value: x, label: sidoName(x) }))],
    current: () => scopeSido ?? '',
    onPick: (v) => setScope(v || null, null),
  });
  const pSgg = pk('sgg') && picker(pk('sgg')!, {
    search: 'on',
    items: () => [{ value: '', label: `${sidoName(scopeSido ?? '')} 전체` }, ...[...sggByFile.values()].filter(({ p }) => sidoOf(p.f) === scopeSido).map(({ p }) => p).sort((a, b) => ko(a.nm, b.nm)).map((p) => ({ value: p.f, label: p.nm, meta: metaOf(p) }))],
    current: () => scopeSgg ?? '',
    onPick: async (v) => {
      const it = sggByFile.get(v);
      if (!it) { setScope(scopeSido, null); return; }
      await loadFile(it.p.f);
      pickSgg(it.p, it.layer);
    },
  });
  const pDong = pk('dong') && picker(pk('dong')!, {
    search: 'on',
    items: () => {
      const f = scopeSgg ?? '';
      const nm = sggByFile.get(f)?.p.nm ?? '';
      return [{ value: '', label: `${nm} 전체` }, ...[...dongs.entries()].filter(([k]) => fileOfKey(k) === f).map(([k, parts]) => ({ value: k.slice(f.length + 2), label: k.slice(f.length + 2), meta: metaOf(parts[0].p) })).sort((a, b) => ko(a.label, b.label))];
    },
    current: () => curDong ?? '',
    onPick: (v) => {
      if (!v) { if (scopeSgg) { const it = sggByFile.get(scopeSgg)!; pickSgg(it.p, it.layer); } return; }
      const key = `${scopeSgg}__${v}`;
      const parts = dongs.get(key);
      if (!parts) return;
      const b = L.latLngBounds([]); parts.forEach(({ layer }) => b.extend(layer.getBounds()));
      map.fitBounds(b, { padding: [60, 60], maxZoom: 14.5 });
      if (map.getZoom() < DONG_ZOOM) map.setZoom(DONG_ZOOM);
      pickDong(key);
    },
  });
  /** 칩 글자·보이기를 지금 범위에 맞춘다 */
  const syncSelect = (f: string | null, dong: string | null) => {
    curDong = dong;
    const sido = f ? sidoOf(f) : scopeSido;
    pSido?.set(sido ? sidoName(sido) : '전체 지역', !sido);
    pSgg?.show(Boolean(sido));
    pSgg?.set(f ? sggByFile.get(f)?.p.nm ?? '' : '시·군·구', !f);
    pDong?.show(Boolean(f));
    pDong?.set(dong ? dong.split(' ').pop()! : '동네', !dong);
  };
  function setScope(sido: string | null, f: string | null, fit = true) {
    scopeSido = sido; scopeSgg = f;
    if (selectedSgg && !inScope(selectedSgg)) selectedSgg = null;
    if (selected && !inScope(fileOfKey(selected))) { selected = null; card.hidden = true; }
    syncSelect(f, selected && f && fileOfKey(selected) === f ? selected.slice(f.length + 2) : null);
    if (f) loadFile(f).then(refresh);
    if (fit) {
      skipAuto = true;
      const b = f ? sggByFile.get(f)?.layer.getBounds() : sido ? sidoBounds(sido) : allBounds();
      if (b && b.isValid()) map.fitBounds(b, { padding: [24, 24], maxZoom: f ? 13.5 : 12 });
    }
    refresh();
    if (fit) announce(f ? `${sggByFile.get(f)?.p.nm ?? ''}만 보여 줘요.` : sido ? `${sidoName(sido)}만 보여 줘요.` : '전체 지역을 보여 줘요.');
  }
  // ---- 지도 위치에 따라 범위·칩 자동 갱신(2026-11-26 사용자 '위치에 따라 박스도 갱신, 구 단위 들어가면 다른 곳 안 보이게') ----
  // 동이 보이는 줌(12+)에서는 화면 가운데가 속한 시·군·구로 범위를 옮긴다(지도는 움직이지 않음). 그보다 멀리 보면 시·군·구 범위를 푼다.
  // 칩·목록으로 직접 고른 직후 한 번은 건너뛴다(오목한 시·군·구는 경계 상자 가운데가 이웃 구일 수 있어서).
  let skipAuto = false;
  const inRing = (pt: Leaflet.LatLng, ring: Leaflet.LatLng[]) => {
    let c = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i], b = ring[j];
      if ((a.lat > pt.lat) !== (b.lat > pt.lat) && pt.lng < ((b.lng - a.lng) * (pt.lat - a.lat)) / (b.lat - a.lat) + a.lng) c = !c;
    }
    return c;
  };
  const contains = (layer: Leaflet.Polygon, pt: Leaflet.LatLng) => {
    if (!layer.getBounds().contains(pt)) return false;
    let c = false;
    const walk = (x: unknown): void => { const arr = x as unknown[]; if (arr.length && arr[0] instanceof L.LatLng) { if (inRing(pt, arr as Leaflet.LatLng[])) c = !c; } else arr.forEach(walk); };
    walk(layer.getLatLngs());
    return c;
  };
  function syncLevel() {
    const cur = isNear() ? 'dong' : scopeSido ? 'sgg' : 'sido';
    for (const b of levelBtns) b.setAttribute('aria-pressed', String(b.dataset.level === cur));
  }
  function autoScope() {
    if (skipAuto) { skipAuto = false; return; }
    const z = map.getZoom();
    if (z >= DONG_ZOOM) {
      const ctr = map.getCenter();
      const hit = (scopeSgg && contains(sggByFile.get(scopeSgg)!.layer, ctr)) ? null : [...sggByFile.values()].find(({ layer }) => contains(layer, ctr));
      if (hit && hit.p.f !== scopeSgg) setScope(sidoOf(hit.p.f), hit.p.f, false);
      return;
    }
    if (scopeSgg && z < DONG_ZOOM - 0.5) setScope(scopeSido, null, false);
    // 시·군·구 단계(줌 10~12): 화면 가운데가 속한 시·도로 범위를 옮긴다. 더 멀리 보면 전체 지역
    if (z >= SIDO_ZOOM) {
      const ctr = map.getCenter();
      const inSido = scopeSido && [...sggByFile.values()].some(({ p, layer }) => sidoOf(p.f) === scopeSido && contains(layer, ctr));
      const hit = inSido ? null : [...sggByFile.values()].find(({ layer }) => contains(layer, ctr));
      if (hit && sidoOf(hit.p.f) !== scopeSido) setScope(sidoOf(hit.p.f), null, false);
    } else if (scopeSido && z < SIDO_ZOOM - 0.5) setScope(null, null, false);
  }
  const toolbar = pane.querySelector<HTMLElement>('.rm-toolbar');
  if (toolbar) toolbar.hidden = false;

  // ---- 단계 막대(2026-11-26 사용자 '축척바: 시도·시군구·읍면동 레벨'): 확대 버튼 아래 세로 3칸. 지금 단계를 표시하고, 누르면 그 단계로 이동 ----
  // 시도 = 전체 지역(범위 없음), 시군구 = 화면 가운데 시·도의 시·군·구들, 읍면동 = 화면 가운데 시·군·구의 동들
  const LEVELS = [['sido', '시도'], ['sgg', '시군구'], ['dong', '읍면동']] as const;
  const Level = L.Control.extend({ options: { position: 'topright' }, onAdd() {
    const box = L.DomUtil.create('div', 'rm-level leaflet-bar');
    box.setAttribute('role', 'group'); box.setAttribute('aria-label', '지도 단계');
    L.DomEvent.disableClickPropagation(box); L.DomEvent.disableScrollPropagation(box);
    levelBtns = LEVELS.map(([k, label]) => {
      const b = L.DomUtil.create('button', 'rm-level-btn', box) as HTMLButtonElement;
      b.type = 'button'; b.dataset.level = k; b.textContent = label;
      b.setAttribute('aria-label', `${label} 단계로 보기`);
      b.addEventListener('click', () => goLevel(k));
      return b;
    });
    return box;
  } });
  new Level().addTo(map);
  const centerSgg = () => { const c = map.getCenter(); return [...sggByFile.values()].find(({ layer }) => contains(layer, c)); };
  function goLevel(k: 'sido' | 'sgg' | 'dong') {
    const hit = centerSgg();
    if (k === 'sido') setScope(null, null);
    else if (k === 'sgg') setScope(scopeSido ?? (hit ? sidoOf(hit.p.f) : 'seoul'), null);
    else {
      const f = scopeSgg ?? hit?.p.f ?? [...sggByFile.keys()].find((x) => sidoOf(x) === (scopeSido ?? 'seoul'));
      if (f) setScope(sidoOf(f), f);
    }
  }
  syncLevel();
  syncSelect(null, null);

  // ---- 유형·전월세 전환 ----
  pane.querySelectorAll<HTMLInputElement>('input[name="rm-type"], input[name="rm-kind"]').forEach((r) => r.addEventListener('change', () => {
    read(); drawLegend(); restyle(); drawLabels();
    announce(`${type === 'v' ? '빌라' : '오피스텔'} ${kind === 'j' ? '전세' : '월세'} 중위값으로 칠했어요.`);
  }));

  // ---- 첫 화면 ----
  drawLegend();
  const sgFocus = focus.slug && focus.sido ? sggByFile.get(`${focus.sido}__${focus.slug}`) : undefined;
  if (sgFocus) await loadFile(sgFocus.p.f);
  const focusKey = sgFocus && focus.dong && dongs.has(`${sgFocus.p.f}__${focus.dong}`) ? `${sgFocus.p.f}__${focus.dong}` : null;
  if (focusKey) selected = focusKey;
  const firstFit = () => {
    if (focusKey) {
      const b = L.latLngBounds([]); dongs.get(focusKey)!.forEach(({ layer }) => b.extend(layer.getBounds()));
      map.fitBounds(b, { padding: [60, 60], maxZoom: 14.5 });
    } else if (sgFocus) map.fitBounds(sgFocus.layer.getBounds(), { padding: [24, 24] });
    else {
      // 홈·전월세 첫 화면: 서울이 꽉 차게(시·군·구 단위). 시·도 페이지는 그 시·도 전체
      const b = sidoBounds(focus.sido ?? 'seoul');
      map.fitBounds(b.isValid() ? b : L.latLngBounds([[37.43, 126.76], [37.7, 127.18]]), { padding: [16, 16] });
    }
  };
  firstFit();
  // 지도 칸 크기가 아직 0이었으면(레이아웃이 늦게 잡힌 경우) 크기가 생길 때 한 번 더 맞춘다 — '서울'인데 북한 해안이 보이던 문제
  if (canvas.clientWidth < 50 || canvas.clientHeight < 50) {
    const ro = new ResizeObserver(() => { if (canvas.clientWidth >= 50 && canvas.clientHeight >= 50) { ro.disconnect(); map.invalidateSize(); firstFit(); } });
    ro.observe(canvas);
  }
  // 시·군·구·동 페이지는 그 시·군·구만, 시·도 페이지는 그 시·도만 보이게 시작(홈·전월세 첫 화면은 전체)
  if (sgFocus) setScope(sidoOf(sgFocus.p.f), sgFocus.p.f, false);
  else if (focus.sido) setScope(focus.sido, null, false);
  refresh();

  // 지도 화면 안 이동(soft-nav): 새 본문의 지도 초점으로 범위·선택만 바꾸고, 지도는 그대로 둔다
  document.addEventListener('dnkk:swap', (e) => {
    const f = (e as CustomEvent<{ focus: Focus | null }>).detail.focus ?? {};
    const s = sideEl(); if (s) s.hidden = false;
    card.hidden = true;
    if (f.sido && f.slug) {
      const file = `${f.sido}__${f.slug}`;
      void loadFile(file).then(() => {
        const key = f.dong ? `${file}__${f.dong}` : null;
        selected = key && dongs.has(key) ? key : null; selectedSgg = null;
        setScope(f.sido!, file, !selected);
        if (selected) {
          const b = L.latLngBounds([]); dongs.get(selected)!.forEach(({ layer }) => b.extend(layer.getBounds()));
          if (!map.getBounds().contains(b)) map.fitBounds(b, { padding: [60, 60], maxZoom: 14.5 });
          syncSelect(file, f.dong!);
        }
        restyle(); drawLabels();
      });
    } else if (f.sido) { selected = null; setScope(f.sido, null); }
  });

  return { focus() {}, hover() {}, filter() {}, resize() { map.invalidateSize(); } };
}
