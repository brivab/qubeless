<template>
  <div class="page">
    <div class="page-header">
      <div>
        <RouterLink :to="{ name: 'organization', params: { slug: orgSlug } }" class="muted" style="font-size: 14px">
          ← {{ organization?.name ?? 'Organization' }}
        </RouterLink>
        <h2 style="margin: 6px 0 0">Settings</h2>
        <p class="muted" style="margin: 4px 0 0">Manage organization members and settings</p>
      </div>
      <div class="actions">
        <button class="ghost-button" @click="loadAll" :disabled="loadingOrg || loadingMembers">
          {{ t('common.refresh') }}
        </button>
      </div>
    </div>

    <div v-if="loadingOrg" class="card">{{ t('organizations.loading') }}</div>
    <div v-else-if="orgError" class="card" style="color: #b91c1c;">{{ orgError }}</div>
    <div v-else>
      <!-- Organization Info -->
      <div class="card">
        <h3 style="margin-top: 0">Organization Information</h3>
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">Name</span>
            <span class="info-value">{{ organization?.name }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Slug</span>
            <span class="info-value">{{ organization?.slug }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Description</span>
            <span class="info-value">{{ organization?.description || 'No description' }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Created</span>
            <span class="info-value">{{ formatDate(organization?.createdAt) }}</span>
          </div>
        </div>
      </div>

      <!-- Members Management -->
      <div class="card">
        <div class="section-header">
          <h3 style="margin: 0">{{ t('members.title') }}</h3>
          <button class="ghost-button compact" @click="loadMembers" :disabled="loadingMembers">
            {{ t('common.refresh') }}
          </button>
        </div>

        <!-- Add Member Form -->
        <div class="add-member-form">
          <input
            v-model="newMember.email"
            type="email"
            :placeholder="t('members.emailPlaceholder')"
            class="member-input"
            :disabled="adding"
          />
          <select v-model="newMember.role" class="member-select" :disabled="adding">
            <option value="MEMBER">Member</option>
            <option value="ADMIN">Admin</option>
            <option value="OWNER">Owner</option>
          </select>
          <button @click="addMember" :disabled="adding || !newMember.email">
            {{ adding ? t('common.creating') : t('members.addButton') }}
          </button>
          <div v-if="addError" class="form-error">{{ addError }}</div>
          <div v-if="addSuccess" class="form-success">{{ addSuccess }}</div>
        </div>

        <!-- Members List -->
        <div v-if="loadingMembers && members.length === 0">{{ t('members.loading') }}</div>
        <div v-else-if="membersError" class="form-error">{{ membersError }}</div>
        <div v-else-if="members.length === 0" class="muted">{{ t('members.noMembers') }}</div>
        <div v-else class="members-list">
          <div v-for="member in members" :key="member.id" class="member-row">
            <div class="member-info">
              <div class="member-email">{{ member.user.email }}</div>
              <div class="muted member-date">{{ t('members.addedOn') }} {{ formatDate(member.createdAt) }}</div>
            </div>

            <div class="member-actions">
              <select
                v-model="memberRoles[member.id]"
                @change="updateMemberRole(member)"
                class="member-select-inline"
                :disabled="updatingMembers[member.id]"
              >
                <option value="MEMBER">Member</option>
                <option value="ADMIN">Admin</option>
                <option value="OWNER">Owner</option>
              </select>

              <button
                class="ghost-button danger compact"
                @click="removeMember(member)"
                :disabled="removingMembers[member.id]"
              >
                {{ removingMembers[member.id] ? t('common.deleting') : t('common.delete') }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import {
  getOrganization,
  getOrganizationMembers,
  addOrganizationMember,
  removeOrganizationMember,
  type Organization,
  type OrganizationMember,
  type OrgRole,
} from '../services/api';
import { useAuthStore } from '../stores/auth';
import { useI18n } from '../i18n';

const route = useRoute();
const orgSlug = route.params.slug as string;

const { t, locale, getLocaleTag } = useI18n();
const authStore = useAuthStore();

const organization = ref<Organization | null>(null);
const members = ref<OrganizationMember[]>([]);
const loadingOrg = ref(false);
const loadingMembers = ref(false);
const orgError = ref<string | null>(null);
const membersError = ref<string | null>(null);
const adding = ref(false);
const addError = ref<string | null>(null);
const addSuccess = ref<string | null>(null);

const newMember = reactive({
  email: '',
  role: 'MEMBER' as OrgRole,
});

const memberRoles = reactive<Record<string, OrgRole>>({});
const updatingMembers = reactive<Record<string, boolean>>({});
const removingMembers = reactive<Record<string, boolean>>({});

function formatDate(dateString?: string | null) {
  if (!dateString) return t('common.notAvailable');
  return new Date(dateString).toLocaleString(getLocaleTag(locale.value), {
    dateStyle: 'medium',
  });
}

async function loadAll() {
  await Promise.all([loadOrganization(), loadMembers()]);
}

async function loadOrganization() {
  loadingOrg.value = true;
  orgError.value = null;
  try {
    organization.value = await getOrganization(orgSlug);
  } catch (err: any) {
    orgError.value = err?.message ?? t('organizations.error');
  } finally {
    loadingOrg.value = false;
  }
}

async function loadMembers() {
  loadingMembers.value = true;
  membersError.value = null;
  try {
    const data = await getOrganizationMembers(orgSlug);
    members.value = data;

    // Initialize member roles
    data.forEach((member) => {
      memberRoles[member.id] = member.role;
    });
  } catch (err: any) {
    membersError.value = err?.message ?? t('members.errorLoad');
  } finally {
    loadingMembers.value = false;
  }
}

async function addMember() {
  if (!newMember.email) return;

  adding.value = true;
  addError.value = null;
  addSuccess.value = null;

  try {
    const member = await addOrganizationMember(orgSlug, {
      email: newMember.email,
      role: newMember.role,
    });

    members.value.push(member);
    memberRoles[member.id] = member.role;

    // Reset form
    newMember.email = '';
    newMember.role = 'MEMBER';

    addSuccess.value = t('members.addSuccess');
    setTimeout(() => {
      addSuccess.value = null;
    }, 3000);
  } catch (err: any) {
    addError.value = err?.message ?? t('members.errorAdd');
  } finally {
    adding.value = false;
  }
}

async function updateMemberRole(member: OrganizationMember) {
  const newRole = memberRoles[member.id];
  if (newRole === member.role) return;

  updatingMembers[member.id] = true;
  membersError.value = null;

  try {
    // For organizations, we need to remove and re-add with new role
    // This matches the backend implementation
    await removeOrganizationMember(orgSlug, member.userId);
    const updated = await addOrganizationMember(orgSlug, {
      email: member.user.email,
      role: newRole,
    });

    // Update member in list
    const index = members.value.findIndex((m) => m.id === member.id);
    if (index !== -1) {
      members.value[index] = updated;
      memberRoles[updated.id] = updated.role;
    }
  } catch (err: any) {
    // Revert on error
    memberRoles[member.id] = member.role;
    membersError.value = err?.message ?? t('members.errorUpdate');
  } finally {
    updatingMembers[member.id] = false;
  }
}

async function removeMember(member: OrganizationMember) {
  if (!confirm(t('members.confirmDelete', { email: member.user.email }))) {
    return;
  }

  removingMembers[member.id] = true;
  membersError.value = null;

  try {
    await removeOrganizationMember(orgSlug, member.userId);

    // Remove from list
    members.value = members.value.filter((m) => m.id !== member.id);
    delete memberRoles[member.id];
  } catch (err: any) {
    membersError.value = err?.message ?? t('members.errorRemove');
  } finally {
    removingMembers[member.id] = false;
  }
}

onMounted(async () => {
  if (!authStore.initialized) {
    await authStore.initialize();
  }
  await loadAll();
});
</script>

<style scoped>
.page {
  @apply flex flex-col gap-4;
}

.page-header {
  @apply flex justify-between items-center mb-4;
}

.actions {
  @apply flex gap-3 items-end;
}

.info-grid {
  display: grid;
  @apply gap-4;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
}

.info-item {
  @apply flex flex-col gap-1;
}

.info-label {
  @apply text-xs uppercase font-semibold tracking-[0.3px];
  color: var(--text-muted);
}

.info-value {
  @apply text-sm font-medium;
  color: var(--text-primary);
}

.section-header {
  @apply flex justify-between items-center mb-4;
}

.ghost-button.compact {
  @apply px-3 py-1.5 text-sm;
}

.add-member-form {
  @apply flex gap-2.5 flex-wrap p-4 border-2 rounded-xl mb-4 transition-all duration-300;
  border-color: var(--border-primary);
  background: linear-gradient(135deg, var(--card-bg-start) 0%, var(--card-bg-end) 100%);
}

.member-input {
  @apply flex-1 min-w-[200px] border-2 rounded-lg py-2 px-3 text-sm transition-all duration-300;
  border-color: var(--input-border);
  background: var(--input-bg);
  color: var(--text-primary);
}

.member-input:focus {
  @apply outline-none;
  border-color: var(--input-border-focus);
  box-shadow: 0 0 0 3px var(--input-shadow-focus);
}

.member-select {
  @apply border-2 rounded-lg py-2 px-3 text-sm cursor-pointer transition-all duration-300;
  border-color: var(--input-border);
  background: var(--input-bg);
  color: var(--text-primary);
}

.member-select:focus {
  @apply outline-none;
  border-color: var(--input-border-focus);
  box-shadow: 0 0 0 3px var(--input-shadow-focus);
}

.members-list {
  @apply flex flex-col gap-3;
}

.member-row {
  @apply flex justify-between items-center gap-4 p-4 border-2 rounded-xl transition-all duration-300;
  border-color: var(--border-primary);
  background: linear-gradient(135deg, var(--card-bg-start) 0%, var(--card-bg-end) 100%);
}

.member-row:hover {
  border-color: var(--border-secondary);
  box-shadow: 0 4px 12px var(--card-shadow-hover);
}

.member-info {
  @apply flex-1;
}

.member-email {
  @apply font-semibold mb-1;
}

.member-date {
  @apply text-[13px];
}

.member-actions {
  @apply flex items-center gap-3;
}

.member-select-inline {
  @apply border-2 rounded-lg py-1.5 px-2.5 text-[13px] cursor-pointer transition-all duration-300;
  border-color: var(--input-border);
  background: var(--input-bg);
  color: var(--text-primary);
}

.member-select-inline:focus {
  @apply outline-none;
  border-color: var(--input-border-focus);
}

.ghost-button.danger {
  color: var(--danger-text);
}

.ghost-button.danger:hover:not(:disabled) {
  background: var(--danger-bg);
  border-color: var(--danger-border);
}

.form-error {
  @apply text-sm w-full border py-3 px-4 rounded-lg transition-all duration-300;
  color: var(--error-text);
  background: var(--error-bg);
  border-color: var(--error-border);
}

.form-success {
  @apply text-sm w-full border py-3 px-4 rounded-lg transition-all duration-300;
  color: var(--success-text);
  background: var(--success-bg);
  border-color: var(--success-border);
}
</style>
