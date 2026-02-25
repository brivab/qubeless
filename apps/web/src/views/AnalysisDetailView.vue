<template>
  <div class="page">
    <div class="page-header">
      <div>
        <RouterLink to="/projects" class="muted" style="font-size: 14px;">
          {{ t('analysis.backToProjects') }}
        </RouterLink>
        <h2 style="margin: 6px 0 0;">
          {{ t('analysis.title', { id: analysis?.id?.slice(0, 8) ?? '' }) }}
        </h2>
        <p class="muted" style="margin: 4px 0 0;">
          {{ t('analysis.projectLabel') }} : {{ analysis?.project?.name ?? analysis?.projectId }} ·
          {{ t('analysis.branchLabel') }} : {{ analysis?.branch?.name ?? t('common.notAvailable') }}
        </p>
      </div>
      <div class="header-actions">
        <div class="header-actions-row">
          <button class="ghost-button" @click="loadAll" :disabled="loadingAnalysis">{{ t('common.refresh') }}</button>
          <span class="status" :data-status="analysis?.status">
            {{ getAnalysisStatusLabel(analysis?.status) }}
          </span>
        </div>
        <div class="auto-refresh" v-if="pollingActive">
          {{ t('analysis.autoRefresh', { seconds: 2 }) }}
        </div>
        <div class="auto-refresh error" v-if="pollError">
          {{ t('analysis.autoRefreshError', { error: pollError }) }}
        </div>
      </div>
    </div>

    <div class="main-tabs">
      <button
        class="main-tab-button"
        :class="{ active: activeTab === 'overview' }"
        @click="activeTab = 'overview'"
      >
        {{ t('analysis.overviewTab') }}
      </button>
      <button
        class="main-tab-button"
        :class="{ active: activeTab === 'issues' }"
        @click="activeTab = 'issues'"
      >
        {{ t('analysis.issuesTitle') }}
      </button>
      <button
        class="main-tab-button"
        :class="{ active: activeTab === 'artifacts' }"
        @click="activeTab = 'artifacts'"
      >
        {{ t('analysis.artifactsTitle') }}
      </button>
      <button
        class="main-tab-button"
        :class="{ active: activeTab === 'logs' }"
        @click="activeTab = 'logs'"
      >
        {{ t('analysis.logsTitle') }}
      </button>
    </div>

    <div v-if="activeTab === 'overview'" class="tab-content">
      <div>
        <!-- Top row: Info + Quality Gate + Technical Debt -->
        <div class="top-row">
          <div class="card card-compact">
            <h3>{{ t('analysis.infoTitle') }}</h3>
              <p class="muted info-text">{{ t('analysis.commitLabel') }} : <span class="info-value">{{ analysis?.commitSha }}</span></p>
              <p class="muted info-text">
                {{ t('analysis.startedLabel') }} : <span class="info-value">{{ formatDate(analysis?.startedAt) }}</span>
              </p>
              <p class="muted info-text">
                {{ t('analysis.finishedLabel') }} : <span class="info-value">{{ formatDate(analysis?.finishedAt) }}</span>
              </p>
            </div>

          <div class="card card-compact">
            <h3>{{ t('analysis.qualityGateTitle') }}</h3>
              <div v-if="qgError" style="color: var(--error-text);">{{ qgError }}</div>
              <div v-else-if="!qualityGate">{{ t('common.loading') }}</div>
              <div v-else class="qg">
                <div class="qg-status" :data-status="qualityGate.status">
                  {{ qualityGate.status }}
                </div>
                <div class="muted" style="margin-top: 6px;">{{ qualityGate.gate.name }}</div>
                <div class="conditions">
                  <div v-for="condition in qualityGate.conditions" :key="condition.metric + (condition.scope || '')" class="condition">
                    <div class="muted">
                      {{ condition.metric }} · {{ t('analysis.scopeLabel') }} {{ formatScope(condition.scope) }}
                    </div>
                    <div style="display: flex; gap: 6px; align-items: center;">
                      <span>{{ condition.operator }} {{ condition.threshold }}</span>
                      <span class="badge" :class="{ pass: condition.passed, fail: !condition.passed }">
                        {{ t('analysis.valueLabel') }} {{ condition.value }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          <TechnicalDebtWidget v-if="analysis?.id" :analysisId="analysis.id" class="card-compact" />
        </div>

        <!-- Middle row: Summary + Coverage -->
        <div class="metrics-row">
          <div class="card">
            <div class="section-header">
              <h3 style="margin: 0;">{{ t('analysis.summaryTitle') }}</h3>
              <button class="ghost-button compact" @click="loadSummary" :disabled="loadingSummary">
                {{ t('common.refresh') }}
              </button>
            </div>
            <div v-if="summaryError" style="color: var(--error-text);">{{ summaryError }}</div>
            <div v-else-if="loadingSummary || !summary">{{ t('common.loading') }}</div>
            <div v-else class="summary-grid">
              <div class="summary-tile">
                <div class="summary-label">{{ t('analysis.totalIssues') }}</div>
                <div class="summary-value">{{ summary.totalIssues }}</div>
              </div>
              <div class="summary-tile">
                <div class="summary-label">{{ t('analysis.newIssues') }}</div>
                <div class="summary-value summary-value-new">{{ summary.newIssues }}</div>
              </div>
              <div class="summary-tile">
                <div class="summary-label">{{ t('analysis.criticalBlocker') }}</div>
                <div class="summary-value summary-value-critical">
                  {{ (summary.bySeverity?.CRITICAL ?? 0) + (summary.bySeverity?.BLOCKER ?? 0) }}
                </div>
              </div>
              <div class="summary-tile">
                <div class="summary-label">{{ t('analysis.vulnerabilities') }}</div>
                <div class="summary-value summary-value-vuln">{{ summary.byType?.VULNERABILITY ?? 0 }}</div>
              </div>
            </div>
            <div v-if="summary" class="mini-bars">
                <div class="mini-bar">
                  <div class="mini-bar-label">{{ t('analysis.severityAll') }}</div>
                  <div class="bar">
                    <span
                      v-for="sev in severities"
                      :key="sev"
                      class="bar-seg"
                      :style="{ flex: (summary.bySeverity?.[sev] || 0) + 1 }"
                      :data-severity="sev"
                    >
                      <span class="bar-seg-label">{{ sev }}</span>
                      <span class="bar-seg-value">{{ summary.bySeverity?.[sev] || 0 }}</span>
                    </span>
                  </div>
                </div>
                <div class="mini-bar">
                  <div class="mini-bar-label">{{ t('analysis.severityNew') }}</div>
                  <div class="bar">
                    <span
                      v-for="sev in severities"
                      :key="sev"
                      class="bar-seg"
                      :style="{ flex: (summary.newBySeverity?.[sev] || 0) + 1 }"
                      :data-severity="sev"
                    >
                      <span class="bar-seg-label">{{ sev }}</span>
                      <span class="bar-seg-value">{{ summary.newBySeverity?.[sev] || 0 }}</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>

          <div class="card">
            <CoverageWidget v-if="analysis?.id" :analysisId="analysis.id" :showDetailsLink="true" />
          </div>

          <div class="card">
            <DuplicationWidget v-if="analysis?.id" :analysisId="analysis.id" :showDetailsLink="true" />
          </div>
        </div>
      </div>

    </div>

    <div v-if="activeTab === 'issues'" class="tab-content">
      <div class="card">
        <div class="issues-header">
          <div>
            <h3 style="margin: 0;">{{ t('analysis.issuesTitle') }}</h3>
            <div class="muted" style="margin-top: 4px;">{{ t('analysis.issuesHint') }}</div>
          </div>
          <div class="issues-meta">
            <span class="pill-info">{{ t('analysis.issuesCount', { count: issues.length }) }}</span>
            <button class="ghost-button compact" type="button" @click="resetFilters" :disabled="!hasActiveFilters">
              {{ t('analysis.resetFilters') }}
            </button>
          </div>
        </div>

        <div class="filter-bar">
          <div class="filter-chip">
            <label>{{ t('analysis.filterScope') }}</label>
            <select v-model="filters.onlyNew" @change="loadIssues">
              <option :value="false">{{ t('common.all') }}</option>
              <option :value="true">{{ t('analysis.filterNewOnly') }}</option>
            </select>
          </div>
          <div class="filter-chip">
            <label>{{ t('analysis.filterSeverity') }}</label>
            <select v-model="filters.severity" @change="loadIssues">
              <option value="">{{ t('common.all') }}</option>
              <option v-for="s in severities" :key="s" :value="s">{{ s }}</option>
            </select>
          </div>
          <div class="filter-chip">
            <label>{{ t('analysis.filterType') }}</label>
            <select v-model="filters.type" @change="loadIssues">
              <option value="">{{ t('common.all') }}</option>
              <option v-for="t in types" :key="t" :value="t">{{ t }}</option>
            </select>
          </div>
          <div class="filter-chip">
            <label>{{ t('filters.language') }}</label>
            <select v-model="filters.language" @change="loadIssues">
              <option value="">{{ t('filters.allLanguages') }}</option>
              <option v-for="lang in languages" :key="lang" :value="lang">{{ lang }}</option>
            </select>
          </div>
          <div class="filter-chip grow">
            <label>{{ t('analysis.filterPath') }}</label>
            <input v-model="filters.filePath" @input="debouncedLoadIssues" placeholder="src/..." />
          </div>
        </div>

        <div v-if="issuesError" style="color: var(--error-text); margin-top: 8px;">{{ issuesError }}</div>
        <div v-else-if="loadingIssues" style="margin-top: 8px;">{{ t('analysis.issuesLoading') }}</div>
        <div v-else-if="issues.length === 0" class="muted" style="margin-top: 8px;">
          {{ t('analysis.issuesEmpty') }}
        </div>
        <div v-else class="issues">
          <div v-for="issue in issues" :key="issue.id" class="issue" :class="{ selected: selectedIssue?.id === issue.id }" :data-cy="`analysis-issue-${issue.id}`">
            <div class="issue-header">
              <div class="issue-badges">
                <span class="badge severity" :data-severity="issue.severity">{{ issue.severity }}</span>
                <span class="badge type" :data-type="issue.type">{{ issue.type }}</span>
                <span class="badge analyzer">{{ issue.analyzerKey }}</span>
                <span v-if="issue.status && issue.status !== 'OPEN'" class="badge status" :data-status="issue.status">
                  {{ getIssueStatusLabel(issue.status) }}
                </span>
              </div>
              <span class="muted">{{ issue.filePath }} <span v-if="issue.line">:{{ issue.line }}</span></span>
            </div>
            <div style="font-weight: 600; margin-top: 4px;">
              {{ issue.message }}
              <span v-if="issue.isNew" class="pill-new">{{ t('analysis.issueNewLabel') }}</span>
            </div>
            <div class="issue-footer">
              <div class="muted" style="font-size: 13px;">
                {{ t('analysis.issueRule') }} {{ issue.ruleKey }} · {{ issue.fingerprint.slice(0, 12) }}
              </div>
              <div class="issue-actions">
                <button class="ghost-button compact" type="button" @click.stop="openIssueCode(issue)" :data-cy="`analysis-issue-code-${issue.id}`">
                  {{ t('analysis.issueCodeAction') }}
                </button>
                <button class="ghost-button compact" type="button" @click.stop="openLlmRuns(issue)" :data-cy="`analysis-issue-llm-runs-${issue.id}`">
                  {{ t('analysis.llmOpenModal') }}
                </button>
                <button class="issue-status-button" @click.stop="toggleIssueStatusMenu(issue.id)">
                  <span v-if="issue.status === 'OPEN'">{{ t('analysis.issueMark') }}</span>
                  <span v-else>{{ t('analysis.issueChangeStatus') }}</span>
                </button>
                <div v-if="openIssueMenus[issue.id]" class="issue-status-menu" @click.stop>
                  <button @click="resolveIssue(issue.id, 'OPEN')">{{ t('analysis.issueStatusOpen') }}</button>
                  <button @click="resolveIssue(issue.id, 'FALSE_POSITIVE')">
                    {{ t('analysis.issueStatusFalsePositive') }}
                  </button>
                  <button @click="resolveIssue(issue.id, 'ACCEPTED_RISK')">
                    {{ t('analysis.issueStatusAcceptedRisk') }}
                  </button>
                  <button @click="resolveIssue(issue.id, 'RESOLVED')">
                    {{ t('analysis.issueStatusResolved') }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
    </div>
    </div>

    <div v-if="activeTab === 'artifacts'" class="tab-content">
      <div class="card">
        <div class="section-header">
          <h3 style="margin: 0;">{{ t('analysis.artifactsTitle') }}</h3>
          <button class="ghost-button" @click="loadArtifacts" :disabled="loadingArtifacts">{{ t('common.refresh') }}</button>
        </div>
        <div v-if="artifactsError" style="color: var(--error-text);">{{ artifactsError }}</div>
        <div v-else-if="loadingArtifacts">{{ t('analysis.artifactsLoading') }}</div>
        <div v-else-if="artifacts.length === 0" class="muted">{{ t('analysis.artifactsEmpty') }}</div>
        <div v-else class="artifacts">
          <div v-for="artifact in artifacts" :key="artifact.id" class="artifact-row">
            <div>
              <div style="font-weight: 700;">{{ artifact.kind }}</div>
              <div class="muted">
                {{ formatDate(artifact.createdAt) }} · {{ prettySize(artifact.size) }}
              </div>
              <div class="muted" style="font-size: 12px;">
                {{ t('analysis.analyzerLabel') }} : {{ artifact.analyzerKey }}
              </div>
            </div>
            <button class="ghost-button" @click="openArtifact(artifact.kind, artifact.analyzerKey)">
              {{ t('analysis.openArtifact') }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="activeTab === 'logs'" class="tab-content">
      <div class="card">
        <div class="section-header">
          <h3 style="margin: 0;">{{ t('analysis.logsTitle') }}</h3>
          <div style="display: flex; gap: 8px; align-items: center;">
            <select
              v-if="logArtifacts.length > 1"
              v-model="selectedLogAnalyzer"
              :disabled="loadingLog"
              style="min-width: 160px;"
              @change="loadLog({ silent: false })"
            >
              <option
                v-for="artifact in logArtifacts"
                :key="artifact.id"
                :value="artifact.analyzerKey"
              >
                {{ artifact.analyzerKey }}
              </option>
            </select>
            <button
              class="ghost-button"
              @click="loadLog()"
              :disabled="loadingLog || !hasLogArtifact"
              :title="t('analysis.logsTooltip')"
            >
              {{ t('analysis.refreshLogs') }}
            </button>
          </div>
        </div>
        <div v-if="!hasLogArtifact" class="muted">{{ t('analysis.noLogs') }}</div>
        <div v-else>
          <div v-if="logError" style="color: var(--error-text);">{{ logError }}</div>
          <div v-else-if="loadingLog">{{ t('analysis.logsLoading') }}</div>
          <pre v-else class="log-viewer">{{ logContent || t('analysis.logsEmpty') }}</pre>
        </div>
      </div>
    </div>

    <div v-if="showIssueCodeModal" class="modal-overlay" @click.self="closeIssueCodeModal">
      <div class="modal-content" @click.stop>
        <div class="modal-header">
          <div>
            <h3 style="margin: 0;">{{ t('analysis.issueCodeModalTitle') }}</h3>
            <div v-if="selectedIssue" class="muted" style="margin-top: 4px;">
              {{ selectedIssue.message }}
            </div>
            <div v-if="activeCode?.filePath" class="muted" style="margin-top: 2px;">
              {{ activeCode.filePath }}
              <span v-if="activeCode.line">· {{ t('analysis.issueCodeLineLabel') }} {{ activeCode.line }}</span>
              <span v-if="activeCode.language">· {{ t('analysis.issueCodeLanguageLabel') }} {{ activeCode.language }}</span>
            </div>
          </div>
          <button class="modal-close" type="button" @click="closeIssueCodeModal">×</button>
        </div>
        <div class="modal-body">
          <div class="code-modal-actions">
            <span class="pill-info">
              {{ codeModalMode === 'full' ? t('analysis.issueCodeFullLabel') : t('analysis.issueCodeExcerptLabel') }}
            </span>
            <span v-if="codeModalMode === 'snippet'" class="muted">
              {{ t('analysis.issueCodeExcerptHint') }}
            </span>
            <button
              v-if="codeModalMode === 'snippet'"
              class="ghost-button compact"
              type="button"
              @click="openFullCode"
              :disabled="!issueCode || !issueCode.fileExists"
            >
              {{ t('analysis.issueCodeOpenFile') }}
            </button>
            <button
              v-else
              class="ghost-button compact"
              type="button"
              @click="showSnippet"
            >
              {{ t('analysis.issueCodeBackToExcerpt') }}
            </button>
          </div>

          <div v-if="codeModalMode === 'snippet'">
            <div v-if="issueCodeLoading">{{ t('common.loading') }}</div>
            <div v-else-if="issueCodeError" style="color: var(--error-text);">{{ issueCodeError }}</div>
            <div v-else-if="issueCode && !issueCode.fileExists" class="muted">
              {{ t('analysis.issueCodeFileMissing') }}
            </div>
            <div v-else-if="issueCode" class="code-block">
              <div class="code-line ellipsis">…</div>
              <div
                v-for="line in snippetLines"
                :key="line.lineNumber"
                class="code-line"
                :class="{ active: line.isIssueLine }"
              >
                <span class="code-line-number">{{ line.lineNumber }}</span>
                <span class="code-line-content" v-html="line.html"></span>
              </div>
              <div class="code-line ellipsis">…</div>
            </div>
          </div>

          <div v-else>
            <div v-if="issueCodeFullLoading">{{ t('common.loading') }}</div>
            <div v-else-if="issueCodeFullError" style="color: var(--error-text);">{{ issueCodeFullError }}</div>
            <div v-else-if="issueCodeFull && !issueCodeFull.fileExists" class="muted">
              {{ t('analysis.issueCodeFileMissing') }}
            </div>
            <div v-else-if="issueCodeFull" class="code-block full">
              <div
                v-for="line in fullLines"
                :key="line.lineNumber"
                class="code-line"
                :class="{ active: line.isIssueLine }"
              >
                <span class="code-line-number">{{ line.lineNumber }}</span>
                <span class="code-line-content" v-html="line.html"></span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showLlmRunsModal" class="modal-overlay" @click.self="closeLlmRuns" data-cy="analysis-llm-runs-modal-overlay">
      <div class="modal-content" @click.stop data-cy="analysis-llm-runs-modal">
        <div class="modal-header">
          <div>
            <h3 style="margin: 0;">{{ t('analysis.llmRunsTitle') }}</h3>
            <div v-if="llmIssue" class="muted" style="margin-top: 4px;">
              {{ llmIssue.message }}
            </div>
            <div v-if="llmIssue?.filePath" class="muted" style="margin-top: 2px;">
              {{ llmIssue.filePath }}
              <span v-if="llmIssue.line">· {{ t('analysis.issueCodeLineLabel') }} {{ llmIssue.line }}</span>
            </div>
          </div>
          <button class="modal-close" type="button" @click="closeLlmRuns">×</button>
        </div>
        <div class="modal-body">
          <div class="llm-modal-actions">
            <button
              class="ghost-button compact"
              type="button"
              @click="resolveIssueViaLlm(llmIssue)"
              :disabled="!llmIssue || llmRunActionLoading[llmIssue.id]"
              data-cy="analysis-llm-resolve"
            >
              {{ llmIssue && llmRunActionLoading[llmIssue.id] ? t('analysis.llmResolveStarting') : t('analysis.llmResolveAction') }}
            </button>
            <span
              v-if="llmIssue && llmRunsByIssue[llmIssue.id]?.length"
              class="llm-status"
              :data-status="llmRunsByIssue[llmIssue.id][0].status"
            >
              {{ getLlmStatusLabel(llmRunsByIssue[llmIssue.id][0].status) }}
            </span>
            <span v-if="llmIssue && llmRunsByIssue[llmIssue.id]?.length" class="muted llm-latest-date">
              {{ formatDate(llmRunsByIssue[llmIssue.id][0].createdAt) }}
            </span>
          </div>

          <div v-if="llmIssue">
            <div v-if="llmRunsLoading[llmIssue.id]" class="muted">{{ t('analysis.llmRunsLoading') }}</div>
            <div v-else-if="llmRunsError[llmIssue.id]" class="llm-error">{{ llmRunsError[llmIssue.id] }}</div>
            <div v-else-if="!llmRunsByIssue[llmIssue.id]?.length" class="muted">{{ t('analysis.llmRunsEmpty') }}</div>
            <div v-else class="llm-runs-list">
              <div v-for="run in llmRunsByIssue[llmIssue.id]" :key="run.id" class="llm-run" :data-cy="`analysis-llm-run-${run.id}`">
                <div class="llm-run-header">
                  <span class="llm-status" :data-status="run.status">{{ getLlmStatusLabel(run.status) }}</span>
                  <span class="muted">{{ formatDate(run.createdAt) }}</span>
                  <span v-if="run.promptVersion" class="muted">· {{ run.promptVersion }}</span>
                </div>
                <div class="llm-run-meta">
                  <a
                    v-if="run.pullRequest?.url"
                    :href="run.pullRequest.url"
                    target="_blank"
                    rel="noopener"
                    class="llm-run-link"
                  >
                    {{ t('analysis.llmRunPrLink', { kind: getPullRequestKind(run.pullRequest.provider), number: run.pullRequest.prNumber }) }}
                  </a>
                  <span v-else-if="run.pullRequest" class="muted">
                    {{ t('analysis.llmRunPrLink', { kind: getPullRequestKind(run.pullRequest.provider), number: run.pullRequest.prNumber }) }}
                  </span>
                  <span v-if="run.outputPatch" class="llm-run-pill">{{ t('analysis.llmRunPatchReady') }}</span>
                </div>
                <div v-if="run.errorMessage || run.outputSummary || run.outputPatch" class="llm-run-logs">
                  <div class="llm-run-logs-title">{{ t('analysis.llmRunLogs') }}</div>
                  <pre v-if="run.errorMessage" class="llm-run-log error">{{ run.errorMessage }}</pre>
                  <pre v-else-if="run.outputSummary" class="llm-run-log">{{ run.outputSummary }}</pre>
                  <div v-if="getOutputFiles(run.outputPatch)" class="llm-run-files">
                    <div class="llm-run-logs-title">{{ t('analysis.llmRunPatch') }}</div>
                    <details v-for="file in getOutputFiles(run.outputPatch) || []" :key="file.path" class="llm-run-file">
                      <summary>{{ file.path }}</summary>
                      <pre>{{ file.content }}</pre>
                    </details>
                  </div>
                  <details v-else-if="run.outputPatch" class="llm-run-patch">
                    <summary>{{ t('analysis.llmRunPatch') }}</summary>
                    <pre>{{ run.outputPatch }}</pre>
                  </details>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import CoverageWidget from '../components/CoverageWidget.vue';
import DuplicationWidget from '../components/DuplicationWidget.vue';
import {
  getAnalysis,
  getArtifacts,
  getIssues,
  getQualityGateStatus,
  getAnalysisSummary,
  getIssueCode,
  getIssueLlmRuns,
  downloadArtifact,
  getArtifactText,
  resolveIssue as resolveIssueApi,
  resolveIssueViaLlm as resolveIssueViaLlmApi,
  type AnalysisArtifact,
  type ArtifactKind,
  type Analysis,
  type Issue,
  type IssueCodeResponse,
  type IssueSeverity,
  type IssueType,
  type IssueStatus,
  type LlmRun,
  type LlmRunStatus,
  type QualityGateStatusResponse,
  type AnalysisStatus,
  type AnalysisSummary,
} from '../services/api';
import { useI18n } from '../i18n';
import TechnicalDebtWidget from '../components/TechnicalDebtWidget.vue';

const route = useRoute();
const analysisId = route.params.id as string;

const analysis = ref<Analysis | null>(null);
const issues = ref<Issue[]>([]);
const selectedIssue = ref<Issue | null>(null);
const issueCode = ref<IssueCodeResponse | null>(null);
const issueCodeLoading = ref(false);
const issueCodeError = ref<string | null>(null);
const issueCodeFull = ref<IssueCodeResponse | null>(null);
const issueCodeFullLoading = ref(false);
const issueCodeFullError = ref<string | null>(null);
const showIssueCodeModal = ref(false);
const codeModalMode = ref<'snippet' | 'full'>('snippet');
const qualityGate = ref<QualityGateStatusResponse | null>(null);
const artifacts = ref<AnalysisArtifact[]>([]);
const summary = ref<AnalysisSummary | null>(null);
const selectedLogAnalyzer = ref<string | null>(null);
const llmRunsByIssue = ref<Record<string, LlmRun[]>>({});
const llmRunsLoading = ref<Record<string, boolean>>({});
const llmRunsError = ref<Record<string, string | null>>({});
const llmRunActionLoading = ref<Record<string, boolean>>({});
const llmPollingActive = ref(false);
const llmPollError = ref<string | null>(null);
const showLlmRunsModal = ref(false);
const llmIssue = ref<Issue | null>(null);

const loadingAnalysis = ref(false);
const loadingIssues = ref(false);
const issuesError = ref<string | null>(null);
const qgError = ref<string | null>(null);
const loadingArtifacts = ref(false);
const artifactsError = ref<string | null>(null);
const loadingSummary = ref(false);
const summaryError = ref<string | null>(null);
const loadingLog = ref(false);
const logContent = ref('');
const logError = ref<string | null>(null);
const pollingActive = ref(false);
const pollError = ref<string | null>(null);
const activeTab = ref<'overview' | 'issues' | 'artifacts' | 'logs'>('overview');
const { t, locale, getLocaleTag } = useI18n();

const severities: IssueSeverity[] = ['INFO', 'MINOR', 'MAJOR', 'CRITICAL', 'BLOCKER'];
const types: IssueType[] = ['BUG', 'CODE_SMELL', 'VULNERABILITY'];
const languages: string[] = [
  'JavaScript/TypeScript',
  'Python',
  'Java',
  'Go',
  'PHP',
  'Rust',
  'C#',
  'Ruby',
  'Swift',
  'Kotlin',
];
const filters = reactive<{
  severity: IssueSeverity | '';
  type: IssueType | '';
  language: string;
  filePath: string;
  onlyNew: boolean
}>({
  severity: '',
  type: '',
  language: '',
  filePath: '',
  onlyNew: false,
});
const hasActiveFilters = computed(
  () =>
    Boolean(
      filters.severity ||
      filters.type ||
      filters.language ||
      filters.onlyNew ||
      (filters.filePath && filters.filePath.trim().length > 0),
    ),
);
const logArtifacts = computed(() => artifacts.value.filter((artifact) => artifact.kind === 'LOG'));
const hasLogArtifact = computed(() => logArtifacts.value.length > 0);
const activeCode = computed(() =>
  codeModalMode.value === 'full' ? issueCodeFull.value ?? issueCode.value : issueCode.value,
);
const snippetLines = computed(() => buildCodeLines(issueCode.value, { withLineNumbers: true }));
const fullLines = computed(() => buildCodeLines(issueCodeFull.value, { withLineNumbers: true, full: true }));

type LoadAnalysisOptions = {
  skipSecondaryReload?: boolean;
};

let pollTimer: number | null = null;
let llmPollTimer: number | null = null;

function formatDate(value?: string | null) {
  if (!value) return t('common.notAvailable');
  return new Date(value).toLocaleString(getLocaleTag(locale.value));
}

function shouldPoll(status?: AnalysisStatus | null) {
  return status === 'PENDING' || status === 'RUNNING';
}

function getStatusLabel(prefix: 'analysis' | 'issue' | 'llm', status?: string | null) {
  if (!status) return '';
  const key = `status.${prefix}.${status}`;
  const label = t(key);
  return label === key ? status : label;
}

function getAnalysisStatusLabel(status?: AnalysisStatus | null) {
  return getStatusLabel('analysis', status ?? null);
}

function getIssueStatusLabel(status?: IssueStatus | null) {
  return getStatusLabel('issue', status ?? null);
}

function getLlmStatusLabel(status?: LlmRunStatus | null) {
  return getStatusLabel('llm', status ?? null);
}

function formatScope(scope?: string | null) {
  if (!scope || scope === 'ALL') return t('common.all');
  return scope;
}

function getPullRequestKind(provider?: 'GITHUB' | 'GITLAB' | null) {
  if (provider === 'GITLAB') return 'MR';
  return 'PR';
}

function getOutputFiles(raw?: string | null) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const files = parsed.filter((entry) => entry && typeof entry.path === 'string' && typeof entry.content === 'string');
    return files.length ? files : null;
  } catch {
    return null;
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const TOKEN_REGEX =
  /(\/\/.*$|#.*$|\/\*.*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`|\b\d+(?:\.\d+)?\b|\b(?:function|const|let|var|if|else|for|while|return|class|new|import|from|export|async|await|try|catch|throw|switch|case|break|continue|default)\b)/g;

function highlightLine(line: string) {
  const tokens = line.matchAll(TOKEN_REGEX);
  let result = '';
  let lastIndex = 0;

  for (const match of tokens) {
    if (match.index === undefined) continue;
    const raw = match[0];
    const start = match.index;
    const end = start + raw.length;

    if (start > lastIndex) {
      result += escapeHtml(line.slice(lastIndex, start));
    }

    let tokenClass = 'code-token';
    if (raw.startsWith('//') || raw.startsWith('/*') || raw.startsWith('#')) {
      tokenClass += ' comment';
    } else if (raw.startsWith('"') || raw.startsWith("'") || raw.startsWith('`')) {
      tokenClass += ' string';
    } else if (/^\d/.test(raw)) {
      tokenClass += ' number';
    } else {
      tokenClass += ' keyword';
    }

    result += `<span class="${tokenClass}">${escapeHtml(raw)}</span>`;
    lastIndex = end;
  }

  if (lastIndex < line.length) {
    result += escapeHtml(line.slice(lastIndex));
  }

  return result || '&nbsp;';
}

function buildCodeLines(
  code: IssueCodeResponse | null,
  options: { withLineNumbers?: boolean; full?: boolean } = {},
) {
  if (!code || !code.snippet) return [];
  const lines = code.snippet.split(/\r?\n/);
  const startLine = options.full ? 1 : code.startLine ?? 1;
  return lines.map((line, index) => {
    const lineNumber = startLine + index;
    return {
      lineNumber,
      html: highlightLine(line),
      isIssueLine: code.line ? lineNumber === code.line : false,
    };
  });
}

function clearPollTimer() {
  if (pollTimer !== null) {
    clearTimeout(pollTimer);
    pollTimer = null;
  }
}

function stopPolling() {
  clearPollTimer();
  pollingActive.value = false;
  pollError.value = null;
}

function clearLlmPollTimer() {
  if (llmPollTimer !== null) {
    clearTimeout(llmPollTimer);
    llmPollTimer = null;
  }
}

function stopLlmPolling() {
  clearLlmPollTimer();
  llmPollingActive.value = false;
  llmPollError.value = null;
}

function resetFilters() {
  filters.severity = '';
  filters.type = '';
  filters.language = '';
  filters.filePath = '';
  filters.onlyNew = false;
  loadIssues();
}

function scheduleNextPoll(delay = 2000) {
  clearPollTimer();
  pollingActive.value = true;
  pollTimer = window.setTimeout(() => {
    pollTimer = null;
    void pollAnalysisStatus();
  }, delay);
}

function ensurePolling() {
  if (shouldPoll(analysis.value?.status)) {
    if (pollTimer === null) {
      scheduleNextPoll();
    }
  } else {
    stopPolling();
  }
}

function hasActiveLlmRuns(runs?: LlmRun[]) {
  return (runs ?? []).some((run) => run.status === 'QUEUED' || run.status === 'RUNNING');
}

function shouldPollLlm() {
  return Object.values(llmRunsByIssue.value).some((runs) => hasActiveLlmRuns(runs));
}

function scheduleLlmPoll(delay = 2000) {
  clearLlmPollTimer();
  llmPollingActive.value = true;
  llmPollTimer = window.setTimeout(() => {
    llmPollTimer = null;
    void pollLlmRuns();
  }, delay);
}

function ensureLlmPolling() {
  if (shouldPollLlm()) {
    if (llmPollTimer === null) {
      scheduleLlmPoll();
    }
  } else {
    stopLlmPolling();
  }
}

async function refreshSecondaryData() {
  await Promise.all([loadIssues(), loadQualityGate(), loadArtifacts(), loadSummary()]);
}

async function handleStatusTransition(
  previousStatus: AnalysisStatus | undefined,
  nextStatus: AnalysisStatus,
  skipSecondaryReload: boolean,
) {
  if (shouldPoll(nextStatus)) {
    ensurePolling();
    return;
  }

  stopPolling();
  if (!skipSecondaryReload && previousStatus && shouldPoll(previousStatus)) {
    await refreshSecondaryData();
  }
}

async function applyAnalysisUpdate(skipSecondaryReload: boolean) {
  const previousStatus = analysis.value?.status;
  const latest = await getAnalysis(analysisId);
  analysis.value = latest;
  await handleStatusTransition(previousStatus, latest.status, skipSecondaryReload);
}

async function loadAnalysis(options: LoadAnalysisOptions = {}) {
  const skipSecondaryReload = options.skipSecondaryReload ?? false;
  console.log('[analysis] loading', analysisId);
  loadingAnalysis.value = true;
  try {
    await applyAnalysisUpdate(skipSecondaryReload);
    await loadSummary();
    console.log('[analysis] loaded', analysis.value);
  } finally {
    loadingAnalysis.value = false;
  }
}

async function loadIssues() {
  loadingIssues.value = true;
  issuesError.value = null;
  try {
    console.log('[issues] loading', { analysisId, filters: { ...filters } });
    issues.value = await getIssues(analysisId, {
      severity: filters.severity || undefined,
      type: filters.type || undefined,
      language: filters.language || undefined,
      filePath: filters.filePath || undefined,
      onlyNew: filters.onlyNew || undefined,
    });
    console.log('[issues] loaded', issues.value);
    if (selectedIssue.value && !issues.value.find((issue) => issue.id === selectedIssue.value?.id)) {
      selectedIssue.value = null;
      issueCode.value = null;
      issueCodeError.value = null;
      issueCodeFull.value = null;
      issueCodeFullError.value = null;
      showIssueCodeModal.value = false;
    }

    const currentIssueIds = new Set(issues.value.map((issue) => issue.id));
    for (const issueId of Object.keys(llmRunsByIssue.value)) {
      if (!currentIssueIds.has(issueId)) {
        delete llmRunsByIssue.value[issueId];
        delete llmRunsLoading.value[issueId];
        delete llmRunsError.value[issueId];
        delete llmRunActionLoading.value[issueId];
      }
    }
  } catch (err: any) {
    issuesError.value = err?.message ?? t('analysis.errorLoadIssues');
  } finally {
    loadingIssues.value = false;
    ensureLlmPolling();
  }
}

async function loadIssueLlmRuns(issueId: string, options: { silent?: boolean } = {}) {
  const silent = options.silent ?? false;
  if (!silent) {
    llmRunsLoading.value[issueId] = true;
  }
  llmRunsError.value[issueId] = null;
  try {
    const data = await getIssueLlmRuns(issueId);
    llmRunsByIssue.value[issueId] = data.runs;
  } catch (err: any) {
    llmRunsError.value[issueId] = err?.message ?? t('analysis.llmRunsLoadError');
  } finally {
    if (!silent) {
      llmRunsLoading.value[issueId] = false;
    }
    ensureLlmPolling();
  }
}

async function loadIssueCode(issueId: string, options: { full?: boolean } = {}) {
  if (options.full) {
    issueCodeFullLoading.value = true;
    issueCodeFullError.value = null;
    try {
      issueCodeFull.value = await getIssueCode(issueId, { full: true });
    } catch (err: any) {
      issueCodeFullError.value = err?.message ?? t('analysis.issueCodeFullLoadError');
    } finally {
      issueCodeFullLoading.value = false;
    }
    return;
  }

  issueCodeLoading.value = true;
  issueCodeError.value = null;
  try {
    issueCode.value = await getIssueCode(issueId);
  } catch (err: any) {
    issueCodeError.value = err?.message ?? t('analysis.issueCodeLoadError');
  } finally {
    issueCodeLoading.value = false;
  }
}

function openLlmRuns(issue: Issue) {
  llmIssue.value = issue;
  showLlmRunsModal.value = true;
  void loadIssueLlmRuns(issue.id);
}

function closeLlmRuns() {
  showLlmRunsModal.value = false;
  llmIssue.value = null;
}

async function resolveIssueViaLlm(issue?: Issue | null) {
  if (!issue) return;
  llmRunActionLoading.value[issue.id] = true;
  try {
    await resolveIssueViaLlmApi(issue.id);
    await loadIssueLlmRuns(issue.id);
  } catch (err: any) {
    alert(err?.message ?? t('analysis.llmResolveError'));
  } finally {
    llmRunActionLoading.value[issue.id] = false;
  }
}

async function pollLlmRuns() {
  const issueIds = Object.keys(llmRunsByIssue.value).filter((issueId) =>
    hasActiveLlmRuns(llmRunsByIssue.value[issueId]),
  );
  if (!issueIds.length) {
    stopLlmPolling();
    return;
  }

  try {
    await Promise.all(issueIds.map((issueId) => loadIssueLlmRuns(issueId, { silent: true })));
    llmPollError.value = null;
  } catch (err: any) {
    llmPollError.value = err?.message ?? t('analysis.llmRunsLoadError');
  } finally {
    if (shouldPollLlm()) {
      scheduleLlmPoll(llmPollError.value ? 4000 : 2000);
    } else {
      stopLlmPolling();
    }
  }
}

async function openIssueCode(issue: Issue) {
  if (selectedIssue.value?.id !== issue.id) {
    selectedIssue.value = issue;
    issueCode.value = null;
    issueCodeError.value = null;
    issueCodeFull.value = null;
    issueCodeFullError.value = null;
  }
  codeModalMode.value = 'snippet';
  showIssueCodeModal.value = true;
  await loadIssueCode(issue.id);
}

function openFullCode() {
  if (!selectedIssue.value) return;
  codeModalMode.value = 'full';
  void loadIssueCode(selectedIssue.value.id, { full: true });
}

function showSnippet() {
  codeModalMode.value = 'snippet';
}

function closeIssueCodeModal() {
  showIssueCodeModal.value = false;
}

async function loadSummary() {
  loadingSummary.value = true;
  summaryError.value = null;
  try {
    summary.value = await getAnalysisSummary(analysisId);
  } catch (err: any) {
    summaryError.value = err?.message ?? t('analysis.errorLoadSummary');
  } finally {
    loadingSummary.value = false;
  }
}

let debounceTimer: number | null = null;
function debouncedLoadIssues() {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = window.setTimeout(() => {
    loadIssues();
  }, 300);
}

async function loadQualityGate() {
  qgError.value = null;
  try {
    console.log('[quality-gate] loading', analysisId);
    qualityGate.value = await getQualityGateStatus(analysisId);
    console.log('[quality-gate] loaded', qualityGate.value);
  } catch (err: any) {
    qgError.value = err?.message ?? t('analysis.errorNoQualityGate');
  }
}

async function loadArtifacts() {
  loadingArtifacts.value = true;
  artifactsError.value = null;
  try {
    console.log('[artifacts] loading', analysisId);
    const data = await getArtifacts(analysisId);
    artifacts.value = data;
    const hasLog = data.some((artifact) => artifact.kind === 'LOG');
    if (!hasLog) {
      logContent.value = '';
      logError.value = null;
    } else if (!logContent.value) {
      selectedLogAnalyzer.value = data.find((a) => a.kind === 'LOG')?.analyzerKey ?? null;
      void loadLog({ silent: true });
    }
    console.log('[artifacts] loaded', artifacts.value);
  } catch (err: any) {
    artifactsError.value = err?.message ?? t('analysis.errorLoadArtifacts');
  } finally {
    loadingArtifacts.value = false;
  }
}

async function openArtifact(kind: ArtifactKind, analyzerKey?: string) {
  if (kind === 'LOG') {
    await loadLog();
    return;
  }
  try {
    const { blob, filename } = await downloadArtifact(analysisId, kind, analyzerKey);
    const objectUrl = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.target = '_blank';
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 5000);
  } catch (err: any) {
    artifactsError.value = err?.message ?? t('analysis.errorOpenArtifact');
  }
}

async function loadLog(options: { silent?: boolean } = {}) {
  if (!hasLogArtifact.value) {
    logError.value = t('analysis.errorNoLogs');
    return;
  }
  const silent = options.silent ?? false;
  if (!silent) {
    loadingLog.value = true;
  }
  logError.value = null;
  try {
    const { text } = await getArtifactText(analysisId, 'LOG', selectedLogAnalyzer.value ?? undefined);
    logContent.value = text || '';
  } catch (err: any) {
    logError.value = err?.message ?? t('analysis.errorLoadLogs');
  } finally {
    if (!silent) {
      loadingLog.value = false;
    }
  }
}

async function pollAnalysisStatus() {
  if (!shouldPoll(analysis.value?.status)) {
    stopPolling();
    return;
  }
  try {
    await applyAnalysisUpdate(false);
    pollError.value = null;
  } catch (err: any) {
    pollError.value = err?.message ?? t('analysis.errorAutoRefresh');
  } finally {
    if (shouldPoll(analysis.value?.status)) {
      const delay = pollError.value ? 4000 : 2000;
      scheduleNextPoll(delay);
    } else {
      stopPolling();
    }
  }
}

function prettySize(value: number | string) {
  const num = typeof value === 'string' ? parseInt(value, 10) : value;
  if (!num || Number.isNaN(num)) return t('common.notAvailable');
  if (num < 1024) return `${num} B`;
  if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
  return `${(num / 1024 / 1024).toFixed(1)} MB`;
}

async function loadAll() {
  await Promise.all([
    loadAnalysis({ skipSecondaryReload: true }),
    loadIssues(),
    loadQualityGate(),
    loadArtifacts(),
  ]);
}

const openIssueMenus = ref<Record<string, boolean>>({});

function toggleIssueStatusMenu(issueId: string) {
  // Close all other menus first to prevent conflicts
  const isCurrentlyOpen = openIssueMenus.value[issueId];
  openIssueMenus.value = {};
  openIssueMenus.value[issueId] = !isCurrentlyOpen;
}

function closeAllMenus() {
  openIssueMenus.value = {};
}

async function resolveIssue(issueId: string, status: IssueStatus) {
  try {
    await resolveIssueApi(issueId, {
      status,
      author: 'user@example.com', // TODO: get from auth context
      comment: undefined,
    });

    // Close all menus
    closeAllMenus();

    // Reload issues and summary
    await Promise.all([loadIssues(), loadSummary()]);
  } catch (err: any) {
    alert(err?.message ?? t('analysis.errorUpdateStatus'));
  }
}

// Close menus when clicking outside
onMounted(() => {
  void loadAll();

  const handleClickOutside = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    // Close menus if clicking outside any issue-actions area
    if (!target.closest('.issue-actions')) {
      closeAllMenus();
    }
  };

  // Use capture phase to ensure we catch the event before any other handlers
  document.addEventListener('click', handleClickOutside, true);

  onBeforeUnmount(() => {
    stopPolling();
    stopLlmPolling();
    document.removeEventListener('click', handleClickOutside, true);
  });
});
</script>

<style scoped>
/* Page and header styles are now in global main.css */
/* Top row: 3 cards equal width */
.top-row {
  display: grid;
  @apply gap-4 mb-4;
  grid-template-columns: repeat(3, 1fr);
}

/* Metrics row: 3 cards equal width */
.metrics-row {
  display: grid;
  @apply gap-4 mb-4;
  grid-template-columns: repeat(3, 1fr);
}

/* Compact cards in top row */
.card-compact {
  @apply p-[12px_14px];
}

.card-compact h3 {
  @apply mt-0 mb-2 text-sm font-semibold;
}

/* Responsive */
@media (max-width: 1200px) {
  .top-row {
    @apply-cols-1;
  }

  .metrics-row {
    @apply-cols-1;
  }
}

@media (min-width: 1201px) and (max-width: 1600px) {
  .top-row {
    grid-template-columns: repeat(2, 1fr);
  }
}

.grid {
  display: grid;
  @apply gap-3;
  grid-template-columns: 280px 1fr 1fr;
  grid-auto-rows: 1fr;
}

@media (max-width: 1024px) {
  .grid {
    @apply-cols-1;
    grid-auto-rows: auto;
  }
}

.left-column {
  @apply flex flex-col gap-3;
}

.grid > .card,
.grid > .left-column {
  @apply h-full;
}

.left-column > .card {
  @apply flex-1 min-h-0;
}

.info-text {
  @apply mt-0.5 break-words text-[13px];
  overflow-wrap: break-word;
}

.info-value {
  @apply inline-block max-w-full overflow-hidden text-ellipsis whitespace-nowrap align-bottom;
}
.status {
  @apply rounded-full px-3 py-[5px] text-[11px] font-bold tracking-[0.5px] uppercase border border-transparent transition-all duration-300;
  box-shadow: 0 2px 4px var(--card-shadow);
}
.status[data-status='SUCCESS'] {
  background: linear-gradient(135deg, var(--badge-success-bg-start) 0%, var(--badge-success-bg-end) 100%);
  color: var(--badge-success-text);
  border-color: var(--badge-success-border);
}
.status[data-status='RUNNING'] {
  background: linear-gradient(135deg, var(--badge-running-bg-start) 0%, var(--badge-running-bg-end) 100%);
  color: var(--badge-running-text);
  border-color: var(--badge-running-border);
}
.status[data-status='FAILED'] {
  background: linear-gradient(135deg, var(--badge-failed-bg-start) 0%, var(--badge-failed-bg-end) 100%);
  color: var(--badge-failed-text);
  border-color: var(--badge-failed-border);
}
.status[data-status='PENDING'] {
  background: linear-gradient(135deg, var(--badge-pending-bg-start) 0%, var(--badge-pending-bg-end) 100%);
  color: var(--badge-pending-text);
  border-color: var(--badge-pending-border);
}
.qg {
  @apply flex flex-col gap-1.5;
}

.qg-status {
  @apply px-3.5 py-1.5 rounded-full w-fit font-bold text-xs uppercase tracking-[0.5px] border-2 border-transparent transition-all duration-300;
  box-shadow: 0 2px 6px var(--card-shadow);
}
.qg-status[data-status='PASS'] {
  background: linear-gradient(135deg, var(--badge-success-bg-start) 0%, var(--badge-success-bg-end) 100%);
  color: var(--badge-success-text);
  border-color: var(--badge-success-border);
}
.qg-status[data-status='FAIL'] {
  background: linear-gradient(135deg, var(--badge-failed-bg-start) 0%, var(--badge-failed-bg-end) 100%);
  color: var(--badge-failed-text);
  border-color: var(--badge-failed-border);
}
.conditions {
  @apply flex flex-col gap-1.5 mt-0.5;
}

.condition {
  @apply border rounded-lg p-[8px_10px] text-[13px] transition-all duration-300;
  border-color: var(--border-primary);
  background: linear-gradient(135deg, var(--card-bg-start) 0%, var(--card-bg-end) 100%);
}

.condition:hover {
  border-color: var(--border-secondary);
  box-shadow: 0 2px 8px var(--card-shadow);
}
.issues-header {
  @apply flex justify-between items-center gap-3 flex-wrap;
}

.issues-meta {
  @apply flex items-center gap-[10px] flex-wrap;
}

.pill-info {
  @apply px-3.5 py-2 rounded-full font-bold text-xs uppercase tracking-[0.3px] border transition-all duration-300;
  background: linear-gradient(135deg, var(--info-bg-start) 0%, var(--info-bg-end) 100%);
  color: var(--info-text);
  border-color: var(--info-border);
  box-shadow: 0 2px 4px var(--info-shadow);
}

.ghost-button.compact {
  @apply px-[10px] py-2 rounded-lg;
}

.filter-bar {
  display: grid;
  @apply gap-3 items-end mt-3.5 p-4 border-2 rounded-xl transition-all duration-300;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  border-color: var(--border-primary);
  background: linear-gradient(135deg, var(--card-bg-start) 0%, var(--card-bg-end) 100%);
}

.filter-bar:hover {
  border-color: var(--border-secondary);
  box-shadow: 0 2px 8px var(--card-shadow);
}

.filter-chip {
  @apply flex flex-col gap-1.5;
}

.filter-chip.grow {
  @apply col-span-2;
}

.filter-chip select,
.filter-chip input {
  @apply w-full;
}
.issues {
  @apply flex flex-col gap-3 mt-3;
}

.issue {
  @apply border-2 rounded-xl p-[14px_16px] relative z-[1] transition-all duration-300;
  border-color: var(--border-primary);
  background: linear-gradient(135deg, var(--card-bg-start) 0%, var(--card-bg-end) 100%);
}

.issue.selected {
  border-color: var(--border-secondary);
  box-shadow: 0 6px 16px var(--card-shadow-hover);
}

.issue:hover {
  @apply -translate-y-px;
  border-color: var(--border-secondary);
  box-shadow: 0 4px 12px var(--card-shadow-hover);
}

.issue:has(.issue-status-menu) {
  @apply z-[100];
}

.issue-header {
  @apply flex gap-2 flex-wrap items-center justify-between;
}

.issue-badges {
  @apply flex gap-2 flex-wrap items-center;
}

.issue-footer {
  @apply flex justify-between items-center mt-2 flex-wrap gap-2;
}

.issue-actions {
  @apply relative z-[1] flex items-center gap-2 flex-wrap;
}

.llm-modal-actions {
  @apply flex items-center gap-3 flex-wrap mb-4;
}

.llm-latest-date {
  @apply text-[12px];
}

.llm-error {
  color: var(--error-text);
}

.llm-status {
  @apply px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-[0.3px] border-2 transition-all duration-300;
  box-shadow: 0 2px 4px var(--card-shadow);
}

.llm-status[data-status='SUCCESS'] {
  background: linear-gradient(135deg, var(--badge-success-bg-start) 0%, var(--badge-success-bg-end) 100%);
  color: var(--badge-success-text);
  border-color: var(--badge-success-border);
}

.llm-status[data-status='RUNNING'] {
  background: linear-gradient(135deg, var(--badge-running-bg-start) 0%, var(--badge-running-bg-end) 100%);
  color: var(--badge-running-text);
  border-color: var(--badge-running-border);
}

.llm-status[data-status='FAILED'] {
  background: linear-gradient(135deg, var(--badge-failed-bg-start) 0%, var(--badge-failed-bg-end) 100%);
  color: var(--badge-failed-text);
  border-color: var(--badge-failed-border);
}

.llm-status[data-status='QUEUED'] {
  background: linear-gradient(135deg, var(--badge-pending-bg-start) 0%, var(--badge-pending-bg-end) 100%);
  color: var(--badge-pending-text);
  border-color: var(--badge-pending-border);
}

.llm-runs-list {
  @apply flex flex-col gap-3;
  max-height: 55vh;
  overflow-y: auto;
  padding-right: 6px;
}

.llm-run {
  @apply border-2 rounded-lg p-3 flex flex-col gap-2;
  border-color: var(--border-primary);
  background: linear-gradient(135deg, var(--card-bg-start) 0%, var(--card-bg-end) 100%);
}

.llm-run-header {
  @apply flex flex-wrap gap-2 items-center;
}

.llm-run-meta {
  @apply flex flex-wrap gap-2 items-center text-[13px];
}

.llm-run-link {
  @apply font-semibold underline underline-offset-2;
  color: var(--text-primary);
}

.llm-run-pill {
  @apply px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.3px] border;
  background: linear-gradient(135deg, var(--info-bg-start) 0%, var(--info-bg-end) 100%);
  color: var(--info-text);
  border-color: var(--info-border);
  box-shadow: 0 2px 4px var(--info-shadow);
}

.llm-run-logs {
  @apply flex flex-col gap-2;
}

.llm-run-logs-title {
  @apply text-[12px] uppercase tracking-[0.3px] font-semibold;
  color: var(--text-secondary);
}

.llm-run-log {
  @apply rounded-lg border-2 p-3 text-[12px] leading-relaxed overflow-auto;
  border-color: var(--border-primary);
  background: var(--log-bg);
  color: var(--log-text);
  white-space: pre-wrap;
  max-height: 240px;
}

.llm-run-log.error {
  color: var(--error-text);
}

.llm-run-patch {
  @apply text-[12px];
}

.llm-run-files {
  @apply flex flex-col gap-2;
}

.llm-run-file {
  @apply text-[12px];
}

.llm-run-file summary {
  @apply cursor-pointer font-semibold;
}

.llm-run-file pre {
  @apply mt-2 rounded-lg border-2 p-3 text-[12px] leading-relaxed overflow-auto;
  border-color: var(--border-primary);
  background: var(--log-bg);
  color: var(--log-text);
  white-space: pre;
  max-height: 320px;
}

.llm-run-patch summary {
  @apply cursor-pointer font-semibold;
}

.llm-run-patch pre {
  @apply mt-2 rounded-lg border-2 p-3 text-[12px] leading-relaxed overflow-auto;
  border-color: var(--border-primary);
  background: var(--log-bg);
  color: var(--log-text);
  white-space: pre;
  max-height: 320px;
}
.issue-status-button {
  @apply px-3 py-1.5 border rounded-lg text-[13px] font-semibold cursor-pointer transition-all duration-300 select-none;
  border-color: var(--ghost-btn-border);
  background: linear-gradient(135deg, var(--ghost-btn-bg-start) 0%, var(--ghost-btn-bg-end) 100%);
  color: var(--ghost-btn-text);
  box-shadow: 0 1px 2px var(--ghost-btn-shadow);
}

.issue-status-button:hover {
  background: linear-gradient(135deg, var(--ghost-btn-bg-hover-start) 0%, var(--ghost-btn-bg-hover-end) 100%);
  border-color: var(--ghost-btn-border-hover);
  box-shadow: 0 2px 4px var(--ghost-btn-shadow-hover);
}

.issue-status-button:active {
  @apply translate-y-px;
  box-shadow: 0 1px 2px var(--ghost-btn-shadow);
}

.issue-status-menu {
  @apply absolute right-0 top-full mt-1.5 border-2 rounded-lg z-[10000] min-w-[200px] overflow-hidden pointer-events-auto;
  background: var(--issue-menu-bg);
  border-color: var(--issue-menu-border);
  box-shadow: 0 12px 24px var(--issue-menu-shadow);
  animation: slideDown 0.15s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.issue-status-menu button {
  @apply block w-full text-left px-3 py-2 border rounded-lg text-[13px] font-semibold cursor-pointer transition-all duration-200;
  border-color: var(--ghost-btn-border);
  background: linear-gradient(135deg, var(--ghost-btn-bg-start) 0%, var(--ghost-btn-bg-end) 100%);
  color: var(--ghost-btn-text);
  box-shadow: 0 1px 2px var(--ghost-btn-shadow);
}

.issue-status-menu button:hover,
.issue-status-menu button:focus-visible {
  background: linear-gradient(135deg, var(--ghost-btn-bg-hover-start) 0%, var(--ghost-btn-bg-hover-end) 100%);
  border-color: var(--ghost-btn-border-hover);
  box-shadow: 0 2px 4px var(--ghost-btn-shadow-hover);
}

.issue-status-menu button:active {
  @apply translate-y-px;
  box-shadow: 0 1px 2px var(--ghost-btn-shadow);
}

.issue-status-menu button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.code-modal-actions {
  @apply flex flex-wrap items-center gap-3 mb-4;
}

.code-block {
  @apply rounded-xl border-2 p-4 text-[12px] leading-relaxed overflow-auto;
  border-color: var(--border-primary);
  background: var(--log-bg);
  color: var(--log-text);
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  max-height: 360px;
}

.code-block code {
  display: block;
  white-space: pre;
}

.code-block.full {
  max-height: 65vh;
}

.code-line {
  display: grid;
  grid-template-columns: 48px 1fr;
  gap: 12px;
  padding: 2px 6px;
  border-radius: 8px;
}

.code-line.ellipsis {
  grid-template-columns: 1fr;
  color: var(--text-secondary);
  justify-items: center;
  letter-spacing: 2px;
}

.code-line-number {
  color: var(--text-secondary);
  text-align: right;
  user-select: none;
}

.code-line-content {
  white-space: pre;
}

.code-line.active {
  background: rgba(255, 214, 10, 0.14);
  box-shadow: inset 0 0 0 1px rgba(255, 214, 10, 0.35);
}

.code-line.active .code-line-content {
  text-decoration: underline;
  text-decoration-color: rgba(255, 214, 10, 0.8);
  text-decoration-thickness: 2px;
  text-underline-offset: 3px;
}

.code-block :deep(.code-token.keyword) {
  color: #7dd3fc;
}

.code-block :deep(.code-token.string) {
  color: #fca5a5;
}

.code-block :deep(.code-token.comment) {
  color: #94a3b8;
  font-style: italic;
}

.code-block :deep(.code-token.number) {
  color: #facc15;
}

.modal-overlay {
  @apply fixed inset-0 z-[200] flex items-center justify-center p-4;
  background: var(--modal-overlay-bg);
  backdrop-filter: blur(4px);
}

.modal-content {
  @apply w-full max-w-4xl rounded-2xl border-2 overflow-hidden;
  border-color: var(--border-primary);
  background: var(--bg-primary);
  box-shadow: 0 20px 60px var(--modal-shadow);
}

.modal-header {
  @apply flex items-start justify-between gap-4 px-6 py-4 border-b-2;
  border-color: var(--border-primary);
}

.modal-close {
  @apply text-xl leading-none rounded-full w-9 h-9 flex items-center justify-center border-2 transition-all duration-200;
  border-color: var(--border-primary);
  background: var(--bg-primary);
  color: var(--text-primary);
}

.modal-close:hover {
  border-color: var(--border-secondary);
  box-shadow: 0 4px 10px var(--card-shadow-hover);
}

.modal-body {
  @apply p-5;
}
.badge {
  @apply px-3 py-[5px] rounded-[10px] text-[11px] font-bold uppercase tracking-[0.3px] border border-transparent transition-all duration-300;
  box-shadow: 0 2px 4px var(--card-shadow);
}
.badge.analyzer {
  background: linear-gradient(135deg, var(--info-bg-start) 0%, var(--info-bg-end) 100%);
  color: var(--info-text);
  border-color: var(--info-border);
}
.badge.type[data-type='VULNERABILITY'] {
  background: linear-gradient(135deg, var(--badge-vulnerability-bg-start) 0%, var(--badge-vulnerability-bg-end) 100%);
  color: var(--badge-vulnerability-text);
  border-color: var(--badge-vulnerability-border);
}

.badge.type[data-type='BUG'] {
  background: linear-gradient(135deg, var(--badge-bug-bg-start) 0%, var(--badge-bug-bg-end) 100%);
  color: var(--badge-bug-text);
  border-color: var(--badge-bug-border);
}

.badge.type[data-type='CODE_SMELL'] {
  background: linear-gradient(135deg, var(--badge-codesmell-bg-start) 0%, var(--badge-codesmell-bg-end) 100%);
  color: var(--badge-codesmell-text);
  border-color: var(--badge-codesmell-border);
}
.badge.severity[data-severity='BLOCKER'] {
  background: linear-gradient(135deg, var(--badge-blocker-bg-start) 0%, var(--badge-blocker-bg-end) 100%);
  color: var(--badge-blocker-text);
  border-color: var(--badge-blocker-border);
}
.badge.severity[data-severity='CRITICAL'] {
  background: linear-gradient(135deg, var(--badge-critical-bg-start) 0%, var(--badge-critical-bg-end) 100%);
  color: var(--badge-critical-text);
  border-color: var(--badge-critical-border);
}
.badge.severity[data-severity='MAJOR'] {
  background: linear-gradient(135deg, var(--badge-major-bg-start) 0%, var(--badge-major-bg-end) 100%);
  color: var(--badge-major-text);
  border-color: var(--badge-major-border);
}
.badge.severity[data-severity='MINOR'] {
  background: linear-gradient(135deg, var(--badge-minor-bg-start) 0%, var(--badge-minor-bg-end) 100%);
  color: var(--badge-minor-text);
  border-color: var(--badge-minor-border);
}
.badge.severity[data-severity='INFO'] {
  background: linear-gradient(135deg, var(--badge-info-bg-start) 0%, var(--badge-info-bg-end) 100%);
  color: var(--badge-info-text);
  border-color: var(--badge-info-border);
}
.badge.status[data-status='FALSE_POSITIVE'] {
  background: linear-gradient(135deg, var(--badge-falsepositive-bg-start) 0%, var(--badge-falsepositive-bg-end) 100%);
  color: var(--badge-falsepositive-text);
  border-color: var(--badge-falsepositive-border);
}
.badge.status[data-status='ACCEPTED_RISK'] {
  background: linear-gradient(135deg, var(--badge-acceptedrisk-bg-start) 0%, var(--badge-acceptedrisk-bg-end) 100%);
  color: var(--badge-acceptedrisk-text);
  border-color: var(--badge-acceptedrisk-border);
}
.badge.status[data-status='RESOLVED'] {
  background: linear-gradient(135deg, var(--badge-resolved-bg-start) 0%, var(--badge-resolved-bg-end) 100%);
  color: var(--badge-resolved-text);
  border-color: var(--badge-resolved-border);
}
.badge.pass {
  background: linear-gradient(135deg, var(--badge-success-bg-start) 0%, var(--badge-success-bg-end) 100%);
  color: var(--badge-success-text);
  border: 1px solid var(--badge-success-border);
  box-shadow: 0 2px 4px var(--badge-success-shadow);
}
.badge.fail {
  background: linear-gradient(135deg, var(--badge-failed-bg-start) 0%, var(--badge-failed-bg-end) 100%);
  color: var(--badge-failed-text);
  border: 1px solid var(--badge-failed-border);
  box-shadow: 0 2px 4px var(--badge-failed-shadow);
}
.pill-new {
  @apply px-2 py-[3px] rounded-lg text-[10px] ml-1.5 font-bold uppercase tracking-[0.5px] border;
  background: linear-gradient(135deg, var(--badge-new-bg-start) 0%, var(--badge-new-bg-end) 100%);
  color: var(--badge-new-text);
  border-color: var(--badge-new-border);
  box-shadow: 0 2px 4px var(--badge-new-shadow);
}
.summary-grid {
  display: grid;
  @apply gap-3 mt-3;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
}

.summary-tile {
  @apply border rounded-lg p-3 text-center transition-all duration-300;
  background: var(--bg-tertiary);
  border-color: var(--border-primary);
}

.summary-tile:hover {
  border-color: var(--border-secondary);
  box-shadow: 0 2px 4px var(--card-shadow);
}

.summary-label {
  @apply text-[11px] font-semibold uppercase tracking-wider mb-1 transition-colors duration-300;
  color: var(--text-secondary);
}

.summary-value {
  @apply text-xl font-semibold leading-none mb-0.5 transition-colors duration-300;
  color: var(--text-primary);
}

.summary-value-new {
  color: var(--success-text);
}

.summary-value-critical {
  color: var(--danger-text);
}

.summary-value-vuln {
  color: var(--warning-text);
}
.mini-bars {
  @apply mt-4 flex flex-col gap-3 pt-4 border-t-2 transition-colors duration-300;
  border-color: var(--border-primary);
}

.mini-bar-label {
  @apply text-[13px] font-semibold mb-2 uppercase tracking-[0.5px] transition-colors duration-300;
  color: var(--text-secondary);
}

.mini-bar .bar {
  @apply flex gap-1.5 mt-1.5;
}

.mini-bar .bar-seg {
  @apply flex flex-col gap-0.5 p-[8px_6px] rounded-lg text-center border transition-all duration-300;
  background: var(--bg-tertiary);
  border-color: var(--border-primary);
}

.mini-bar .bar-seg:hover {
  @apply -translate-y-0.5;
  box-shadow: 0 2px 6px var(--card-shadow-hover);
}

.bar-seg-label {
  @apply text-[10px] font-semibold uppercase tracking-[0.3px] transition-colors duration-300;
  color: var(--text-secondary);
}

.bar-seg-value {
  @apply text-base font-bold transition-colors duration-300;
  color: var(--text-primary);
}
.mini-bar .bar-seg[data-severity='BLOCKER'] {
  background: linear-gradient(135deg, var(--badge-blocker-bg-start) 0%, var(--badge-blocker-bg-end) 100%);
  border-color: var(--badge-blocker-border);
}
.mini-bar .bar-seg[data-severity='BLOCKER'] .bar-seg-value {
  color: var(--badge-blocker-text);
}
.mini-bar .bar-seg[data-severity='CRITICAL'] {
  background: linear-gradient(135deg, var(--badge-critical-bg-start) 0%, var(--badge-critical-bg-end) 100%);
  border-color: var(--badge-critical-border);
}
.mini-bar .bar-seg[data-severity='CRITICAL'] .bar-seg-value {
  color: var(--badge-critical-text);
}
.mini-bar .bar-seg[data-severity='MAJOR'] {
  background: linear-gradient(135deg, var(--badge-major-bg-start) 0%, var(--badge-major-bg-end) 100%);
  border-color: var(--badge-major-border);
}
.mini-bar .bar-seg[data-severity='MAJOR'] .bar-seg-value {
  color: var(--badge-major-text);
}
.mini-bar .bar-seg[data-severity='MINOR'] {
  background: linear-gradient(135deg, var(--badge-minor-bg-start) 0%, var(--badge-minor-bg-end) 100%);
  border-color: var(--badge-minor-border);
}
.mini-bar .bar-seg[data-severity='MINOR'] .bar-seg-value {
  color: var(--badge-minor-text);
}
.mini-bar .bar-seg[data-severity='INFO'] {
  background: linear-gradient(135deg, var(--badge-info-bg-start) 0%, var(--badge-info-bg-end) 100%);
  border-color: var(--badge-info-border);
}
.mini-bar .bar-seg[data-severity='INFO'] .bar-seg-value {
  color: var(--badge-info-text);
}
/* .section-header is now in global main.css */
.artifacts {
  @apply flex flex-col gap-[10px] mt-[10px];
}

.artifact-row {
  @apply flex justify-between items-center p-[14px_16px] border-2 rounded-xl transition-all duration-300;
  border-color: var(--border-primary);
  background: linear-gradient(135deg, var(--card-bg-start) 0%, var(--card-bg-end) 100%);
}

.artifact-row:hover {
  @apply -translate-y-px;
  border-color: var(--border-secondary);
  box-shadow: 0 4px 12px var(--card-shadow-hover);
}

.header-actions {
  @apply flex flex-col items-end gap-1;
}

.header-actions-row {
  @apply flex items-center gap-[10px];
}

.auto-refresh {
  @apply text-xs transition-colors duration-300;
  color: var(--text-secondary);
}

.auto-refresh.error {
  color: var(--error-text);
}

.log-viewer {
  @apply rounded-[10px] p-3.5 max-h-[360px] overflow-auto text-[13px] leading-relaxed whitespace-pre-wrap border-2 transition-all duration-300;
  background: var(--log-bg);
  color: var(--log-text);
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  border-color: var(--log-border);
  box-shadow: inset 0 2px 4px var(--log-shadow);
}

</style>
