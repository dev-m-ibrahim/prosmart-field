export type Role = 'admin' | 'technician' | 'storekeeper' | 'driver';

export interface Profile {
  id: string;
  full_name: string;
  phone: string | null;
  role: Role;
  is_active: boolean;
  job_title?: string | null; // cosmetic title, e.g. مهندس (an engineer is an admin with this title)
  is_owner?: boolean; // the owner: manages users/roles, sees the audit log
  can_whatsapp?: boolean; // WhatsApp confirm button (the owner can switch it off per user)
  can_manage_catalog?: boolean; // may add / edit / delete the survey device catalog (the owner always can)
  can_manage_orders?: boolean; // may edit / delete work orders (set by the owner admin)
}

export const roleLabel: Record<Role, string> = {
  admin: 'إداري',
  technician: 'فني',
  storekeeper: 'أمين مخزن',
  driver: 'سائق',
};

export const homePath = (role: Role): string =>
  role === 'admin' ? '/admin' : role === 'technician' ? '/tech' : role === 'driver' ? '/driver' : '/store';
