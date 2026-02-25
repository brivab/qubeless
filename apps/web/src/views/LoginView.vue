<template>
  <div class="login-wrapper">
    <div class="card login-card">
      <div style="margin-bottom: 12px;">
        <div class="muted" style="letter-spacing: 0.4px;">QUBELESS</div>
        <h2 style="margin: 6px 0 0;">{{ t('login.title') }}</h2>
        <p class="muted" style="margin: 6px 0 0;">{{ t('login.subtitle') }}</p>
      </div>

      <!-- Login method tabs -->
      <div v-if="ldapEnabled" class="login-tabs">
        <button
          type="button"
          :class="['login-tab', { active: loginMethod === 'local' }]"
          @click="loginMethod = 'local'"
        >
          {{ t('login.localTab') }}
        </button>
        <button
          type="button"
          :class="['login-tab', { active: loginMethod === 'ldap' }]"
          @click="loginMethod = 'ldap'"
        >
          {{ t('login.ldapTab') }}
        </button>
      </div>

      <!-- Local Login Form -->
      <form v-if="loginMethod === 'local'" @submit.prevent="onSubmit">
        <div class="form-group">
          <label for="email">{{ t('login.email') }}</label>
          <input id="email" v-model="email" name="email" type="email" required autocomplete="email" data-cy="login-email" />
        </div>

        <div class="form-group">
          <label for="password">{{ t('login.password') }}</label>
          <input
            id="password"
            v-model="password"
            name="password"
            type="password"
            required
            autocomplete="current-password"
            data-cy="login-password"
          />
        </div>

        <div v-if="showMfaField" class="form-group">
          <label for="mfa-code">{{ t('login.mfaCode') }}</label>
          <input
            id="mfa-code"
            v-model="mfaCode"
            name="mfaCode"
            type="text"
            inputmode="numeric"
            autocomplete="one-time-code"
            pattern="[0-9]{6}"
            maxlength="6"
            placeholder="123456"
          />
        </div>

        <p v-if="auth.error || ssoError" style="color: #b91c1c; margin-top: 0; margin-bottom: 12px;">
          {{ auth.error || ssoError }}
        </p>

        <button type="submit" :disabled="auth.loading" style="width: 100%;" data-cy="login-submit">
          {{ auth.loading ? t('login.signingIn') : t('login.signIn') }}
        </button>
      </form>

      <!-- LDAP Login Form -->
      <form v-if="loginMethod === 'ldap'" @submit.prevent="onLdapSubmit">
        <div class="form-group">
          <label for="ldap-username">{{ t('login.username') }}</label>
          <input
            id="ldap-username"
            v-model="ldapUsername"
            name="username"
            type="text"
            required
            autocomplete="username"
          />
        </div>

        <div class="form-group">
          <label for="ldap-password">{{ t('login.password') }}</label>
          <input
            id="ldap-password"
            v-model="ldapPassword"
            name="password"
            type="password"
            required
            autocomplete="current-password"
          />
        </div>

        <div v-if="showLdapMfaField" class="form-group">
          <label for="ldap-mfa-code">{{ t('login.mfaCode') }}</label>
          <input
            id="ldap-mfa-code"
            v-model="ldapMfaCode"
            name="mfaCode"
            type="text"
            inputmode="numeric"
            autocomplete="one-time-code"
            pattern="[0-9]{6}"
            maxlength="6"
            placeholder="123456"
          />
        </div>

        <p v-if="ldapError" style="color: #b91c1c; margin-top: 0; margin-bottom: 12px;">
          {{ ldapError }}
        </p>

        <button type="submit" :disabled="ldapLoading" style="width: 100%;" data-cy="login-submit-ldap">
          {{ ldapLoading ? t('login.signingIn') : t('login.signIn') }}
        </button>
      </form>

      <div v-if="ssoProviders.length" class="login-sso">
        <div class="login-sso-title">{{ t('login.ssoTitle') }}</div>
        <p class="muted" style="margin: 0 0 12px;">{{ t('login.ssoHint') }}</p>
        <div class="login-sso-actions">
          <button
            v-for="provider in ssoProviders"
            :key="provider.id"
            type="button"
            class="ghost-button"
            @click="startSso(provider)"
          >
            {{ t('login.ssoButton', { provider: provider.label }) }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import { useI18n } from '../i18n';
import { getSsoProviders, type SsoProviderInfo, loginWithLdap, checkLdapEnabled } from '../services/api';

const isDev = import.meta.env.DEV;
const email = ref(isDev ? 'admin@example.com' : '');
const password = ref(isDev ? 'admin123' : '');
const ldapUsername = ref('');
const ldapPassword = ref('');
const mfaCode = ref('');
const ldapMfaCode = ref('');
const loginMethod = ref<'local' | 'ldap'>('local');
const ldapEnabled = ref(false);
const ldapLoading = ref(false);
const ldapError = ref<string>('');
const showMfaField = ref(false);
const showLdapMfaField = ref(false);
const auth = useAuthStore();
const router = useRouter();
const route = useRoute();
const { t } = useI18n();
const ssoProviders = ref<SsoProviderInfo[]>([]);
const ssoError = ref<string>('');
const RAW_API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api').replace(/\/$/, '');
const API_BASE_URL = `${RAW_API_URL.replace(/\/api$/, '')}/api`;

const onSubmit = async () => {
  try {
    await auth.login({
      email: email.value,
      password: password.value,
      mfaCode: mfaCode.value || undefined,
    });
    const redirect = (route.query.redirect as string) ?? '/dashboard';
    await router.push(redirect);
  } catch (error) {
    const code = (error as Error & { code?: string })?.code;
    if (code === 'MFA_REQUIRED' || code === 'MFA_INVALID' || code === 'MFA_SETUP_REQUIRED') {
      showMfaField.value = true;
    }
  }
};

const onLdapSubmit = async () => {
  ldapError.value = '';
  ldapLoading.value = true;
  try {
    const response = await loginWithLdap({
      username: ldapUsername.value,
      password: ldapPassword.value,
      mfaCode: ldapMfaCode.value || undefined,
    });
    auth.setToken(response.accessToken);
    auth.setUser(response.user);
    const redirect = (route.query.redirect as string) ?? '/dashboard';
    await router.push(redirect);
  } catch (error: any) {
    const message = extractErrorMessage(error);
    if (isMfaMessage(message)) {
      showLdapMfaField.value = true;
    }
    ldapError.value = message || t('login.ldapError');
  } finally {
    ldapLoading.value = false;
  }
};

const resolveSsoLoginUrl = (loginUrl: string) => {
  if (/^https?:\/\//i.test(loginUrl)) {
    return loginUrl;
  }
  if (loginUrl.startsWith('/api/')) {
    return `${API_BASE_URL}${loginUrl.slice(4)}`;
  }
  if (loginUrl.startsWith('/')) {
    return `${API_BASE_URL}${loginUrl}`;
  }
  return `${API_BASE_URL}/${loginUrl}`;
};

const startSso = (provider: SsoProviderInfo) => {
  window.location.href = resolveSsoLoginUrl(provider.loginUrl);
};

const extractErrorMessage = (error: any): string => {
  if (!error?.message) return '';
  const raw = String(error.message);
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.message) {
      return Array.isArray(parsed.message) ? parsed.message.join(', ') : parsed.message;
    }
  } catch {
    // ignore JSON parse errors
  }
  return raw;
};

const isMfaMessage = (message: string): boolean => {
  return (
    message === 'MFA code required' ||
    message === 'Invalid MFA code' ||
    message === 'MFA setup required' ||
    message.includes('MFA code required') ||
    message.includes('Invalid MFA code') ||
    message.includes('MFA setup required')
  );
};

onMounted(async () => {
  // Check for SSO callback errors
  const errorParam = route.query.error as string;
  if (errorParam) {
    ssoError.value = t('login.ssoError');
    console.error('[login] SSO error:', errorParam);
  }

  // Check if LDAP is enabled
  try {
    const ldapStatus = await checkLdapEnabled();
    ldapEnabled.value = ldapStatus.enabled;
    if (ldapStatus.enabled) {
      loginMethod.value = 'ldap'; // Default to LDAP if enabled
    }
  } catch (error) {
    console.warn('[login] failed to check LDAP status', error);
  }

  // Load SSO providers
  try {
    ssoProviders.value = await getSsoProviders();
  } catch (error) {
    console.warn('[login] failed to load SSO providers', error);
  }
});
</script>
