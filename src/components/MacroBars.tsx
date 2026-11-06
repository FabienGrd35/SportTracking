import { Text, View } from 'react-native';
import { fmt } from './ui.tsx';
import { useTheme } from './theme.ts';

type Macro = { label: string; value: number; target?: number; unit: string; color: string };

export function MacroBars({ kcal, proteinG, carbsG, fatG, targets }: {
  kcal: number; proteinG: number; carbsG: number; fatG: number;
  targets?: { kcal: number; proteinG: number; carbsG: number; fatG: number } | null;
}) {
  const t = useTheme();
  const rows: Macro[] = [
    { label: 'Calories', value: kcal, target: targets?.kcal, unit: 'kcal', color: t.text },
    { label: 'Protéines', value: proteinG, target: targets?.proteinG, unit: 'g', color: t.protein },
    { label: 'Glucides', value: carbsG, target: targets?.carbsG, unit: 'g', color: t.carbs },
    { label: 'Lipides', value: fatG, target: targets?.fatG, unit: 'g', color: t.fat },
  ];
  return (
    <View style={{ gap: 10 }}>
      {rows.map((m) => {
        const pct = m.target ? Math.min(1.2, m.value / m.target) : 0;
        return (
          <View key={m.label}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: t.text, fontWeight: '600' }}>{m.label}</Text>
              <Text style={{ color: t.muted }}>
                {fmt(m.value)}{m.target ? ` / ${fmt(m.target)}` : ''} {m.unit}
              </Text>
            </View>
            <View style={{ height: 8, borderRadius: 4, backgroundColor: t.border, marginTop: 4, overflow: 'hidden' }}>
              <View style={{ width: `${Math.min(100, pct * 100)}%`, height: 8, backgroundColor: pct > 1.1 ? t.warn : m.color }} />
            </View>
          </View>
        );
      })}
    </View>
  );
}
