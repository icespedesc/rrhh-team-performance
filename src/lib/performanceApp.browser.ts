import { deleteDB, openDB, type DBSchema, type IDBPDatabase } from 'idb';
import Papa from 'papaparse';
import type {
  AppSettings,
  BackupImportSummary,
  Collaborator,
  EvaluationFilters,
  EvaluationRecord,
  EvaluationWithInsights,
  PeriodStatus,
  RankingRow,
} from './types';

type CollaboratorDraft = Pick<Collaborator, 'externalId' | 'name' | 'role' | 'team' | 'createdAt'>;
type EvaluationDraft = EvaluationWithInsights;
type StoredStatus = {
  id: string;
  collaboratorId: number;
  period: string;
  closedAt: string;
};

type StoredAppSettings = AppSettings & {
  id: 'profile';
  updatedAt: string;
};

type BackupRow = {
  backup_version?: string;
  row_type?: string;
  collaborator_external_id?: string;
  collaborator_name?: string;
  collaborator_created_at?: string;
  role?: string;
  team?: string;
  period?: string;
  collaboration?: number | string;
  stakeholder_management?: number | string;
  ownership?: number | string;
  execution?: number | string;
  software_quality?: number | string;
  incident_response?: number | string;
  operational_discipline?: number | string;
  communication?: number | string;
  autonomy?: number | string;
  learning?: number | string;
  innovation_ai?: number | string;
  impact?: number | string;
  strengths?: string;
  improvements?: string;
  manager_notes?: string;
  feedback_session_notes?: string;
  yearly_improvement_plan?: string;
  growth_potential?: number | string;
  promotion_readiness?: number | string;
  score?: number | string;
  compensation_band?: string;
  merit_points?: number | string;
  period_closed?: string;
  period_closed_at?: string;
  leader_name?: string;
  leader_role?: string;
  leader_email?: string;
};

const BACKUP_COLUMNS: Array<keyof BackupRow> = [
  'backup_version',
  'row_type',
  'leader_name',
  'leader_role',
  'leader_email',
  'collaborator_external_id',
  'collaborator_name',
  'collaborator_created_at',
  'role',
  'team',
  'period',
  'collaboration',
  'stakeholder_management',
  'ownership',
  'execution',
  'software_quality',
  'incident_response',
  'operational_discipline',
  'communication',
  'autonomy',
  'learning',
  'innovation_ai',
  'impact',
  'strengths',
  'improvements',
  'manager_notes',
  'feedback_session_notes',
  'yearly_improvement_plan',
  'growth_potential',
  'promotion_readiness',
  'score',
  'compensation_band',
  'merit_points',
  'period_closed',
  'period_closed_at',
];

const BACKUP_VERSION = '2';
const SETTINGS_KEY = 'profile';

function createDefaultAppSettings(): AppSettings {
  return {
    leaderName: '',
    leaderRole: '',
    leaderEmail: '',
  };
}

function normalizeAppSettings(input: AppSettings): AppSettings {
  return {
    leaderName: input.leaderName.trim(),
    leaderRole: input.leaderRole.trim(),
    leaderEmail: input.leaderEmail.trim(),
  };
}

function isTruthyFlag(value: string | undefined) {
  const normalized = value?.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'si' || normalized === 'sí' || normalized === 'yes';
}

function serializeBackupRow(row: BackupRow): BackupRow {
  return Object.fromEntries(BACKUP_COLUMNS.map((column) => [column, row[column] ?? ''])) as BackupRow;
}

interface PerformanceFeedbackDB extends DBSchema {
  collaborators: {
    key: number;
    value: Collaborator;
    indexes: {
      'by-external-id': string;
      'by-team': string;
    };
  };
  evaluations: {
    key: number;
    value: EvaluationWithInsights;
    indexes: {
      'by-external-id': string;
      'by-collaborator-period': [number, string];
      'by-collaborator-id': number;
      'by-period': string;
      'by-updated-at': string;
    };
  };
  statuses: {
    key: string;
    value: StoredStatus;
    indexes: {
      'by-collaborator-period': [number, string];
    };
  };
  settings: {
    key: string;
    value: StoredAppSettings;
  };
}

let dbPromise: Promise<IDBPDatabase<PerformanceFeedbackDB>> | null = null;
let beforeUnloadRegistered = false;
let hasUnsavedFeedback = false;

