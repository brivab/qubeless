import {
  AnalyzerIssue,
  AnalyzerIssueSeverity,
  AnalyzerIssueType,
  AnalyzerMeasures,
  AnalyzerReport,
  AnalyzerRule,
} from '../index';

function isSeverity(value: unknown): value is AnalyzerIssueSeverity {
  return ['INFO', 'MINOR', 'MAJOR', 'CRITICAL', 'BLOCKER'].includes(value as string);
}

function isType(value: unknown): value is AnalyzerIssueType {
  return ['BUG', 'CODE_SMELL', 'VULNERABILITY'].includes(value as string);
}

function assertIssue(issue: any): asserts issue is AnalyzerIssue {
  if (!issue || typeof issue !== 'object') throw new Error('Invalid issue');
  if (typeof issue.ruleKey !== 'string' || !issue.ruleKey) throw new Error('Invalid ruleKey');
  if (!isSeverity(issue.severity)) throw new Error('Invalid severity');
  if (!isType(issue.type)) throw new Error('Invalid type');
  if (typeof issue.filePath !== 'string' || !issue.filePath) throw new Error('Invalid filePath');
  if (issue.line !== undefined && issue.line !== null && typeof issue.line !== 'number')
    throw new Error('Invalid line');
  if (typeof issue.message !== 'string' || !issue.message) throw new Error('Invalid message');
  if (typeof issue.fingerprint !== 'string' || !issue.fingerprint)
    throw new Error('Invalid fingerprint');
  if (issue.ruleName !== undefined && typeof issue.ruleName !== 'string')
    throw new Error('Invalid ruleName');
  if (issue.ruleDescription !== undefined && typeof issue.ruleDescription !== 'string')
    throw new Error('Invalid ruleDescription');
}

function assertRule(rule: any): asserts rule is AnalyzerRule {
  if (!rule || typeof rule !== 'object') throw new Error('Invalid rule');
  if (typeof rule.key !== 'string' || !rule.key) throw new Error('Invalid rule key');
  if (typeof rule.name !== 'string' || !rule.name) throw new Error('Invalid rule name');
  if (typeof rule.description !== 'string') throw new Error('Invalid rule description');
  if (!isSeverity(rule.severity)) throw new Error('Invalid rule severity');
  if (!isType(rule.type)) throw new Error('Invalid rule type');
}

export function assertAnalyzerReport(data: any): asserts data is AnalyzerReport {
  if (!data || typeof data !== 'object') throw new Error('Invalid report');
  if (!data.analyzer || typeof data.analyzer !== 'object') throw new Error('Missing analyzer');
  if (typeof data.analyzer.name !== 'string' || !data.analyzer.name)
    throw new Error('Invalid analyzer name');
  if (typeof data.analyzer.version !== 'string' || !data.analyzer.version)
    throw new Error('Invalid analyzer version');
  if (!Array.isArray(data.issues)) throw new Error('Invalid issues array');
  data.issues.forEach(assertIssue);
  if (data.rules !== undefined) {
    if (!Array.isArray(data.rules)) throw new Error('Invalid rules array');
    data.rules.forEach(assertRule);
  }
}

export function assertAnalyzerMeasures(data: any): asserts data is AnalyzerMeasures {
  if (!data || typeof data !== 'object') throw new Error('Invalid measures');
  if (!data.metrics || typeof data.metrics !== 'object') throw new Error('Invalid metrics');
  Object.entries(data.metrics).forEach(([key, value]) => {
    if (typeof key !== 'string' || key.length === 0) throw new Error('Invalid metric key');
    if (typeof value !== 'number') throw new Error(`Invalid metric value for ${key}`);
  });
}

export function isAnalyzerReport(data: any): data is AnalyzerReport {
  try {
    assertAnalyzerReport(data);
    return true;
  } catch {
    return false;
  }
}

export function isAnalyzerMeasures(data: any): data is AnalyzerMeasures {
  try {
    assertAnalyzerMeasures(data);
    return true;
  } catch {
    return false;
  }
}
