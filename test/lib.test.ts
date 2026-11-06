import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, weekStart } from '../src/lib/dates.ts';
import { weightTrend, weeklyRateKg } from '../src/lib/trend.ts';
import { adaptiveTdee, aggregateDays, bmr, macroTargets } from '../src/lib/energy.ts';
import { parseRenphoCsv } from '../src/lib/renphoCsv.ts';
import { epley, normalizeWorkout } from '../src/lib/hevy/normalize.ts';
import { HevyClient } from '../src/lib/hevy/client.ts';
import { analyze } from '../src/lib/insights.ts';
import { END, foods, profile, weights, workout } from './helpers.ts';

test('dates', () => {
  assert.equal(addDays('2026-02-28', 1), '2026-03-01');
  assert.equal(weekStart('2026-11-08'), '2026-11-02'); // dimanche → lundi
});

test('la tendance lisse le bruit et la pente est retrouvée', () => {
  const t = weightTrend(weights(28, 85, -0.07));
  assert.equal(t.length, 28);
  const rate = weeklyRateKg(t)!;
  assert.ok(Math.abs(rate - -0.49) < 0.1, `rate=${rate}`);
});

test('pas de tendance avec trop peu de pesées', () => {
  assert.equal(weeklyRateKg(weightTrend(weights(4, 80, 0))), null);
});

test('BMR Mifflin-St Jeor', () => {
  // 10*80 + 6.25*180 - 5*36 + 5 = 1750
  assert.equal(bmr(profile, 80, new Date('2026-06-01')), 1750);
});

test('dépense adaptative : 2200 kcal et −0,5 kg/sem → ~2750 kcal', () => {
  const r = adaptiveTdee(aggregateDays(foods(28, 2200)), weights(28, 85, -0.5 / 7), END)!;
  assert.ok(Math.abs(r.tdee - 2750) < 60, `tdee=${r.tdee}`);
});

test('dépense adaptative refusée si saisie incomplète', () => {
  assert.equal(adaptiveTdee(aggregateDays(foods(10, 2200)), weights(28, 85, 0), END), null);
});

test('objectifs macros cohérents', () => {
  const t = macroTargets(profile, 80, 2700);
  assert.equal(t.kcal, 2700 - Math.round((0.005 * 80 * 7700) / 7)); // −0,5 %/sem
  assert.equal(t.proteinG, 160);
  assert.ok(Math.abs(t.proteinG * 4 + t.carbsG * 4 + t.fatG * 9 - t.kcal) < 10);
});

test('CSV Renpho anglais (virgule, MM/JJ)', () => {
  const csv = [
    'Time of Measurement,Weight(kg),BMI,Body Fat(%),Fat-free Body Weight(kg),Muscle Mass(kg)',
    '"10/25/2026, 7:12:03 AM",82.4kg,24.1,18.2%,67.4kg,63.1kg',
    '"10/24/2026, 7:05:44 AM",82.9kg,24.2,18.4%,67.6kg,63.2kg',
  ].join('\n');
  const r = parseRenphoCsv(csv);
  assert.equal(r.entries.length, 2);
  assert.deepEqual(r.entries[0], { date: '2026-10-25', weightKg: 82.4, bodyFatPct: 18.2, muscleMassKg: 63.1, source: 'renpho' });
});

test('CSV Renpho français (point-virgule, décimales à virgule, JJ/MM, lb)', () => {
  const csv = '﻿Date;Heure;Poids(lb);Graisse corporelle(%)\n03/11/2026;07:00;180,5;20,1\n13/10/2026;07:00;181;20,3\nfoo;bar;;\n';
  const r = parseRenphoCsv(csv);
  assert.equal(r.unit, 'lb');
  assert.equal(r.skipped, 1);
  assert.equal(r.entries[0].date, '2026-11-03');
  assert.equal(r.entries[0].weightKg, 81.87);
});

test('CSV sans colonne poids → erreur claire', () => {
  assert.throws(() => parseRenphoCsv('a,b\n1,2'), /introuvables/);
});

