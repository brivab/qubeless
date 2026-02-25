<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h2 style="margin: 0 0 6px">{{ t('security.title') }}</h2>
        <p class="muted" style="margin: 0">{{ t('security.subtitle') }}</p>
      </div>
      <button class="ghost-button" type="button" @click="loadStatus" :disabled="loadingStatus">
        {{ t('common.refresh') }}
      </button>
    </div>

    <div class="card">
      <div class="section-header">
        <div>
          <h3 style="margin: 0 0 6px">{{ t('security.statusTitle') }}</h3>
          <p class="muted" style="margin: 0">{{ t('security.statusHint') }}</p>
        </div>
        <span v-if="status !== null" class="status-badge" :class="status ? 'enabled' : 'disabled'">
          {{ status ? t('security.statusEnabled') : t('security.statusDisabled') }}
        </span>
      </div>

      <div v-if="status === null" class="muted">
        {{ t('common.loading') }}
      </div>
      <div v-else-if="!status">
        <p class="muted" style="margin-top: 0">{{ t('security.enableHint') }}</p>
        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
          <button type="button" @click="startSetup" :disabled="setupLoading">
            {{ setupLoading ? t('security.generating') : t('security.generateSecret') }}
          </button>
          <button
            v-if="setup"
            class="ghost-button"
            type="button"
            @click="resetSetup"
            :disabled="setupLoading || confirmLoading"
          >
            {{ t('common.reset') }}
          </button>
        </div>

        <div v-if="setup" class="mfa-setup">
          <div class="mfa-block">
            <div class="muted">{{ t('security.qrLabel') }}</div>
            <div class="muted qr-hint">{{ t('security.qrHint') }}</div>
            <div class="qr-frame">
              <div v-if="qrLoading" class="muted">{{ t('security.qrLoading') }}</div>
              <img v-else-if="qrCodeDataUrl" class="qr-image" :src="qrCodeDataUrl" :alt="t('security.qrLabel')" />
            </div>
            <div v-if="qrError" class="form-error">{{ qrError }}</div>
          </div>

          <div class="mfa-block">
            <div class="muted">{{ t('security.secretLabel') }}</div>
            <div class="code-box">{{ setup.secret }}</div>
            <button class="ghost-button compact" type="button" @click="copyValue(setup.secret)">
              {{ t('security.copySecret') }}
            </button>
          </div>

          <div class="mfa-block">
            <div class="muted">{{ t('security.otpauthLabel') }}</div>
            <div class="code-box code-box-small">{{ setup.otpauthUrl }}</div>
            <button class="ghost-button compact" type="button" @click="copyValue(setup.otpauthUrl)">
              {{ t('security.copyUrl') }}
            </button>
          </div>

          <div class="form-group" style="margin-top: 16px;">
            <label for="mfa-confirm">{{ t('security.codeLabel') }}</label>
            <input
              id="mfa-confirm"
              v-model="confirmCode"
              type="text"
              inputmode="numeric"
              autocomplete="one-time-code"
              maxlength="6"
              pattern="[0-9]{6}"
              placeholder="123456"
            />
          </div>

          <div v-if="confirmError" class="form-error">{{ confirmError }}</div>
          <button type="button" @click="confirmSetup" :disabled="confirmLoading || confirmCode.length !== 6">
            {{ confirmLoading ? t('security.enabling') : t('security.enableAction') }}
          </button>
        </div>

        <div v-if="setupError" class="form-error" style="margin-top: 12px;">{{ setupError }}</div>
      </div>
      <div v-else>
        <p class="muted" style="margin-top: 0">{{ t('security.enabledHint') }}</p>
      </div>
    </div>

    <div class="card">
      <div class="section-header" style="align-items: flex-start;">
        <div>
          <h3 style="margin: 0 0 6px">{{ t('security.disableTitle') }}</h3>
          <p class="muted" style="margin: 0">{{ t('security.disableHint') }}</p>
        </div>
      </div>

      <div v-if="status === null" class="muted">{{ t('common.loading') }}</div>
      <div v-else-if="!status" class="muted">{{ t('security.disableUnavailable') }}</div>
      <div v-else>
        <div class="form-group">
          <label for="mfa-disable">{{ t('security.codeLabel') }}</label>
          <input
            id="mfa-disable"
            v-model="disableCode"
            type="text"
            inputmode="numeric"
            autocomplete="one-time-code"
            maxlength="6"
            pattern="[0-9]{6}"
            placeholder="123456"
          />
        </div>
        <div v-if="disableError" class="form-error">{{ disableError }}</div>
        <button
          type="button"
          class="danger-button"
          @click="disableMfaAction"
          :disabled="disableLoading || disableCode.length !== 6"
        >
          {{ disableLoading ? t('security.disabling') : t('security.disableAction') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import QRCode from 'qrcode';
import { useAuthStore } from '../stores/auth';
import { useI18n } from '../i18n';
import { confirmMfa, disableMfa, getMfaStatus, setupMfa } from '../services/api';

const { t } = useI18n();
const auth = useAuthStore();
const status = ref<boolean | null>(auth.user?.mfaEnabled ?? null);
const loadingStatus = ref(false);

const setup = ref<{ secret: string; otpauthUrl: string } | null>(null);
const setupLoading = ref(false);
const setupError = ref<string | null>(null);

const qrCodeDataUrl = ref<string | null>(null);
const qrLoading = ref(false);
const qrError = ref<string | null>(null);

const confirmCode = ref('');
const confirmLoading = ref(false);
const confirmError = ref<string | null>(null);

const disableCode = ref('');
const disableLoading = ref(false);
const disableError = ref<string | null>(null);

async function loadStatus() {
  loadingStatus.value = true;
  try {
    const result = await getMfaStatus();
    status.value = result.enabled;
  } catch (error: any) {
    status.value = auth.user?.mfaEnabled ?? null;
  } finally {
    loadingStatus.value = false;
  }
}

async function startSetup() {
  setupLoading.value = true;
  setupError.value = null;
  confirmError.value = null;
  try {
    setup.value = await setupMfa();
  } catch (error: any) {
    setupError.value = error?.message ?? t('security.errorSetup');
  } finally {
    setupLoading.value = false;
  }
}

function resetSetup() {
  setup.value = null;
  confirmCode.value = '';
  confirmError.value = null;
  setupError.value = null;
}

async function confirmSetup() {
  if (confirmCode.value.length !== 6) return;
  confirmLoading.value = true;
  confirmError.value = null;
  try {
    await confirmMfa(confirmCode.value);
    status.value = true;
    setup.value = null;
    confirmCode.value = '';
    await auth.fetchCurrentUser();
  } catch (error: any) {
    confirmError.value = error?.message ?? t('security.errorConfirm');
  } finally {
    confirmLoading.value = false;
  }
}

async function disableMfaAction() {
  if (disableCode.value.length !== 6) return;
  disableLoading.value = true;
  disableError.value = null;
  try {
    await disableMfa(disableCode.value);
    status.value = false;
    disableCode.value = '';
    await auth.fetchCurrentUser();
  } catch (error: any) {
    disableError.value = error?.message ?? t('security.errorDisable');
  } finally {
    disableLoading.value = false;
  }
}

async function copyValue(value: string) {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    // ignore if clipboard not available
  }
}

onMounted(() => {
  void loadStatus();
});

watch(
  () => setup.value?.otpauthUrl,
  async (url) => {
    qrCodeDataUrl.value = null;
    qrError.value = null;
    qrLoading.value = false;
    if (!url) return;
    qrLoading.value = true;
    try {
      qrCodeDataUrl.value = await QRCode.toDataURL(url, {
        margin: 1,
        width: 180,
        errorCorrectionLevel: 'M',
      });
    } catch {
      qrError.value = t('security.qrError');
    } finally {
      qrLoading.value = false;
    }
  },
  { immediate: true },
);
</script>

<style scoped>
.status-badge {
  @apply inline-block px-3 py-[5px] rounded-full text-[11px] font-bold uppercase tracking-[0.3px] border border-transparent;
}

.status-badge.enabled {
  background: linear-gradient(135deg, var(--badge-success-bg-start) 0%, var(--badge-success-bg-end) 100%);
  color: var(--badge-success-text);
  border-color: var(--badge-success-border);
}

.status-badge.disabled {
  background: linear-gradient(135deg, var(--badge-failed-bg-start) 0%, var(--badge-failed-bg-end) 100%);
  color: var(--badge-failed-text);
  border-color: var(--badge-failed-border);
}

.mfa-setup {
  @apply mt-4 flex flex-col gap-4;
}

.mfa-block {
  @apply flex flex-col gap-2;
}

.qr-hint {
  @apply text-xs;
}

.qr-frame {
  @apply inline-flex items-center justify-center rounded-xl border;
  width: 180px;
  height: 180px;
  background: var(--code-pill-bg);
  border-color: var(--border-secondary);
}

.qr-image {
  width: 180px;
  height: 180px;
}

.code-box {
  @apply font-mono text-sm px-3 py-2 rounded-lg break-all;
  background: var(--code-pill-bg);
  color: var(--text-primary);
  border: 1px solid var(--border-secondary);
}

.code-box-small {
  @apply text-xs;
}

.compact {
  @apply px-3 py-2 text-xs font-semibold;
}

.form-error {
  @apply text-sm px-4 py-3 border rounded-lg;
  color: var(--error-text);
  background: var(--error-bg);
  border-color: var(--error-border);
}

.danger-button {
  @apply border-0 rounded-btn px-[18px] py-3 font-bold text-sm cursor-pointer transition-all duration-200;
  background: linear-gradient(135deg, var(--badge-failed-bg-start) 0%, var(--badge-failed-bg-end) 100%);
  color: var(--badge-failed-text);
  box-shadow: 0 4px 12px var(--badge-failed-shadow);
}

.danger-button:hover:not(:disabled) {
  @apply -translate-y-0.5;
  box-shadow: 0 6px 16px var(--badge-failed-shadow);
}

.danger-button:disabled {
  @apply opacity-60 cursor-not-allowed shadow-none transform-none;
}
</style>
