import { defineStore } from 'pinia';
import type { OrganizationDTO } from '@qubeless/shared';
import { useAuthStore } from './auth';

interface OrgState {
  organizations: OrganizationDTO[];
  currentOrganization: OrganizationDTO | null;
  loading: boolean;
  error: string | null;
}

export const useOrganizationsStore = defineStore('organizations', {
  state: (): OrgState => ({
    organizations: [],
    currentOrganization: null,
    loading: false,
    error: null,
  }),

  getters: {
    currentOrgSlug(state): string | null {
      return state.currentOrganization?.slug ?? null;
    },
  },

  actions: {
    async fetchOrganizations() {
      this.loading = true;
      this.error = null;
      const authStore = useAuthStore();

      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/organizations`, {
          headers: {
            Authorization: `Bearer ${authStore.token}`,
          },
        });
        if (!response.ok) throw new Error('Failed to fetch organizations');
        this.organizations = await response.json();

        // Set first org as current if none selected
        if (!this.currentOrganization && this.organizations.length > 0) {
          const savedSlug = localStorage.getItem('qubeless_current_org');
          const savedOrg = savedSlug
            ? this.organizations.find(o => o.slug === savedSlug)
            : null;
          this.currentOrganization = savedOrg || this.organizations[0];
        }
      } catch (error: any) {
        this.error = error.message;
      } finally {
        this.loading = false;
      }
    },

    setCurrentOrganization(org: OrganizationDTO) {
      this.currentOrganization = org;
      localStorage.setItem('qubeless_current_org', org.slug);
    },

    loadCurrentOrgFromStorage() {
      const slug = localStorage.getItem('qubeless_current_org');
      if (slug && this.organizations.length > 0) {
        const org = this.organizations.find(o => o.slug === slug);
        if (org) {
          this.currentOrganization = org;
        }
      }
    },
  },
});
