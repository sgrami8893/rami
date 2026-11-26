// 지도 화면 안에서 페이지 이동(2026-11-26 사용자 '상세 보고 지도로 돌아오기 어렵다', '도구 누르면 바로 지도 전환').
// 지도(#map-pane)가 있는 페이지끼리는 전체를 다시 불러오지 않고 바꾼다.
// - 같은 전월세 지도끼리: 본문(#main)만 바꾸고 지도는 그대로(확대·위치·선택 유지). 'dnkk:swap'으로 지도 초점만 옮긴다.
// - 그 밖(전월세↔주차장, 주차장 지역끼리): 본문과 지도 칸을 함께 바꾸고 지도를 새로 그린다. 도구 전환(data-keep-view)이면 지금 지도 위치를 그대로 쓴다.
//   배경지도 조각은 브라우저가 이미 받아 둔 것을 다시 쓴다(저장·프록시 없음).
// - 주소는 history.pushState로 실제 정적 페이지 주소가 되므로 새로고침·공유·검색엔진은 정적 페이지를 그대로 본다.
// - 새 본문에 처음 보는 스크립트(<script type=module src>)가 있으면 한 번 불러오고, 이미 불러온 스크립트는 onPage()로 등록된 초기화를 다시 돌린다.
// - 받아 온 HTML은 같은 출처의 우리 정적 페이지뿐이다. 인라인 스크립트는 실행하지 않는다.
import { announce } from './copy.ts';

export type SwapDetail = { focus: Record<string, string | undefined> | null; url: string; remount: boolean };
const cache = new Map<string, string>();
const keyOf = (u: URL) => u.pathname + u.search;
let current = '';
let depth = 0; // 이 탭에서 바꿔 이동한 횟수(되돌아가기 버튼 표시용)
let started = false;
const loadedSrc = new Set<string>();
/** 도구 전환 때 넘겨줄 지도 위치(map-panel·rent-map이 새 지도를 그릴 때 한 번 쓴다) */
let keepView: { lat: number; lng: number; zoom: number } | null = null;
export const takeView = () => { const v = keepView; keepView = null; return v; };
export const setView = (v: { lat: number; lng: number; zoom: number } | null) => { keepView = v; };

const kindOf = (doc: Document) => (doc.querySelector('#map-pane .map-canvas') as HTMLElement | null)?.dataset.kind || (doc.querySelector('#map-pane') ? 'pins' : '');
const PATHS = /^\/($|rent\/|parking\/)/; // 발급기(동결)는 옛 스크립트라 보통 이동

async function load(url: URL): Promise<Document | null> {
  const k = keyOf(url);
  let html = cache.get(k);
  if (!html) {
    const r = await fetch(url.href, { headers: { Accept: 'text/html' } });
    if (!r.ok || !(r.headers.get('content-type') ?? '').includes('text/html')) return null;
    html = await r.text();
    cache.set(k, html);
  }
  return new DOMParser().parseFromString(html, 'text/html');
}


/** 새 페이지의 모듈 스크립트(본문 밖 것 포함: 페이지 끝 <script>, 지도 칸 등): 처음 보는 것만 새 요소로 만들어 실행.
 *  인라인 모듈(작은 스크립트는 Astro가 인라인으로 넣음)도 내용이 처음일 때만 한 번 실행한다(2026-11-26 '안 눌리는 버튼' 수정) */
const seenInline = new Set<string>();
function runScripts(root: ParentNode) {
  root.querySelectorAll<HTMLScriptElement>('script[type="module"]').forEach((s) => {
    const n = document.createElement('script'); n.type = 'module';
    const srcAttr = s.getAttribute('src');
    if (srcAttr) {
      const src = new URL(srcAttr, location.href).href;
      if (loadedSrc.has(src)) return;
      loadedSrc.add(src); n.src = src;
    } else {
      const t = s.textContent ?? '';
      if (!t || seenInline.has(t)) return;
      seenInline.add(t); n.textContent = t;
    }
    document.body.append(n);
  });
}

