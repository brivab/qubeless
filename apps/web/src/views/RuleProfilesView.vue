<template>
  <div class="page">
    <div class="page-header">
      <div>
        <RouterLink :to="{ name: 'project', params: { key: projectKey } }" class="muted" style="font-size: 14px">
          {{ t('rules.backToProject') }}
        </RouterLink>
        <h2 style="margin: 6px 0 0">{{ t('rules.title') }}</h2>
        <p class="muted" style="margin: 4px 0 0">{{ project?.name ?? projectKey }}</p>
      </div>
      <div class="actions">
        <button class="ghost-button" @click="loadData" :disabled="loading">
          {{ t('common.refresh') }}
        </button>
      </div>
    </div>

    <div class="card">
      <div class="section-header">
        <h3 style="margin: 0">{{ t('rules.profilesTitle') }}</h3>
      </div>

      <div v-if="loadingProfiles" class="muted">{{ t('rules.loadingProfiles') }}</div>
      <div v-else-if="profilesError" class="error-text">{{ profilesError }}</div>
      <div v-else class="profiles-section">
        <div class="profile-selector">
          <label class="muted" style="font-weight: 600">{{ t('rules.profileActiveLabel') }}</label>
          <select
            v-model="selectedProfileId"
            @change="onProfileChange"
            style="min-width: 200px"
          >
            <option
              v-for="prof in profiles"
              :key="prof.id"
              :value="prof.id"
            >
              {{ prof.name }} {{ prof.id === activeProfileId ? t('rules.profileActiveSuffix') : '' }}
            </option>
          </select>

          <button
            v-if="selectedProfileId !== activeProfileId && selectedProfileId"
            @click="activateProfile"
            :disabled="activating"
            class="activate-button"
          >
            {{ activating ? t('rules.activatingProfile') : t('rules.activateProfile') }}
          </button>
        </div>

        <div class="create-profile">
          <button
            @click="showCreateModal = true"
            class="create-profile-button"
          >
            {{ t('rules.newProfile') }}
          </button>
        </div>
      </div>

      <div v-if="activateSuccess" class="success-message">
        {{ t('rules.activateSuccess') }}
      </div>
      <div v-if="activateError" class="error-message">
        {{ activateError }}
      </div>
    </div>

    <div class="card">
      <div class="section-header">
        <h3 style="margin: 0">{{ t('rules.rulesTitle') }}</h3>
        <div class="search-box">
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="t('rules.searchPlaceholder')"
            class="search-input"
          />
        </div>
        <button @click="showCreateRuleModal = true" class="create-rule-button">
          {{ t('rules.createRuleButton') }}
        </button>
      </div>

      <div v-if="loading" class="muted">{{ t('rules.loadingRules') }}</div>
      <div v-else-if="error" class="error-text">{{ error }}</div>
      <div v-else>
        <div class="filters" style="margin-bottom: 16px">
          <label class="muted" style="font-weight: 600">{{ t('rules.filterAnalyzerLabel') }}</label>
          <select v-model="selectedAnalyzer" style="min-width: 180px">
            <option value="">{{ t('rules.filterAnalyzerAll') }}</option>
            <option v-for="analyzer in uniqueAnalyzers" :key="analyzer" :value="analyzer">
              {{ analyzer }}
            </option>
          </select>
        </div>

        <div v-if="filteredRules.length === 0" class="muted">
          {{ t('rules.noRules') }}
        </div>

        <div v-else class="rules-container">
          <div
            v-for="group in groupedRules"
            :key="group.analyzer"
            class="analyzer-group"
          >
            <div class="analyzer-group-header">
              <h4>{{ group.analyzer }}</h4>
              <span class="muted">{{ t('rules.ruleCount', { count: group.rules.length }) }}</span>
            </div>

            <div class="rules-list">
              <div
                v-for="rule in group.rules"
                :key="rule.key"
                class="rule-item"
              >
                <div class="rule-info">
                  <div class="rule-header">
                    <strong>{{ rule.name }}</strong>
                    <span class="rule-key muted">{{ rule.key }}</span>
                  </div>
                  <div class="rule-description">{{ rule.description }}</div>
                  <div class="rule-meta">
                    <span class="severity-badge" :data-severity="rule.defaultSeverity">
                      {{ rule.defaultSeverity }}
                    </span>
                  </div>
                </div>

                <label class="toggle">
                  <input
                    type="checkbox"
                    v-model="rule.enabled"
                    @change="toggleRule(rule)"
                    :disabled="savingRules.has(rule.key)"
                  />
                  <span class="switch" aria-hidden="true">
                    <span class="knob"></span>
                  </span>
                  <span class="toggle-text">
                    {{ rule.enabled ? t('rules.ruleEnabled') : t('rules.ruleDisabled') }}
                  </span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <div v-if="hasChanges" class="save-section">
          <button
            @click="saveAllChanges"
            :disabled="saving"
            class="save-all-button"
          >
            {{
              saving
                ? t('rules.savingChanges')
                : t('rules.saveChanges', { count: changesCount })
            }}
          </button>
          <button
            @click="resetChanges"
            :disabled="saving"
            class="ghost-button"
          >
            {{ t('common.cancel') }}
          </button>
          <span v-if="saveSuccess" class="success-text">
            {{ t('rules.saveSuccess') }}
          </span>
          <span v-if="saveError" class="error-text">
            {{ saveError }}
          </span>
        </div>
      </div>
    </div>

    <!-- Modal de création de profil -->
    <div v-if="showCreateModal" class="modal-overlay" @click.self="closeCreateModal">
      <div class="modal-content">
        <h3 style="margin-top: 0">{{ t('rules.profileModalTitle') }}</h3>

        <div class="form-group">
          <label class="muted" style="font-weight: 600">{{ t('rules.profileNameLabel') }}</label>
          <input
            v-model="newProfileName"
            type="text"
            :placeholder="t('rules.profileNamePlaceholder')"
            class="form-input"
            @keyup.enter="createProfile"
          />
        </div>

        <div v-if="createError" class="error-message" style="margin-top: 12px">
          {{ createError }}
        </div>

        <div class="modal-actions">
          <button
            @click="createProfile"
            :disabled="!newProfileName.trim() || creating"
            class="primary-button"
          >
            {{ creating ? t('common.creating') : t('common.create') }}
          </button>
          <button @click="closeCreateModal" :disabled="creating" class="ghost-button">
            {{ t('common.cancel') }}
          </button>
        </div>
      </div>
    </div>

    <!-- Modal de création de règle -->
    <div v-if="showCreateRuleModal" class="modal-overlay" @click.self="closeCreateRuleModal">
      <div class="modal-content" style="max-width: 600px">
        <h3 style="margin-top: 0">{{ t('rules.createRuleModalTitle') }}</h3>

        <div class="form-group">
          <label class="muted" style="font-weight: 600">{{ t('rules.ruleKeyLabel') }}</label>
          <input
            v-model="newRule.key"
            type="text"
            :placeholder="t('rules.ruleKeyPlaceholder')"
            class="form-input"
          />
          <span class="muted" style="font-size: 12px">{{ t('rules.ruleKeyFormat') }}</span>
        </div>

        <div class="form-group" style="margin-top: 12px">
          <label class="muted" style="font-weight: 600">{{ t('rules.ruleAnalyzerLabel') }}</label>
          <input
            v-model="newRule.analyzerKey"
            type="text"
            :placeholder="t('rules.ruleAnalyzerPlaceholder')"
            class="form-input"
          />
        </div>

        <div class="form-group" style="margin-top: 12px">
          <label class="muted" style="font-weight: 600">{{ t('rules.ruleNameLabel') }}</label>
          <input
            v-model="newRule.name"
            type="text"
            :placeholder="t('rules.ruleNamePlaceholder')"
            class="form-input"
          />
        </div>

        <div class="form-group" style="margin-top: 12px">
          <label class="muted" style="font-weight: 600">{{ t('rules.ruleDescriptionLabel') }}</label>
          <textarea
            v-model="newRule.description"
            :placeholder="t('rules.ruleDescriptionPlaceholder')"
            class="form-input"
            rows="3"
          ></textarea>
        </div>

        <div class="form-group" style="margin-top: 12px">
          <label class="muted" style="font-weight: 600">{{ t('rules.ruleSeverityLabel') }}</label>
          <select v-model="newRule.defaultSeverity" class="form-input">
            <option value="INFO">INFO</option>
            <option value="MINOR">MINOR</option>
            <option value="MAJOR">MAJOR</option>
            <option value="CRITICAL">CRITICAL</option>
            <option value="BLOCKER">BLOCKER</option>
          </select>
        </div>

        <div v-if="createRuleError" class="error-message" style="margin-top: 12px">
          {{ createRuleError }}
        </div>

        <div class="modal-actions">
          <button
            @click="createCustomRule"
            :disabled="!isRuleFormValid || creatingRule"
            class="primary-button"
          >
            {{ creatingRule ? t('common.creating') : t('rules.createRuleAction') }}
          </button>
          <button @click="closeCreateRuleModal" :disabled="creatingRule" class="ghost-button">
            {{ t('common.cancel') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import {
  getProject,
  getProjectRules,
  updateProjectRules,
  listProjectRuleProfiles,
  createProjectRuleProfile,
  activateProjectRuleProfile,
  createRule,
  type Project,
  type RuleWithState,
  type RuleProfile,
  type IssueSeverity,
} from '../services/api';
import { useI18n } from '../i18n';

const route = useRoute();
const projectKey = route.params.key as string;

const project = ref<Project | null>(null);
const profile = ref<RuleProfile | null>(null);
const rules = ref<RuleWithState[]>([]);
const originalRules = ref<RuleWithState[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const searchQuery = ref('');
const selectedAnalyzer = ref('');
const savingRules = ref(new Set<string>());
const saving = ref(false);
const saveSuccess = ref(false);
const saveError = ref<string | null>(null);

// Profile management
const profiles = ref<RuleProfile[]>([]);
const activeProfileId = ref<string | null>(null);
const selectedProfileId = ref<string | null>(null);
const loadingProfiles = ref(false);
const profilesError = ref<string | null>(null);
const activating = ref(false);
const activateSuccess = ref(false);
const activateError = ref<string | null>(null);

// Create profile modal
const showCreateModal = ref(false);
const newProfileName = ref('');
const creating = ref(false);
const createError = ref<string | null>(null);

// Create rule modal
const showCreateRuleModal = ref(false);
const newRule = ref({
  key: '',
  analyzerKey: '',
  name: '',
  description: '',
  defaultSeverity: 'MAJOR' as IssueSeverity,
});
const creatingRule = ref(false);
const createRuleError = ref<string | null>(null);
const { t } = useI18n();

const uniqueAnalyzers = computed(() => {
  const analyzers = new Set(rules.value.map((r) => r.analyzerKey));
  return Array.from(analyzers).sort();
});

const filteredRules = computed(() => {
  let filtered = rules.value;

  if (selectedAnalyzer.value) {
    filtered = filtered.filter((r) => r.analyzerKey === selectedAnalyzer.value);
  }

  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(
      (r) =>
        r.name.toLowerCase().includes(query) ||
        r.key.toLowerCase().includes(query) ||
        r.description.toLowerCase().includes(query),
    );
  }

  return filtered;
});

const groupedRules = computed(() => {
  const groups = new Map<string, RuleWithState[]>();

  filteredRules.value.forEach((rule) => {
    if (!groups.has(rule.analyzerKey)) {
      groups.set(rule.analyzerKey, []);
    }
    groups.get(rule.analyzerKey)!.push(rule);
  });

  return Array.from(groups.entries()).map(([analyzer, rules]) => ({
    analyzer,
    rules: rules.sort((a, b) => a.name.localeCompare(b.name)),
  }));
});

const changedRules = computed(() => {
  return rules.value.filter((rule, index) => {
    const original = originalRules.value[index];
    return original && rule.enabled !== original.enabled;
  });
});

const hasChanges = computed(() => changedRules.value.length > 0);
const changesCount = computed(() => changedRules.value.length);

const isRuleFormValid = computed(() => {
  return (
    newRule.value.key.trim() !== '' &&
    newRule.value.analyzerKey.trim() !== '' &&
    newRule.value.name.trim() !== '' &&
    newRule.value.description.trim() !== ''
  );
});

async function loadProject() {
  try {
    project.value = await getProject(projectKey);
  } catch (err: any) {
    console.error('Failed to load project', err);
  }
}

async function loadRules() {
  loading.value = true;
  error.value = null;
  try {
    const data = await getProjectRules(projectKey, {
      analyzerKey: selectedAnalyzer.value || undefined,
    });
    profile.value = data.profile;
    rules.value = data.rules;
    originalRules.value = JSON.parse(JSON.stringify(data.rules));
  } catch (err: any) {
    error.value = err?.message ?? t('rules.errorLoadRules');
  } finally {
    loading.value = false;
  }
}

async function loadProfiles() {
  loadingProfiles.value = true;
  profilesError.value = null;
  try {
    const data = await listProjectRuleProfiles(projectKey);
    profiles.value = data.profiles;
    activeProfileId.value = data.activeRuleProfileId;
    selectedProfileId.value = data.activeRuleProfileId;
  } catch (err: any) {
    profilesError.value = err?.message ?? t('rules.errorLoadProfiles');
  } finally {
    loadingProfiles.value = false;
  }
}

async function loadData() {
  await Promise.all([loadProject(), loadProfiles(), loadRules()]);
}

function onProfileChange() {
  // Load rules for the selected profile
  loadRules();
}

async function activateProfile() {
  if (!selectedProfileId.value) return;

  activating.value = true;
  activateError.value = null;
  activateSuccess.value = false;

  try {
    await activateProjectRuleProfile(projectKey, selectedProfileId.value);
    activeProfileId.value = selectedProfileId.value;
    activateSuccess.value = true;

    setTimeout(() => {
      activateSuccess.value = false;
    }, 3000);
  } catch (err: any) {
    activateError.value = err?.message ?? t('rules.errorActivateProfile');
  } finally {
    activating.value = false;
  }
}

function toggleRule(rule: RuleWithState) {
  // The v-model already updated the value
  saveSuccess.value = false;
  saveError.value = null;
}

function resetChanges() {
  rules.value = JSON.parse(JSON.stringify(originalRules.value));
  saveSuccess.value = false;
  saveError.value = null;
}

async function saveAllChanges() {
  if (!hasChanges.value) return;

  saving.value = true;
  saveError.value = null;
  saveSuccess.value = false;

  try {
    const payload = {
      rules: changedRules.value.map((r) => ({
        ruleKey: r.key,
        enabled: r.enabled,
      })),
    };

    await updateProjectRules(projectKey, payload);

    // Refresh to get the updated state
    await loadRules();
    saveSuccess.value = true;

    setTimeout(() => {
      saveSuccess.value = false;
    }, 3000);
  } catch (err: any) {
    saveError.value = err?.message ?? t('rules.errorSaveChanges');
  } finally {
    saving.value = false;
  }
}

async function createProfile() {
  if (!newProfileName.value.trim()) return;

  creating.value = true;
  createError.value = null;

  try {
    const newProfile = await createProjectRuleProfile(projectKey, {
      name: newProfileName.value.trim(),
    });

    profiles.value.push(newProfile);
    selectedProfileId.value = newProfile.id;
    closeCreateModal();
    await loadRules();
  } catch (err: any) {
    createError.value = err?.message ?? t('rules.errorCreateProfile');
  } finally {
    creating.value = false;
  }
}

function closeCreateModal() {
  showCreateModal.value = false;
  newProfileName.value = '';
  createError.value = null;
}

async function createCustomRule() {
  if (!isRuleFormValid.value) return;

  creatingRule.value = true;
  createRuleError.value = null;

  try {
    await createRule({
      key: newRule.value.key.trim(),
      analyzerKey: newRule.value.analyzerKey.trim(),
      name: newRule.value.name.trim(),
      description: newRule.value.description.trim(),
      defaultSeverity: newRule.value.defaultSeverity,
    });

    closeCreateRuleModal();
    // Reload rules to show the new one
    await loadRules();
  } catch (err: any) {
    createRuleError.value = err?.message ?? t('rules.errorCreateRule');
  } finally {
    creatingRule.value = false;
  }
}

function closeCreateRuleModal() {
  showCreateRuleModal.value = false;
  newRule.value = {
    key: '',
    analyzerKey: '',
    name: '',
    description: '',
    defaultSeverity: 'MAJOR' as IssueSeverity,
  };
  createRuleError.value = null;
}

onMounted(loadData);
</script>

<style scoped>
.page {
  @apply flex flex-col gap-4;
}

.page-header {
  @apply flex justify-between items-center;
}

.actions {
  @apply flex items-center gap-2.5 flex-wrap;
}

.section-header {
  @apply flex justify-between items-center gap-4 mb-4 flex-wrap;
}

.search-box {
  @apply flex-1 max-w-[400px];
}

.search-input {
  @apply w-full border rounded-lg px-3 py-2 text-sm;
  border-color: var(--border-primary);
}

.filters {
  @apply flex items-center gap-3 flex-wrap;
}

.rules-container {
  @apply flex flex-col gap-6;
}

.analyzer-group {
  @apply border rounded-xl p-4 transition-all duration-300;
  border-color: var(--border-primary);
  background: linear-gradient(160deg, var(--card-bg-start) 0%, var(--card-bg-end) 100%);
  box-shadow: 0 4px 12px var(--card-shadow);
}

.analyzer-group-header {
  @apply flex justify-between items-center mb-3 pb-2 border-b transition-colors duration-300;
  border-color: var(--border-primary);
}

.analyzer-group-header h4 {
  @apply m-0 text-base transition-colors duration-300;
  color: var(--text-primary);
}

.rules-list {
  @apply flex flex-col gap-3;
}

.rule-item {
  @apply flex justify-between items-center gap-4 p-3 rounded-lg border transition-all duration-300;
  background: var(--bg-primary);
  border-color: var(--border-primary);
}

.rule-item:hover {
  box-shadow: 0 2px 8px var(--card-shadow-hover);
}

.rule-info {
  @apply flex-1 flex flex-col gap-1.5;
}

.rule-header {
  @apply flex items-center gap-2 flex-wrap;
}

.rule-key {
  @apply font-mono text-xs;
}

.rule-description {
  @apply text-[13px] leading-normal transition-colors duration-300;
  color: var(--text-secondary);
}

.rule-meta {
  @apply flex gap-2 items-center;
}

.severity-badge {
  @apply inline-block px-2 py-[3px] rounded text-[11px] font-bold uppercase tracking-[0.3px] border border-transparent transition-all duration-300;
}

.severity-badge[data-severity='BLOCKER'] {
  background: linear-gradient(135deg, var(--badge-blocker-bg-start) 0%, var(--badge-blocker-bg-end) 100%);
  color: var(--badge-blocker-text);
  border-color: var(--badge-blocker-border);
}

.severity-badge[data-severity='CRITICAL'] {
  background: linear-gradient(135deg, var(--badge-critical-bg-start) 0%, var(--badge-critical-bg-end) 100%);
  color: var(--badge-critical-text);
  border-color: var(--badge-critical-border);
}

.severity-badge[data-severity='MAJOR'] {
  background: linear-gradient(135deg, var(--badge-major-bg-start) 0%, var(--badge-major-bg-end) 100%);
  color: var(--badge-major-text);
  border-color: var(--badge-major-border);
}

.severity-badge[data-severity='MINOR'] {
  background: linear-gradient(135deg, var(--badge-minor-bg-start) 0%, var(--badge-minor-bg-end) 100%);
  color: var(--badge-minor-text);
  border-color: var(--badge-minor-border);
}

.severity-badge[data-severity='INFO'] {
  background: linear-gradient(135deg, var(--badge-info-bg-start) 0%, var(--badge-info-bg-end) 100%);
  color: var(--badge-info-text);
  border-color: var(--badge-info-border);
}

.toggle {
  @apply flex items-center gap-2.5 font-semibold min-w-[140px];
}

.toggle input {
  @apply hidden;
}

.switch {
  @apply w-12 h-[26px] rounded-full relative transition-all duration-300 inline-flex items-center p-[3px];
  background: var(--toggle-bg);
  border: 1px solid var(--toggle-border);
}

.knob {
  @apply w-[18px] h-[18px] rounded-full translate-x-0 transition-all duration-300;
  background: var(--toggle-knob);
  box-shadow: 0 2px 6px var(--toggle-knob-shadow);
}

.toggle input:checked + .switch {
  background: var(--toggle-checked-bg);
  border-color: var(--toggle-checked-border);
}

.toggle input:checked + .switch .knob {
  @apply translate-x-5;
  background: var(--toggle-checked-knob);
  box-shadow: 0 4px 10px var(--toggle-checked-knob-shadow);
}

.toggle input:disabled + .switch {
  @apply opacity-50 cursor-not-allowed;
}

.toggle-text {
  @apply min-w-[80px];
}

.save-section {
  @apply sticky bottom-0 mt-6 p-4 border rounded-xl flex items-center gap-3 flex-wrap transition-all duration-300;
  background: linear-gradient(160deg, var(--success-bg-light) 0%, var(--success-bg) 100%);
  border-color: var(--success-border);
  box-shadow: 0 -4px 20px var(--card-shadow);
}

.save-all-button {
  @apply border-0 rounded-lg px-5 py-2.5 font-bold cursor-pointer transition-all duration-300;
  background: var(--accent);
  color: var(--button-text);
}

.save-all-button:hover:not(:disabled) {
  background: var(--accent-hover);
}

.save-all-button:disabled {
  @apply opacity-60 cursor-not-allowed;
}

.profiles-section {
  @apply flex justify-between items-center gap-4 flex-wrap mt-3;
}

.profile-selector {
  @apply flex items-center gap-3 flex-wrap flex-1;
}

.create-profile {
  @apply flex items-center;
}

.create-profile-button {
  @apply border-0 rounded-lg px-4 py-2 font-bold cursor-pointer transition-all duration-300;
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%);
  color: var(--button-text);
  box-shadow: 0 4px 12px var(--primary-shadow);
}

.create-profile-button:hover {
  @apply -translate-y-px;
  box-shadow: 0 6px 16px var(--primary-shadow-hover);
}

.create-rule-button {
  @apply border-0 rounded-lg px-4 py-2 font-bold cursor-pointer whitespace-nowrap transition-all duration-300;
  background: linear-gradient(135deg, var(--success-bg-dark) 0%, var(--success-bg) 100%);
  color: var(--success-text-light);
  box-shadow: 0 4px 12px var(--success-shadow);
}

.create-rule-button:hover {
  @apply -translate-y-px;
  box-shadow: 0 6px 16px var(--success-shadow-hover);
}

.activate-button {
  @apply border-0 rounded-lg px-4 py-2 font-bold cursor-pointer transition-all duration-300;
  background: var(--success-bg-dark);
  color: var(--success-text-light);
}

.activate-button:hover:not(:disabled) {
  background: var(--success-bg-darker);
}

.activate-button:disabled {
  @apply opacity-60 cursor-not-allowed;
}

.success-message {
  @apply font-semibold px-3 py-2 rounded-lg mt-3 border transition-all duration-300;
  color: var(--success-text-dark);
  background: var(--success-bg);
  border-color: var(--success-border);
}

.error-message {
  @apply font-semibold px-3 py-2 rounded-lg mt-3 border transition-all duration-300;
  color: var(--error-text-dark);
  background: var(--error-bg);
  border-color: var(--error-border);
}

.modal-overlay {
  @apply fixed inset-0 flex items-center justify-center z-[1000] backdrop-blur-sm;
  background: var(--modal-overlay-bg);
}

.modal-content {
  @apply rounded-2xl p-6 max-w-[500px] w-[90%] transition-all duration-300;
  background: var(--bg-primary);
  box-shadow: 0 20px 60px var(--modal-shadow);
}

.form-group {
  @apply flex flex-col gap-2;
}

.form-input {
  @apply w-full border rounded-lg px-3 py-2.5 text-sm;
  border-color: var(--border-primary);
}

.form-input:focus {
  @apply outline-none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
}

.modal-actions {
  @apply flex gap-3 mt-5 justify-end;
}

.primary-button {
  @apply border-0 rounded-lg px-5 py-2.5 font-bold cursor-pointer transition-all duration-300;
  background: var(--accent);
  color: var(--button-text);
}

.primary-button:hover:not(:disabled) {
  background: var(--accent-hover);
}

.primary-button:disabled {
  @apply opacity-60 cursor-not-allowed;
}

.error-text {
  @apply transition-colors duration-300;
  color: var(--error-text);
}

.success-text {
  @apply font-semibold transition-colors duration-300;
  color: var(--success-text-dark);
}
</style>
