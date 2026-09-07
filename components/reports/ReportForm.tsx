'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Client, UserRole, Pendencia, AcaoRecomendada, GeoPoint, Device, CicloAmostragem } from '@/lib/types';
import { getGeoPoint } from '@/lib/geo';
import {
  TemplateSchema,
  SectionSchema,
  FieldSchema,
  FormValues,
  RepeaterCard,
  isNegativeAnswer,
  isFieldVisibleForRole,
  validateFinalize,
  FinalizeIssue,
} from '@/lib/reportSchema';
import { isFieldVisible, isFieldRequired, isSectionVisible } from '@/lib/formConditions';
import { FormEngine, CatalogSources, type ResolveFieldOptions, type ResolveItemPatch } from '@/components/reports/FormEngine';
import { resolveSdaiFieldOptions, resolveSdaiItemPatch, seedLacoCards, SDAI_REPEATER_LACOS, type SdaiCentralContext } from '@/lib/sdaiChecklistResolver';
import { isSupabaseConfigured } from '@/lib/inventory';
import { getCapturedPhoto, getPhotoPreview, isPhotoId, registerPhoto, clearPhotoRegistry } from '@/lib/reportMedia';
import { getSignature, isSignatureId, clearSignatureRegistry } from '@/lib/signatures';
import {
  ReportBundle,
  BundleMedia,
  BundleSignature,
  BundleAnswer,
  MediaTipo,
  newClientUuid,
  offlineAvailable,
  isOnline,
  enqueueBundle,
  persistReportBundle,
  removeBundle,
} from '@/lib/offline/reportSync';

interface ReportFormProps {
  template: TemplateSchema;
  templateId?: string; // id no banco (report_templates) quando veio do DB
  cliente?: Client;
  catalog: CatalogSources;
  userRole: UserRole;
  currentUserName?: string;
  contexto?: { osId?: string; contratoId?: string };
  /** Experiência de campo: simplifica a orientação sem alterar regras/dados. */
  fieldMode?: 'rapido' | 'completo';
  /** Rótulo operacional local; não altera o tipo persistido do relatório. */
  attendanceTitle?: string;
  /** Inventário do cliente — semeia o checklist_dispositivos (Preventiva). */
  devices?: Device[];
  /** Base Técnica COMPLETA do cliente (SDAI) — resolve laço/endereço/device/bateria
   *  na cascata do checklist contratual. Diferente de `devices` (só planejados). */
  baseTecnicaDevices?: Device[];
  /** Pendências aprovadas do cliente — semeiam o checklist_pendencias (Corretiva). */
  pendenciasAprovadas?: { id: string; descricao?: string; grupo?: string }[];
  /** Ciclo de amostragem vigente (Preventiva) — atualiza cobertura ao finalizar. */
  ciclo?: CicloAmostragem;
  /** MANUTENÇÃO CONTRATUAL SDAI: quando presente e o template for
   *  PREVENTIVA_SDAI_CONTRATO, ao finalizar persiste device_verifications
   *  idempotentes + pendências (dedupe) via o motor de wiring. Ausente ou outro
   *  template → nenhuma mudança de comportamento. */
  maintenance?: {
    serviceAttendanceId: string;
    plan?: { programadosDeviceIds: string[] };
  };
  /** MANUTENÇÃO CONTRATUAL SDAI: contexto RESOLVIDO pela cadeia real
   *  (contrato → rotina → execução → OS → atendimento). Quando presente e o
   *  template for PREVENTIVA_SDAI_CONTRATO, a etapa "Identificação" é apresentada
   *  SOMENTE LEITURA (sem selects de contrato/periodicidade/pendências) — o
   *  técnico não escolhe o contrato de uma manutenção nascida de rotina. */
  maintenanceContext?: MaintenanceReportContext;
  /** Persistência do "Cadastrar novo…" dos comboboxes (ex.: marca -> brands). */
  onCreateCatalogo?: (origem: string, name: string) => void;
  onBack: () => void;
  onSaved: () => void;
  /** Baixa de estoque dos materiais aplicados ao finalizar (Corretiva). */
  onConsumeMaterials?: (
    materials: { nome: string; quantidade: number }[],
    contexto?: { numero?: string; clienteNome?: string }
  ) => void | Promise<void>;
}

interface PendenciaPreview {
  grupo?: string;
  descricao: string;
  local?: string;
  origem: string;
}

/** Central SDAI resolvida da Base Técnica (para a etapa 2/11 — read-only/seleção). */
export interface MaintenanceCentral {
  id: string;                 // device_id REAL da Base Técnica (valor do campo)
  label: string;              // rótulo humano (fabricante+modelo — localização)
  fabricante?: string;
  modelo?: string;
  tipoCentral?: string;       // Convencional/Endereçável/Híbrida
  identificador?: string;     // technicalIdentifier / nº central
  localizacao?: string;
  qtdLacos?: number;
  /** Checklist mensal já concluído para esta central no período (derivado). */
  checklistDone?: boolean;
  checklistDate?: string;
  checklistTecnico?: string;
}

/** Contexto documental resolvido do atendimento contratual SDAI (read-only). */
export interface MaintenanceReportContext {
  contratoRef: string;        // referência PÚBLICA (nunca contract.id)
  contratoEscopo?: string;    // escopo/contractType
  periodicidade: string;      // rótulo humano da rotina
  competencia?: string;       // YYYY-MM
  osNumero?: string;          // OS-AAAA-NNNN
  tecnico?: string;
  pendencias: { id: string; grupo?: string; descricao?: string; local?: string; criadaEm?: string; status?: string }[];
  /** Centrais SDAI da Base Técnica do cliente (canônicas). Vazio = nenhuma. */
  centrais: MaintenanceCentral[];
}

/** "Aberta há N dias" — a partir da data de origem (YYYY-MM-DD ou ISO). */
function abertaHaLabel(criadaEm?: string): string | null {
  if (!criadaEm) return null;
  const d = new Date(criadaEm);
  if (Number.isNaN(d.getTime())) return null;
  const dias = Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
  return dias === 0 ? 'Aberta hoje' : `Aberta há ${dias} dia${dias === 1 ? '' : 's'}`;
}
function fmtDataBR(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('pt-BR');
}

/**
 * Etapa "Identificação do atendimento" SOMENTE LEITURA para manutenção contratual
 * SDAI. Substitui os selects manuais (contrato/periodicidade/pendências) pelo
 * contexto já determinado pela cadeia de origem. Usa tokens theme-aware.
 */
