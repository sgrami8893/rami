// ===== 사이트 전역 설정: 사이트명·도메인이 바뀌면 이 파일만 고친다 =====
export const SITE_NAME = '동네콕콕';
/** 정식 도메인(구매 후 사용). */
export const PROD_URL = 'https://dongnekokkok.kr';
/**
 * canonical·sitemap·robots.txt 기준 주소. 빌드 환경변수 SITE_URL 로 덮어쓴다.
 * 1차 확인용: Cloudflare Pages 환경변수에 SITE_URL=https://<프로젝트>.pages.dev 지정.
 */
// 2026-11-27: Cloudflare 환경변수 SITE_URL이 옛 프로젝트 주소(dongnenow.pages.dev)로 남아 있어 공유 이미지·canonical이 옛 주소로 나갔다.
// 옛 주소가 들어오면 지금 주소로 바꾼다(환경변수를 고친 뒤에도 그대로 두어도 무해).
const OLD_HOSTS: Record<string, string> = { 'dongnenow.pages.dev': 'https://dongnekokkok.pages.dev' };
const rawSite = (globalThis.process?.env?.SITE_URL || PROD_URL).trim().replace(/\/$/, '');
export const SITE_URL = OLD_HOSTS[new URL(rawSite).hostname] ?? rawSite;
/** 정식 도메인이 아닌 주소(*.pages.dev 등)로 빌드하면 검색엔진 수집을 막는다(임시 주소 색인·중복 방지). */
export const NOINDEX_ALL = new URL(SITE_URL).hostname !== new URL(PROD_URL).hostname;
export const SITE_DESC = '서울·경기·인천 무인민원발급기 2,100여 곳의 운영시간과 위치, 24시간·주말 운영 기기를 지역별로 찾아보세요. 동네 생활 공공정보를 모아 보여 주는 민간 서비스예요.';

/**
 * 허브(/)에 노출할 도구. 도구마다 독립 하위 폴더 + 독립 사이트맵(sitemap-<slug>-0.xml).
 * status 'soon' 은 링크 없이 "준비 중"으로만 표시(빈 페이지를 색인시키지 않음).
 */
export const TOOLS = [
  { slug: 'muin', name: '무인민원발급기 찾기', path: '/muin/', status: 'live', desc: '서울·경기·인천 무인민원발급기 위치, 지금 운영시간인 곳, 24시간·주말 운영, 등기부등본·가족관계증명서 발급 기기.' },
  { slug: 'waste', name: '대형폐기물 수수료', path: '/waste/', status: 'soon', desc: '가구·가전 버릴 때 우리 동네 대형폐기물 배출 수수료 확인.' },
  { slug: 'parking', name: '공영주차장 찾기', path: '/parking/', status: 'live', desc: '서울·경기·인천 공영주차장 4,700여 곳의 요금과 운영시간, 무료 주차장, 2시간 주차 요금 비교.' },
  { slug: 'rent', name: '빌라·오피스텔 전월세 시세', path: '/rent/', status: 'live', desc: '서울·경기·인천 동네별 빌라·오피스텔 전월세 실거래 시세(최근 12개월)와 중개보수·전월세 전환 계산기.' },
  { slug: 'cert', name: '국가기술자격 시험', path: '/cert/', status: 'soon', desc: '국가기술자격 시험 일정과 합격률.' },
] as const;
export type ToolSlug = (typeof TOOLS)[number]['slug'];

/** AdSense: 승인 후 client와 slot id 입력. 비어 있으면 자리만 표시(개발용). */
export const ADSENSE = { client: '', slots: { A: '', B: '', C: '', side: '' } };

/**
 * 오류 제보 구글 폼: 폼 생성 후 "미리 채운 링크 가져오기"로 얻은 값 입력.
 * 개인정보 미수집 원칙: 폼 항목은 기기 ID·기기명(자동 입력)·오류 유형·설명만 둔다.
 * 폼 설정에서 "이메일 주소 수집" 끄기, 로그인 요구 끄기. 설명란 안내문에 "이름·연락처 등 개인정보를 적지 마세요" 표기.
 */
export const REPORT_FORM = {
  formId: '', // e.g. 1FAIpQLS...
  entries: { id: '', name: '' }, // e.g. 'entry.123456'
};

/** 개인정보처리방침 문의처. 공개 전 실제 주소로 교체. */
export const CONTACT_EMAIL = '[운영자 이메일 주소]';

