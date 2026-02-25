<template>
  <div class="tab-content">
    <div class="card">
      <div style="margin-bottom: 20px">
        <h3 style="margin: 0">Email Notifications</h3>
        <p class="muted" style="margin: 8px 0 0">
          Configure when you want to receive email notifications for this project
        </p>
      </div>

      <!-- SMTP Configuration (Admin Only) -->
      <div v-if="isAdmin" class="smtp-section">
        <div class="section-header">
          <h4 style="margin: 0; font-size: 16px">SMTP Configuration</h4>
          <button
            type="button"
            class="ghost-button"
            @click="showSmtpConfig = !showSmtpConfig"
          >
            {{ showSmtpConfig ? 'Hide' : 'Configure' }}
          </button>
        </div>

        <div v-if="showSmtpConfig" class="smtp-config-form">
          <div class="info-notice">
            <div class="notice-icon">ℹ️</div>
            <div class="notice-content">
              <strong>Project-specific SMTP</strong>
              <p>
                Configure SMTP settings for this project. If not configured, the global SMTP settings will be used.
              </p>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label>SMTP Host</label>
              <input
                type="text"
                v-model="smtpConfig.smtpHost"
                placeholder="smtp.gmail.com"
                class="text-input"
              />
            </div>
            <div class="form-group" style="max-width: 150px">
              <label>Port</label>
              <input
                type="number"
                v-model.number="smtpConfig.smtpPort"
                placeholder="587"
                class="text-input"
              />
            </div>
          </div>

          <div class="form-group">
            <label class="checkbox-label">
              <input
                type="checkbox"
                v-model="smtpConfig.smtpSecure"
              />
              <span>Use secure connection (TLS)</span>
            </label>
          </div>

          <div class="form-group">
            <label>SMTP Username</label>
            <input
              type="text"
              v-model="smtpConfig.smtpUser"
              placeholder="user@example.com"
              class="text-input"
            />
          </div>

          <div class="form-group">
            <label>SMTP Password</label>
            <input
              type="password"
              v-model="smtpConfig.smtpPassword"
              placeholder="Enter password to update"
              class="text-input"
            />
            <small class="muted">Leave empty to keep current password</small>
          </div>

          <div class="form-group">
            <label>From Email Address</label>
            <input
              type="email"
              v-model="smtpConfig.smtpFrom"
              placeholder="noreply@example.com"
              class="text-input"
            />
          </div>

          <div class="form-actions">
            <button
              type="button"
              class="primary-button"
              @click="saveSmtpConfig"
              :disabled="savingSmtp"
            >
              {{ savingSmtp ? 'Saving...' : 'Save SMTP Config' }}
            </button>
            <div v-if="smtpSaveSuccess" class="success-message">
              SMTP configuration saved!
            </div>
            <div v-if="smtpError" style="color: var(--error-text); font-size: 14px">
              {{ smtpError }}
            </div>
          </div>
        </div>
      </div>

      <!-- Notification Preferences -->
      <div v-if="loading" class="muted" style="margin-top: 20px">Loading settings...</div>

      <div v-else-if="error" style="color: var(--error-text); margin-top: 20px">
        {{ error }}
      </div>

      <form v-else @submit.prevent="saveSettings" class="settings-form" style="margin-top: 20px">
        <h4 style="margin: 0 0 16px 0; font-size: 16px">Your Notification Preferences</h4>

        <div class="settings-card">
          <div class="setting-item">
            <label class="checkbox-label">
              <input
                type="checkbox"
                v-model="settings.emailNotifyAnalysisFailed"
              />
              <div class="setting-info">
                <strong>Analysis Failed</strong>
                <p class="muted">Get notified when an analysis fails to complete</p>
              </div>
            </label>
          </div>

          <div class="setting-item">
            <label class="checkbox-label">
              <input
                type="checkbox"
                v-model="settings.emailNotifyQualityGateFailed"
              />
              <div class="setting-info">
                <strong>Quality Gate Failed</strong>
                <p class="muted">Get notified when quality gate conditions are not met</p>
              </div>
            </label>
          </div>

          <div class="setting-item" style="border-bottom: none">
            <div style="flex: 1">
              <label style="display: block; margin-bottom: 8px; font-weight: 500">
                Custom Email Address (optional)
              </label>
              <input
                type="email"
                v-model="settings.emailAddress"
                placeholder="Leave empty to use your account email"
                class="text-input"
              />
              <small class="muted" style="display: block; margin-top: 4px">
                If specified, notifications will be sent to this email instead
              </small>
            </div>
          </div>
        </div>

        <div class="form-actions">
          <button type="submit" class="primary-button" :disabled="saving">
            {{ saving ? 'Saving...' : 'Save Settings' }}
          </button>
          <div v-if="saveSuccess" class="success-message">
            Settings saved successfully!
          </div>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '../services/api';

