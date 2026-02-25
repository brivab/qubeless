# SSO (Single Sign-On) - Guide complet

## ✅ SSO est optionnel - L'authentification locale reste toujours disponible

**Important** : Le SSO est une fonctionnalité optionnelle qui s'ajoute à l'authentification locale existante sans la remplacer. Si aucun SSO n'est configuré, l'application fonctionne exactement comme avant.

## Table des matières

- [Principes de base](#principes-de-base)
- [Authentification locale (toujours disponible)](#authentification-locale)
- [OIDC (OpenID Connect)](#oidc-configuration)
- [SAML v2](#saml-configuration)
- [Logout](#logout)
- [Tests et validation](#tests-et-validation)
- [Dépannage](#dépannage)

---

## Principes de base

### Garanties de compatibilité

1. **Sans configuration SSO** :
   - L'application fonctionne exactement comme avant
   - Aucun bouton SSO n'apparaît sur l'interface de login
   - Les endpoints SSO retournent 404
   - L'authentification locale fonctionne parfaitement

2. **Avec SSO activé** :
   - L'authentification locale reste disponible et prioritaire
   - Des boutons SSO apparaissent en plus sur l'interface de login
   - Les utilisateurs peuvent choisir entre login local ou SSO
   - Les sessions JWT fonctionnent de manière identique

3. **Coexistence locale + SSO** :
   - Un utilisateur peut avoir un compte local
   - Un utilisateur peut avoir une identité SSO
   - Un utilisateur peut avoir les deux (liaison automatique par email)
   - Les guards et middleware JWT ne changent pas

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Vue.js)                        │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Login Form   │  │ SSO Buttons  │  │ Auth Store   │     │
│  │ (toujours)   │  │ (si activé)  │  │ (JWT token)  │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend (NestJS)                         │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ POST /login  │  │ OIDC Module  │  │ SAML Module  │     │
│  │ (toujours)   │  │ (optionnel)  │  │ (optionnel)  │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ AuthService - Génère JWT identique pour tous       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Database (Prisma)                                   │   │
│  │  - User (local password + SSO identities)          │   │
│  │  - SsoIdentity (OIDC/SAML links)                   │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Authentification locale

L'authentification locale est **toujours disponible** et ne nécessite aucune configuration.

### Endpoints

- `POST /api/auth/login` - Login avec email/password
- `GET /api/auth/me` - Récupérer l'utilisateur courant (JWT requis)
- `POST /api/auth/logout` - Logout (local ou SSO)

### Exemple

```bash
# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "admin123"}'

# Réponse
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid",
    "email": "admin@example.com",
    "role": "ADMIN"
  }
}

# Utiliser le token
curl http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

### UI

Le formulaire de login local est toujours visible :

```vue
<form @submit.prevent="onSubmit">
  <input v-model="email" type="email" required />
  <input v-model="password" type="password" required />
  <button type="submit">Se connecter</button>
</form>
```

---

## OIDC Configuration

### Activation

Pour activer OIDC, définir ces variables d'environnement :

```bash
# Requis
SSO_OIDC_ENABLED=true
SSO_OIDC_ISSUER=https://your-idp.com
SSO_OIDC_CLIENT_ID=your-client-id
SSO_OIDC_CLIENT_SECRET=your-client-secret
SSO_OIDC_REDIRECT_URL=http://localhost:3001/api/auth/oidc/callback

# Optionnel
SSO_OIDC_SCOPES=openid email profile
SSO_OIDC_PKCE=true
SSO_OIDC_TOKEN_AUTH=client_secret_post
SSO_OIDC_SKIP_TOKEN_VERIFY=false
SSO_OIDC_LOGOUT_URL=https://your-idp.com/logout
```

### Endpoints

- `GET /api/auth/oidc/login` - Initie le flux OIDC (redirige vers IdP)
- `GET /api/auth/oidc/callback` - Callback après authentification IdP

### Flux d'authentification

```
1. User clique "Login with OIDC" sur UI
   ↓
2. Frontend redirige vers GET /api/auth/oidc/login
   ↓
3. Backend redirige vers IdP (ex: https://idp.com/authorize?client_id=...)
   ↓
4. User s'authentifie sur IdP
   ↓
5. IdP redirige vers /api/auth/oidc/callback?code=...
   ↓
6. Backend échange code contre tokens
   ↓
7. Backend récupère profil user (email)
   ↓
8. Backend trouve ou crée user
   ↓
9. Backend génère JWT (identique au login local)
   ↓
10. Backend redirige vers frontend avec token
```

### Mapping utilisateur (non-destructif)

Le système lie automatiquement les identités OIDC aux utilisateurs existants :

1. **Identité OIDC existante** : Réutilise l'utilisateur lié
2. **Utilisateur local existant (même email)** : Lie l'identité OIDC à l'utilisateur existant sans modification
3. **Nouvel utilisateur** : Crée un utilisateur et une identité OIDC

```typescript
// Exemple de liaison automatique
// 1. User local existe déjà
const localUser = { email: 'john@example.com', passwordHash: '...' };

// 2. Login OIDC avec même email
const oidcProfile = { sub: 'oidc-123', email: 'john@example.com' };

// 3. Système crée juste une SsoIdentity, n'altère PAS le user local
await prisma.ssoIdentity.create({
  data: {
    provider: 'OIDC',
    subject: 'oidc-123',
    email: 'john@example.com',
    userId: localUser.id, // Lie à l'utilisateur existant
  },
});

// 4. L'utilisateur peut maintenant se connecter via :
//    - Login local (email + password)
//    - Login OIDC (via IdP)
```

### Tests

```bash
# Test mapping OIDC
cd apps/api
DATABASE_URL="postgresql://..." pnpm test:oidc-mapping

# Test que login local fonctionne toujours
DATABASE_URL="postgresql://..." pnpm test:auth-local
```

---

## SAML Configuration

### Activation

Pour activer SAML, définir ces variables d'environnement :

```bash
# Requis
SSO_SAML_ENABLED=true
SSO_SAML_ENTRY_POINT=https://idp.example.com/sso/saml
SSO_SAML_ISSUER=https://your-app.com
SSO_SAML_CALLBACK_URL=http://localhost:3001/api/auth/saml/callback
SSO_SAML_IDP_CERT="-----BEGIN CERTIFICATE-----
MIIDXTCCAkWgAwIBAgIJALmVVuDWu4NYMA0GCSqGSIb3DQEBCwUAMEUxCzAJBgNV
...
-----END CERTIFICATE-----"

# Optionnel
SSO_SAML_AUDIENCE=https://your-app.com
SSO_SAML_CLOCK_SKEW_MS=5000
SSO_SAML_FORCE_AUTHN=false
SSO_SAML_SIGNATURE_ALGORITHM=sha256
SSO_SAML_EMAIL_ATTRIBUTE=email
SSO_SAML_EMAIL_FALLBACKS=mail,emailAddress,Email
SSO_SAML_LOGOUT_URL=https://idp.example.com/saml/logout
```

### Endpoints

- `GET /api/auth/saml/login` - Initie le flux SAML (redirige vers IdP)
- `POST /api/auth/saml/callback` - Callback après authentification IdP

### Flux d'authentification

```
1. User clique "Login with SAML" sur UI
   ↓
2. Frontend redirige vers GET /api/auth/saml/login
   ↓
3. Backend génère SAMLRequest et redirige vers IdP
   ↓
4. User s'authentifie sur IdP
   ↓
5. IdP POST SAMLResponse vers /api/auth/saml/callback
   ↓
6. Backend valide signature IdP
   ↓
7. Backend valide contraintes temporelles (NotBefore/NotOnOrAfter)
   ↓
8. Backend valide audience
   ↓
9. Backend extrait email (attribut + fallbacks + nameID)
   ↓
10. Backend trouve ou crée user (non-destructif)
    ↓
11. Backend génère JWT (identique au login local)
    ↓
12. Backend retourne JWT au frontend
```

### Sécurité

Toutes les validations SAML sont implémentées :

- ✅ Validation de signature IdP (certificat)
- ✅ Validation temporelle (NotBefore/NotOnOrAfter avec tolérance)
- ✅ Validation d'audience
- ✅ Validation d'issuer (logguée, non-bloquante)
- ✅ Protection contre fuites d'information (SAML response jamais logguée)

### Mapping utilisateur (non-destructif)

Identique à OIDC - voir section OIDC ci-dessus.

### Tests

```bash
# Test mapping SAML
cd apps/api
DATABASE_URL="postgresql://..." pnpm test:saml-mapping

# Test que login local fonctionne toujours
DATABASE_URL="postgresql://..." pnpm test:auth-local
```

### Documentation détaillée

Voir [SAML_CONFIGURATION.md](./SAML_CONFIGURATION.md) pour plus de détails.

---

## Logout

Le logout est compatible avec SSO tout en maintenant le comportement existant pour l'authentification locale.

### Comportement

1. **Utilisateur local** :
   - `POST /api/auth/logout` supprime la session locale
   - Aucune redirection vers IdP

2. **Utilisateur SSO sans URL de logout configurée** :
   - `POST /api/auth/logout` supprime la session locale
   - Aucune redirection vers IdP (MVP)

3. **Utilisateur SSO avec URL de logout configurée** :
   - `POST /api/auth/logout` supprime la session locale
   - Retourne l'URL de logout IdP
   - Frontend redirige vers IdP pour logout complet

### Configuration

```bash
# Optionnel - URL de logout OIDC
SSO_OIDC_LOGOUT_URL=https://your-idp.com/logout

# Optionnel - URL de logout SAML
SSO_SAML_LOGOUT_URL=https://idp.example.com/saml/logout
```

### Exemple

```typescript
// Frontend - auth store
async logout() {
  const response = await fetch('/api/auth/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${this.token}` },
  });

  const data = await response.json();

  // Toujours nettoyer la session locale
  this.token = null;
  this.user = null;
  localStorage.removeItem('auth');

  // Rediriger vers IdP si fourni
  if (data.ssoLogoutUrl) {
    window.location.href = data.ssoLogoutUrl;
  }
}
```

### Tests

```bash
cd apps/api
DATABASE_URL="postgresql://..." pnpm test:logout
```

---

## Tests et validation

### Check-list automatisée

La suite de tests `sso-optional.test.js` garantit que SSO est vraiment optionnel :

```bash
cd apps/api
DATABASE_URL="postgresql://..." pnpm test:sso-optional
```

**Tests exécutés** :

#### ✅ Scénario 1 : Sans configuration SSO

- [ ] `/auth/sso/providers` retourne un tableau vide
- [ ] Endpoints OIDC retournent 404
- [ ] Endpoints SAML retournent 404
- [ ] Login local fonctionne parfaitement
- [ ] Protected routes fonctionnent avec JWT local
- [ ] Logout fonctionne sans SSO

#### ✅ Scénario 2 : Avec OIDC activé

- [ ] `/auth/sso/providers` inclut OIDC
- [ ] Login local fonctionne toujours
- [ ] Endpoints OIDC sont disponibles (pas 404)

#### ✅ Scénario 3 : Avec SAML activé

- [ ] `/auth/sso/providers` inclut SAML
- [ ] Login local fonctionne toujours
- [ ] Endpoints SAML sont disponibles (pas 404)

#### ✅ Scénario 4 : JWT & Guards

- [ ] JWT guards fonctionnent identiquement avec ou sans SSO
- [ ] Protected routes retournent 401 sans token
- [ ] Protected routes retournent 401 avec token invalide
- [ ] Protected routes retournent 200 avec token valide

#### ✅ Scénario 5 : Sessions

- [ ] Sessions JWT fonctionnent identiquement avec ou sans SSO
- [ ] Token fonctionne sur plusieurs requêtes
- [ ] Logout ne casse pas les sessions

### Tous les tests

```bash
cd apps/api

# Test 1: Auth locale (toujours disponible)
DATABASE_URL="postgresql://..." pnpm test:auth-local

# Test 2: Mapping OIDC (non-destructif)
DATABASE_URL="postgresql://..." pnpm test:oidc-mapping

# Test 3: Mapping SAML (non-destructif)
DATABASE_URL="postgresql://..." pnpm test:saml-mapping

# Test 4: Logout (local + SSO)
DATABASE_URL="postgresql://..." pnpm test:logout

# Test 5: SSO optionnel (check-list complète)
DATABASE_URL="postgresql://..." pnpm test:sso-optional

# Tous les tests
DATABASE_URL="postgresql://..." pnpm test:auth-local && \
DATABASE_URL="postgresql://..." pnpm test:oidc-mapping && \
DATABASE_URL="postgresql://..." pnpm test:saml-mapping && \
DATABASE_URL="postgresql://..." pnpm test:logout && \
DATABASE_URL="postgresql://..." pnpm test:sso-optional
```

---

## Dépannage

### SSO désactivé mais boutons visibles

**Problème** : Des boutons SSO apparaissent alors que `SSO_OIDC_ENABLED=false` et `SSO_SAML_ENABLED=false`.

**Diagnostic** :

```bash
curl http://localhost:3001/api/auth/sso/providers
# Devrait retourner: []
```

**Solution** : Vérifier que les variables d'environnement sont bien chargées.

### Login local ne fonctionne pas avec SSO activé

**Problème** : Impossible de se connecter avec email/password après activation SSO.

**Diagnostic** :

```bash
# Tester login local
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "admin123"}'

# Devrait retourner un accessToken
```

**Solution** : L'authentification locale est complètement indépendante du SSO. Vérifier :

- L'utilisateur existe en base de données
- Le mot de passe est correct
- Le endpoint `/api/auth/login` est accessible

### Utilisateur SSO ne peut pas se connecter localement

**Problème** : Un utilisateur créé via SSO ne peut pas se connecter avec email/password.

**Explication** : C'est normal ! Les utilisateurs SSO n'ont pas de mot de passe.

**Solutions** :

1. **Recommandé** : Toujours utiliser SSO pour cet utilisateur
2. **Alternative** : Créer un mot de passe manuellement en base de données

```sql
-- Option 2: Ajouter un mot de passe à un utilisateur SSO (déconseillé)
UPDATE "User"
SET "passwordHash" = '$2b$10$...' -- Hash bcrypt du mot de passe
WHERE email = 'sso-user@example.com';
```

### Endpoints SSO retournent 404

**Problème** : `/api/auth/oidc/login` ou `/api/auth/saml/login` retournent 404.

**Diagnostic** :

```bash
# Vérifier si OIDC est activé
curl http://localhost:3001/api/auth/sso/providers
# Devrait inclure {"id": "oidc", ...}

# Vérifier si SAML est activé
curl http://localhost:3001/api/auth/sso/providers
# Devrait inclure {"id": "saml", ...}
```

**Solution** : Vérifier les variables d'environnement :

```bash
# Pour OIDC
SSO_OIDC_ENABLED=true

# Pour SAML
SSO_SAML_ENABLED=true
```

### JWT invalide après login SSO

**Problème** : Le token JWT retourné après login SSO ne fonctionne pas.

**Diagnostic** :

```bash
# Décoder le JWT (sans vérification)
echo "eyJhbGciOiJIUzI1NiIs..." | base64 -d

# Devrait contenir: {"sub": "uuid", "email": "...", "role": "..."}
```

**Solution** : Le JWT généré après login SSO est identique à celui du login local. Vérifier :

- Le secret JWT est correct (`JWT_SECRET`)
- Le token n'a pas expiré (`JWT_EXPIRES_IN`)
- Le guard JWT est bien configuré

### Session perdue après logout SSO

**Problème** : Après logout SSO, l'utilisateur est redirigé vers IdP mais la session locale reste.

**Explication** : Le frontend doit nettoyer la session locale avant la redirection vers IdP.

**Solution** : Vérifier que le frontend appelle bien :

```typescript
// 1. Nettoyer la session locale
this.token = null;
this.user = null;
localStorage.removeItem('auth');

// 2. Rediriger vers IdP
if (data.ssoLogoutUrl) {
  window.location.href = data.ssoLogoutUrl;
}
```

---

## Résumé

### ✅ Garanties

1. **SSO est optionnel** - L'app fonctionne exactement comme avant sans config SSO
2. **Login local toujours disponible** - Même avec SSO activé
3. **Coexistence pacifique** - Local et SSO peuvent coexister
4. **JWT identique** - Même format de token pour local et SSO
5. **Guards inchangés** - Protection des routes fonctionne pareil
6. **Sessions inchangées** - Mécanisme de session identique
7. **Non-destructif** - SSO ne modifie jamais les utilisateurs existants
8. **Testé** - Suite complète de tests automatisés

### 📋 Check-list de déploiement

Avant de déployer SSO en production :

- [ ] Tests locaux passent (`pnpm test:sso-optional`)
- [ ] Login local fonctionne sans config SSO
- [ ] Login local fonctionne avec config SSO
- [ ] Variables d'environnement SSO configurées
- [ ] Certificats IdP valides (SAML)
- [ ] URLs de callback configurées sur IdP
- [ ] Tests de bout en bout effectués
- [ ] Plan de rollback préparé

### 🔗 Ressources

- [OIDC_CONFIGURATION.md](./OIDC_CONFIGURATION.md) - Configuration OIDC détaillée
- [SAML_CONFIGURATION.md](./SAML_CONFIGURATION.md) - Configuration SAML détaillée
- [Test suite](../test/sso-optional.test.js) - Tests automatisés
