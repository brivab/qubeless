<template>
  <div class="analyzer-card" :data-cy="`project-analyzer-card-${analyzer.key}`">
    <div class="card-header">
      <div class="analyzer-info">
        <h4>{{ analyzer.name }}</h4>
        <div class="muted">Key: {{ analyzer.key }}</div>
        <div v-if="!analyzer.enabled" class="status-badge disabled">Disabled globally</div>
        <div v-else-if="projectEnabled === null" class="status-badge default">Using global default</div>
      </div>

      <label class="toggle" :class="{ disabled: !analyzer.enabled }">
        <input
          type="checkbox"
          v-model="enabled"
          :disabled="!analyzer.enabled || saving"
          @change="handleToggle"
          :data-cy="`project-analyzer-toggle-${analyzer.key}`"
        />
        <span class="switch" aria-hidden="true">
          <span class="knob"></span>
        </span>
        <span class="toggle-text">{{ enabled ? 'Enabled' : 'Disabled' }}</span>
      </label>
    </div>

    <!-- Current Configuration Display -->
    <div v-if="hasCurrentConfig" class="current-config-section">
      <div class="current-config-header">
        <span class="config-badge">Current Configuration</span>
      </div>
      <div class="current-config-content">
        <pre class="config-preview">{{ formatCurrentConfig() }}</pre>
      </div>
    </div>

    <!-- Configuration Notice -->
    <div v-if="configNotice" class="config-notice">
      <div class="notice-header">
        <svg class="notice-icon" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd" />
        </svg>
        <span class="notice-title">Configuration Options</span>
      </div>
      <div class="notice-content" v-html="configNotice"></div>
    </div>

    <div class="config-section">
      <label class="config-label">
        Configuration (JSON)
        <span v-if="isDirty" class="dirty-indicator">• Unsaved changes</span>
      </label>

      <textarea
        v-model="configText"
        class="config-editor"
        rows="6"
        :placeholder="configPlaceholder"
        :disabled="saving"
        :data-cy="`project-analyzer-config-${analyzer.key}`"
      />

      <ErrorBanner v-if="validationError" :error="validationError" />

      <div class="card-actions">
        <button @click="handleFormat" :disabled="saving || !configText.trim()" class="ghost-button">
          Format JSON
        </button>
        <button @click="handleReset" :disabled="saving || !isDirty" class="ghost-button">
          Reset
        </button>
        <button @click="handleSave" :disabled="saving || !isDirty || !!validationError" :data-cy="`project-analyzer-save-${analyzer.key}`">
          {{ saving ? 'Saving...' : 'Save' }}
        </button>
        <span v-if="saveSuccess" class="success-message">{{ saveSuccess }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { Analyzer } from '../../services/api';
import ErrorBanner from '../common/ErrorBanner.vue';

const props = defineProps<{
  analyzer: Analyzer;
  projectEnabled: boolean | null;
  configJson: Record<string, unknown> | null | undefined;
}>();

const emit = defineEmits<{
  save: [data: { enabled: boolean; configJson: Record<string, unknown> | null }];
}>();

const enabled = ref(props.projectEnabled ?? true);
const configText = ref('');
const originalConfigText = ref('');
const saving = ref(false);
const validationError = ref<string | null>(null);
const saveSuccess = ref<string | null>(null);

const isDirty = computed(() => {
  return enabled.value !== (props.projectEnabled ?? true) || configText.value.trim() !== originalConfigText.value.trim();
});

// Check if there's a current configuration
const hasCurrentConfig = computed(() => {
  return props.configJson && Object.keys(props.configJson).length > 0;
});

// Format current configuration for display
function formatCurrentConfig(): string {
  if (!props.configJson) return '';
  return JSON.stringify(props.configJson, null, 2);
}

// Analyzer-specific configuration notices
interface AnalyzerConfigInfo {
  placeholder: string;
  notice: string;
}

const analyzerConfigs: Record<string, AnalyzerConfigInfo> = {
  complexity: {
    placeholder: '{\n  "COMPLEXITY_THRESHOLD": 10,\n  "COMPLEXITY_SEVERITY_MINOR_FROM": 11,\n  "COMPLEXITY_SEVERITY_MAJOR_FROM": 16,\n  "COMPLEXITY_SEVERITY_CRITICAL_FROM": 26\n}',
    notice: `
      <div class="config-option">
        <strong>COMPLEXITY_THRESHOLD</strong> (default: 10): Minimum complexity to trigger an issue
      </div>
      <div class="config-option">
        <strong>COMPLEXITY_SEVERITY_MINOR_FROM</strong> (default: 11): Complexity value for MINOR severity
      </div>
      <div class="config-option">
        <strong>COMPLEXITY_SEVERITY_MAJOR_FROM</strong> (default: 16): Complexity value for MAJOR severity
      </div>
      <div class="config-option">
        <strong>COMPLEXITY_SEVERITY_CRITICAL_FROM</strong> (default: 26): Complexity value for CRITICAL severity
      </div>
      <div class="config-option">
        <strong>MAX_ISSUES</strong> (default: 2000): Maximum number of issues to report
      </div>
      <div class="config-option">
        <strong>EXCLUDE_GLOB</strong>: Additional glob pattern to exclude files
      </div>
    `,
  },
  jscpd: {
    placeholder: '{\n  "JSCPD_MIN_LINES": 5,\n  "JSCPD_MIN_TOKENS": 50\n}',
    notice: `
      <div class="config-option">
        <strong>JSCPD_MIN_LINES</strong> (default: 5): Minimum lines for duplication detection
      </div>
      <div class="config-option">
        <strong>JSCPD_MIN_TOKENS</strong> (default: 50): Minimum tokens for duplication detection
      </div>
    `,
  },
  trivy: {
    placeholder: '{\n  "TRIVY_SEVERITY": "CRITICAL,HIGH"\n}',
    notice: `
      <div class="config-option">
        <strong>TRIVY_SEVERITY</strong>: Comma-separated list of severities to report (e.g., "CRITICAL,HIGH,MEDIUM")
      </div>
    `,
  },
  eslint: {
    placeholder: '{\n  "ESLINT_CONFIG": ".eslintrc.json"\n}',
    notice: `
      <div class="config-option">
        <strong>ESLINT_CONFIG</strong>: Path to custom ESLint configuration file
      </div>
    `,
  },
};

const configPlaceholder = computed(() => {
  return analyzerConfigs[props.analyzer.key]?.placeholder || '{"key": "value"}';
});

const configNotice = computed(() => {
  return analyzerConfigs[props.analyzer.key]?.notice || null;
});

watch(
  () => [props.projectEnabled, props.configJson],
  () => {
    enabled.value = props.projectEnabled ?? true;
    const text = props.configJson ? JSON.stringify(props.configJson, null, 2) : '';
    configText.value = text;
    originalConfigText.value = text;
    validationError.value = null;
    saveSuccess.value = null;
  },
  { immediate: true },
);

watch(configText, () => {
  validateConfig();
  saveSuccess.value = null;
});

function validateConfig() {
  const trimmed = configText.value.trim();
  if (!trimmed) {
    validationError.value = null;
    return true;
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
      validationError.value = 'Config must be a JSON object, not an array or primitive';
      return false;
    }
    validationError.value = null;
    return true;
  } catch (err: any) {
    validationError.value = `Invalid JSON: ${err.message}`;
    return false;
  }
}

