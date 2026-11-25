# 동네나우 (dongnenow)

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
- `SITE_NAME`(동네나우), `PROD_URL`(https://dongnenow.kr), `TOOLS`(허브에 노출할 도구, `soon`은 링크 없이 "준비 중")
- `SITE_URL`은 빌드 환경변수 `SITE_URL`로 덮어쓴다. 정식 도메인이 아닌 주소로 빌드하면 **모든 페이지 noindex + robots.txt 전체 차단**(임시 주소가 검색에 잡히지 않게).
- 애드센스 `ADSENSE`, 오류 제보 구글 폼 `REPORT_FORM`, 문의 메일 `CONTACT_EMAIL`, 출처 `DATA_SOURCES`는 공개 전 채울 것.

## Cloudflare Pages
- Framework preset: Astro / Build command: `npm run build` / Output: `dist` / Node: `.node-version`(22)
- 1차 검수(도메인 구매 전): 환경변수 `SITE_URL=https://<프로젝트명>.pages.dev` → canonical·sitemap이 pages.dev 주소, 검색 차단 상태로 확인
- 도메인 연결 후: `SITE_URL` 환경변수를 지우거나 `https://dongnenow.kr`로 바꾸고 재배포 → 색인 허용

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

## 코드
- `scripts/lib/localdata.ts` 실데이터 어댑터(두 파일 조인, 재외공관·미사용 기기 제외, 등기·가족관계는 설치정보 발급구분 기준)
- `scripts/lib/hours.ts` 운영시간 파서 + KST `isOpenAt`(클라이언트 공용)
- `scripts/lib/regions.ts` 수도권 시군구·일반구, 2026-07 인천 개편(제물포·영종·서해·검단구) 및 개편 전 주소 보정
- `scripts/lib/docs.ts` 발급 서류 분류
