'use client';

import React, { useMemo, useState } from 'react';
import {
  Client,
  InventoryItem,
  ServiceCatalogItem,
  Contract,
  UserRole,
  Pendencia,
  AcaoRecomendada,
} from '@/lib/types';
import { ALL_TEMPLATES } from '@/lib/reportTemplatesData';
import {
  TemplateSchema,
  FormValues,
  RepeaterCard,
  isNegativeAnswer,
  validateFinalize,
  FinalizeIssue,
} from '@/lib/reportSchema';
import { FormEngine, CatalogSources } from '@/components/reports/FormEngine';
import { isSupabaseConfigured } from '@/lib/inventory';
import { createReport, upsertAnswer } from '@/lib/reports';
import { insertPendencia } from '@/lib/pendencias';

interface RelatoriosViewProps {
  clients: Client[];
  inventory: InventoryItem[];
  services: ServiceCatalogItem[];
  contracts: Contract[];
  brands: { name: string }[];
  userRole: UserRole;
  currentUserName?: string;
}

interface PendenciaPreview {
  grupo?: string;
  descricao: string;
  local?: string;
  origem: string;
}

const uniq = (arr: string[]) => Array.from(new Set(arr.filter(Boolean)));

const firstDigit = (s: unknown): number | undefined => {
  const m = /(\d)/.exec(String(s ?? ''));
  return m ? Number(m[1]) : undefined;
};

/** Constrói as pendências a serem gravadas (itens negativos + apontamentos). */
function buildPendencias(
  template: TemplateSchema,
  values: FormValues,
  clienteId: string,
  itensCatalogo: string[]
): Pendencia[] {
  const out: Pendencia[] = [];
  for (const secao of template.secoes) {
    if (secao.pula_se && String(values[secao.pula_se.campo]) === secao.pula_se.igual) continue;
    for (const field of secao.campos) {
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
    }
  }
  return out;
}