function handleFormat() {
  if (!validateConfig()) return;
  const trimmed = configText.value.trim();
  if (!trimmed) return;

  try {
    const parsed = JSON.parse(trimmed);
    configText.value = JSON.stringify(parsed, null, 2);
  } catch {
    // validation already handled
  }
}

function handleReset() {
  enabled.value = props.projectEnabled ?? true;
  configText.value = originalConfigText.value;
  validationError.value = null;
  saveSuccess.value = null;
}

function handleToggle() {
  saveSuccess.value = null;
}

async function handleSave() {
  if (!validateConfig() || saving.value) return;

  const trimmed = configText.value.trim();
  let configPayload: Record<string, unknown> | null = null;

  if (trimmed) {
    try {
      configPayload = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      return;
    }
  }

  saving.value = true;
  saveSuccess.value = null;

  try {
    emit('save', {
      enabled: enabled.value,
      configJson: configPayload,
    });

    originalConfigText.value = configText.value.trim();
    saveSuccess.value = 'Saved successfully!';

    setTimeout(() => {
      saveSuccess.value = null;
    }, 3000);
  } catch (err: any) {
    validationError.value = err?.message ?? 'Failed to save configuration';
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.analyzer-card {
  @apply border-2 border-border-primary rounded-xl p-5;
  @apply bg-gradient-to-br from-[var(--card-bg-start)] to-[var(--card-bg-end)];
  @apply flex flex-col gap-5 shadow-[0_4px_12px_var(--card-shadow)];
  @apply transition-all duration-300 ease-in-out;
}

.analyzer-card:hover {
  @apply border-border-secondary shadow-[0_8px_20px_var(--card-shadow-hover)];
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  flex-wrap: wrap;
}

.analyzer-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.analyzer-info h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  transition: color 0.3s ease;
}

.muted {
  font-size: 13px;
  color: var(--text-tertiary);
  transition: color 0.3s ease;
}

.status-badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  transition: all 0.3s ease;
}

