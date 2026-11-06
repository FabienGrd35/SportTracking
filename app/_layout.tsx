import { Tabs } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useTheme } from '../src/components/theme.ts';
import { StoreProvider } from '../src/state/store.tsx';
import { useAutoSync } from '../src/state/useAutoSync.ts';

function AutoSync() {
  useAutoSync();
  return null;
}

const icon = (glyph: string) => ({ color }: { color: string }) => <Text style={{ color, fontSize: 18 }}>{glyph}</Text>;

export default function RootLayout() {
  const t = useTheme();
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <AutoSync />
        <StatusBar style="auto" />
        <Tabs
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: t.accent,
            tabBarInactiveTintColor: t.muted,
            tabBarStyle: { backgroundColor: t.card, borderTopColor: t.border },
          }}
        >
          <Tabs.Screen name="index" options={{ title: 'Tendances', tabBarIcon: icon('📈') }} />
          <Tabs.Screen name="nutrition" options={{ title: 'Nutrition', tabBarIcon: icon('🍽') }} />
          <Tabs.Screen name="poids" options={{ title: 'Poids', tabBarIcon: icon('⚖️') }} />
          <Tabs.Screen name="entrainement" options={{ title: 'Muscu', tabBarIcon: icon('🏋️') }} />
          <Tabs.Screen name="reglages" options={{ title: 'Réglages', tabBarIcon: icon('⚙️') }} />
        </Tabs>
      </StoreProvider>
    </SafeAreaProvider>
  );
}
