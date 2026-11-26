// 지도 위 도구 전환 링크를 지금 지도 지역에 맞춘다(전월세 지도는 옮길 때마다 'map:area'를 보낸다). 표는 /geo/area/tools.json
type Table = { root: string; sido: Record<string, string>; sgg: Record<string, string> };
let tables: Promise<Record<string, Table> | null> | null = null;
let started = false;
export function initMapTools() {
  if (started) return;
  started = true;
  document.addEventListener('map:area', (e) => {
    const { sido, sgg } = (e as CustomEvent<{ sido: string | null; sgg: string | null }>).detail;
    tables ??= fetch('/geo/area/tools.json').then((r) => (r.ok ? r.json() : null)).catch(() => null);
    void tables.then((t) => {
      if (!t) return;
      document.querySelectorAll<HTMLAnchorElement>('.map-tools a[data-tool]').forEach((a) => {
        const x = t[a.dataset.tool!];
        if (!x) return;
        a.href = (sido && sgg && x.sgg[`${sido}__${sgg}`]) || (sido && x.sido[sido]) || x.root;
      });
    });
  });
}
