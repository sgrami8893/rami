// 주차장 v2 위치 줄(2026-11-26 'UX 처음부터'): 시·도 › 시·군·구 › 동. parkingNav 자료를 PlaceBar 모양으로 바꾼다.
import { parkingNav, SIDOS, sidoShort, parkingPath } from './parking.ts';
import type { PlaceLevel } from '../components/v2/PlaceBar.astro';
import type { SidoSlug } from '../../scripts/lib/regions.ts';
export function parkingPlace(sido?: SidoSlug, sg?: string | null, dong?: string | null): PlaceLevel[] {
  const out: PlaceLevel[] = [{ label: sido ? sidoShort(sido) : '시·도', items: SIDOS.map((s) => ({ label: sidoShort(s), href: parkingPath(s) })), all: { label: '주차장 처음', href: '/parking/' } }];
  if (!sido) return out;
  const nav = parkingNav(sido, sg, dong);
  const [sAll, ...sggs] = nav.sggs;
  out.push({ label: nav.label.sgg ?? '시·군·구', items: sggs.map((x) => ({ label: x.label, href: x.href, meta: (x as { meta?: string }).meta })), all: { label: sAll.label, href: sAll.href } });
  if (!sg || nav.dongs.length < 2) return out;
  const [dAll, ...ds] = nav.dongs;
  out.push({ label: dong ?? '동', items: ds.map((x) => ({ label: x.label, href: x.href, meta: (x as { meta?: string }).meta })), all: { label: dAll.label, href: dAll.href } });
  return out;
}