export const RelatoriosView: React.FC<RelatoriosViewProps> = ({
  clients,
  inventory,
  services,
  contracts,
  brands,
  userRole,
  currentUserName = '',
}) => {
  const [templateCodigo, setTemplateCodigo] = useState<string>(ALL_TEMPLATES[0].codigo);
  const [clienteId, setClienteId] = useState<string>(clients[0]?.id || '');
  const [values, setValues] = useState<FormValues>({});
  const [issues, setIssues] = useState<FinalizeIssue[] | null>(null);
  const [finalized, setFinalized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [persistErr, setPersistErr] = useState<string | null>(null);
  const [savedInfo, setSavedInfo] = useState<{ reportId: string; count: number } | null>(null);

  const template = ALL_TEMPLATES.find((t) => t.codigo === templateCodigo) as TemplateSchema;
  const roleForEngine = userRole.toLowerCase();

  const catalog: CatalogSources = useMemo(
    () => ({
      categorias: uniq([...inventory.map((i) => i.category), ...services.map((s) => s.category)]),
      itens: uniq([...inventory.map((i) => i.name), ...services.map((s) => s.title)]),
      marcas: uniq([...brands.map((b) => b.name), ...inventory.map((i) => i.brand || '')]),
      devices: [],
      contratos: contracts.map((c) => ({ id: c.id, label: `${c.contractType || c.unit} (${c.id})` })),
      pendenciasAprovadas: [],
      pendenciasAbertas: [],
    }),
    [inventory, services, brands, contracts]
  );

  const resetOutcome = () => {
    setIssues(null);
    setFinalized(false);
    setSavedInfo(null);
    setPersistErr(null);
  };

  const changeTemplate = (codigo: string) => {
    setTemplateCodigo(codigo);
    setValues({});
    resetOutcome();
  };

  const handleChange = (key: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    resetOutcome();
  };

  // Pré-visualização das pendências que serão abertas (regra "item negativo").
  const pendenciasPreview = useMemo<PendenciaPreview[]>(() => {
    const list: PendenciaPreview[] = [];
    for (const secao of template.secoes) {
      if (secao.pula_se && String(values[secao.pula_se.campo]) === secao.pula_se.igual) continue;
      for (const field of secao.campos) {
        // Itens negativos das perguntas
        if (field.abre_pendencia_se && isNegativeAnswer(field, values[field.key] as never)) {
          list.push({
            grupo: field.pendencia_sugerida?.grupo,
            descricao: field.pendencia_sugerida?.descricao || `${field.label}: ${String(values[field.key])}`,
            origem: secao.titulo,
          });
        }
        // Apontamentos (repeater gera_pendencia)
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
      }
    }
    return list;
  }, [template, values]);

  const hasPhoto = (fieldKey: string, cardIndex: number): boolean => {
    const cards = Array.isArray(values[fieldKey]) ? (values[fieldKey] as RepeaterCard[]) : [];
    const foto = cards[cardIndex]?.foto;
    return Array.isArray(foto) && foto.length > 0;
  };

  const cliente = clients.find((c) => c.id === clienteId);
  const isTecnico = userRole === 'TECNICO';

  const handleFinalize = async () => {
    const found = validateFinalize(template, values, hasPhoto);
    setIssues(found);
    setPersistErr(null);
    setSavedInfo(null);
    if (found.length > 0) {
      setFinalized(false);
      return;
    }

    // Sem Supabase: apenas valida localmente (protótipo).
    if (!isSupabaseConfigured()) {
      setFinalized(true);
      return;
    }

    setSaving(true);
    try {
      // 1) cria o relatório já finalizado
      const report = await createReport({
        id: '',
        templateCodigo: template.codigo,
        tipo: template.tipo,
        clienteId: clienteId || undefined,
        tecnicoNome: currentUserName || undefined,
        titulo: `${template.nome} — ${cliente?.name || ''}`.trim(),
        status: 'finalizado',
        finalizadoEm: new Date().toISOString(),
      });

      // 2) grava as respostas (uma linha por campo de topo; repeater vai como jsonb)
      for (const secao of template.secoes) {
        for (const field of secao.campos) {
          const v = values[field.key];
          if (v === undefined) continue;
          await upsertAnswer({ id: '', reportId: report.id, secao: secao.key, fieldKey: field.key, valor: v });
        }
      }

      // 3) abre as pendências detectadas, vinculadas ao relatório de origem
      const pends = buildPendencias(template, values, clienteId, catalog.itens);
      for (const p of pends) {
        await insertPendencia({ ...p, reportOrigemId: report.id });
      }

      setSavedInfo({ reportId: report.id, count: pends.length });
      setFinalized(true);
    } catch (err) {
      console.error('Falha ao gravar relatório:', err);
      setPersistErr(err instanceof Error ? err.message : 'Falha ao gravar no banco.');
      setFinalized(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col w-full p-4 md:p-8 gap-5 md:gap-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-5">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          Relatórios Técnicos de Campo &mdash; SDAI
        </span>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
          Levantamento · Corretiva · Preventiva
        </h1>
        {isTecnico && (
          <p className="text-[11px] text-emerald-700 bg-emerald-50 inline-flex items-center gap-1 px-2.5 py-1 rounded-full mt-2 font-semibold">
            <span className="material-symbols-outlined text-sm">visibility_off</span>
            Perfil Técnico: valores e criticidade não aparecem para você.
          </p>
        )}
      </div>

      {/* Seletor de template + cliente */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col md:flex-row md:items-end gap-4">
        <div className="flex gap-2 flex-wrap">
          {ALL_TEMPLATES.map((t) => (
            <button
              key={t.codigo}
              onClick={() => changeTemplate(t.codigo)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wide transition-colors ${
                templateCodigo === t.codigo ? 'bg-slate-900 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {t.nome}
            </button>
          ))}
        </div>
        <div className="md:ml-auto md:w-72">
          <label className="block text-slate-600 mb-1 font-semibold uppercase text-[11px]">Cliente</label>
          <select
            value={clienteId}
            onChange={(e) => setClienteId(e.target.value)}
            className="w-full border border-slate-200 rounded-lg p-2.5 text-slate-900 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-[#1A1A72]/20"
          >
            {clients.length === 0 && <option value="">Nenhum cliente</option>}
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.pendenteValidacao ? ' (provisório)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Motor de formulário */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2">
          <FormEngine template={template} values={values} onChange={handleChange} catalog={catalog} role={roleForEngine} />
        </div>

        {/* Lateral: pendências a abrir + finalização */}
        <div className="flex flex-col gap-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 xl:sticky xl:top-20">
            <h4 className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
              <span className="material-symbols-outlined text-base text-[#E63946]">assignment_late</span>
              Pendências a abrir
              <span className="ml-auto font-data-mono text-[#E63946]">{pendenciasPreview.length}</span>
            </h4>
            {pendenciasPreview.length === 0 ? (
              <p className="text-[11px] text-slate-400 italic">Nenhuma pendência detectada até agora.</p>
            ) : (
              <div className="space-y-2 max-h-[320px] overflow-y-auto">
                {pendenciasPreview.map((p, i) => (
                  <div key={i} className="border border-red-100 bg-red-50/50 rounded-lg p-2.5">
                    {p.grupo && <p className="text-[10px] font-bold text-[#E63946] uppercase">{p.grupo}</p>}
                    <p className="text-[11px] text-slate-700">{p.descricao}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {p.local ? `${p.local} · ` : ''}
                      {p.origem}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={handleFinalize}
              disabled={saving}
              className="w-full mt-4 py-2.5 rounded-lg bg-[#1A1A72] hover:bg-[#12124f] disabled:opacity-60 text-white text-xs font-semibold uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
            >
              {saving && <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>}
              {saving ? 'Gravando…' : 'Finalizar e gravar'}
            </button>

            {issues !== null && issues.length > 0 && (
              <div className="mt-3 border border-amber-200 bg-amber-50 rounded-lg p-3">
                <p className="text-[11px] font-bold text-amber-800 uppercase mb-1.5">Não é possível finalizar</p>
                <ul className="space-y-1">
                  {issues.map((iss, i) => (
                    <li key={i} className="text-[10px] text-amber-800">
                      • <strong>{iss.campo}</strong> — {iss.motivo}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {persistErr && (
              <div className="mt-3 border border-red-200 bg-red-50 rounded-lg p-3 text-[11px] text-red-700">
                <p className="font-bold uppercase mb-0.5">Falha ao gravar</p>
                {persistErr}
              </div>
            )}

            {finalized && savedInfo && (
              <div className="mt-3 border border-emerald-200 bg-emerald-50 rounded-lg p-3 text-[11px] text-emerald-800 font-semibold flex items-start gap-1.5">
                <span className="material-symbols-outlined text-base">task_alt</span>
                <span>
                  Relatório gravado ({savedInfo.count} pendência{savedInfo.count === 1 ? '' : 's'} aberta{savedInfo.count === 1 ? '' : 's'}) para {cliente?.name || 'o cliente'}.
                  <span className="block font-data-mono text-[9px] text-emerald-600 mt-0.5">ref {savedInfo.reportId}</span>
                </span>
              </div>
            )}

            {finalized && !savedInfo && (
              <div className="mt-3 border border-emerald-200 bg-emerald-50 rounded-lg p-3 text-[11px] text-emerald-800 font-semibold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base">task_alt</span>
                Relatório válido — {pendenciasPreview.length} pendência(s) seriam abertas (Supabase não configurado; sem gravação).
              </div>
            )}

            <p className="text-[9px] text-slate-400 mt-3 leading-relaxed">
              Grava relatório, respostas e pendências no banco. Captura rápida por câmera, triagem de
              fotos e geração de PDF entram nas próximas fatias da Fase 3/4. Autor: {currentUserName || 'Técnico'}.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
