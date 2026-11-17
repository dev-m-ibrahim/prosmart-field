import { supabase } from './supabase';

export interface Cat {
  id: string;
  parent_id: string | null;
  name: string;
}

export async function loadCats(): Promise<Cat[]> {
  const { data } = await supabase.from('categories').select('id,parent_id,name').order('name');
  return (data ?? []) as Cat[];
}

export const childrenOf = (cats: Cat[], pid: string | null) => cats.filter((c) => c.parent_id === pid);

/** root → ... → id */
export function pathOf(cats: Cat[], id: string | null): Cat[] {
  const out: Cat[] = [];
  let cur = id ? cats.find((c) => c.id === id) : undefined;
  while (cur) {
    out.unshift(cur);
    cur = cur.parent_id ? cats.find((c) => c.id === cur!.parent_id) : undefined;
  }
  return out;
}

/** the category itself + every sub-category under it */
export function withDescendants(cats: Cat[], id: string): Set<string> {
  const s = new Set<string>([id]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const c of cats) if (c.parent_id && s.has(c.parent_id) && !s.has(c.id)) (s.add(c.id), (grew = true));
  }
  return s;
}

export async function addCat(parent_id: string | null, name: string): Promise<{ id?: string; error?: string }> {
  const { data, error } = await supabase.from('categories').insert({ parent_id, name: name.trim() }).select('id').single();
  if (error) return { error: error.code === '23505' ? 'الفئة دي موجودة بالفعل في نفس المكان' : error.message };
  return { id: data.id };
}
