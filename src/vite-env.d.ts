/// <reference types="vite/client" />

import type {
  Collaborator,
  EvaluationFilters,
  EvaluationRecord,
  EvaluationWithInsights,
  PeriodStatus,
  RankingRow,
} from './lib/types';

declare global {
  interface Window {
    performanceApp: {
      listCollaborators: () => Promise<Collaborator[]>;
      createCollaborator: (input: { name: string; role: string; team: string }) => Promise<Collaborator>;
      updateCollaborator: (collaboratorId: number, input: { name: string; role: string; team: string }) => Promise<Collaborator>;
      getLatestEvaluation: (collaboratorId: number) => Promise<EvaluationWithInsights | null>;
      getEvaluation: (collaboratorId: number, period: string) => Promise<EvaluationWithInsights | null>;
      listPeriods: () => Promise<string[]>;
      getPeriodStatus: (collaboratorId: number, period: string) => Promise<PeriodStatus>;
      closePeriod: (collaboratorId: number, period: string) => Promise<PeriodStatus>;
      saveEvaluation: (input: EvaluationRecord) => Promise<EvaluationWithInsights>;
      getRanking: (filters: EvaluationFilters) => Promise<RankingRow[]>;
      setUnsavedFeedback: (hasUnsavedChanges: boolean) => void;
      discardUnsavedAndCloseWindow: () => Promise<void>;
      onAttemptDiscardUnsavedFeedback: (listener: () => void) => () => void;
      exportCsv: () => Promise<{ canceled: boolean; filePath?: string }>;
      importCsv: () => Promise<{ canceled: boolean; imported?: { collaborators: number; evaluations: number } }>;
      clearAllData: () => Promise<void>;
    };
  }
}

export {};