test('normalisation Hevy : échauffements exclus, e1RM Epley', () => {
  assert.equal(epley(100, 1), 100);
  assert.ok(Math.abs(epley(100, 5) - 116.67) < 0.01);
  const w = normalizeWorkout({
    id: 'w1', title: 'Push', start_time: '2026-10-30T18:00:00Z', end_time: '2026-10-30T19:05:00Z',
    updated_at: '', created_at: '',
    exercises: [{
      index: 0, title: 'Bench', exercise_template_id: 'b',
      sets: [
        { index: 0, type: 'warmup', weight_kg: 60, reps: 10, distance_meters: null, duration_seconds: null, rpe: null },
        { index: 1, type: 'normal', weight_kg: 100, reps: 5, distance_meters: null, duration_seconds: null, rpe: 8 },
        { index: 2, type: 'normal', weight_kg: 100, reps: 4, distance_meters: null, duration_seconds: null, rpe: 9 },
      ],
    }],
  });
  assert.equal(w.durationMin, 65);
  assert.equal(w.workingSets, 2);
  assert.equal(w.volumeKg, 900);
});

test('client Hevy : pagination, header api-key, events', async () => {
  const calls: string[] = [];
  const fake = (async (url: string, init: RequestInit) => {
    calls.push(url);
    assert.equal((init.headers as Record<string, string>)['api-key'], 'KEY');
    const page = Number(new URL(url).searchParams.get('page'));
    const body = url.includes('/events')
      ? { page, page_count: 1, events: [{ type: 'deleted', id: 'x', deleted_at: '' }] }
      : { page, page_count: 2, workouts: [{ id: `w${page}` }] };
    return new Response(JSON.stringify(body), { status: 200 });
  }) as typeof fetch;
  const c = new HevyClient('KEY', fake);
  assert.deepEqual((await c.allWorkouts()).map((w) => w.id), ['w1', 'w2']);
  assert.deepEqual((await c.changesSince('2026-01-01T00:00:00Z')).deletedIds, ['x']);
  assert.ok(calls[0].startsWith('https://api.hevyapp.com/v1/workouts?page=1&pageSize=10'));
});

test('client Hevy : 401 → message explicite', async () => {
  const c = new HevyClient('bad', (async () => new Response('', { status: 401 })) as typeof fetch);
  await assert.rejects(c.allWorkouts(), /Hevy Pro/);
});

test('analyse : sèche saine + force stable → messages positifs', () => {
  const ws = [END, addDays(END, -7), addDays(END, -14), addDays(END, -21), addDays(END, -35), addDays(END, -42)]
    .map((d) => workout(d, 100));
  const a = analyze(profile, weights(35, 85, -0.06), foods(35, 2200, 170), ws, END);
  const ids = Object.fromEntries(a.insights.map((i) => [i.id, i.level]));
  assert.equal(a.tdeeSource, 'measured');
  assert.equal(ids.rate, 'good');
  assert.equal(ids.protein, 'good');
  assert.equal(ids.strength, 'good');
  assert.ok(a.targets && a.targets.kcal < a.tdee!);
});

test('analyse : perte rapide + force en baisse + effet week-end → alertes', () => {
  const ws = [END, addDays(END, -7), addDays(END, -14), addDays(END, -35), addDays(END, -42), addDays(END, -49)]
    .map((d) => workout(d, d >= addDays(END, -27) ? 92 : 100, d >= addDays(END, -27) ? 10 : 18));
  const a = analyze(profile, weights(56, 85, -0.2), foods(56, 1600, 100, 2600), ws, END);
  const ids = Object.fromEntries(a.insights.map((i) => [i.id, i.level]));
  assert.equal(ids.rate, 'warn');
  assert.equal(ids.protein, 'warn');
  assert.equal(ids.strength, 'warn');
  assert.equal(ids.volume, 'warn');
  assert.equal(ids.weekday, 'warn');
  assert.equal(a.insights[0].level, 'warn');
});

test('analyse sans données : pas de crash', () => {
  const a = analyze(profile, [], [], [], END);
  assert.equal(a.tdee, null);
  assert.deepEqual(a.insights, []);
});

