import Database from 'better-sqlite3';
import { app } from 'electron';
import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
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

type FlatExportRow = {
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

const BACKUP_COLUMNS: Array<keyof FlatExportRow> = [
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

function serializeBackupRow(row: FlatExportRow): FlatExportRow {
  return Object.fromEntries(BACKUP_COLUMNS.map((column) => [column, row[column] ?? ''])) as FlatExportRow;
}

const databaseDirectory = app.isPackaged
  ? app.getPath('userData')
  : join(app.getPath('appData'), 'evaluacion-desempeno-app-dev');

const databaseFile = join(databaseDirectory, 'performance-feedback.sqlite');
mkdirSync(dirname(databaseFile), { recursive: true });

const db = new Database(databaseFile);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS collaborators (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    external_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    team TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS evaluations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    external_id TEXT NOT NULL UNIQUE,
    collaborator_id INTEGER NOT NULL,
    period TEXT NOT NULL,
    collaboration REAL NOT NULL,
    stakeholder_management REAL NOT NULL,
    ownership REAL NOT NULL,
    execution REAL NOT NULL,
    software_quality REAL NOT NULL,
    incident_response REAL NOT NULL,
    operational_discipline REAL NOT NULL,
    communication REAL NOT NULL,
    autonomy REAL NOT NULL,
    learning REAL NOT NULL,
    innovation_ai REAL NOT NULL DEFAULT 3,
    impact REAL NOT NULL,
    strengths TEXT NOT NULL,
    improvements TEXT NOT NULL,
    manager_notes TEXT NOT NULL,
    feedback_session_notes TEXT NOT NULL DEFAULT '',
    yearly_improvement_plan TEXT NOT NULL DEFAULT '',
    growth_potential REAL NOT NULL,
    promotion_readiness REAL NOT NULL,
    score REAL NOT NULL,
    compensation_band TEXT NOT NULL,
    merit_points INTEGER NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (collaborator_id) REFERENCES collaborators(id) ON DELETE CASCADE,
    UNIQUE(collaborator_id, period)
  );

  CREATE TABLE IF NOT EXISTS period_statuses (
    period TEXT PRIMARY KEY,
    closed_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS evaluation_statuses (
    collaborator_id INTEGER NOT NULL,
    period TEXT NOT NULL,
    closed_at TEXT NOT NULL,
    PRIMARY KEY (collaborator_id, period),
    FOREIGN KEY (collaborator_id) REFERENCES collaborators(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

const evaluationColumns = (db.prepare('PRAGMA table_info(evaluations)').all() as Array<{ name: string }>).map(
  (column) => column.name,
);

if (!evaluationColumns.includes('feedback_session_notes')) {
  db.exec("ALTER TABLE evaluations ADD COLUMN feedback_session_notes TEXT NOT NULL DEFAULT '';");
}

if (!evaluationColumns.includes('yearly_improvement_plan')) {
  db.exec("ALTER TABLE evaluations ADD COLUMN yearly_improvement_plan TEXT NOT NULL DEFAULT '';");
}

if (!evaluationColumns.includes('innovation_ai')) {
  db.exec("ALTER TABLE evaluations ADD COLUMN innovation_ai REAL NOT NULL DEFAULT 3;");
}

const collaboratorRow = db.prepare(`
  SELECT id, external_id AS externalId, name, role, team, created_at AS createdAt
  FROM collaborators
  WHERE id = ?
`);

const listCollaboratorsStatement = db.prepare(`
  SELECT id, external_id AS externalId, name, role, team, created_at AS createdAt
  FROM collaborators
  ORDER BY team COLLATE NOCASE ASC, name COLLATE NOCASE ASC
`);

const evaluationSelectClause = `
  SELECT
    id,
    external_id AS externalId,
    collaborator_id AS collaboratorId,
    period,
    collaboration,
    stakeholder_management AS stakeholderManagement,
    ownership,
    execution,
    software_quality AS softwareQuality,
    incident_response AS incidentResponse,
    operational_discipline AS operationalDiscipline,
    communication,
    autonomy,
    learning,
    innovation_ai AS innovationAI,
    impact,
    strengths,
    improvements,
    manager_notes AS managerNotes,
    feedback_session_notes AS feedbackSessionNotes,
    yearly_improvement_plan AS yearlyImprovementPlan,
    growth_potential AS growthPotential,
    promotion_readiness AS promotionReadiness,
    score,
    compensation_band AS compensationBand,
    merit_points AS meritPoints,
    updated_at AS updatedAt
  FROM evaluations
`;

const latestEvaluationStatement = db.prepare(`
  ${evaluationSelectClause}
  WHERE collaborator_id = ?
  ORDER BY updated_at DESC
  LIMIT 1
`);

const evaluationByPeriodStatement = db.prepare(`
  ${evaluationSelectClause}
  WHERE collaborator_id = ? AND period = ?
  LIMIT 1
`);

const rankingByPeriodStatement = db.prepare(`
  SELECT
    c.id AS collaboratorId,
    c.name AS collaboratorName,
    c.role,
    c.team,
    e.period,
    e.score,
    e.compensation_band AS compensationBand,
    e.merit_points AS meritPoints,
    CASE
      WHEN e.promotion_readiness >= 4 AND e.score >= 88 THEN 'Listo para defender aumento'
      WHEN e.score >= 76 THEN 'Necesita calibración positiva'
      ELSE 'Requiere más evidencia'
    END AS managerSignal
  FROM evaluations e
  INNER JOIN collaborators c ON c.id = e.collaborator_id
  WHERE e.period = ?
    AND (? IS NULL OR c.team = ?)
  ORDER BY e.score DESC, e.merit_points DESC, c.name COLLATE NOCASE ASC
`);

const periodsStatement = db.prepare(`
  SELECT DISTINCT period
  FROM evaluations
  ORDER BY period DESC
`);

const evaluationStatusStatement = db.prepare(`
  SELECT collaborator_id AS collaboratorId, period, closed_at AS closedAt
  FROM evaluation_statuses
  WHERE collaborator_id = ? AND period = ?
  LIMIT 1
`);

const storedEvaluationsStatement = db.prepare(`
  SELECT
    id,
    collaborator_id AS collaboratorId,
    period,
    collaboration,
    stakeholder_management AS stakeholderManagement,
    ownership,
    execution,
    software_quality AS softwareQuality,
    incident_response AS incidentResponse,
    operational_discipline AS operationalDiscipline,
    communication,
    autonomy,
    learning,
    innovation_ai AS innovationAI,
    impact,
    strengths,
    improvements,
    manager_notes AS managerNotes,
    feedback_session_notes AS feedbackSessionNotes,
    yearly_improvement_plan AS yearlyImprovementPlan,
    growth_potential AS growthPotential,
    promotion_readiness AS promotionReadiness,
    score,
    compensation_band AS compensationBand,
    merit_points AS meritPoints
  FROM evaluations
`);

function clampScore(value: number): number {
  return Math.max(1, Math.min(5, value));
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

function resolvePeriodStatus(collaboratorId: number, period: string): PeriodStatus {
  const normalizedPeriod = period.trim();
  const row = evaluationStatusStatement.get(collaboratorId, normalizedPeriod) as
    | { collaboratorId: number; period: string; closedAt: string }
    | undefined;

  return {
    collaboratorId,
    period: normalizedPeriod,
    isClosed: Boolean(row),
    closedAt: row?.closedAt ?? null,
  };
}

function syncStoredEvaluationInsights() {
  const evaluations = storedEvaluationsStatement.all() as Array<
    EvaluationRecord & { id: number; score: number; compensationBand: string; meritPoints: number }
  >;
  const updateInsightsStatement = db.prepare(`
    UPDATE evaluations
    SET score = ?, compensation_band = ?, merit_points = ?
    WHERE id = ?
  `);

  const updateInsightsTransaction = db.transaction(() => {
    for (const evaluation of evaluations) {
      const nextInsights = calculateInsights(evaluation);
      if (
        evaluation.score === nextInsights.score &&
        evaluation.meritPoints === nextInsights.meritPoints &&
        evaluation.compensationBand === nextInsights.compensationBand
      ) {
        continue;
      }

      updateInsightsStatement.run(nextInsights.score, nextInsights.compensationBand, nextInsights.meritPoints, evaluation.id);
    }
  });

  updateInsightsTransaction();
}

syncStoredEvaluationInsights();

export function createCollaborator(input: {
  name: string;
  role: string;
  team: string;
}): Collaborator {
  const insert = db.prepare(`
    INSERT INTO collaborators (external_id, name, role, team)
    VALUES (?, ?, ?, ?)
  `);

  const info = insert.run(randomUUID(), input.name.trim(), input.role.trim(), input.team.trim());
  return collaboratorRow.get(info.lastInsertRowid) as Collaborator;
}

export function updateCollaborator(
  collaboratorId: number,
  input: {
    name: string;
    role: string;
    team: string;
  },
): Collaborator {
  db.prepare(`
    UPDATE collaborators
    SET name = ?, role = ?, team = ?
    WHERE id = ?
  `).run(input.name.trim(), input.role.trim(), input.team.trim(), collaboratorId);

  return collaboratorRow.get(collaboratorId) as Collaborator;
}

export function listCollaborators(): Collaborator[] {
  return listCollaboratorsStatement.all() as Collaborator[];
}

export function getLatestEvaluation(collaboratorId: number): EvaluationWithInsights | null {
  return (latestEvaluationStatement.get(collaboratorId) as EvaluationWithInsights | undefined) ?? null;
}

export function getEvaluation(collaboratorId: number, period: string): EvaluationWithInsights | null {
  return (evaluationByPeriodStatement.get(collaboratorId, period) as EvaluationWithInsights | undefined) ?? null;
}

export function listPeriods(): string[] {
  const rows = periodsStatement.all() as Array<{ period: string }>;
  return Array.from(new Set(rows.map((row) => row.period))).sort((left, right) => right.localeCompare(left));
}

export function getPeriodStatus(collaboratorId: number, period: string): PeriodStatus {
  return resolvePeriodStatus(collaboratorId, period);
}

export function closePeriod(collaboratorId: number, period: string): PeriodStatus {
  const normalizedPeriod = period.trim();

  db.prepare(`
    INSERT INTO evaluation_statuses (collaborator_id, period, closed_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(collaborator_id, period) DO NOTHING
  `).run(collaboratorId, normalizedPeriod);

  return resolvePeriodStatus(collaboratorId, normalizedPeriod);
}

export function clearAllData(): void {
  const clearTransaction = db.transaction(() => {
    db.prepare('DELETE FROM app_settings').run();
    db.prepare('DELETE FROM evaluation_statuses').run();
    db.prepare('DELETE FROM period_statuses').run();
    db.prepare('DELETE FROM evaluations').run();
    db.prepare('DELETE FROM collaborators').run();
  });

  clearTransaction();
  db.pragma('wal_checkpoint(TRUNCATE)');
}

export function saveEvaluation(input: EvaluationRecord): EvaluationWithInsights {
  if (resolvePeriodStatus(input.collaboratorId, input.period).isClosed) {
    throw new Error(`El período ${input.period} está cerrado y ya no permite cambios.`);
  }

  const insights = calculateInsights(input);
  const existing = db
    .prepare('SELECT id FROM evaluations WHERE collaborator_id = ? AND period = ?')
    .get(input.collaboratorId, input.period) as { id: number } | undefined;

  if (existing) {
    db.prepare(`
      UPDATE evaluations
      SET
        collaboration = @collaboration,
        stakeholder_management = @stakeholderManagement,
        ownership = @ownership,
        execution = @execution,
        software_quality = @softwareQuality,
        incident_response = @incidentResponse,
        operational_discipline = @operationalDiscipline,
        communication = @communication,
        autonomy = @autonomy,
        learning = @learning,
        innovation_ai = @innovationAI,
        impact = @impact,
        strengths = @strengths,
        improvements = @improvements,
        manager_notes = @managerNotes,
        feedback_session_notes = @feedbackSessionNotes,
        yearly_improvement_plan = @yearlyImprovementPlan,
        growth_potential = @growthPotential,
        promotion_readiness = @promotionReadiness,
        score = @score,
        compensation_band = @compensationBand,
        merit_points = @meritPoints,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = @id
    `).run({ ...input, ...insights, id: existing.id });
  } else {
    db.prepare(`
      INSERT INTO evaluations (
        external_id,
        collaborator_id,
        period,
        collaboration,
        stakeholder_management,
        ownership,
        execution,
        software_quality,
        incident_response,
        operational_discipline,
        communication,
        autonomy,
        learning,
        innovation_ai,
        impact,
        strengths,
        improvements,
        manager_notes,
        feedback_session_notes,
        yearly_improvement_plan,
        growth_potential,
        promotion_readiness,
        score,
        compensation_band,
        merit_points
      ) VALUES (
        @externalId,
        @collaboratorId,
        @period,
        @collaboration,
        @stakeholderManagement,
        @ownership,
        @execution,
        @softwareQuality,
        @incidentResponse,
        @operationalDiscipline,
        @communication,
        @autonomy,
        @learning,
        @innovationAI,
        @impact,
        @strengths,
        @improvements,
        @managerNotes,
        @feedbackSessionNotes,
        @yearlyImprovementPlan,
        @growthPotential,
        @promotionReadiness,
        @score,
        @compensationBand,
        @meritPoints
      )
    `).run({ ...input, ...insights, externalId: randomUUID() });
  }

  return getEvaluation(input.collaboratorId, input.period) as EvaluationWithInsights;
}

export function getRanking(filters: EvaluationFilters): RankingRow[] {
  const team = filters.team && filters.team.length > 0 ? filters.team : null;
  return rankingByPeriodStatement.all(filters.period, team, team) as RankingRow[];
}

export function getAppSettings(): AppSettings {
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(SETTINGS_KEY) as { value: string } | undefined;
  if (!row) {
    return createDefaultAppSettings();
  }

  try {
    return normalizeAppSettings(JSON.parse(row.value) as AppSettings);
  } catch {
    return createDefaultAppSettings();
  }
}

export function saveAppSettings(input: AppSettings): AppSettings {
  const normalized = normalizeAppSettings(input);
  db.prepare(`
    INSERT INTO app_settings (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = CURRENT_TIMESTAMP
  `).run(SETTINGS_KEY, JSON.stringify(normalized));

  return normalized;
}

export function exportCsv(): string {
  const collaborators = listCollaborators();
  const evaluations = db.prepare(`
    SELECT
      c.id AS collaborator_id,
      c.external_id AS collaborator_external_id,
      c.name AS collaborator_name,
      c.created_at AS collaborator_created_at,
      c.role,
      c.team,
      e.period,
      e.collaboration,
      e.stakeholder_management,
      e.ownership,
      e.execution,
      e.software_quality,
      e.incident_response,
      e.operational_discipline,
      e.communication,
      e.autonomy,
      e.learning,
      e.innovation_ai,
      e.impact,
      e.strengths,
      e.improvements,
      e.manager_notes,
      e.feedback_session_notes,
      e.yearly_improvement_plan,
      e.growth_potential,
      e.promotion_readiness,
      e.score,
      e.compensation_band,
      e.merit_points
    FROM evaluations e
    INNER JOIN collaborators c ON c.id = e.collaborator_id
    ORDER BY c.team COLLATE NOCASE ASC, c.name COLLATE NOCASE ASC, e.period DESC
  `).all() as Array<FlatExportRow & { collaborator_id: number }>;
  const statuses = db.prepare(`
    SELECT collaborator_id AS collaboratorId, period, closed_at AS closedAt
    FROM evaluation_statuses
  `).all() as Array<{ collaboratorId: number; period: string; closedAt: string }>;
  const statusByKey = new Map(statuses.map((item) => [`${item.collaboratorId}::${item.period}`, item]));
  const appSettings = getAppSettings();

  const rows: FlatExportRow[] = [
    {
      backup_version: BACKUP_VERSION,
      row_type: 'settings',
      leader_name: appSettings.leaderName,
      leader_role: appSettings.leaderRole,
      leader_email: appSettings.leaderEmail,
    },
    ...collaborators.map((collaborator) => ({
      backup_version: BACKUP_VERSION,
      row_type: 'collaborator',
      collaborator_external_id: collaborator.externalId,
      collaborator_name: collaborator.name,
      collaborator_created_at: collaborator.createdAt,
      role: collaborator.role,
      team: collaborator.team,
    })),
    ...evaluations.map((evaluation) => {
      const status = statusByKey.get(`${evaluation.collaborator_id}::${evaluation.period}`);
      return {
        ...evaluation,
        backup_version: BACKUP_VERSION,
        row_type: 'evaluation',
        period_closed: status ? 'true' : 'false',
        period_closed_at: status?.closedAt ?? '',
      } satisfies FlatExportRow;
    }),
  ];

  return stringify(rows.map(serializeBackupRow), { header: true, columns: BACKUP_COLUMNS });
}

export function importCsv(csvContent: string): BackupImportSummary {
  const rows = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as FlatExportRow[];

  const settingsRows: FlatExportRow[] = [];
  const collaboratorRows: FlatExportRow[] = [];
  const evaluationRows: FlatExportRow[] = [];

  for (const row of rows) {
    const rowType = row.row_type?.trim().toLowerCase();

    if (rowType === 'settings') {
      settingsRows.push(row);
      continue;
    }

    if (rowType === 'collaborator') {
      collaboratorRows.push(row);
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

  const importedCollaboratorIds = new Set<string>();
  const collaboratorIdByExternalId = new Map<string, number>();
  let evaluationsImported = 0;
  let statusesImported = 0;
  let settingsUpdated = false;

  const insertCollaborator = db.prepare(`
    INSERT INTO collaborators (external_id, name, role, team)
    VALUES (@external_id, @name, @role, @team)
    ON CONFLICT(external_id) DO UPDATE SET
      name = excluded.name,
      role = excluded.role,
      team = excluded.team
  `);

  const updateCollaboratorCreatedAt = db.prepare(`
    UPDATE collaborators
    SET created_at = ?
    WHERE external_id = ?
  `);

  function ensureCollaborator(row: FlatExportRow) {
    const externalId = row.collaborator_external_id?.trim();
    if (!externalId) {
      return null;
    }

    const cachedId = collaboratorIdByExternalId.get(externalId);
    if (cachedId) {
      importedCollaboratorIds.add(externalId);
      return cachedId;
    }

    insertCollaborator.run({
      external_id: externalId,
      name: row.collaborator_name?.trim() || 'Colaborador',
      role: row.role?.trim() || '',
      team: row.team?.trim() || '',
    });

    if (row.collaborator_created_at?.trim()) {
      updateCollaboratorCreatedAt.run(row.collaborator_created_at.trim(), externalId);
    }

    const collaborator = db.prepare('SELECT id FROM collaborators WHERE external_id = ?').get(externalId) as { id: number };
    collaboratorIdByExternalId.set(externalId, collaborator.id);
    importedCollaboratorIds.add(externalId);
    return collaborator.id;
  }

  for (const row of collaboratorRows) {
    ensureCollaborator(row);
  }

  const latestSettingsRow = settingsRows.at(-1);
  if (latestSettingsRow) {
    saveAppSettings({
      leaderName: latestSettingsRow.leader_name ?? '',
      leaderRole: latestSettingsRow.leader_role ?? '',
      leaderEmail: latestSettingsRow.leader_email ?? '',
    });
    settingsUpdated = true;
  }

  for (const row of evaluationRows) {
    const collaboratorId = ensureCollaborator(row);
    const normalizedPeriod = row.period?.trim();
    if (!collaboratorId || !normalizedPeriod) {
      continue;
    }

    const evaluationInput: EvaluationRecord = {
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
    };

    saveEvaluation(evaluationInput);
    evaluationsImported += 1;

    if (isTruthyFlag(row.period_closed)) {
      db.prepare(`
        INSERT INTO evaluation_statuses (collaborator_id, period, closed_at)
        VALUES (?, ?, ?)
        ON CONFLICT(collaborator_id, period) DO UPDATE SET closed_at = excluded.closed_at
      `).run(collaboratorId, normalizedPeriod, row.period_closed_at?.trim() || new Date().toISOString());
      statusesImported += 1;
    }
  }

  return {
    collaborators: importedCollaboratorIds.size,
    evaluations: evaluationsImported,
    statuses: statusesImported,
    settingsUpdated,
  };
}