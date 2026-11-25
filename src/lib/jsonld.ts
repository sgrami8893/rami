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
