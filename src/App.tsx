import { CSSProperties, FormEvent, MouseEvent, useEffect, useId, useMemo, useRef, useState } from 'react';
import Chart from 'chart.js/auto';
import packageJson from '../package.json';
import falabellaLogoUrl from '../assets/falabella-logo.png';
import {
  IconArrowUpRight,
  IconBrain,
  IconBulb,
  IconCalendarEvent,
  IconCoins,
  IconDeviceFloppy,
  IconFileImport,
  IconLifebuoy,
  IconLock,
  IconListCheck,
  IconMessageCircle2,
  IconMoodEmpty,
  IconMoodSad,
  IconMoodSmile,
  IconPresentation,
  IconSettings,
  IconShieldCheck,
  IconSparkles,
  IconTarget,
  IconTrophy,
  IconUser,
  IconUserPlus,
  IconUsersGroup,
  IconX,
  IconTrendingUp,
  IconTrash,
} from '@tabler/icons-react';
import { calculatePreview, createEmptyEvaluation } from './lib/scoring';
import type { Collaborator, EvaluationRecord, EvaluationWithInsights, PeriodStatus, RankingRow } from './lib/types';

type CriterionKey = keyof Pick<
  EvaluationRecord,
  | 'collaboration'
  | 'stakeholderManagement'
  | 'ownership'
  | 'execution'
  | 'softwareQuality'
  | 'incidentResponse'
  | 'operationalDiscipline'
  | 'communication'
  | 'autonomy'
  | 'learning'
  | 'innovationAI'
  | 'impact'
>;

const criteria: Array<{ key: CriterionKey; label: string; hint: string }> = [
  { key: 'collaboration', label: 'Colaboración', hint: 'Trabajo con pares y aporte concreto al equipo.' },
  { key: 'stakeholderManagement', label: 'Stakeholders', hint: 'Gestión de expectativas, claridad y seguimiento.' },
  { key: 'ownership', label: 'Ownership', hint: 'Se hace cargo de punta a punta.' },
  { key: 'execution', label: 'Ejecución', hint: 'Convierte prioridades en entregas confiables.' },
  { key: 'softwareQuality', label: 'Calidad de software', hint: 'Criterio técnico, testing y mantenibilidad.' },
  { key: 'incidentResponse', label: 'Respuesta a incidentes', hint: 'Reacción, aprendizaje y seguimiento operativo.' },
  { key: 'operationalDiscipline', label: 'Disciplina operativa', hint: 'Orden, despliegues y cumplimiento de acuerdos.' },
  { key: 'communication', label: 'Comunicación', hint: 'Síntesis, claridad y conversaciones difíciles.' },
  { key: 'autonomy', label: 'Autonomía', hint: 'Capacidad de avanzar sin supervisión excesiva.' },
  { key: 'learning', label: 'Aprendizaje', hint: 'Adapta y mejora con feedback.' },
  { key: 'innovationAI', label: 'Innovación e IA', hint: 'Uso criterioso de IA e iniciativas para mejorar la forma de trabajar.' },
  { key: 'impact', label: 'Impacto', hint: 'Aporte visible al negocio y al equipo.' },
];

const criterionSpeech: Record<CriterionKey, { improvement: string; strength: string }> = {
  collaboration: {
    strength: 'logró trabajar bien con otros, sumar al equipo y construir acuerdos que empujaron el trabajo hacia adelante.',
    improvement: 'todavía puede involucrar mejor a otros, pedir apoyo a tiempo y construir más colaboración alrededor de sus iniciativas.',
  },
  stakeholderManagement: {
    strength: 'mostró buena lectura de expectativas, ordenó conversaciones complejas y dio seguimiento con claridad.',
    improvement: 'necesita alinear mejor expectativas, anticipar riesgos y sostener un seguimiento más claro con stakeholders.',
  },
  ownership: {
    strength: 'se hizo cargo de punta a punta y sostuvo responsabilidad real sobre los resultados.',
    improvement: 'todavía necesita apropiarse más de los temas, cerrar mejor los pendientes y empujar con más constancia hasta el final.',
  },
  execution: {
    strength: 'convirtió prioridades en entregas concretas y mantuvo buen ritmo de ejecución.',
    improvement: 'puede mejorar la consistencia de ejecución, ordenar mejor prioridades y transformar antes las decisiones en entregas.',
  },
  softwareQuality: {
    strength: 'cuidó la calidad técnica, tomó buenas decisiones y dejó entregables más mantenibles.',
    improvement: 'todavía puede elevar el estándar técnico, reforzar testing y cuidar más la mantenibilidad de lo que entrega.',
  },
  incidentResponse: {
    strength: 'respondió bien en contextos de presión, ayudó a contener incidentes y dejó aprendizaje después de resolverlos.',
    improvement: 'necesita ganar más criterio y estructura al responder incidentes, especialmente en seguimiento y aprendizaje posterior.',
  },
  operationalDiscipline: {
    strength: 'mostró orden operativo, cumplió acuerdos y sostuvo una ejecución más confiable en el día a día.',
    improvement: 'puede reforzar disciplina operativa, orden en la ejecución y mayor consistencia en acuerdos y seguimiento.',
  },
  communication: {
    strength: 'comunicó con claridad, dio contexto útil y sostuvo conversaciones de manera efectiva.',
    improvement: 'todavía puede mejorar cómo comunica avances, riesgos y decisiones para dar más claridad al equipo.',
  },
  autonomy: {
    strength: 'avanzó con buena autonomía, destrabó problemas y necesitó poca supervisión para mantener el ritmo.',
    improvement: 'necesita ganar más autonomía para avanzar con menos dependencia y resolver antes los bloqueos habituales.',
  },
  learning: {
    strength: 'mostró apertura al aprendizaje, incorporó feedback y ajustó su forma de trabajar con rapidez.',
    improvement: 'puede acelerar el aprendizaje a partir del feedback y transformar antes ese aprendizaje en cambios visibles.',
  },
  innovationAI: {
    strength: 'aprovechó bien herramientas de IA o ideas de innovación para simplificar trabajo, ganar velocidad y mejorar la calidad del resultado.',
    improvement: 'todavía puede incorporar mejor herramientas de IA y prácticas de innovación para trabajar con más criterio, velocidad y efectividad.',
  },
  impact: {
    strength: 'generó impacto visible y dejó un aporte claro para el negocio y el equipo.',
    improvement: 'necesita enfocar más su trabajo en resultados visibles y conectar mejor su esfuerzo con impacto concreto.',
  },
};

const ratingOptions = [1, 2, 3, 4, 5];
const ratingCopy: Record<number, string> = {
  1: 'Muy bajo',
  2: 'Bajo',
  3: 'Esperado',
  4: 'Fuerte',
  5: 'Sobresaliente',
};
const currentYear = String(new Date().getFullYear());
const allTeamsLabel = 'Todos los equipos';
const appVersion = packageJson.version;
const appCredit = 'Creada por Ignacio Céspedes';
type IconComponent = typeof IconUser;

const criterionIcons: Record<CriterionKey, IconComponent> = {
  collaboration: IconUsersGroup,
  stakeholderManagement: IconMessageCircle2,
  ownership: IconShieldCheck,
  execution: IconTarget,
  softwareQuality: IconBrain,
  incidentResponse: IconLifebuoy,
  operationalDiscipline: IconListCheck,
  communication: IconMessageCircle2,
  autonomy: IconUser,
  learning: IconBulb,
  innovationAI: IconSparkles,
  impact: IconTrendingUp,
};

function formatScore(score: number) {
  return Number.isFinite(score) ? score.toFixed(1) : '0.0';
}

function getScoreIcon(score: number) {
  if (score >= 80) {
    return IconMoodSmile;
  }

  if (score >= 60) {
    return IconMoodEmpty;
  }

  return IconMoodSad;
}

function getCompensationCopy(compensationBand: string) {
  switch (compensationBand) {
    case 'Prioridad alta':
      return {
        label: 'Prioridad alta',
        description: 'Se recomienda defender ajuste y crecimiento en este ciclo.',
      };
    case 'Prioridad media':
      return {
        label: 'Prioridad media',
        description: 'Tiene argumentos para calibración positiva si el comité acompaña.',
      };
    case 'Mantener en observación':
      return {
        label: 'En observación',
        description: 'Muestra señales favorables, pero todavía necesita más consistencia.',
      };
    default:
      return {
        label: 'Sin prioridad de ajuste',
        description: 'No se recomienda priorizar aumento o cambio salarial en este ciclo.',
      };
  }
}

