import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';

interface ApkInstallerPlugin {
  canInstall(): Promise<{ value: boolean }>;
  openSettings(): Promise<void>;
  downloadAndInstall(o: { url: string }): Promise<void>;
  addListener(ev: 'progress', cb: (e: { pct: number }) => void): Promise<PluginListenerHandle>;
}
const Installer = registerPlugin<ApkInstallerPlugin>('ApkInstaller');

export const BUILD = Number(import.meta.env.VITE_BUILD_NUMBER || 0);
const REPO = import.meta.env.VITE_GH_REPO || '';
export const canSelfUpdate = Capacitor.getPlatform() === 'android' && BUILD > 0 && !!REPO;

export interface UpdateInfo {
  build: number;
  url: string;
}

/** latest Release is rebuilt on every push; its title carries the build number */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  if (!canSelfUpdate || !navigator.onLine) return null;
  try {
    const r = await fetch(`https://api.github.com/repos/${REPO}/releases/tags/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
      cache: 'no-store',
    });
    if (!r.ok) return null;
    const j = await r.json();
    const build = Number(/build\s*(\d+)/i.exec(String(j.name ?? ''))?.[1] ?? 0);
    const asset = (j.assets ?? []).find((a: { name: string }) => a.name.toLowerCase().endsWith('.apk'));
    if (!asset || build <= BUILD) return null;
    return { build, url: asset.browser_download_url as string };
  } catch {
    return null;
  }
}

export type InstallResult = 'started' | 'need_permission';

export async function installUpdate(url: string, onProgress: (pct: number) => void): Promise<InstallResult> {
  const { value } = await Installer.canInstall();
  if (!value) {
    await Installer.openSettings();
    return 'need_permission';
  }
  const h = await Installer.addListener('progress', (e) => onProgress(e.pct));
  try {
    await Installer.downloadAndInstall({ url });
  } finally {
    h.remove();
  }
  return 'started';
}
