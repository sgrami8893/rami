// Tabler Icons (@tabler/icons v3.24.0, MIT License, Copyright (c) 2020-2024 Paweł Kuna, https://tabler.io/icons).
// 필요한 것만 인라인 SVG로 포함. 라이선스 원문: public/licenses/tabler-icons-MIT.txt (사이트 /licenses/tabler-icons-MIT.txt)
// 키 이름은 사이트 내부용이며 Tabler 원본 파일명과 다를 수 있음.
export const ICONS = {
 "map-pin": "<path d=\"M9 11a3 3 0 1 0 6 0a3 3 0 0 0 -6 0\" /> <path d=\"M17.657 16.657l-4.243 4.243a2 2 0 0 1 -2.827 0l-4.244 -4.243a8 8 0 1 1 11.314 0z\" />",
 "clock": "<path d=\"M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0\" /> <path d=\"M12 7v5l3 3\" />",
 "navigation": "<path d=\"M12 18.5l7.265 2.463c.196 .077 .42 .032 .57 -.116a.548 .548 0 0 0 .134 -.572l-7.969 -17.275l-7.97 17.275c-.07 .2 -.017 .424 .135 .572c.15 .148 .374 .193 .57 .116l7.265 -2.463\" />",
 "chevron-right": "<path d=\"M9 6l6 6l-6 6\" />",
 "file-text": "<path d=\"M14 3v4a1 1 0 0 0 1 1h4\" /> <path d=\"M17 21h-10a2 2 0 0 1 -2 -2v-14a2 2 0 0 1 2 -2h7l5 5v11a2 2 0 0 1 -2 2z\" /> <path d=\"M9 9l1 0\" /> <path d=\"M9 13l6 0\" /> <path d=\"M9 17l6 0\" />",
 "accessibility": "<path d=\"M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0\" /> <path d=\"M10 16.5l2 -3l2 3m-2 -3v-2l3 -1m-6 0l3 1\" /> <circle cx=\"12\" cy=\"7.5\" r=\".5\" fill=\"currentColor\" />",
 "info": "<path d=\"M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0\" /> <path d=\"M12 9h.01\" /> <path d=\"M11 12h1v4h1\" />",
 "external-link": "<path d=\"M12 6h-6a2 2 0 0 0 -2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-6\" /> <path d=\"M11 13l9 -9\" /> <path d=\"M15 4h5v5\" />",
 "book-open": "<path d=\"M3 19a9 9 0 0 1 9 0a9 9 0 0 1 9 0\" /> <path d=\"M3 6a9 9 0 0 1 9 0a9 9 0 0 1 9 0\" /> <path d=\"M3 6l0 13\" /> <path d=\"M12 6l0 13\" /> <path d=\"M21 6l0 13\" />",
 "trash-2": "<path d=\"M4 7l16 0\" /> <path d=\"M10 11l0 6\" /> <path d=\"M14 11l0 6\" /> <path d=\"M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12\" /> <path d=\"M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3\" />",
 "square-parking": "<path d=\"M3 5a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v14a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2v-14z\" /> <path d=\"M10 16v-8h2.667c.736 0 1.333 .895 1.333 2s-.597 2 -1.333 2h-2.667\" />",
 "award": "<path d=\"M12 9m-6 0a6 6 0 1 0 12 0a6 6 0 1 0 -12 0\" /> <path d=\"M12 15l3.4 5.89l1.598 -3.233l3.598 .232l-3.4 -5.889\" /> <path d=\"M6.802 12l-3.4 5.89l3.598 -.233l1.598 3.232l3.4 -5.889\" />",
 "triangle-alert": "<path d=\"M12 9v4\" /> <path d=\"M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0z\" /> <path d=\"M12 16h.01\" />",
 "map": "<path d=\"M3 7l6 -3l6 3l6 -3v13l-6 3l-6 -3l-6 3v-13\" /> <path d=\"M9 4v13\" /> <path d=\"M15 7v13\" />",
 "search": "<path d=\"M10 10m-7 0a7 7 0 1 0 14 0a7 7 0 1 0 -14 0\" /> <path d=\"M21 21l-6 -6\" />"
} as const;
export type IconName = keyof typeof ICONS;
