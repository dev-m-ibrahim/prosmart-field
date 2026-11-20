import { Languages } from 'lucide-react';
import { lang, setLang } from '../i18n';

export default function LangButton() {
  return (
    <button
      type="button"
      onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
      className="flex items-center gap-1 rounded-lg border border-navy-600 px-2.5 py-1.5 text-sm"
    >
      <Languages size={16} />
      <span className="text-xs">{lang === 'ar' ? 'EN' : 'ع'}</span>
    </button>
  );
}
