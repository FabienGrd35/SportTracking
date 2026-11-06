import { addDays, weekStart } from './dates.ts';
import { aggregateDays } from './energy.ts';
import type { Analysis } from './insights.ts';
import { liftTrends, weeklyTraining } from './training.ts';
import { dailyWeights } from './trend.ts';
import type { FoodEntry, ISODate, Profile, WeightEntry, Workout } from './types.ts';

/**
 * Résumé compact des données envoyé à Claude.
 * Tout l'historique en moyennes hebdomadaires (≈ 2 ans ≈ 3 000 tokens) + les 28 derniers jours
 * au détail : assez pour analyser les tendances sans envoyer chaque ligne.
 */

const r = (n: number) => Math.round(n);
const r1 = (n: number) => Math.round(n * 10) / 10;
const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : NaN);
const cell = (n: number, f: (n: number) => number = r) => (Number.isFinite(n) ? String(f(n)) : '');

const GOAL: Record<Profile['goal'], string> = { cut: 'sèche', maintain: 'maintien', bulk: 'prise de masse' };

export function buildDataContext(
  profile: Profile,
  weights: WeightEntry[],
  foods: FoodEntry[],
  workouts: Workout[],
  analysis: Analysis,
  end: ISODate,
): string {
  const days = aggregateDays(foods);
  const w = dailyWeights(weights);
  const train = weeklyTraining(workouts);
  const out: string[] = [];

  out.push(`# Profil
- Sexe : ${profile.sex === 'male' ? 'homme' : 'femme'}, né en ${profile.birthYear}, ${profile.heightCm} cm
- Objectif déclaré : ${GOAL[profile.goal]}, rythme visé ${profile.targetRatePctPerWeek} %/semaine
- Date du jour : ${end}`);

  out.push(`# Indicateurs calculés par l'appli
- Poids tendance : ${analysis.currentTrendKg ? `${r1(analysis.currentTrendKg)} kg` : 'inconnu'}
- Rythme : ${analysis.weeklyRateKg !== null ? `${r1(analysis.weeklyRateKg * 100) / 100} kg/semaine` : 'inconnu'}
- Dépense : ${analysis.tdee ? `${r(analysis.tdee)} kcal/j (${analysis.tdeeSource === 'measured' ? 'mesurée sur 28 j' : 'formule'})` : 'inconnue'}
- Objectifs : ${analysis.targets ? `${analysis.targets.kcal} kcal, P ${analysis.targets.proteinG} g, G ${analysis.targets.carbsG} g, L ${analysis.targets.fatG} g` : 'non calculés'}
- Alertes automatiques : ${analysis.insights.map((i) => `[${i.level}] ${i.title}`).join(' ; ') || 'aucune'}`);

  // Moyennes hebdomadaires sur tout l'historique
  const weeks = new Set<ISODate>([
    ...days.map((d) => weekStart(d.date)),
    ...w.map((x) => weekStart(x.date)),
    ...train.map((t) => t.week),
  ]);
  if (weeks.size) {
    out.push(`# Historique hebdomadaire (moyennes ; semaine = lundi)
semaine;jours_saisis;kcal;prot_g;gluc_g;lip_g;poids_kg;gras_pct;seances;series;tonnage_kg`);
    for (const wk of [...weeks].sort()) {
      const end7 = addDays(wk, 6);
      const ds = days.filter((d) => d.date >= wk && d.date <= end7);
      const ws = w.filter((x) => x.date >= wk && x.date <= end7);
      const t = train.find((x) => x.week === wk);
      const fat = ws.map((x) => x.bodyFatPct).filter((x): x is number => x !== undefined);
      out.push([
        wk,
        ds.length,
        cell(avg(ds.map((d) => d.kcal))),
        cell(avg(ds.map((d) => d.proteinG))),
        cell(avg(ds.map((d) => d.carbsG))),
        cell(avg(ds.map((d) => d.fatG))),
        cell(avg(ws.map((x) => x.weightKg)), r1),
        cell(avg(fat), r1),
        t?.sessions ?? 0,
        t?.workingSets ?? 0,
        t ? r(t.volumeKg) : 0,
      ].join(';'));
    }
  }

  // 28 derniers jours au détail
  const start = addDays(end, -27);
  const recent: string[] = [];
  for (let i = 0; i < 28; i++) {
    const d = addDays(start, i);
    const n = days.find((x) => x.date === d);
    const p = w.find((x) => x.date === d);
    const s = workouts.filter((x) => x.date === d).map((x) => `${x.title} (${x.workingSets} séries)`).join(' + ');
    if (n || p || s) {
      recent.push([d, n ? r(n.kcal) : '', n ? r(n.proteinG) : '', n ? r(n.carbsG) : '', n ? r(n.fatG) : '', p ? p.weightKg : '', s].join(';'));
    }
  }
  if (recent.length) {
    out.push(`# 28 derniers jours (détail)
date;kcal;prot_g;gluc_g;lip_g;poids_kg;seance`);
    out.push(...recent);
  }

  const lifts = liftTrends(workouts, end, 8);
  if (lifts.length) {
    out.push(`# Force estimée (1RM Epley) : 4 dernières semaines vs 4 précédentes
${lifts.map((l) => `- ${l.name} : ${r1(l.previousE1rm)} → ${r1(l.recentE1rm)} kg (${l.changePct >= 0 ? '+' : ''}${r1(l.changePct)} %)`).join('\n')}`);
  }

  const missing = [
    !days.length && 'nutrition',
    !w.length && 'poids',
    !workouts.length && 'entraînements Hevy',
  ].filter(Boolean);
  if (missing.length) out.push(`# Données absentes\n${missing.join(', ')} : non disponibles dans l'appli.`);

  return out.join('\n\n');
}

export const COACH_SYSTEM_PROMPT = `Tu es le coach nutrition et musculation personnel de l'utilisateur, dans son appli de suivi.
Tu reçois ses données (nutrition, poids, entraînements Hevy) sous forme de tableaux, plus les indicateurs que l'appli a calculés.

Ta mission : expliquer ce qui se passe sur les grandes tendances, en français, tutoiement, de façon directe.
- Appuie chaque affirmation sur les chiffres fournis (cite semaines, moyennes, écarts).
- Croise les sources : calories vs évolution du poids (1 kg ≈ 7 700 kcal), protéines en g/kg, force et volume vs déficit ou surplus.
- Distingue ce qui est établi par les données de ce qui est une hypothèse, et dis ce qu'il manquerait pour trancher.
- Si une donnée est absente, dis-le et n'invente rien.
- Challenge l'utilisateur quand ses choix ont une faille évidente.
- Termine une analyse par 2 ou 3 actions concrètes et chiffrées, classées par impact.
- Format lisible sur téléphone : titres courts, listes, pas de tableaux larges.
- Tu n'es pas médecin : en cas de signe inquiétant (perte très rapide, apports très bas), recommande un avis médical.`;
