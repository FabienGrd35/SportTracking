import { Text, View } from 'react-native';
import { useTheme } from './theme.ts';

/** Rendu Markdown minimal (titres, listes, gras) pour les réponses de Claude. */
function Inline({ text, color, bold }: { text: string; color: string; bold?: boolean }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return (
    <Text style={{ color, fontSize: 15, lineHeight: 22, fontWeight: bold ? '700' : '400' }}>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**') ? (
          <Text key={i} style={{ fontWeight: '700' }}>{p.slice(2, -2)}</Text>
        ) : (
          p
        ),
      )}
    </Text>
  );
}

export function Markdown({ text }: { text: string }) {
  const t = useTheme();
  const lines = text.split('\n');
  return (
    <View style={{ gap: 4 }}>
      {lines.map((raw, i) => {
        const line = raw.trimEnd();
        if (!line.trim()) return <View key={i} style={{ height: 4 }} />;
        const h = line.match(/^#{1,4}\s+(.*)$/);
        if (h) return <Text key={i} style={{ color: t.text, fontSize: 17, fontWeight: '700', marginTop: 6 }}>{h[1].replace(/\*\*/g, '')}</Text>;
        const li = line.match(/^(\s*)([-*•]|\d+\.)\s+(.*)$/);
        if (li) {
          return (
            <View key={i} style={{ flexDirection: 'row', gap: 6, paddingLeft: li[1].length ? 14 : 0 }}>
              <Text style={{ color: t.muted, fontSize: 15, lineHeight: 22 }}>{/\d/.test(li[2]) ? li[2] : '•'}</Text>
              <View style={{ flex: 1 }}><Inline text={li[3]} color={t.text} /></View>
            </View>
          );
        }
        if (/^\|/.test(line) || /^-{3,}$/.test(line)) return <Text key={i} style={{ color: t.muted, fontSize: 13 }}>{line}</Text>;
        return <Inline key={i} text={line} color={t.text} />;
      })}
    </View>
  );
}
