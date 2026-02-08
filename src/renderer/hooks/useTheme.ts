import { useContext } from 'react';
import { ThemeContext } from '../lib/themes';

export function useTheme() {
  return useContext(ThemeContext);
}