function swap(doc: Document, url: URL, push: boolean) {
  const main = document.getElementById('main');
  const next = doc.getElementById('main');
  if (!main || !next) return false;
  const remount = kindOf(doc) !== 'rent' || kindOf(document) !== 'rent';
  main.replaceChildren(...[...next.childNodes].map((n) => document.importNode(n, true)));
  if (remount) {
    const pane = document.getElementById('map-pane'), np = doc.getElementById('map-pane');
    if (pane && np) { document.dispatchEvent(new CustomEvent('dnkk:unmount')); pane.replaceWith(document.importNode(np, true)); }
  }
  // 머리말 도구 메뉴의 '지금 도구' 표시와 문서 정보
  // 홈('/')은 어느 도구도 아님(전월세로 떨어지면 안 됨: 2026-11-26 맥락 이탈 점검)
  const tool = url.pathname.split('/')[1] ?? '';
  document.querySelectorAll<HTMLAnchorElement>('.v-tools a').forEach((a) => {
    const on = !!tool && new URL(a.href).pathname.split('/')[1] === tool;
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  document.documentElement.dataset.tool = doc.documentElement.dataset.tool ?? '';
  // 검색 시트는 본문 밖이라 새 화면의 도구로 맞춰 준다(주차장 화면 검색이 전월세 우선으로 남지 않게)
  const sheet = document.getElementById('v-sheet'), nsheet = doc.getElementById('v-sheet');
  if (sheet) sheet.dataset.tool = nsheet?.dataset.tool ?? '';
  document.title = doc.title;
  for (const sel of ['meta[name="description"]', 'link[rel="canonical"]', 'meta[name="robots"]']) {
    const a = document.head.querySelector(sel), b = doc.head.querySelector(sel);
    if (a && b) a.replaceWith(document.importNode(b, true)); else if (a) a.remove(); else if (b) document.head.append(document.importNode(b, true));
  }
  if (push) history.pushState({ soft: 1, depth }, '', url.href);
  current = keyOf(url);
  main.scrollTop = 0;
  if (!matchMedia('(min-width: 1024px)').matches) scrollTo({ top: 0 });
  main.focus({ preventScroll: true });
  announce(`${doc.querySelector('h1')?.textContent?.trim() ?? doc.title} 화면이에요.`);
  const w = window as unknown as { adsbygoogle?: unknown[] };
  if (w.adsbygoogle) main.querySelectorAll('ins.adsbygoogle:not([data-adsbygoogle-status])').forEach(() => w.adsbygoogle!.push({}));
  const canvas = doc.querySelector('#map-pane .map-canvas') as HTMLElement | null;
  const focus = canvas?.dataset.focus ? JSON.parse(canvas.dataset.focus) : null;
  document.dispatchEvent(new CustomEvent<SwapDetail>('dnkk:swap', { detail: { focus, url: url.href, remount } }));
  runScripts(doc);
  return true;
}

/** 지도 화면 안 이동. 지도 없는 페이지로 가면 보통 이동 */
export async function navigate(url: URL, push = true) {
  if (!started) { location.href = url.href; return; }
  document.documentElement.classList.add('soft-loading');
  try {
    const doc = await load(url);
    if (doc && kindOf(doc) && swap(doc, url, push)) return;
    location.href = url.href;
  } catch { location.href = url.href; }
  finally { document.documentElement.classList.remove('soft-loading'); }
}

export function initSoftNav() {
  if (started || !document.getElementById('map-pane') || !('pushState' in history)) return;
  started = true;
  document.querySelectorAll<HTMLScriptElement>('script[type="module"]').forEach((s) => { const a = s.getAttribute('src'); if (a) loadedSrc.add(new URL(a, location.href).href); else if (s.textContent) seenInline.add(s.textContent); });
  current = keyOf(new URL(location.href));
  history.replaceState({ ...(history.state ?? {}), soft: 1, depth: 0 }, '');

  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as Element).closest?.('a[href]') as HTMLAnchorElement | null;
    if (!a || a.target || a.hasAttribute('download') || a.closest('header, footer')) return;
    const url = new URL(a.href, location.href);
    if (url.origin !== location.origin || (url.hash && keyOf(url) === current)) return;
    if (!PATHS.test(url.pathname)) return;
    e.preventDefault();
    if (keyOf(url) === current) return;
    depth++;
    // 지도 위 도구 전환은 지금 보던 지도 위치를 그대로 이어 간다
    if (a.hasAttribute('data-keep-view')) document.dispatchEvent(new CustomEvent('dnkk:keep-view'));
    void navigate(url);
  });
  addEventListener('popstate', (e) => {
    const url = new URL(location.href);
    if (keyOf(url) === current) return; // 지도 전체 화면 닫기 등 주소가 같은 뒤로 가기
    if (!cache.has(keyOf(url)) && (!e.state || !e.state.soft)) { location.reload(); return; }
    depth = Number(e.state?.depth) || 0;
    void navigate(url, false);
  });
}

/** 페이지가 history.replaceState로 주소(쿼리)를 바꾼 뒤 알려 준다(같은 주소 링크 판정이 어긋나지 않게) */
export const noteUrl = () => { if (started) current = keyOf(new URL(location.href)); };

/** 본문이 바뀔 때마다 다시 돌려야 하는 초기화(탭·더 보기·계산기 등). 자기 요소가 없으면 아무것도 하지 않게 짠다 */
export function onPage(fn: () => void) {
  fn();
  document.addEventListener('dnkk:swap', fn);
}
