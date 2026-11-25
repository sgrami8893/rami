// 수도권 시군구 목록 (slug는 수동 고정). 기기가 있는 지역만 페이지가 생성된다.
// VERIFY 표시는 2026년 행정구역 개편으로 기억에 의존한 항목: 구현 전 행정표준코드로 재확인.

export type SidoSlug = 'seoul' | 'gyeonggi' | 'incheon';
export interface Sigungu { name: string; slug: string; subGu?: string[]; aliases?: string[]; verify?: string }

export const SIDO: Record<SidoSlug, { name: string; aliases: string[] }> = {
  seoul: { name: '서울특별시', aliases: ['서울', '서울시', '서울특별시'] },
  gyeonggi: { name: '경기도', aliases: ['경기', '경기도'] },
  incheon: { name: '인천광역시', aliases: ['인천', '인천시', '인천광역시'] },
};

const s = (name: string, slug: string, extra: Partial<Sigungu> = {}): Sigungu => ({ name, slug, ...extra });

export const SIGUNGU: Record<SidoSlug, Sigungu[]> = {
  seoul: [
    s('종로구', 'jongno-gu'), s('중구', 'jung-gu'), s('용산구', 'yongsan-gu'), s('성동구', 'seongdong-gu'),
    s('광진구', 'gwangjin-gu'), s('동대문구', 'dongdaemun-gu'), s('중랑구', 'jungnang-gu'), s('성북구', 'seongbuk-gu'),
    s('강북구', 'gangbuk-gu'), s('도봉구', 'dobong-gu'), s('노원구', 'nowon-gu'), s('은평구', 'eunpyeong-gu'),
    s('서대문구', 'seodaemun-gu'), s('마포구', 'mapo-gu'), s('양천구', 'yangcheon-gu'), s('강서구', 'gangseo-gu'),
    s('구로구', 'guro-gu'), s('금천구', 'geumcheon-gu'), s('영등포구', 'yeongdeungpo-gu'), s('동작구', 'dongjak-gu'),
    s('관악구', 'gwanak-gu'), s('서초구', 'seocho-gu'), s('강남구', 'gangnam-gu'), s('송파구', 'songpa-gu'),
    s('강동구', 'gangdong-gu'),
  ],
  incheon: [
    // 2026-07-01 개편: 중구+동구 → 제물포구·영종구, 서구 → 서해구·검단구 (실데이터 2026-11에서 신 구명 확인)
    s('제물포구', 'jemulpo-gu'), s('영종구', 'yeongjong-gu'), s('서해구', 'seohae-gu'), s('검단구', 'geomdan-gu'),
    s('미추홀구', 'michuhol-gu'), s('연수구', 'yeonsu-gu'), s('남동구', 'namdong-gu'), s('부평구', 'bupyeong-gu'),
    s('계양구', 'gyeyang-gu'), s('강화군', 'ganghwa-gun'), s('옹진군', 'ongjin-gun'),
  ],
  gyeonggi: [
    s('수원시', 'suwon-si', { subGu: ['장안구', '권선구', '팔달구', '영통구'] }),
    s('성남시', 'seongnam-si', { subGu: ['수정구', '중원구', '분당구'] }),
    s('고양시', 'goyang-si', { subGu: ['덕양구', '일산동구', '일산서구'] }),
    s('용인시', 'yongin-si', { subGu: ['처인구', '기흥구', '수지구'] }),
    s('안양시', 'anyang-si', { subGu: ['만안구', '동안구'] }),
    s('안산시', 'ansan-si', { subGu: ['상록구', '단원구'] }),
    s('부천시', 'bucheon-si', { subGu: ['원미구', '소사구', '오정구'], verify: '2024-01 일반구 재설치' }),
    s('화성시', 'hwaseong-si', { subGu: ['만세구', '효행구', '병점구', '동탄구'], verify: '2026 일반구 설치 예정이었음' }),
    s('의정부시', 'uijeongbu-si'), s('광명시', 'gwangmyeong-si'), s('평택시', 'pyeongtaek-si'),
    s('동두천시', 'dongducheon-si'), s('과천시', 'gwacheon-si'), s('구리시', 'guri-si'), s('남양주시', 'namyangju-si'),
    s('오산시', 'osan-si'), s('시흥시', 'siheung-si'), s('군포시', 'gunpo-si'), s('의왕시', 'uiwang-si'),
    s('하남시', 'hanam-si'), s('파주시', 'paju-si'), s('이천시', 'icheon-si'), s('안성시', 'anseong-si'),
    s('김포시', 'gimpo-si'), s('광주시', 'gwangju-si'), s('양주시', 'yangju-si'), s('포천시', 'pocheon-si'),
    s('여주시', 'yeoju-si'), s('연천군', 'yeoncheon-gun'), s('가평군', 'gapyeong-gun'), s('양평군', 'yangpyeong-gun'),
  ],
};

