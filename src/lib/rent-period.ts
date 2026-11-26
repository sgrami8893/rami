import { stats } from './rent.ts';
/** '2025.11~2026.10' */
export const periodShort = () => (stats.from ? `${stats.from.replace('-', '.')}~${stats.to.replace('-', '.')}` : '');
