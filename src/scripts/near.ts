// '내 주변'(2026-11-26 사용자 '들어갈 때부터 내 주변이었으면, 어차피 브라우저가 허용할 거냐고 묻잖아').
// 개인정보·위치정보 원칙
// - 위치는 브라우저 위치 권한(사용자 동의 창)으로만 받는다. 좌표는 이 탭의 메모리에서만 쓰고
//   서버 전송·주소(URL)·localStorage·분석 도구 어디에도 남기지 않는다. 거리·동 찾기는 모두 기기 안에서 계산한다.
// - 받는 자료는 우리 정적 JSON뿐(경계·통계·주차장 목록 전체를 받아 기기에서 고름 → 어떤 동을 받았는지로 위치가 드러나지 않게 시·군·구 파일 단위).
// - 지도를 내 위치로 옮기면 배경지도 조각을 브라우저가 브이월드에서 받는다(개인정보처리방침에 적음).
// 표시는 사실 숫자만(중위값·거리). 위험·안전·추천 표현 없음.
import { rentMode } from './v2-rent-mode.ts';

type Pt = { lat: number; lng: number };
type M = (number | null)[];
type Geom = { type: 'Polygon'; coordinates: number[][][] } | { type: 'MultiPolygon'; coordinates: number[][][][] };
type SggF = { properties: { f: string; nm: string; sd: string; n: number; h: string | null; m: M }; geometry: Geom };
type DongF = { properties: { k: string; n: number; h: string | null; m: M }; geometry: Geom };
export type Lot = { lat: number; lng: number; name: string; href: string; tag: string; fee: string; tone: string; d: number };
const FEE: Record<string, string> = { free: '무료', paid: '유료', mixed: '무료·유료 혼합', unknown: '요금 확인 필요' };
export type Near = { pt: Pt; sido: string; slug: string; sggName: string; sd: string; dong: string | null; n: number; m: M; href: string | null; low: number; lots: Lot[] };

const inRing = (x: number, y: number, r: number[][]) => {
  let c = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};
const inPoly = (p: Pt, g: Geom) => {
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  return polys.some((rings) => inRing(p.lng, p.lat, rings[0]) && !rings.slice(1).some((h) => inRing(p.lng, p.lat, h)));
};
/** 두 점 사이 거리(m) */
export const dist = (a: Pt, b: Pt) => {
  const R = 6371000, toR = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
export const distText = (m: number) => (m < 1000 ? `${Math.round(m / 10) * 10}m` : `${(m / 1000).toFixed(1)}km`);

/** 위치를 못 받은 이유(안내 문구를 이유별로 다르게): 거부 · 위치 서비스 꺼짐/신호 없음 · 시간 초과 · 지원 안 함 */
export type GeoErr = 'denied' | 'off' | 'timeout' | 'unsupported';
export let lastGeoErr: GeoErr | null = null;
/** 브라우저 위치 권한 → 좌표(실패·거부면 null, 이유는 lastGeoErr). 정확도는 동네 수준이면 충분해서 저전력 모드 */
export function locate(): Promise<Pt | null> {
  lastGeoErr = null;
  if (!('geolocation' in navigator) || !isSecureContext) { lastGeoErr = 'unsupported'; return Promise.resolve(null); }
  return new Promise((res) => navigator.geolocation.getCurrentPosition(
    (p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }),
    (e) => { lastGeoErr = e.code === 1 ? 'denied' : e.code === 3 ? 'timeout' : 'off'; res(null); },
    { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 },
  ));
}

