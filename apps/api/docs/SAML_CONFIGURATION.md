# Configuration SAML v2 (SP-Initiated)

## Vue d'ensemble

L'API Qubeless supporte désormais l'authentification SAML v2 en mode SP-initiated (Service Provider initiated). Cette implémentation inclut toutes les validations de sécurité nécessaires et est compatible avec les Identity Providers (IdP) SAML standards.

## Feature Toggle

SAML peut être activé ou désactivé via la variable d'environnement :

```bash
SSO_SAML_ENABLED=true
```

Si `SSO_SAML_ENABLED=false` ou non défini :
- Les routes `/auth/saml/login` et `/auth/saml/callback` retournent une erreur 404
- SAML n'apparaît pas dans la liste des providers SSO

## Variables d'environnement

### Configuration obligatoire

```bash
# Activer SAML
SSO_SAML_ENABLED=true

# URL du point d'entrée SSO de l'IdP
SSO_SAML_ENTRY_POINT=https://idp.example.com/sso

# Issuer/Entity ID du Service Provider (votre application)
SSO_SAML_ISSUER=https://your-app.com

# URL de callback pour recevoir la réponse SAML
SSO_SAML_CALLBACK_URL=https://your-app.com/api/auth/saml/callback

# Certificat public de l'IdP (format PEM, multiligne supporté)
SSO_SAML_IDP_CERT="-----BEGIN CERTIFICATE-----
MIIDXTCCAkWgAwIBAgIJALmVVuDWu4NYMA0GCSqGSIb3DQEBCwUAMEUxCzAJBgNV
...
-----END CERTIFICATE-----"
```

### Configuration optionnelle

```bash
# Audience/Entity ID attendu dans la réponse SAML (défaut: même valeur que ISSUER)
SSO_SAML_AUDIENCE=https://your-app.com

# Tolérance de décalage d'horloge en millisecondes (défaut: 5000 = 5 secondes)
SSO_SAML_CLOCK_SKEW_MS=5000

# Désactiver RequestedAuthnContext (défaut: false)
SSO_SAML_DISABLE_AUTHN_CONTEXT=false

# Forcer une nouvelle authentification à chaque fois (défaut: false)
SSO_SAML_FORCE_AUTHN=false

# Algorithme de signature (défaut: sha256)
# Valeurs possibles: sha256, sha512
SSO_SAML_SIGNATURE_ALGORITHM=sha256

# Nom de l'attribut email dans la réponse SAML (défaut: email)
SSO_SAML_EMAIL_ATTRIBUTE=email

# Attributs email de secours (séparés par des virgules, défaut: mail,emailAddress,Email)
SSO_SAML_EMAIL_FALLBACKS=mail,emailAddress,Email
```

## Endpoints

### GET /auth/saml/login

Initie le flux SAML en redirigeant vers l'IdP.

**Réponse:**
- `302 Redirect` vers l'IdP
- `404` si SAML désactivé
- `500` en cas d'erreur

### POST /auth/saml/callback

Reçoit et valide la réponse SAML de l'IdP.

**Body:** Form-encoded SAML response

**Réponse success (200):**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "ADMIN"
  }
}
```

**Réponses d'erreur:**
- `401` - Validation SAML échouée
- `404` - SAML désactivé

## Sécurité

### Validations implémentées

1. **Validation de signature IdP**
   - Vérification de la signature XML avec le certificat IdP
   - `wantAssertionsSigned: true` activé par défaut

2. **Validation temporelle (avec tolérance configurable)**
   - `NotBefore`: L'assertion n'est pas encore valide
   - `NotOnOrAfter`: L'assertion a expiré
   - Tolérance de décalage d'horloge configurable via `SSO_SAML_CLOCK_SKEW_MS`

3. **Validation d'audience**
   - Vérifie que l'assertion SAML est destinée à cette application
   - Compare `audience` dans la réponse avec `SSO_SAML_AUDIENCE`

4. **Validation d'issuer**
   - Logge l'issuer de la réponse pour audit
   - Ne bloque pas si différent (certains IdP utilisent des valeurs variables)

5. **Protection contre les fuites d'information**
   - La réponse SAML brute n'est jamais loggée
   - Les erreurs de validation retournent des messages génériques
   - Pas d'exposition des détails techniques aux clients

### Extraction d'email sécurisée

L'email est extrait selon cette logique avec fallbacks :

1. Attribut primaire configuré (`SSO_SAML_EMAIL_ATTRIBUTE`)
2. Attributs de secours (`SSO_SAML_EMAIL_FALLBACKS`)
3. `nameID` si format email

Si aucun email n'est trouvé, l'authentification échoue.

## Mapping utilisateur (non-destructif)

Le mapping des utilisateurs SAML suit une stratégie non-destructive :

1. **Identité SSO existante** : Si une `SsoIdentity` existe déjà pour ce provider/subject, l'utilisateur associé est utilisé.

2. **Utilisateur local existant** : Si aucune identité SSO n'existe mais qu'un utilisateur avec cet email existe déjà :
   - L'utilisateur existant est réutilisé
   - Une nouvelle `SsoIdentity` est créée pour lier SAML à cet utilisateur
   - **Aucune modification** n'est faite sur l'utilisateur existant

3. **Nouvel utilisateur** : Si ni identité ni utilisateur n'existent :
   - Un nouvel utilisateur SSO est créé
   - Une `SsoIdentity` est créée

## Session interne

Après validation SAML réussie, le système génère un JWT identique à celui de l'authentification locale :

- Même structure de payload
- Même durée de validité
- Compatible avec tous les endpoints protégés

L'utilisateur frontend ne voit aucune différence entre un login local et SAML.

## Tests

### Tests unitaires

```bash
# Tester le mapping utilisateur SAML
pnpm test:saml-mapping