function getScoreTheme(score: number): CSSProperties {
  const clamped = Math.max(0, Math.min(100, score));
  const hue = clamped * 1.2;

  return {
    '--score-bg': `hsl(${hue} 88% 95%)`,
    '--score-border': `hsl(${hue} 58% 78%)`,
    '--score-text': `hsl(${hue} 58% 24%)`,
    '--score-muted': `hsl(${hue} 38% 36%)`,
    '--score-badge': `hsl(${hue} 78% 90%)`,
  } as CSSProperties;
}

function buildPeriods(periods: string[]) {
  return Array.from(new Set(periods.filter(Boolean))).sort((left, right) => right.localeCompare(left));
}

type FeedbackStage = {
  description: string;
  isReadOnly: boolean;
  label: 'Nuevo' | 'En preparación' | 'Cerrado';
  tone: 'new' | 'draft' | 'closed';
};

function hasMeaningfulDraftChanges(evaluation: EvaluationRecord, baseline: EvaluationRecord) {
  return (
    evaluation.period !== baseline.period ||
    criteria.some((criterion) => evaluation[criterion.key] !== baseline[criterion.key]) ||
    evaluation.strengths !== baseline.strengths ||
    evaluation.improvements !== baseline.improvements ||
    evaluation.managerNotes !== baseline.managerNotes ||
    evaluation.feedbackSessionNotes !== baseline.feedbackSessionNotes ||
    evaluation.yearlyImprovementPlan !== baseline.yearlyImprovementPlan ||
    evaluation.growthPotential !== baseline.growthPotential ||
    evaluation.promotionReadiness !== baseline.promotionReadiness
  );
}

function getFeedbackStage(input: {
  baseline: EvaluationRecord | null;
  evaluation: EvaluationRecord | null;
  isClosed: boolean;
  storedEvaluation: EvaluationWithInsights | null;
}): FeedbackStage {
  if (input.isClosed) {
    return {
      label: 'Cerrado',
      tone: 'closed',
      isReadOnly: true,
      description: 'Solo lectura. Este feedback ya fue cerrado para el período seleccionado.',
    };
  }

  if (input.storedEvaluation) {
    return {
      label: 'En preparación',
      tone: 'draft',
      isReadOnly: false,
      description: 'Hay una evaluación guardada y todavía se puede seguir ajustando.',
    };
  }

  if (input.evaluation && input.baseline && hasMeaningfulDraftChanges(input.evaluation, input.baseline)) {
    return {
      label: 'En preparación',
      tone: 'draft',
      isReadOnly: false,
      description: 'Hay cambios en curso para este feedback, pero aún no se han guardado.',
    };
  }

  return {
    label: 'Nuevo',
    tone: 'new',
    isReadOnly: false,
    description: 'Todavía no existe una evaluación guardada para este período.',
  };
}

function toEvaluationRecord(evaluation: EvaluationWithInsights): EvaluationRecord {
  return {
    collaboratorId: evaluation.collaboratorId,
    period: evaluation.period,
    collaboration: evaluation.collaboration,
    stakeholderManagement: evaluation.stakeholderManagement,
    ownership: evaluation.ownership,
    execution: evaluation.execution,
    softwareQuality: evaluation.softwareQuality,
    incidentResponse: evaluation.incidentResponse,
    operationalDiscipline: evaluation.operationalDiscipline,
    communication: evaluation.communication,
    autonomy: evaluation.autonomy,
    learning: evaluation.learning,
    innovationAI: evaluation.innovationAI,
    impact: evaluation.impact,
    strengths: evaluation.strengths,
    improvements: evaluation.improvements,
    managerNotes: evaluation.managerNotes,
    feedbackSessionNotes: evaluation.feedbackSessionNotes,
    yearlyImprovementPlan: evaluation.yearlyImprovementPlan,
    growthPotential: evaluation.growthPotential,
    promotionReadiness: evaluation.promotionReadiness,
  };
}

function renderFeedbackContent(value: string, fallback: string) {
  const normalized = value.trim();

  if (!normalized) {
    return <p className="feedback-text-block">{fallback}</p>;
  }

  const lines = normalized.split('\n');
  const blocks: JSX.Element[] = [];
  let paragraphLines: string[] = [];
  let bulletLines: string[] = [];

  function flushParagraph() {
    if (paragraphLines.length === 0) {
      return;
    }

    blocks.push(
      <p className="feedback-text-block" key={`paragraph-${blocks.length}`}>
        {paragraphLines.join('\n')}
      </p>,
    );
    paragraphLines = [];
  }

  function flushBullets() {
    if (bulletLines.length === 0) {
      return;
    }

    blocks.push(
      <ul className="feedback-bullet-list" key={`bullets-${blocks.length}`}>
        {bulletLines.map((item, index) => (
          <li key={`bullet-${blocks.length}-${index}`}>{item}</li>
        ))}
      </ul>,
    );
    bulletLines = [];
  }

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      flushBullets();
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      flushParagraph();
      bulletLines.push(trimmed.replace(/^[-*]\s+/, ''));
      continue;
    }

    flushBullets();
    paragraphLines.push(trimmed);
  }

  flushParagraph();
  flushBullets();

  return <div className="feedback-copy-stack">{blocks}</div>;
}

function renderSharedFeedbackSection(systemText: string, manualText: string, manualLead: string) {
  const normalizedManualText = manualText.trim();

  return (
    <div className="feedback-shared-section">
      {renderFeedbackContent(systemText, '')}
      {normalizedManualText ? (
        <div className="feedback-manual-extra">
          <p className="feedback-manual-lead">{manualLead}</p>
          {renderFeedbackContent(normalizedManualText, '')}
        </div>
      ) : null}
    </div>
  );
}

function joinLabels(labels: string[]) {
  if (labels.length === 0) {
    return '';
  }

  if (labels.length === 1) {
    return labels[0];
  }

  if (labels.length === 2) {
    return `${labels[0]} y ${labels[1]}`;
  }

  return `${labels.slice(0, -1).join(', ')} y ${labels[labels.length - 1]}`;
}

function buildSpeechSuggestions(evaluation: EvaluationRecord, collaboratorName?: string | null) {
  const scoredCriteria = criteria.map((criterion) => ({
    ...criterion,
    score: evaluation[criterion.key],
    speech: criterionSpeech[criterion.key],
  }));
  const strongest = [...scoredCriteria]
    .sort((left, right) => right.score - left.score)
    .filter((item) => item.score >= 4)
    .slice(0, 3);
  const strongestFallback = strongest.length > 0 ? strongest : [...scoredCriteria].sort((left, right) => right.score - left.score).slice(0, 2);
  const weakest = [...scoredCriteria]
    .sort((left, right) => left.score - right.score)
    .filter((item) => item.score <= 3)
    .slice(0, 2);
  const weakestFallback = weakest.length > 0 ? weakest : [...scoredCriteria].sort((left, right) => left.score - right.score).slice(0, 1);
  const personName = collaboratorName?.trim() || 'la persona';
  const strongestAreas = joinLabels(strongestFallback.map((item) => item.label.toLowerCase()));
  const weakestAreas = joinLabels(weakestFallback.map((item) => item.label.toLowerCase()));

  const strengthsText = strongestFallback
    .map((item) => `- Quiero destacar que en ${item.label.toLowerCase()}, ${item.speech.strength}`)
    .join('\n');

  const improvementsText = weakestFallback
    .map((item) => `- Veo una oportunidad de mejora en ${item.label.toLowerCase()}: ${item.speech.improvement}`)
    .join('\n');

  const potentialLine =
    evaluation.growthPotential >= 4
      ? 'Veo espacio para seguir ampliando su alcance y darle desafíos de mayor complejidad si sostiene este nivel.'
      : evaluation.growthPotential <= 2
        ? 'El foco ahora debería estar en consolidar la base del rol antes de ampliar alcance o complejidad.'
        : 'El siguiente paso está en consolidar este nivel y ganar más consistencia antes de ampliar alcance.';

  const readinessLine =
    evaluation.promotionReadiness >= 4
      ? 'Además, hoy muestra señales que permiten hablar de mayor exposición y responsabilidad en el corto plazo.'
      : evaluation.promotionReadiness <= 2
        ? 'Todavía no está en un punto para hablar de mayor responsabilidad; primero conviene consolidar sus bases en el rol actual.'
        : 'Todavía hay espacio para fortalecer algunas bases antes de pensar en un salto mayor de responsabilidad.';

  const managerNotesText = [
    `${personName === 'la persona' ? 'Durante este período' : `En este período, ${personName}`} mostró sus mejores señales en ${strongestAreas}, y ahí vale la pena poner el foco positivo de la conversación.`,
    `Quiero reconocer especialmente que ${strongestFallback[0]?.speech.strength ?? 'tuvo un desempeño sólido en este ciclo.'}`,
    `Hacia adelante, la conversación debería aterrizar en ${weakestAreas}, porque ahí está la oportunidad más clara de mejora para el próximo ciclo.`,
    potentialLine,
    readinessLine,
  ].join('\n\n');

  return {
    improvementsText,
    managerNotesText,
    strengthsText,
  };
}