interface Props {
  projectKey: string;
}

const props = defineProps<Props>();

interface EmailSettings {
  emailNotifyAnalysisFailed: boolean;
  emailNotifyQualityGateFailed: boolean;
  emailAddress: string | null;
}

interface SmtpConfig {
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean;
  smtpUser: string | null;
  smtpPassword: string | null;
  smtpFrom: string | null;
}

const loading = ref(true);
const saving = ref(false);
const error = ref('');
const saveSuccess = ref(false);
const isAdmin = ref(false);
const showSmtpConfig = ref(false);
const savingSmtp = ref(false);
const smtpSaveSuccess = ref(false);
const smtpError = ref('');

const settings = ref<EmailSettings>({
  emailNotifyAnalysisFailed: true,
  emailNotifyQualityGateFailed: true,
  emailAddress: null,
});

const smtpConfig = ref<SmtpConfig>({
  smtpHost: null,
  smtpPort: null,
  smtpSecure: false,
  smtpUser: null,
  smtpPassword: null,
  smtpFrom: null,
});

onMounted(async () => {
  await Promise.all([loadSettings(), checkAdminAccess(), loadSmtpConfig()]);
});

async function checkAdminAccess() {
  try {
    const members = await api.get(`/projects/${props.projectKey}/members`);
    const currentUser = await api.get('/auth/me');
    const membership = members.find((m: any) => m.userId === currentUser.id);
    isAdmin.value = membership?.role === 'PROJECT_ADMIN';
  } catch (err) {
    isAdmin.value = false;
  }
}

async function loadSmtpConfig() {
  if (!isAdmin.value) return;

  try {
    const config = await api.get(`/projects/${props.projectKey}/smtp-config`);
    smtpConfig.value = {
      smtpHost: config.smtpHost || null,
      smtpPort: config.smtpPort || null,
      smtpSecure: config.smtpSecure ?? false,
      smtpUser: config.smtpUser || null,
      smtpPassword: null, // Never load the password
      smtpFrom: config.smtpFrom || null,
    };
  } catch (err: any) {
    // Silently fail - user might not have permission
  }
}

async function loadSettings() {
  try {
    loading.value = true;
    error.value = '';

    const members = await api.get(`/projects/${props.projectKey}/members`);
    const currentUser = await api.get('/auth/me');
    const membership = members.find((m: any) => m.userId === currentUser.id);

    if (membership) {
      settings.value = {
        emailNotifyAnalysisFailed: membership.emailNotifyAnalysisFailed ?? true,
        emailNotifyQualityGateFailed: membership.emailNotifyQualityGateFailed ?? true,
        emailAddress: membership.emailAddress || null,
      };
    }
  } catch (err: any) {
    error.value = err.message || 'Failed to load settings';
  } finally {
    loading.value = false;
  }
}

