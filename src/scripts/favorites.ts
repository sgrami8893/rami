// 즐겨찾는 발급기: 이 브라우저의 localStorage에만 저장(서버 전송·로그인 없음). 최대 20곳.
// 저장 항목은 화면 표시에 필요한 공개 정보뿐(기기 ID·이름·주소 일부·운영시간). 개인정보 없음.
export const FAV_KEY = 'dnkk:fav:v1';
export const FAV_MAX = 20;
export interface Fav { id: string; name: string; path: string; sub: string; hours: unknown; conf: string; f24h: string }

export function readFavs(): Fav[] {
  try { const v = JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); return Array.isArray(v) ? v.slice(0, FAV_MAX) : []; } catch { return []; }
}
function writeFavs(v: Fav[]) { try { localStorage.setItem(FAV_KEY, JSON.stringify(v.slice(0, FAV_MAX))); return true; } catch { return false; } }

/** 상세 페이지의 즐겨찾기 버튼(data-fav-* 속성)을 연결한다 */
export function initFavButton() {
  const btn = document.querySelector<HTMLButtonElement>('#fav-toggle');
  if (!btn) return;
  const d = btn.dataset;
  const me: Fav = { id: d.favId!, name: d.favName!, path: d.favPath!, sub: d.favSub ?? '', hours: JSON.parse(d.favHours || '{}'), conf: d.favConf ?? '', f24h: d.favF24h ?? '' };
  const label = btn.querySelector('span')!;
  const paint = (on: boolean) => {
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', on ? '즐겨찾기에서 빼기' : '즐겨찾기에 추가');
    label.textContent = on ? '저장됨' : '저장';
  };
  paint(readFavs().some((f) => f.id === me.id));
  btn.addEventListener('click', () => {
    const list = readFavs();
    const on = list.some((f) => f.id === me.id);
    const next = on ? list.filter((f) => f.id !== me.id) : [me, ...list];
    if (!on && list.length >= FAV_MAX) next.length = FAV_MAX;
    if (writeFavs(next)) paint(!on);
    else label.textContent = '저장 불가';
  });
}
