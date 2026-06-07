import { create } from 'zustand';
import type { Lang, Loc } from '@/i18n/loc';
import { tr } from '@/i18n/loc';
import { t as translate, type UIKey } from '@/i18n/strings';

const LANG_KEY = 'cashflow-reborn:lang';

function loadLang(): Lang {
  if (typeof localStorage === 'undefined') return 'en';
  return localStorage.getItem(LANG_KEY) === 'hi' ? 'hi' : 'en';
}

interface LangStore {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggleLang: () => void;
}

export const useLangStore = create<LangStore>((set, get) => ({
  lang: loadLang(),
  setLang: (l) => {
    if (typeof localStorage !== 'undefined') localStorage.setItem(LANG_KEY, l);
    set({ lang: l });
  },
  toggleLang: () => get().setLang(get().lang === 'en' ? 'hi' : 'en'),
}));

/** Hook returning the active language plus bound `t` (UI keys) and `L` (Loc). */
export function useT() {
  const lang = useLangStore((s) => s.lang);
  return {
    lang,
    t: (key: UIKey, params?: Record<string, string | number>) => translate(key, lang, params),
    L: (value: Loc) => tr(value, lang),
  };
}