# Vérifier que l'auth locale fonctionne toujours
pnpm test:auth-local

# Tous les tests mapping
pnpm test:oidc-mapping
pnpm test:saml-mapping
```

### Tests d'intégration

Les tests vérifient :
- Réutilisation d'identité existante
- Liaison non-destructive d'utilisateur local par email
- Création de nouvel utilisateur si nécessaire
- Validation des champs obligatoires (email, nameID)
- Extraction email avec attributs de fallback

## Configuration IdP recommandée

### Attributs SAML à mapper

L'IdP doit envoyer au minimum :

```xml
<saml:Attribute Name="email">
  <saml:AttributeValue>user@example.com</saml:AttributeValue>
</saml:Attribute>
```

Attributs de secours supportés : `mail`, `emailAddress`, `Email`

### Format nameID

Formats supportés :
- `urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress`
- `urn:oasis:names:tc:SAML:2.0:nameid-format:persistent`
- `urn:oasis:names:tc:SAML:2.0:nameid-format:transient`

Le `nameID` est utilisé comme identifiant unique (subject) pour lier l'identité.

### Métadonnées SP

Pour configurer l'IdP, fournir :

- **Entity ID**: Valeur de `SSO_SAML_ISSUER`
- **Assertion Consumer Service URL**: Valeur de `SSO_SAML_CALLBACK_URL`
- **Name ID Format**: Persistent ou EmailAddress
- **Signature requise**: Oui (assertions signées)

## Dépannage

### SAML désactivé

**Symptôme**: Routes retournent 404
**Solution**: Vérifier `SSO_SAML_ENABLED=true`

### Config missing

**Erreur**: `SAML config missing (SSO_SAML_ENTRY_POINT/ISSUER/CALLBACK_URL/IDP_CERT)`
**Solution**: Vérifier que les 4 variables obligatoires sont définies

### Validation failed

**Symptôme**: `SAML validation failed` (401)
**Causes possibles**:
- Certificat IdP incorrect
- Signature invalide
- Assertion expirée (vérifier `SSO_SAML_CLOCK_SKEW_MS`)
- Audience mismatch (vérifier `SSO_SAML_AUDIENCE`)

### Email missing

**Erreur**: `SAML email missing` (401)
**Solution**:
- Vérifier que l'IdP envoie l'attribut email
- Ajuster `SSO_SAML_EMAIL_ATTRIBUTE` si nécessaire
- Ajouter des fallbacks via `SSO_SAML_EMAIL_FALLBACKS`

## Exemple de configuration complète

```bash
# SAML Configuration
SSO_SAML_ENABLED=true
SSO_SAML_ENTRY_POINT=https://idp.example.com/sso/saml
SSO_SAML_ISSUER=https://qubeless.example.com
SSO_SAML_CALLBACK_URL=https://qubeless.example.com/api/auth/saml/callback
SSO_SAML_AUDIENCE=https://qubeless.example.com
SSO_SAML_IDP_CERT="-----BEGIN CERTIFICATE-----
MIIDXTCCAkWgAwIBAgIJALmVVuDWu4NYMA0GCSqGSIb3DQEBCwUAMEUxCzAJBgNV
BAYTAkZSMRMwEQYDVQQIDApTb21lLVN0YXRlMSEwHwYDVQQKDBhJbnRlcm5ldCBX
...
-----END CERTIFICATE-----"

# Options avancées (optionnel)
SSO_SAML_CLOCK_SKEW_MS=10000
SSO_SAML_FORCE_AUTHN=false
SSO_SAML_SIGNATURE_ALGORITHM=sha256
SSO_SAML_EMAIL_ATTRIBUTE=mail
SSO_SAML_EMAIL_FALLBACKS=email,emailAddress,mail
```
