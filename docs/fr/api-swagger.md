# Swagger API

Utilisez cette page pour explorer et tester les endpoints REST de l'API.

## Intégration site

Définissez `VITE_SWAGGER_UI_URL` dans l'environnement du site pour pointer vers le Swagger UI de l'API :

```
VITE_SWAGGER_UI_URL=https://api.votre-domaine.com/api/docs
```

Pour le développement local avec le proxy Vite, utilisez :

```
VITE_SWAGGER_UI_URL=/api/docs
```

## URLs par défaut

- Local: `http://localhost:3001/api/docs`
- Chemin production typique (via reverse proxy): `https://<votre-domaine>/api/docs`

## Notes

- La page Documentation (`#/docs`) intègre Swagger UI depuis `VITE_SWAGGER_UI_URL`.
- Vous pouvez vous authentifier directement depuis Swagger UI pour les endpoints protégés.
- Swagger UI est activé par défaut en production (sauf si `SWAGGER_ENABLED=false`).