test('pesée anormale détectée, mais pas en perte régulière', () => {
  const steady = analyze(profile, weights(35, 85, -0.2), [], [], END);
  assert.ok(!steady.insights.some((i) => i.id === 'noise'));
  const spike = weights(35, 85, -0.05);
  spike[spike.length - 1].weightKg += 1.5;
  const a = analyze(profile, spike, [], [], END);
  assert.match(a.insights.find((i) => i.id === 'noise')!.title, /Pesée haute/);
});

import { parseNutritionSheet, toCsvUrl } from '../src/lib/nutritionSheet.ts';
import { mapHealthWeights } from '../src/lib/healthConnect.ts';

test('URL Google Sheets → export CSV', () => {
  assert.equal(
    toCsvUrl('https://docs.google.com/spreadsheets/d/1AbC-d_9/edit?usp=sharing#gid=42'),
    'https://docs.google.com/spreadsheets/d/1AbC-d_9/export?format=csv&gid=42',
  );
  assert.equal(
    toCsvUrl('https://docs.google.com/spreadsheets/d/1AbC/edit'),
    'https://docs.google.com/spreadsheets/d/1AbC/export?format=csv',
  );
  assert.equal(
    toCsvUrl('https://docs.google.com/spreadsheets/d/e/2PACX-xyz/pubhtml'),
    'https://docs.google.com/spreadsheets/d/e/2PACX-xyz/pub?output=csv',
  );
  assert.equal(
    toCsvUrl('https://docs.google.com/spreadsheets/d/e/2PACX-xyz/pub?gid=0&single=true'),
    'https://docs.google.com/spreadsheets/d/e/2PACX-xyz/pub?gid=0&single=true&output=csv',
  );
  assert.equal(toCsvUrl('https://script.google.com/macros/s/abc/exec'), 'https://script.google.com/macros/s/abc/exec');
});

test('feuille nutrition : titre au-dessus, une ligne par repas, FR', () => {
  const csv = [
    'Suivi nutrition,,,,,',
    'Date,Repas,Calories (kcal),Protéines (g),Glucides (g),Lipides (g)',
    '05/11/2026,Petit-déj,"520","35","60","14"',
    '05/11/2026,Déjeuner,"780,5","50","85","22"',
    '06/11/2026,Total,"2 150","170","230","60"',
    'Moyenne,,"1800","120","200","50"',
    ',,,,,',
  ].join('\n');
  const r = parseNutritionSheet(csv);
  assert.deepEqual(r.days, [
    { date: '2026-11-05', kcal: 1300.5, proteinG: 85, carbsG: 145, fatG: 36 },
    { date: '2026-11-06', kcal: 2150, proteinG: 170, carbsG: 230, fatG: 60 },
  ]);
  assert.equal(r.skipped, 1);
});

test('feuille non partagée → message explicite', () => {
  assert.throws(() => parseNutritionSheet('<!DOCTYPE html><html>login</html>'), /partagée/);
});

test('journée Google Sheets prioritaire sur la saisie manuelle', () => {
  const days = aggregateDays([
    { id: 'a', date: '2026-11-05', label: 'x', kcal: 500, proteinG: 0, carbsG: 0, fatG: 0, source: 'manual' },
    { id: 'b', date: '2026-11-05', label: 'GS', kcal: 2000, proteinG: 0, carbsG: 0, fatG: 0, source: 'sheet' },
    { id: 'c', date: '2026-11-06', label: 'x', kcal: 700, proteinG: 0, carbsG: 0, fatG: 0 },
  ]);
  assert.deepEqual(days.map((d) => [d.date, d.kcal]), [['2026-11-05', 2000], ['2026-11-06', 700]]);
});

test('Health Connect : une pesée par jour (la plus basse) + % de gras', () => {
  const r = mapHealthWeights(
    [
      { time: '2026-11-05T06:30:00Z', weight: { inKilograms: 82.4 } },
      { time: '2026-11-05T19:00:00Z', weight: { inKilograms: 83.6 } },
      { time: '2026-11-06T06:40:00Z', weight: { inKilograms: 82.15 } },
    ],
    [{ time: '2026-11-05T06:30:00Z', percentage: 18.3 }, { time: '2026-11-06T06:40:00Z', percentage: { value: 18.1 } }],
  );
  assert.deepEqual(r, [
    { date: '2026-11-05', weightKg: 82.4, bodyFatPct: 18.3, source: 'health' },
    { date: '2026-11-06', weightKg: 82.15, bodyFatPct: 18.1, source: 'health' },
  ]);
});

