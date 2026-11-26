// 주차장 목록 공통: '무료만'·'지금 운영 중' 필터, 운영 상태 표시(1분마다), 2시간 요금 정렬.
// 운영 상태는 공개된 운영시간으로 계산한 값이고 실제 개방 여부는 아니다(화면에 안내).
import { isOpenAt, kstNow, type Hours } from '../../scripts/lib/hours.ts';
import holidaysJson from '../data/holidays.json';
import { onPage } from './soft-nav.ts';

const holidays = new Set<string>(Object.entries(holidaysJson).filter(([k]) => /^\d{4}$/.test(k)).flatMap(([, v]) => v as string[]));

// 지도 화면 안 이동(soft-nav)으로 다른 주차장 목록이 들어와도 다시 묶이게 onPage로 등록한다(한 번만).
// 이전 목록에 건 문서 단위 이벤트·1분 타이머는 새 목록을 묶을 때 정리한다.
let registered = false;
let cleanup: (() => void) | null = null;
export function initParkingList() {
  if (registered) return;
  registered = true;
  onPage(bind);
}
function bind() {
  const list = document.getElementById('lot-list');
  if (!list || list.dataset.bound) return;
  list.dataset.bound = '1';
  cleanup?.();
  const ac = new AbortController();
  let timer = 0;
  cleanup = () => { ac.abort(); clearInterval(timer); };
  const rows = () => [...list.querySelectorAll<HTMLElement>('.lot')];
  const chips = [...document.querySelectorAll<HTMLButtonElement>('[data-filter]')];
  const sorts = [...document.querySelectorAll<HTMLButtonElement>('[data-sort]')];
  const count = document.getElementById('lot-count');
  const status = document.getElementById('list-status');
  const empty = document.getElementById('lot-empty');
  // 2026-11-26 재배치: 긴 목록은 처음 PAGE곳만 보이고 '더 보기'로 이어 본다(필터·정렬을 바꾸면 다시 PAGE곳부터).
  // 숨긴 행도 HTML에는 그대로 있다(검색엔진·JS 꺼짐에서는 전부 보임).
  const PAGE = 20;
  let limit = PAGE;
  const more = document.getElementById('lot-more') as HTMLButtonElement | null;

  // 머물 시간(2026-11-27 제미나이 합의): 30분·1시간·2시간·3시간·종일(운영시간 길이, 24시간·정보 없음이면 24시간 → '나올 때까지'는 10시간으로 본다)
  const STAY_MIN = [30, 60, 120, 180, 600];
  const STAY_LABEL = ['30분', '1시간', '2시간', '3시간', '종일'];
  let si = 2;
  const stays = [...document.querySelectorAll<HTMLButtonElement>('[data-stay]')];
  const paintOpen = () => {
    const now = kstNow();
    const t0 = Date.now();
    for (const r of rows()) {
      let h: Hours = {};
      try { h = JSON.parse(r.dataset.hours || '{}'); } catch { /* 형식 오류면 판정 불가 */ }
      const open = isOpenAt(h, now, holidays);
      r.dataset.open = open === true ? '1' : open === false ? '0' : '';
      // 나올 때까지 운영: 지금부터 머물 시간 끝까지 30분 간격으로 모두 운영시간 안
      let stay = open === true;
      for (let m = 30; stay && m <= STAY_MIN[si]; m += 30) stay = isOpenAt(h, kstNow(new Date(t0 + m * 60000)), holidays) === true;
      r.dataset.stay = stay ? '1' : '';
      const b = r.querySelector<HTMLElement>('.p-open');
      if (b) {
        b.textContent = open === true ? '운영시간 내' : open === false ? '운영시간 외' : '운영시간 확인 필요';
        b.className = `p-open badge ${open === true ? 'bg-ok-bg text-ok' : 'bg-off-bg text-off'}`;
      }
    }
  };

  const apply = (announce = false) => {
    const on = new Set(chips.filter((c) => c.getAttribute('aria-pressed') === 'true').map((c) => c.dataset.filter));
    let n = 0;
    for (const r of rows()) {
      const show = (!on.has('free') || r.dataset.free === '1') && (!on.has('open') || r.dataset.open === '1') && (!on.has('24h') || r.dataset.f24 === '1') && (!on.has('stay') || r.dataset.stay === '1');
      r.hidden = !show;
      r.toggleAttribute('data-clip', show && n >= limit);
      if (show) n++;
    }
    list.querySelectorAll<HTMLElement>('.lot-group').forEach((g) => {
      const lots = [...g.querySelectorAll<HTMLElement>('.lot')].filter((r) => !r.hidden);
      g.hidden = lots.every((r) => r.hasAttribute('data-clip'));
      const gc = g.querySelector('.g-count'); if (gc) gc.textContent = `${lots.length}곳`;
      // 동 바로가기 칩: 조건에 맞는 곳이 없는 동은 숨기고 개수도 맞춘다
      const j = [...document.querySelectorAll<HTMLAnchorElement>('#dong-jump a')].find((a) => decodeURIComponent(a.hash.slice(1)) === g.id);
      if (j) { j.hidden = !lots.length; const c = j.querySelector('span'); if (c) c.textContent = String(lots.length); }
    });
    if (more) {
      const rest = n - limit;
      more.hidden = rest <= 0;
      if (rest > 0) more.textContent = `${Math.min(PAGE, rest)}곳 더 보기 (남은 ${rest}곳)`;
    }
    if (count) count.textContent = `${n}곳`;
    if (empty) {
      empty.hidden = n > 0;
      // 빈 결과: 켜 둔 조건 이름을 그대로 적어 무엇을 끄면 되는지 알려 준다(제미나이 검수 3-2)
      const reset = document.getElementById('lot-reset');
      if (reset) reset.hidden = n > 0 || !chips.some((c) => c.getAttribute('aria-pressed') === 'true');
      if (!n) { const names = chips.filter((c) => c.getAttribute('aria-pressed') === 'true').map((c) => `'${c.textContent?.trim()}'`); empty.textContent = names.length ? `조건에 맞는 주차장이 없어요. ${names.join('·')} 중 하나를 꺼 보거나, 위 지역 줄에서 시·군·구 전체로 넓혀 보세요.` : '이 지역에는 공영주차장 자료가 없어요. 위 지역 줄에서 이웃 지역을 골라 보세요.'; }
    }
    if (announce && status) status.textContent = `조건에 맞는 주차장 ${n}곳`;
    placeSep();
    document.dispatchEvent(new CustomEvent('list:filtered')); // 지도 핀도 같은 조건으로(map-panel.ts)
  };

  chips.forEach((c) => c.addEventListener('click', () => {
    c.setAttribute('aria-pressed', String(c.getAttribute('aria-pressed') !== 'true'));
    limit = PAGE;
    apply(true);
  }));
  more?.addEventListener('click', () => {
    const firstNew = rows().find((r) => r.hasAttribute('data-clip'));
    limit += PAGE;
    apply();
    firstNew?.querySelector('a')?.focus(); // 키보드 위치를 새로 보인 첫 곳으로
  });
  // '동별 바로가기'(#동이름)로 가면 그 동이 잘려 있지 않게 전부 펼친다
  const unclipFor = (hash: string) => {
    const t = hash && document.getElementById(decodeURIComponent(hash.slice(1)));
    if (t && list.contains(t)) { limit = Infinity; apply(); }
  };
  document.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest?.('a[href^="#"]') as HTMLAnchorElement | null;
    if (a) unclipFor(a.hash);
  }, { signal: ac.signal });

  // PC 동 바로가기: 두 줄이 넘으면 '동 N곳 모두 보기'로 펼친다
  const jumpNav = document.getElementById('dong-jump');
  const jumpMore = document.querySelector<HTMLButtonElement>('.v-dongjump-more');
  if (jumpNav && jumpMore) {
    const n = jumpNav.querySelectorAll('a').length;
    const sync = () => { const open = jumpNav.classList.contains('is-open'); jumpMore.hidden = jumpNav.hidden || (!open && jumpNav.scrollHeight <= jumpNav.clientHeight + 2) || getComputedStyle(jumpNav).flexWrap !== 'wrap'; jumpMore.textContent = open ? '동 바로가기 접기' : `동 ${n}곳 모두 보기`; jumpMore.setAttribute('aria-expanded', String(open)); };
    jumpMore.addEventListener('click', () => { jumpNav.classList.toggle('is-open'); sync(); });
    addEventListener('resize', sync, { signal: ac.signal }); document.addEventListener('list:filtered', sync, { signal: ac.signal }); sync();
  }

  // 정렬: 무료(0) → 요금 낮은 순 → 요금 정보 없음은 맨 뒤. 같은 값은 이름순.
  const boxes = [...list.querySelectorAll<HTMLElement>('[data-lots]')];
  boxes.forEach((box, i) => box.querySelectorAll<HTMLElement>('.lot').forEach((r) => (r.dataset.home = String(i))));
  const flat = document.createElement('div');
  flat.hidden = true; list.appendChild(flat);
  // 요금 순일 때 계산할 수 없는 곳은 맨 아래 따로(최저가로 오인 방지)
  const sep = document.createElement('p');
  sep.className = 'lot-sep'; sep.hidden = true;
  sep.textContent = '요금 확인 필요 · 요금 자료가 비었거나 무료·유료가 섞여 계산하지 않은 곳이에요';
  let sortBy = 'name';
  const placeSep = () => {
    const first = sortBy === 'fee2' ? rows().find((r) => !r.hidden && (r.dataset.fee2 === '' || r.dataset.fee2 === undefined)) : null;
    sep.hidden = !first || first.hasAttribute('data-clip');
    if (first) first.before(sep); else sep.remove();
  };
  // 머물 시간 칩: 줄마다 그 시간의 예상 요금으로 바꾸고, 요금 순이면 다시 정렬
  const paintFee = () => {
    for (const r of rows()) {
      let fs: (number | null)[] = [];
      try { fs = JSON.parse(r.dataset.fees || '[]'); } catch { /* 없음 */ }
      const v = fs[si];
      r.dataset.fee2 = v === null || v === undefined ? '' : String(v);
      const fe = r.querySelector<HTMLElement>('.p-fee'), du = r.querySelector<HTMLElement>('.p-dur');
      if (fe && r.dataset.free !== '1') fe.textContent = v === null || v === undefined ? '요금 정보 없음' : v === 0 ? '무료' : `${v.toLocaleString('ko-KR')}원`;
      if (du) du.textContent = STAY_LABEL[si];
    }
  };
  stays.forEach((b) => b.addEventListener('click', () => {
    si = Number(b.dataset.stay);
    stays.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    paintFee(); paintOpen();
    const cur = sorts.find((x) => x.dataset.sort === sortBy);
    if (cur) cur.click(); else apply();
    if (status) status.textContent = `머물 시간 ${STAY_LABEL[si]} 기준 예상 요금으로 바꿨어요`;
  }, { signal: ac.signal }));
  sorts.forEach((b) => b.addEventListener('click', () => {
    const by = b.dataset.sort;
    sortBy = by ?? 'name';
    limit = PAGE;
    const v = (e: HTMLElement) => (e.dataset.fee2 === '' || e.dataset.fee2 === undefined ? Infinity : Number(e.dataset.fee2));
    const byName = (a: HTMLElement, c: HTMLElement) => (a.dataset.name ?? '').localeCompare(c.dataset.name ?? '', 'ko');
    if (boxes.length) {
      // 동별 묶음이 있는 목록: 요금순이면 묶음을 풀어 한 줄로(시·군·구 전체 비교), 이름순이면 각 동 묶음으로 되돌린다.
      // DOM 순서 자체를 바꾸므로 화면 순서와 키보드 순서가 같다.
      if (by === 'fee2') {
        rows().sort((a, c) => v(a) - v(c) || byName(a, c)).forEach((r) => flat.appendChild(r));
        flat.hidden = false;
        const jump = document.getElementById('dong-jump'); if (jump) jump.hidden = true; // 한 줄 비교일 때는 동 묶음이 없다
      } else {
        rows().sort(byName).forEach((r) => boxes[Number(r.dataset.home)].appendChild(r));
        flat.hidden = true;
        const jump = document.getElementById('dong-jump'); if (jump) jump.hidden = false;
      }
    } else {
      rows().sort((a, c) => (by === 'fee2' ? v(a) - v(c) : 0) || byName(a, c)).forEach((r) => list.appendChild(r));
    }
    apply();
    sorts.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    placeSep();
    if (status) status.textContent = by === 'fee2' ? `${boxes.length ? '동 구분 없이 ' : ''}${STAY_LABEL[si]} 예상 요금 낮은 순으로 정렬했어요` : (boxes.length ? '동별 이름순으로 되돌렸어요' : '이름순으로 정렬했어요');
  }));

  document.getElementById('lot-reset')?.addEventListener('click', () => { chips.forEach((c) => c.setAttribute('aria-pressed', 'false')); limit = PAGE; apply(true); (chips[0] as HTMLElement | undefined)?.focus(); }, { signal: ac.signal });
  // 주소의 ?filter=free,open 으로 처음부터 켜기(무료 허브 → 시·군·구 링크 등)
  const pre = new URLSearchParams(location.search).get('filter')?.split(',') ?? [];
  chips.forEach((c) => { if (pre.includes(c.dataset.filter ?? '')) c.setAttribute('aria-pressed', 'true'); });

  paintOpen(); apply();
  unclipFor(location.hash);
  timer = window.setInterval(() => { paintOpen(); apply(); }, 60_000);
}
