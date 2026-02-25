import { Injectable } from '@nestjs/common';
import { IssueSeverity } from '@prisma/client';

export const REMEDIATION_COST: Record<IssueSeverity, number> = {
  INFO: 5,      // 5 minutes
  MINOR: 10,    // 10 minutes
  MAJOR: 20,    // 20 minutes
  CRITICAL: 60, // 1 heure
  BLOCKER: 120, // 2 heures
};

// Development cost: 30 jours par 25000 lignes
// 30 * 8 * 60 = 14400 minutes pour 25000 lignes = 0.576 min/ligne
export const DEVELOPMENT_COST_PER_LINE = 0.576;

export type MaintainabilityRating = 'A' | 'B' | 'C' | 'D' | 'E';

export interface TechnicalDebtResult {
  debtRatio: number;
  remediationCost: number; // en minutes
  developmentCost: number;
  rating: MaintainabilityRating;
  formattedRemediationTime: string; // ex: "2h 30min"
}

export interface IssueForDebtCalculation {
  severity: IssueSeverity;
}

@Injectable()
export class TechnicalDebtService {
  /**
   * Calcule le Technical Debt Ratio d'une analyse
   * Formule SonarQube: Debt Ratio = (Remediation Cost / Development Cost) * 100
   */
  calculateDebtRatio(
    issues: IssueForDebtCalculation[],
    linesOfCode: number,
  ): TechnicalDebtResult {
    // Remediation cost: somme du coût de correction de tous les issues
    const remediationCost = issues.reduce((total, issue) => {
      return total + REMEDIATION_COST[issue.severity];
    }, 0);

    // Development cost: estimation du temps de développement basé sur les lignes de code
    const developmentCost = linesOfCode * DEVELOPMENT_COST_PER_LINE;

    // Debt ratio
    const debtRatio = developmentCost > 0 ? (remediationCost / developmentCost) * 100 : 0;

    // Rating
    const rating = this.getRating(debtRatio);

    // Format remediation time
    const formattedRemediationTime = this.formatTime(remediationCost);

    return {
      debtRatio: Math.round(debtRatio * 100) / 100, // Arrondi à 2 décimales
      remediationCost,
      developmentCost: Math.round(developmentCost),
      rating,
      formattedRemediationTime,
    };
  }

  /**
   * Détermine le Maintainability Rating basé sur le Debt Ratio
   * - A: Excellent (≤ 5%)
   * - B: Bon (≤ 10%)
   * - C: Moyen (≤ 20%)
   * - D: Mauvais (≤ 50%)
   * - E: Très mauvais (> 50%)
   */
  getRating(debtRatio: number): MaintainabilityRating {
    if (debtRatio <= 5) return 'A';
    if (debtRatio <= 10) return 'B';
    if (debtRatio <= 20) return 'C';
    if (debtRatio <= 50) return 'D';
    return 'E';
  }

  /**
   * Formate le temps de remediation en format lisible
   * Exemples: "2h 30min", "45min", "1h", "3 jours 2h"
   */
  formatTime(minutes: number): string {
    if (minutes === 0) return '0min';

    const days = Math.floor(minutes / (8 * 60)); // 8h par jour
    const remainingAfterDays = minutes % (8 * 60);
    const hours = Math.floor(remainingAfterDays / 60);
    const mins = Math.floor(remainingAfterDays % 60);

    const parts: string[] = [];

    if (days > 0) {
      parts.push(`${days} ${days === 1 ? 'jour' : 'jours'}`);
    }
    if (hours > 0) {
      parts.push(`${hours}h`);
    }
    if (mins > 0) {
      parts.push(`${mins}min`);
    }

    // Si on n'a que des jours ou des heures sans minutes, on ne force pas l'affichage de 0min
    if (parts.length === 0) {
      parts.push('0min');
    }

    return parts.join(' ');
  }

  /**
   * Calcule le coût de remediation pour un scope NEW (nouveaux issues uniquement)
   */
  calculateNewDebtRatio(
    newIssues: IssueForDebtCalculation[],
    newLinesOfCode: number,
  ): TechnicalDebtResult {
    return this.calculateDebtRatio(newIssues, newLinesOfCode);
  }
}
