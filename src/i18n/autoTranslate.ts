import { EN, PARTS, PATTERNS } from './en';

// English mode for the screens written in Arabic before the app was bilingual:
// every Arabic text node / placeholder / dialog is looked up in the dictionary (exact match, then patterns,
// then a few safe fragments). Anything not in the dictionary simply stays Arabic.
const AR = /[\u0600-\u06FF]/;
const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
const PATS = PATTERNS.map(([re, to]) => [new RegExp(re), to] as const);

export function tr(s: string): string {
  if (!AR.test(s)) return s;
  const lead = /^\s*/.exec(s)![0];
  const trail = /\s*$/.exec(s)![0];
  const core = s.trim();
  if (!core) return s;
  const hit = EN[core] ?? (core.endsWith(':') ? EN[core.slice(0, -1).trim() + ':'] : undefined);
  if (hit !== undefined) return lead + hit + trail;
  for (const [re, to] of PATS) if (re.test(core)) return lead + core.replace(re, to) + trail;
  let out = s;
  for (const [a, b] of PARTS) if (out.includes(a)) out = out.split(a).join(b);
  return out;
}

function fixAttrs(el: Element) {
  for (const a of ATTRS) {
    const v = el.getAttribute(a);
    if (v && AR.test(v)) {
      const o = tr(v);
      if (o !== v) el.setAttribute(a, o);
    }
  }
}

function walk(n: Node) {
  if (n.nodeType === 3) {
    if (n.parentElement?.tagName === 'TEXTAREA') return; // never touch what the user typed
    const v = n.nodeValue;
    if (v && AR.test(v)) {
      const o = tr(v);
      if (o !== v) n.nodeValue = o;
    }
    return;
  }
  if (n.nodeType !== 1) return;
  const el = n as Element;
  if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return;
  fixAttrs(el);
  el.childNodes.forEach(walk);
}

export function startAutoTranslate() {
  const root = document.documentElement;
  walk(root);
  new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'childList') m.addedNodes.forEach(walk);
      else if (m.type === 'characterData') walk(m.target);
      else if (m.type === 'attributes') fixAttrs(m.target as Element);
    }
  }).observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });

  const c = window.confirm.bind(window);
  const a = window.alert.bind(window);
  const p = window.prompt.bind(window);
  window.confirm = (m?: string) => c(m ? tr(m) : m);
  window.alert = (m?: unknown) => a(typeof m === 'string' ? tr(m) : m);
  window.prompt = (m?: string, d?: string) => p(m ? tr(m) : m, d);
}
