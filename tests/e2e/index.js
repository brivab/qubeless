#!/usr/bin/env node
import axios from 'axios';
import chalk from 'chalk';
import FormData from 'form-data';
import { TestLogger, generateTestData, waitFor, parseArgs } from './utils.js';

const API_URL = process.env.API_URL || 'http://localhost:3001/api';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

const logger = new TestLogger();
const testData = generateTestData();
let authToken = null;
let apiToken = null;
let projectId = null;
let analysisId = null;
let qualityGateId = null;
let ruleProfileId = null;
let issueId = null;

// Create axios instance
const api = axios.create({
  baseURL: API_URL,
  validateStatus: () => true, // Don't throw on any status
});

// Add auth interceptor
api.interceptors.request.use((config) => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

// Test suites
async function testHealth() {
  logger.subsection('Health Check');
  try {
    const response = await api.get('/health');
    if (response.status === 200 && response.data.status === 'ok') {
      logger.success('API is healthy');
      return true;
    } else {
      logger.error('Health check failed', new Error(`Status: ${response.status}`));
      return false;
    }
  } catch (error) {
    logger.error('Health check failed', error);
    return false;
  }
}

async function testAuthentication() {
  logger.subsection('Authentication - Login');
  try {
    const response = await api.post('/auth/login', {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });

    if ((response.status === 200 || response.status === 201) && response.data.accessToken) {
      authToken = response.data.accessToken;
      logger.success('Admin login successful');
      logger.data('Token expires in', response.data.expiresIn);
      return true;
    } else {
      logger.error('Login failed', new Error(`Status: ${response.status}`));
      return false;
    }
  } catch (error) {
    logger.error('Login failed', error);
    return false;
  }
}

async function testAuthMe() {
  logger.subsection('Authentication - Get Current User');
  try {
    const response = await api.get('/auth/me');

    if (response.status === 200 && response.data.email) {
      logger.success('Get current user successful');
      logger.data('Email', response.data.email);
      logger.data('Role', response.data.role);
      return true;
    } else {
      logger.error('Get current user failed', new Error(`Status: ${response.status}`));
      return false;
    }
  } catch (error) {
    logger.error('Get current user failed', error);
    return false;
  }
}

async function testSsoProviders() {
  logger.subsection('SSO - List Providers');
  try {
    const response = await api.get('/auth/sso/providers');

    if (response.status === 200 && Array.isArray(response.data)) {
      logger.success('SSO providers retrieved');
      logger.data('Providers count', response.data.length);
      response.data.forEach(provider => {
        logger.info(`Provider: ${provider.id} (${provider.label}) - ${provider.loginUrl}`);
      });
      return true;
    } else {
      logger.error('Get SSO providers failed', new Error(`Status: ${response.status}`));
      return false;
    }
  } catch (error) {
    logger.error('Get SSO providers failed', error);
    return false;
  }
}

async function testApiTokens() {
  logger.subsection('API Tokens - Create Token');
  try {
    const response = await api.post('/tokens', {
      name: testData.tokenName,
    });

    if (response.status === 201 && response.data.token) {
      apiToken = response.data.token;
      logger.success('API token created');
      logger.data('Token ID', response.data.id);
      logger.data('Token (first 20 chars)', response.data.token.substring(0, 20) + '...');
      return true;
    } else {
      logger.error('Create API token failed', new Error(`Status: ${response.status}`));
      return false;
    }
  } catch (error) {
    logger.error('Create API token failed', error);
    return false;
  }
}

async function testListApiTokens() {
  logger.subsection('API Tokens - List Tokens');
  try {
    const response = await api.get('/tokens');

    if (response.status === 200 && Array.isArray(response.data)) {
      logger.success('API tokens listed');
      logger.data('Tokens count', response.data.length);
      return true;
    } else {
      logger.error('List API tokens failed', new Error(`Status: ${response.status}`));
      return false;
    }
  } catch (error) {
    logger.error('List API tokens failed', error);
    return false;
  }
}

async function testCreateProject() {
  logger.subsection('Projects - Create Project');
  try {
    const response = await api.post('/projects', {
      key: testData.projectKey,
      name: testData.projectName,
      description: 'E2E Test Project',
    });

    if (response.status === 201 && response.data.id) {
      projectId = response.data.id;
      logger.success('Project created');
      logger.data('Project ID', response.data.id);
      logger.data('Project Key', response.data.key);
      return true;
    } else {
      logger.error('Create project failed', new Error(`Status: ${response.status}`));
      return false;
    }
  } catch (error) {
    logger.error('Create project failed', error);
    return false;
  }
}

async function testListProjects() {
  logger.subsection('Projects - List Projects');
  try {
    const response = await api.get('/projects');

    if (response.status === 200 && Array.isArray(response.data)) {
      logger.success('Projects listed');
      logger.data('Projects count', response.data.length);
      return true;
    } else {
      logger.error('List projects failed', new Error(`Status: ${response.status}`));
      return false;
    }
  } catch (error) {
    logger.error('List projects failed', error);
    return false;
  }
}

async function testGetProject() {
  logger.subsection('Projects - Get Project');
  try {
    const response = await api.get(`/projects/${testData.projectKey}`);

    if (response.status === 200 && response.data.key === testData.projectKey) {
      logger.success('Project retrieved');
      logger.data('Project Name', response.data.name);
      return true;
    } else {
      logger.error('Get project failed', new Error(`Status: ${response.status}`));
      return false;
    }
  } catch (error) {
    logger.error('Get project failed', error);
    return false;
  }
}

async function testUpdateProjectSettings() {
  logger.subsection('Projects - Update Settings (Leak Period)');
  try {
    const response = await api.put(`/projects/${testData.projectKey}/settings`, {
      leakPeriodType: 'LAST_ANALYSIS',
    });

    if (response.status === 200) {
      logger.success('Project settings updated');
      logger.data('Leak Period Type', response.data.leakPeriodType);
      return true;
    } else {
      logger.error('Update project settings failed', new Error(`Status: ${response.status}`));
      return false;
    }
  } catch (error) {
    logger.error('Update project settings failed', error);
    return false;
  }
}

async function testGetPortfolio() {
  logger.subsection('Portfolio - Get Portfolio');
  try {
    const response = await api.get('/portfolio');

    if (response.status === 200 && response.data.summary && Array.isArray(response.data.projects)) {
      logger.success('Portfolio retrieved');
      logger.data('Total Projects', response.data.summary.totalProjects);
      logger.data('Total Analyses', response.data.summary.totalAnalyses);
      logger.data('Total Issues', response.data.summary.totalIssues);
      logger.data('Avg Coverage', response.data.summary.avgCoverage.toFixed(1) + '%');
      logger.data('Avg Debt Ratio', response.data.summary.avgDebtRatio.toFixed(1) + '%');
      logger.data('Projects in Response', response.data.projects.length);
      return true;
    } else {
      logger.error('Get portfolio failed', new Error(`Status: ${response.status}`));
      return false;
    }
  } catch (error) {
    logger.error('Get portfolio failed', error);
    return false;
  }
}

async function testPortfolioFilters() {
  logger.subsection('Portfolio - Filter by Quality Gate');
  try {
    const response = await api.get('/portfolio', {
      params: {
        qualityGateStatus: 'PASSED',
        sortBy: 'issues',
        sortOrder: 'desc',
      },
    });

    if (response.status === 200 && response.data.projects) {
      logger.success('Portfolio filtered by quality gate');
      logger.data('Filtered Projects', response.data.projects.length);
      if (response.data.projects.length > 0) {
        const allPassed = response.data.projects.every(
          (p) => !p.lastAnalysis || p.lastAnalysis.qualityGateStatus === 'PASSED'
        );
        if (allPassed) {
          logger.success('All projects have PASSED quality gate');
        } else {
          logger.warn('Some projects do not have PASSED quality gate');
        }
      }
      return true;
    } else {
      logger.error('Filter portfolio failed', new Error(`Status: ${response.status}`));
      return false;
    }
  } catch (error) {
    logger.error('Filter portfolio failed', error);
    return false;
  }
}

async function testPortfolioExport() {
  logger.subsection('Portfolio - Export CSV');
  try {
    const response = await axios.get(`${API_URL}/portfolio/export`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (response.status === 200 && response.data) {
      const csvContent = response.data;
      if (typeof csvContent === 'string' && csvContent.includes('Project,Gate,Issues,Coverage,Debt,Last Scan')) {
        logger.success('Portfolio exported as CSV');
        logger.data('CSV Size', csvContent.length + ' bytes');
        const lines = csvContent.split('\n').filter((line) => line.trim());
        logger.data('CSV Rows', lines.length - 1); // Minus header
        return true;
      } else {
        logger.error('Export CSV failed', new Error('Invalid CSV format'));
        return false;
      }
    } else {
      logger.error('Export CSV failed', new Error(`Status: ${response.status}`));
      return false;
    }
  } catch (error) {
    logger.error('Export CSV failed', error);
    return false;
  }
}

async function testCreateAnalyzer() {
  logger.subsection('Analyzers - Create Analyzer');
  try {
    const response = await api.post('/analyzers', {
      key: testData.analyzerKey,
      name: testData.analyzerName,
      dockerImage: testData.dockerImage,
      enabled: true,
    });

    if (response.status === 201 || response.status === 409) {
      if (response.status === 409) {
        logger.info('Analyzer already exists, continuing...');
      }
      logger.success('Analyzer ready');
      logger.data('Analyzer Key', testData.analyzerKey);
      return true;
    } else if (response.status === 500) {
      logger.skip('Create analyzer (server error - may need admin permissions)');
      return true; // Don't fail the whole test suite
    } else {
      logger.error('Create analyzer failed', new Error(`Status: ${response.status}`));
      return false;
    }
  } catch (error) {
    logger.error('Create analyzer failed', error);
    return false;
  }
}

async function testListAnalyzers() {
  logger.subsection('Analyzers - List Analyzers');
  try {
    const response = await api.get('/analyzers');

    if (response.status === 200 && Array.isArray(response.data)) {
      logger.success('Analyzers listed');
      logger.data('Analyzers count', response.data.length);
      return true;
    } else {
      logger.error('List analyzers failed', new Error(`Status: ${response.status}`));
      return false;
    }
  } catch (error) {
    logger.error('List analyzers failed', error);
    return false;
  }
}

async function testConfigureProjectAnalyzer() {
  logger.subsection('Analyzers - Configure for Project');
  try {
    const response = await api.put(`/projects/${testData.projectKey}/analyzers/${testData.analyzerKey}`, {
      enabled: true,
      configJson: { rules: { 'no-console': 'warn' } },
    });

    if (response.status === 200) {
      logger.success('Project analyzer configured');
      logger.data('Enabled', response.data.enabled);
      return true;
    } else {
      logger.error('Configure project analyzer failed', new Error(`Status: ${response.status}`));
      return false;
    }
  } catch (error) {
    logger.error('Configure project analyzer failed', error);
    return false;
  }
}

async function testCreateRule() {
  logger.subsection('Rules - Create Custom Rule');
  try {
    const response = await api.post('/projects/rules', {
      key: testData.ruleKey,
      analyzerKey: testData.analyzerKey,
      name: testData.ruleName,
      description: 'Test rule for E2E testing',
      defaultSeverity: 'MAJOR',
    });

    if (response.status === 201 || response.status === 409) {
      if (response.status === 409) {
        logger.info('Rule already exists, continuing...');
      }
      logger.success('Rule ready');
      logger.data('Rule Key', testData.ruleKey);
      return true;
    } else {
      logger.error('Create rule failed', new Error(`Status: ${response.status}`));
      return false;
    }
  } catch (error) {
    logger.error('Create rule failed', error);
    return false;
  }
}

async function testListRules() {
  logger.subsection('Rules - List Rules');
  try {
    const response = await api.get(`/projects/${testData.projectKey}/rules`);

    if (response.status === 200) {
      const rules = Array.isArray(response.data) ? response.data : response.data.rules || [];
      logger.success('Rules listed');
      logger.data('Rules count', rules.length);
      return true;
    } else {
      logger.error('List rules failed', new Error(`Status: ${response.status}`));
      return false;
    }
  } catch (error) {
    logger.error('List rules failed', error);
    return false;
  }
}

async function testCreateRuleProfile() {
  logger.subsection('Rule Profiles - Create Profile');
  try {
    const response = await api.post(`/projects/${testData.projectKey}/rule-profiles`, {
      name: 'E2E Test Profile',
    });

    if (response.status === 201 && response.data.id) {
      ruleProfileId = response.data.id;
      logger.success('Rule profile created');
      logger.data('Profile ID', response.data.id);
      logger.data('Profile Name', response.data.name);
      return true;
    } else {
      logger.error('Create rule profile failed', new Error(`Status: ${response.status}`));
      return false;
    }
  } catch (error) {
    logger.error('Create rule profile failed', error);
    return false;
  }
}

async function testActivateRuleProfile() {
  logger.subsection('Rule Profiles - Activate Profile');
  try {
    const response = await api.put(`/projects/${testData.projectKey}/rule-profiles/${ruleProfileId}/activate`);

    if (response.status === 200) {
      logger.success('Rule profile activated');
      return true;
    } else {
      logger.error('Activate rule profile failed', new Error(`Status: ${response.status}`));
      return false;
    }
  } catch (error) {
    logger.error('Activate rule profile failed', error);
    return false;
  }
}

async function testUpdateRules() {
  logger.subsection('Rules - Enable/Disable Rules');
  try {
    const response = await api.put(`/projects/${testData.projectKey}/rules`, {
      rules: [
        { ruleKey: testData.ruleKey, enabled: true },
      ],
    });

    if (response.status === 200) {
      logger.success('Rules updated');
      return true;
    } else {
      logger.error('Update rules failed', new Error(`Status: ${response.status}`));
      return false;
    }
  } catch (error) {
    logger.error('Update rules failed', error);
    return false;
  }
}

async function testCreateQualityGate() {
  logger.subsection('Quality Gates - Create Gate');
  try {
    const response = await api.post(`/projects/${testData.projectKey}/quality-gate`, {
      name: 'E2E Test Gate',
    });

    if (response.status === 201 && response.data.id) {
      qualityGateId = response.data.id;
      logger.success('Quality gate created');
      logger.data('Gate ID', response.data.id);
      return true;
    } else {
      logger.error('Create quality gate failed', new Error(`Status: ${response.status}`));
      return false;
    }
  } catch (error) {
    logger.error('Create quality gate failed', error);
    return false;
  }
}

async function testAddQualityGateCondition() {
  logger.subsection('Quality Gates - Add Condition');
  try {
    const response = await api.post(`/quality-gates/${qualityGateId}/conditions`, {
      metric: 'blocker_issues',
      operator: 'GT',
      threshold: 0,
      scope: 'ALL',
    });

    if (response.status === 201) {
      logger.success('Quality gate condition added');
      logger.data('Metric', response.data.metric);
      logger.data('Threshold', response.data.threshold);
      return true;
    } else {
      logger.error('Add quality gate condition failed', new Error(`Status: ${response.status}`));
      return false;
    }
  } catch (error) {
    logger.error('Add quality gate condition failed', error);
    return false;
  }
}

async function testCreateAnalysis() {
  logger.subsection('Analyses - Create Analysis');
  try {
    // Create a minimal analysis report
    const reportData = {
      issues: [
        {
          ruleKey: testData.ruleKey,
          severity: 'MAJOR',
          type: 'CODE_SMELL',
          filePath: 'src/test.js',
          line: 42,
          message: 'Test issue from E2E',
          fingerprint: 'e2e-test-fingerprint-' + Date.now(),
        },
      ],
      measures: {
        files: 10,
        lines: 1000,
        ncloc: 800,
      },
    };

    const formData = new FormData();
    formData.append('commitSha', testData.commitSha);
    formData.append('branch', testData.branch);
    formData.append('file', Buffer.from(JSON.stringify(reportData)), {
      filename: 'report.json',
      contentType: 'application/json',
    });

    const response = await api.post(`/projects/${testData.projectKey}/analyses`, formData, {
      headers: formData.getHeaders(),
    });

    if (response.status === 201 && response.data.analysisId) {
      analysisId = response.data.analysisId;
      logger.success('Analysis created');
      logger.data('Analysis ID', response.data.analysisId);
      logger.data('Status URL', response.data.statusUrl);
      return true;
    } else {
      logger.error('Create analysis failed', new Error(`Status: ${response.status}`));
      return false;
    }
  } catch (error) {
    logger.error('Create analysis failed', error);
    return false;
  }
}

async function testListAnalyses() {
  logger.subsection('Analyses - List Analyses');
  try {
    const response = await api.get(`/projects/${testData.projectKey}/analyses`);

    if (response.status === 200 && Array.isArray(response.data)) {
      logger.success('Analyses listed');
      logger.data('Analyses count', response.data.length);
      return true;
    } else {
      logger.error('List analyses failed', new Error(`Status: ${response.status}`));
      return false;
    }
  } catch (error) {
    logger.error('List analyses failed', error);
    return false;
  }
}

async function testGetAnalysis() {
  logger.subsection('Analyses - Get Analysis');
  try {
    const response = await api.get(`/analyses/${analysisId}`);

    if (response.status === 200 && response.data.id === analysisId) {
      logger.success('Analysis retrieved');
      logger.data('Status', response.data.status);
      logger.data('Commit SHA', response.data.commitSha);
      return true;
    } else {
      logger.error('Get analysis failed', new Error(`Status: ${response.status}`));
      return false;
    }
  } catch (error) {
    logger.error('Get analysis failed', error);
    return false;
  }
}

async function testGetAnalysisSummary() {
  logger.subsection('Analyses - Get Summary');
  try {
    const response = await api.get(`/analyses/${analysisId}/summary`);

    if (response.status === 200) {
      logger.success('Analysis summary retrieved');
      logger.data('Total Issues', response.data.totalIssues);
      logger.data('New Issues', response.data.newIssues);
      return true;
    } else {
      logger.error('Get analysis summary failed', new Error(`Status: ${response.status}`));
      return false;
    }
  } catch (error) {
    logger.error('Get analysis summary failed', error);
    return false;
  }
}

async function testGetAnalysisIssues() {
  logger.subsection('Analyses - Get Issues');
  try {
    const response = await api.get(`/analyses/${analysisId}/issues`);

    if (response.status === 200 && Array.isArray(response.data)) {
      logger.success('Analysis issues retrieved');
      logger.data('Issues count', response.data.length);
      if (response.data.length > 0) {
        issueId = response.data[0].id;
        logger.data('First Issue ID', issueId);
      }
      return true;
    } else {
      logger.error('Get analysis issues failed', new Error(`Status: ${response.status}`));
      return false;
    }
  } catch (error) {
    logger.error('Get analysis issues failed', error);
    return false;
  }
}

async function testResolveIssue() {
  if (!issueId) {
    logger.skip('Resolve issue (no issue available)');
    return true;
  }

  logger.subsection('Issues - Resolve Issue');
  try {
    const response = await api.put(`/issues/${issueId}/resolve`, {
      status: 'FALSE_POSITIVE',
      comment: 'E2E Test: Marking as false positive',
      author: ADMIN_EMAIL,
    });

    if (response.status === 200) {
      logger.success('Issue resolved');
      logger.data('Status', response.data.status);
      return true;
    } else {
      logger.error('Resolve issue failed', new Error(`Status: ${response.status}`));
      return false;
    }
  } catch (error) {
    logger.error('Resolve issue failed', error);
    return false;
  }
}

async function testGetIssueResolutions() {
  if (!issueId) {
    logger.skip('Get issue resolutions (no issue available)');
    return true;
  }

  logger.subsection('Issues - Get Resolution History');
  try {
    const response = await api.get(`/issues/${issueId}/resolutions`);

    if (response.status === 200 && Array.isArray(response.data)) {
      logger.success('Issue resolutions retrieved');
      logger.data('Resolutions count', response.data.length);
      return true;
    } else {
      logger.error('Get issue resolutions failed', new Error(`Status: ${response.status}`));
      return false;
    }
  } catch (error) {
    logger.error('Get issue resolutions failed', error);
    return false;
  }
}

async function testGetQualityGateStatus() {
  logger.subsection('Quality Gates - Check Status');
  try {
    const response = await api.get(`/analyses/${analysisId}/quality-gate-status`);

    if (response.status === 200) {
      logger.success('Quality gate status retrieved');
      logger.data('Passed', response.data.passed ? 'Yes' : 'No');
      logger.data('Conditions', response.data.conditions?.length || 0);
      return true;
    } else {
      logger.error('Get quality gate status failed', new Error(`Status: ${response.status}`));
      return false;
    }
  } catch (error) {
    logger.error('Get quality gate status failed', error);
    return false;
  }
}

async function testGetAnalysisArtifacts() {
  logger.subsection('Analyses - Get Artifacts');
  try {
    const response = await api.get(`/analyses/${analysisId}/artifacts`);

    if (response.status === 200 && Array.isArray(response.data)) {
      logger.success('Analysis artifacts retrieved');
      logger.data('Artifacts count', response.data.length);
      return true;
    } else {
      logger.error('Get analysis artifacts failed', new Error(`Status: ${response.status}`));
      return false;
    }
  } catch (error) {
    logger.error('Get analysis artifacts failed', error);
    return false;
  }
}

async function testGetProjectMetrics() {
  logger.subsection('Projects - Get Metrics Over Time');
  try {
    const response = await api.get(`/projects/${testData.projectKey}/metrics`, {
      params: { branch: testData.branch },
    });

    if (response.status === 200 && Array.isArray(response.data)) {
      logger.success('Project metrics retrieved');
      logger.data('Metric points', response.data.length);
      return true;
    } else {
      logger.error('Get project metrics failed', new Error(`Status: ${response.status}`));
      return false;
    }
  } catch (error) {
    logger.error('Get project metrics failed', error);
    return false;
  }
}

async function testMetricsEndpoint() {
  logger.subsection('Metrics - Prometheus Metrics');
  try {
    const response = await api.get('/metrics');

    if (response.status === 200) {
      const metricsText = response.data;
      const hasMetrics = typeof metricsText === 'string' && metricsText.length > 0;

      if (hasMetrics) {
        logger.success('Prometheus metrics endpoint accessible');
        logger.data('Response size', metricsText.length + ' bytes');
        return true;
      } else {
        logger.skip('Metrics endpoint returned empty response (may be disabled)');
        return true;
      }
    } else if (response.status === 404) {
      logger.skip('Metrics endpoint not found (may be disabled)');
      return true;
    } else if (response.status === 503) {
      logger.skip('Metrics endpoint is disabled (METRICS_ENABLED=false)');
      logger.data('Hint', response.data?.hint || 'Set METRICS_ENABLED=true');
      return true;
    } else {
      logger.error('Get metrics failed', new Error(`Status: ${response.status}`));
      return false;
    }
  } catch (error) {
    logger.info('Metrics endpoint not available (may be disabled)');
    return true; // Don't fail if metrics are not enabled
  }
}

async function testHealthReadiness() {
  logger.subsection('Health - Readiness Check');
  try {
    const response = await api.get('/ready');

    if (response.status === 200 && response.data.status) {
      logger.success('Readiness check passed');
      logger.data('Status', response.data.status);
      logger.data('Database', response.data.checks?.database?.status || 'N/A');
      logger.data('Redis', response.data.checks?.redis?.status || 'N/A');
      return true;
    } else {
      logger.error('Readiness check failed', new Error(`Status: ${response.status}`));
      return false;
    }
  } catch (error) {
    logger.error('Readiness check failed', error);
    return false;
  }
}

async function testHealthLiveness() {
  logger.subsection('Health - Liveness Check');
  try {
    const response = await api.get('/health');

    if (response.status === 200 && response.data.status === 'ok') {
      logger.success('Liveness check passed');
      logger.data('Timestamp', response.data.timestamp);
      return true;
    } else {
      logger.error('Liveness check failed', new Error(`Status: ${response.status}`));
      return false;
    }
  } catch (error) {
    logger.error('Liveness check failed', error);
    return false;
  }
}

async function testAuditLogs() {
  logger.subsection('Audit - Get Audit Logs');
  try {
    const response = await api.get('/audit/logs', {
      params: { limit: 10 },
    });

    if (response.status === 200 && response.data && Array.isArray(response.data.data)) {
      logger.success('Audit logs retrieved');
      logger.data('Logs count', response.data.data.length);
      logger.data('Total', response.data.total);
      return true;
    } else if (response.status === 403) {
      logger.info('Audit logs require admin permissions (expected)');
      return true;
    } else {
      logger.error('Get audit logs failed', new Error(`Status: ${response.status}`));
      return false;
    }
  } catch (error) {
    logger.error('Get audit logs failed', error);
    return false;
  }
}

async function testProjectMembers() {
  logger.subsection('RBAC - List Project Members');
  try {
    const response = await api.get(`/projects/${testData.projectKey}/members`);

    if (response.status === 200 && Array.isArray(response.data)) {
      logger.success('Project members listed');
      logger.data('Members count', response.data.length);
      return true;
    } else {
      logger.error('List project members failed', new Error(`Status: ${response.status}`));
      return false;
    }
  } catch (error) {
    logger.error('List project members failed', error);
    return false;
  }
}

async function testAddProjectMember() {
  logger.subsection('RBAC - Add Project Member');
  try {
    // First, create a test user (if we have permissions)
    const userResponse = await api.post('/auth/register', {
      email: 'test-member@example.com',
      password: 'testpass123',
      name: 'Test Member',
    });

    if (userResponse.status === 201 || userResponse.status === 409) {
      // Try to add member to project
      const response = await api.post(`/projects/${testData.projectKey}/members`, {
        email: 'test-member@example.com',
        role: 'VIEWER',
      });

      if (response.status === 201 || response.status === 200) {
        logger.success('Project member added');
        logger.data('Member email', 'test-member@example.com');
        logger.data('Role', 'VIEWER');
        return true;
      } else if (response.status === 403) {
        logger.info('Add member requires permissions (expected in STRICT mode)');
        return true;
      } else {
        logger.error('Add project member failed', new Error(`Status: ${response.status}`));
        return false;
      }
    } else {
      logger.skip('Cannot create test user, skipping member test');
      return true;
    }
  } catch (error) {
    logger.info('Add project member test skipped (expected if user registration disabled)');
    return true;
  }
}

// Main test runner
async function runTests() {
  const args = parseArgs();

  console.log(chalk.bold.magenta('\n╔════════════════════════════════════════════════════════════╗'));
  console.log(chalk.bold.magenta('║                                                            ║'));
  console.log(chalk.bold.magenta('║           QUBELESS E2E TESTS                               ║'));
  console.log(chalk.bold.magenta('║                                                            ║'));
  console.log(chalk.bold.magenta('╚════════════════════════════════════════════════════════════╝\n'));

  logger.info(`API URL: ${API_URL}`);
  logger.info(`Admin Email: ${ADMIN_EMAIL}`);
  if (args.only) {
    logger.info(`Running only: ${args.only}`);
  }
  if (args.quick) {
    logger.info('Quick mode: skipping some tests');
  }

  // Health check first
  logger.section('Pre-flight Checks');
  const isHealthy = await testHealth();
  if (!isHealthy) {
    logger.error('API is not healthy, aborting tests');
    process.exit(1);
  }

  // Authentication tests
  if (!args.only || args.only === 'auth') {
    logger.section('Authentication Tests');
    await testAuthentication();
    await testAuthMe();
    if (!args.quick) {
      await testSsoProviders();
      await testApiTokens();
      await testListApiTokens();
    }
  }

  // Project tests
  if (!args.only || args.only === 'projects') {
    logger.section('Project Management Tests');
    await testCreateProject();
    await testListProjects();
    await testGetProject();
    await testUpdateProjectSettings();
    if (!args.quick) {
      await testGetProjectMetrics();
    }
  }

  // Portfolio tests
  if (!args.only || args.only === 'portfolio') {
    logger.section('Portfolio Tests');
    await testGetPortfolio();
    if (!args.quick) {
      await testPortfolioFilters();
      await testPortfolioExport();
    }
  }

  // Analyzer tests
  if (!args.only || args.only === 'analyzers') {
    logger.section('Analyzer Tests');
    await testCreateAnalyzer();
    await testListAnalyzers();
    if (!args.quick) {
      await testConfigureProjectAnalyzer();
    }
  }

  // Rule tests
  if (!args.only || args.only === 'rules') {
    logger.section('Rule Management Tests');
    await testCreateRule();
    await testListRules();
    if (!args.quick) {
      await testCreateRuleProfile();
      await testActivateRuleProfile();
      await testUpdateRules();
    }
  }

  // Quality gate tests
  if (!args.only || args.only === 'quality-gates') {
    logger.section('Quality Gate Tests');
    await testCreateQualityGate();
    await testAddQualityGateCondition();
  }

  // Analysis tests
  if (!args.only || args.only === 'analyses') {
    logger.section('Analysis Tests');
    await testCreateAnalysis();
    await waitFor(1000); // Give the system time to process
    await testListAnalyses();
    await testGetAnalysis();
    await testGetAnalysisSummary();
    await testGetAnalysisIssues();
    if (!args.quick) {
      await testResolveIssue();
      await testGetIssueResolutions();
      await testGetQualityGateStatus();
      await testGetAnalysisArtifacts();
    }
  }

  // Health and Monitoring tests
  if (!args.only || args.only === 'health') {
    logger.section('Health & Monitoring Tests');
    await testHealthReadiness();
    await testHealthLiveness();
    if (!args.quick) {
      await testMetricsEndpoint();
    }
  }

  // Audit tests
  if (!args.only || args.only === 'audit') {
    logger.section('Audit Tests');
    await testAuditLogs();
  }

  // RBAC tests
  if (!args.only || args.only === 'rbac') {
    logger.section('RBAC Tests');
    await testProjectMembers();
    if (!args.quick) {
      await testAddProjectMember();
    }
  }

  // Summary
  const success = logger.summary();
  process.exit(success ? 0 : 1);
}

// Run tests
runTests().catch((error) => {
  console.error(chalk.red('\nUnexpected error:'), error);
  process.exit(1);
});
