import { View } from 'react-native';
import { InsightCard } from '../src/components/InsightCard.tsx';
import { MacroBars } from '../src/components/MacroBars.tsx';
import { Card, fmt, Muted, Row, Screen, Stat, Title } from '../src/components/ui.tsx';
import { today } from '../src/lib/dates.ts';
import { aggregateDays } from '../src/lib/energy.ts';
import { useStore } from '../src/state/store.tsx';
import { useAnalysis } from '../src/state/useAnalysis.ts';

export default function Dashboard() {
  const { state } = useStore();
  const a = useAnalysis();
  const todayFood = aggregateDays(state.foods).find((d) => d.date === today());
  const empty = !state.weights.length && !state.foods.length && !state.workouts.length;

  return (
    <Screen>
      <Title>Tendances</Title>
      <Card>
        <Row>
          <Stat label="Poids (tendance)" value={a.currentTrendKg ? `${fmt(a.currentTrendKg, 1)} kg` : '—'} />
          <Stat
            label="Rythme"
            value={a.weeklyRateKg !== null ? `${a.weeklyRateKg >= 0 ? '+' : ''}${fmt(a.weeklyRateKg, 2)}` : '—'}
            sub="kg / semaine"
          />
          <Stat
            label="Dépense"
            value={a.tdee ? fmt(a.tdee) : '—'}
            sub={a.tdeeSource === 'measured' ? 'kcal · mesurée' : a.tdeeSource === 'formula' ? 'kcal · formule' : 'kcal'}
          />
        </Row>
      </Card>

      <Card title="Aujourd'hui">
        <MacroBars
          kcal={todayFood?.kcal ?? 0}
          proteinG={todayFood?.proteinG ?? 0}
          carbsG={todayFood?.carbsG ?? 0}
          fatG={todayFood?.fatG ?? 0}
          targets={a.targets}
        />
      </Card>

      {empty ? (
        <Card title="Pour commencer">
          <Muted>
            1. Réglages : renseigne ton profil et ta clé API Hevy.{'\n'}
            2. Poids : importe l'export CSV de l'appli Renpho.{'\n'}
            3. Nutrition : saisis tes repas (ou le total de la journée).{'\n'}
            Les analyses apparaissent dès qu'il y a assez de données.
          </Muted>
        </Card>
      ) : (
        <View style={{ gap: 10 }}>
          {a.insights.map((i) => (
            <InsightCard key={i.id} insight={i} />
          ))}
        </View>
      )}
    </Screen>
  );
}
