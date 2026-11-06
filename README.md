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

## Connexions

| Source | Comment | Automatique ? |
| --- | --- | --- |
| **Hevy** | API officielle (`api.hevyapp.com/v1`), **abonnement Hevy Pro requis**. Clé : hevy.com → Settings → Developer → Réglages de l'appli. | Oui, à chaque ouverture |
| **Renpho** | Pas d'API publique. Renpho écrit dans **Health Connect** (Android) → l'appli lit poids et % de gras. Import CSV en secours pour l'historique ancien. | Oui (Health Connect) |
| **Macros / calories** | Lecture de ta **feuille Google Sheets** (export CSV). Colonnes reconnues : Date, Calories, Protéines, Glucides, Lipides ; une ligne par jour ou par repas. Saisie manuelle possible en complément. | Oui, à chaque ouverture |

Synchro auto : à l'ouverture et au retour au premier plan, au plus toutes les 15 min (`src/state/useAutoSync.ts`).

### Configuration côté téléphone

1. **Renpho → Health Connect** : dans l'appli Renpho, activer la synchro Health Connect (Moi → Paramètres →
   applis tierces), puis dans SportTracking : Poids → *Connecter Health Connect*.
2. **Google Sheets** : Partager → « Tous les utilisateurs disposant du lien » (lecteur), coller le lien dans Réglages.
   ⚠️ Toute personne qui a le lien peut lire la feuille. Pour plus de confidentialité : un script Apps Script
   publié avec un jeton secret dans l'URL (l'appli accepte n'importe quelle URL qui renvoie du CSV).
   Si une journée est dans la feuille, c'est elle qui fait foi : les saisies manuelles du même jour sont ignorées.

## Lancer l'appli (Android)

Health Connect est un module natif : l'appli **ne tourne pas dans Expo Go**, il faut un build.

```bash
npm install
npx expo install --fix          # aligne les versions sur le SDK Expo
npm i -g eas-cli && eas login   # compte Expo gratuit
npm run build:android           # APK installable directement sur le téléphone
```

Pour développer : `eas build -p android --profile development`, installer l'APK, puis `npx expo start --dev-client`.

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

- [x] Poids automatique via Health Connect
- [x] Macros depuis Google Sheets
- [ ] Recherche d'aliments (Open Food Facts) + scan code-barres
- [ ] Repas favoris / modèles
- [ ] Export / sauvegarde des données