async function syncStoredEvaluationInsights(db: IDBPDatabase<PerformanceFeedbackDB>) {
  const evaluations = await db.getAll('evaluations');

  for (const evaluation of evaluations) {
    const nextInsights = calculateInsights(evaluation);
    if (
      evaluation.score === nextInsights.score &&
      evaluation.meritPoints === nextInsights.meritPoints &&
      evaluation.compensationBand === nextInsights.compensationBand
    ) {
      continue;
    }

    await db.put('evaluations', {
      ...evaluation,
      ...nextInsights,
      updatedAt: evaluation.updatedAt,
    });
  }
}

function getDatabase() {
  if (!dbPromise) {
    dbPromise = openDB<PerformanceFeedbackDB>('performance-feedback-pwa', 2, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('collaborators')) {
          const collaborators = db.createObjectStore('collaborators', { keyPath: 'id', autoIncrement: true });
          collaborators.createIndex('by-external-id', 'externalId', { unique: true });
          collaborators.createIndex('by-team', 'team');
        }

        if (!db.objectStoreNames.contains('evaluations')) {
          const evaluations = db.createObjectStore('evaluations', { keyPath: 'id', autoIncrement: true });
          evaluations.createIndex('by-external-id', 'externalId', { unique: true });
          evaluations.createIndex('by-collaborator-period', ['collaboratorId', 'period'], { unique: true });
          evaluations.createIndex('by-collaborator-id', 'collaboratorId');
          evaluations.createIndex('by-period', 'period');
          evaluations.createIndex('by-updated-at', 'updatedAt');
        }

        if (!db.objectStoreNames.contains('statuses')) {
          const statuses = db.createObjectStore('statuses', { keyPath: 'id' });
          statuses.createIndex('by-collaborator-period', ['collaboratorId', 'period'], { unique: true });
        }

        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'id' });
        }
      },
    }).then(async (db) => {
      await syncStoredEvaluationInsights(db);
      return db;
    });
  }

  return dbPromise;
}

function randomId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function clampScore(value: number): number {
  return Math.max(1, Math.min(5, Number.isFinite(value) ? value : 3));
}

function calculateInsights(input: EvaluationRecord) {
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
    compensationBand = 'Mantener en observación';
  }

  return { score, meritPoints, compensationBand };
}

async function clearAllData(): Promise<void> {
  if (dbPromise) {
    const db = await dbPromise;
    db.close();
    dbPromise = null;
  }

  await deleteDB('performance-feedback-pwa');

  hasUnsavedFeedback = false;
  syncBeforeUnloadListener();
}

async function getAppSettings(): Promise<AppSettings> {
  const db = await getDatabase();
  const row = await db.get('settings', SETTINGS_KEY);

  if (!row) {
    return createDefaultAppSettings();
  }

  return normalizeAppSettings(row);
}

async function saveAppSettings(input: AppSettings): Promise<AppSettings> {
  const db = await getDatabase();
  const normalized = normalizeAppSettings(input);

  await db.put('settings', {
    id: SETTINGS_KEY,
    updatedAt: new Date().toISOString(),
    ...normalized,
  });

  return normalized;
}

function compareText(left: string, right: string) {
  return left.localeCompare(right, 'es', { sensitivity: 'base' });
}

function makeStatusId(collaboratorId: number, period: string) {
  return `${collaboratorId}::${period.trim()}`;
}

async function resolvePeriodStatus(collaboratorId: number, period: string): Promise<PeriodStatus> {
  const db = await getDatabase();
  const normalizedPeriod = period.trim();
  const row = await db.get('statuses', makeStatusId(collaboratorId, normalizedPeriod));

  return {
    collaboratorId,
    period: normalizedPeriod,
    isClosed: Boolean(row),
    closedAt: row?.closedAt ?? null,
  };
}

async function listCollaborators(): Promise<Collaborator[]> {
  const db = await getDatabase();
  const collaborators = await db.getAll('collaborators');
  return collaborators.sort((left, right) => compareText(left.team, right.team) || compareText(left.name, right.name));
}

async function createCollaborator(input: { name: string; role: string; team: string }): Promise<Collaborator> {
  const db = await getDatabase();
  const payload: CollaboratorDraft = {
    externalId: randomId(),
    name: input.name.trim(),
    role: input.role.trim(),
    team: input.team.trim(),
    createdAt: new Date().toISOString(),
  };

  const id = await db.add('collaborators', payload as Collaborator);
  return { ...payload, id };
}