export interface Region { sido: SidoSlug; sigungu: string; sigunguName: string; subGu: string | null; dong: string | null }

/** Resolve sido/sigungu/subGu/dong from address text (plus optional sido/sigungu columns). */
export function resolveRegion(address: string, jibun = '', sidoCol = '', sigunguCol = ''): Region | null {
  const text = `${sidoCol} ${sigunguCol} ${address}`.replace(/\s+/g, ' ').trim();
  const sido = (Object.keys(SIDO) as SidoSlug[]).find((k) =>
    SIDO[k].aliases.some((a) => new RegExp(`(^|\\s)${a}(\\s|$)`).test(text)));
  if (!sido) return null;
  const tokens = text.split(' ');
  let sg: Sigungu | undefined;
  let subGu: string | null = null;
  for (let i = 0; i < tokens.length && !sg; i++) {
    sg = SIGUNGU[sido].find((x) => x.name === tokens[i]);
    if (sg?.subGu) subGu = sg.subGu.find((g) => tokens.includes(g)) ?? null;
  }
  const dongFrom = (s: string) => s.match(/(?:^|\s)([가-힣0-9]+(?:동|읍|면|가))(?=\s|$)/)?.[1] ?? null;
  const dong = dongFrom(jibun.replace(/\d+(-\d+)?\s*$/, '')) ?? address.match(/\(([가-힣0-9]+(?:동|가))[,)]/)?.[1] ?? tokens.find((t) => /^[가-힣0-9]+(읍|면)$/.test(t)) ?? null;
  if (!sg && sido === 'incheon') sg = legacyIncheon(tokens, dong);
  if (!sg) return null;
  return { sido, sigungu: sg.slug, sigunguName: sg.name, subGu, dong };
}

// 개편 전 구명으로 남아 있는 주소(원천 데이터 갱신 지연) → 법정동으로 새 구 판정
const YEONGJONG_DONGS = ['중산동', '운남동', '운서동', '운북동', '을왕동', '남북동', '덕교동', '무의동'];
const GEOMDAN_DONGS = ['마전동', '당하동', '원당동', '불로동', '대곡동', '오류동', '왕길동', '금곡동'];
function legacyIncheon(tokens: string[], dong: string | null): Sigungu | undefined {
  const by = (name: string) => SIGUNGU.incheon.find((x) => x.name === name);
  if (tokens.includes('남구')) return by('미추홀구');
  if (tokens.includes('중구')) return by(dong && YEONGJONG_DONGS.includes(dong) ? '영종구' : '제물포구');
  if (tokens.includes('동구')) return by('제물포구');
  if (tokens.includes('서구')) return by(dong && GEOMDAN_DONGS.includes(dong) ? '검단구' : '서해구');
  return undefined;
}

/** Page title rule incl. 일반구 names (e.g. "성남시(분당구·수정구·중원구) 무인민원발급기 위치·운영시간"). */
export function regionTitle(sido: SidoSlug, slug: string): string {
  const sg = SIGUNGU[sido].find((x) => x.slug === slug);
  if (!sg) throw new Error(`unknown region ${sido}/${slug}`);
  const gu = sg.subGu?.length ? `(${sg.subGu.join('·')})` : '';
  return `${sg.name}${gu} 무인민원발급기 위치·운영시간`;
}
