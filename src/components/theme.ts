import { useColorScheme } from 'react-native';

const light = {
  bg: '#F4F5F7', card: '#FFFFFF', text: '#15171A', muted: '#6B7280', border: '#E5E7EB',
  accent: '#2563EB', good: '#16A34A', warn: '#D97706', info: '#2563EB',
  protein: '#DC2626', carbs: '#2563EB', fat: '#CA8A04', trend: '#2563EB', raw: '#9CA3AF',
};
const dark: typeof light = {
  bg: '#0D0F12', card: '#171A1F', text: '#F3F4F6', muted: '#9CA3AF', border: '#262A31',
  accent: '#60A5FA', good: '#4ADE80', warn: '#FBBF24', info: '#60A5FA',
  protein: '#F87171', carbs: '#60A5FA', fat: '#FACC15', trend: '#60A5FA', raw: '#6B7280',
};

export type Theme = typeof light;
export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}
