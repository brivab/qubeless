<template>
  <div class="tab-content">
    <div class="card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px">
        <div>
          <h3 style="margin: 0">Chat Notifications</h3>
          <p class="muted" style="margin: 8px 0 0">
            Send notifications to Slack, Teams, Discord, or any webhook-compatible chat platform
          </p>
        </div>
        <button class="primary-button" @click="showCreateModal = true">
          Add Integration
        </button>
      </div>

      <div v-if="loading" class="muted">Loading integrations...</div>

      <div v-else-if="error" style="color: var(--error-text)">
        {{ error }}
      </div>

      <div v-else-if="integrations.length === 0" class="muted" style="text-align: center; padding: 40px">
        No chat integrations configured. Click "Add Integration" to get started.
      </div>

      <div v-else class="integrations-list">
        <div
          v-for="integration in integrations"
          :key="integration.id"
          class="integration-card"
        >
          <div class="integration-header">
            <div>
              <span class="provider-badge" :data-provider="integration.provider">
                {{ getProviderLabel(integration.provider) }}
              </span>
              <span v-if="integration.channel" class="muted" style="margin-left: 8px">
                #{{ integration.channel }}
              </span>
            </div>
            <div style="display: flex; gap: 8px; align-items: center">
              <span
                class="status-indicator"
                :class="{ enabled: integration.enabled, disabled: !integration.enabled }"
              >
                {{ integration.enabled ? 'Enabled' : 'Disabled' }}
              </span>
              <button
                class="icon-button"
                @click="testIntegration(integration)"
                :disabled="testingIds.has(integration.id)"
                title="Test connection"
              >
                🔔
              </button>
              <button
                class="icon-button"
                @click="editIntegration(integration)"
                title="Edit"
              >
                ✏️
              </button>
              <button
                class="icon-button danger"
                @click="deleteIntegration(integration)"
                title="Delete"
              >
                🗑️
              </button>
            </div>
          </div>

          <div class="integration-details">
            <div class="muted">
              <strong>Webhook:</strong> {{ integration.webhookUrl }}
            </div>
            <div class="muted">
              <strong>Events:</strong>
              <span
                v-for="event in integration.events"
                :key="event"
                class="event-tag"
              >
                {{ getEventLabel(event) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Create/Edit Modal -->
    <div v-if="showCreateModal || editingIntegration" class="modal-overlay" @click.self="closeModal">
      <div class="modal">
        <h3>{{ editingIntegration ? 'Edit Integration' : 'Add Chat Integration' }}</h3>

        <form @submit.prevent="saveIntegration">
          <div class="form-group">
            <label>Provider *</label>
            <select
              v-model="form.provider"
              required
              :disabled="!!editingIntegration"
            >
              <option value="">Select a provider...</option>
              <option value="slack">Slack</option>
              <option value="teams">Microsoft Teams</option>
              <option value="discord">Discord</option>
              <option value="mattermost">Mattermost</option>
              <option value="rocketchat">Rocket.Chat</option>
              <option value="googlechat">Google Chat</option>
              <option value="generic">Generic Webhook</option>
            </select>
          </div>

          <div class="form-group">
            <label>Webhook URL *</label>
            <input
              type="url"
              v-model="form.webhookUrl"
              placeholder="https://hooks.slack.com/services/..."
              required
            />
            <small class="muted">Get this from your chat platform's webhook configuration</small>
          </div>

          <div class="form-group">
            <label>Channel (optional)</label>
            <input
              type="text"
              v-model="form.channel"
              placeholder="general"
            />
            <small class="muted">Override the default channel (Slack only)</small>
          </div>

          <div class="form-group">
            <label>Events *</label>
            <div class="checkbox-group">
              <label class="checkbox-label">
                <input type="checkbox" value="analysis.completed" v-model="form.events" />
                Analysis completed
              </label>
              <label class="checkbox-label">
                <input type="checkbox" value="quality_gate.failed" v-model="form.events" />
                Quality gate failed
              </label>
            </div>
          </div>

          <div class="form-group">
            <label class="checkbox-label">
              <input type="checkbox" v-model="form.enabled" />
              Enabled
            </label>
          </div>

          <div v-if="formError" style="color: var(--error-text); margin-bottom: 16px">
            {{ formError }}
          </div>

          <div class="modal-actions">
            <button type="button" class="ghost-button" @click="closeModal">
              Cancel
            </button>
            <button type="submit" class="primary-button" :disabled="saving">
              {{ saving ? 'Saving...' : editingIntegration ? 'Update' : 'Create' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { api } from '../../services/api';

const props = defineProps<{
  projectKey: string;
}>();

interface ChatIntegration {
  id: number;
  provider: string;
  webhookUrl: string;
  channel?: string;
  events: string[];
  enabled: boolean;
}

const integrations = ref<ChatIntegration[]>([]);
const loading = ref(false);
const error = ref('');
const showCreateModal = ref(false);
const editingIntegration = ref<ChatIntegration | null>(null);
const testingIds = ref(new Set<number>());
const saving = ref(false);
const formError = ref('');

const form = ref({
  provider: '',
  webhookUrl: '',
  channel: '',
  events: [] as string[],
  enabled: true,
});

async function loadIntegrations() {
  loading.value = true;
  error.value = '';
  try {
    const data = await api.get<ChatIntegration[]>(`/projects/${props.projectKey}/chat-integrations`);
    integrations.value = data;
  } catch (err: any) {
    error.value = err.message || 'Failed to load integrations';
  } finally {
    loading.value = false;
  }
}

async function saveIntegration() {
  if (form.value.events.length === 0) {
    formError.value = 'Please select at least one event';
    return;
  }

  saving.value = true;
  formError.value = '';

  try {
    if (editingIntegration.value) {
      await api.put(`/chat-integrations/${editingIntegration.value.id}`, {
        webhookUrl: form.value.webhookUrl,
        channel: form.value.channel || undefined,
        events: form.value.events,
        enabled: form.value.enabled,
      });
    } else {
      await api.post(`/projects/${props.projectKey}/chat-integrations`, form.value);
    }

    closeModal();
    await loadIntegrations();
  } catch (err: any) {
    formError.value = err.message || 'Failed to save integration';
  } finally {
    saving.value = false;
  }
}

async function testIntegration(integration: ChatIntegration) {
  testingIds.value.add(integration.id);

  try {
    const result = await api.post<{ success: boolean; error?: string }>(`/chat-integrations/${integration.id}/test`);
    if (result.success) {
      alert('Test notification sent successfully!');
    } else {
      alert(`Test failed: ${result.error}`);
    }
  } catch (err: any) {
    alert(`Test failed: ${err.message}`);
  } finally {
    testingIds.value.delete(integration.id);
  }
}

function editIntegration(integration: ChatIntegration) {
  editingIntegration.value = integration;
  form.value = {
    provider: integration.provider,
    webhookUrl: '', // Don't pre-fill for security
    channel: integration.channel || '',
    events: [...integration.events],
    enabled: integration.enabled,
  };
}

async function deleteIntegration(integration: ChatIntegration) {
  if (!confirm(`Delete ${getProviderLabel(integration.provider)} integration?`)) {
    return;
  }

  try {
    await api.delete(`/chat-integrations/${integration.id}`);
    await loadIntegrations();
  } catch (err: any) {
    alert(`Failed to delete: ${err.message}`);
  }
}

function closeModal() {
  showCreateModal.value = false;
  editingIntegration.value = null;
  form.value = {
    provider: '',
    webhookUrl: '',
    channel: '',
    events: [],
    enabled: true,
  };
  formError.value = '';
}

function getProviderLabel(provider: string): string {
  const labels: Record<string, string> = {
    slack: 'Slack',
    teams: 'Microsoft Teams',
    discord: 'Discord',
    mattermost: 'Mattermost',
    rocketchat: 'Rocket.Chat',
    googlechat: 'Google Chat',
    generic: 'Generic Webhook',
  };
  return labels[provider] || provider;
}

function getEventLabel(event: string): string {
  const labels: Record<string, string> = {
    'analysis.completed': 'Analysis Completed',
    'quality_gate.failed': 'Quality Gate Failed',
  };
  return labels[event] || event;
}

onMounted(() => {
  loadIntegrations();
});
</script>

<style scoped>
.tab-content {
  @apply py-5;
}

.integrations-list {
  @apply flex flex-col gap-4;
}

.integration-card {
  @apply border rounded-lg p-4 transition-all duration-300;
  border-color: var(--border-primary);
  background: var(--bg-secondary);
}

.integration-header {
  @apply flex justify-between items-center mb-3;
}

.provider-badge {
  @apply inline-block px-3 py-1 rounded font-semibold text-[13px] text-white;
  background: var(--primary);
}

.provider-badge[data-provider='slack'] {
  background: #4a154b;
}

.provider-badge[data-provider='teams'] {
  background: #464775;
}

.provider-badge[data-provider='discord'] {
  background: #5865f2;
}

.status-indicator {
  @apply px-2 py-1 rounded text-xs font-medium;
}

.status-indicator.enabled {
  background: linear-gradient(135deg, var(--badge-success-bg-start) 0%, var(--badge-success-bg-end) 100%);
  color: var(--badge-success-text);
}

.status-indicator.disabled {
  background: linear-gradient(135deg, var(--badge-failed-bg-start) 0%, var(--badge-failed-bg-end) 100%);
  color: var(--badge-failed-text);
}

.integration-details {
  @apply flex flex-col gap-2 text-sm;
}

.event-tag {
  @apply inline-block ml-2 px-2 py-0.5 rounded text-xs;
  background: var(--bg-tertiary);
}

.icon-button {
  @apply bg-transparent border-none cursor-pointer text-lg px-2 py-1 rounded transition-colors duration-200;
}

.icon-button:hover:not(:disabled) {
  background: var(--bg-tertiary);
}

.icon-button:disabled {
  @apply opacity-50 cursor-not-allowed;
}

.icon-button.danger:hover:not(:disabled) {
  background: var(--error-bg);
}

.modal-overlay {
  @apply fixed inset-0 flex items-center justify-center z-[1000] backdrop-blur-sm;
  background: var(--modal-overlay-bg);
}

.modal {
  @apply p-6 rounded-xl max-w-[500px] w-[90%] max-h-[90vh] overflow-y-auto;
  background: var(--bg-primary);
  box-shadow: 0 20px 60px var(--modal-shadow);
}

.form-group {
  @apply mb-4;
}

.form-group label {
  @apply block mb-1 font-medium;
}

.form-group input,
.form-group select {
  @apply w-full p-2 border rounded;
  border-color: var(--border-primary);
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.checkbox-group {
  @apply flex flex-col gap-2;
}

.checkbox-label {
  @apply flex items-center gap-2 font-normal cursor-pointer;
}

.checkbox-label input[type='checkbox'] {
  @apply w-auto;
}

.modal-actions {
  @apply flex gap-3 justify-end mt-6;
}
</style>