test('feuille au format réel : en-têtes abrégés Cal/Prot/Gluc/Lip, espace fine, jours vides', () => {
  const csv = 'Date,Cal,Prot,Gluc,Lip\n02/10/2025,,,,\n03/10/2025,"2 104",150,210,70\n14/10/2025,"1 950",140,190,65\n';
  const r = parseNutritionSheet(csv);
  assert.deepEqual(r.columns, ['Date', 'Cal', 'Prot', 'Gluc', 'Lip']);
  assert.deepEqual(r.days, [
    { date: '2025-10-03', kcal: 2104, proteinG: 150, carbsG: 210, fatG: 70 },
    { date: '2025-10-14', kcal: 1950, proteinG: 140, carbsG: 190, fatG: 65 },
  ]);
});

test('jour qui dérape : le samedi seul est détecté', () => {
  const f = foods(56, 2450).map((x) => (new Date(x.date + 'T12:00:00').getDay() === 6 ? { ...x, kcal: 2950 } : x));
  const a = analyze(profile, [], f, [], END);
  assert.match(a.insights.find((i) => i.id === 'weekday')!.title, /samedi/);
});

import { buildDataContext } from '../src/lib/claudeContext.ts';
import { excelSerialToISO, rowsToCsv } from '../src/lib/xlsxRows.ts';
import { parseWeightExtraction } from '../src/lib/weightExtraction.ts';

test('Excel : numéro de série → date', () => {
  assert.equal(excelSerialToISO(45608), '2024-11-12');
  assert.equal(excelSerialToISO(46331), '2026-11-05');
});

test('Excel → CSV → lecteur nutrition (structure réelle Date/Cal/Prot/Gluc/Lip)', () => {
  const rows: unknown[][] = [
    ['Date', 'Cal', 'Prot', 'Gluc', 'Lip'],
    [45570],
    [45608, '1 807', 92, 221, 59],
    [45609, '2 014', 146, 144, 95],
  ];
  const r = parseNutritionSheet(rowsToCsv(rows));
  assert.deepEqual(r.days, [
    { date: '2024-11-12', kcal: 1807, proteinG: 92, carbsG: 221, fatG: 59 },
    { date: '2024-11-13', kcal: 2014, proteinG: 146, carbsG: 144, fatG: 95 },
  ]);
});

test('pesées lues par Claude : valeurs invraisemblables ou futures écartées', () => {
  const r = parseWeightExtraction(JSON.stringify({
    measurements: [
      { date: '2026-11-04', weight_kg: 82.35, body_fat_pct: 18.2, muscle_mass_kg: 63.1 },
      { date: '2026-11-09', weight_kg: 82, body_fat_pct: null, muscle_mass_kg: null },
      { date: '04/11', weight_kg: 82, body_fat_pct: null, muscle_mass_kg: null },
      { date: '2026-11-03', weight_kg: 8.2, body_fat_pct: null, muscle_mass_kg: null },
    ],
    notes: '',
  }), '2026-11-06');
  assert.equal(r.rejected, 3);
  assert.deepEqual(r.entries, [{ date: '2026-11-04', weightKg: 82.35, bodyFatPct: 18.2, muscleMassKg: 63.1, source: 'renpho' }]);
});

test('contexte Claude : historique hebdo, détail 28 j, données absentes signalées', () => {
  const f = foods(56, 2400, 150);
  const a = analyze(profile, [], f, [], END);
  const ctx = buildDataContext(profile, [], f, [], a, END);
  assert.match(ctx, /# Historique hebdomadaire/);
  assert.match(ctx, /# 28 derniers jours/);
  assert.match(ctx, /poids, entraînements Hevy : non disponibles/);
  assert.ok(ctx.split('\n').filter((l) => /^\d{4}-\d{2}-\d{2};7;/.test(l)).length >= 6);
});