async function updateCollaborator(
  collaboratorId: number,
  input: { name: string; role: string; team: string },
): Promise<Collaborator> {
  const db = await getDatabase();
  const current = await db.get('collaborators', collaboratorId);

  if (!current) {
    throw new Error('No se encontró el colaborador a actualizar.');
  }

  const updated: Collaborator = {
    ...current,
    name: input.name.trim(),
    role: input.role.trim(),
    team: input.team.trim(),
  };

  await db.put('collaborators', updated);
  return updated;
}

async function getLatestEvaluation(collaboratorId: number): Promise<EvaluationWithInsights | null> {
  const db = await getDatabase();
  const evaluations = await db.getAllFromIndex('evaluations', 'by-collaborator-id', collaboratorId);
  evaluations.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  return evaluations[0] ?? null;
}

async function getEvaluation(collaboratorId: number, period: string): Promise<EvaluationWithInsights | null> {
  const db = await getDatabase();
  return (await db.getFromIndex('evaluations', 'by-collaborator-period', [collaboratorId, period])) ?? null;
}

async function listPeriods(): Promise<string[]> {
  const db = await getDatabase();
  const evaluations = await db.getAll('evaluations');
  return Array.from(new Set(evaluations.map((item) => item.period))).sort((left, right) => right.localeCompare(left));
}

async function getPeriodStatus(collaboratorId: number, period: string): Promise<PeriodStatus> {
  return resolvePeriodStatus(collaboratorId, period);
}

async function closePeriod(collaboratorId: number, period: string): Promise<PeriodStatus> {
  const db = await getDatabase();
  const normalizedPeriod = period.trim();

  await db.put('statuses', {
    id: makeStatusId(collaboratorId, normalizedPeriod),
    collaboratorId,
    period: normalizedPeriod,
    closedAt: new Date().toISOString(),
  });

  return resolvePeriodStatus(collaboratorId, normalizedPeriod);
}

async function saveEvaluation(input: EvaluationRecord): Promise<EvaluationWithInsights> {
  if ((await resolvePeriodStatus(input.collaboratorId, input.period)).isClosed) {
    throw new Error(`El período ${input.period} está cerrado y ya no permite cambios.`);
  }

  const db = await getDatabase();
  const current = await db.getFromIndex('evaluations', 'by-collaborator-period', [input.collaboratorId, input.period]);
  const insights = calculateInsights(input);
  const updatedAt = new Date().toISOString();

  if (current) {
    const payload: EvaluationWithInsights = {
      id: current.id,
      externalId: current.externalId,
      updatedAt,
      ...input,
      ...insights,
    };

    await db.put('evaluations', payload);
    return payload;
  } else {
    const payload: Omit<EvaluationWithInsights, 'id'> = {
      externalId: randomId(),
      updatedAt,
      ...input,
      ...insights,
    };

    const id = await db.add('evaluations', payload as EvaluationWithInsights);
    return { ...payload, id };
  }
}

async function getRanking(filters: EvaluationFilters): Promise<RankingRow[]> {
  const db = await getDatabase();
  const evaluations = (await db.getAllFromIndex('evaluations', 'by-period', filters.period)).sort(
    (left, right) => right.score - left.score || right.meritPoints - left.meritPoints,
  );
  const collaborators = await listCollaborators();
  const collaboratorById = new Map(collaborators.map((item) => [item.id, item]));

  return evaluations
    .map((evaluation) => {
      const collaborator = collaboratorById.get(evaluation.collaboratorId);
      if (!collaborator) {
        return null;
      }

      if (filters.team && collaborator.team !== filters.team) {
        return null;
      }

      let managerSignal = 'Requiere más evidencia';
      if (evaluation.promotionReadiness >= 4 && evaluation.score >= 88) {
        managerSignal = 'Listo para defender aumento';
      } else if (evaluation.score >= 76) {
        managerSignal = 'Necesita calibración positiva';
      }

      return {
        collaboratorId: collaborator.id,
        collaboratorName: collaborator.name,
        role: collaborator.role,
        team: collaborator.team,
        period: evaluation.period,
        score: evaluation.score,
        compensationBand: evaluation.compensationBand,
        meritPoints: evaluation.meritPoints,
        managerSignal,
      } satisfies RankingRow;
    })
    .filter((row): row is RankingRow => Boolean(row))
    .sort((left, right) => right.score - left.score || right.meritPoints - left.meritPoints || compareText(left.collaboratorName, right.collaboratorName));
}

