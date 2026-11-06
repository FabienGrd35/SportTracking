# SportTracking

Appli mobile (iOS / Android, Expo + React Native) qui croise **musculation (Hevy)**, **poids (Renpho)** et
**nutrition (macros & calories)**, et explique en clair ce qui se passe sur les grandes tendances.

## Ce que fait l'appli

| Onglet | Contenu |
| --- | --- |
| **Tendances** | Poids lissé, rythme kg/semaine, dépense énergétique, macros du jour vs objectifs, et les analyses expliquées. |
| **Nutrition** | Saisie des repas (protéines / glucides / lipides, calories calculées automatiquement), copie de la veille, historique 14 jours vs objectif. |
| **Poids** | Import du CSV Renpho, saisie manuelle, courbe pesées + tendance lissée (1 mois / 3 mois / 1 an), % de gras. |
| **Muscu** | Synchro Hevy (complète puis incrémentale), séries/semaine, force estimée (1RM Epley) par exercice, dernières séances. |
| **Réglages** | Objectif (sèche / maintien / prise de masse + rythme), profil, clé API Hevy (stockée dans le trousseau sécurisé). |

### Les analyses (`src/lib/insights.ts`)

- **Dépense réelle mesurée** : apport moyen − variation de poids × 7 700 kcal/kg sur 28 jours. Remplace la formule
  (Mifflin-St Jeor) dès qu'il y a assez de données (≥ 60 % de jours saisis, ≥ 8 pesées).
- **Rythme vs objectif** : sèche trop rapide (> 1 %/sem, risque musculaire), trop lente, prise de masse trop rapide (> 0,5 %/sem)…
- **Bruit de la balance** : une pesée qui s'écarte de la tendance est expliquée (eau, glycogène, sel) au lieu d'inquiéter.
- **Protéines** (g/kg), **lipides trop bas**, **écart à l'objectif calorique**, **effet week-end**.
- **Entraînement × nutrition** : volume en baisse, force en hausse/baisse, croisés avec la perte de poids
  (force stable en sèche = muscle préservé ; force en baisse + perte rapide = alerte).
- **% de gras Renpho** : rappel des limites de l'impédancemétrie.

## Connexions — ce qu'il faut savoir

- **Hevy** : API officielle (`https://api.hevyapp.com/v1`), **réservée aux abonnés Hevy Pro**. Clé à récupérer sur
  hevy.com → Settings → Developer, à coller dans Réglages.
- **Renpho** : **pas d'API publique**. Les API non officielles (rétro-ingénierie) cassent à chaque mise à jour de
  l'appli Renpho et demandent ton mot de passe : écartées volontairement. L'appli importe l'**export CSV** de Renpho
  (formats anglais/français, kg/lb, virgule/point-virgule gérés). Étape suivante possible : lire le poids via
  **Apple Santé / Health Connect**, où Renpho se synchronise déjà (nécessite un build natif, cf. roadmap).
- **Nutrition** : saisie dans l'appli (pas de base d'aliments pour l'instant).

## Lancer l'appli

```bash
npm install
npx expo install --fix   # aligne les versions sur le SDK Expo installé
npx expo start           # puis scanner le QR code avec Expo Go
```

Tests de la logique métier (Node ≥ 22.18, sans dépendance) :

```bash
npm test
```

## Architecture

```
app/                 écrans (expo-router, un onglet = un fichier)
src/lib/             logique pure, testée : tendance, énergie, entraînement, analyses, CSV Renpho, client Hevy
src/state/           store persistant (AsyncStorage), synchro Hevy, clé sécurisée
src/components/      UI : cartes, graphiques SVG, barres de macros
test/                tests node:test
```

Toutes les données restent sur le téléphone.

## Roadmap

- [ ] Poids automatique via Apple Santé (HealthKit) / Health Connect (Renpho y écrit déjà)
- [ ] Recherche d'aliments (Open Food Facts) + scan code-barres
- [ ] Repas favoris / modèles
- [ ] Export / sauvegarde des données
