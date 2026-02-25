<template>
  <div class="members-container">
    <div class="section-header">
      <h3 style="margin: 0">{{ t('members.title') }}</h3>
      <button class="ghost-button" @click="loadMembers" :disabled="loading">
        {{ t('common.refresh') }}
      </button>
    </div>

    <!-- Add Member Form -->
    <div v-if="canManage" class="add-member-form">
      <input
        v-model="newMember.email"
        type="email"
        :placeholder="t('members.emailPlaceholder')"
        class="member-input"
        :disabled="adding"
      />
      <select v-model="newMember.role" class="member-select" :disabled="adding">
        <option value="PROJECT_VIEWER">{{ t('members.role.viewer') }}</option>
        <option value="PROJECT_MAINTAINER">{{ t('members.role.maintainer') }}</option>
        <option value="PROJECT_ADMIN">{{ t('members.role.admin') }}</option>
      </select>
      <button @click="addMember" :disabled="adding || !newMember.email">
        {{ adding ? t('common.creating') : t('members.addButton') }}
      </button>
      <div v-if="addError" class="form-error">{{ addError }}</div>
      <div v-if="addSuccess" class="form-success">{{ addSuccess }}</div>
    </div>

    <!-- Members List -->
    <div v-if="loading && members.length === 0">{{ t('members.loading') }}</div>
    <div v-else-if="error" class="form-error">{{ error }}</div>
    <div v-else-if="members.length === 0" class="muted">{{ t('members.noMembers') }}</div>
    <div v-else class="members-list">
      <div v-for="member in members" :key="member.id" class="member-row">
        <div class="member-info">
          <div class="member-email">{{ member.user.email }}</div>
          <div class="muted member-date">{{ t('members.addedOn') }} {{ formatDate(member.createdAt) }}</div>
        </div>

        <div class="member-actions">
          <select
            v-if="canManage"
            v-model="memberRoles[member.id]"
            @change="updateMemberRole(member)"
            class="member-select-inline"
            :disabled="updatingMembers[member.id]"
          >
            <option value="PROJECT_VIEWER">{{ t('members.role.viewer') }}</option>
            <option value="PROJECT_MAINTAINER">{{ t('members.role.maintainer') }}</option>
            <option value="PROJECT_ADMIN">{{ t('members.role.admin') }}</option>
          </select>
          <span v-else class="member-role-badge">{{ getRoleLabel(member.role) }}</span>

          <button
            v-if="canManage"
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
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import {
  getProjectMembers,
  addProjectMember,
  updateProjectMember,
  removeProjectMember,
  type ProjectMember,
  type ProjectRole,
} from '../services/api';
import { useI18n } from '../i18n';
import { useAuthStore } from '../stores/auth';

const props = defineProps<{
  projectKey: string;
  canManage: boolean;
}>();

const { t, locale, getLocaleTag } = useI18n();
const authStore = useAuthStore();

const members = ref<ProjectMember[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const adding = ref(false);
const addError = ref<string | null>(null);
const addSuccess = ref<string | null>(null);

const newMember = reactive({
  email: '',
  role: 'PROJECT_VIEWER' as ProjectRole,
});

const memberRoles = reactive<Record<string, ProjectRole>>({});
const updatingMembers = reactive<Record<string, boolean>>({});
const removingMembers = reactive<Record<string, boolean>>({});

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleString(getLocaleTag(locale.value), {
    dateStyle: 'medium',
  });
}

function getRoleLabel(role: ProjectRole): string {
  const roleMap: Record<ProjectRole, string> = {
    PROJECT_ADMIN: t('members.role.admin'),
    PROJECT_MAINTAINER: t('members.role.maintainer'),
    PROJECT_VIEWER: t('members.role.viewer'),
  };
  return roleMap[role] || role;
}

async function loadMembers() {
  loading.value = true;
  error.value = null;
  try {
    const data = await getProjectMembers(props.projectKey);
    members.value = data;

    // Initialize member roles
    data.forEach((member) => {
      memberRoles[member.id] = member.role;
    });
  } catch (err: any) {
    error.value = err?.message ?? t('members.errorLoad');
  } finally {
    loading.value = false;
  }
}

