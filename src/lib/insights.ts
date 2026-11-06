import { addDays, parseISODate } from './dates.ts';
import { adaptiveTdee, aggregateDays, formulaTdee, macroTargets, type MacroTargets } from './energy.ts';
import { liftTrends, periodTotals } from './training.ts';
import { slope, weeklyRateKg, weightTrend } from './trend.ts';
import { daysBetween } from './dates.ts';
import type { FoodEntry, ISODate, Insight, Profile, WeightEntry, Workout } from './types.ts';

export type Analysis = {
  currentTrendKg: number | null;
  weeklyRateKg: number | null;
  tdee: number | null;
  tdeeSource: 'measured' | 'formula' | null;
  targets: MacroTargets | null;
  insights: Insight[];
};

const r0 = (n: number) => Math.round(n);
const r1 = (n: number) => (Math.round(n * 10) / 10).toFixed(1).replace('.', ',');
const fmtKcal = (n: number) => `${r0(n).toLocaleString('fr-FR')} kcal`;
const signed = (n: number, digits = 1) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(digits).replace('.', ',')}`;

export function analyze(
  profile: Profile,
  weights: WeightEntry[],
  foods: FoodEntry[],
  workouts: Workout[],
  end: ISODate,
): Analysis {
  const insights: Insight[] = [];
  const trend = weightTrend(weights.filter((w) => w.date <= end));
  const current = trend.length ? trend[trend.length - 1].trend : null;
  const rate = weeklyRateKg(trend);
  const days = aggregateDays(foods);

  // --- Dépense énergétique -------------------------------------------------
  const measured = adaptiveTdee(days, weights, end);
  let tdee: number | null = null;
  let tdeeSource: Analysis['tdeeSource'] = null;
  if (measured) {
    tdee = measured.tdee;
    tdeeSource = 'measured';
    insights.push({
      id: 'tdee-measured',
      level: 'info',
      title: `Ta dépense réelle ≈ ${fmtKcal(measured.tdee)}/jour`,
      body:
        `Sur ${measured.windowDays} jours, tu as mangé en moyenne ${fmtKcal(measured.avgIntake)} ` +
        `(${measured.loggedDays} jours saisis) et ton poids a varié de ${signed(measured.weeklyChangeKg, 2)} kg/semaine. ` +
        `Comme 1 kg ≈ 7 700 kcal, on en déduit ta dépense réelle. Elle est plus fiable que n'importe quelle formule, ` +
        `à condition que la saisie soit complète (huile, sauces, boissons…).`,
    });
  } else if (current && profile) {
    tdee = formulaTdee(profile, current);
    tdeeSource = 'formula';
    insights.push({
      id: 'tdee-formula',
      level: 'info',
      title: `Dépense estimée ≈ ${fmtKcal(tdee)}/jour (formule)`,
      body:
        `Pas encore assez de données pour mesurer ta dépense réelle : il faut ~4 semaines avec au moins ` +
        `60 % des journées alimentaires saisies et 8 pesées. En attendant on utilise Mifflin-St Jeor × niveau d'activité, ` +
        `qui peut se tromper de ±10–15 %.`,
    });
  }
  const targets = tdee && current ? macroTargets(profile, current, tdee) : null;

  // --- Rythme d'évolution du poids vs objectif ------------------------------
  if (rate !== null && current) {
    const pct = (rate / current) * 100;
    const target = profile.targetRatePctPerWeek;
    const rateTxt = `${signed(rate, 2)} kg/sem (${signed(pct, 2)} %)`;
    if (profile.goal === 'cut') {
      if (pct > 0.1) {
        insights.push({
          id: 'rate', level: 'warn', title: `Tu prends du poids en sèche : ${rateTxt}`,
          body: `Ta tendance monte alors que l'objectif est de perdre. Soit l'apport réel est plus élevé que prévu ` +
            `(oublis de saisie, week-ends), soit l'objectif calorique est trop haut. Vérifie la régularité de la saisie avant de baisser les calories.`,
        });
      } else if (-pct > 1.0) {
        insights.push({
          id: 'rate', level: 'warn', title: `Perte rapide : ${rateTxt}`,
          body: `Au-delà de ~1 % du poids par semaine, le risque de perdre du muscle et de la performance augmente nettement. ` +
            `Remonte un peu les calories (principalement les glucides autour de l'entraînement) pour viser ≈ ${r1(target)} %/sem.`,
        });
      } else if (-pct >= 0.25) {
        insights.push({
          id: 'rate', level: 'good', title: `Sèche dans le bon rythme : ${rateTxt}`,
          body: `Tu perds entre 0,25 et 1 % de ton poids par semaine : c'est la zone où l'on perd surtout du gras en gardant le muscle. Continue.`,
        });
      } else {
        insights.push({
          id: 'rate', level: 'info', title: `Poids quasi stable : ${rateTxt}`,
          body: `Tu es pratiquement à la maintenance. Si ça dure plus de 2–3 semaines, réduis de ~150–200 kcal/jour ` +
            `ou augmente l'activité quotidienne (pas).`,
        });
      }
    } else if (profile.goal === 'bulk') {
      if (pct > 0.5) {
        insights.push({
          id: 'rate', level: 'warn', title: `Prise trop rapide : ${rateTxt}`,
          body: `Au-delà de ~0,5 %/semaine, l'essentiel du surplus part en gras : le muscle ne se construit pas plus vite. Réduis de 150–250 kcal/jour.`,
        });
      } else if (pct >= 0.1) {
        insights.push({
          id: 'rate', level: 'good', title: `Prise de masse maîtrisée : ${rateTxt}`,
          body: `Un gain de 0,1 à 0,5 %/semaine laisse au corps le temps de construire du muscle sans trop stocker de gras.`,
        });
      } else {
        insights.push({
          id: 'rate', level: 'info', title: `Pas de prise de poids : ${rateTxt}`,
          body: `Pour construire du muscle, un léger surplus aide. Ajoute ~150–200 kcal/jour (des glucides de préférence).`,
        });
      }
    } else {
      insights.push({
        id: 'rate', level: Math.abs(pct) <= 0.25 ? 'good' : 'info',
        title: Math.abs(pct) <= 0.25 ? `Poids stable : ${rateTxt}` : `Ton poids dérive : ${rateTxt}`,
        body: Math.abs(pct) <= 0.25
          ? `Tu es bien à la maintenance.`
          : `En maintien, une dérive de plus de 0,25 %/semaine mérite d'ajuster l'apport de ~${r0(Math.abs(rate) * 1100)} kcal/jour.`,
      });
    }
  } else if (weights.length > 0) {
    insights.push({
      id: 'rate-missing', level: 'info', title: 'Pas assez de pesées récentes',
      body: `Il faut au moins 6 pesées sur les 3 dernières semaines pour calculer une tendance fiable. ` +
        `Idéal : tous les matins, à jeun, après être passé aux toilettes.`,
    });
  }

  // --- Bruit de la balance (eau, glycogène, sel) ----------------------------
  // On compare la dernière pesée à la valeur attendue d'après les 14 jours précédents
  // (régression linéaire, sans le retard de la moyenne lissée).
  const raws = trend.filter((p) => p.raw !== undefined);
  const last = raws[raws.length - 1];
  const before = raws.slice(0, -1).filter((p) => last && daysBetween(p.date, last.date) <= 14);
  if (last && before.length >= 5) {
    const pts = before.map((p) => ({ x: -daysBetween(p.date, last.date), y: p.raw as number }));
    const k = slope(pts);
    const mx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const my = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    const expected = my - k * mx; // valeur de la droite en x = 0 (jour de la dernière pesée)
    const dev = (last.raw as number) - expected;
    if (Math.abs(dev) >= 0.8) {
      insights.push({
        id: 'noise', level: 'info',
        title: dev > 0 ? `Pesée haute (+${r1(dev)} kg vs attendu) : pas de panique` : `Pesée basse (−${r1(-dev)} kg vs attendu)`,
        body: dev > 0
          ? `Un écart d'un jour à l'autre, c'est de l'eau : repas salé ou riche en glucides (1 g de glycogène stocke ~3 g d'eau), ` +
            `séance de jambes intense (inflammation), sommeil court, cycle hormonal. 1 kg de gras demande ~7 700 kcal d'excès : impossible en une journée. Regarde la tendance.`
          : `Probablement déshydratation ou glycogène bas (journée pauvre en glucides). Ne la prends pas comme ton « vrai » poids : la tendance compte.`,
      });
    }
  }

  // --- Macros des 7 derniers jours ------------------------------------------
  const week = days.filter((d) => d.date > addDays(end, -7) && d.date <= end && d.kcal > 0);
  if (week.length >= 3 && current) {
    const avg = (k: 'kcal' | 'proteinG' | 'carbsG' | 'fatG') => week.reduce((s, d) => s + d[k], 0) / week.length;
    const pPerKg = avg('proteinG') / current;
    if (pPerKg < 1.6) {
      insights.push({
        id: 'protein', level: 'warn', title: `Protéines basses : ${r1(pPerKg)} g/kg`,
        body: `Pour construire ou préserver du muscle, vise 1,6 à 2,2 g/kg (≈ ${r0(current * 1.8)} g/jour pour toi), ` +
          `réparti en 3–5 prises de 25–40 g. C'est encore plus important en sèche.`,
      });
    } else {
      insights.push({
        id: 'protein', level: 'good', title: `Protéines au top : ${r1(pPerKg)} g/kg`,
        body: `Tu es dans la zone utile (1,6–2,2 g/kg). Au-delà, le bénéfice sur le muscle devient négligeable.`,
      });
    }
    if (targets) {
      const diff = avg('kcal') - targets.kcal;
      if (Math.abs(diff) > targets.kcal * 0.1) {
        insights.push({
          id: 'kcal-target', level: 'info',
          title: `Apport moyen ${diff > 0 ? 'au-dessus' : 'en dessous'} de l'objectif (${signed(diff, 0)} kcal/j)`,
          body: `Moyenne 7 jours : ${fmtKcal(avg('kcal'))} pour un objectif de ${fmtKcal(targets.kcal)}. ` +
            (diff > 0
              ? `Sur une semaine cela représente ~${r1((diff * 7) / 7700)} kg de différence sur la tendance.`
              : `Un déficit trop marqué se paie en énergie à l'entraînement et en récupération.`),
        });
      }
    }
    const fatPct = (avg('fatG') * 9) / avg('kcal');
    if (fatPct < 0.2) {
      insights.push({
        id: 'fat-low', level: 'warn', title: `Lipides très bas (${r0(fatPct * 100)} % des calories)`,
        body: `En dessous de ~20 %, la production hormonale (testostérone, œstrogènes) et l'absorption des vitamines A, D, E, K peuvent en pâtir.`,
      });
    }
  }

  // --- Jour de la semaine qui dérape ----------------------------------------
  // Sur 8 semaines : un jour dont la moyenne dépasse de > 15 % celle des autres jours.
  const DAY_NAMES = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const recent = days.filter((d) => d.date > addDays(end, -56) && d.date <= end && d.kcal > 0);
  if (recent.length >= 28) {
    const byDow = new Map<number, number[]>();
    for (const d of recent) {
      const k = parseISODate(d.date).getDay();
      byDow.set(k, [...(byDow.get(k) ?? []), d.kcal]);
    }
    const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
    let worst: { dow: number; avg: number; others: number } | null = null;
    for (const [dow, xs] of byDow) {
      if (xs.length < 4) continue;
      const others = recent.filter((d) => parseISODate(d.date).getDay() !== dow).map((d) => d.kcal);
      const avg = mean(xs);
      const o = mean(others);
      if (avg > o * 1.15 && (!worst || avg / o > worst.avg / worst.others)) worst = { dow, avg, others: o };
    }
    if (worst) {
      const extraPerWeek = worst.avg - worst.others;
      insights.push({
        id: 'weekday', level: 'warn',
        title: `Le ${DAY_NAMES[worst.dow]} : +${r0(((worst.avg - worst.others) / worst.others) * 100)} % de calories`,
        body: `Sur 8 semaines, tu manges ${fmtKcal(worst.avg)} en moyenne le ${DAY_NAMES[worst.dow]} contre ${fmtKcal(worst.others)} les autres jours. ` +
          `Cela fait ~${fmtKcal(extraPerWeek)} de plus chaque semaine, soit ~${r1((extraPerWeek * 52) / 7700)} kg sur un an si rien ne compense. ` +
          `Ce n'est pas un problème en soi si c'est prévu dans ta moyenne hebdo, mais c'est souvent l'explication d'un plateau.`,
      });
    }
  }

  // --- Entraînement ---------------------------------------------------------
  const last4 = periodTotals(workouts, end, 28);
  const prev4 = periodTotals(workouts, end, 28, 28);
  if (last4.sessions > 0 && prev4.sessions > 0) {
    const ch = ((last4.workingSets - prev4.workingSets) / prev4.workingSets) * 100;
    if (ch <= -25) {
      insights.push({
        id: 'volume', level: 'warn', title: `Volume d'entraînement en baisse (${signed(ch, 0)} % de séries)`,
        body: `${last4.sessions} séances / ${last4.workingSets} séries sur 4 semaines contre ${prev4.sessions} / ${prev4.workingSets} avant. ` +
          `Si ce n'est pas une décharge volontaire, c'est un signal de fatigue ou de manque d'énergie (déficit trop fort, sommeil).`,
      });
    } else if (ch >= 15) {
      insights.push({
        id: 'volume', level: 'info', title: `Volume en hausse (${signed(ch, 0)} % de séries)`,
        body: `Bonne progression de charge de travail. Augmente par paliers (~10–20 % par bloc) et surveille la récupération.`,
      });
    }
  }
  const lifts = liftTrends(workouts, end);
  if (lifts.length >= 2) {
    const avgCh = lifts.reduce((s, l) => s + l.changePct, 0) / lifts.length;
    const detail = lifts.map((l) => `${l.name} ${signed(l.changePct, 1)} %`).join(', ');
    const losing = rate !== null && rate < 0;
    if (avgCh <= -3) {
      insights.push({
        id: 'strength', level: 'warn', title: `Force en baisse (${signed(avgCh, 1)} % en moyenne)`,
        body: `${detail}. ` + (losing
          ? `Combinée à une perte de poids, une baisse de force est le premier signe qu'on puise dans le muscle : remonte les glucides et vérifie les protéines.`
          : `Sans perte de poids, regarde le sommeil, le stress et la programmation (trop de volume, pas assez de récupération).`),
      });
    } else if (avgCh >= 2) {
      insights.push({
        id: 'strength', level: 'good', title: `Tu progresses en force (${signed(avgCh, 1)} %)`,
        body: `${detail}. ` + (losing
          ? `Gagner en force tout en perdant du poids : recomposition corporelle, tu perds du gras sans perdre de muscle.`
          : `Le surplus et l'entraînement font leur travail.`),
      });
    } else {
      insights.push({
        id: 'strength', level: losing ? 'good' : 'info', title: `Force stable (${signed(avgCh, 1)} %)`,
        body: `${detail}. ` + (losing
          ? `Maintenir ses charges en déficit est exactement l'objectif : le muscle est préservé.`
          : `Pour relancer la progression : surcharge progressive (une rep ou un peu de charge de plus chaque semaine).`),
      });
    }
  }

  // --- Composition corporelle (impédancemétrie) -----------------------------
  const withFat = weights.filter((w) => w.bodyFatPct !== undefined && w.date > addDays(end, -60));
  if (withFat.length >= 10) {
    insights.push({
      id: 'bodyfat', level: 'info', title: 'À propos du % de gras Renpho',
      body: `La balance estime le gras par impédance : la valeur absolue peut être fausse de plusieurs points et varie avec l'hydratation. ` +
        `Fie-toi à la tendance sur plusieurs semaines, mesurée dans les mêmes conditions (matin, à jeun), jamais à une mesure isolée.`,
    });
  }

  const order = { warn: 0, good: 1, info: 2 } as const;
  insights.sort((a, b) => order[a.level] - order[b.level]);
  return { currentTrendKg: current, weeklyRateKg: rate, tdee, tdeeSource, targets, insights };
}
