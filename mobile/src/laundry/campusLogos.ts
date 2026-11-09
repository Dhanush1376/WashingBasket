import type { ImageSourcePropType } from 'react-native';

export const CAMPUS_LOGOS: Record<string, ImageSourcePropType> = {
  lpu: require('../../assets/logos/lpu.png'),
  nitj: require('../../assets/logos/nitj.png'),
};

export function getCampusLogo(loc?: { id?: string; code?: string; name?: string } | null): ImageSourcePropType | null {
  if (!loc) return null;
  const id = (loc.id || '').toLowerCase();
  const code = (loc.code || '').toLowerCase();
  const name = (loc.name || '').toLowerCase();

  if (id === 'loc-lpu' || code === 'lpu' || name.includes('lovely') || name.includes('lpu')) {
    return CAMPUS_LOGOS.lpu;
  }
  if (id === 'loc-nit' || code === 'nitj' || code === 'nit' || name.includes('nit')) {
    return CAMPUS_LOGOS.nitj;
  }
  return null;
}

