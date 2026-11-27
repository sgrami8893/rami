// 주소 검색(행정안전부 도로명주소 검색 API). 승인키가 있을 때만 SearchSheet가 불러온다(config.ts JUSO).
// - 지번·도로명 주소처럼 보이는 검색어(숫자나 '로·길'이 들어감)만 보낸다. 동 이름만 넣으면 기존 목록 검색으로 충분하다.
// - 검색어는 브라우저가 juso.go.kr로 직접 보내고, 우리 서버·분석 도구·저장소에는 남기지 않는다.
// - 결과의 법정동(emdNm)·시군구(sggNm)로 우리 동 페이지를 찾아 연결만 한다. 결과 주소는 이 화면에만 잠깐 보인다.
type Row = [string, string, string, { r?: string; p?: string; m?: string }];
type Juso = { roadAddr: string; jibunAddr: string; siNm: string; sggNm: string; emdNm: string };
const looksLikeAddr = (s: string) => /\d/.test(s) || /(로|길)\s*$/.test(s.trim()) || /(로|길)\s*\d/.test(s);
type Res = { results?: { common?: { errorCode?: string }; juso?: Juso[] | null } };
/** JSONP(행안부가 교차 출처 호출용으로 주는 addrLinkApiJsonp.do). 응답은 우리 콜백 하나만 부르고, 8초 넘으면 버린다 */
let jn = 0;
function jsonp(q: Record<string, string>): Promise<Res> {
  return new Promise((res) => {
    const cb = `__dnkkJuso${++jn}`, s = document.createElement('script');
    const done = (v: Res) => { delete (window as unknown as Record<string, unknown>)[cb]; s.remove(); clearTimeout(t); res(v); };
    const t = window.setTimeout(() => done({}), 8000);
    (window as unknown as Record<string, unknown>)[cb] = (v: { returnXml?: string } & Res) => done(v);
    const u = new URL('https://business.juso.go.kr/addrlink/addrLinkApiJsonp.do');
    u.search = new URLSearchParams({ ...q, callback: cb }).toString();
    s.src = u.href; s.referrerPolicy = 'origin'; s.onerror = () => done({});
    document.head.append(s);
  });
}
let timer = 0, seq = 0;
const cache = new Map<string, Juso[]>();

export function addrSearch(raw: string, rows: Row[], pref: 'r' | 'p' | 'm', LABEL: Record<'r' | 'p' | 'm', string>) {
  const box = document.getElementById('v-s-addr');
  const sheet = document.getElementById('v-sheet');
  const key = sheet?.dataset.juso;
  if (!box || !key) return;
  const kw = raw.trim().replace(/[%=><[\]]/g, ''); // API가 거부하는 특수문자 제거
  clearTimeout(timer);
  if (kw.length < 3 || !looksLikeAddr(kw)) { box.hidden = true; return; }
  const my = ++seq;
  timer = window.setTimeout(async () => {
    let list = cache.get(kw);
    if (!list) {
      try {
        const q = { confmKey: key, currentPage: '1', countPerPage: '8', keyword: kw, resultType: 'json' };
        let j: Res;
        try {
          const u = new URL('https://business.juso.go.kr/addrlink/addrLinkApi.do');
          u.search = new URLSearchParams(q).toString();
          const r = await fetch(u, { referrerPolicy: 'origin', credentials: 'omit' });
          j = await r.json() as Res;
        } catch { j = await jsonp(q); } // 브라우저 교차 출처가 막히면 API가 제공하는 JSONP 주소로
        list = j.results?.common?.errorCode === '0' ? (j.results.juso ?? []) : [];
      } catch { list = []; }
      cache.set(kw, list);
    }
    if (my !== seq) return; // 더 새 입력이 있으면 버린다
    const out = box.querySelector('.v-s-addr-list')!;
    const seen = new Set<string>();
    const items = list.flatMap((a) => {
      // 우리 목록에서 같은 시·군·구의 같은 법정동 찾기(시군구 이름이 '성남시 분당구'처럼 두 단어일 수 있음)
      const row = rows.find(([n, c]) => n === a.emdNm && a.sggNm.split(' ').every((w) => c.includes(w)));
      if (!row || seen.has(row[0] + row[1])) return [];
      seen.add(row[0] + row[1]);
      const h = row[3];
      const k = h[pref] ? pref : (['r', 'p', 'm'] as const).find((x) => h[x]);
      if (!k) return [];
      const a2 = document.createElement('a'); a2.className = 'main'; a2.href = h[k]!;
      const t = document.createElement('span'); t.textContent = `${row[0]} · ${LABEL[k]}`;
      const s = document.createElement('small'); s.textContent = a.roadAddr || a.jibunAddr;
      a2.append(t, s);
      const d = document.createElement('div'); d.className = 'v-sres-row'; d.append(a2);
      return [d];
    });
    out.replaceChildren(...items);
    box.hidden = !items.length;
  }, 350);
}
