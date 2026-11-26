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
import type { MapApi } from './map-panel.ts';
import { createBuildings, BUILD_ZOOM } from './rent-buildings.ts';

type M = (number | null)[]; // [빌라 전세, 빌라 월세, 빌라 월세 보증금, 오피 전세, 오피 월세, 오피 월세 보증금]
type SggP = { f: string; nm: string; sd: string; l: [number, number]; n: number; h: string | null; m: M; b?: number };
type DongP = { k: string; c: string; l: [number, number]; n: number; h: string | null; m: M; b?: number };
type FC<P> = { type: 'FeatureCollection'; features: { type: 'Feature'; properties: P; geometry: GeoJSON.Geometry }[] };
type SggFC = FC<SggP> & { period: string; low: number; breaks: Record<string, number[]> };
type Focus = { sido?: string; slug?: string; dong?: string };

const DONG_ZOOM = 12;      // 이 줌부터 동 단위
const LOW_LABEL_ZOOM = 14; // '거래 적음' 라벨은 이만큼 가까이서만
// 파랑 6단계(밝음→진함). 라벨은 흰 바탕 알약이라 칸 색과 상관없이 글자 대비 4.5:1 이상
const COLORS = ['#DBE7FE', '#B4CEFC', '#84AEF8', '#5A8DF1', '#3069E0', '#1C4BB5'];
const GREY = '#E5E8EB';
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
  const toggles = pane.querySelector<HTMLElement>('.rm-toggles');
  const legend = pane.querySelector<HTMLElement>('.rm-legend');
  const card = pane.querySelector<HTMLElement>('.rm-card')!;
  const side = document.getElementById('rent-pick');
  let type: Type = 'v', kind: Kind = 'j';
  const read = () => {
    type = (pane.querySelector<HTMLInputElement>('input[name="rm-type"]:checked')?.value as Type) ?? 'v';
    kind = (pane.querySelector<HTMLInputElement>('input[name="rm-kind"]:checked')?.value as Kind) ?? 'j';
  };
  read();
  if (toggles) toggles.hidden = false;
  if (legend) legend.hidden = false;
  if (side) side.hidden = false;

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
  const HOVER = { color: '#191F28', weight: 2.5 };

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
    style: (f) => ({ color: '#FFFFFF', weight: 1.5, fillColor: colorOf(valueOf((f!.properties as SggP))), fillOpacity: 0.62 }),
    onEachFeature: (f, layer) => {
      const p = f.properties as SggP;
      layer.on('click', (e) => { L.DomEvent.stopPropagation(e); pickSgg(p, layer as Leaflet.Polygon); });
      layer.bindTooltip(() => tipEl(`${p.sd} ${p.nm}`, p), TIP);
      layer.on('mouseover', () => { if (map.getZoom() < DONG_ZOOM) (layer as Leaflet.Path).setStyle(HOVER); });
      layer.on('mouseout', () => restyle());
    },
  }).addTo(map);
  const sggByFile = new Map<string, { p: SggP; layer: Leaflet.Polygon }>();
  sggLayer.eachLayer((l) => { const p = (l as Leaflet.Polygon).feature!.properties as SggP; sggByFile.set(p.f, { p, layer: l as Leaflet.Polygon }); });

  const dongGroup = L.featureGroup();
  const loaded = new Map<string, Leaflet.GeoJSON>();
  const loading = new Map<string, Promise<void>>();
  const dongs = new Map<string, { p: DongP; layer: Leaflet.Polygon; sg: SggP }[]>(); // 키: 파일__동이름 (화성 '능동'처럼 같은 이름 조각이 여럿일 수 있음)
  const dongStyle = (p: DongP) => ({ color: '#FFFFFF', weight: 1, fillColor: colorOf(valueOf(p)), fillOpacity: 0.62 });
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
          l.on('mouseover', () => { if (key !== selected) (l as Leaflet.Path).setStyle(HOVER); });
          l.on('mouseout', () => { if (key !== selected) (l as Leaflet.Path).setStyle(dongStyle(p)); });
        },
      });
      loaded.set(f, layer);
      dongGroup.addLayer(layer);
    }).catch(() => { loading.delete(f); }));
    return loading.get(f)!;
  };

  let blds: ReturnType<typeof createBuildings> | null = null;

  // ---- 라벨(키보드로 고를 수 있는 버튼) ----
  const labels = L.layerGroup().addTo(map);
  type Lab = { id: string; at: [number, number]; name: string; value: string | null; n: number; pick: () => void; active: boolean; layer: Leaflet.Polygon };
  const labelIcon = (b: Lab) => L.divIcon({
    className: 'rm-label-wrap', iconSize: undefined,
    html: `<span class="rm-label${b.value ? '' : ' is-low'}${b.active ? ' is-active' : ''}"><span class="rm-label-name">${esc(b.name)}</span><span class="rm-label-val">${esc(b.value ?? '거래 적음')}</span></span>`,
  });
  const drawLabels = () => {
    labels.clearLayers();
    const z = map.getZoom();
    const view = map.getBounds().pad(0.1);
    const list: Lab[] = [];
    if (z < DONG_ZOOM) {
      for (const { p } of sggByFile.values()) {
        const v = valueOf(p);
        list.push({ id: p.f, at: p.l, name: p.nm, value: v === null ? null : valueText(v, kind), n: p.n, pick: () => pickSgg(p, sggByFile.get(p.f)!.layer), active: false, layer: sggByFile.get(p.f)!.layer });
      }
    } else {
      for (const [key, parts] of dongs) {
        const { p, sg } = parts[0];
        if (!view.contains(p.l)) continue;
        const v = valueOf(p);
        if (v === null && z < LOW_LABEL_ZOOM) continue;
        if (blds?.pinsShown && z >= BUILD_ZOOM && key !== selected) continue; // 건물 핀과 겹치지 않게
        // 리 단위(읍·면)는 '봉담읍 와우리' → 라벨은 '와우리'
        list.push({ id: key, at: p.l, name: p.k.split(' ').pop()!, value: v === null ? null : valueText(v, kind), n: p.n + (v === null ? 0 : 1e6), pick: () => pickDong(key), active: key === selected, layer: parts[0].layer });
        void sg;
      }
    }
    list.sort((a, b) => Number(b.active) - Number(a.active) || b.n - a.n);
    // 지도 위 떠 있는 상자(전환 버튼·범례·확대 버튼·요약 카드)와 지도 바깥으로 걸치는 라벨은 숨긴다
    const frame = canvas.getBoundingClientRect();
    const placed: DOMRect[] = [...pane.querySelectorAll<HTMLElement>('.rm-toggles fieldset, .rm-select, .rm-legend, .rm-card, .leaflet-control-zoom')].filter((x) => !x.closest('[hidden]') && x.offsetParent !== null).map((x) => x.getBoundingClientRect());
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
      const hit = out || placed.some((q) => r.left < q.right + 4 && r.right + 4 > q.left && r.top < q.bottom + 3 && r.bottom + 3 > q.top);
      if (hit) labels.removeLayer(m); else placed.push(r);
    }
  };

  // ---- 화면 갱신(줌 단계·동 파일 불러오기) ----
  let selected: string | null = null;
  let selectedSgg: string | null = null;
  const restyle = () => {
    const z = map.getZoom();
    const near = z >= DONG_ZOOM;
    sggLayer.setStyle((f) => {
      const p = f!.properties as SggP;
      return near
        ? { color: '#191F28', weight: 1.5, opacity: 0.55, fillOpacity: 0, fillColor: GREY }
        : { color: p.f === selectedSgg ? '#191F28' : '#FFFFFF', weight: p.f === selectedSgg ? 3 : 1.5, opacity: 1, fillColor: colorOf(valueOf(p)), fillOpacity: 0.62 };
    });
    for (const [key, parts] of dongs) for (const { p, layer } of parts) {
      layer.setStyle(key === selected ? { ...dongStyle(p), color: '#191F28', weight: 3 } : dongStyle(p));
      if (key === selected) layer.bringToFront();
    }
  };
  let timer = 0;
  const refresh = () => {
    const near = map.getZoom() >= DONG_ZOOM;
    if (near && !map.hasLayer(dongGroup)) { dongGroup.addTo(map); sggLayer.bringToFront(); }
    if (!near && map.hasLayer(dongGroup)) map.removeLayer(dongGroup);
    if (near) {
      const view = map.getBounds();
      const need = [...sggByFile.values()].filter(({ layer }) => layer.getBounds().intersects(view)).map(({ p }) => p.f);
      Promise.all(need.map(loadFile)).then(() => { restyle(); drawLabels(); });
    }
    restyle(); drawLabels();
    blds?.refresh().then(() => drawLabels());
    // 시·군·구 경계선은 동 위에서 클릭을 막지 않게
    sggLayer.eachLayer((l) => { const el = (l as Leaflet.Path).getElement() as HTMLElement | undefined; if (el) el.style.pointerEvents = near ? 'none' : ''; });
  };
  map.on('moveend', () => { clearTimeout(timer); timer = window.setTimeout(refresh, 180); });

  // ---- 요약 ----
  const box = () => (side && side.offsetParent !== null ? side : card);
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
    show({ badge: p.sd, name: p.nm, n: p.n, m: p.m, href: p.h, linkText: `${p.nm} 시세 자세히 보기` });
    loadFile(p.f).then(() => syncSelect(p.f, null));
    map.fitBounds(layer.getBounds(), { padding: [24, 24], maxZoom: 13 });
  }
  function pickDong(key: string) {
    const parts = dongs.get(key);
    if (!parts) return;
    const { p, sg } = parts[0];
    selected = key; selectedSgg = null;
    syncSelect(sg.f, p.k);
    show({ badge: `${sg.sd} ${sg.nm}`, name: p.k, n: p.n, m: p.m, href: p.h ?? sg.h, linkText: p.h ? `${p.k.split(' ').pop()} 시세 자세히 보기` : `${sg.nm} 전체 보기` });
    if (blds && p.b) void blds.listDong(box(), sg.f, p.k).then(() => requestAnimationFrame(() => blds?.hideCovered()));
    restyle(); drawLabels();
  }

  // ---- 건물별 실거래 이력(2026-11-26). 자료가 있을 때만(data-bsrc) ----
  const bsrc = canvas.dataset.bsrc;
  blds = bsrc ? createBuildings({
    L, map, src: bsrc, card,
    filesInView: () => { const v = map.getBounds(); return [...sggByFile.values()].filter(({ p, layer }) => p.b && layer.getBounds().intersects(v)).map(({ p }) => p.f); },
    place: (f) => { const p = sggByFile.get(f)?.p; return p ? `${p.sd} ${p.nm}` : ''; },
    box,
    pickDong: (f, dong) => loadFile(f).then(() => pickDong(`${f}__${dong}`)),
  }) : null;

  // ---- 지역 선택(시·도 → 시·군·구 → 동). 지도를 옮기고 요약을 띄운다. 지도에서 고르면 선택 상자도 따라 바뀐다 ----
  const selBox = pane.querySelector<HTMLElement>('.rm-select');
  const selSido = selBox?.querySelector<HTMLSelectElement>('[name="rm-sido"]');
  const selSgg = selBox?.querySelector<HTMLSelectElement>('[name="rm-sgg"]');
  const selDong = selBox?.querySelector<HTMLSelectElement>('[name="rm-dong"]');
  const opt = (value: string, text: string) => { const o = document.createElement('option'); o.value = value; o.textContent = text; return o; };
  const ko = (a: string, b: string) => a.localeCompare(b, 'ko');
  const sidoOf = (f: string) => f.split('__')[0];
  const fillSgg = (sido: string) => {
    if (!selSgg) return;
    const list = [...sggByFile.values()].filter(({ p }) => sidoOf(p.f) === sido).map(({ p }) => p).sort((a, b) => ko(a.nm, b.nm));
    selSgg.replaceChildren(opt('', '시·군·구'), ...list.map((p) => opt(p.f, p.nm)));
  };
  const fillDong = (f: string) => {
    if (!selDong) return;
    const list = [...dongs.keys()].filter((k) => k.startsWith(`${f}__`)).map((k) => k.slice(f.length + 2)).sort(ko);
    selDong.replaceChildren(opt('', '동네'), ...list.map((k) => opt(k, k)));
    selDong.disabled = !list.length;
  };
  const syncSelect = (f: string | null, dong: string | null) => {
    if (!selSido || !selSgg || !selDong) return;
    if (f) {
      if (selSido.value !== sidoOf(f)) { selSido.value = sidoOf(f); fillSgg(selSido.value); }
      if (selSgg.value !== f) { selSgg.value = f; fillDong(f); }
      selDong.value = dong ?? '';
    }
  };
  if (selBox && selSido && selSgg && selDong) {
    const sidos = [...new Map([...sggByFile.values()].map(({ p }) => [sidoOf(p.f), p.sd])).entries()];
    selSido.replaceChildren(...sidos.map(([k, v]) => opt(k, v)));
    selSido.value = focus.sido ?? 'seoul';
    fillSgg(selSido.value);
    selDong.disabled = true;
    selBox.hidden = false;
    selSido.addEventListener('change', () => {
      fillSgg(selSido.value); selDong.replaceChildren(opt('', '동네')); selDong.disabled = true;
      const b = L.latLngBounds([]);
      for (const { p, layer } of sggByFile.values()) if (sidoOf(p.f) === selSido.value) b.extend(layer.getBounds());
      if (b.isValid()) map.fitBounds(b, { padding: [16, 16] });
    });
    selSgg.addEventListener('change', async () => {
      const it = sggByFile.get(selSgg.value);
      if (!it) return;
      await loadFile(it.p.f);
      fillDong(it.p.f);
      pickSgg(it.p, it.layer);
    });
    selDong.addEventListener('change', () => {
      const key = `${selSgg.value}__${selDong.value}`;
      const parts = dongs.get(key);
      if (!parts) return;
      const b = L.latLngBounds([]); parts.forEach(({ layer }) => b.extend(layer.getBounds()));
      map.fitBounds(b, { padding: [60, 60], maxZoom: 14.5 });
      if (map.getZoom() < DONG_ZOOM) map.setZoom(DONG_ZOOM);
      pickDong(key);
    });
  }

  // ---- 유형·전월세 전환 ----
  pane.querySelectorAll<HTMLInputElement>('input[name="rm-type"], input[name="rm-kind"]').forEach((r) => r.addEventListener('change', () => {
    read(); drawLegend(); restyle(); drawLabels();
    announce(`${type === 'v' ? '빌라' : '오피스텔'} ${kind === 'j' ? '전세' : '월세'} 중위값으로 칠했어요.`);
  }));

  // ---- 첫 화면 ----
  drawLegend();
  const sgFocus = focus.slug && focus.sido ? sggByFile.get(`${focus.sido}__${focus.slug}`) : undefined;
  if (sgFocus && focus.dong) {
    await loadFile(sgFocus.p.f);
    const key = `${sgFocus.p.f}__${focus.dong}`;
    const parts = dongs.get(key);
    if (parts) {
      const b = L.latLngBounds([]); parts.forEach(({ layer }) => b.extend(layer.getBounds()));
      map.fitBounds(b, { padding: [60, 60], maxZoom: 14.5 });
      if (map.getZoom() < DONG_ZOOM) map.setZoom(DONG_ZOOM);
      selected = key;
    } else map.fitBounds(sgFocus.layer.getBounds(), { padding: [24, 24] });
  } else if (sgFocus) {
    map.fitBounds(sgFocus.layer.getBounds(), { padding: [24, 24] });
    if (map.getZoom() < DONG_ZOOM) map.setZoom(DONG_ZOOM);
  } else {
    // 홈·전월세 첫 화면: 서울이 꽉 차게(시·군·구 단위). 시·도 페이지는 그 시·도 전체
    const b = L.latLngBounds([]);
    for (const { p, layer } of sggByFile.values()) if (p.f.startsWith(`${focus.sido ?? 'seoul'}__`)) b.extend(layer.getBounds());
    map.fitBounds(b.isValid() ? b : L.latLngBounds([[37.43, 126.76], [37.7, 127.18]]), { padding: [16, 16] });
  }
  if (sgFocus) { await loadFile(sgFocus.p.f); syncSelect(sgFocus.p.f, focus.dong && dongs.has(`${sgFocus.p.f}__${focus.dong}`) ? focus.dong : null); }
  refresh();

  return { focus() {}, hover() {}, filter() {}, resize() { map.invalidateSize(); } };
}
