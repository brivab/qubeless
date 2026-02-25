# API Swagger

Use this page to inspect and test the REST API endpoints.

## Website Integration

Set `VITE_SWAGGER_UI_URL` in the site environment to point to your API Swagger UI:

```
VITE_SWAGGER_UI_URL=https://api.your-domain.com/api/docs
```

For local development with Vite proxy, use:

```
VITE_SWAGGER_UI_URL=/api/docs
```

## Default URLs

- Local: `http://localhost:3001/api/docs`
- Typical production path (behind reverse proxy): `https://<your-domain>/api/docs`

## Notes

- Documentation page (`#/docs`) embeds Swagger UI from `VITE_SWAGGER_UI_URL`.
- You can authenticate directly from Swagger UI for protected endpoints.
- Swagger UI is enabled by default in production (unless `SWAGGER_ENABLED=false`).
