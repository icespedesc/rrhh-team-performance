export type Collaborator = {
  id: number;
  externalId: string;
  name: string;
  role: string;
  team: string;
  createdAt: string;
};

export type EvaluationRecord = {
  collaboratorId: number;
  period: string;
  collaboration: number;
  stakeholderManagement: number;
  ownership: number;
  execution: number;
  softwareQuality: number;
  incidentResponse: number;
  operationalDiscipline: number;
  communication: number;
  autonomy: number;
  learning: number;
  innovationAI: number;
  impact: number;
  strengths: string;
  improvements: string;
  managerNotes: string;
  feedbackSessionNotes: string;
  yearlyImprovementPlan: string;
  growthPotential: number;
  promotionReadiness: number;
};

export type EvaluationWithInsights = EvaluationRecord & {
  id: number;
  externalId: string;
  score: number;
  compensationBand: string;
  meritPoints: number;
  updatedAt: string;
};

export type EvaluationFilters = {
  period: string;
  team?: string | null;
};

export type PeriodStatus = {
  collaboratorId: number | null;
  period: string;
  isClosed: boolean;
  closedAt: string | null;
};

export type RankingRow = {
  collaboratorId: number;
  collaboratorName: string;
  role: string;
  team: string;
  period: string;
  score: number;
  compensationBand: string;
  meritPoints: number;
  managerSignal: string;
};