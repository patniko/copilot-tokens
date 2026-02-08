import Store from 'electron-store';
import { DATA_DIR } from './data-dir';
import type { MilestonePack, SoundPack, ThemePack, PackStoreSchema } from '../renderer/lib/pack-types';

const store = new Store<PackStoreSchema>({
  name: 'packs',
  cwd: DATA_DIR,
  defaults: {
    milestonePacks: [],
    soundPacks: [],
    themePacks: [],
  },
});

// ── Milestone Packs ──

export function getMilestonePacks(): MilestonePack[] {
  return store.get('milestonePacks');
}

export function saveMilestonePack(pack: MilestonePack): void {
  const packs = store.get('milestonePacks');
  const idx = packs.findIndex((p) => p.id === pack.id);
  if (idx >= 0) {
    packs[idx] = pack;
  } else {
    packs.push(pack);
  }
  store.set('milestonePacks', packs);
}

export function deleteMilestonePack(id: string): void {
  store.set('milestonePacks', store.get('milestonePacks').filter((p) => p.id !== id));
}

export function setMilestonePackActive(id: string, active: boolean): void {
  const packs = store.get('milestonePacks');
  const pack = packs.find((p) => p.id === id);
  if (pack) {
    pack.active = active;
    store.set('milestonePacks', packs);
  }
}

// ── Sound Packs ──

export function getSoundPacks(): SoundPack[] {
  return store.get('soundPacks');
}

export function saveSoundPack(pack: SoundPack): void {
  const packs = store.get('soundPacks');
  const idx = packs.findIndex((p) => p.id === pack.id);
  if (idx >= 0) {
    packs[idx] = pack;
  } else {
    packs.push(pack);
  }
  store.set('soundPacks', packs);
}

export function deleteSoundPack(id: string): void {
  store.set('soundPacks', store.get('soundPacks').filter((p) => p.id !== id));
}

export function setSoundPackActive(id: string): void {
  const packs = store.get('soundPacks').map((p) => ({ ...p, active: p.id === id }));
  store.set('soundPacks', packs);
}

// ── Theme Packs ──

export function getThemePacks(): ThemePack[] {
  return store.get('themePacks');
}

export function saveThemePack(pack: ThemePack): void {
  const packs = store.get('themePacks');
  const idx = packs.findIndex((p) => p.id === pack.id);
  if (idx >= 0) {
    packs[idx] = pack;
  } else {
    packs.push(pack);
  }
  store.set('themePacks', packs);
}

export function deleteThemePack(id: string): void {
  store.set('themePacks', store.get('themePacks').filter((p) => p.id !== id));
}
