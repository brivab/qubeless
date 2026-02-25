# Contrat standard des analyzers

Les analyzers (plugins) sont exécutés dans un conteneur Docker. Le worker fournit un workspace monté et attend des fichiers de sortie normalisés.

## Montage des volumes

- Code du projet : `/workspace` (monté en lecture/écriture, contient le checkout)
- Répertoire de sortie attendu : `/out`

## Fichiers obligatoires dans `/out`

- `report.json` : issues normalisées
- `measures.json` : métriques agrégées
- `run.log` : logs texte lisibles (trace d’exécution)

## Format `report.json`

```json
{
  "analyzer": { "name": "string", "version": "string" },
  "issues": [
    {
      "ruleKey": "string",
      "severity": "INFO|MINOR|MAJOR|CRITICAL|BLOCKER",
      "type": "BUG|CODE_SMELL|VULNERABILITY",
      "filePath": "string",
      "line": 123,
      "message": "string",
      "fingerprint": "string"
    }
  ]
}
```

- `fingerprint` doit être stable pour suivre une issue dans le temps (hash déterministe).
- `line` peut être omise ou `null` si non applicable.

## Format `measures.json`

```json
{
  "metrics": {
    "issues_total": 10,
    "issues_blocker": 0,
    "issues_critical": 1
  }
}
```

- `metrics` est un dictionnaire `string -> number`. Les clés peuvent être étendues (ex: `duplicated_lines`, `complexity`).

## Validateurs et types TypeScript

Dans `packages/shared` :

- Types exportés : `AnalyzerMetadata`, `AnalyzerIssue`, `AnalyzerReport`, `AnalyzerMeasures`, ainsi que les unions `AnalyzerIssueSeverity` et `AnalyzerIssueType`.
- Schémas Zod exportés : `analyzerIssueSchema`, `analyzerReportSchema`, `analyzerMeasuresSchema` (dossier `src/validators/analyzer.ts`).

Usage recommandé dans le worker/core :

```ts
import { analyzerReportSchema } from '@qubeless/shared';
const parsed = analyzerReportSchema.parse(jsonPayload);
```

## Récapitulatif d’intégration

1. Le worker lance le conteneur de l’analyzer en montant :
   - le workspace sur `/workspace`
   - un volume vide pour la sortie sur `/out`
2. L’analyzer écrit `report.json`, `measures.json` et `run.log` dans `/out`.
3. Le core/worker lit ces fichiers, valide via les schémas Zod, puis ingère les issues/métriques.