/** 도구별 데이터 출처(푸터·소개에 표기). TODO: 실제 내려받은 페이지 URL과 이용허락 유형 확인 후 확정. */
export const DATA_SOURCES: Record<string, { name: string; url: string }> = {
  muin: { name: '행정안전부 무인민원발급기 정보', url: 'https://www.localdata.go.kr' },
  // 공공데이터포털 '전국주차장정보표준데이터'(API tn_pubr_prkplce_info_api). 이용허락범위는 포털 화면에서 확인 후 about에 기록
  parking: { name: '공공데이터포털 전국주차장정보표준데이터', url: 'https://www.data.go.kr/data/15012896/standard.do' },
  // 국토교통부 실거래가 공개 API(이용허락 제한 없음). /rent/ 는 출처가 2개라 BaseLayout이 RENT_SOURCES로 펼친다
  rentVilla: { name: '국토교통부 연립다세대 전월세 실거래가 자료', url: 'https://www.data.go.kr/data/15126473/openapi.do' },
  rentOffi: { name: '국토교통부 오피스텔 전월세 실거래가 자료', url: 'https://www.data.go.kr/data/15126475/openapi.do' },
  /** 건물 위치(지번 → 건물 중심 좌표). 사용자 PC에서 내려받은 파일로만 쓴다(2026-11-26) */
  juso: { name: '행정안전부 주소정보(내비게이션용DB)', url: 'https://business.juso.go.kr' },
};

/**
 * 지도(MapPanel) 배경 타일. 2026-11-25 결정: 카카오·네이버 SDK는 쓰지 않고 Leaflet(BSD-2) + 공공 타일.
 * 바로e맵(국토지리정보원)·VWorld 중 어느 쪽을 쓸지는 약관 원문 확인 후 확정 → 그때 url·attribution을 검증해 채운다.
 * 빌드 환경변수: MAP_PROVIDER(ngii|vworld), PUBLIC_MAP_KEY(도메인 제한을 건 브라우저용 키).
 * provider나 key가 비어 있으면 지도는 렌더되지 않고 목록만 보인다(타일 없는 빈 지도를 띄우지 않음).
 */
const env = (k: string) => (globalThis.process?.env?.[k] ?? '').trim();
export const MAP_PROVIDERS = {
  // VWorld 이용약관(2026-11-26 사용자 확인): 13조 8항 자체 웹 서비스 연동 허용, 9항 '오픈플랫폼을 이용해 만든 것' 표기 의무,
  // 10항 서비스 내용 삭제·변경 금지, 19조 6항 데이터 무단 저장 금지 → 타일은 브라우저가 VWorld에서 직접 받고 저장·캐시·프록시하지 않는다.
  // 인증키는 본인 사용만(13조 7항), 호출 제한은 별도 공지(13조 4·5항). 키는 vworld.kr에서 서비스 URL(도메인)을 등록해 발급한다.
  vworld: { name: '브이월드(국토교통부 공간정보 오픈플랫폼)', url: 'https://api.vworld.kr/req/wmts/1.0.0/{key}/Base/{z}/{y}/{x}.png', attribution: '<a href="https://www.vworld.kr" target="_blank" rel="noopener noreferrer">배경지도 © 브이월드(공간정보 오픈플랫폼)</a>', maxZoom: 19, policyUrl: 'https://www.vworld.kr' },
  ngii: { name: '바로e맵(국토지리정보원)', url: '', attribution: '배경지도: 국토지리정보원', maxZoom: 19, policyUrl: 'https://map.ngii.go.kr' }, // url 확인 필요
} as const;
type MapProviderKey = keyof typeof MAP_PROVIDERS;
// 기본값: VWorld 개발키(2026-11-26 발급, 2027-05-26 만료, 서비스 URL https://dongnekokkok.pages.dev 에 묶임).
// 브라우저에 그대로 보이는 공개 키라 저장소에 둔다(도메인 제한). 만료 전에 운영키로 바꾸고, 정식 도메인을 사면 키에 도메인을 추가한다.
// 환경변수 MAP_PROVIDER·PUBLIC_MAP_KEY가 있으면 그 값이 우선. MAP_PROVIDER=none 이면 지도를 끈다.
const DEFAULT_MAP = { provider: 'vworld', key: '382E903F-B63C-43C4-AC23-5811EBF70B19' } as const;
const mapProvider = (env('MAP_PROVIDER') || DEFAULT_MAP.provider) as MapProviderKey | 'none' | '';
const mapKey = env('PUBLIC_MAP_KEY') || (mapProvider === DEFAULT_MAP.provider ? DEFAULT_MAP.key : '');
const preset = mapProvider && mapProvider in MAP_PROVIDERS ? MAP_PROVIDERS[mapProvider] : null;
/** 실제로 쓸 지도 설정. 테스트용으로 MAP_TILE_URL(키 포함 전체 주소)을 직접 줄 수도 있다. */
export const MAP = env('MAP_TILE_URL')
  ? { enabled: true, url: env('MAP_TILE_URL'), attribution: env('MAP_ATTRIBUTION') || '배경지도 테스트', maxZoom: 19, name: '테스트 타일', policyUrl: '' }
  : preset && preset.url && mapKey
    ? { enabled: true, url: preset.url.replace('{key}', encodeURIComponent(mapKey)), attribution: preset.attribution, maxZoom: preset.maxZoom, name: preset.name, policyUrl: preset.policyUrl }
    : { enabled: false, url: '', attribution: '', maxZoom: 19, name: '', policyUrl: '' };

