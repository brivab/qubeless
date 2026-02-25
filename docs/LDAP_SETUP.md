# LDAP/Active Directory Authentication Setup

This guide explains how to configure LDAP/Active Directory authentication for Qubeless.

## Overview

Qubeless supports LDAP authentication as an optional authentication method alongside local authentication and SSO (OIDC/SAML). When enabled, users can authenticate using their corporate LDAP credentials.

## Features

- **Optional Authentication**: LDAP can be enabled or disabled without affecting existing authentication methods
- **Auto-provisioning**: Users are automatically created in Qubeless on first LDAP login
- **Identity Linking**: Existing users can be linked to their LDAP identities
- **Fallback Support**: Local authentication remains available even when LDAP is enabled

## Configuration

### Environment Variables

Add the following environment variables to your [apps/api/.env](apps/api/.env) file:

```bash
# LDAP/Active Directory Configuration (optional)
LDAP_ENABLED=true
LDAP_URL=ldap://ldap.example.com:389
LDAP_BIND_DN=cn=admin,dc=example,dc=com
LDAP_BIND_PASSWORD=secret
LDAP_BASE_DN=dc=example,dc=com
LDAP_SEARCH_FILTER=(uid={{username}})
LDAP_GROUP_BASE_DN=ou=groups,dc=example,dc=com
LDAP_GROUP_SEARCH_FILTER=(member={{dn}})
LDAP_USER_ATTR_USERNAME=uid
LDAP_USER_ATTR_EMAIL=mail
LDAP_USER_ATTR_DISPLAY_NAME=cn
```

### Configuration Parameters

| Variable                      | Required | Default              | Description                                                                                     |
| ----------------------------- | -------- | -------------------- | ----------------------------------------------------------------------------------------------- |
| `LDAP_ENABLED`                | Yes      | `false`              | Enable/disable LDAP authentication                                                              |
| `LDAP_URL`                    | Yes      | -                    | LDAP server URL (e.g., `ldap://ldap.example.com:389` or `ldaps://ldap.example.com:636` for SSL) |
| `LDAP_BIND_DN`                | Yes      | -                    | Distinguished Name (DN) for the bind user                                                       |
| `LDAP_BIND_PASSWORD`          | Yes      | -                    | Password for the bind user                                                                      |
| `LDAP_BASE_DN`                | Yes      | -                    | Base DN for user searches (e.g., `dc=example,dc=com`)                                           |
| `LDAP_SEARCH_FILTER`          | No       | `(uid={{username}})` | LDAP search filter. Use `{{username}}` placeholder for the username                             |
| `LDAP_GROUP_BASE_DN`          | No       | -                    | Base DN for group searches (optional, for future group sync)                                    |
| `LDAP_GROUP_SEARCH_FILTER`    | No       | -                    | Group search filter (optional, for future group sync)                                           |
| `LDAP_USER_ATTR_USERNAME`     | No       | `uid`                | LDAP attribute name for username                                                                |
| `LDAP_USER_ATTR_EMAIL`        | No       | `mail`               | LDAP attribute name for email                                                                   |
| `LDAP_USER_ATTR_DISPLAY_NAME` | No       | `cn`                 | LDAP attribute name for display name                                                            |

### Common Search Filters

- **OpenLDAP**: `(uid={{username}})`
- **Active Directory (username)**: `(sAMAccountName={{username}})`
- **Active Directory (email)**: `(userPrincipalName={{username}}@example.com)`
- **Combined AD filter**: `(|(sAMAccountName={{username}})(userPrincipalName={{username}}@example.com))`

### Active Directory Example

```bash
LDAP_ENABLED=true
LDAP_URL=ldap://ad.company.com:389
LDAP_BIND_DN=CN=Service Account,CN=Users,DC=company,DC=com
LDAP_BIND_PASSWORD=ServiceAccountPassword
LDAP_BASE_DN=CN=Users,DC=company,DC=com
LDAP_SEARCH_FILTER=(sAMAccountName={{username}})
LDAP_USER_ATTR_USERNAME=sAMAccountName
LDAP_USER_ATTR_EMAIL=mail
LDAP_USER_ATTR_DISPLAY_NAME=displayName
```

## Database Migration

After configuring LDAP, run the Prisma migration to add LDAP as a supported SSO provider:

```bash
cd apps/api
npx prisma migrate dev
```

Or in production:

```bash
cd apps/api
npx prisma migrate deploy
```

## Usage

### Login Flow

1. When LDAP is enabled, users will see two tabs on the login page: **Local** and **LDAP**
2. Select the **LDAP** tab to authenticate with LDAP credentials
3. Enter your LDAP username (not email) and password
4. On successful authentication:
   - If the user doesn't exist, a new account is created automatically
   - If the user exists, their LDAP identity is linked to the existing account
   - A JWT token is issued for the session

### API Endpoints

- `GET /api/auth/ldap/enabled` - Check if LDAP authentication is enabled
- `POST /api/auth/login/ldap` - Authenticate with LDAP credentials

Example login request:

```bash
curl -X POST http://localhost:3001/api/auth/login/ldap \
  -H "Content-Type: application/json" \
  -d '{"username": "jdoe", "password": "userpassword"}'
```

## Security Considerations

1. **Use LDAPS**: For production environments, use LDAPS (LDAP over SSL/TLS) with port 636:

   ```bash
   LDAP_URL=ldaps://ldap.example.com:636
   ```

2. **Service Account**: Create a dedicated service account with minimal read-only permissions for the bind DN

3. **Filter Injection**: The search filter properly escapes special characters to prevent LDAP injection attacks

4. **Password Security**: Never commit LDAP credentials to version control. Use environment variables or secret management systems

## Troubleshooting

### Connection Issues

- Verify LDAP server is accessible from the API server
- Check firewall rules allow traffic on LDAP port (389 or 636)
- Test connectivity: `ldapsearch -x -H ldap://server:389 -D "bind_dn" -W`

### Authentication Failures

- Verify the search filter matches your LDAP schema
- Check the bind DN and password are correct
- Ensure base DN is correct for your LDAP structure
- Verify user attributes exist in your LDAP schema

### Logs

Enable debug logging to troubleshoot LDAP issues. Check the API logs for LDAP-related messages:

```bash
docker-compose -f docker-compose.dev.yml logs -f api
```

## Future Enhancements

- Group synchronization: Map LDAP/AD groups to Qubeless roles
- Multi-domain support: Support multiple LDAP servers
- Connection pooling: Improve performance for high-traffic scenarios
- TLS certificate validation: Add certificate pinning options

## Testing

A mock LDAP service test is included at [apps/api/src/modules/auth/ldap/ldap.service.spec.ts](apps/api/src/modules/auth/ldap/ldap.service.spec.ts).

To run tests:

```bash
pnpm --filter @qubeless/api test:unit
```