type CompactRadarChartProps = {
  evaluation: EvaluationRecord;
};

function CompactRadarChart({ evaluation }: CompactRadarChartProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const canvasElement = canvas;

    const chart = new Chart(canvasElement, {
      type: 'radar',
      data: {
        labels: criteria.map((criterion) => criterion.label),
        datasets: [
          {
            data: criteria.map((criterion) => evaluation[criterion.key]),
            borderColor: '#2649b6',
            backgroundColor: 'rgba(38, 73, 182, 0.12)',
            pointBackgroundColor: '#2649b6',
            pointBorderColor: '#ffffff',
            pointRadius: 2,
            pointHoverRadius: 2,
            borderWidth: 1.8,
          },
        ],
      },
      options: {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { enabled: true },
        },
        scales: {
          r: {
            min: 0,
            max: 5,
            ticks: {
              display: false,
              stepSize: 1,
            },
            pointLabels: {
              color: '#4b5568',
              font: {
                size: 9,
                weight: 'bold',
              },
            },
            grid: {
              color: 'rgba(182, 194, 224, 0.65)',
            },
            angleLines: {
              color: 'rgba(207, 216, 235, 0.8)',
            },
          },
        },
      },
    });

    function handlePointerMove(event: globalThis.MouseEvent) {
      const radialScale = chart.scales.r as typeof chart.scales.r & {
        _pointLabelItems?: Array<{ bottom: number; left: number; right: number; top: number }>;
      };
      const labelItems = radialScale._pointLabelItems ?? [];
      const bounds = canvasElement.getBoundingClientRect();
      const pointerX = event.clientX - bounds.left;
      const pointerY = event.clientY - bounds.top;
      const hoveredIndex = labelItems.findIndex(
        (item) => pointerX >= item.left && pointerX <= item.right && pointerY >= item.top && pointerY <= item.bottom,
      );

      if (hoveredIndex === -1) {
        canvasElement.style.cursor = 'default';
        setTooltip(null);
        return;
      }

      const hoveredItem = labelItems[hoveredIndex];
      canvasElement.style.cursor = 'help';
      setTooltip({
        text: criteria[hoveredIndex]?.hint ?? '',
        x: (hoveredItem.left + hoveredItem.right) / 2,
        y: hoveredItem.top - 10,
      });
    }

    function handlePointerLeave() {
      canvasElement.style.cursor = 'default';
      setTooltip(null);
    }

    canvasElement.addEventListener('mousemove', handlePointerMove);
    canvasElement.addEventListener('mouseleave', handlePointerLeave);

    return () => {
      canvasElement.removeEventListener('mousemove', handlePointerMove);
      canvasElement.removeEventListener('mouseleave', handlePointerLeave);
      chart.destroy();
    };
  }, [evaluation]);

  return (
    <>
      <canvas ref={canvasRef} className="feedback-chart-canvas" />
      {tooltip ? (
        <div className="feedback-chart-tooltip" style={{ left: tooltip.x, top: tooltip.y }} role="tooltip">
          {tooltip.text}
        </div>
      ) : null}
    </>
  );
}

type HistoryPoint = {
  period: string;
  score: number;
};

type CompactHistoryBarChartProps = {
  history: HistoryPoint[];
};

function CompactHistoryBarChart({ history }: CompactHistoryBarChartProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: history.map((item) => item.period),
        datasets: [
          {
            data: history.map((item) => item.score),
            backgroundColor: history.map((item, index) =>
              index === history.length - 1 ? 'rgba(38, 73, 182, 0.82)' : 'rgba(123, 143, 196, 0.55)',
            ),
            borderRadius: 8,
            maxBarThickness: 26,
          },
        ],
      },
      options: {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { enabled: true },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: '#4b5568',
              font: { size: 10, weight: 'bold' },
            },
            border: { display: false },
          },
          y: {
            min: 0,
            max: 100,
            ticks: {
              stepSize: 25,
              color: '#7a8392',
              font: { size: 9 },
            },
            grid: {
              color: 'rgba(207, 216, 235, 0.8)',
            },
            border: { display: false },
          },
        },
      },
    });

    return () => chart.destroy();
  }, [history]);

  return <canvas ref={canvasRef} className="feedback-chart-canvas" />;
}

function summarizeFeedback(evaluation: EvaluationRecord) {
  const scoredCriteria = criteria.map((criterion) => ({ ...criterion, value: evaluation[criterion.key] }));

  return {
    strengths: [...scoredCriteria]
      .sort((left, right) => right.value - left.value)
      .slice(0, 3)
      .map((item) => `${item.label}: ${item.hint}`),
    focusAreas: [...scoredCriteria]
      .sort((left, right) => left.value - right.value)
      .slice(0, 2)
      .map((item) => `${item.label}: ${item.hint}`),
  };
}

function appendBulletPoint(value: string) {
  const normalized = value.replace(/\s+$/, '');

  if (!normalized) {
    return '- ';
  }

  return `${normalized}\n- `;
}

function insertBulletPointAtSelection(value: string, selectionStart: number, selectionEnd: number) {
  const start = Math.max(0, selectionStart);
  const end = Math.max(start, selectionEnd);
  const prefix = value.slice(0, start);
  const insertion = prefix.length === 0 || prefix.endsWith('\n') ? '- ' : '\n- ';

  return {
    nextCursor: start + insertion.length,
    nextValue: `${value.slice(0, start)}${insertion}${value.slice(end)}`,
  };
}

type RatingFieldProps = {
  compact?: boolean;
  disabled: boolean;
  hideLabel?: boolean;
  label: string;
  value: number;
  onChange: (value: number) => void;
};

function RatingField({ compact = false, disabled, hideLabel = false, label, value, onChange }: RatingFieldProps) {
  return (
    <div className={`rating-field${compact ? ' rating-field-compact' : ''}`}>
      {hideLabel ? null : (
        <div className="rating-field-header">
          <span>{label}</span>
          <strong>{ratingCopy[value] ?? `Nivel ${value}`}</strong>
        </div>
      )}
      <div className={`rating-picker${compact ? ' rating-picker-compact' : ''}`} role="radiogroup" aria-label={label}>
        {ratingOptions.map((option) => (
          <button
            key={option}
            aria-checked={value === option}
            className={`rating-pill${compact ? ' rating-pill-compact' : ''}${value === option ? ' rating-pill-active' : ''}`}
            disabled={disabled}
            onClick={() => onChange(option)}
            role="radio"
            type="button"
          >
            <span>{option}</span>
            <small>{ratingCopy[option]}</small>
          </button>
        ))}
      </div>
    </div>
  );
}

type NotesFieldProps = {
  className?: string;
  disabled: boolean;
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows: number;
  textareaClassName?: string;
  value: string;
};