.status-badge.disabled {
  background: linear-gradient(135deg, var(--badge-failed-bg-start) 0%, var(--badge-failed-bg-end) 100%);
  color: var(--badge-failed-text);
  border: 1px solid var(--badge-failed-border);
}

.status-badge.default {
  background: linear-gradient(135deg, var(--badge-pending-bg-start) 0%, var(--badge-pending-bg-end) 100%);
  color: var(--badge-pending-text);
  border: 1px solid var(--badge-pending-border);
}

.toggle {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 600;
  font-size: 13px;
}

.toggle.disabled {
  opacity: 0.5;
}

.toggle input {
  display: none;
}

.switch {
  width: 48px;
  height: 26px;
  border-radius: 999px;
  background: var(--toggle-bg);
  border: 1px solid var(--toggle-border);
  position: relative;
  transition: all 0.3s ease;
  display: inline-flex;
  align-items: center;
  padding: 3px;
}

.knob {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--toggle-knob);
  box-shadow: 0 2px 6px var(--toggle-knob-shadow);
  transform: translateX(0);
  transition: all 0.3s ease;
}

.toggle input:checked + .switch {
  background: var(--toggle-checked-bg);
  border-color: var(--toggle-checked-border);
}

.toggle input:checked + .switch .knob {
  transform: translateX(20px);
  background: var(--toggle-checked-knob);
  box-shadow: 0 4px 10px var(--toggle-checked-knob-shadow);
}

.toggle-text {
  min-width: 70px;
}

.config-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.config-label {
  font-weight: 600;
  font-size: 13px;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 8px;
  transition: color 0.3s ease;
}

.dirty-indicator {
  color: var(--warning-text-dark);
  font-weight: 700;
  font-size: 12px;
  transition: color 0.3s ease;
}

.config-editor {
  width: 100%;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 13px;
  border: 2px solid var(--code-border);
  border-radius: 10px;
  padding: 14px;
  background: var(--code-bg);
  color: var(--code-text);
  min-height: 140px;
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
  transition: all 0.3s ease;
}

.config-editor:focus {
  outline: none;
  border-color: var(--primary);
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2), 0 0 0 3px var(--primary-shadow);
}

.config-editor:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.card-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.success-message {
  color: var(--success-text-dark);
  font-weight: 600;
  font-size: 13px;
  transition: color 0.3s ease;
}

.current-config-section {
  padding: 14px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-primary);
  border-radius: 8px;
  transition: all 0.3s ease;
}

.current-config-header {
  margin-bottom: 10px;
}

.config-badge {
  display: inline-block;
  padding: 4px 12px;
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
  color: white;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-radius: 999px;
}

.current-config-content {
  margin-top: 8px;
}

.config-preview {
  margin: 0;
  padding: 12px;
  background: var(--code-bg);
  border: 1px solid var(--code-border);
  border-radius: 6px;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 12px;
  color: var(--code-text);
  overflow-x: auto;
  white-space: pre;
  transition: all 0.3s ease;
}

.config-notice {
  padding: 16px;
  background: linear-gradient(135deg, var(--info-bg-start) 0%, var(--info-bg-end) 100%);
  border: 1px solid var(--info-border);
  border-radius: 8px;
  transition: all 0.3s ease;
}

.notice-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.notice-icon {
  width: 18px;
  height: 18px;
  color: var(--info-text);
  flex-shrink: 0;
  transition: color 0.3s ease;
}

.notice-title {
  font-weight: 700;
  font-size: 13px;
  color: var(--info-text);
  transition: color 0.3s ease;
}

.notice-content {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
  transition: color 0.3s ease;
}

.config-option {
  margin-bottom: 8px;
  padding-left: 12px;
  position: relative;
}

.config-option::before {
  content: '•';
  position: absolute;
  left: 0;
  color: var(--info-text);
  font-weight: bold;
}

.config-option strong {
  color: var(--text-primary);
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  font-size: 12px;
  background: var(--code-bg);
  padding: 2px 6px;
  border-radius: 4px;
  transition: all 0.3s ease;
}

.config-option:last-child {
  margin-bottom: 0;
}
</style>
