import type { Color } from '../engine/types';

/** Shape shown on vehicles/passengers when "symbols" mode is on (color-blind aid). */
export const SYMBOL: Record<Color, string> = {
  red: '●',
  orange: '▲',
  yellow: '■',
  green: '◆',
  teal: '✚',
  blue: '★',
  purple: '♥',
  pink: '✿',
};

export const COLOR_NAME: Record<Color, string> = {
  red: 'Red',
  orange: 'Orange',
  yellow: 'Yellow',
  green: 'Green',
  teal: 'Teal',
  blue: 'Blue',
  purple: 'Purple',
  pink: 'Pink',
};
