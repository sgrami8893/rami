// 주소 복사 버튼: [data-copy] 클릭 시 클립보드에 복사하고 버튼 글자를 1.5초간 "복사됨"으로 바꾼다.
export function initCopy(root: ParentNode = document) {
  root.addEventListener('click', async (e) => {
    const btn = (e.target as Element).closest<HTMLButtonElement>('[data-copy]');
    if (!btn) return;
    const label = btn.querySelector('span');
    try {
      await navigator.clipboard.writeText(btn.dataset.copy ?? '');
      if (label) { label.textContent = '복사됨'; setTimeout(() => { label.textContent = '주소 복사'; }, 1500); }
    } catch {
      if (label) { label.textContent = '복사 실패'; setTimeout(() => { label.textContent = '주소 복사'; }, 1500); }
    }
  });
}