function triggerDownload(filename: string, content: BlobPart, contentType: string) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function exportCsv(): Promise<{ canceled: boolean; filePath?: string }> {
  const db = await getDatabase();
  const [collaborators, evaluations, statuses, appSettings] = await Promise.all([
    listCollaborators(),
    db.getAll('evaluations'),
    db.getAll('statuses'),
    getAppSettings(),
  ]);
  const collaboratorById = new Map(collaborators.map((item) => [item.id, item]));
  const statusByKey = new Map(statuses.map((item) => [makeStatusId(item.collaboratorId, item.period), item]));

  const collaboratorRows: BackupRow[] = collaborators.map((collaborator) => ({
    backup_version: BACKUP_VERSION,
    row_type: 'collaborator',
    collaborator_external_id: collaborator.externalId,
    collaborator_name: collaborator.name,
    collaborator_created_at: collaborator.createdAt,
    role: collaborator.role,
    team: collaborator.team,
  }));

  const statusRows = statuses.reduce<BackupRow[]>((rows, status) => {
      const collaborator = collaboratorById.get(status.collaboratorId);
      if (!collaborator) {
        return rows;
      }

      rows.push({
        backup_version: BACKUP_VERSION,
        row_type: 'status',
        collaborator_external_id: collaborator.externalId,
        collaborator_name: collaborator.name,
        collaborator_created_at: collaborator.createdAt,
        role: collaborator.role,
        team: collaborator.team,
        period: status.period,
        period_closed: 'true',
        period_closed_at: status.closedAt,
      });

      return rows;
    }, []);

  const evaluationRows: BackupRow[] = [];
  for (const evaluation of evaluations) {
    const collaborator = collaboratorById.get(evaluation.collaboratorId);
    if (!collaborator) {
      continue;
    }

    const status = statusByKey.get(makeStatusId(evaluation.collaboratorId, evaluation.period));
    evaluationRows.push({
      backup_version: BACKUP_VERSION,
      row_type: 'evaluation',
      collaborator_external_id: collaborator.externalId,
      collaborator_name: collaborator.name,
      collaborator_created_at: collaborator.createdAt,
      role: collaborator.role,
      team: collaborator.team,
      period: evaluation.period,
      collaboration: evaluation.collaboration,
      stakeholder_management: evaluation.stakeholderManagement,
      ownership: evaluation.ownership,
      execution: evaluation.execution,
      software_quality: evaluation.softwareQuality,
      incident_response: evaluation.incidentResponse,
      operational_discipline: evaluation.operationalDiscipline,
      communication: evaluation.communication,
      autonomy: evaluation.autonomy,
      learning: evaluation.learning,
      innovation_ai: evaluation.innovationAI,
      impact: evaluation.impact,
      strengths: evaluation.strengths,
      improvements: evaluation.improvements,
      manager_notes: evaluation.managerNotes,
      feedback_session_notes: evaluation.feedbackSessionNotes,
      yearly_improvement_plan: evaluation.yearlyImprovementPlan,
      growth_potential: evaluation.growthPotential,
      promotion_readiness: evaluation.promotionReadiness,
      score: evaluation.score,
      compensation_band: evaluation.compensationBand,
      merit_points: evaluation.meritPoints,
      period_closed: status ? 'true' : 'false',
      period_closed_at: status?.closedAt ?? '',
    });
  }
  evaluationRows.sort(
    (left, right) =>
      compareText(left.team ?? '', right.team ?? '') ||
      compareText(left.collaborator_name ?? '', right.collaborator_name ?? '') ||
      (right.period ?? '').localeCompare(left.period ?? ''),
  );

  const rows: BackupRow[] = [
    {
      backup_version: BACKUP_VERSION,
      row_type: 'settings',
      leader_name: appSettings.leaderName,
      leader_role: appSettings.leaderRole,
      leader_email: appSettings.leaderEmail,
    },
    ...collaboratorRows,
    ...statusRows,
    ...evaluationRows,
  ];

  const csv = Papa.unparse(rows.map(serializeBackupRow));
  triggerDownload('evaluacion-desempeno-backup.csv', csv, 'text/csv;charset=utf-8');

  return { canceled: false, filePath: 'descargado en el navegador' };
}

