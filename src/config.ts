// ===== 사이트 전역 설정: 사이트명·도메인이 바뀌면 이 파일만 고친다 =====
export const SITE_NAME = '동네콕콕';
/** 정식 도메인(구매 후 사용). */
export const PROD_URL = 'https://dongnekokkok.kr';
/**
 * canonical·sitemap·robots.txt 기준 주소. 빌드 환경변수 SITE_URL 로 덮어쓴다.
 * 1차 확인용: Cloudflare Pages 환경변수에 SITE_URL=https://<프로젝트>.pages.dev 지정.
 */
export const SITE_URL = (globalThis.process?.env?.SITE_URL || PROD_URL).replace(/\/$/, '');
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
  { slug: 'parking', name: '공영주차장', path: '/parking/', status: 'soon', desc: '동네 공영주차장 위치와 요금.' },
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
};

/**
 * 지도(MapPanel) 배경 타일. 2026-11-25 결정: 카카오·네이버 SDK는 쓰지 않고 Leaflet(BSD-2) + 공공 타일.
 * 바로e맵(국토지리정보원)·VWorld 중 어느 쪽을 쓸지는 약관 원문 확인 후 확정 → 그때 url·attribution을 검증해 채운다.
 * 빌드 환경변수: MAP_PROVIDER(ngii|vworld), PUBLIC_MAP_KEY(도메인 제한을 건 브라우저용 키).
 * provider나 key가 비어 있으면 지도는 렌더되지 않고 목록만 보인다(타일 없는 빈 지도를 띄우지 않음).
 */
const env = (k: string) => (globalThis.process?.env?.[k] ?? '').trim();
export const MAP_PROVIDERS = {
  // url 형식은 2차 자료 기준(확인 필요). https 지원 여부를 반드시 확인한 뒤 켠다.
  vworld: { name: 'VWorld(국토교통부 공간정보 오픈플랫폼)', url: 'https://api.vworld.kr/req/wmts/1.0.0/{key}/Base/{z}/{y}/{x}.png', attribution: '배경지도: VWorld', maxZoom: 19, policyUrl: 'https://www.vworld.kr' },
  ngii: { name: '바로e맵(국토지리정보원)', url: '', attribution: '배경지도: 국토지리정보원', maxZoom: 19, policyUrl: 'https://map.ngii.go.kr' }, // url 확인 필요
} as const;
type MapProviderKey = keyof typeof MAP_PROVIDERS;
const mapProvider = env('MAP_PROVIDER') as MapProviderKey | '';
const mapKey = env('PUBLIC_MAP_KEY');
const preset = mapProvider && mapProvider in MAP_PROVIDERS ? MAP_PROVIDERS[mapProvider] : null;
/** 실제로 쓸 지도 설정. 테스트용으로 MAP_TILE_URL(키 포함 전체 주소)을 직접 줄 수도 있다. */
export const MAP = env('MAP_TILE_URL')
  ? { enabled: true, url: env('MAP_TILE_URL'), attribution: env('MAP_ATTRIBUTION') || '배경지도 테스트', maxZoom: 19, name: '테스트 타일', policyUrl: '' }
  : preset && preset.url && mapKey
    ? { enabled: true, url: preset.url.replace('{key}', encodeURIComponent(mapKey)), attribution: preset.attribution, maxZoom: preset.maxZoom, name: preset.name, policyUrl: preset.policyUrl }
    : { enabled: false, url: '', attribution: '', maxZoom: 19, name: '', policyUrl: '' };

/**
 * /parking/ 골격 미리보기. PARKING_PREVIEW=1 로 빌드할 때만 주차장 페이지를 만든다(가짜 데이터, 모두 noindex).
 * Cloudflare Pages 환경변수에는 넣지 않는다 → 배포 빌드에는 /parking/ 페이지가 하나도 생기지 않는다.
 */
export const PARKING_PREVIEW = env('PARKING_PREVIEW') === '1';
