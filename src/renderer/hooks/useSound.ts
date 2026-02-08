import { useState, useCallback, useMemo } from 'react';
import SoundManager, { type SoundName } from '../lib/sound-manager';

export function useSound() {
  const manager = useMemo(() => SoundManager.getInstance(), []);
  const [enabled, setEnabledState] = useState(() => manager.isEnabled());
  const [volume, setVolumeState] = useState(() => manager.getVolume());

  const play = useCallback(
    (name: SoundName) => {
      manager.play(name);
    },
    [manager],
  );

  const setEnabled = useCallback(
    (value: boolean) => {
      manager.setEnabled(value);
      setEnabledState(value);
    },
    [manager],
  );

  const setVolume = useCallback(
    (value: number) => {
      manager.setVolume(value);
      setVolumeState(manager.getVolume());
    },
    [manager],
  );

  return { play, enabled, setEnabled, volume, setVolume };
}
