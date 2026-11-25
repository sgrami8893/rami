// 주소 복사 버튼: [data-copy] 클릭 시 클립보드에 복사하고 버튼 글자를 1.5초간 "복사됨"으로 바꾼다.
// 화면 읽기 프로그램에는 페이지에 하나뿐인 숨은 알림 영역(role=status)으로 결과를 알린다.
function announce(msg: string) {
  let el = document.getElementById('copy-status');
  if (!el) {
    el = document.createElement('p');
    el.id = 'copy-status';
    el.className = 'sr-only';
    el.setAttribute('role', 'status');
    document.body.append(el);
  }
  el.textContent = '';
  setTimeout(() => { el!.textContent = msg; }, 50); // 같은 문구를 다시 알릴 수 있게 비웠다가 채운다
}

export function initCopy(root: ParentNode = document) {
  root.addEventListener('click', async (e) => {
    const btn = (e.target as Element).closest<HTMLButtonElement>('[data-copy]');
    if (!btn) return;
    const label = btn.querySelector('span');
    let msg: string;
    try {
      await navigator.clipboard.writeText(btn.dataset.copy ?? '');
      msg = '복사됨';
      announce('주소를 복사했습니다.');
    } catch {
      msg = '복사 실패';
      announce('주소를 복사하지 못했습니다.');
    }
    if (label) { label.textContent = msg; setTimeout(() => { label.textContent = '주소 복사'; }, 1500); }
  });
}
