/**
 * Tiny i18n core — no dependency, English-fallback by design.
 *
 * `Loc` is either a plain string (same in every language) or a per-language
 * map. `tr()` resolves it for the active language and falls back to English
 * (then to whatever exists) so a missing translation never blanks the UI.
 */
export type Lang = 'en' | 'hi';

export const LANGS: { id: Lang; label: string; short: string }[] = [
  { id: 'en', label: 'English', short: 'EN' },
  { id: 'hi', label: 'हिंदी', short: 'हि' },
];

export type Loc = string | Partial<Record<Lang, string>>;

/** Resolve a Loc for the active language, falling back to English. */
export function tr(value: Loc, lang: Lang): string {
  if (typeof value === 'string') return value;
  return value[lang] ?? value.en ?? Object.values(value)[0] ?? '';
}

/** Build a localized string. `loc('Buy', 'खरीदें')` */
export function loc(en: string, hi: string): Loc {
  return { en, hi };
}
