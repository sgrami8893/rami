# 동네콕콕 (dongnekokkok)

동네 생활 공공정보 허브. 도구마다 독립 하위 폴더 + 독립 내부 링크 + 독립 사이트맵.
첫 도구: `/muin/` 무인민원발급기 찾기 (서울·경기·인천).

Astro 7 (정적 생성) + Tailwind 4 + Cloudflare Pages. Node 22.18 이상.

```
npm install
npm run dev           # http://localhost:4321
npm run build         # dist/ (정적 HTML, 도구별 sitemap, robots.txt)
npm test              # 데이터 파이프라인 테스트
```

## 설정 한 곳: `src/config.ts`
- `SITE_NAME`(동네콕콕), `PROD_URL`(https://dongnekokkok.kr), `TOOLS`(허브에 노출할 도구, `soon`은 링크 없이 "준비 중")
- `SITE_URL`은 빌드 환경변수 `SITE_URL`로 덮어쓴다. 정식 도메인이 아닌 주소로 빌드하면 **모든 페이지 noindex + robots.txt 전체 차단**(임시 주소가 검색에 잡히지 않게).
- 애드센스 `ADSENSE`, 오류 제보 구글 폼 `REPORT_FORM`, 문의 메일 `CONTACT_EMAIL`, 출처 `DATA_SOURCES`는 공개 전 채울 것.

## Cloudflare Pages
- Framework preset: Astro / Build command: `npm run build` / Output: `dist` / Node: `.node-version`(22)
- 1차 검수(도메인 구매 전): 환경변수 `SITE_URL=https://<프로젝트명>.pages.dev` → canonical·sitemap이 pages.dev 주소, 검색 차단 상태로 확인
- 도메인 연결 후: `SITE_URL` 환경변수를 지우거나 `https://dongnekokkok.kr`로 바꾸고 재배포 → 색인 허용

## 페이지 (무인발급기)
- `/muin/` 도구 메인, `/muin/[sido]/`, `/muin/[sido]/[sigungu]/`(필터·FAQ·광고 A/B/C), `/muin/[sido]/[sigungu]/k/[id]/` 기기 상세
- 원천 데이터에 좌표가 없어 대체 기기는 "같은 동 → 같은 일반구"로 고른다. 대체 기기가 없으면 상세는 noindex + sitemap 제외.
- 위치정보(Geolocation)는 쓰지 않는다.

## 데이터 갱신 (월 1~2회, 국내 PC)
원천 사이트가 해외 IP를 막아 서버 자동화가 안 된다.
1. localdata(행정안전부)에서 CSV 2개 다운로드: `무인민원발급기정보_설치정보조회.csv`, `무인민원발급기정보_발급제증명조회.csv`
2. `npm run update-data -- <설치정보.csv> --docs <발급제증명.csv>`
3. 콘솔 요약과 `src/data/kiosks.report.json` 확인 (삭제 10% 초과면 중단, `--force`로 무시) → `git commit` → `git push` → 자동 배포

CSV 파일은 커밋하지 않는다(.gitignore). `npm run mock-data`는 가상 데이터를 `scripts/fixtures/out/`에 만든다(실데이터 보존).

## 자동 갱신 (GitHub Actions, 2026-11-27)
`.github/workflows/data-refresh.yml`이 **매주 월·목 04:17(한국 시각)** 전월세 실거래(빌라·오피스텔, 아파트는 활용신청 승인 시 자동 포함)와 공영주차장을 받아 `main`에 커밋한다 → Cloudflare Pages 자동 배포.
- 준비(한 번): 저장소 Settings → Secrets and variables → Actions → `DATA_GO_KR_KEY`(공공데이터포털 일반 인증키).
- 전월세는 실거래 신고 기한(30일)을 덮도록 최근 3개월을 매번 새로 받고, 나머지 달은 Actions 캐시(층·계약일을 뺀 필드만)를 이어 쓴다.
- `npm run check-data`: 지난 커밋과 비교해 거래·건물·주차장 건수가 급감하거나 기간이 뒤로 가면 실패 → 커밋하지 않음. 이어서 `npm test`·`npm run build`가 통과해야 커밋.
- 실패하면 '데이터 자동 갱신 실패' 이슈가 열리고(메일 알림), 다음 성공 때 자동으로 닫힌다.
- 건물 좌표: Actions에는 주소정보 DB가 없어 지난번 `rent-buildings` 파일 좌표를 이어받는다. 새 건물만 좌표가 없으니 몇 달에 한 번 PC에서 `npm run fetch-rent` 후 `src/data/rent-buildings`를 올리면 채워진다(검사 결과에 좌표 비율 95% 미만이면 안내가 뜸).
- `데이터 API 접속 확인` 워크플로는 키 없이 정부 API 접속만 확인한다.

## 전월세 지도 경계 갱신 (행정구역이 바뀔 때만)

경계 SHP(도로명주소 기반 시·군·구/읍면동/리, WGS84)를 압축 해제한 폴더로 다시 만든다. 통계만 바뀌면 빌드만 하면 된다(/geo/rent/*.json은 빌드 때 합침).

```
pip install pyshp shapely topojson pyproj
node -e "import('./scripts/lib/rent-lawd.ts').then(m=>{const o={};for(const l of m.LAWD){const r=m.regionOfDeal(l.code,'X');if(r)o[l.code]=[r.sido,r.sigungu]};console.log(JSON.stringify(o))})" > lawd.json
python3 scripts/geo/build-boundaries.py <경계 폴더> lawd.json   # → src/data/geo/sgg.json, src/data/geo/emd/*.json
```

## 코드
- `scripts/lib/localdata.ts` 실데이터 어댑터(두 파일 조인, 재외공관·미사용 기기 제외, 등기·가족관계는 설치정보 발급구분 기준)
- `scripts/lib/hours.ts` 운영시간 파서 + KST `isOpenAt`(클라이언트 공용)
- `scripts/lib/regions.ts` 수도권 시군구·일반구, 2026-07 인천 개편(제물포·영종·서해·검단구) 및 개편 전 주소 보정
- `scripts/lib/docs.ts` 발급 서류 분류