/**
 * /parking/ 미리보기. PARKING_PREVIEW=1 로 빌드하면 TOOLS의 parking이 'soon'이어도 페이지를 만든다
 * (실데이터 parking.json이 있으면 실데이터, 없으면 가짜 데이터+noindex). Cloudflare Pages 환경변수에는 넣지 않는다.
 * 배포 공개는 TOOLS의 parking status를 'live'로 바꾸는 것으로 한다(src/lib/parking.ts).
 */
export const PARKING_PREVIEW = env('PARKING_PREVIEW') === '1';

/**
 * /rent/ (동네 빌라·오피스텔 전월세 시세) 미리보기. RENT_PREVIEW=1 이면 TOOLS의 rent가 'soon'이어도 페이지를 만든다
 * (실데이터 rent-stats.json이 없으면 가짜 데이터+noindex). 배포 환경변수에는 넣지 않는다.
 * 배포 공개는 TOOLS의 rent status를 'live'로 두는 것으로 한다(실데이터가 있을 때만 페이지가 생김, src/lib/rent.ts).
 */
export const RENT_PREVIEW = env('RENT_PREVIEW') === '1';

/** 상황별 서류 체크리스트: 상황→서류 묶음의 공식 출처를 확인하기 전까지 noindex·사이트맵 제외 */
export const CHECKLIST_VERIFIED = false;

/**
 * 검색 엔진 소유 확인 메타 태그(구글 서치 콘솔·네이버 서치어드바이저). Cloudflare Pages 환경변수로만 넣는다.
 * 값은 영문·숫자·-_ 만 허용(다른 문자가 섞이면 출력하지 않음). 비어 있으면 태그를 출력하지 않는다. 홈(/)에만 출력.
 */
const verification = (k: string) => { const v = env(k); return /^[A-Za-z0-9_-]{8,128}$/.test(v) ? v : ''; };
export const SITE_VERIFICATION = { google: verification('GOOGLE_SITE_VERIFICATION'), naver: verification('NAVER_SITE_VERIFICATION') };

/**
 * 주소 검색(행정안전부 도로명주소 검색 API, business.juso.go.kr). 2026-11-27 틀만 만들어 둠.
 * 승인키(PUBLIC_JUSO_KEY, 서비스 URL을 등록해 받는 브라우저용 키)가 빌드 환경변수에 있을 때만 켜진다. 없으면 화면에 아무것도 안 보인다.
 * - 입력한 검색어만 브라우저가 juso.go.kr로 직접 보낸다(우리 서버·분석·저장 없음). 켜지면 개인정보처리방침에 항목이 자동으로 생긴다.
 * - 결과는 주소 → 법정동 이름으로 우리 동 페이지에 연결만 한다(좌표 변환 없음, 결과 저장·재배포 없음).
 * - 켜기 전 확인: 이용약관(출처 표기 문구), 브라우저 직접 호출 허용(CORS) 여부, 일일 호출 한도.
 */
export const JUSO = { key: env('PUBLIC_JUSO_KEY'), enabled: !!env('PUBLIC_JUSO_KEY'), url: 'https://business.juso.go.kr/addrlink/addrLinkApi.do', name: '행정안전부 도로명주소 검색 API', policyUrl: 'https://business.juso.go.kr' } as const;