/** 기기·브라우저별로 위치를 켜는 단계(UA로 대략 구분, 틀려도 '그 밖' 안내가 같이 보임) */
export function geoHelp(err: GeoErr): { title: string; steps: string[]; note?: string } {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const android = /Android/.test(ua);
  const samsung = /SamsungBrowser/.test(ua);
  const edge = /Edg\//.test(ua);
  const iosChrome = ios && /CriOS/.test(ua);
  const mac = /Macintosh/.test(ua) && !ios;
  if (err === 'timeout') return { title: '위치를 찾는 데 시간이 너무 걸렸어요', steps: ['와이파이를 켜면 위치를 더 빨리 찾아요.', '실내 깊은 곳이면 창가로 옮겨 다시 시도해 보세요.'] };
  if (err === 'unsupported') return { title: '이 브라우저에서는 위치를 쓸 수 없어요', steps: ['크롬·사파리·삼성 인터넷 같은 기본 브라우저로 열어 보세요.', '앱 안에서 연 화면(카카오톡 등)이면 오른쪽 위 메뉴에서 \'다른 브라우저로 열기\'를 눌러 주세요.'] };
  if (err === 'off') {
    if (ios) return { title: '휴대폰 위치 서비스가 꺼져 있어요', steps: ['설정 앱 → 개인정보 보호 및 보안 → 위치 서비스를 켜 주세요.', `같은 화면 아래 ${iosChrome ? 'Chrome' : 'Safari 웹 사이트'} → '앱을 사용하는 동안'을 골라 주세요.`, '돌아와서 \'다시 시도\'를 눌러 주세요.'] };
    if (android) return { title: '휴대폰 위치가 꺼져 있어요', steps: ['화면 맨 위에서 아래로 쓸어내려 \'위치\'를 켜 주세요.', '돌아와서 \'다시 시도\'를 눌러 주세요.'] };
    return { title: '컴퓨터 위치 서비스가 꺼져 있어요', steps: mac ? ['시스템 설정 → 개인정보 보호 및 보안 → 위치 서비스를 켜고, 쓰는 브라우저도 켜 주세요.', '돌아와서 \'다시 시도\'를 눌러 주세요.'] : ['Windows 설정 → 개인 정보 및 보안 → 위치에서 \'위치 서비스\'를 켜 주세요.', '돌아와서 \'다시 시도\'를 눌러 주세요.'], note: '데스크톱은 와이파이로 위치를 잡아서 동네가 조금 다르게 나올 수 있어요.' };
  }
  // denied
  if (iosChrome) return { title: '위치 권한이 꺼져 있어요', steps: ['설정 앱 → Chrome → 위치 → \'앱을 사용하는 동안\'을 골라 주세요.', '크롬으로 돌아와 \'다시 시도\'를 누르고, 묻는 창에서 \'허용\'을 눌러 주세요.'] };
  if (ios) return { title: '위치 권한이 꺼져 있어요', steps: ['주소창 왼쪽 \'가가\'(또는 ᴀA) 버튼 → 웹 사이트 설정 → 위치 → \'허용\'을 골라 주세요.', '그래도 안 되면 설정 앱 → 개인정보 보호 및 보안 → 위치 서비스 → Safari 웹 사이트 → \'앱을 사용하는 동안\'.', '돌아와서 \'다시 시도\'를 눌러 주세요.'] };
  if (samsung) return { title: '위치 권한이 꺼져 있어요', steps: ['아래 메뉴(≡) → 설정 → 사이트 및 다운로드 → 사이트 권한 → 위치에서 이 사이트를 허용해 주세요.', '돌아와서 \'다시 시도\'를 눌러 주세요.'] };
  if (android) return { title: '위치 권한이 꺼져 있어요', steps: ['주소창 왼쪽 아이콘(자물쇠나 조절 모양) → 권한 → 위치 → \'허용\'을 골라 주세요.', '휴대폰 설정 → 애플리케이션 → Chrome → 권한 → 위치도 \'앱 사용 중에만 허용\'인지 확인해 주세요.', '돌아와서 \'다시 시도\'를 눌러 주세요.'] };
  if (edge) return { title: '위치 권한이 꺼져 있어요', steps: ['주소창 왼쪽 자물쇠 → 이 사이트에 대한 권한 → 위치 → \'허용\'.', '페이지를 새로 고친 뒤 \'다시 시도\'를 눌러 주세요.'] };
  return { title: '위치 권한이 꺼져 있어요', steps: ['주소창 왼쪽 아이콘(자물쇠나 조절 모양) → 사이트 설정(권한) → 위치 → \'허용\'.', '페이지를 새로 고친 뒤 \'다시 시도\'를 눌러 주세요.'] };
}
/** 이미 거부한 브라우저면 자동으로 묻지 않는다(묻는 창이 안 뜨고 실패만 함) */
export async function permission(): Promise<'granted' | 'denied' | 'prompt' | 'unknown'> {
  try { return (await navigator.permissions.query({ name: 'geolocation' as PermissionName })).state; } catch { return 'unknown'; }
}

let sggP: Promise<{ features: SggF[]; low: number } | null> | null = null;
let lotsP: Promise<[number, number, string, string, string, string][]> | null = null;
export async function findNear(pt: Pt): Promise<Near | null> {
  sggP ??= fetch('/geo/rent/sgg.json').then((r) => (r.ok ? r.json() : null)).catch(() => null);
  lotsP ??= fetch('/geo/parking.json').then((r) => (r.ok ? r.json() : [])).catch(() => []);
  const sgg = await sggP;
  const s = sgg?.features.find((f) => inPoly(pt, f.geometry));
  if (!sgg || !s) return null; // 수도권 밖
  const [sido, slug] = s.properties.f.split('__');
  const emd = await fetch(`/geo/rent/${encodeURIComponent(s.properties.f)}.json`).then((r) => (r.ok ? r.json() as Promise<{ features: DongF[] }> : null)).catch(() => null);
  const d = emd?.features.find((f) => inPoly(pt, f.geometry));
  const lots = (await lotsP).map(([lat, lng, name, href, tag, tone]) => ({ lat, lng, name, href, tag, tone, fee: FEE[tone] ?? '', d: dist(pt, { lat, lng }) }))
    .filter((l) => l.d <= 3000).sort((a, b) => a.d - b.d).slice(0, 8);
  const p = d?.properties ?? s.properties;
  return { pt, sido, slug, sggName: s.properties.nm, sd: s.properties.sd, dong: d?.properties.k ?? null, n: p.n, m: p.m, href: p.h ?? s.properties.h, low: sgg.low, lots };
}

