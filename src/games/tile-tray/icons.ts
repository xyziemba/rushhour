/** 12 simple icons (24×24 viewBox), each with its own color so shape and color both identify it. */
export const ICONS: { name: string; color: string; svg: string }[] = [
  { name: 'Sun', color: 'var(--orange)', svg: '<circle cx="12" cy="12" r="5"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4M4.2 4.2l2.8 2.8M17 17l2.8 2.8M4.2 19.8 7 17M17 7l2.8-2.8" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>' },
  { name: 'Heart', color: 'var(--red)', svg: '<path d="M12 21s-8-5.3-8-11.2A4.6 4.6 0 0 1 12 6.6a4.6 4.6 0 0 1 8 3.2C20 15.7 12 21 12 21z"/>' },
  { name: 'Leaf', color: 'var(--green)', svg: '<path d="M4 20C4 10 10 4 21 3c0 11-6 17-15 17z"/><path d="M5 19 15 9" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>' },
  { name: 'Drop', color: 'var(--blue)', svg: '<path d="M12 2s7 8 7 13a7 7 0 0 1-14 0c0-5 7-13 7-13z"/>' },
  { name: 'Star', color: 'var(--yellow)', svg: '<path d="m12 2 3 6.6 7.2.8-5.4 4.9 1.5 7.1L12 17.8 5.7 21.4l1.5-7.1L1.8 9.4 9 8.6z"/>' },
  { name: 'Moon', color: 'var(--purple)', svg: '<path d="M15 2a10 10 0 1 0 7 15A8 8 0 0 1 15 2z"/>' },
  { name: 'Bolt', color: 'var(--teal)', svg: '<path d="M13 1 4 14h6l-1 9 9-13h-6z"/>' },
  { name: 'Flower', color: 'var(--pink)', svg: '<circle cx="12" cy="6" r="4"/><circle cx="18" cy="12" r="4"/><circle cx="12" cy="18" r="4"/><circle cx="6" cy="12" r="4"/><circle cx="12" cy="12" r="3" fill="#fff"/>' },
  { name: 'Square', color: 'var(--blue-d)', svg: '<rect x="4" y="4" width="16" height="16" rx="3"/>' },
  { name: 'Triangle', color: 'var(--green-d)', svg: '<path d="M12 3 22 20H2z"/>' },
  { name: 'Ring', color: 'var(--red-d)', svg: '<circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" stroke-width="4"/>' },
  { name: 'Cross', color: 'var(--orange-d)', svg: '<path d="M9 2h6v7h7v6h-7v7H9v-7H2V9h7z"/>' },
];

export const iconSvg = (i: number): string =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor" style="color:${ICONS[i]!.color}">${ICONS[i]!.svg}</svg>`;
