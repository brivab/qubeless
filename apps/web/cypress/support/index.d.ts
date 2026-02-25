type SeedFeatureDataResult = {
  projectKey: string;
  projectName: string;
  analyzerKey: string;
  llmProviderName: string;
  llmPromptName: string;
  analysisId: string | null;
  issueId: string | null;
};

declare namespace Cypress {
  interface Chainable {
    visitAsAdmin(path?: string): Chainable<void>;
    seedFeatureData(): Chainable<SeedFeatureDataResult>;
    getByDataCyOr(dataCy: string, fallbackSelector: string): Chainable<JQuery<HTMLElement>>;
    clickByDataCyOr(dataCy: string, fallbackSelector: string): Chainable<JQuery<HTMLElement>>;
    demoPause(ms?: number): Chainable<void>;
    showDemoStep(title: string, subtitle?: string, pauseMs?: number): Chainable<void>;
    captureDemoScreen(screenId: string, pauseMs?: number): Chainable<void>;
  }
}
