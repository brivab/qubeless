# PMD Analyzer

Analyseur de qualité de code Java utilisant PMD 7.9.0.

## Description

PMD est un analyseur statique de code source qui détecte les problèmes de qualité de code tels que :
- **Best Practices** : Variables/méthodes inutilisées, blocs catch vides, etc.
- **Code Style** : Nommage, formatage, conventions de codage
- **Design** : Complexité excessive, couplage, cohésion
- **Error Prone** : Bugs potentiels, comparaisons incorrectes
- **Performance** : Code inefficace, instanciations inutiles

## Structure

```
analyzers/pmd/
├── Dockerfile          # Image Docker avec PMD 7.9.0
├── entrypoint.sh       # Script d'analyse et transformation
├── DEPLOYMENT.md       # Documentation de déploiement
└── README.md          # Ce fichier
```

## Utilisation

### Construction de l'image

```bash
cd analyzers/pmd
docker build -t qubeless/analyzer-pmd:latest .
```

### Exécution

```bash
docker run --rm \
  -v /path/to/java/project:/workspace:ro \
  -v /path/to/output:/out \
  qubeless/analyzer-pmd:latest
```

### Fichiers de sortie

- `report.json` : Rapport au format Qubeless (issues + règles)
- `measures.json` : Métriques agrégées
- `pmd.xml` : Rapport XML brut de PMD
- `run.log` : Logs d'exécution
- `pmd.log` : Sortie standard de PMD

## Exemple avec le projet de démonstration

```bash
cd /Users/brieucvably/Workspace/qubeless-monorepo
docker run --rm \
  -v $(pwd)/examples/java-pmd-demo:/workspace:ro \
  -v $(pwd)/out:/out \
  qubeless/analyzer-pmd:latest
```

### Résultats attendus

Le projet de démonstration contient intentionnellement de nombreux problèmes :
- **376 issues** détectées au total
- **52 règles** uniques déclenchées
- Répartition par sévérité :
  - BLOCKER: 8
  - CRITICAL: 64
  - MAJOR: 298
  - MINOR: 6

## Configuration

### Par défaut

Sans configuration personnalisée, l'analyseur utilise les rulesets suivants :
- `category/java/bestpractices.xml`
- `category/java/codestyle.xml`
- `category/java/design.xml`
- `category/java/errorprone.xml`
- `category/java/performance.xml`

### Personnalisée

Créez un fichier `pmd.xml` ou `ruleset.xml` à la racine du projet :

```xml
<?xml version="1.0" encoding="UTF-8"?>
<ruleset name="Custom Rules"
    xmlns="http://pmd.sourceforge.net/ruleset/2.0.0"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:schemaLocation="http://pmd.sourceforge.net/ruleset/2.0.0 https://pmd.sourceforge.io/ruleset_2_0_0.xsd">

    <description>Custom PMD rules</description>

    <!-- Include specific rulesets -->
    <rule ref="category/java/bestpractices.xml" />
    <rule ref="category/java/security.xml" />

    <!-- Exclude specific rules -->
    <rule ref="category/java/codestyle.xml">
        <exclude name="AtLeastOneConstructor"/>
    </rule>
</ruleset>
```

## Mapping des données

### RuleKey

Format : `pmd:<ruleset>:<rule>` ou `pmd:<rule>`

Exemples :
- `pmd:Best Practices:UnusedPrivateField`
- `pmd:Code Style:ShortVariable`
- `pmd:Performance:StringInstantiation`

### Severity

Mappé depuis la priorité PMD (1-5) :
- Priority 1 → `BLOCKER`
- Priority 2 → `CRITICAL`
- Priority 3 → `MAJOR`
- Priority 4 → `MINOR`
- Priority 5 → `INFO`

### Type

Toutes les issues PMD sont de type `CODE_SMELL` car PMD se concentre sur la qualité du code.

### Location

- `filePath` : Chemin relatif au workspace
- `line`, `column` : Position de début
- `endLine`, `endColumn` : Position de fin

## Détection des sources

L'analyseur recherche automatiquement les fichiers Java dans :
1. `src/main/java` (convention Maven)
2. `src`
3. `app/src/main/java` (projets Android)
4. `.` (racine du projet)

## Références

- [Documentation PMD](https://pmd.github.io/)
- [Règles Java](https://pmd.github.io/latest/pmd_rules_java.html)
- [Configuration des rulesets](https://pmd.github.io/latest/pmd_userdocs_configuring_rules.html)