async function addMember() {
  if (!newMember.email) return;

  adding.value = true;
  addError.value = null;
  addSuccess.value = null;

  try {
    const member = await addProjectMember(props.projectKey, {
      email: newMember.email,
      role: newMember.role,
    });

    members.value.push(member);
    memberRoles[member.id] = member.role;

    // Reset form
    newMember.email = '';
    newMember.role = 'PROJECT_VIEWER';

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

async function updateMemberRole(member: ProjectMember) {
  const newRole = memberRoles[member.id];
  if (newRole === member.role) return;

  updatingMembers[member.id] = true;

  try {
    const updated = await updateProjectMember(props.projectKey, member.id, {
      role: newRole,
    });

    // Update member in list
    const index = members.value.findIndex((m) => m.id === member.id);
    if (index !== -1) {
      members.value[index] = updated;
    }
  } catch (err: any) {
    // Revert on error
    memberRoles[member.id] = member.role;
    error.value = err?.message ?? t('members.errorUpdate');
  } finally {
    updatingMembers[member.id] = false;
  }
}

async function removeMember(member: ProjectMember) {
  if (!confirm(t('members.confirmDelete', { email: member.user.email }))) {
    return;
  }

  removingMembers[member.id] = true;

  try {
    await removeProjectMember(props.projectKey, member.id);

    // Remove from list
    members.value = members.value.filter((m) => m.id !== member.id);
    delete memberRoles[member.id];
  } catch (err: any) {
    error.value = err?.message ?? t('members.errorRemove');
  } finally {
    removingMembers[member.id] = false;
  }
}

onMounted(loadMembers);
</script>

<style scoped>
.members-container {
  @apply flex flex-col gap-4;
}

.section-header {
  @apply flex justify-between items-center;
}

.add-member-form {
  @apply flex gap-[10px] flex-wrap p-4 border-2 border-border-primary rounded-xl;
  @apply bg-gradient-to-br from-[var(--card-bg-start)] to-[var(--card-bg-end)];
  @apply transition-all duration-300 ease-in-out;
}

.member-input {
  @apply flex-1 min-w-[200px] border-2 border-border-primary rounded-lg py-2 px-3;
  @apply text-sm bg-bg-primary text-text-primary transition-all duration-300;
}

.member-input:focus {
  @apply outline-none border-[var(--primary)] shadow-[0_0_0_3px_var(--primary-shadow)];
}

.member-select {
  @apply border-2 border-border-primary rounded-lg py-2 px-3 text-sm;
  @apply bg-bg-primary text-text-primary cursor-pointer transition-all duration-300;
}

.member-select:focus {
  @apply outline-none border-[var(--primary)] shadow-[0_0_0_3px_var(--primary-shadow)];
}

.members-list {
  @apply flex flex-col gap-3;
}

.member-row {
  @apply flex justify-between items-center gap-4 p-4;
  @apply border-2 border-border-primary rounded-xl;
  @apply bg-gradient-to-br from-[var(--card-bg-start)] to-[var(--card-bg-end)];
  @apply transition-all duration-300 ease-in-out;
}

.member-row:hover {
  @apply border-border-secondary shadow-[0_4px_12px_var(--card-shadow-hover)];
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
  @apply border-2 border-border-primary rounded-lg py-[6px] px-[10px] text-[13px];
  @apply bg-bg-primary text-text-primary cursor-pointer transition-all duration-300;
}

.member-select-inline:focus {
  @apply outline-none border-[var(--primary)];
}

.member-role-badge {
  @apply py-[6px] px-3 rounded-md bg-[var(--info-bg-start)] text-[var(--info-text)];
  @apply text-[13px] font-semibold transition-all duration-300;
}

.ghost-button.danger {
  @apply text-[var(--danger-text)];
}

.ghost-button.danger:hover:not(:disabled) {
  @apply bg-[var(--danger-bg)] border-[var(--danger-border)];
}

.ghost-button.compact {
  @apply py-[6px] px-3 text-[13px];
}

.form-error {
  @apply text-[var(--error-text)] text-sm w-full transition-colors duration-300;
}

.form-success {
  @apply text-[var(--success-text)] text-sm w-full transition-colors duration-300;
}
</style>
