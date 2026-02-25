const { test } = require('node:test');
const assert = require('node:assert/strict');
const { OidcUserMapper } = require('../dist/modules/auth-sso/oidc/oidc-user-mapper');
const { SsoProvider } = require('@prisma/client');

const makeUser = (id, email) => ({
  id,
  email,
  role: 'ADMIN',
  createdAt: new Date(),
  updatedAt: new Date(),
});

test('OIDC mapping uses existing identity user', async () => {
  const user = makeUser('u-1', 'alice@example.com');
  let created = false;

  const usersService = {
    findByEmail: async () => {
      throw new Error('findByEmail should not be called');
    },
    createSsoUser: async () => {
      throw new Error('createSsoUser should not be called');
    },
  };

  const ssoIdentityService = {
    findByProviderSubject: async () => ({ user }),
    createIdentity: async () => {
      created = true;
    },
  };

  const mapper = new OidcUserMapper(usersService, ssoIdentityService);
  const result = await mapper.resolveUser(SsoProvider.OIDC, { sub: 'sub-1', email: user.email });

  assert.equal(result.id, user.id);
  assert.equal(created, false);
});

test('OIDC mapping links existing user by email', async () => {
  const user = makeUser('u-2', 'bob@example.com');
  let createdIdentity = null;

  const usersService = {
    findByEmail: async () => user,
    createSsoUser: async () => {
      throw new Error('createSsoUser should not be called');
    },
  };

  const ssoIdentityService = {
    findByProviderSubject: async () => null,
    createIdentity: async (payload) => {
      createdIdentity = payload;
      return { user };
    },
  };

  const mapper = new OidcUserMapper(usersService, ssoIdentityService);
  const result = await mapper.resolveUser(SsoProvider.OIDC, { sub: 'sub-2', email: user.email });

  assert.equal(result.id, user.id);
  assert.deepEqual(createdIdentity, {
    provider: SsoProvider.OIDC,
    subject: 'sub-2',
    email: user.email,
    userId: user.id,
  });
});

test('OIDC mapping creates user when none exists', async () => {
  const user = makeUser('u-3', 'carol@example.com');
  let createdUser = false;
  let createdIdentity = false;

  const usersService = {
    findByEmail: async () => null,
    createSsoUser: async () => {
      createdUser = true;
      return user;
    },
  };

  const ssoIdentityService = {
    findByProviderSubject: async () => null,
    createIdentity: async () => {
      createdIdentity = true;
      return { user };
    },
  };

  const mapper = new OidcUserMapper(usersService, ssoIdentityService);
  const result = await mapper.resolveUser(SsoProvider.OIDC, { sub: 'sub-3', email: user.email });

  assert.equal(result.id, user.id);
  assert.equal(createdUser, true);
  assert.equal(createdIdentity, true);
});

test('OIDC mapping requires email', async () => {
  const usersService = {
    findByEmail: async () => null,
    createSsoUser: async () => null,
  };
  const ssoIdentityService = {
    findByProviderSubject: async () => null,
    createIdentity: async () => null,
  };

  const mapper = new OidcUserMapper(usersService, ssoIdentityService);
  await assert.rejects(
    () => mapper.resolveUser(SsoProvider.OIDC, { sub: 'sub-4', email: null }),
    /OIDC email missing/,
  );
});