function pickCsvFileWithInput(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,text/csv';
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    input.style.opacity = '0';
    input.style.pointerEvents = 'none';
    document.body.appendChild(input);

    const cleanup = () => {
      window.removeEventListener('focus', onFocus);
      input.remove();
    };

    const onFocus = () => {
      setTimeout(() => {
        if (!input.files?.length) {
          cleanup();
          resolve(null);
        }
      }, 300);
    };

    input.addEventListener('change', () => {
      const file = input.files?.[0] ?? null;
      cleanup();
      resolve(file);
    });

    window.addEventListener('focus', onFocus, { once: true });
    input.click();
  });
}

async function pickCsvFile(): Promise<File | null> {
  if (!('showOpenFilePicker' in window)) {
    return pickCsvFileWithInput();
  }

  try {
    const handles = await (window as typeof window & {
      showOpenFilePicker: (options: {
        multiple: boolean;
        excludeAcceptAllOption?: boolean;
        types: Array<{ description: string; accept: Record<string, string[]> }>;
      }) => Promise<Array<{ getFile: () => Promise<File> }>>;
    }).showOpenFilePicker({
      multiple: false,
      excludeAcceptAllOption: true,
      types: [{ description: 'CSV', accept: { 'text/csv': ['.csv'] } }],
    });

    return (await handles[0]?.getFile()) ?? null;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return null;
    }

    return pickCsvFileWithInput();
  }
}

async function importCsv(): Promise<{ canceled: boolean; imported?: BackupImportSummary }> {
  const file = await pickCsvFile();
  if (!file) {
    return { canceled: true };
  }

  const csvContent = await file.text();
  const parsed = Papa.parse<BackupRow>(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header: string) => header.trim(),
  });

  const db = await getDatabase();
  const settingsRows: BackupRow[] = [];
  const collaboratorRows: BackupRow[] = [];
  const statusRows: BackupRow[] = [];
  const evaluationRows: BackupRow[] = [];

  for (const row of parsed.data) {
    const rowType = row.row_type?.trim().toLowerCase();

    if (rowType === 'settings') {
      settingsRows.push(row);
      continue;
    }

    if (rowType === 'collaborator') {
      collaboratorRows.push(row);
      continue;
    }

    if (rowType === 'status') {
      statusRows.push(row);
      continue;
    }

    if (rowType === 'evaluation') {
      evaluationRows.push(row);
      continue;
    }

    if (row.collaborator_external_id && row.period) {
      evaluationRows.push(row);
      continue;
    }

    if (row.collaborator_external_id) {
      collaboratorRows.push(row);
    }
  }

  let settingsUpdated = false;
  let evaluationsImported = 0;
  let statusesImported = 0;
  const importedCollaboratorIds = new Set<string>();
  const collaboratorIdByExternalId = new Map<string, number>();
  const importedStatusIds = new Set<string>();

  async function ensureCollaborator(row: BackupRow) {
    const externalId = row.collaborator_external_id?.trim();
    if (!externalId) {
      return null;
    }

    const cachedId = collaboratorIdByExternalId.get(externalId);
    if (cachedId !== undefined) {
      importedCollaboratorIds.add(externalId);
      return cachedId;
    }

    const existing = await db.getFromIndex('collaborators', 'by-external-id', externalId);
    if (existing) {
      const updated: Collaborator = {
        ...existing,
        createdAt: row.collaborator_created_at?.trim() || existing.createdAt,
        name: row.collaborator_name?.trim() || existing.name,
        role: row.role?.trim() || existing.role,
        team: row.team?.trim() || existing.team,
      };
      await db.put('collaborators', updated);
      collaboratorIdByExternalId.set(externalId, updated.id);
      importedCollaboratorIds.add(externalId);
      return updated.id;
    }

    const payload: Omit<Collaborator, 'id'> = {
      externalId,
      createdAt: row.collaborator_created_at?.trim() || new Date().toISOString(),
      name: row.collaborator_name?.trim() || 'Colaborador',
      role: row.role?.trim() || '',
      team: row.team?.trim() || '',
    };
    const id = await db.add('collaborators', payload as Collaborator);
    collaboratorIdByExternalId.set(externalId, id);
    importedCollaboratorIds.add(externalId);
    return id;
  }

  for (const row of collaboratorRows) {
    await ensureCollaborator(row);
  }

  async function importStatusRow(row: BackupRow) {
    const collaboratorId = await ensureCollaborator(row);
    const normalizedPeriod = row.period?.trim();

    if (collaboratorId === null || !normalizedPeriod || !isTruthyFlag(row.period_closed)) {
      return;
    }

    const statusId = makeStatusId(collaboratorId, normalizedPeriod);
    if (importedStatusIds.has(statusId)) {
      return;
    }

    await db.put('statuses', {
      id: statusId,
      collaboratorId,
      period: normalizedPeriod,
      closedAt: row.period_closed_at?.trim() || new Date().toISOString(),
    });
    importedStatusIds.add(statusId);
    statusesImported += 1;
  }

  const latestSettingsRow = settingsRows.at(-1);
  if (latestSettingsRow) {
    await saveAppSettings({
      leaderName: latestSettingsRow.leader_name ?? '',
      leaderRole: latestSettingsRow.leader_role ?? '',
      leaderEmail: latestSettingsRow.leader_email ?? '',
    });
    settingsUpdated = true;
  }

  for (const row of evaluationRows) {
    const collaboratorId = await ensureCollaborator(row);
    const normalizedPeriod = row.period?.trim();

    if (collaboratorId === null || !normalizedPeriod) {
      continue;
    }

    await saveEvaluation({
      collaboratorId,
      period: normalizedPeriod,
      collaboration: clampScore(Number(row.collaboration)),
      stakeholderManagement: clampScore(Number(row.stakeholder_management)),
      ownership: clampScore(Number(row.ownership)),
      execution: clampScore(Number(row.execution)),
      softwareQuality: clampScore(Number(row.software_quality)),
      incidentResponse: clampScore(Number(row.incident_response)),
      operationalDiscipline: clampScore(Number(row.operational_discipline)),
      communication: clampScore(Number(row.communication)),
      autonomy: clampScore(Number(row.autonomy)),
      learning: clampScore(Number(row.learning)),
      innovationAI: clampScore(Number(row.innovation_ai)),
      impact: clampScore(Number(row.impact)),
      strengths: row.strengths ?? '',
      improvements: row.improvements ?? '',
      managerNotes: row.manager_notes ?? '',
      feedbackSessionNotes: row.feedback_session_notes ?? '',
      yearlyImprovementPlan: row.yearly_improvement_plan ?? '',
      growthPotential: clampScore(Number(row.growth_potential)),
      promotionReadiness: clampScore(Number(row.promotion_readiness)),
    });
    evaluationsImported += 1;

    await importStatusRow(row);
  }

  for (const row of statusRows) {
    await importStatusRow(row);
  }

  return {
    canceled: false,
    imported: {
      collaborators: importedCollaboratorIds.size,
      evaluations: evaluationsImported,
      statuses: statusesImported,
      settingsUpdated,
    },
  };
}

