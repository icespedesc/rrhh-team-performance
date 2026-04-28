import type { EvaluationRecord } from './types';

export function calculatePreview(input: EvaluationRecord) {
  const weightedAverage =
    input.collaboration * 0.09 +
    input.stakeholderManagement * 0.1 +
    input.ownership * 0.11 +
    input.execution * 0.11 +
    input.softwareQuality * 0.1 +
    input.incidentResponse * 0.07 +
    input.operationalDiscipline * 0.08 +
    input.communication * 0.09 +
    input.autonomy * 0.08 +
    input.learning * 0.05 +
    input.innovationAI * 0.06 +
    input.impact * 0.06;

  const score = Math.round(weightedAverage * 20 * 10) / 10;
  const meritPoints = Math.max(0, Math.round((score - 55) * 1.25));

  let compensationBand = 'Sin prioridad';
  if (score >= 88 && input.promotionReadiness >= 4 && input.growthPotential >= 4) {
    compensationBand = 'Prioridad alta';
  } else if (score >= 76 && input.promotionReadiness >= 3) {
    compensationBand = 'Prioridad media';
  } else if (score >= 66) {
    compensationBand = 'Mantener en observacion';
  }

  return { score, meritPoints, compensationBand };
}

export function createEmptyEvaluation(collaboratorId: number): EvaluationRecord {
  return {
    collaboratorId,
    period: String(new Date().getFullYear()),
    collaboration: 3,
    stakeholderManagement: 3,
    ownership: 3,
    execution: 3,
    softwareQuality: 3,
    incidentResponse: 3,
    operationalDiscipline: 3,
    communication: 3,
    autonomy: 3,
    learning: 3,
    innovationAI: 3,
    impact: 3,
    strengths: '',
    improvements: '',
    managerNotes: '',
    feedbackSessionNotes: '',
    yearlyImprovementPlan: '',
    growthPotential: 3,
    promotionReadiness: 3,
  };
}