/**
 * <script type="application/ld+json"> 안에 넣을 JSON 문자열.
 * 공공데이터 텍스트에 "</script>"나 "<!--"가 섞여도 스크립트 블록을 벗어나지 못하도록 < > & 와 줄 구분자를 유니코드 이스케이프한다.
 * (JSON 파서에는 같은 문자열로 읽힘)
 */
export const safeJsonLd = (obj: unknown) =>
  JSON.stringify(obj).replace(/[<>&\u2028\u2029]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);

import type { Faq } from './faq.ts';
import type { Kiosk } from './data.ts';

export const faqPage = (items: Faq[]) => ({
  '@context': 'https://schema.org', '@type': 'FAQPage',
  mainEntity: items.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
});

export const breadcrumb = (items: { name: string; url: string }[]) => ({
  '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: it.url })),
});

export const itemList = (items: { name: string; url: string }[]) => ({
  '@context': 'https://schema.org', '@type': 'ItemList',
  itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, url: it.url })),
});

const DAYS = {
  weekday: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
  sat: ['Saturday'],
  sun: ['Sunday'],
} as const;

export function place(k: Kiosk, url: string) {
  const spec = (Object.keys(DAYS) as (keyof typeof DAYS)[]).flatMap((d) => {
    const r = k.hours[d];
    if (!r) return [];
    return [{ '@type': 'OpeningHoursSpecification', dayOfWeek: DAYS[d], opens: r[0], closes: r[1] === '24:00' ? '23:59' : r[1] }];
  });
  return {
    '@context': 'https://schema.org', '@type': 'Place', name: k.name, url,
    address: { '@type': 'PostalAddress', streetAddress: k.roadAddress, addressCountry: 'KR' },
    ...(k.lat !== null ? { geo: { '@type': 'GeoCoordinates', latitude: k.lat, longitude: k.lng } } : {}),
    ...(spec.length ? { openingHoursSpecification: spec } : {}),
    ...(k.phone ? { telephone: k.phone } : {}),
  };
}

export const article = (a: { headline: string; description: string; url: string; published: string; modified: string; publisher: string; citations: string[] }) => ({
  '@context': 'https://schema.org', '@type': 'Article',
  headline: a.headline, description: a.description, datePublished: a.published, dateModified: a.modified,
  mainEntityOfPage: a.url, inLanguage: 'ko-KR',
  author: { '@type': 'Organization', name: a.publisher }, publisher: { '@type': 'Organization', name: a.publisher },
  citation: a.citations,
});