async function saveSmtpConfig() {
  try {
    savingSmtp.value = true;
    smtpSaveSuccess.value = false;
    smtpError.value = '';

    const payload: any = {
      smtpHost: smtpConfig.value.smtpHost || null,
      smtpPort: smtpConfig.value.smtpPort || null,
      smtpSecure: smtpConfig.value.smtpSecure,
      smtpUser: smtpConfig.value.smtpUser || null,
      smtpFrom: smtpConfig.value.smtpFrom || null,
    };

    // Only include password if it was entered
    if (smtpConfig.value.smtpPassword) {
      payload.smtpPassword = smtpConfig.value.smtpPassword;
    }

    await api.put(`/projects/${props.projectKey}/smtp-config`, payload);

    smtpSaveSuccess.value = true;
    smtpConfig.value.smtpPassword = null; // Clear password field

    setTimeout(() => {
      smtpSaveSuccess.value = false;
    }, 3000);
  } catch (err: any) {
    smtpError.value = err.message || 'Failed to save SMTP configuration';
  } finally {
    savingSmtp.value = false;
  }
}

async function saveSettings() {
  try {
    saving.value = true;
    saveSuccess.value = false;
    error.value = '';

    await api.put(`/projects/${props.projectKey}/members/me/notifications`, {
      emailNotifyAnalysisFailed: settings.value.emailNotifyAnalysisFailed,
      emailNotifyQualityGateFailed: settings.value.emailNotifyQualityGateFailed,
      emailAddress: settings.value.emailAddress || null,
    });

    saveSuccess.value = true;
    setTimeout(() => {
      saveSuccess.value = false;
    }, 3000);
  } catch (err: any) {
    error.value = err.message || 'Failed to save settings';
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.tab-content {
  @apply py-5;
}

.smtp-section {
  @apply mb-8 pb-8 border-b-2;
  border-color: var(--border-primary);
}

.section-header {
  @apply flex justify-between items-center mb-4;
}

.smtp-config-form {
  @apply mt-5 p-5 border rounded-lg;
  background: var(--bg-secondary);
  border-color: var(--border-primary);
}

.form-row {
  @apply flex gap-4 items-start;
}

.form-group {
  @apply flex-1 mb-4;
}

.form-group label:not(.checkbox-label) {
  @apply block mb-1.5 font-medium text-sm;
}

.settings-form {
  @apply flex flex-col gap-4;
}

.settings-card {
  @apply border rounded-lg overflow-hidden;
  border-color: var(--border-primary);
  background: var(--bg-secondary);
}

.setting-item {
  @apply p-4 border-b;
  border-color: var(--border-primary);
}

.checkbox-label {
  @apply flex items-start gap-3 cursor-pointer;
}

.checkbox-label input[type="checkbox"] {
  @apply mt-0.5 cursor-pointer flex-shrink-0;
}

.setting-info {
  @apply flex-1;
}

.setting-info strong {
  @apply block mb-1 text-sm;
}

.setting-info p {
  @apply m-0 text-[13px];
}

.text-input {
  @apply w-full p-2 border rounded text-sm transition-colors duration-300;
  border-color: var(--border-primary);
  background: var(--bg-primary);
  color: var(--text-primary);
}

.text-input:focus {
  @apply outline-none;
  border-color: var(--primary);
}

.form-actions {
  @apply flex items-center gap-3;
}

.success-message {
  @apply px-4 py-2 rounded text-sm;
  background: linear-gradient(135deg, var(--badge-success-bg-start) 0%, var(--badge-success-bg-end) 100%);
  color: var(--badge-success-text);
}

.info-notice {
  @apply flex gap-3 p-4 mb-5 rounded-lg border;
  background: linear-gradient(135deg, var(--info-bg-start) 0%, var(--info-bg-end) 100%);
  border-color: var(--info-border);
}

.notice-icon {
  @apply text-xl flex-shrink-0;
}

.notice-content {
  @apply flex-1;
}

.notice-content strong {
  @apply block mb-1.5 text-sm;
  color: var(--info-text);
}

.notice-content p {
  @apply m-0 text-[13px] leading-normal;
  color: var(--text-secondary);
}
</style>