const short = (v: number) => { const e = Math.floor(v / 10000), r = v % 10000; return `${e ? `${e}억` : ''}${e && r ? ' ' : ''}${r || !e ? `${r.toLocaleString('ko-KR')}만` : ''}`; };
const el = (tag: string, cls = '', text?: string) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

/** 결과 그리기(홈 카드·깊은 화면 패널 공통). 글자는 textContent만 */
export type NearTool = 'home' | 'rent' | 'parking';
/** tool: 전월세 화면은 전월세만, 주차장 화면은 주차장만, 홈은 둘 다(2026-11-26 사용자 '주차장에서 내 주변 보기에 전월세가 왜 떠') */
export function renderNear(box: HTMLElement, r: Near, tool: NearTool = 'home') {
  const m = rentMode();
  const o = m.t === 'v' ? 0 : 3;
  const kind = m.t === 'v' ? '빌라' : '오피스텔';
  const ok = r.n >= r.low;
  const place = `${r.sd} ${r.sggName}${r.dong ? ` ${r.dong}` : ''}`;
  const head = el('p', 'near-place'); head.append(el('span', 'k', '내 주변'), el('b', '', place));
  const ans = el('div', 'v-ans-row');
  const cell = (k: string, v: string) => { const d = el('div'); d.append(el('p', 'k', k), el('p', 'v', v)); return d; };
  if (ok && (r.m[o] !== null || r.m[o + 1] !== null)) {
    ans.append(cell(`${kind} 전세 중위`, r.m[o] !== null ? short(r.m[o]!) : '-'), cell(`${kind} 월세 중위`, r.m[o + 1] !== null && r.m[o + 2] !== null ? `${short(r.m[o + 2]!)}/${r.m[o + 1]}만` : '-'));
  }
  const note = el('p', 'note', ok ? `최근 12개월 실거래 ${r.n.toLocaleString('ko-KR')}건 기준` : `최근 12개월 거래가 ${r.n}건이라 숫자를 비교하지 않아요.`);
  const card = el('div', 'v-ans near-card');
  card.append(head);
  if (ans.childElementCount) card.append(ans);
  card.append(note);
  if (r.href) { const a = el('a', 'v-btn sec mt-3 w-full', `${r.dong ?? r.sggName} 전월세 자세히`) as HTMLAnchorElement; a.href = r.href; card.append(a); }
  const parts: HTMLElement[] = tool === 'parking' ? [] : [card];
  if (tool === 'parking') {
    const h = el('p', 'near-place'); h.append(el('span', 'k', '내 주변'), el('b', '', place));
    parts.push(h);
    if (!r.lots.length) parts.push(el('p', 'text-body text-ink-2', '3km 안에 공영주차장이 없어요.'));
  }
  if (r.lots.length && tool !== 'rent') {
    if (tool !== 'parking') parts.push(el('h2', 'v-cap', '가까운 공영주차장'));
    const list = el('div', 'v-list');
    for (const l of r.lots.slice(0, tool === 'parking' ? 8 : 5)) {
      const row = el('div', 'v-row');
      const t = el('div', 't');
      const a = el('a', 'n', l.name) as HTMLAnchorElement; a.href = l.href;
      t.append(a, el('span', 's', l.tag && l.tag !== l.fee && l.tag !== '유료' && l.tag !== '무료' ? `${l.fee} · 기본 ${l.tag}` : l.fee));
      const v = el('div', 'val', distText(l.d)); v.append(el('small', '', '직선거리'));
      row.append(t, v);
      list.append(row);
    }
    parts.push(list);
  }
  box.replaceChildren(...parts);
  box.hidden = false;
}

/** 지도에도 알린다(지도는 그 동으로 옮기고 내 위치 점을 찍음. 좌표는 지도 메모리에만) */
export const tellMap = (r: Near) => document.dispatchEvent(new CustomEvent('map:near', { detail: { focus: { sido: r.sido, slug: r.slug, dong: r.dong ?? undefined }, pt: r.pt, lots: r.lots } }));