const MaintenanceIdentityCard: React.FC<{ ctx: MaintenanceReportContext; clienteNome?: string }> = ({ ctx, clienteNome }) => {
  const Info = ({ label, value, hint, mono }: { label: string; value: string; hint?: string; mono?: boolean }) => (
    <div>
      <p className="text-[11px] font-semibold uppercase text-fg-secondary">{label}</p>
      <p className={`text-sm font-bold text-fg ${mono ? 'font-data-mono' : ''}`}>{value}</p>
      {hint && <p className="text-[11px] text-fg-secondary mt-0.5">{hint}</p>}
    </div>
  );
  return (
    <div className="bg-surface rounded-xl border border-border shadow-sm p-5">
      <div className="border-b border-border pb-3 mb-4">
        <h3 className="text-sm font-bold text-fg uppercase tracking-wide">Identificação do atendimento</h3>
        <p className="text-[11px] text-fg-secondary mt-1">
          Contexto resolvido automaticamente pela rotina contratual — somente leitura.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Info label="Contrato" value={ctx.contratoRef} hint={ctx.contratoEscopo} />
        <Info label="Periodicidade da rotina" value={ctx.periodicidade} />
        <Info label="Competência" value={ctx.competencia || '—'} mono />
        <Info label="Ordem de serviço" value={ctx.osNumero || '—'} mono />
        {clienteNome && <Info label="Cliente" value={clienteNome} />}
        {ctx.tecnico && <Info label="Técnico" value={ctx.tecnico} />}
      </div>
      <div className="mt-5">
        <p className="text-[11px] font-semibold uppercase text-fg-secondary">Pendências em aberto (somente leitura)</p>
        {ctx.pendencias.length === 0 ? (
          <p className="text-[11px] text-fg-muted italic mt-1.5">Nenhuma pendência em aberto para este contexto.</p>
        ) : (
          <div className="mt-2 space-y-2">
            {ctx.pendencias.map((p) => {
              const meta = [
                p.local,
                fmtDataBR(p.criadaEm) ? `Origem: ${fmtDataBR(p.criadaEm)}` : null,
                abertaHaLabel(p.criadaEm),
                p.status ? `Status: ${p.status}` : null,
              ].filter(Boolean).join(' · ');
              return (
                <div key={p.id} className="rounded-lg border border-amber-200 bg-amber-50/60 p-2.5">
                  {p.grupo && <p className="text-[10px] font-bold uppercase text-amber-800">{p.grupo}</p>}
                  <p className="text-[11px] font-semibold text-fg">{p.descricao || 'Pendência'}</p>
                  {meta && <p className="text-[10px] text-fg-secondary mt-0.5">{meta}</p>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const QUICK_DIAGNOSIS = ['Falha de alimentação', 'Falha de cabeamento', 'Mau contato', 'Bateria', 'Programação', 'Configuração', 'Dispositivo em alarme', 'Dispositivo em falha', 'Sujeira / manutenção', 'Infraestrutura', 'Não identificado'];
const QUICK_EXECUTION = ['Testado', 'Ajustado', 'Reprogramado', 'Reconfigurado', 'Substituído', 'Reparado', 'Limpo', 'Resetado', 'Refeito cabeamento', 'Religado', 'Sem intervenção'];

const QuickCorrectiveActions = ({ sectionKey, values, onChange }: { sectionKey: string; values: FormValues; onChange: (key: string, value: unknown) => void }) => {
  if (sectionKey === 'diagnostico') {
    const selected = String(values.causa || '');
    return <div className="mb-4 rounded-xl border border-indigo-100 bg-indigo-50 p-3"><p className="text-xs font-bold text-primary uppercase">O que foi encontrado?</p><div className="mt-2 grid grid-cols-2 gap-2">{QUICK_DIAGNOSIS.map((item) => <button key={item} type="button" onClick={() => onChange('causa', item)} className={`min-h-12 rounded-lg border px-2 text-left text-[11px] font-semibold ${selected === item ? 'border-primary bg-navy text-white' : 'border-border bg-surface text-fg-secondary'}`}>{item}</button>)}</div></div>;
  }
  if (sectionKey === 'servico_executado') {
    const cards = Array.isArray(values.intervencoes) ? values.intervencoes as RepeaterCard[] : [];
    const current = String(cards[0]?.acao_executada || '');
    const choose = (item: string) => {
      const first = cards[0] || { quantidade: 1 };
      onChange('intervencoes', [{ ...first, acao_executada: item }, ...cards.slice(1)]);
    };
    return <div className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50 p-3"><p className="text-xs font-bold text-emerald-800 uppercase">O que foi feito?</p><div className="mt-2 grid grid-cols-2 gap-2">{QUICK_EXECUTION.map((item) => <button key={item} type="button" onClick={() => choose(item)} className={`min-h-12 rounded-lg border px-2 text-left text-[11px] font-semibold ${current === item ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-border bg-surface text-fg-secondary'}`}>{item}</button>)}</div></div>;
  }
  if (sectionKey === 'testes') {
    const current = String(values.sistema_operante || '');
    const choices = [['Sim', '✓ Resolvido', 'border-emerald-600 bg-emerald-600'], ['Sim, com ressalvas', '⚠ Parcialmente resolvido', 'border-amber-500 bg-amber-500'], ['Não', '✕ Não resolvido', 'border-red-600 bg-red-600']];
    return <div className="mb-4"><p className="text-xs font-bold text-fg uppercase">Qual foi o resultado?</p><div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">{choices.map(([value, label, color]) => <button key={value} type="button" onClick={() => onChange('sistema_operante', value)} className={`min-h-14 rounded-xl border-2 px-3 text-left text-xs font-bold ${current === value ? `${color} text-white` : 'border-border bg-surface text-fg-secondary'}`}>{label}</button>)}</div></div>;
  }
  return null;
};

const firstDigit = (s: unknown): number | undefined => {
  const m = /(\d)/.exec(String(s ?? ''));
  return m ? Number(m[1]) : undefined;
};

function buildPendencias(
  template: TemplateSchema,
  values: FormValues,
  clienteId: string,
  itensCatalogo: string[]
): Pendencia[] {
  const out: Pendencia[] = [];
  for (const secao of template.secoes) {
    if (!isSectionVisible(secao, values)) continue;
    for (const field of secao.campos) {
      if (!isFieldVisible(field, values)) continue; // resposta oculta não gera pendência
      if (field.abre_pendencia_se && isNegativeAnswer(field, values[field.key] as never)) {
        const sug = field.pendencia_sugerida;
        out.push({
          id: '',
          status: 'aberta',
          clienteId: clienteId || undefined,
          grupo: sug?.grupo,
          descricao: sug?.descricao || `${field.label}: ${String(values[field.key])}`,
          acaoRecomendada: sug?.acao,
          normaReferencia: sug?.norma,
        });
      }
      if (field.tipo === 'repeater' && field.gera_pendencia) {
        const cards = Array.isArray(values[field.key]) ? (values[field.key] as RepeaterCard[]) : [];
        cards.forEach((c) => {
          if (!(c.descricao || c.grupo)) return;
          const item = (c.item as string) || '';
          const foraCatalogo = !!item && !itensCatalogo.includes(item);
          out.push({
            id: '',
            status: 'aberta',
            clienteId: clienteId || undefined,
            grupo: c.grupo as string | undefined,
            descricao: (c.descricao as string) || 'Apontamento',
            local: c.local as string | undefined,
            quantidade: typeof c.quantidade === 'number' ? c.quantidade : Number(c.quantidade) || 1,
            acaoRecomendada: c.acao_recomendada as AcaoRecomendada | undefined,
            itemCatalogoId: !foraCatalogo && item ? item : undefined,
            itemTextoLivre: foraCatalogo ? item : undefined,
            precisaCadastroCatalogo: foraCatalogo,
            criticidadeOperacional: firstDigit(c.criticidade_operacional),
          });
        });
      }
      // Checklist de dispositivos: respostas negativas por card (reprovado, fora
      // de norma, obstruído...) abrem pendência.
      if (field.tipo === 'checklist_dispositivos') {
        const cards = Array.isArray(values[field.key]) ? (values[field.key] as RepeaterCard[]) : [];
        const schema = field.card_schema || [];
        cards.forEach((c) => {
          schema.forEach((cf) => {
            if (cf.abre_pendencia_se && isNegativeAnswer(cf, c[cf.key] as never)) {
              out.push({
                id: '',
                status: 'aberta',
                clienteId: clienteId || undefined,
                grupo: 'SDAI > Dispositivo',
                descricao: `${(c.dispositivo as string) || 'Dispositivo'} — ${cf.label}: ${String(c[cf.key])}`,
                local: c.dispositivo as string | undefined,
                acaoRecomendada: 'investigar',
              });
            }
          });
        });
      }
    }
  }
  return out;
}

import { TriagemFotos, UnclassifiedPhoto } from '@/components/reports/TriagemFotos';
import { buildSurveyTemplate, surveyBlockSections, SurveyMode, SURVEY_BLOCKS_KEY, SURVEY_MODE_KEY } from '@/lib/surveyMode';
import { PREVENTIVA_SDAI_CONTRATO_CODIGO } from '@/lib/sdaiMaintenance';
import { reportDraftKey } from '@/lib/reportDraft';
import { finalizeMaintenanceAttendance, parseSdaiChecklistResults, type SdaiChecklistCard } from '@/lib/sdaiAttendanceWiring';

/**
 * Etapa "Central de SDAI" (2/11) — seleção canônica da central a partir da Base
 * Técnica (grupo 'Central SDAI'), NUNCA todos os devices. 0 → estado explícito;
 * 1 → auto-selecionada e read-only; N → seletor claro. Preserva o device_id real.
 * "Refazer" só aparece quando já há checklist mensal concluído no período (§9).
 */
const CentralPicker: React.FC<{
  centrais: MaintenanceCentral[];
  value?: string;
  onSelect: (deviceId: string) => void;
  refazer: boolean;
  onRefazer: (v: boolean) => void;
}> = ({ centrais, value, onSelect, refazer, onRefazer }) => {
  const box = 'bg-surface rounded-xl border border-border shadow-sm p-5';
  if (centrais.length === 0) {
    return (
      <div className={box}>
        <h3 className="text-sm font-bold text-fg uppercase tracking-wide">Central de SDAI</h3>
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
          <p className="text-[12px] font-semibold text-amber-800">Nenhuma Central SDAI cadastrada na Base Técnica deste cliente.</p>
          <p className="text-[11px] text-fg-secondary mt-1">
            O checklist mensal precisa estar associado a uma central canônica. Cadastre/identifique a central na Base Técnica — este relatório não cria o ativo.
          </p>
        </div>
      </div>
    );
  }
  const selected = centrais.find((c) => c.id === value);
  const Data = ({ label, value: v }: { label: string; value?: string | number }) => (
    <div>
      <p className="text-[10px] font-semibold uppercase text-fg-secondary">{label}</p>
      <p className="text-[13px] font-semibold text-fg">{v !== undefined && v !== '' && v !== null ? v : 'Não informado'}</p>
    </div>
  );
  return (
    <div className={box}>
      <div className="border-b border-border pb-3 mb-4">
        <h3 className="text-sm font-bold text-fg uppercase tracking-wide">Central de SDAI</h3>
        <p className="text-[11px] text-fg-secondary mt-1">
          {centrais.length === 1
            ? 'Central resolvida automaticamente pela Base Técnica — somente leitura.'
            : 'Selecione a central verificada (Base Técnica do cliente).'}
        </p>
      </div>

      {centrais.length > 1 && (
        <div className="mb-4 space-y-2">
          {centrais.map((c, i) => {
            const active = c.id === value;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelect(c.id)}
                className={`w-full text-left rounded-lg border p-3 transition-colors ${active ? 'border-primary bg-navy/5' : 'border-border hover:border-primary/50 hover:bg-surface-2'}`}
              >
                <span className="block text-[10px] font-bold uppercase text-fg-muted">Central {String(i + 1).padStart(2, '0')}</span>
                <span className="block text-[13px] font-bold text-fg">{c.label}</span>
                {(c.tipoCentral || c.identificador) && (
                  <span className="block text-[11px] text-fg-secondary">{[c.tipoCentral, c.identificador].filter(Boolean).join(' · ')}</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {selected ? (
        <>
          <p className="text-[11px] font-semibold uppercase text-fg-secondary mb-2">Central verificada</p>
          <div className="rounded-lg border border-border bg-surface-2/50 p-3">
            <p className="text-sm font-bold text-fg">{[selected.fabricante, selected.modelo].filter(Boolean).join(' ') || selected.label}</p>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Data label="Tipo" value={selected.tipoCentral} />
              <Data label="Identificação" value={selected.identificador} />
              <Data label="Localização" value={selected.localizacao} />
              <Data label="Laços instalados" value={selected.qtdLacos} />
            </div>
          </div>
          {selected.checklistDone && (
            <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50/70 p-3">
              <p className="text-[12px] font-semibold text-emerald-800">
                Checklist mensal concluído{selected.checklistDate ? ` em ${fmtDataBR(selected.checklistDate)}` : ''}{selected.checklistTecnico ? ` por ${selected.checklistTecnico}` : ''}.
              </p>
              <button
                type="button"
                onClick={() => onRefazer(!refazer)}
                className={`mt-2 px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase border ${refazer ? 'border-amber-500 bg-amber-500 text-white' : 'border-amber-400 text-amber-800 bg-transparent hover:bg-amber-50'}`}
              >
                {refazer ? '✓ Refazendo checklist' : 'Refazer checklist'}
              </button>
              {!refazer && <p className="text-[10px] text-fg-secondary mt-1.5">Já concluído neste período. Refaça apenas se houve intervenção/nova falha na central.</p>}
            </div>
          )}
        </>
      ) : (
        <p className="text-[11px] text-fg-muted italic">Selecione a central verificada acima.</p>
      )}
    </div>
  );
};

export const ReportForm: React.FC<ReportFormProps> = ({
  template: templateProp,
  templateId,
  cliente,
  catalog,
  userRole,
  currentUserName = '',
  contexto,
  fieldMode = 'completo',
  attendanceTitle,
  devices,
  pendenciasAprovadas,
  ciclo,
  maintenance,
  maintenanceContext,
  baseTecnicaDevices,
  onCreateCatalogo,
  onBack,
  onSaved,
  onConsumeMaterials,
}) => {
  const roleForEngine = userRole.toLowerCase();
  const isTecnico = userRole === 'TECNICO';

  // Chave do rascunho por CÓDIGO + cliente + identidade do contexto. Quando o
  // documento é executado dentro de um Atendimento, a identidade é o
  // serviceAttendanceId (1 OS pode ter N atendimentos → rascunhos independentes);
  // senão, fallback legado por OS/avulso.
  const rascunhoKey = reportDraftKey({
    codigo: templateProp.codigo,
    clienteId: cliente?.id,
    serviceAttendanceId: maintenance?.serviceAttendanceId,
    osId: contexto?.osId,
  });

  // CAMPO 2B — CONGELAMENTO no INÍCIO: se já existe rascunho com snapshot, o
  // atendimento continua PRESO àquela definição/versão (FASE 4/11); senão,
  // congela a versão vigente recebida. O sync/reload nunca troca de versão.
  const [frozen] = useState<{ template: TemplateSchema; version: number }>(() => {
    try {
      if (typeof window !== 'undefined') {
        const raw = window.localStorage.getItem(rascunhoKey);
        if (raw) {
          const s = JSON.parse(raw) as { templateSnapshot?: TemplateSchema; templateVersion?: number };
          if (s.templateSnapshot && Array.isArray(s.templateSnapshot.secoes)) {
            return { template: s.templateSnapshot, version: s.templateVersion ?? s.templateSnapshot.versao ?? 1 };
          }
        }
      }
    } catch { /* rascunho inválido: usa a versão vigente */ }
    return { template: templateProp, version: templateProp.versao ?? 1 };
  });
  const template = frozen.template;
  const templateVersion = frozen.version;

  // MANUTENÇÃO CONTRATUAL SDAI: quando o contexto resolvido chega, as etapas de
  // Identificação e Central de SDAI recebem apresentação/seleção canônica; os
  // selects manuais correspondentes NÃO são renderizados pelo FormEngine.
  const isSdaiContract = !!maintenanceContext && template.codigo === PREVENTIVA_SDAI_CONTRATO_CODIGO;

  const [values, setValues] = useState<FormValues>({});
  const [issues, setIssues] = useState<FinalizeIssue[] | null>(null);
  const [finalized, setFinalized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [persistErr, setPersistErr] = useState<string | null>(null);
  const [savedInfo, setSavedInfo] = useState<{ reportId: string; count: number } | null>(null);
  const [offlineSaved, setOfflineSaved] = useState(false);
  // Navegação em passos (uma seção por tela — modo campo).
  const [currentIdx, setCurrentIdx] = useState(0);
  const [modoCampo, setModoCampo] = useState<'rapido' | 'completo'>(fieldMode);
  const [pausado, setPausado] = useState(false);
  const [rascunhoRestaurado, setRascunhoRestaurado] = useState(false);
  const [iniciadoEm] = useState(() => Date.now());
  const [agora, setAgora] = useState(() => Date.now());

  // Rascunho local de respostas: permite sair/retomar o atendimento mesmo
  // antes da finalização. Mídias continuam sob gestão do registro de fotos e
  // do bundle offline, que só é consolidado ao finalizar.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(rascunhoKey);
      if (!raw) return;
      const saved = JSON.parse(raw) as { values?: FormValues; currentIdx?: number };
      if (saved.values) setValues((prev) => ({ ...saved.values, ...prev }));
      if (typeof saved.currentIdx === 'number') setCurrentIdx(saved.currentIdx);
      setRascunhoRestaurado(true);
    } catch { /* rascunho inválido não bloqueia o atendimento */ }
  // A chave representa um novo contexto de atendimento.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rascunhoKey]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Persiste também o snapshot/versão congelados, para o reopen manter a versão.
    try { window.localStorage.setItem(rascunhoKey, JSON.stringify({ values, currentIdx, templateSnapshot: template, templateVersion })); } catch { /* espaço/localStorage indisponível */ }
  }, [rascunhoKey, values, currentIdx, template, templateVersion]);

  useEffect(() => {
    if (modoCampo !== 'rapido' || pausado) return;
    const timer = window.setInterval(() => setAgora(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [modoCampo, pausado]);

  // Estado da bandeja de fotos não classificadas (Seção 3.1)
  const [unclassifiedPhotos, setUnclassifiedPhotos] = useState<UnclassifiedPhoto[]>([]);
  const [isTriagemOpen, setIsTriagemOpen] = useState(false);

  // Geolocalização de abertura (capturada ao montar; não bloqueia se negada)
  const [geoInicio, setGeoInicio] = useState<GeoPoint | null>(null);
  useEffect(() => {
    getGeoPoint().then(setGeoInicio);
  }, []);

  // Semeadura do checklist_dispositivos a partir do inventário do cliente.
  // Um card por dispositivo; ordenados pelo maior tempo sem teste funcional
  // (ultimoTesteFuncional ascendente) — prioridade de amostragem do ciclo.
  useEffect(() => {
    if (!devices || devices.length === 0) return;
    const field = template.secoes
      .flatMap((s) => s.campos)
      .find((f) => f.tipo === 'checklist_dispositivos');
    if (!field) return;
    setValues((prev) => {
      const atual = prev[field.key];
      if (Array.isArray(atual) && atual.length > 0) return prev; // já semeado
      const ordenados = [...devices].sort((a, b) =>
        (a.ultimoTesteFuncional || '').localeCompare(b.ultimoTesteFuncional || '')
      );
      const cards: RepeaterCard[] = ordenados.map((d) => ({
        device_id: d.id, // vínculo oculto p/ registrar o teste funcional no fecho
        dispositivo: `${d.tipoDispositivo || 'Dispositivo'} · ${[d.central, d.laco, d.endereco]
          .filter(Boolean)
          .join('/')}`,
      }));
      return { ...prev, [field.key]: cards };
    });
  }, [devices, template]);

  // Semeadura do checklist_pendencias a partir das pendências aprovadas (Corretiva).
  // Um card por pendência aprovada; o técnico marca a situação de cada uma.
  useEffect(() => {
    if (!pendenciasAprovadas || pendenciasAprovadas.length === 0) return;
    const field = template.secoes
      .flatMap((s) => s.campos)
      .find((f) => f.tipo === 'checklist_pendencias');
    if (!field) return;
    setValues((prev) => {
      const atual = prev[field.key];
      if (Array.isArray(atual) && atual.length > 0) return prev; // já semeado
      const cards: RepeaterCard[] = pendenciasAprovadas.map((p) => ({
        pendencia_id: p.id, // vínculo oculto p/ atualizar o status no fecho
        pendencia: `${p.grupo ? p.grupo + ': ' : ''}${p.descricao || 'Pendência'}`,
      }));
      return { ...prev, [field.key]: cards };
    });
  }, [pendenciasAprovadas, template]);

  // Prefill READ-ONLY da identificação (manutenção contratual SDAI): grava a
  // periodicidade e a referência PÚBLICA do contrato nas respostas para que o
  // relatório persista o contexto, sem que o técnico precise (ou possa) escolher.
  useEffect(() => {
    if (!isSdaiContract || !maintenanceContext) return;
    setValues((prev) => {
      const next = { ...prev };
      let changed = false;
      if ((next.periodicidade === undefined || next.periodicidade === '') && maintenanceContext.periodicidade && maintenanceContext.periodicidade !== '—') {
        next.periodicidade = maintenanceContext.periodicidade; changed = true;
      }
      if ((next.contrato_id === undefined || next.contrato_id === '') && maintenanceContext.contratoRef) {
        next.contrato_id = maintenanceContext.contratoRef; changed = true;
      }
      return changed ? next : prev;
    });
  }, [isSdaiContract, maintenanceContext]);

  // Auto-seleção da central quando o cliente tem UMA única Central SDAI (§3):
  // determinístico, o técnico não precisa escolher. Preserva o device_id real.
  useEffect(() => {
    if (!isSdaiContract || !maintenanceContext) return;
    const centrais = maintenanceContext.centrais;
    if (centrais.length !== 1) return;
    setValues((prev) => (prev.central_device_id ? prev : { ...prev, central_device_id: centrais[0].id }));
  }, [isSdaiContract, maintenanceContext]);

  // Contexto da cascata SDAI (central selecionada + Base Técnica). O FormEngine
  // recebe apenas resoluções genéricas; o domínio (laço/endereço/device/bateria)
  // vive no adapter sdaiChecklistResolver.
  const sdaiCtx = useMemo<SdaiCentralContext>(() => {
    const devs = baseTecnicaDevices || [];
    const centralId = typeof values.central_device_id === 'string' ? values.central_device_id : undefined;
    return { central: devs.find((d) => d.id === centralId), devices: devs };
  }, [baseTecnicaDevices, values.central_device_id]);

  const resolveFieldOptions = useMemo<ResolveFieldOptions | undefined>(() => {
    if (!isSdaiContract) return undefined;
    return ({ field, repeaterKey, itemValues }) => resolveSdaiFieldOptions(
      sdaiCtx, repeaterKey,
      { key: field.key, tipo: field.tipo, opcoes: field.opcoes, abre_pendencia_se: field.abre_pendencia_se },
      itemValues as Record<string, unknown> | undefined,
    );
  }, [isSdaiContract, sdaiCtx]);

  const resolveItemPatch = useMemo<ResolveItemPatch | undefined>(() => {
    if (!isSdaiContract) return undefined;
    return ({ field, newValue, repeaterKey, itemValues }) => resolveSdaiItemPatch(sdaiCtx, repeaterKey, field.key, newValue, itemValues as Record<string, unknown> | undefined);
  }, [isSdaiContract, sdaiCtx]);

  // Quantidade de falhas → N cards (§19). Aumentar cria cards vazios; REDUZIR
  // NÃO apaga (preserva dados até remoção manual pelo técnico).
  useEffect(() => {
    if (!isSdaiContract) return;
    const n = Number(values.falhas_qtd);
    if (!Number.isFinite(n) || n <= 0) return;
    setValues((prev) => {
      const cards = Array.isArray(prev.falhas) ? (prev.falhas as RepeaterCard[]) : [];
      if (cards.length >= n) return prev;
      const blanks = Array.from({ length: n - cards.length }, () => ({} as RepeaterCard));
      return { ...prev, falhas: [...cards, ...blanks] };
    });
  }, [isSdaiContract, values.falhas_qtd]);

  // Semeia o repeater de laços (medição) com um card por laço REAL da central (§17).
  useEffect(() => {
    if (!isSdaiContract || !sdaiCtx.central) return;
    const seeds = seedLacoCards(sdaiCtx);
    if (seeds.length === 0) return;
    setValues((prev) => {
      const atual = prev[SDAI_REPEATER_LACOS];
      if (Array.isArray(atual) && atual.length > 0) return prev; // já semeado/editado
      return { ...prev, [SDAI_REPEATER_LACOS]: seeds };
    });
  }, [isSdaiContract, sdaiCtx]);

  // Chaves suprimidas do FormEngine por seção (apresentadas fora dele, read-only):
  // identificação (contrato/periodicidade/pendências) e central (seleção canônica).
  // "refazer" só entra quando já há checklist concluído no período para a central.
  const suppressedKeysFor = (section?: SectionSchema): Set<string> | null => {
    if (!isSdaiContract || !section) return null;
    if (section.key === 'identificacao') return new Set(['periodicidade', 'contrato_id', 'pendencias_abertas_ref']);
    if (section.key === 'central') {
      const keys = new Set(['central_device_id']);
      const sel = maintenanceContext?.centrais.find((c) => c.id === values.central_device_id);
      if (!sel?.checklistDone) keys.add('refazer_checklist_central');
      return keys;
    }
    return null;
  };

  // Navegação em passos (uma seção por tela — modo campo, Partes 4.7/8)
  const [showPend, setShowPend] = useState(false);
  const [sectionErr, setSectionErr] = useState<string | null>(null);
  const camInputRef = React.useRef<HTMLInputElement>(null);

  // CORREÇÃO pós-3D.5: o Levantamento Técnico OPERACIONAL é o motor 3D
  // (Cliente 360 → Base Técnica → TechnicalSurveyFlow). Este ReportForm é o fluxo
  // COMERCIAL "Visita para Orçamento": não expõe mais Pontual/Parcial/Completo
  // (herança do surveyMode legado). Novos relatórios entram como 'completo'
  // (template integral); rascunhos ANTIGOS com modo salvo continuam abrindo no
  // modo gravado (compatibilidade), sem oferecer o seletor.
  const storedSurveyMode = values[SURVEY_MODE_KEY] as SurveyMode | undefined;
  const isLegacySurveyDraft = storedSurveyMode === 'pontual' || storedSurveyMode === 'parcial';
  const surveyMode = template.tipo === 'LEVANTAMENTO' ? (storedSurveyMode || 'completo') : undefined;
  const selectedSurveyBlocks = useMemo(
    () => Array.isArray(values[SURVEY_BLOCKS_KEY]) ? values[SURVEY_BLOCKS_KEY] as string[] : [],
    [values]
  );
  const effectiveTemplate = useMemo(
    () => template.tipo === 'LEVANTAMENTO' && surveyMode
      ? buildSurveyTemplate(template, surveyMode, selectedSurveyBlocks)
      : template,
    [template, surveyMode, selectedSurveyBlocks]
  );

  // Seções visíveis (modo + pula_se legado + show_if/hide_if) — mesmo evaluator
  // da renderização e da validação.
  const visibleSections = useMemo(
    () => effectiveTemplate.secoes.filter((s) => isSectionVisible(s, values)),
    [effectiveTemplate, values]
  );
  const idx = Math.min(currentIdx, Math.max(0, visibleSections.length - 1));
  const currentSection = visibleSections[idx];
  // Na manutenção contratual SDAI, os campos canônicos (identificação e central)
  // são apresentados read-only/seleção fora do FormEngine — removê-los do passo
  // evita renderizar selects manuais e um card de seção vazio.
  const stepSuppressed = suppressedKeysFor(currentSection);
  const stepSection = currentSection && stepSuppressed
    ? { ...currentSection, campos: currentSection.campos.filter((f) => !stepSuppressed.has(f.key)) }
    : currentSection;
  const stepTemplate = { ...effectiveTemplate, secoes: stepSection ? [stepSection] : [] };
  const showIdentityCard = isSdaiContract && currentSection?.key === 'identificacao';
  const showCentralPicker = isSdaiContract && currentSection?.key === 'central';
  const isLast = idx >= visibleSections.length - 1;
  const etapaRapida: Record<string, string> = {
    chamado: 'Chamado', diagnostico: 'Diagnóstico', servico_executado: 'Execução', materiais: 'Execução',
    testes: 'Resultado', pendencias_residuais: 'Fotos', encerramento: 'Finalizar',
  };
  const etapaPreventiva: Record<string, string> = { identificacao: 'Preparação', central: 'Central', dispositivos: 'Próximo dispositivo', sinalizacao: 'Sinalização', infraestrutura: 'Infraestrutura', pendencias: 'Pendências', encerramento: 'Finalizar' };
  const etapaLevantamento: Record<string, string> = { identificacao: 'Ambiente', inventario: 'Equipamento', sistema: 'Condição', apontamentos: 'Registro', encerramento: 'Finalizar' };
  const tituloOperacional = modoCampo === 'rapido' && template.tipo === 'CORRETIVA'
    ? (etapaRapida[currentSection?.key || ''] || currentSection?.titulo || 'Atendimento')
    : modoCampo === 'rapido' && template.tipo === 'PREVENTIVA'
      ? (etapaPreventiva[currentSection?.key || ''] || currentSection?.titulo || 'Preventiva')
      : modoCampo === 'rapido' && template.tipo === 'LEVANTAMENTO'
        ? (etapaLevantamento[currentSection?.key || ''] || currentSection?.titulo || 'Levantamento')
      : currentSection?.titulo || 'Relatório';
  const duracao = Math.max(0, Math.floor((agora - iniciadoEm) / 1000));
  const cronometro = `${String(Math.floor(duracao / 3600)).padStart(2, '0')}:${String(Math.floor((duracao % 3600) / 60)).padStart(2, '0')}`;
  const dispositivoField = template.secoes.flatMap((s) => s.campos).find((f) => f.tipo === 'checklist_dispositivos');
  const cardsDispositivos = dispositivoField && Array.isArray(values[dispositivoField.key]) ? values[dispositivoField.key] as RepeaterCard[] : [];
  const dispositivosTestados = cardsDispositivos.filter((card) => ['Aprovado', 'Reprovado'].includes(String(card.teste_funcional))).length;

  const goPrev = () => {
    setSectionErr(null);
    setCurrentIdx(Math.max(0, idx - 1));
  };
  const goNext = () => {
    // Bloqueia avanço com obrigatório faltando na seção atual (sem modal).
    // Campo oculto por condição NÃO bloqueia; obrigatoriedade é condicional.
    const suppressed = suppressedKeysFor(currentSection);
    const faltando = (currentSection?.campos || []).find((f) => {
      if (suppressed?.has(f.key)) return false; // apresentado read-only fora do FormEngine
      if (!isFieldVisible(f, values)) return false;
      if (!isFieldRequired(f, values)) return false;
      const v = values[f.key];
      if (f.tipo === 'foto') return !hasPhoto(f.key);
      return v === undefined || v === null || v === '';
    });
    if (faltando) {
      setSectionErr(`Preencha: ${faltando.label || faltando.key}`);
      return;
    }
    // Fotos são obrigatórias para avançar (pedido do usuário): não deixa passar
    // para a próxima etapa sem postar a evidência, evitando perder o trabalho.
    const faltaFoto = missingPhotoInSection(currentSection);
    if (faltaFoto) {
      setSectionErr(`Adicione a foto antes de avançar: ${faltaFoto}`);
      return;
    }
    setSectionErr(null);
    setCurrentIdx(Math.min(visibleSections.length - 1, idx + 1));
  };

  // Primeiro campo de foto ainda vazio na seção: campo de foto no topo da seção
  // ou dentro de um card de repeater já iniciado (apontamentos, intervenções,
  // dispositivos). Retorna o rótulo do pendente, ou null se está tudo postado.
  const missingPhotoInSection = (section?: SectionSchema): string | null => {
    if (!section) return null;
    const cardStarted = (schema: FieldSchema[], card: RepeaterCard) =>
      schema.some((cf) => {
        if (cf.tipo === 'foto') return false;
        const v = card[cf.key];
        if (v === undefined || v === null || v === '') return false;
        if (Array.isArray(v) && v.length === 0) return false;
        return true;
      });
    const cardFotoOk = (card: RepeaterCard, key: string) => {
      const v = card[key];
      return Array.isArray(v) ? v.length > 0 : !!v;
    };
    for (const f of section.campos) {
      if (!isFieldVisibleForRole(f, roleForEngine)) continue;
      if (!isFieldVisible(f, values)) continue; // campo oculto não exige foto
      if (f.tipo === 'foto') {
        // Foto oculta/condicional só é exigida quando o campo está obrigatório.
        if (isFieldRequired(f, values) && !hasPhoto(f.key)) return f.label || f.key;
        continue;
      }
      // Só os repeaters de itens adicionados pelo técnico (apontamentos,
      // dispositivos, intervenções). Os checklists auto-semeados (preventiva/
      // corretiva) não entram — a foto ali é condicional, não bloqueante.
      if (f.tipo !== 'repeater') continue;
      const schema = f.card_schema || [];
      const fotoFields = schema.filter((cf) => cf.tipo === 'foto');
      if (fotoFields.length === 0) continue;
      const cards = Array.isArray(values[f.key]) ? (values[f.key] as RepeaterCard[]) : [];
      for (let i = 0; i < cards.length; i++) {
        if (!cardStarted(schema, cards[i])) continue; // card em branco não bloqueia
        const faltando = fotoFields.find((cf) => !cardFotoOk(cards[i], cf.key));
        if (faltando) return `${f.label || f.key} #${i + 1} — ${faltando.label || 'Foto'}`;
      }
    }
    return null;
  };

  const onCamFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file) => handleFastPhotoCaptured(registerPhoto(file)));
    e.target.value = '';
  };

  const handleChange = (key: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setIssues(null);
    setFinalized(false);
    setSavedInfo(null);
    setPersistErr(null);
  };

  const handleFastPhotoCaptured = (photoId: string) => {
    const newPhoto: UnclassifiedPhoto = {
      id: photoId, // ID do registro transitório (aponta para o arquivo real)
      url: getPhotoPreview(photoId) || '',
      timestamp: new Date().toLocaleTimeString('pt-BR', { hour12: false }),
    };
    setUnclassifiedPhotos((prev) => [newPhoto, ...prev]);
  };

  const handleUpdatePhotoNota = (id: string, nota: string) => {
    setUnclassifiedPhotos((prev) =>
      prev.map((p) => (p.id === id ? { ...p, notaRapida: nota } : p))
    );
  };

  const handleDeletePhoto = (id: string) => {
    setUnclassifiedPhotos((prev) => prev.filter((p) => p.id !== id));
  };

  const handleAssignPhotosToApontamento = (
    photoIds: string[],
    grupo?: string,
    local?: string,
    descricao?: string
  ) => {
    const selected = unclassifiedPhotos.filter((p) => photoIds.includes(p.id));
    if (selected.length === 0) return;

    const notas = selected.map((s) => s.notaRapida).filter(Boolean).join('; ');
    const descFinal = descricao || notas || 'Apontamento capturado em campo';

    const currentCards = (values['apontamentos'] as RepeaterCard[]) || [];
    const newCard: RepeaterCard = {
      grupo: grupo || 'Geral',
      local: local || 'Não especificado',
      quantidade: 1,
      descricao: descFinal,
      acao_recomendada: 'investigar',
      foto: selected.map((s) => s.id), // IDs de foto (viram storage_path na finalização)
    };

    handleChange('apontamentos', [...currentCards, newCard]);
    setUnclassifiedPhotos((prev) => prev.filter((p) => !photoIds.includes(p.id)));
  };

  const pendenciasPreview = useMemo<PendenciaPreview[]>(() => {
    const list: PendenciaPreview[] = [];
    for (const secao of effectiveTemplate.secoes) {
      if (!isSectionVisible(secao, values)) continue;
      for (const field of secao.campos) {
        if (!isFieldVisible(field, values)) continue;
        if (field.abre_pendencia_se && isNegativeAnswer(field, values[field.key] as never)) {
          list.push({
            grupo: field.pendencia_sugerida?.grupo,
            descricao: field.pendencia_sugerida?.descricao || `${field.label}: ${String(values[field.key])}`,
            origem: secao.titulo,
          });
        }
        if (field.tipo === 'repeater' && field.gera_pendencia) {
          const cards = Array.isArray(values[field.key]) ? (values[field.key] as RepeaterCard[]) : [];
          cards.forEach((c) => {
            if (c.descricao || c.grupo) {
              list.push({
                grupo: c.grupo as string | undefined,
                descricao: (c.descricao as string) || 'Apontamento',
                local: c.local as string | undefined,
                origem: secao.titulo,
              });
            }
          });
        }
        if (field.tipo === 'checklist_dispositivos') {
          const cards = Array.isArray(values[field.key]) ? (values[field.key] as RepeaterCard[]) : [];
          const schema = field.card_schema || [];
          cards.forEach((c) => {
            schema.forEach((cf) => {
              if (cf.abre_pendencia_se && isNegativeAnswer(cf, c[cf.key] as never)) {
                list.push({
                  grupo: 'SDAI > Dispositivo',
                  descricao: `${(c.dispositivo as string) || 'Dispositivo'} — ${cf.label}: ${String(c[cf.key])}`,
                  local: c.dispositivo as string | undefined,
                  origem: secao.titulo,
                });
              }
            });
          });
        }
      }
    }
    return list;
  }, [effectiveTemplate, values]);

  const surveySummary = useMemo(() => {
    const countCards = (key: string) => Array.isArray(values[key]) ? (values[key] as RepeaterCard[]).length : 0;
    const evidenceIds = new Set<string>();
    const visit = (value: unknown) => {
      if (typeof value === 'string' && isPhotoId(value)) evidenceIds.add(value);
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') Object.values(value as Record<string, unknown>).forEach(visit);
    };
    Object.values(values).forEach(visit);
    unclassifiedPhotos.forEach((photo) => evidenceIds.add(photo.id));
    return {
      evidencias: evidenceIds.size,
      constatacoes: Array.isArray(values.constatacoes_pontuais) ? values.constatacoes_pontuais.length : 0,
      pendencias: pendenciasPreview.length,
      materiais: countCards('materiais_necessarios'),
      servicos: countCards('servicos_necessarios'),
      medicoes: countCards('medicoes'),
      naoVerificado: String(values.verificacao_pontual || '').includes('Não verificado') ? 1 : 0,
    };
  }, [values, unclassifiedPhotos, pendenciasPreview]);

  const hasPhoto = (fieldKey: string, cardIndex?: number): boolean => {
    if (cardIndex !== undefined) {
      const cards = Array.isArray(values[fieldKey]) ? (values[fieldKey] as RepeaterCard[]) : [];
      const foto = cards[cardIndex]?.foto;
      return Array.isArray(foto) ? foto.length > 0 : !!foto;
    }
    const val = values[fieldKey];
    return Array.isArray(val) ? val.length > 0 : !!val;
  };


  // Monta o "bundle" auto-contido da finalização (dados + blobs), pronto para
  // ser gravado offline no IndexedDB e replicado no Supabase (Parte 4.1).
  const buildBundle = async (): Promise<ReportBundle> => {
    // fotos referenciadas nas respostas + na bandeja de triagem
    const photoIds = new Set<string>();
    const collect = (v: unknown) => {
      if (!Array.isArray(v)) return;
      v.forEach((item) => {
        if (typeof item === 'string' && isPhotoId(item)) photoIds.add(item);
        else if (item && typeof item === 'object') {
          Object.values(item as Record<string, unknown>).forEach((val) => {
            if (Array.isArray(val)) val.forEach((x) => { if (typeof x === 'string' && isPhotoId(x)) photoIds.add(x); });
          });
        }
      });
    };
    for (const secao of effectiveTemplate.secoes) for (const field of secao.campos) collect(values[field.key]);
    unclassifiedPhotos.forEach((p) => { if (isPhotoId(p.id)) photoIds.add(p.id); });

    const media: BundleMedia[] = [];
    for (const id of photoIds) {
      const cap = getCapturedPhoto(id);
      if (!cap) continue;
      const naBandeja = unclassifiedPhotos.some((p) => p.id === id);
      const tipo = (cap.tipo || (naBandeja ? 'geral' : 'evidencia')) as MediaTipo;
      media.push({
        photoId: id,
        tipo,
        blob: cap.blob,
        markedBlob: cap.markedBlob,
        notaRapida: unclassifiedPhotos.find((p) => p.id === id)?.notaRapida,
        geo: geoInicio || undefined,
      });
    }

    const signatures: BundleSignature[] = [];
    for (const secao of effectiveTemplate.secoes)
      for (const field of secao.campos) {
        if (field.tipo !== 'assinatura') continue;
        const v = values[field.key];
        if (typeof v !== 'string' || !isSignatureId(v)) continue;
        const sig = getSignature(v);
        if (!sig) continue;
        signatures.push({
          sigId: v,
          papel: sig.papel,
          nome: sig.nome,
          documento: sig.documento,
          cargo: sig.cargo,
          blob: sig.blob,
          geo: geoInicio || undefined,
        });
      }

    const answers: BundleAnswer[] = [];
    for (const secao of effectiveTemplate.secoes)
      for (const field of secao.campos) {
        const v = values[field.key];
        if (v === undefined) continue;
        answers.push({ secao: secao.key, fieldKey: field.key, valor: v });
      }

    if (surveyMode) {
      answers.push({ secao: 'modo_levantamento', fieldKey: SURVEY_MODE_KEY, valor: surveyMode });
      if (surveyMode === 'parcial') answers.push({ secao: 'modo_levantamento', fieldKey: SURVEY_BLOCKS_KEY, valor: selectedSurveyBlocks });
    }

    const pends = buildPendencias(effectiveTemplate, values, cliente?.id || '', catalog.itens);
    const geoFim = await getGeoPoint();

    // amostragem: dispositivos efetivamente testados (Aprovado/Reprovado)
    let deviceTests: ReportBundle['deviceTests'];
    let cicloInfo: ReportBundle['ciclo'];
    const checklist = template.secoes.flatMap((s) => s.campos).find((f) => f.tipo === 'checklist_dispositivos');
    if (checklist) {
      const cards = Array.isArray(values[checklist.key]) ? (values[checklist.key] as RepeaterCard[]) : [];
      const testadosIds = cards
        .filter((c) => ['Aprovado', 'Reprovado'].includes(String(c.teste_funcional)))
        .map((c) => String(c.device_id || ''))
        .filter(Boolean);
      if (testadosIds.length > 0) {
        deviceTests = { ids: testadosIds, dataISO: new Date().toISOString().slice(0, 10), cicloId: ciclo?.id };
        if (ciclo) cicloInfo = { novos: testadosIds.length };
      }
    }

    // Corretiva: pendências marcadas 'Corrigida' no checklist são resolvidas.
    let pendenciaUpdates: ReportBundle['pendenciaUpdates'];
    const checkPend = template.secoes.flatMap((s) => s.campos).find((f) => f.tipo === 'checklist_pendencias');
    if (checkPend) {
      const cards = Array.isArray(values[checkPend.key]) ? (values[checkPend.key] as RepeaterCard[]) : [];
      const corrigidas = cards
        .filter((c) => String(c.situacao) === 'Corrigida' && c.pendencia_id)
        .map((c) => ({ id: String(c.pendencia_id), status: 'corrigida' as const }));
      if (corrigidas.length > 0) pendenciaUpdates = corrigidas;
    }

    const prefix = template.tipo === 'LEVANTAMENTO' ? 'LEV' : template.tipo === 'CORRETIVA' ? 'COR' : 'PRE';
    const numero = `${prefix}-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`;

    return {
      clientUuid: newClientUuid(),
      createdAt: new Date().toISOString(),
      draftKey: rascunhoKey,
      report: {
        templateId,
        templateCodigo: template.codigo,
        numero,
        tipo: template.tipo,
        clienteId: cliente?.id || undefined,
        clienteNome: cliente?.name,
        osId: contexto?.osId,
        contratoId: contexto?.contratoId,
        serviceAttendanceId: maintenance?.serviceAttendanceId,
        tecnicoNome: currentUserName || undefined,
        titulo: `${template.nome} — ${cliente?.name || ''}`.trim(),
        geoInicio: geoInicio || undefined,
        // Definição CONGELADA no início (snapshot imutável + versão) — CAMPO 2B.
        templateSnapshot: template,
        templateVersion,
      },
      answers,
      pendencias: pends,
      media,
      signatures,
      geoFim: geoFim || undefined,
      os: contexto?.osId ? { id: contexto.osId } : undefined,
      deviceTests,
      pendenciaUpdates,
      ciclo: cicloInfo,
      pendCount: pends.length,
    };
  };

  // Materiais aplicados que devem baixar do estoque ao finalizar. Prefere a
  // seção "Materiais Aplicados" (materiais_aplicados); se o template não tiver,
  // usa as "Intervenções" (item + quantidade). Levantamento/Preventiva não
  // consomem materiais, então normalmente retorna vazio.
  const collectConsumedMaterials = (): { nome: string; quantidade: number }[] => {
    const campos = template.secoes.flatMap((s) => s.campos);
    const key = campos.some((f) => f.key === 'materiais_aplicados')
      ? 'materiais_aplicados'
      : campos.some((f) => f.key === 'intervencoes')
      ? 'intervencoes'
      : null;
    if (!key) return [];
    const cards = Array.isArray(values[key]) ? (values[key] as RepeaterCard[]) : [];
    const out: { nome: string; quantidade: number }[] = [];
    for (const c of cards) {
      const nome = String(c.item ?? '').trim();
      if (!nome) continue;
      out.push({ nome, quantidade: Number(c.quantidade) || 1 });
    }
    return out;
  };

  const handleFinalize = async () => {
    if (template.tipo === 'LEVANTAMENTO' && !surveyMode) {
      setIssues([{ secao: 'Modo do levantamento', campo: 'Tipo', motivo: 'Escolha Pontual, Parcial ou Completo.' }]);
      return;
    }
    if (surveyMode === 'parcial' && selectedSurveyBlocks.length === 0) {
      setIssues([{ secao: 'Modo do levantamento', campo: 'Blocos', motivo: 'Escolha ao menos um bloco para o levantamento parcial.' }]);
      return;
    }
    const found = validateFinalize(effectiveTemplate, values, hasPhoto);
    setIssues(found);
    setPersistErr(null);
    setSavedInfo(null);
    if (found.length > 0) {
      setFinalized(false);
      return;
    }
    if (!isSupabaseConfigured()) {
      setFinalized(true);
      try { window.localStorage.removeItem(rascunhoKey); } catch { /* noop */ }
      onConsumeMaterials?.(collectConsumedMaterials(), { clienteNome: cliente?.name });
      return;
    }
    setSaving(true);
    try {
      // Offline-first: monta o bundle (dados + blobs) e grava no IndexedDB ANTES
      // de tocar a rede — nada se perde se o app cair ou o sinal sumir.
      const bundle = await buildBundle();

      let syncedNow = false;
      if (offlineAvailable()) {
        await enqueueBundle(bundle);
        if (isOnline()) {
          try {
            await persistReportBundle(bundle);
            await removeBundle(bundle.clientUuid);
            syncedNow = true;
          } catch (e) {
            // fica na fila offline; o worker reenvia quando a rede voltar
            console.warn('Sincronização adiada — relatório guardado no aparelho:', e);
          }
        }
      } else {
        // Sem IndexedDB (navegador antigo): exige rede, caminho direto.
        await persistReportBundle(bundle);
        syncedNow = true;
      }

      // fotos/assinaturas já estão no bundle durável — libera a memória da sessão
      clearPhotoRegistry();
      clearSignatureRegistry();

      setOfflineSaved(!syncedNow);
      setSavedInfo({ reportId: syncedNow ? '' : bundle.clientUuid, count: bundle.pendCount });
      setFinalized(true);
      if (syncedNow) {
        try { window.localStorage.removeItem(rascunhoKey); } catch { /* noop */ }
      }
      onSaved();
      // MANUTENÇÃO CONTRATUAL SDAI (gated pelo código): persiste device_verifications
      // idempotentes + pendências (dedupe) via o motor de wiring. NÃO afeta outros
      // templates (maintenance ausente ou código diferente → no-op). Não-fatal.
      if (template.codigo === PREVENTIVA_SDAI_CONTRATO_CODIGO && maintenance) {
        try {
          const checklist = template.secoes.flatMap((s) => s.campos).find((f) => f.tipo === 'checklist_dispositivos');
          const cards = checklist && Array.isArray(values[checklist.key]) ? (values[checklist.key] as SdaiChecklistCard[]) : [];
          await finalizeMaintenanceAttendance(
            { serviceAttendanceId: maintenance.serviceAttendanceId, clienteId: cliente?.id, contratoId: contexto?.contratoId, plan: maintenance.plan },
            parseSdaiChecklistResults(cards),
          );
        } catch (e) {
          console.warn('Persistência de manutenção adiada (verificações/pendências):', e);
        }
      }
      // Baixa de estoque dos materiais aplicados (Corretiva).
      onConsumeMaterials?.(collectConsumedMaterials(), { numero: bundle.report.numero, clienteNome: cliente?.name });
    } catch (err) {
      console.error('Falha ao gravar relatório:', err);
      setPersistErr(err instanceof Error ? err.message : 'Falha ao gravar no banco.');
      setFinalized(false);
    } finally {
      setSaving(false);
    }
  };

  const progresso = visibleSections.length > 0 ? ((idx + 1) / visibleSections.length) * 100 : 0;

  return (
    <div className="flex flex-col w-full min-h-[calc(100vh-64px)] relative">
      {/* Sucesso — overlay */}
      {finalized && savedInfo && (
        <div className="fixed inset-0 z-[70] bg-white/95 flex items-center justify-center p-6">
          <div className="text-center max-w-sm">
            <span className={`material-symbols-outlined text-6xl ${offlineSaved ? 'text-amber-500' : 'text-emerald-500'}`}>
              {offlineSaved ? 'cloud_off' : 'task_alt'}
            </span>
            <h2 className="text-lg font-bold text-fg mt-2">
              {offlineSaved ? 'Salvo no aparelho' : 'Relatório gravado'}
            </h2>
            <p className="text-xs text-fg-secondary mt-1">
              {savedInfo.count} pendência{savedInfo.count === 1 ? '' : 's'} aberta{savedInfo.count === 1 ? '' : 's'} · {cliente?.name || 'cliente'}
            </p>
            {offlineSaved ? (
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2">
                Sem conexão agora. O relatório fica guardado com segurança e é enviado automaticamente quando a internet voltar.
              </p>
            ) : (
              <p className="font-data-mono text-[10px] text-fg-muted mt-1">enviado</p>
            )}
            <button onClick={onBack} className="mt-4 px-6 py-2.5 rounded-lg bg-navy text-white text-xs font-semibold uppercase tracking-wide">
              Voltar à lista
            </button>
          </div>
        </div>
      )}

      {/* Topo fixo: contexto operacional, progresso e geolocalização. */}
      <div className="sticky top-16 z-20 bg-surface border-b border-border px-4 py-3">
        <div className="max-w-3xl mx-auto w-full flex items-center gap-3">
        <button onClick={onBack} title="Sair" className="w-9 h-9 rounded-lg flex items-center justify-center text-fg-secondary hover:bg-surface-3 shrink-0">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] text-fg-secondary uppercase tracking-wider truncate">{cliente?.name || ''} {contexto?.osId ? '· OS vinculada' : ''}</p>
          <p className="text-sm font-bold text-fg truncate">{attendanceTitle || tituloOperacional}</p>
        </div>
        {modoCampo === 'rapido' && <span className="font-data-mono text-xs font-bold text-primary shrink-0">{cronometro}</span>}
        {modoCampo === 'rapido' && (
          <button onClick={() => setPausado((v) => !v)} className={`min-h-9 px-2 rounded-lg text-[10px] font-bold uppercase shrink-0 ${pausado ? 'bg-amber-100 text-amber-800' : 'bg-surface-3 text-fg-secondary'}`}>
            {pausado ? 'Retomar' : 'Pausar'}
          </button>
        )}
        <span
          title={geoInicio ? `${geoInicio.lat?.toFixed(5)}, ${geoInicio.lng?.toFixed(5)} (±${Math.round(geoInicio.accuracy || 0)} m)` : 'GPS indisponível'}
          className={`text-[10px] inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full font-semibold shrink-0 ${geoInicio ? 'text-primary bg-navy/5' : 'text-fg-muted bg-surface-3'}`}
        >
          <span className="material-symbols-outlined text-sm">{geoInicio ? 'location_on' : 'location_off'}</span>
          {geoInicio ? `±${Math.round(geoInicio.accuracy || 0)}` : '—'}
        </span>
        <span className="text-[11px] font-data-mono text-fg-secondary shrink-0">{idx + 1}/{visibleSections.length}</span>
        </div>
      </div>
      <div className="h-1 bg-surface-3 sticky top-[calc(4rem+57px)] z-20">
        <div className="h-full bg-navy transition-all" style={{ width: `${progresso}%` }} />
      </div>

      {(pausado || rascunhoRestaurado) && (
        <div className={`px-4 py-2 text-[11px] font-semibold ${pausado ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'}`}>
          {pausado ? 'Atendimento pausado — o progresso está salvo neste aparelho.' : 'Rascunho recuperado — continue de onde parou.'}
        </div>
      )}

      {template.tipo === 'CORRETIVA' && (
        <div className="sticky top-[calc(4rem+61px)] z-20 bg-surface border-b border-border px-4 py-2 flex items-center justify-between gap-3">
          <div className="flex gap-1 overflow-x-auto text-[10px] font-bold uppercase whitespace-nowrap">
            {['Chamado', 'Diagnóstico', 'Execução', 'Resultado', 'Fotos', 'Finalizar'].map((etapa) => (
              <span key={etapa} className={`px-2 py-1 rounded-full ${tituloOperacional === etapa ? 'bg-navy text-white' : 'bg-surface-3 text-fg-muted'}`}>{etapa}</span>
            ))}
          </div>
          <button onClick={() => setModoCampo((m) => m === 'rapido' ? 'completo' : 'rapido')} className="shrink-0 text-[10px] font-bold text-primary uppercase">
            {modoCampo === 'rapido' ? 'Mais detalhes' : 'Modo rápido'}
          </button>
        </div>
      )}

      {template.tipo === 'PREVENTIVA' && modoCampo === 'rapido' && (
        <div className="sticky top-[calc(4rem+61px)] z-20 bg-surface border-b border-border px-4 py-2 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0"><span className="material-symbols-outlined">fact_check</span></div>
          <div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-wide text-fg-secondary">Progresso da preventiva</p><p className="text-sm font-bold text-fg">{dispositivosTestados} / {cardsDispositivos.length || devices?.length || 0} dispositivos testados</p></div>
          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">Próximo recomendado</span>
        </div>
      )}

      {template.tipo === 'LEVANTAMENTO' && modoCampo === 'rapido' && (
        <div className="sticky top-[calc(4rem+61px)] z-20 bg-surface border-b border-border px-4 py-2 flex items-center gap-2 overflow-x-auto text-[10px] font-bold uppercase whitespace-nowrap">
          {['Ambiente', 'Equipamento', 'Condição', 'Registro', 'Finalizar'].map((etapa) => <span key={etapa} className={`px-2 py-1 rounded-full ${tituloOperacional === etapa ? 'bg-navy text-white' : 'bg-surface-3 text-fg-muted'}`}>{etapa}</span>)}
        </div>
      )}

      {/* Amostragem: mostrado na seção de dispositivos quando há ciclo vigente */}
      {ciclo && (currentSection?.campos || []).some((f) => f.tipo === 'checklist_dispositivos') && (
        <div className="mx-4 mt-3 rounded-lg bg-indigo-50 border border-indigo-100 px-3 py-2 text-[11px] text-indigo-900 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-bold uppercase tracking-wide">Amostragem do ciclo</span>
          <span>Nesta visita: <strong>{devices?.length ?? 0}</strong> de {ciclo.dispositivosTotais || 0} dispositivos</span>
          <span className="text-indigo-400">·</span>
          <span>Cobertura acumulada: <strong>{ciclo.dispositivosTestados || 0}/{ciclo.dispositivosTotais || 0}</strong></span>
        </div>
      )}

      {/* Conteúdo: uma seção por vez (centralizado com max-width no desktop) */}
      <div className="flex-1 w-full max-w-3xl mx-auto p-4 md:p-6 pb-28">
        {/* Seletor Pontual/Parcial/Completo: só para rascunhos LEGADOS já salvos
            nesses modos (compat.). Novas "Visitas para Orçamento" não o exibem
            — o Levantamento Técnico com modos vive no motor 3D (Base Técnica). */}
        {template.tipo === 'LEVANTAMENTO' && isLegacySurveyDraft && (
          <div className="mb-5 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-primary">Modo do levantamento (rascunho legado)</p>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {([
                ['pontual', 'Pontual', 'Foto, constatação e observação'],
                ['parcial', 'Parcial', 'Somente os blocos escolhidos'],
                ['completo', 'Completo', 'Levantamento integral'],
              ] as const).map(([mode, label, description]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => { handleChange(SURVEY_MODE_KEY, mode); setCurrentIdx(0); setIssues(null); }}
                  className={`min-h-16 rounded-xl border p-3 text-left ${surveyMode === mode ? 'border-primary bg-navy text-white' : 'border-border bg-surface text-fg'}`}
                >
                  <span className="block text-xs font-bold">{label}</span>
                  <span className={`mt-0.5 block text-[10px] ${surveyMode === mode ? 'text-indigo-100' : 'text-fg-secondary'}`}>{description}</span>
                </button>
              ))}
            </div>
            {surveyMode === 'parcial' && (
              <div className="mt-4">
                <p className="text-[10px] font-bold uppercase text-fg-secondary">Blocos a verificar</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {surveyBlockSections(template).map((section) => {
                    const active = selectedSurveyBlocks.includes(section.key);
                    return (
                      <button
                        key={section.key}
                        type="button"
                        onClick={() => {
                          const next = active
                            ? selectedSurveyBlocks.filter((key) => key !== section.key)
                            : [...selectedSurveyBlocks, section.key];
                          handleChange(SURVEY_BLOCKS_KEY, next);
                          setCurrentIdx(0);
                        }}
                        className={`min-h-10 rounded-full border px-3 text-[11px] font-semibold ${active ? 'border-primary bg-navy text-white' : 'border-border-strong bg-surface text-fg-secondary'}`}
                      >
                        {active ? '✓ ' : ''}{section.titulo}
                      </button>
                    );
                  })}
                </div>
                {selectedSurveyBlocks.length === 0 && <p className="mt-2 text-[10px] text-amber-700">Escolha ao menos um bloco técnico.</p>}
              </div>
            )}
          </div>
        )}

        {template.tipo === 'LEVANTAMENTO' && !surveyMode ? (
          <div className="rounded-xl border border-dashed border-border-strong bg-surface p-6 text-center text-xs text-fg-secondary">
            Escolha o modo acima para iniciar. Nenhum campo do levantamento completo será exigido antes disso.
          </div>
        ) : <>
        {currentSection?.descricao && <p className="text-[11px] text-fg-secondary mb-3">{currentSection.descricao}</p>}
        {modoCampo === 'rapido' && template.tipo === 'CORRETIVA' && currentSection && (
          <QuickCorrectiveActions sectionKey={currentSection.key} values={values} onChange={handleChange} />
        )}
        {showIdentityCard && maintenanceContext && (
          <MaintenanceIdentityCard ctx={maintenanceContext} clienteNome={cliente?.name} />
        )}
        {showCentralPicker && maintenanceContext && (
          <CentralPicker
            centrais={maintenanceContext.centrais}
            value={typeof values.central_device_id === 'string' ? values.central_device_id : undefined}
            onSelect={(id) => handleChange('central_device_id', id)}
            refazer={values.refazer_checklist_central === 'Sim'}
            onRefazer={(v) => handleChange('refazer_checklist_central', v ? 'Sim' : 'Não')}
          />
        )}
        {(stepTemplate.secoes[0]?.campos.length ?? 0) > 0 && (
          <FormEngine
            template={stepTemplate}
            values={values}
            onChange={handleChange}
            catalog={catalog}
            role={roleForEngine}
            onCreateCatalogo={onCreateCatalogo}
            resolveFieldOptions={resolveFieldOptions}
            resolveItemPatch={resolveItemPatch}
            unclassifiedCount={unclassifiedPhotos.length}
            onOpenTriagem={() => setIsTriagemOpen(true)}
            onFastPhotoCaptured={handleFastPhotoCaptured}
            hideFloatingCamera
          />
        )}

        {template.tipo === 'LEVANTAMENTO' && isLast && (
          <div className="mt-5 rounded-xl border border-border bg-surface p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-fg-secondary">Resumo antes de finalizar</p>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ['Evidências', surveySummary.evidencias], ['Constatações', surveySummary.constatacoes],
                ['Pendências formais', surveySummary.pendencias], ['Materiais', surveySummary.materiais],
                ['Serviços', surveySummary.servicos], ['Medições', surveySummary.medicoes],
                ['Não verificado', surveySummary.naoVerificado],
              ].map(([label, count]) => <div key={String(label)} className="rounded-lg bg-surface-2 p-2"><p className="text-lg font-bold text-fg">{count}</p><p className="text-[9px] uppercase text-fg-secondary">{label}</p></div>)}
            </div>
            <p className="mt-3 text-[10px] text-fg-secondary">Uma constatação só vira pendência formal quando registrada em Apontamentos. “Não verificado” preserva a incerteza sem criar um diagnóstico.</p>
          </div>
        )}

        {sectionErr && (
          <div className="mt-4 border border-amber-200 bg-amber-50 rounded-lg p-3 text-[11px] font-semibold text-amber-800">
            {sectionErr}
          </div>
        )}
        {issues !== null && issues.length > 0 && (
          <div className="mt-4 border border-amber-200 bg-amber-50 rounded-lg p-3">
            <p className="text-[11px] font-bold text-amber-800 uppercase mb-1.5">Não é possível finalizar</p>
            <ul className="space-y-1">
              {issues.map((iss, i) => (
                <li key={i} className="text-[10px] text-amber-800">• <strong>{iss.campo}</strong> — {iss.motivo}</li>
              ))}
            </ul>
          </div>
        )}
        {persistErr && (
          <div className="mt-4 border border-red-200 bg-red-50 rounded-lg p-3 text-[11px] text-red-700">
            <p className="font-bold uppercase mb-0.5">Falha ao gravar</p>
            {persistErr}
          </div>
        )}
        {finalized && !savedInfo && (
          <div className="mt-4 border border-emerald-200 bg-emerald-50 rounded-lg p-3 text-[11px] text-emerald-800 font-semibold">
            Relatório válido — {pendenciasPreview.length} pendência(s) (Supabase não configurado; sem gravação).
          </div>
        )}
        </>}
      </div>

      {/* FABs: câmera + contador de triagem (acima do rodapé) */}
      <input ref={camInputRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={onCamFiles} />
      <button
        onClick={() => camInputRef.current?.click()}
        title="Captura rápida"
        className="fixed bottom-24 right-4 z-40 w-14 h-14 rounded-full bg-danger hover:bg-danger-hover text-white shadow-2xl flex items-center justify-center active:scale-95 border-2 border-white"
      >
        <span className="material-symbols-outlined text-2xl">photo_camera</span>
      </button>
      {unclassifiedPhotos.length > 0 && (
        <button
          onClick={() => setIsTriagemOpen(true)}
          className="fixed bottom-[10.5rem] right-4 z-40 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900 text-white text-xs font-bold shadow-lg animate-bounce"
        >
          <span className="material-symbols-outlined text-sm text-danger">collections</span>
          {unclassifiedPhotos.length}
        </button>
      )}

      {/* Rodapé fixo — zona do polegar (centralizado no desktop) */}
      {(template.tipo !== 'LEVANTAMENTO' || surveyMode) && <div className="sticky bottom-0 z-30 bg-surface border-t border-border px-4 py-3">
        <div className="max-w-3xl mx-auto w-full flex items-center gap-2">
        <button
          onClick={goPrev}
          disabled={idx === 0}
          className="px-4 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wide text-fg-secondary disabled:opacity-40 hover:bg-surface-3"
        >
          Anterior
        </button>
        <button
          onClick={() => setShowPend(true)}
          className="relative px-3 py-2.5 rounded-lg text-xs font-semibold text-danger hover:bg-red-50 flex items-center gap-1"
          title="Pendências a abrir"
        >
          <span className="material-symbols-outlined text-base">assignment_late</span>
          {pendenciasPreview.length}
        </button>
        {isLast ? (
          <button
            onClick={handleFinalize}
            disabled={saving}
            className="flex-1 py-2.5 rounded-lg bg-navy hover:bg-navy-3 disabled:opacity-60 text-white text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2"
          >
            {saving && <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>}
            {saving ? 'Gravando…' : 'Finalizar e gravar'}
          </button>
        ) : (
          <button
            onClick={goNext}
            className="flex-1 py-2.5 rounded-lg bg-navy hover:bg-navy-3 text-white text-xs font-semibold uppercase tracking-wider"
          >
            Próximo
          </button>
        )}
        </div>
      </div>}

      {/* Bottom sheet: pendências a abrir */}
      {showPend && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-end sm:items-center justify-center" onClick={() => setShowPend(false)}>
          <div className="bg-surface w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[70vh] overflow-y-auto p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-fg-secondary uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base text-danger">assignment_late</span>
                Pendências a abrir ({pendenciasPreview.length})
              </h4>
              <button onClick={() => setShowPend(false)} className="text-fg-muted hover:text-fg-secondary font-bold">✕</button>
            </div>
            {pendenciasPreview.length === 0 ? (
              <p className="text-[11px] text-fg-muted italic">Nenhuma pendência detectada até agora.</p>
            ) : (
              <div className="space-y-2">
                {pendenciasPreview.map((p, i) => (
                  <div key={i} className="border border-red-100 bg-red-50/50 rounded-lg p-2.5">
                    {p.grupo && <p className="text-[10px] font-bold text-danger uppercase">{p.grupo}</p>}
                    <p className="text-[11px] text-fg-secondary">{p.descricao}</p>
                    <p className="text-[10px] text-fg-muted mt-0.5">{p.local ? `${p.local} · ` : ''}{p.origem}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <TriagemFotos
        isOpen={isTriagemOpen}
        onClose={() => setIsTriagemOpen(false)}
        photos={unclassifiedPhotos}
        onUpdatePhotoNota={handleUpdatePhotoNota}
        onAssignPhotosToApontamento={handleAssignPhotosToApontamento}
        onDeletePhoto={handleDeletePhoto}
        categoriasGrupos={catalog.categorias}
      />
    </div>
  );
};
