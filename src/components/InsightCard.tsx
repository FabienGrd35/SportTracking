import { Text, View } from 'react-native';
import type { Insight } from '../lib/types.ts';
import { useTheme } from './theme.ts';

export function InsightCard({ insight }: { insight: Insight }) {
  const t = useTheme();
  const color = insight.level === 'good' ? t.good : insight.level === 'warn' ? t.warn : t.info;
  const icon = insight.level === 'good' ? '✓' : insight.level === 'warn' ? '!' : 'i';
  return (
    <View style={{ flexDirection: 'row', gap: 10, backgroundColor: t.card, borderRadius: 14, padding: 14, borderLeftWidth: 4, borderLeftColor: color }}>
      <Text style={{ color, fontWeight: '800', fontSize: 16, width: 14, textAlign: 'center' }}>{icon}</Text>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ color: t.text, fontWeight: '700', fontSize: 15 }}>{insight.title}</Text>
        <Text style={{ color: t.muted, fontSize: 13, lineHeight: 19 }}>{insight.body}</Text>
      </View>
    </View>
  );
}
