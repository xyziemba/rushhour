/** The shared 8-color palette. CSS custom properties live in shell.css (.c-<color>). */

export type Color = 'red' | 'orange' | 'yellow' | 'green' | 'teal' | 'blue' | 'purple' | 'pink';

export const COLORS: Color[] = ['red', 'orange', 'yellow', 'green', 'teal', 'blue', 'purple', 'pink'];

/** Shape shown alongside a color when "symbols" mode is on (color-blind aid). */
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