function syncBeforeUnloadListener() {
  if (beforeUnloadRegistered) {
    window.removeEventListener('beforeunload', handleBeforeUnload);
    beforeUnloadRegistered = false;
  }

  if (hasUnsavedFeedback) {
    window.addEventListener('beforeunload', handleBeforeUnload);
    beforeUnloadRegistered = true;
  }
}

function handleBeforeUnload(event: BeforeUnloadEvent) {
  event.preventDefault();
  event.returnValue = '';
}

const browserPerformanceApp: Window['performanceApp'] = {
  listCollaborators,
  createCollaborator,
  updateCollaborator,
  getLatestEvaluation,
  getEvaluation,
  listPeriods,
  getPeriodStatus,
  getAppSettings,
  closePeriod,
  saveEvaluation,
  saveAppSettings,
  getRanking,
  setUnsavedFeedback(hasChanges) {
    hasUnsavedFeedback = hasChanges;
    syncBeforeUnloadListener();
  },
  async discardUnsavedAndCloseWindow() {
    hasUnsavedFeedback = false;
    syncBeforeUnloadListener();
    window.close();
  },
  onAttemptDiscardUnsavedFeedback() {
    return () => undefined;
  },
  exportCsv,
  importCsv,
  clearAllData,
};

export async function ensurePerformanceApp() {
  if (!window.performanceApp) {
    window.performanceApp = browserPerformanceApp;
  }

  await getDatabase();
}

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  const isSecure = window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (!isSecure) {
    return;
  }

  await navigator.serviceWorker.register('./sw.js');
}