import { Test, TestingModule } from '@nestjs/testing';
import { IssueSeverity } from '@prisma/client';
import { TechnicalDebtService, REMEDIATION_COST, DEVELOPMENT_COST_PER_LINE } from './technical-debt.service';

describe('TechnicalDebtService', () => {
  let service: TechnicalDebtService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TechnicalDebtService],
    }).compile();

    service = module.get<TechnicalDebtService>(TechnicalDebtService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculateDebtRatio', () => {
    it('should calculate debt ratio for empty issues', () => {
      const result = service.calculateDebtRatio([], 10000);

      expect(result.debtRatio).toBe(0);
      expect(result.remediationCost).toBe(0);
      expect(result.developmentCost).toBe(Math.round(10000 * DEVELOPMENT_COST_PER_LINE));
      expect(result.rating).toBe('A');
      expect(result.formattedRemediationTime).toBe('0min');
    });

    it('should calculate debt ratio for issues with different severities', () => {
      const issues = [
        { severity: IssueSeverity.BLOCKER }, // 120 min
        { severity: IssueSeverity.CRITICAL }, // 60 min
        { severity: IssueSeverity.MAJOR }, // 20 min
        { severity: IssueSeverity.MINOR }, // 10 min
        { severity: IssueSeverity.INFO }, // 5 min
      ];

      const totalRemediationCost = 120 + 60 + 20 + 10 + 5; // 215 min
      const linesOfCode = 10000;
      const developmentCost = linesOfCode * DEVELOPMENT_COST_PER_LINE; // 5760 min
      const expectedDebtRatio = (totalRemediationCost / developmentCost) * 100; // ~3.73%

      const result = service.calculateDebtRatio(issues, linesOfCode);

      expect(result.remediationCost).toBe(215);
      expect(result.developmentCost).toBe(Math.round(developmentCost));
      expect(result.debtRatio).toBeCloseTo(expectedDebtRatio, 2);
      expect(result.rating).toBe('A'); // ≤ 5%
    });

    it('should calculate correct rating for different debt ratios', () => {
      // Test each rating threshold
      // developmentCost for 10000 LOC = 10000 * 0.576 = 5760 min

      // A rating: ≤ 5%
      // 5% of 5760 = 288 min -> need ~14 MAJOR issues (14 * 20 = 280)
      const issuesA = Array(14).fill({ severity: IssueSeverity.MAJOR });
      const resultA = service.calculateDebtRatio(issuesA, 10000);
      expect(resultA.rating).toBe('A');
      expect(resultA.debtRatio).toBeLessThanOrEqual(5);

      // B rating: ≤ 10%
      // 10% of 5760 = 576 min -> need ~28 MAJOR issues (28 * 20 = 560)
      const issuesB = Array(28).fill({ severity: IssueSeverity.MAJOR });
      const resultB = service.calculateDebtRatio(issuesB, 10000);
      expect(resultB.rating).toBe('B');
      expect(resultB.debtRatio).toBeGreaterThan(5);
      expect(resultB.debtRatio).toBeLessThanOrEqual(10);

      // C rating: ≤ 20%
      // 20% of 5760 = 1152 min -> need ~57 MAJOR issues (57 * 20 = 1140)
      const issuesC = Array(57).fill({ severity: IssueSeverity.MAJOR });
      const resultC = service.calculateDebtRatio(issuesC, 10000);
      expect(resultC.rating).toBe('C');
      expect(resultC.debtRatio).toBeGreaterThan(10);
      expect(resultC.debtRatio).toBeLessThanOrEqual(20);

      // D rating: ≤ 50%
      // 50% of 5760 = 2880 min -> need ~144 MAJOR issues (144 * 20 = 2880)
      const issuesD = Array(144).fill({ severity: IssueSeverity.MAJOR });
      const resultD = service.calculateDebtRatio(issuesD, 10000);
      expect(resultD.rating).toBe('D');
      expect(resultD.debtRatio).toBeGreaterThan(20);
      expect(resultD.debtRatio).toBeLessThanOrEqual(50);

      // E rating: > 50%
      // > 50% of 5760 = > 2880 min -> need 300 MAJOR issues (300 * 20 = 6000)
      const issuesE = Array(300).fill({ severity: IssueSeverity.MAJOR });
      const resultE = service.calculateDebtRatio(issuesE, 10000);
      expect(resultE.rating).toBe('E');
      expect(resultE.debtRatio).toBeGreaterThan(50);
    });

    it('should handle zero lines of code gracefully', () => {
      const issues = [{ severity: IssueSeverity.MAJOR }];
      const result = service.calculateDebtRatio(issues, 0);

      expect(result.debtRatio).toBe(0);
      expect(result.rating).toBe('A');
    });
  });

  describe('getRating', () => {
    it('should return A for debt ratio ≤ 5%', () => {
      expect(service.getRating(0)).toBe('A');
      expect(service.getRating(3)).toBe('A');
      expect(service.getRating(5)).toBe('A');
    });

    it('should return B for debt ratio ≤ 10%', () => {
      expect(service.getRating(5.1)).toBe('B');
      expect(service.getRating(8)).toBe('B');
      expect(service.getRating(10)).toBe('B');
    });

    it('should return C for debt ratio ≤ 20%', () => {
      expect(service.getRating(10.1)).toBe('C');
      expect(service.getRating(15)).toBe('C');
      expect(service.getRating(20)).toBe('C');
    });

    it('should return D for debt ratio ≤ 50%', () => {
      expect(service.getRating(20.1)).toBe('D');
      expect(service.getRating(35)).toBe('D');
      expect(service.getRating(50)).toBe('D');
    });

    it('should return E for debt ratio > 50%', () => {
      expect(service.getRating(50.1)).toBe('E');
      expect(service.getRating(75)).toBe('E');
      expect(service.getRating(100)).toBe('E');
    });
  });

  describe('formatTime', () => {
    it('should format 0 minutes', () => {
      expect(service.formatTime(0)).toBe('0min');
    });

    it('should format minutes only', () => {
      expect(service.formatTime(30)).toBe('30min');
      expect(service.formatTime(45)).toBe('45min');
    });

    it('should format hours and minutes', () => {
      expect(service.formatTime(90)).toBe('1h 30min'); // 1h30
      expect(service.formatTime(125)).toBe('2h 5min'); // 2h05
    });

    it('should format hours only', () => {
      expect(service.formatTime(60)).toBe('1h');
      expect(service.formatTime(120)).toBe('2h');
    });

    it('should format days, hours, and minutes', () => {
      // 1 jour = 8h = 480 min
      expect(service.formatTime(480 + 90)).toBe('1 jour 1h 30min'); // 1 jour, 1h30
      expect(service.formatTime(960 + 125)).toBe('2 jours 2h 5min'); // 2 jours, 2h05
    });

    it('should format days only', () => {
      expect(service.formatTime(480)).toBe('1 jour'); // 1 jour exactement
      expect(service.formatTime(960)).toBe('2 jours'); // 2 jours exactement
    });

    it('should format days and minutes (no hours)', () => {
      expect(service.formatTime(480 + 30)).toBe('1 jour 30min'); // 1 jour, 30min
    });

    it('should format real-world scenarios', () => {
      // 215 minutes from earlier test
      expect(service.formatTime(215)).toBe('3h 35min');

      // 2 heures (BLOCKER)
      expect(service.formatTime(120)).toBe('2h');

      // 1 heure (CRITICAL)
      expect(service.formatTime(60)).toBe('1h');

      // 20 minutes (MAJOR)
      expect(service.formatTime(20)).toBe('20min');

      // 10 minutes (MINOR)
      expect(service.formatTime(10)).toBe('10min');

      // 5 minutes (INFO)
      expect(service.formatTime(5)).toBe('5min');
    });
  });

  describe('calculateNewDebtRatio', () => {
    it('should calculate debt ratio for new issues only', () => {
      const newIssues = [
        { severity: IssueSeverity.CRITICAL }, // 60 min
        { severity: IssueSeverity.MAJOR }, // 20 min
      ];

      const newLinesOfCode = 500;
      const result = service.calculateNewDebtRatio(newIssues, newLinesOfCode);

      expect(result.remediationCost).toBe(80);
      expect(result.developmentCost).toBe(Math.round(newLinesOfCode * DEVELOPMENT_COST_PER_LINE));
    });
  });

  describe('REMEDIATION_COST constants', () => {
    it('should have correct remediation costs', () => {
      expect(REMEDIATION_COST[IssueSeverity.INFO]).toBe(5);
      expect(REMEDIATION_COST[IssueSeverity.MINOR]).toBe(10);
      expect(REMEDIATION_COST[IssueSeverity.MAJOR]).toBe(20);
      expect(REMEDIATION_COST[IssueSeverity.CRITICAL]).toBe(60);
      expect(REMEDIATION_COST[IssueSeverity.BLOCKER]).toBe(120);
    });
  });

  describe('DEVELOPMENT_COST_PER_LINE constant', () => {
    it('should calculate correctly (30 days per 25000 lines)', () => {
      // 30 days * 8 hours/day * 60 minutes/hour = 14400 minutes
      // 14400 minutes / 25000 lines = 0.576 min/line
      expect(DEVELOPMENT_COST_PER_LINE).toBe(0.576);
    });
  });
});
