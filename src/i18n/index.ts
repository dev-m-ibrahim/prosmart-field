import { startAutoTranslate } from './autoTranslate';

export type Lang = 'ar' | 'en';
const KEY = 'prosmart_lang';

function read(): Lang {
  try {
    return localStorage.getItem(KEY) === 'en' ? 'en' : 'ar';
  } catch {
    return 'ar';
  }
}

/** Current UI language (fixed for the lifetime of the page — switching reloads the app). */
export const lang: Lang = read();
export const isEn = lang === 'en';
export const locale = isEn ? 'en-GB' : 'ar-EG';

/** t('عربي', 'English') — picks the string for the current language. */
export const t = (ar: string, en: string): string => (isEn ? en : ar);

export function setLang(l: Lang) {
  try {
    localStorage.setItem(KEY, l);
  } catch { /* ignore */ }
  location.reload();
}

export function initI18n() {
  document.documentElement.lang = lang;
  document.documentElement.dir = isEn ? 'ltr' : 'rtl';
  if (isEn) startAutoTranslate();
}
