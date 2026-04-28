import { contextBridge, ipcRenderer } from 'electron';
import type { AppSettings, BackupImportSummary, Collaborator, EvaluationFilters, EvaluationRecord, EvaluationWithInsights, PeriodStatus, RankingRow } from './types';

contextBridge.exposeInMainWorld('performanceApp', {
  listCollaborators: () => ipcRenderer.invoke('collaborators:list'),
  createCollaborator: (input: { name: string; role: string; team: string }) =>
    ipcRenderer.invoke('collaborators:create', input),
  updateCollaborator: (collaboratorId: number, input: { name: string; role: string; team: string }) =>
    ipcRenderer.invoke('collaborators:update', collaboratorId, input),
  getLatestEvaluation: (collaboratorId: number) =>
    ipcRenderer.invoke('evaluations:get-latest', collaboratorId),
  getEvaluation: (collaboratorId: number, period: string) =>
    ipcRenderer.invoke('evaluations:get-by-period', collaboratorId, period),
  listPeriods: () => ipcRenderer.invoke('evaluations:list-periods'),
  getAppSettings: () => ipcRenderer.invoke('settings:get'),
  getPeriodStatus: (collaboratorId: number, period: string) => ipcRenderer.invoke('periods:get-status', collaboratorId, period),
  closePeriod: (collaboratorId: number, period: string) => ipcRenderer.invoke('periods:close', collaboratorId, period),
  saveEvaluation: (input: EvaluationRecord) => ipcRenderer.invoke('evaluations:save', input),
  saveAppSettings: (input: AppSettings) => ipcRenderer.invoke('settings:save', input),
  getRanking: (filters: EvaluationFilters) => ipcRenderer.invoke('ranking:list', filters),
  setUnsavedFeedback: (hasUnsavedChanges: boolean) => ipcRenderer.send('window:set-unsaved-feedback', hasUnsavedChanges),
  discardUnsavedAndCloseWindow: () => ipcRenderer.invoke('window:discard-unsaved-and-close'),
  onAttemptDiscardUnsavedFeedback: (listener: () => void) => {
    const wrappedListener = () => listener();
    ipcRenderer.on('window:attempt-discard-unsaved-feedback', wrappedListener);
    return () => ipcRenderer.removeListener('window:attempt-discard-unsaved-feedback', wrappedListener);
  },
  exportCsv: () => ipcRenderer.invoke('backup:export'),
  importCsv: () => ipcRenderer.invoke('backup:import'),
  clearAllData: () => ipcRenderer.invoke('storage:clear-all'),
});

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