// 지도 위 지역 칩의 목록 팝업(2026-11-26, 기본 선택 상자 대신). WAI-ARIA 콤보박스/리스트박스 패턴:
// - 칩 버튼(aria-haspopup="listbox", aria-expanded)을 누르면 팝업이 열리고, 항목이 많으면 검색 입력(role=combobox)에 포커스.
// - ↑↓·Home·End로 이동(aria-activedescendant), Enter로 고르기, Esc·바깥 누르기·Tab으로 닫기(포커스는 칩으로).
// 보안: 항목 글자는 textContent로만 넣는다.
export type PickItem = { value: string; label: string; meta?: string };
interface Opts { search?: string; items: () => PickItem[]; current: () => string; onPick: (value: string) => void }

let openOne: (() => void) | null = null;
const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase();

export function picker(root: HTMLElement, o: Opts) {
  const btn = root.querySelector<HTMLButtonElement>('.rm-chip')!;
  const pop = root.querySelector<HTMLElement>('.rm-pop')!;
  const list = pop.querySelector<HTMLUListElement>('[role="listbox"]')!;
  const input = pop.querySelector<HTMLInputElement>('input');
  const id = list.id;
  let items: PickItem[] = [];
  let shown: PickItem[] = [];
  let active = 0;
  if (input && !o.search) input.parentElement!.hidden = true;

  const paint = () => {
    list.querySelectorAll<HTMLElement>('[role="option"]').forEach((el, i) => el.classList.toggle('is-active', i === active));
    const cur = list.querySelector<HTMLElement>(`#${id}-o${active}`);
    const owner = input && !input.parentElement!.hidden ? input : list;
    if (cur) { owner.setAttribute('aria-activedescendant', cur.id); cur.scrollIntoView({ block: 'nearest' }); }
    else owner.removeAttribute('aria-activedescendant');
  };
  const render = () => {
    const q = norm(input?.value ?? '');
    shown = q ? items.filter((x) => norm(x.label).includes(q)) : items;
    const cur = o.current();
    list.replaceChildren(...shown.map((x, i) => {
      const li = document.createElement('li');
      li.id = `${id}-o${i}`; li.setAttribute('role', 'option'); li.className = 'rm-opt';
      li.setAttribute('aria-selected', String(x.value === cur));
      const a = document.createElement('span'); a.className = 'rm-opt-label'; a.textContent = x.label;
      li.append(a);
      if (x.meta) { const m = document.createElement('span'); m.className = 'rm-opt-meta'; m.textContent = x.meta; li.append(m); }
      li.addEventListener('mousedown', (e) => e.preventDefault()); // 고를 때 입력창 포커스 유지
      li.addEventListener('click', () => choose(i));
      li.addEventListener('mousemove', () => { if (active !== i) { active = i; paint(); } });
      return li;
    }));
    if (!shown.length) {
      const li = document.createElement('li'); li.className = 'rm-opt-empty'; li.textContent = '일치하는 곳이 없어요'; list.append(li);
    }
    active = Math.max(0, shown.findIndex((x) => x.value === cur));
    paint();
  };
  const close = (focusBtn = true) => {
    if (pop.hidden) return;
    pop.hidden = true; btn.setAttribute('aria-expanded', 'false');
    if (openOne === close) openOne = null;
    if (focusBtn) btn.focus();
  };
  const open = () => {
    if (openOne && openOne !== close) openOne();
    openOne = close;
    items = o.items();
    if (input) input.value = '';
    pop.hidden = false; btn.setAttribute('aria-expanded', 'true');
    render();
    (input && !input.parentElement!.hidden ? input : list).focus();
  };
  const choose = (i: number) => { const x = shown[i]; if (!x) return; close(); o.onPick(x.value); };
  btn.addEventListener('click', () => (pop.hidden ? open() : close()));
  btn.addEventListener('keydown', (e) => { if (e.key === 'ArrowDown' && pop.hidden) { e.preventDefault(); open(); } });
  const keys = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); active = Math.min(shown.length - 1, active + 1); paint(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(0, active - 1); paint(); }
    else if (e.key === 'Home' && e.target === list) { e.preventDefault(); active = 0; paint(); }
    else if (e.key === 'End' && e.target === list) { e.preventDefault(); active = shown.length - 1; paint(); }
    else if (e.key === 'Enter') { e.preventDefault(); choose(active); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    else if (e.key === 'Tab') close(false);
  };
  list.addEventListener('keydown', keys);
  input?.addEventListener('keydown', keys);
  input?.addEventListener('input', render);
  document.addEventListener('pointerdown', (e) => { if (!pop.hidden && !root.contains(e.target as Node)) close(false); });
  return {
    /** 칩 글자 바꾸기. muted=true면 아직 고르지 않은 상태(회색) */
    set(label: string, muted = false) {
      const t = btn.querySelector('.rm-chip-text')!; t.textContent = label;
      btn.classList.toggle('is-muted', muted);
    },
    show(on: boolean) { root.hidden = !on; if (!on) close(false); },
  };
}
