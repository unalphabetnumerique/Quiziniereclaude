# Quiziniere IA

Plateforme Next.js pour generer des exercices pedagogiques via API IA.

## Fonctionnalites

- Formulaire `/` avec:
  - matiere
  - niveau
  - type d'exercice (`QCM`, `vrai-faux`, `texte-a-trous`)
  - nombre de questions
- Appel API `POST /api` (Groq) pour produire des exercices en JSON
- Affichage lisible des exercices dans l'interface
- Export JSON avec un bouton `Exporter en JSON`
- UI en Tailwind CSS

## Installation

```bash
npm install
```

## Lancement en developpement

```bash
npm run dev
```

Puis ouvre [http://localhost:3000](http://localhost:3000).

## Configuration API IA

1. Copie `.env.example` vers `.env.local`
2. Renseigne la cle Groq (sans espaces autour du `=`):

```env
GROQ_API_KEY=gsk_...
```

Sans `GROQ_API_KEY`, la generation renvoie une erreur cote serveur.
