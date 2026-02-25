# Guide Rapide : Créer un Analyzer Custom en 15 minutes

Ce guide vous permet de créer rapidement votre premier analyzer personnalisé pour Qubeless.

## Prérequis

- Docker installé
- Connaissance de base d'un langage de script (Python/Node.js/Bash)
- Accès à un registre Docker (optionnel)

## Étape 1 : Structure minimale

```bash
mkdir my-quick-analyzer
cd my-quick-analyzer
```

Créez ces 3 fichiers :

### `Dockerfile`

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY analyzer.py /app/analyzer.py
COPY entrypoint.sh /app/entrypoint.sh
RUN chmod +x /app/entrypoint.sh
ENTRYPOINT ["/app/entrypoint.sh"]
```

### `entrypoint.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail
mkdir -p /out
python /app/analyzer.py --workspace /workspace --out /out
```

### `analyzer.py`

```python
#!/usr/bin/env python3
import json
import hashlib
import argparse
from pathlib import Path

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--workspace', required=True)
    parser.add_argument('--out', required=True)
    args = parser.parse_args()

    issues = []

    # Logique simple : détecter les TODO
    for file_path in Path(args.workspace).rglob('*'):
        if file_path.is_file() and file_path.suffix in ['.py', '.js', '.ts']:
            rel_path = file_path.relative_to(args.workspace)
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    for line_num, line in enumerate(f, start=1):
                        if 'TODO' in line.upper():
                            fingerprint = hashlib.sha256(
                                f"quick-analyzer:todo|{rel_path}|{line_num}|{line.strip()}".encode()
                            ).hexdigest()

                            issues.append({
                                "ruleKey": "quick-analyzer:todo",
                                "severity": "INFO",
                                "type": "CODE_SMELL",
                                "filePath": str(rel_path),
                                "line": line_num,
                                "message": f"TODO trouvé : {line.strip()}",
                                "fingerprint": fingerprint
                            })
            except Exception:
                pass  # Ignorer les fichiers non lisibles

    # Générer les fichiers de sortie
    report = {
        "analyzer": {"name": "quick-analyzer", "version": "1.0.0"},
        "issues": issues,
        "rules": [{
            "key": "quick-analyzer:todo",
            "name": "TODO Detection",
            "description": "Détecte les commentaires TODO",
            "severity": "INFO",
            "type": "CODE_SMELL"
        }]
    }

    measures = {
        "metrics": {
            "issues_total": len(issues),
            "issues_info": len(issues),
            "todo_count": len(issues)
        }
    }

    with open(f"{args.out}/report.json", 'w') as f:
        json.dump(report, f, indent=2)

    with open(f"{args.out}/measures.json", 'w') as f:
        json.dump(measures, f, indent=2)

    with open(f"{args.out}/run.log", 'w') as f:
        f.write(f"Quick Analyzer terminé : {len(issues)} TODOs trouvés\n")

if __name__ == '__main__':
    main()
```

## Étape 2 : Build et Test

```bash
# Build l'image
docker build -t quick-analyzer:1.0.0 .

# Test local
mkdir -p /tmp/test-workspace
echo "# TODO: Implement this" > /tmp/test-workspace/example.py

docker run --rm \
  -v /tmp/test-workspace:/workspace:ro \
  -v /tmp/test-output:/out \
  quick-analyzer:1.0.0

# Vérifier les résultats
cat /tmp/test-output/report.json | jq
```

## Étape 3 : Intégration dans Qubeless

```bash
# Enregistrer l'analyseur
curl -X POST http://localhost:3001/api/analyzers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "key": "quick-analyzer",
    "name": "Quick TODO Analyzer",
    "dockerImage": "quick-analyzer:1.0.0",
    "enabled": true
  }'

# Activer pour un projet
curl -X PUT http://localhost:3001/api/projects/my-project/analyzers/quick-analyzer \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"enabled": true}'
```

## Étape 4 : Personnalisation

Pour modifier la logique de détection, éditez `analyzer.py` :

```python
# Exemple : détecter les mots de passe en dur
if 'password' in line.lower() and '=' in line:
    # Créer une issue de type VULNERABILITY
    issues.append({
        "ruleKey": "quick-analyzer:hardcoded-password",
        "severity": "CRITICAL",
        "type": "VULNERABILITY",
        # ... autres champs
    })
```

## Prochaines étapes

- Consultez le [guide complet](./custom-analyzer.md) pour des fonctionnalités avancées
- Explorez les [exemples existants](../analyzers/) dans le projet
- Ajoutez des tests unitaires à votre analyzer

---

**Félicitations !** Vous avez créé votre premier analyzer custom en quelques minutes.
