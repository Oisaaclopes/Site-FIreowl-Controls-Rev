'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Client, UserRole, Pendencia, AcaoRecomendada, GeoPoint, Device, CicloAmostragem } from '@/lib/types';
import { getGeoPoint } from '@/lib/geo';
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
  /** Inventário do cliente — semeia o checklist_dispositivos (Preventiva). */
  devices?: Device[];
  /** Pendências aprovadas do cliente — semeiam o checklist_pendencias (Corretiva). */
  pendenciasAprovadas?: { id: string; descricao?: string; grupo?: string }[];
  /** Ciclo de amostragem vigente (Preventiva) — atualiza cobertura ao finalizar. */
  ciclo?: CicloAmostragem;
  onBack: () => void;
  onSaved: () => void;
}

interface PendenciaPreview {
  grupo?: string;
  descricao: string;
  local?: string;
  origem: string;
}

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

export const ReportForm: React.FC<ReportFormProps> = ({
  template,
  templateId,
  cliente,
  catalog,
  userRole,
  currentUserName = '',
  contexto,
  devices,
  pendenciasAprovadas,
  ciclo,
  onBack,
  onSaved,
}) => {
  const roleForEngine = userRole.toLowerCase();
  const isTecnico = userRole === 'TECNICO';

  const [values, setValues] = useState<FormValues>({});
  const [issues, setIssues] = useState<FinalizeIssue[] | null>(null);
  const [finalized, setFinalized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [persistErr, setPersistErr] = useState<string | null>(null);
  const [savedInfo, setSavedInfo] = useState<{ reportId: string; count: number } | null>(null);
  const [offlineSaved, setOfflineSaved] = useState(false);

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

  // Navegação em passos (uma seção por tela — modo campo, Partes 4.7/8)
  const [currentIdx, setCurrentIdx] = useState(0);
  const [showPend, setShowPend] = useState(false);
  const [sectionErr, setSectionErr] = useState<string | null>(null);
  const camInputRef = React.useRef<HTMLInputElement>(null);

  // Seções visíveis (respeita salto condicional pula_se)
  const visibleSections = useMemo(
    () => template.secoes.filter((s) => !(s.pula_se && String(values[s.pula_se.campo]) === s.pula_se.igual)),
    [template, values]
  );
  const idx = Math.min(currentIdx, Math.max(0, visibleSections.length - 1));
  const currentSection = visibleSections[idx];
  const stepTemplate = { ...template, secoes: currentSection ? [currentSection] : [] };
  const isLast = idx >= visibleSections.length - 1;

  const goPrev = () => {
    setSectionErr(null);
    setCurrentIdx(Math.max(0, idx - 1));
  };
  const goNext = () => {
    // Bloqueia avanço com obrigatório faltando na seção atual (sem modal)
    const faltando = (currentSection?.campos || []).find((f) => {
      if (!f.obrigatorio) return false;
      const v = values[f.key];
      if (f.tipo === 'foto') return !hasPhoto(f.key);
      return v === undefined || v === null || v === '';
    });
    if (faltando) {
      setSectionErr(`Preencha: ${faltando.label || faltando.key}`);
      return;
    }
    setSectionErr(null);
    setCurrentIdx(Math.min(visibleSections.length - 1, idx + 1));
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
    for (const secao of template.secoes) {
      if (secao.pula_se && String(values[secao.pula_se.campo]) === secao.pula_se.igual) continue;
      for (const field of secao.campos) {
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
  }, [template, values]);

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
    for (const secao of template.secoes) for (const field of secao.campos) collect(values[field.key]);
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
    for (const secao of template.secoes)
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
    for (const secao of template.secoes)
      for (const field of secao.campos) {
        const v = values[field.key];
        if (v === undefined) continue;
        answers.push({ secao: secao.key, fieldKey: field.key, valor: v });
      }

    const pends = buildPendencias(template, values, cliente?.id || '', catalog.itens);
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
      report: {
        templateId,
        templateCodigo: template.codigo,
        numero,
        tipo: template.tipo,
        clienteId: cliente?.id || undefined,
        clienteNome: cliente?.name,
        osId: contexto?.osId,
        contratoId: contexto?.contratoId,
        tecnicoNome: currentUserName || undefined,
        titulo: `${template.nome} — ${cliente?.name || ''}`.trim(),
        geoInicio: geoInicio || undefined,
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

  const handleFinalize = async () => {
    const found = validateFinalize(template, values, hasPhoto);
    setIssues(found);
    setPersistErr(null);
    setSavedInfo(null);
    if (found.length > 0) {
      setFinalized(false);
      return;
    }
    if (!isSupabaseConfigured()) {
      setFinalized(true);
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
      onSaved();
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
            <h2 className="text-lg font-bold text-slate-900 mt-2">
              {offlineSaved ? 'Salvo no aparelho' : 'Relatório gravado'}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              {savedInfo.count} pendência{savedInfo.count === 1 ? '' : 's'} aberta{savedInfo.count === 1 ? '' : 's'} · {cliente?.name || 'cliente'}
            </p>
            {offlineSaved ? (
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2">
                Sem conexão agora. O relatório fica guardado com segurança e é enviado automaticamente quando a internet voltar.
              </p>
            ) : (
              <p className="font-data-mono text-[10px] text-slate-400 mt-1">enviado</p>
            )}
            <button onClick={onBack} className="mt-4 px-6 py-2.5 rounded-lg bg-[#1A1A72] text-white text-xs font-semibold uppercase tracking-wide">
              Voltar à lista
            </button>
          </div>
        </div>
      )}

      {/* Topo fixo: sair, bloco, progresso, geo */}
      <div className="sticky top-16 z-20 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} title="Sair" className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 shrink-0">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] text-slate-500 uppercase tracking-wider truncate">{template.nome} · {cliente?.name || ''}</p>
          <p className="text-sm font-bold text-slate-900 truncate">{currentSection?.titulo || 'Relatório'}</p>
        </div>
        <span
          title={geoInicio ? `${geoInicio.lat?.toFixed(5)}, ${geoInicio.lng?.toFixed(5)} (±${Math.round(geoInicio.accuracy || 0)} m)` : 'GPS indisponível'}
          className={`text-[10px] inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full font-semibold shrink-0 ${geoInicio ? 'text-[#1A1A72] bg-[#1A1A72]/5' : 'text-slate-400 bg-slate-100'}`}
        >
          <span className="material-symbols-outlined text-sm">{geoInicio ? 'location_on' : 'location_off'}</span>
          {geoInicio ? `±${Math.round(geoInicio.accuracy || 0)}` : '—'}
        </span>
        <span className="text-[11px] font-data-mono text-slate-500 shrink-0">{idx + 1}/{visibleSections.length}</span>
      </div>
      <div className="h-1 bg-slate-100 sticky top-[calc(4rem+57px)] z-20">
        <div className="h-full bg-[#1A1A72] transition-all" style={{ width: `${progresso}%` }} />
      </div>

      {/* Amostragem: mostrado na seção de dispositivos quando há ciclo vigente */}
      {ciclo && (currentSection?.campos || []).some((f) => f.tipo === 'checklist_dispositivos') && (
        <div className="mx-4 mt-3 rounded-lg bg-indigo-50 border border-indigo-100 px-3 py-2 text-[11px] text-indigo-900 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-bold uppercase tracking-wide">Amostragem do ciclo</span>
          <span>Nesta visita: <strong>{devices?.length ?? 0}</strong> de {ciclo.dispositivosTotais || 0} dispositivos</span>
          <span className="text-indigo-400">·</span>
          <span>Cobertura acumulada: <strong>{ciclo.dispositivosTestados || 0}/{ciclo.dispositivosTotais || 0}</strong></span>
        </div>
      )}

      {/* Conteúdo: uma seção por vez */}
      <div className="flex-1 p-4 md:p-8 pb-28">
        {currentSection?.descricao && <p className="text-[11px] text-slate-500 mb-3">{currentSection.descricao}</p>}
        <FormEngine
          template={stepTemplate}
          values={values}
          onChange={handleChange}
          catalog={catalog}
          role={roleForEngine}
          unclassifiedCount={unclassifiedPhotos.length}
          onOpenTriagem={() => setIsTriagemOpen(true)}
          onFastPhotoCaptured={handleFastPhotoCaptured}
          hideFloatingCamera
        />

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
      </div>

      {/* FABs: câmera + contador de triagem (acima do rodapé) */}
      <input ref={camInputRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={onCamFiles} />
      <button
        onClick={() => camInputRef.current?.click()}
        title="Captura rápida"
        className="fixed bottom-24 right-4 z-40 w-14 h-14 rounded-full bg-[#E63946] hover:bg-[#a51515] text-white shadow-2xl flex items-center justify-center active:scale-95 border-2 border-white"
      >
        <span className="material-symbols-outlined text-2xl">photo_camera</span>
      </button>
      {unclassifiedPhotos.length > 0 && (
        <button
          onClick={() => setIsTriagemOpen(true)}
          className="fixed bottom-[10.5rem] right-4 z-40 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900 text-white text-xs font-bold shadow-lg animate-bounce"
        >
          <span className="material-symbols-outlined text-sm text-[#E63946]">collections</span>
          {unclassifiedPhotos.length}
        </button>
      )}

      {/* Rodapé fixo — zona do polegar */}
      <div className="sticky bottom-0 z-30 bg-white border-t border-slate-200 px-4 py-3 flex items-center gap-2">
        <button
          onClick={goPrev}
          disabled={idx === 0}
          className="px-4 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wide text-slate-600 disabled:opacity-40 hover:bg-slate-100"
        >
          Anterior
        </button>
        <button
          onClick={() => setShowPend(true)}
          className="relative px-3 py-2.5 rounded-lg text-xs font-semibold text-[#E63946] hover:bg-red-50 flex items-center gap-1"
          title="Pendências a abrir"
        >
          <span className="material-symbols-outlined text-base">assignment_late</span>
          {pendenciasPreview.length}
        </button>
        {isLast ? (
          <button
            onClick={handleFinalize}
            disabled={saving}
            className="flex-1 py-2.5 rounded-lg bg-[#1A1A72] hover:bg-[#12124f] disabled:opacity-60 text-white text-xs font-semibold uppercase tracking-wider flex items-center justify-center gap-2"
          >
            {saving && <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>}
            {saving ? 'Gravando…' : 'Finalizar e gravar'}
          </button>
        ) : (
          <button
            onClick={goNext}
            className="flex-1 py-2.5 rounded-lg bg-[#1A1A72] hover:bg-[#12124f] text-white text-xs font-semibold uppercase tracking-wider"
          >
            Próximo
          </button>
        )}
      </div>

      {/* Bottom sheet: pendências a abrir */}
      {showPend && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-end sm:items-center justify-center" onClick={() => setShowPend(false)}>
          <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[70vh] overflow-y-auto p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-base text-[#E63946]">assignment_late</span>
                Pendências a abrir ({pendenciasPreview.length})
              </h4>
              <button onClick={() => setShowPend(false)} className="text-slate-400 hover:text-slate-700 font-bold">✕</button>
            </div>
            {pendenciasPreview.length === 0 ? (
              <p className="text-[11px] text-slate-400 italic">Nenhuma pendência detectada até agora.</p>
            ) : (
              <div className="space-y-2">
                {pendenciasPreview.map((p, i) => (
                  <div key={i} className="border border-red-100 bg-red-50/50 rounded-lg p-2.5">
                    {p.grupo && <p className="text-[10px] font-bold text-[#E63946] uppercase">{p.grupo}</p>}
                    <p className="text-[11px] text-slate-700">{p.descricao}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{p.local ? `${p.local} · ` : ''}{p.origem}</p>
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
