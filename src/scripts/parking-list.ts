// 주차장 목록 공통: '무료만'·'지금 운영 중' 필터, 운영 상태 표시(1분마다), 2시간 요금 정렬.
// 운영 상태는 공개된 운영시간으로 계산한 값이고 실제 개방 여부는 아니다(화면에 안내).
import { isOpenAt, kstNow, type Hours } from '../../scripts/lib/hours.ts';
import holidaysJson from '../data/holidays.json';

const holidays = new Set<string>(Object.entries(holidaysJson).filter(([k]) => /^\d{4}$/.test(k)).flatMap(([, v]) => v as string[]));

export function initParkingList() {
  const list = document.getElementById('lot-list');
  if (!list) return;
  const rows = () => [...list.querySelectorAll<HTMLElement>('.lot')];
  const chips = [...document.querySelectorAll<HTMLButtonElement>('[data-filter]')];
  const sorts = [...document.querySelectorAll<HTMLButtonElement>('[data-sort]')];
  const count = document.getElementById('lot-count');
  const status = document.getElementById('list-status');
  const empty = document.getElementById('lot-empty');

  const paintOpen = () => {
    const now = kstNow();
    for (const r of rows()) {
      let h: Hours = {};
      try { h = JSON.parse(r.dataset.hours || '{}'); } catch { /* 형식 오류면 판정 불가 */ }
      const open = isOpenAt(h, now, holidays);
      r.dataset.open = open === true ? '1' : open === false ? '0' : '';
      const b = r.querySelector<HTMLElement>('.p-open');
      if (b) {
        b.textContent = open === true ? '운영시간 내' : open === false ? '운영시간 외' : '시간 정보 없음';
        b.className = `p-open badge ${open === true ? 'bg-ok-bg text-ok' : 'bg-off-bg text-off'}`;
      }
    }
  };

  const apply = (announce = false) => {
    const on = new Set(chips.filter((c) => c.getAttribute('aria-pressed') === 'true').map((c) => c.dataset.filter));
    let n = 0;
    for (const r of rows()) {
      const show = (!on.has('free') || r.dataset.free === '1') && (!on.has('open') || r.dataset.open === '1');
      r.hidden = !show; if (show) n++;
    }
    if (count) count.textContent = `${n}곳`;
    if (empty) empty.hidden = n > 0;
    if (announce && status) status.textContent = `조건에 맞는 주차장 ${n}곳`;
  };

  chips.forEach((c) => c.addEventListener('click', () => {
    c.setAttribute('aria-pressed', String(c.getAttribute('aria-pressed') !== 'true'));
    apply(true);
  }));

  // 정렬: 무료(0) → 요금 낮은 순 → 요금 정보 없음은 맨 뒤. 같은 값은 이름순.
  sorts.forEach((b) => b.addEventListener('click', () => {
    const by = b.dataset.sort;
    const v = (e: HTMLElement) => (e.dataset.fee2 === '' || e.dataset.fee2 === undefined ? Infinity : Number(e.dataset.fee2));
    rows().sort((a, c) => (by === 'fee2' ? v(a) - v(c) : 0) || (a.dataset.name ?? '').localeCompare(c.dataset.name ?? '', 'ko')).forEach((r) => list.appendChild(r));
    sorts.forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    if (status) status.textContent = by === 'fee2' ? '2시간 요금 낮은 순으로 정렬했어요' : '이름순으로 정렬했어요';
  }));

  // 주소의 ?filter=free,open 으로 처음부터 켜기(무료 허브 → 시·군·구 링크 등)
  const pre = new URLSearchParams(location.search).get('filter')?.split(',') ?? [];
  chips.forEach((c) => { if (pre.includes(c.dataset.filter ?? '')) c.setAttribute('aria-pressed', 'true'); });

  paintOpen(); apply();
  setInterval(() => { paintOpen(); apply(); }, 60_000);
}
