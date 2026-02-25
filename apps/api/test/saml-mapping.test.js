const { test } = require('node:test');
const assert = require('node:assert/strict');
const { SamlUserMapper } = require('../dist/modules/auth-sso/saml/saml-user-mapper');
const { SsoProvider } = require('@prisma/client');

const makeUser = (id, email) => ({
  id,
  email,
  role: 'ADMIN',
  createdAt: new Date(),
  updatedAt: new Date(),
});

test('SAML mapping uses existing identity user', async () => {
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

  const mapper = new SamlUserMapper(usersService, ssoIdentityService);
  const result = await mapper.resolveUser(SsoProvider.SAML, {
    nameID: 'saml-sub-1',
    email: user.email,
  });

  assert.equal(result.id, user.id);
  assert.equal(created, false);
});

test('SAML mapping links existing user by email (non-destructive)', async () => {
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

  const mapper = new SamlUserMapper(usersService, ssoIdentityService);
  const result = await mapper.resolveUser(SsoProvider.SAML, {
    nameID: 'saml-sub-2',
    email: user.email,
  });

  assert.equal(result.id, user.id);
  assert.deepEqual(createdIdentity, {
    provider: SsoProvider.SAML,
    subject: 'saml-sub-2',
    email: user.email,
    userId: user.id,
  });
});

test('SAML mapping creates user when none exists', async () => {
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

  const mapper = new SamlUserMapper(usersService, ssoIdentityService);
  const result = await mapper.resolveUser(SsoProvider.SAML, {
    nameID: 'saml-sub-3',
    email: user.email,
  });

  assert.equal(result.id, user.id);
  assert.equal(createdUser, true);
  assert.equal(createdIdentity, true);
});

test('SAML mapping requires email', async () => {
  const usersService = {
    findByEmail: async () => null,
    createSsoUser: async () => null,
  };
  const ssoIdentityService = {
    findByProviderSubject: async () => null,
    createIdentity: async () => null,
  };

  const mapper = new SamlUserMapper(usersService, ssoIdentityService);
  await assert.rejects(
    () =>
      mapper.resolveUser(SsoProvider.SAML, {
        nameID: 'saml-sub-4',
        email: null,
      }),
    /SAML email missing/,
  );
});

test('SAML mapping requires nameID (subject)', async () => {
  const usersService = {
    findByEmail: async () => null,
    createSsoUser: async () => null,
  };
  const ssoIdentityService = {
    findByProviderSubject: async () => null,
    createIdentity: async () => null,
  };

  const mapper = new SamlUserMapper(usersService, ssoIdentityService);
  await assert.rejects(
    () =>
      mapper.resolveUser(SsoProvider.SAML, {
        nameID: null,
        email: 'test@example.com',
      }),
    /SAML subject \(nameID\) missing/,
  );
});

test('SAML email attribute extraction with primary attribute', async () => {
  // This would test the SamlService extractProfile method
  // For now we verify the behavior through the mapper
  const user = makeUser('u-5', 'david@example.com');

  const usersService = {
    findByEmail: async (email) => {
      if (email === 'david@example.com') return user;
      return null;
    },
    createSsoUser: async () => null,
  };

  const ssoIdentityService = {
    findByProviderSubject: async () => null,
    createIdentity: async () => ({ user }),
  };

  const mapper = new SamlUserMapper(usersService, ssoIdentityService);
  const result = await mapper.resolveUser(SsoProvider.SAML, {
    nameID: 'saml-sub-5',
    email: 'david@example.com',
  });

  assert.equal(result.email, 'david@example.com');
});

test('SAML email attribute extraction with fallback', async () => {
  // Simulating what SamlService does with fallback attributes
  const user = makeUser('u-6', 'eve@example.com');

  const usersService = {
    findByEmail: async (email) => {
      if (email === 'eve@example.com') return user;
      return null;
    },
    createSsoUser: async () => null,
  };

  const ssoIdentityService = {
    findByProviderSubject: async () => null,
    createIdentity: async () => ({ user }),
  };

  const mapper = new SamlUserMapper(usersService, ssoIdentityService);

  // Profile with email from fallback attribute
  const result = await mapper.resolveUser(SsoProvider.SAML, {
    nameID: 'saml-sub-6',
    email: 'eve@example.com', // Would come from fallback in real scenario
  });

  assert.equal(result.email, 'eve@example.com');
});
