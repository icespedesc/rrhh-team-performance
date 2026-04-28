/// <reference types="vite/client" />

import type {
  AppSettings,
  BackupImportSummary,
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
      getAppSettings: () => Promise<AppSettings>;
      getPeriodStatus: (collaboratorId: number, period: string) => Promise<PeriodStatus>;
      closePeriod: (collaboratorId: number, period: string) => Promise<PeriodStatus>;
      saveEvaluation: (input: EvaluationRecord) => Promise<EvaluationWithInsights>;
      saveAppSettings: (input: AppSettings) => Promise<AppSettings>;
      getRanking: (filters: EvaluationFilters) => Promise<RankingRow[]>;
      setUnsavedFeedback: (hasUnsavedChanges: boolean) => void;
      discardUnsavedAndCloseWindow: () => Promise<void>;
      onAttemptDiscardUnsavedFeedback: (listener: () => void) => () => void;
      exportCsv: () => Promise<{ canceled: boolean; filePath?: string }>;
      importCsv: () => Promise<{ canceled: boolean; imported?: BackupImportSummary }>;
      clearAllData: () => Promise<void>;
    };
  }
}

export {};