function NotesField({ className, disabled, label, onChange, placeholder, rows, textareaClassName, value }: NotesFieldProps) {
  const fieldId = useId();
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  function handleInsertBullet(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();

    const textarea = textareaRef.current;
    if (!textarea) {
      onChange(appendBulletPoint(value));
      return;
    }

    const { nextCursor, nextValue } = insertBulletPointAtSelection(
      value,
      textarea.selectionStart ?? value.length,
      textarea.selectionEnd ?? value.length,
    );

    onChange(nextValue);

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(nextCursor, nextCursor);
    });
  }

  return (
    <div className={className ? `notes-field ${className}` : 'notes-field'}>
      <div className="notes-label-row">
        <label htmlFor={fieldId}>{label}</label>
        <button
          className="ghost-button ghost-button-compact notes-helper-button"
          disabled={disabled}
          onClick={handleInsertBullet}
          onMouseDown={(event) => event.preventDefault()}
          type="button"
        >
          <IconListCheck size={16} stroke={1.8} />
          Agregar viñeta
        </button>
      </div>
      <textarea
        id={fieldId}
        ref={textareaRef}
        className={textareaClassName ? `notes-textarea ${textareaClassName}` : 'notes-textarea'}
        disabled={disabled}
        placeholder={placeholder}
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

export default function App() {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isCreatingCollaborator, setIsCreatingCollaborator] = useState(false);
  const [evaluation, setEvaluation] = useState<EvaluationRecord | null>(null);
  const [storedEvaluation, setStoredEvaluation] = useState<EvaluationWithInsights | null>(null);
  const [ranking, setRanking] = useState<RankingRow[]>([]);
  const [availablePeriods, setAvailablePeriods] = useState<string[]>([currentYear]);
  const [selectedPeriod, setSelectedPeriod] = useState(currentYear);
  const [selectedTeam, setSelectedTeam] = useState(allTeamsLabel);
  const [feedbackMode, setFeedbackMode] = useState(false);
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [discardDialogReason, setDiscardDialogReason] = useState<'navigation' | 'window-close'>('navigation');
  const [clearDataDialogOpen, setClearDataDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedPeriodStatus, setSelectedPeriodStatus] = useState<PeriodStatus>({
    collaboratorId: null,
    period: currentYear,
    isClosed: false,
    closedAt: null,
  });
  const [status, setStatus] = useState('Base local lista. Agrega colaboradores y prepara una conversación de feedback clara.');
  const [saving, setSaving] = useState(false);
  const [collaboratorDraft, setCollaboratorDraft] = useState({ name: '', role: '', team: '' });
  const [toast, setToast] = useState<{ icon: 'save' | 'lock'; message: string } | null>(null);
  const [historyEvaluations, setHistoryEvaluations] = useState<EvaluationWithInsights[]>([]);
  const pendingDiscardActionRef = useRef<(() => void | Promise<void>) | null>(null);

  useEffect(() => {
    void refreshAll();
  }, []);

  const teamOptions = useMemo(() => {
    const teams = Array.from(new Set(collaborators.map((collaborator) => collaborator.team))).sort((left, right) =>
      left.localeCompare(right),
    );
    return [allTeamsLabel, ...teams];
  }, [collaborators]);

  const teamFilteredCollaborators = useMemo(() => {
    if (selectedTeam === allTeamsLabel) {
      return collaborators;
    }

    return collaborators.filter((collaborator) => collaborator.team === selectedTeam);
  }, [collaborators, selectedTeam]);

  const collaboratorsWithEvaluationIds = useMemo(() => new Set(ranking.map((row) => row.collaboratorId)), [ranking]);

  const visibleCollaborators = teamFilteredCollaborators;

  const periodOptions = useMemo(() => {
    if (availablePeriods.length > 0) {
      return availablePeriods;
    }

    return selectedPeriod ? [selectedPeriod] : [currentYear];
  }, [availablePeriods, selectedPeriod]);

  useEffect(() => {
    if (visibleCollaborators.length === 0) {
      setSelectedId(null);
      return;
    }

    if (isCreatingCollaborator) {
      return;
    }

    if (!visibleCollaborators.some((collaborator) => collaborator.id === selectedId)) {
      setSelectedId(visibleCollaborators[0].id);
    }
  }, [visibleCollaborators, isCreatingCollaborator, selectedId]);

  useEffect(() => {
    if (!selectedPeriod) {
      return;
    }

    void loadRanking(selectedPeriod, selectedTeam);
  }, [selectedPeriod, selectedTeam]);

  useEffect(() => {
    if (selectedId === null || !selectedPeriod) {
      setSelectedPeriodStatus({
        collaboratorId: selectedId,
        period: selectedPeriod,
        isClosed: false,
        closedAt: null,
      });
      return;
    }

    void loadPeriodStatus(selectedId, selectedPeriod);
  }, [selectedId, selectedPeriod]);

  useEffect(() => {
    if (selectedId === null || !selectedPeriod) {
      setEvaluation(null);
      setStoredEvaluation(null);
      return;
    }

    void loadEvaluation(selectedId, selectedPeriod);
  }, [selectedId, selectedPeriod]);

  useEffect(() => {
    if (selectedId === null) {
      setHistoryEvaluations([]);
      return;
    }

    let isCancelled = false;
    const periodsToLoad = Array.from(new Set([...availablePeriods, selectedPeriod].filter(Boolean)));

    void Promise.all(periodsToLoad.map((period) => window.performanceApp.getEvaluation(selectedId, period))).then((results) => {
      if (isCancelled) {
        return;
      }

      setHistoryEvaluations(
        results
          .filter((item): item is EvaluationWithInsights => Boolean(item))
          .sort((left, right) => left.period.localeCompare(right.period)),
      );
    });

    return () => {
      isCancelled = true;
    };
  }, [availablePeriods, selectedId, selectedPeriod]);

  const selectedCollaborator = useMemo(
    () => visibleCollaborators.find((collaborator) => collaborator.id === selectedId) ?? null,
    [visibleCollaborators, selectedId],
  );

  useEffect(() => {
    if (!selectedCollaborator) {
      return;
    }

    setCollaboratorDraft({
      name: selectedCollaborator.name,
      role: selectedCollaborator.role,
      team: selectedCollaborator.team,
    });
  }, [selectedCollaborator]);

  const preview = useMemo(() => {
    if (!evaluation) {
      return null;
    }

    return calculatePreview(evaluation);
  }, [evaluation]);

  const feedbackHighlights = useMemo(() => {
    if (!evaluation) {
      return null;
    }

    return summarizeFeedback(evaluation);
  }, [evaluation]);

  const previewTheme = useMemo(() => getScoreTheme(preview?.score ?? 0), [preview]);
  const PreviewScoreIcon = useMemo(() => getScoreIcon(preview?.score ?? 0), [preview]);
  const previewCompensation = useMemo(
    () => getCompensationCopy(preview?.compensationBand ?? 'Sin prioridad'),
    [preview],
  );
  const speechSuggestions = useMemo(() => {
    if (!evaluation) {
      return null;
    }

    return buildSpeechSuggestions(evaluation, selectedCollaborator?.name);
  }, [evaluation, selectedCollaborator]);
  const historyChartData = useMemo(() => {
    const historyMap = new Map(historyEvaluations.map((item) => [item.period, item.score]));

    if (preview && evaluation) {
      historyMap.set(evaluation.period, preview.score);
    }

    return Array.from(historyMap.entries())
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([period, score]) => ({ period, score }));
  }, [evaluation, historyEvaluations, preview]);
  const isSelectedPeriodClosed =
    selectedPeriodStatus.isClosed &&
    selectedPeriodStatus.period === selectedPeriod &&
    selectedPeriodStatus.collaboratorId === selectedId;
  const feedbackBaseline = useMemo(() => {
    if (selectedId === null) {
      return null;
    }

    return {
      ...createEmptyEvaluation(selectedId),
      period: selectedPeriod,
    };
  }, [selectedId, selectedPeriod]);
  const feedbackStage = useMemo(
    () =>
      getFeedbackStage({
        baseline: feedbackBaseline,
        evaluation,
        isClosed: isSelectedPeriodClosed,
        storedEvaluation,
      }),
    [evaluation, feedbackBaseline, isSelectedPeriodClosed, storedEvaluation],
  );
  const FeedbackStageIcon = feedbackStage.tone === 'closed' ? IconLock : feedbackStage.tone === 'draft' ? IconDeviceFloppy : IconUserPlus;
  const persistedEvaluationBaseline = useMemo(() => {
    if (storedEvaluation) {
      return toEvaluationRecord(storedEvaluation);
    }

    return feedbackBaseline;
  }, [feedbackBaseline, storedEvaluation]);
  const hasUnsavedEvaluationChanges = useMemo(() => {
    if (!evaluation || !persistedEvaluationBaseline || isSelectedPeriodClosed) {
      return false;
    }

    return hasMeaningfulDraftChanges(evaluation, persistedEvaluationBaseline);
  }, [evaluation, isSelectedPeriodClosed, persistedEvaluationBaseline]);

  function openDiscardDialog(action: () => void | Promise<void>, reason: 'navigation' | 'window-close' = 'navigation') {
    pendingDiscardActionRef.current = action;
    setDiscardDialogReason(reason);
    setDiscardDialogOpen(true);
  }

  function closeDiscardDialog() {
    pendingDiscardActionRef.current = null;
    setDiscardDialogOpen(false);
  }

  async function confirmDiscardDialog() {
    const action = pendingDiscardActionRef.current;
    pendingDiscardActionRef.current = null;
    setDiscardDialogOpen(false);

    await action?.();
  }

  function requestDiscardUnsavedChanges(action: () => void | Promise<void>) {
    if (!hasUnsavedEvaluationChanges) {
      void action();
      return;
    }

    openDiscardDialog(action);
  }

  function handleFeedbackModeChange(nextValue: boolean) {
    if (nextValue === feedbackMode) {
      return;
    }

    requestDiscardUnsavedChanges(() => setFeedbackMode(nextValue));
  }

  function handleSelectedPeriodChange(nextPeriod: string) {
    if (nextPeriod === selectedPeriod) {
      return;
    }

    requestDiscardUnsavedChanges(() => setSelectedPeriod(nextPeriod));
  }

  function handleSelectedTeamChange(nextTeam: string) {
    if (nextTeam === selectedTeam) {
      return;
    }

    requestDiscardUnsavedChanges(() => setSelectedTeam(nextTeam));
  }

  function handleSelectedCollaboratorChange(nextCollaboratorId: number) {
    if (nextCollaboratorId === selectedId && !isCreatingCollaborator) {
      return;
    }

    requestDiscardUnsavedChanges(() => {
      setIsCreatingCollaborator(false);
      setSelectedId(nextCollaboratorId);
    });
  }

  function handleStartNewCollaborator() {
    requestDiscardUnsavedChanges(() => handleNewCollaborator());
  }

  useEffect(() => {
    window.performanceApp.setUnsavedFeedback(hasUnsavedEvaluationChanges);
  }, [hasUnsavedEvaluationChanges]);

  useEffect(() => {
    return window.performanceApp.onAttemptDiscardUnsavedFeedback(() => {
      openDiscardDialog(() => window.performanceApp.discardUnsavedAndCloseWindow(), 'window-close');
    });
  }, []);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeoutId = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  function showToast(message: string, icon: 'save' | 'lock') {
    setToast({ message, icon });
  }

  async function refreshAll() {
    const [collaboratorsResult, periodsResult] = await Promise.allSettled([
      window.performanceApp.listCollaborators(),
      window.performanceApp.listPeriods(),
    ]);

    if (collaboratorsResult.status === 'fulfilled') {
      setCollaborators(collaboratorsResult.value);

      if (collaboratorsResult.value.length > 0 && !selectedId && !isCreatingCollaborator) {
        setSelectedId(collaboratorsResult.value[0].id);
      }
    } else {
      setStatus('No se pudo cargar la lista de colaboradores desde la base local.');
    }

    if (periodsResult.status === 'fulfilled') {
      const normalizedPeriods = buildPeriods(periodsResult.value);
      setAvailablePeriods(normalizedPeriods);

      if (normalizedPeriods.length > 0 && !normalizedPeriods.includes(selectedPeriod)) {
        setSelectedPeriod(normalizedPeriods[0]);
      }
    } else {
      setAvailablePeriods((current) => buildPeriods(current));
      setStatus(
        'No se pudo refrescar el filtro de períodos. Si estás en modo desarrollo, reinicia la app para recargar la capa local.',
      );
    }
  }

  async function loadPeriodStatus(collaboratorId: number, period: string) {
    const nextStatus = await window.performanceApp.getPeriodStatus(collaboratorId, period);
    setSelectedPeriodStatus(nextStatus);
  }

  async function loadRanking(period: string, team: string) {
    const nextRanking = await window.performanceApp.getRanking({
      period,
      team: team === allTeamsLabel ? null : team,
    });
    setRanking(nextRanking);
  }

  async function loadEvaluation(collaboratorId: number, period: string) {
    const current = await window.performanceApp.getEvaluation(collaboratorId, period);
    setStoredEvaluation(current);

    if (current) {
      setEvaluation({
        collaboratorId: current.collaboratorId,
        period: current.period,
        collaboration: current.collaboration,
        stakeholderManagement: current.stakeholderManagement,
        ownership: current.ownership,
        execution: current.execution,
        softwareQuality: current.softwareQuality,
        incidentResponse: current.incidentResponse,
        operationalDiscipline: current.operationalDiscipline,
        communication: current.communication,
        autonomy: current.autonomy,
        learning: current.learning,
        innovationAI: current.innovationAI,
        impact: current.impact,
        strengths: current.strengths,
        improvements: current.improvements,
        managerNotes: current.managerNotes,
        feedbackSessionNotes: current.feedbackSessionNotes,
        yearlyImprovementPlan: current.yearlyImprovementPlan,
        growthPotential: current.growthPotential,
        promotionReadiness: current.promotionReadiness,
      });
      return;
    }

    setEvaluation({
      ...createEmptyEvaluation(collaboratorId),
      period,
    });
  }

  async function handleSaveCollaborator(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!collaboratorDraft.name || !collaboratorDraft.role || !collaboratorDraft.team) {
      setStatus('Completa nombre, rol y equipo antes de crear un colaborador.');
      return;
    }

    if (selectedCollaborator) {
      const updated = await window.performanceApp.updateCollaborator(selectedCollaborator.id, collaboratorDraft);
      setIsCreatingCollaborator(false);
      setSelectedTeam(updated.team);
      setStatus(`Datos actualizados para ${updated.name}.`);
      await refreshAll();
      setSelectedId(updated.id);
      return;
    }

    const created = await window.performanceApp.createCollaborator(collaboratorDraft);
    setIsCreatingCollaborator(false);
    setCollaboratorDraft({ name: '', role: '', team: '' });
    setSelectedTeam(created.team);
    setStatus(`Colaborador creado: ${created.name}.`);
    await refreshAll();
    setSelectedId(created.id);
  }

  function handleNewCollaborator() {
    setIsCreatingCollaborator(true);
    setSelectedId(null);
    setCollaboratorDraft({ name: '', role: '', team: selectedTeam === allTeamsLabel ? '' : selectedTeam });
    setStatus('Formulario listo para crear un nuevo colaborador.');
  }

  async function handleSaveEvaluation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!evaluation || selectedId === null) {
      return;
    }

    if (isSelectedPeriodClosed) {
      setStatus(`El período ${selectedPeriod} está cerrado. No se permiten más cambios.`);
      return;
    }

    const normalizedPeriod = evaluation.period.trim();
    if (!normalizedPeriod) {
      setStatus('Ingresa un período antes de guardar la evaluación.');
      return;
    }

    setSaving(true);
    try {
      const isUpdatingEvaluation = Boolean(storedEvaluation);
      const saved = await window.performanceApp.saveEvaluation({
        ...evaluation,
        period: normalizedPeriod,
      });
      setStoredEvaluation(saved);
      setSelectedPeriod(normalizedPeriod);
      setStatus(`Evaluación guardada para ${selectedCollaborator?.name ?? 'el colaborador seleccionado'}.`);
      showToast(
        isUpdatingEvaluation
          ? `Feedback actualizado para ${selectedCollaborator?.name ?? 'el colaborador seleccionado'}.`
          : `Feedback guardado para ${selectedCollaborator?.name ?? 'el colaborador seleccionado'}.`,
        'save',
      );
      await refreshAll();
      await loadRanking(normalizedPeriod, selectedTeam);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'No se pudo guardar la evaluación.');
    } finally {
      setSaving(false);
    }
  }

  async function confirmClosePeriod() {
    if (!selectedPeriod || selectedId === null) {
      return;
    }

    setCloseDialogOpen(false);

    try {
      const closed = await window.performanceApp.closePeriod(selectedId, selectedPeriod);
      setSelectedPeriodStatus(closed);
      setStatus(`Feedback cerrado para ${selectedCollaborator?.name ?? 'el colaborador seleccionado'} en ${selectedPeriod}. La evaluación quedó en solo lectura.`);
      showToast(`Feedback de ${selectedCollaborator?.name ?? 'colaborador'} en ${selectedPeriod} cerrado correctamente.`, 'lock');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'No se pudo cerrar el período.');
    }
  }

  function handleClosePeriod() {
    if (!selectedPeriod) {
      return;
    }

    if (isSelectedPeriodClosed) {
      setStatus(`El período ${selectedPeriod} ya está cerrado.`);
      return;
    }

    setCloseDialogOpen(true);
  }

  async function handleExport() {
    const result = await window.performanceApp.exportCsv();
    if (result.canceled) {
      setStatus('La exportación fue cancelada.');
      return;
    }

    setStatus(`Respaldo CSV exportado en ${result.filePath}.`);
  }

  async function handleImport() {
    const result = await window.performanceApp.importCsv();
    if (result.canceled) {
      setStatus('La importación fue cancelada.');
      return;
    }

    setStatus(
      `Importación completada: ${result.imported?.collaborators ?? 0} filas de colaboradores y ${result.imported?.evaluations ?? 0} evaluaciones procesadas.`,
    );
    await refreshAll();
  }

  function handleRequestClearData() {
    setClearDataDialogOpen(true);
  }

  async function confirmClearData() {
    setClearDataDialogOpen(false);

    try {
      await window.performanceApp.clearAllData();
      setToast(null);
      setSettingsOpen(false);
      setCloseDialogOpen(false);
      setDiscardDialogOpen(false);
      setFeedbackMode(false);
      setIsCreatingCollaborator(false);
      setCollaboratorDraft({ name: '', role: '', team: '' });
      setCollaborators([]);
      setSelectedId(null);
      setEvaluation(null);
      setStoredEvaluation(null);
      setRanking([]);
      setHistoryEvaluations([]);
      setAvailablePeriods([currentYear]);
      setSelectedPeriod(currentYear);
      setSelectedTeam(allTeamsLabel);
      setSelectedPeriodStatus({
        collaboratorId: null,
        period: currentYear,
        isClosed: false,
        closedAt: null,
      });
      setStatus('Se eliminaron todos los datos locales de la aplicación. Si lo necesitas, importa un respaldo CSV para restaurarlos.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'No se pudo eliminar la base local de la aplicación.');
    }
  }

  function updateEvaluation<K extends keyof EvaluationRecord>(key: K, value: EvaluationRecord[K]) {
    setEvaluation((current) => (current ? { ...current, [key]: value } : current));
  }

  return (
    <div className="shell">
      {toast ? (
        <div className="toast-stack" aria-live="polite" aria-atomic="true">
          <div className="toast toast-success" role="status">
            <span className="toast-icon">
              {toast.icon === 'lock' ? <IconLock size={18} stroke={1.9} /> : <IconDeviceFloppy size={18} stroke={1.9} />}
            </span>
            <span className="toast-message">{toast.message}</span>
            <button className="toast-close" onClick={() => setToast(null)} type="button" aria-label="Cerrar notificación">
              <IconX size={16} stroke={2} />
            </button>
          </div>
        </div>
      ) : null}

      <header className="hero">
        <div className="hero-copy-block">
          <p className="eyebrow">Herramienta offline para líderes de equipo</p>
          <h1>Prepara y entrega tu feedback de desempeño con claridad.</h1>
          <p className="hero-copy">
            Reúne la evaluación del año, ordena los puntos clave de cada colaborador y llega a la sesión 1:1 con un mensaje claro, concreto y listo para compartir.
          </p>
        </div>

        <div className="hero-side">
          <div className="brand-mark">
            <span className="brand-version">v{appVersion}</span>
            <span className="brand-credit">{appCredit}</span>
            <img alt="Falabella" src={falabellaLogoUrl} />
          </div>
          <div className="hero-actions">
            <button className="ghost-button" onClick={() => handleFeedbackModeChange(!feedbackMode)} type="button">
              {feedbackMode ? <IconMessageCircle2 size={18} stroke={1.8} /> : <IconPresentation size={18} stroke={1.8} />}
              {feedbackMode ? 'Volver a vista general' : 'Abrir vista feedback'}
            </button>
            <button className="ghost-button" onClick={() => setSettingsOpen(true)} type="button">
              <IconSettings size={18} stroke={1.8} />
              Ajustes
            </button>
          </div>
        </div>
      </header>

      <section className="status-bar">
        <span>{status}</span>
        <span>
          {ranking.length} evaluaciones en {selectedPeriod}
          {selectedTeam === allTeamsLabel ? '' : ` · ${selectedTeam}`}
          {isSelectedPeriodClosed ? ' · Período cerrado' : ''}
        </span>
      </section>

      <section className="toolbar">
        <label>
          <span><IconUsersGroup size={16} stroke={1.9} />Equipo</span>
          <select value={selectedTeam} onChange={(event) => handleSelectedTeamChange(event.target.value)}>
            {teamOptions.map((team) => (
              <option key={team} value={team}>
                {team}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span><IconUser size={16} stroke={1.9} />Colaborador</span>
          <select
            value={selectedId ?? ''}
            onChange={(event) => {
              const nextValue = event.target.value;

              if (!nextValue) {
                return;
              }

              handleSelectedCollaboratorChange(Number(nextValue));
            }}
          >
            {isCreatingCollaborator ? <option value="">Nuevo colaborador</option> : null}
            {visibleCollaborators.map((collaborator) => (
              <option key={collaborator.id} value={collaborator.id}>
                {`${collaborator.name}${collaboratorsWithEvaluationIds.has(collaborator.id) ? '' : ' · sin evaluación en este período'}`}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span><IconCalendarEvent size={16} stroke={1.9} />Período</span>
          <select
            value={selectedPeriod}
            onChange={(event) => handleSelectedPeriodChange(event.target.value)}
          >
            {periodOptions.map((period) => (
              <option key={period} value={period}>
                {period}
              </option>
            ))}
          </select>
        </label>
      </section>

      {feedbackMode ? (
        <section className="feedback-screen panel panel-main">
          <div className="feedback-header">
            <div>
              <p className="panel-label">Sesión 1:1 · Vista para compartir</p>
              <h2 className="title-with-icon">
                <IconPresentation size={26} stroke={1.8} />
                {selectedCollaborator ? selectedCollaborator.name : 'Selecciona un colaborador'}
              </h2>
              <p className="feedback-subtitle">
                {selectedCollaborator
                  ? `${selectedCollaborator.role} · ${selectedCollaborator.team} · Período ${selectedPeriod}`
                  : 'Elige un colaborador para mostrar su feedback.'}
              </p>
            </div>
            <div className="header-actions">
              {preview ? (
                <div className="score-box score-box-clean score-box-emphasis" style={previewTheme}>
                  <div className="score-box-status-row">
                    <span className={`score-status-badge score-status-${feedbackStage.tone}`} title={feedbackStage.description}>
                      <FeedbackStageIcon size={15} stroke={2} />
                      {feedbackStage.label}
                    </span>
                    {feedbackStage.isReadOnly ? <span className="score-status-note">Solo lectura</span> : null}
                  </div>
                  <strong className="score-value score-value-hero">
                    <span className="score-icon-badge">
                      <PreviewScoreIcon size={28} stroke={2} />
                    </span>
                    {formatScore(preview.score)}
                  </strong>
                </div>
              ) : null}
            </div>
          </div>

          {evaluation && selectedCollaborator ? (
            <div className="feedback-layout">
              <article className="feedback-card">
                <h3>Lo que hizo bien</h3>
                {renderSharedFeedbackSection(
                  speechSuggestions?.strengthsText ?? 'Quiero destacar un desempeño sólido en este período.',
                  evaluation.strengths,
                  'Además, quiero sumar estos ejemplos concretos:',
                )}
              </article>
              <article className="feedback-card">
                <h3>Qué debe reforzar</h3>
                {renderSharedFeedbackSection(
                  speechSuggestions?.improvementsText ?? 'Veo algunos espacios de mejora para el próximo ciclo.',
                  evaluation.improvements,
                  'Además, quiero dejar estas observaciones puntuales:',
                )}
              </article>
              <article className="feedback-card feedback-card-wide">
                <h3>Mensaje guía para la conversación</h3>
                {renderSharedFeedbackSection(
                  speechSuggestions?.managerNotesText ?? 'Quiero ordenar esta conversación con algunos puntos principales para el período.',
                  evaluation.managerNotes,
                  'Además, quiero apoyarme en estas notas que dejé preparadas:',
                )}
              </article>
              <article className="feedback-card feedback-card-chart">
                <div className="feedback-chart-header">
                  <h3>Radar de atributos</h3>
                  <small>Lectura compacta de los factores evaluados</small>
                </div>
                <div className="feedback-chart-shell">
                  <CompactRadarChart evaluation={evaluation} />
                </div>
              </article>
              <article className="feedback-card feedback-card-chart">
                <div className="feedback-chart-header">
                  <h3>Evolución por período</h3>
                  <small>Comparación de score total entre ciclos</small>
                </div>
                <div className="feedback-chart-shell">
                  <CompactHistoryBarChart history={historyChartData} />
                </div>
              </article>
              <article className="feedback-card">
                <h3>Fortalezas que conviene destacar</h3>
                <ul>
                  {feedbackHighlights?.strengths.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
              <article className="feedback-card">
                <h3>Focos de desarrollo</h3>
                <ul>
                  {feedbackHighlights?.focusAreas.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
              <article className="feedback-card">
                <NotesField
                  className="feedback-notes-field"
                  disabled={isSelectedPeriodClosed}
                  label="Notas tomadas en el 1:1"
                  onChange={(value) => updateEvaluation('feedbackSessionNotes', value)}
                  placeholder="Registra acuerdos, reacciones y contexto de la conversación 1:1."
                  rows={7}
                  textareaClassName="feedback-textarea"
                  value={evaluation.feedbackSessionNotes}
                />
              </article>
              <article className="feedback-card">
                <NotesField
                  className="feedback-notes-field"
                  disabled={isSelectedPeriodClosed}
                  label="Siguientes pasos y plan anual"
                  onChange={(value) => updateEvaluation('yearlyImprovementPlan', value)}
                  placeholder="Define próximos pasos, plan de mejora y compromisos para el año."
                  rows={7}
                  textareaClassName="feedback-textarea"
                  value={evaluation.yearlyImprovementPlan}
                />
              </article>
            </div>
          ) : (
            <div className="empty-stage">
              <h3>Selecciona un colaborador</h3>
              <p>Esta vista está pensada para compartir pantalla durante el feedback sin mostrar paneles de calibración.</p>
            </div>
          )}

          {evaluation && selectedCollaborator ? (
            <div className="feedback-footer">
              <button className="ghost-button" onClick={() => handleFeedbackModeChange(false)} type="button">
                <IconMessageCircle2 size={18} stroke={1.8} />
                Volver a vista general
              </button>
              {isSelectedPeriodClosed ? (
                <span className="score-status-badge score-status-closed" title="El feedback ya fue cerrado para este período.">
                  <IconLock size={15} stroke={2} />
                  Período cerrado
                </span>
              ) : (
                <button
                  className="danger-button"
                  onClick={handleClosePeriod}
                  disabled={ranking.length === 0}
                  type="button"
                  title="Cerrar feedback del período y bloquear cambios."
                >
                  <IconLock size={18} stroke={1.8} />
                  Cerrar feedback
                </button>
              )}
            </div>
          ) : null}
        </section>
      ) : null}

      <main className={`workspace-grid${feedbackMode ? ' workspace-grid-hidden' : ''}`}>
        <aside className="panel panel-soft">
          <div className="panel-heading">
            <div>
              <p className="panel-label">Personas a cargo</p>
              <h2 className="title-with-icon">
                <IconUsersGroup size={26} stroke={1.8} />
                Colaboradores
              </h2>
            </div>
            <span className="badge">{visibleCollaborators.length}</span>
          </div>

          <div className="split-actions">
            <button className="ghost-button ghost-button-compact" onClick={handleStartNewCollaborator} type="button">
              <IconUserPlus size={18} stroke={1.8} />
              Nuevo
            </button>
          </div>

          <p className="helper-copy">
            Si el colaborador ya existe de otro período, selecciónalo en la lista para abrir su evaluación de este ciclo.
          </p>

          <form className="stack gap-m" onSubmit={handleSaveCollaborator}>
            <input
              placeholder="Nombre"
              value={collaboratorDraft.name}
              onChange={(event) => setCollaboratorDraft((current) => ({ ...current, name: event.target.value }))}
            />
            <input
              placeholder="Rol"
              value={collaboratorDraft.role}
              onChange={(event) => setCollaboratorDraft((current) => ({ ...current, role: event.target.value }))}
            />
            <input
              placeholder="Equipo"
              value={collaboratorDraft.team}
              onChange={(event) => setCollaboratorDraft((current) => ({ ...current, team: event.target.value }))}
            />
            <button className="solid-button" type="submit">
              <IconUserPlus size={18} stroke={1.8} />
              {selectedCollaborator ? 'Guardar cambios' : 'Agregar colaborador'}
            </button>
          </form>

          <div className="collaborator-divider" role="presentation" />

          <div className="collaborator-list">
            {visibleCollaborators.map((collaborator) => {
              const active = collaborator.id === selectedId;
              const hasEvaluationForPeriod = collaboratorsWithEvaluationIds.has(collaborator.id);
              return (
                <button
                  key={collaborator.id}
                  className={`collaborator-card${active ? ' collaborator-card-active' : ''}`}
                  onClick={() => handleSelectedCollaboratorChange(collaborator.id)}
                  type="button"
                >
                  <strong>{collaborator.name}</strong>
                  <span>{collaborator.role}</span>
                  <small className="collaborator-card-meta">
                    <span>{collaborator.team}</span>
                    <span className={`period-status-pill ${hasEvaluationForPeriod ? 'period-status-pill-positive' : 'period-status-pill-warning'}`}>
                      {hasEvaluationForPeriod ? `Con evaluación en ${selectedPeriod}` : `Sin evaluación en ${selectedPeriod}`}
                    </span>
                  </small>
                </button>
              );
            })}
            {visibleCollaborators.length === 0 ? (
              <p className="empty-state">Todavía no hay colaboradores para el filtro seleccionado.</p>
            ) : null}
          </div>
        </aside>

        <section className="panel panel-main">
          <div className="panel-heading">
            <div>
              <p className="panel-label">Preparación de feedback</p>
              <h2 className="title-with-icon">
                <IconMessageCircle2 size={26} stroke={1.8} />
                {selectedCollaborator ? selectedCollaborator.name : 'Selecciona un colaborador'}
              </h2>
              {selectedCollaborator ? <p className="panel-caption">{`${selectedCollaborator.role} · ${selectedCollaborator.team}`}</p> : null}
            </div>
            <div className="header-actions">
              {preview ? (
                <div className="score-box score-box-emphasis" style={previewTheme} title={previewCompensation.description}>
                  <div className="score-box-status-row">
                    <span className={`score-status-badge score-status-${feedbackStage.tone}`} title={feedbackStage.description}>
                      <FeedbackStageIcon size={15} stroke={2} />
                      {feedbackStage.label}
                    </span>
                    {feedbackStage.isReadOnly ? <span className="score-status-note">Solo lectura</span> : null}
                  </div>
                  <strong className="score-value score-value-hero">
                    <span className="score-icon-badge">
                      <PreviewScoreIcon size={28} stroke={2} />
                    </span>
                    {formatScore(preview.score)}
                  </strong>
                  <span>{previewCompensation.label}</span>
                  <small>{previewCompensation.description}</small>
                </div>
              ) : null}
            </div>
          </div>

          {evaluation ? (
            <form className="stack gap-l" onSubmit={handleSaveEvaluation}>
              <div className="evaluation-meta">
                <label className="criterion-card meta-card">
                  <div>
                    <strong className="criterion-title-with-icon">
                      <IconCalendarEvent size={18} stroke={1.8} />
                      Período
                    </strong>
                    <p>Define el ciclo que estás preparando antes de guardar o presentar.</p>
                  </div>
                  <input
                    list="evaluation-period-suggestions"
                    disabled={isSelectedPeriodClosed}
                    value={evaluation.period}
                    onChange={(event) => {
                      const nextPeriod = event.target.value;
                      updateEvaluation('period', nextPeriod);
                      setSelectedPeriod(nextPeriod);
                    }}
                    placeholder="Ej: 2025"
                  />
                </label>
                <div className="criterion-card meta-card">
                  <div>
                    <strong className="criterion-title-with-icon">
                      <IconBulb size={18} stroke={1.8} />
                      Potencial de crecimiento
                    </strong>
                    <p>Señal de evolución esperada en alcance, autonomía y complejidad.</p>
                  </div>
                  <RatingField
                    compact
                    disabled={isSelectedPeriodClosed}
                    hideLabel
                    label="Potencial de crecimiento"
                    value={evaluation.growthPotential}
                    onChange={(value) => updateEvaluation('growthPotential', value)}
                  />
                </div>
                <div className="criterion-card meta-card">
                  <div>
                    <strong className="criterion-title-with-icon">
                      <IconCoins size={18} stroke={1.8} />
                      Mérito para aumento
                    </strong>
                    <p>Nivel de mérito para defender ajuste salarial en este ciclo.</p>
                  </div>
                  <RatingField
                    compact
                    disabled={isSelectedPeriodClosed}
                    hideLabel
                    label="Mérito para aumento"
                    value={evaluation.promotionReadiness}
                    onChange={(value) => updateEvaluation('promotionReadiness', value)}
                  />
                </div>
              </div>

              <datalist id="evaluation-period-suggestions">
                {periodOptions.map((period) => (
                  <option key={period} value={period} />
                ))}
              </datalist>

              <div className="criteria-grid">
                {criteria.map((criterion) => (
                  <label className="criterion-card" key={criterion.key}>
                    <div>
                      <strong className="criterion-title-with-icon">
                        {(() => {
                          const CriterionIcon = criterionIcons[criterion.key];
                          return <CriterionIcon size={18} stroke={1.8} />;
                        })()}
                        {criterion.label}
                      </strong>
                      <p>{criterion.hint}</p>
                    </div>
                    <RatingField
                      disabled={isSelectedPeriodClosed}
                      hideLabel
                      value={evaluation[criterion.key]}
                      label={criterion.label}
                      onChange={(value) => updateEvaluation(criterion.key, value)}
                    />
                  </label>
                ))}
              </div>

              <div className="notes-grid">
                <NotesField
                  disabled={isSelectedPeriodClosed}
                  label="Fortalezas observables"
                  placeholder="Describe ejemplos concretos o usa viñetas opcionales."
                  rows={5}
                  value={evaluation.strengths}
                  onChange={(value) => updateEvaluation('strengths', value)}
                />
                <NotesField
                  disabled={isSelectedPeriodClosed}
                  label="Oportunidades de mejora"
                  placeholder="Anota brechas, patrones y acciones sugeridas."
                  rows={5}
                  value={evaluation.improvements}
                  onChange={(value) => updateEvaluation('improvements', value)}
                />
              </div>

              <NotesField
                disabled={isSelectedPeriodClosed}
                label="Notas para la conversación 1:1"
                placeholder="Prepara mensajes clave, temas sensibles y preguntas abiertas."
                rows={6}
                value={evaluation.managerNotes}
                onChange={(value) => updateEvaluation('managerNotes', value)}
              />

              <div className="action-row">
                <div className="history-box">
                  <span>{feedbackStage.label}</span>
                  <strong>
                    {storedEvaluation
                      ? `${selectedCollaborator?.name ?? 'Colaborador'} · ${storedEvaluation.period} · ${formatScore(storedEvaluation.score)}`
                      : `${selectedCollaborator?.name ?? 'Colaborador'} · ${selectedPeriod} · Sin guardar`}
                  </strong>
                </div>
                <div className="final-actions">
                  <button className="solid-button" disabled={saving || isSelectedPeriodClosed} type="submit">
                    {isSelectedPeriodClosed ? <IconLock size={18} stroke={1.8} /> : <IconArrowUpRight size={18} stroke={1.8} />}
                    {saving ? 'Guardando...' : isSelectedPeriodClosed ? 'Período cerrado' : storedEvaluation ? 'Actualizar evaluación' : 'Guardar evaluación'}
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <div className="empty-stage">
              <h3>Selecciona o crea un colaborador</h3>
              <p>Desde aquí podrás preparar el feedback, puntuar atributos y dejar listas tus notas para la conversación.</p>
            </div>
          )}
        </section>

        <aside className="panel panel-dark">
          <div className="panel-heading">
            <div>
              <p className="panel-label">Calibración</p>
              <h2 className="title-with-icon">
                <IconTrophy size={26} stroke={1.8} />
                Ranking del período
              </h2>
            </div>
            <button
              className="icon-button"
              onClick={() => handleFeedbackModeChange(true)}
              title="Abrir vista de presentación"
              type="button"
            >
              <IconPresentation size={18} stroke={1.8} />
            </button>
          </div>

          <div className="ranking-list">
            {ranking.map((row, index) => {
              const RankingScoreIcon = getScoreIcon(row.score);
              const rankingTheme = getScoreTheme(row.score);

              return (
                <article className="ranking-card" key={`${row.collaboratorId}-${row.period}`}>
                  <div className="ranking-rank" style={rankingTheme}>
                    <IconTrophy size={16} stroke={2} />
                    <span>#{index + 1}</span>
                  </div>
                  <div className="ranking-main">
                    <div className="ranking-content">
                      <strong>{row.collaboratorName}</strong>
                      <span>
                        {row.role} · {row.team}
                      </span>
                      <small>{row.managerSignal}</small>
                    </div>
                    <div className="ranking-score" style={rankingTheme}>
                      <strong className="score-value ranking-score-value" title={getCompensationCopy(row.compensationBand).description}>
                        <span className="score-icon-badge score-icon-badge-small">
                          <RankingScoreIcon size={20} stroke={2} />
                        </span>
                        {formatScore(row.score)}
                      </strong>
                      <span>{getCompensationCopy(row.compensationBand).label}</span>
                      <small>{row.meritPoints} pts</small>
                    </div>
                </div>
              </article>
              );
            })}
            {ranking.length === 0 ? (
              <p className="empty-state light">El ranking aparecerá cuando exista al menos una evaluación guardada para este período.</p>
            ) : null}
          </div>
        </aside>
      </main>

      {settingsOpen ? (
        <div className="settings-overlay" onClick={() => setSettingsOpen(false)} role="presentation">
          <aside className="settings-drawer" onClick={(event) => event.stopPropagation()}>
            <div className="settings-header">
              <div>
                <p className="panel-label">Ajustes</p>
                <h2>Respaldo y datos</h2>
                <p className="panel-caption">Administra importación y exportación del archivo compartible.</p>
              </div>
              <button className="icon-button" onClick={() => setSettingsOpen(false)} title="Cerrar ajustes" type="button">
                <IconX size={18} stroke={1.8} />
              </button>
            </div>

            <div className="settings-actions">
              <article className="settings-card">
                <div>
                  <h3 className="title-with-icon">
                    <IconFileImport size={20} stroke={1.8} />
                    Importar respaldo CSV
                  </h3>
                  <p>Reemplaza o actualiza colaboradores y evaluaciones desde un archivo exportado previamente.</p>
                </div>
                <button className="ghost-button" onClick={handleImport} type="button">
                  <IconFileImport size={18} stroke={1.8} />
                  Importar
                </button>
              </article>

              <article className="settings-card">
                <div>
                  <h3 className="title-with-icon">
                    <IconDeviceFloppy size={20} stroke={1.8} />
                    Exportar respaldo CSV
                  </h3>
                  <p>Genera un archivo compartible con colaboradores y evaluaciones para mover la base local o respaldarla.</p>
                </div>
                <button className="solid-button" onClick={handleExport} type="button">
                  <IconDeviceFloppy size={18} stroke={1.8} />
                  Exportar
                </button>
              </article>

              <article className="settings-card">
                <div>
                  <h3 className="title-with-icon">
                    <IconTrash size={20} stroke={1.8} />
                    Eliminar todos los datos
                  </h3>
                  <p>Vacía la base local de la app. Esta acción borra colaboradores, evaluaciones y cierres guardados en este dispositivo.</p>
                </div>
                <button className="danger-button" onClick={handleRequestClearData} type="button">
                  <IconTrash size={18} stroke={1.8} />
                  Eliminar datos
                </button>
              </article>
            </div>
          </aside>
        </div>
      ) : null}

      {closeDialogOpen ? (
        <div className="confirm-overlay" onClick={() => setCloseDialogOpen(false)} role="presentation">
          <div className="confirm-dialog" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
            <div className="confirm-dialog-copy">
              <p className="panel-label">Confirmación</p>
              <h3>Cerrar feedback del período {selectedPeriod}</h3>
              <p>
                Después de esto la evaluación quedará en solo lectura y ya no permitirá cambios.
              </p>
            </div>
            <div className="confirm-dialog-actions">
              <button className="ghost-button" onClick={() => setCloseDialogOpen(false)} type="button">
                Cancelar
              </button>
              <button className="danger-button" onClick={confirmClosePeriod} type="button">
                <IconLock size={18} stroke={1.8} />
                Confirmar cierre
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {discardDialogOpen ? (
        <div className="confirm-overlay" onClick={closeDiscardDialog} role="presentation">
          <div className="confirm-dialog" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
            <div className="confirm-dialog-copy">
              <p className="panel-label">Confirmación</p>
              <h3>Salir sin guardar cambios</h3>
              <p>Hay cambios sin guardar en este feedback.</p>
              <p>
                {discardDialogReason === 'window-close'
                  ? 'Si sales ahora, la ventana se cerrará y perderás las notas y cambios no guardados del período actual.'
                  : 'Si continúas, perderás las notas y cambios no guardados del período actual.'}
              </p>
            </div>
            <div className="confirm-dialog-actions">
              <button className="ghost-button" onClick={closeDiscardDialog} type="button">
                Cancelar
              </button>
              <button className="danger-button" onClick={() => void confirmDiscardDialog()} type="button">
                <IconX size={18} stroke={1.8} />
                Salir sin guardar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {clearDataDialogOpen ? (
        <div className="confirm-overlay" onClick={() => setClearDataDialogOpen(false)} role="presentation">
          <div className="confirm-dialog" onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true">
            <div className="confirm-dialog-copy">
              <p className="panel-label">Confirmación</p>
              <h3>Eliminar todos los datos locales</h3>
              <p>La información se eliminará definitivamente de esta aplicación y no se podrá recuperar desde este dispositivo.</p>
              <p>Se recomienda exportar un respaldo CSV antes de continuar.</p>
            </div>
            <div className="confirm-dialog-actions">
              <button className="ghost-button" onClick={() => setClearDataDialogOpen(false)} type="button">
                Cancelar
              </button>
              <button className="danger-button" onClick={() => void confirmClearData()} type="button">
                <IconTrash size={18} stroke={1.8} />
                Eliminar definitivamente
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}