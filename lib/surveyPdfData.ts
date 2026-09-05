/* ===================================================================
 * ETAPA 3D.3 (Parte G) — View-model PURO do PDF de Levantamento Técnico.
 * Colunas adaptadas por disciplina (§50), resumo executivo com números REAIS
 * (§46), seleção de evidências relevantes (§52) e conclusão factual (§55).
 * Sem I/O, sem IA. Testável isoladamente.
 * =================================================================== */
import { Device, AssetConditionValue } from './types';
import { TechArea, CONDITION_LABEL, assetDisplayIdentifier } from './technicalBase';

const attr = (d: Device, key: string): string => {
  const v = d.technicalAttributes?.[key];
  return v == null ? '' : String(v);
};

export interface PdfColumn { label: string; value: (d: Device) => string }

const typeCol: PdfColumn = { label: 'Tipo', value: (d) => d.tipoAtivo || d.tipoDispositivo || d.grupo || '—' };
const localCol: PdfColumn = { label: 'Local', value: (d) => d.localizacao || d.pavimento || '—' };
const condCol: PdfColumn = { label: 'Condição', value: (d) => (d.condicao ? CONDITION_LABEL[d.condicao] : '—') };

/** Colunas do PDF por disciplina (§50). */
export function pdfTableColumns(area: TechArea): PdfColumn[] {
  switch (area) {
    case 'SDAI': return [typeCol,
      { label: 'Laço', value: (d) => d.laco || '' },
      { label: 'Endereço', value: (d) => d.endereco || '' },
      { label: 'Descrição', value: (d) => attr(d, 'descricao_programada') },
      localCol, condCol];
    case 'CFTV': return [typeCol,
      { label: 'IP', value: (d) => attr(d, 'ip') },
      { label: 'Canal', value: (d) => attr(d, 'canal') },
      localCol, condCol];
    case 'ALARME': return [typeCol,
      { label: 'Zona', value: (d) => attr(d, 'zona') },
      { label: 'Partição', value: (d) => attr(d, 'particao') },
      localCol, condCol];
    case 'BMS': return [typeCol,
      { label: 'IP / ID', value: (d) => attr(d, 'ip') || attr(d, 'device_instance') || attr(d, 'modbus_id') },
      { label: 'Protocolo', value: (d) => attr(d, 'protocolo') },
      localCol, condCol];
    case 'CONTROLE_ACESSO': return [typeCol,
      { label: 'Controladora / Porta', value: (d) => [attr(d, 'controladora'), attr(d, 'porta')].filter(Boolean).join(' / ') },
      localCol, condCol];
    default: return [typeCol, localCol, condCol];
  }
}

/** Contagem por condição (para o resumo executivo, §46). */
export function conditionCounts(devices: Device[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const d of devices) { const k = d.condicao || 'NAO_INFORMADA'; m[k] = (m[k] || 0) + 1; }
  return m;
}

export const RELEVANT_CONDITIONS: AssetConditionValue[] = ['COM_AVARIA', 'INOPERANTE', 'INADEQUADO', 'NAO_LOCALIZADO'];

/** Ativos com ocorrência relevante (§52) — vão para o corpo/evidências. */
export function relevantAssets(devices: Device[]): Device[] {
  return devices.filter((d) => d.condicao && RELEVANT_CONDITIONS.includes(d.condicao));
}

/** Legenda curta de uma foto de ativo (§54). */
export function evidenceCaption(area: TechArea, d: Device): string {
  const ident = assetDisplayIdentifier(area, { central: d.central, laco: d.laco, endereco: d.endereco, technicalAttributes: d.technicalAttributes });
  const parts = [d.tipoAtivo || d.grupo || 'Ativo', ident, d.localizacao, d.condicao ? CONDITION_LABEL[d.condicao] : ''].filter(Boolean);
  return parts.join(' · ');
}

export interface SurveyResumoLine { label: string; value: string }

/**
 * Resumo executivo por modo. COMPLETO usa números da reconciliação; PONTUAL é
 * enxuto (§47); PARCIAL destaca o escopo (§48). Nunca declara 100% sem fechar (§40).
 */
export function surveyResumo(input: {
  mode: 'PONTUAL' | 'PARCIAL' | 'COMPLETO';
  devices: Device[];
  expected?: number;
  verified?: number;
  naoLocalizado?: number;
  novo?: number;
  alterado?: number;
  pendente?: number;
  coveragePct?: number | null;
  scopeText?: string;
}): SurveyResumoLine[] {
  const counts = conditionCounts(input.devices);
  const lines: SurveyResumoLine[] = [];
  if (input.mode === 'COMPLETO') {
    lines.push({ label: 'Ativos esperados', value: String(input.expected ?? input.devices.length) });
    lines.push({ label: 'Verificados', value: String(input.verified ?? 0) });
    if (input.naoLocalizado != null) lines.push({ label: 'Não localizados', value: String(input.naoLocalizado) });
    if (input.novo != null) lines.push({ label: 'Novos encontrados', value: String(input.novo) });
    if (input.alterado != null) lines.push({ label: 'Alterados', value: String(input.alterado) });
    if (input.pendente != null && input.pendente > 0) lines.push({ label: 'Pendentes de reconciliação', value: String(input.pendente) });
    lines.push({ label: 'Cobertura', value: input.coveragePct != null ? `${input.coveragePct}%` : '—' });
  } else if (input.mode === 'PARCIAL') {
    if (input.scopeText) lines.push({ label: 'Escopo', value: input.scopeText });
    lines.push({ label: 'Registrados no escopo', value: String(input.devices.length) });
    if (input.expected) lines.push({ label: 'Esperados no escopo', value: String(input.expected) });
    lines.push({ label: 'Cobertura do escopo', value: input.coveragePct != null ? `${input.coveragePct}%` : 'não determinada' });
  } else {
    if (input.scopeText) lines.push({ label: 'Objetivo', value: input.scopeText });
    lines.push({ label: 'Ativos registrados', value: String(input.devices.length) });
  }
  // Condições (comuns a todos os modos)
  for (const c of ['NORMAL', 'COM_AVARIA', 'INOPERANTE', 'INADEQUADO', 'NAO_TESTADO', 'NAO_LOCALIZADO'] as AssetConditionValue[]) {
    if (counts[c]) lines.push({ label: CONDITION_LABEL[c], value: String(counts[c]) });
  }
  return lines;
}

/** Conclusão factual, sem IA e sem afirmar conformidade normativa (§55). */
export function surveyConclusao(input: {
  mode: 'PONTUAL' | 'PARCIAL' | 'COMPLETO';
  total: number;
  verified?: number;
  pendente?: number;
  scopeText?: string;
}): string {
  const escopo = input.scopeText ? ` no escopo "${input.scopeText}"` : ' no escopo informado';
  if (input.mode === 'COMPLETO') {
    const base = `O levantamento registrou ${input.total} ativo(s)${escopo}, sendo ${input.verified ?? 0} verificado(s) em campo.`;
    return input.pendente && input.pendente > 0
      ? `${base} Permaneceram ${input.pendente} registro(s) pendente(s) de reconciliação — levantamento encerrado com pendências de cobertura.`
      : `${base} A reconciliação da base foi concluída.`;
  }
  if (input.mode === 'PARCIAL') {
    return `Levantamento parcial${escopo}: ${input.total} ativo(s) registrado(s). A cobertura refere-se somente ao escopo declarado.`;
  }
  return `Levantamento pontual: ${input.total} ativo(s) investigado(s)${input.scopeText ? ` (${input.scopeText})` : ''}. Registro restrito ao que foi observado na visita.`;
}
