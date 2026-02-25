import { defineStore } from 'pinia';
import type { LoginRequest, LoginResponse, UserDTO } from '@qubeless/shared';

const RAW_API_BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api').replace(/\/$/, '');
const API_URL = `${RAW_API_BASE.replace(/\/api$/, '')}/api`;
export const AUTH_STORAGE_KEY = 'qubeless_auth';

interface StoredAuth {
  token: string;
  user: UserDTO | null;
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: null as string | null,
    user: null as UserDTO | null,
    initialized: false,
    loading: false,
    error: null as string | null,
  }),
  getters: {
    isAuthenticated(state) {
      return !!state.token;
    },
  },
  actions: {
    loadFromStorage() {
      const raw = localStorage.getItem(AUTH_STORAGE_KEY);
      if (!raw) return;

      try {
        const parsed = JSON.parse(raw) as StoredAuth;
        this.token = parsed.token;
        this.user = parsed.user;
        console.log('[auth] loaded from storage', { hasToken: !!this.token });
      } catch (error) {
        console.error('Failed to parse auth storage', error);
      }
    },
    persist() {
      if (!this.token) {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        return;
      }

      const payload: StoredAuth = { token: this.token, user: this.user };
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload));
    },
    setToken(token: string | null) {
      this.token = token;
      this.persist();
    },
    setUser(user: UserDTO | null) {
      this.user = user;
      this.persist();
    },
    async initialize() {
      this.loadFromStorage();
      if (this.token) {
        await this.fetchCurrentUser();
      } else {
        console.log('[auth] no token found, staying unauthenticated');
      }
      this.initialized = true;
    },
    async login(payload: LoginRequest) {
      this.loading = true;
      this.error = null;

      try {
        console.log('[auth] login attempt', { email: payload.email });
        const response = await fetch(`${API_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorBody = await response.json().catch(() => null);
          const message = Array.isArray(errorBody?.message)
            ? errorBody.message.join(', ')
            : errorBody?.message;
          if (message === 'MFA code required') {
            const err = new Error('Code MFA requis');
            (err as Error & { code?: string }).code = 'MFA_REQUIRED';
            throw err;
          }
          if (message === 'Invalid MFA code') {
            const err = new Error('Code MFA invalide');
            (err as Error & { code?: string }).code = 'MFA_INVALID';
            throw err;
          }
          if (message === 'MFA setup required') {
            const err = new Error('MFA non configurée');
            (err as Error & { code?: string }).code = 'MFA_SETUP_REQUIRED';
            throw err;
          }
          throw new Error(message || 'Identifiants invalides');
        }

        const data = (await response.json()) as LoginResponse;
        this.token = data.accessToken;
        this.user = data.user;
        console.log('[auth] login success', { user: data.user.email });
        this.persist();
        return data;
      } catch (error: any) {
        this.error = error?.message ?? 'Erreur de connexion';
        throw error;
      } finally {
        this.loading = false;
      }
    },
    async fetchCurrentUser() {
      if (!this.token) return null;

      try {
        const response = await fetch(`${API_URL}/users/me`, {
          headers: {
            Authorization: `Bearer ${this.token}`,
          },
        });

        if (!response.ok) {
          console.warn('[auth] fetchCurrentUser failed', { status: response.status });
          return null;
        }

        const user = (await response.json()) as UserDTO;
        this.user = user;
        console.log('[auth] fetchCurrentUser success', { email: user.email });
        this.persist();
        return user;
      } catch (error) {
        console.warn('[auth] fetchCurrentUser error', error);
        return null;
      }
    },
    async logout() {
      // Call backend logout endpoint if authenticated
      if (this.token) {
        try {
          const response = await fetch(`${API_URL}/auth/logout`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${this.token}`,
            },
          });

          if (response.ok) {
            const data = (await response.json()) as { ssoLogoutUrl?: string };

            // Clear local session first
            this.token = null;
            this.user = null;
            this.persist();

            // Redirect to IdP logout if provided
            if (data.ssoLogoutUrl) {
              console.log('[auth] redirecting to SSO logout', { url: data.ssoLogoutUrl });
              window.location.href = data.ssoLogoutUrl;
              return;
            }

            console.log('[auth] logout success');
          } else {
            console.warn('[auth] logout endpoint failed, clearing session anyway');
            // Clear local session
            this.token = null;
            this.user = null;
            this.persist();
          }
        } catch (error) {
          console.warn('[auth] logout request failed, clearing session anyway', error);
          // Clear local session
          this.token = null;
          this.user = null;
          this.persist();
        }
      } else {
        // Always clear local session (fallback)
        this.token = null;
        this.user = null;
        this.persist();
      }
    },
  },
});
