'use client';
import React, { useMemo, useState } from 'react';
import { Device, UserRole, AssetConditionValue, TechnicalSurvey } from '@/lib/types';
import {
  TechArea, AREA_LABEL, CONDITIONS, CONDITION_LABEL, SURVEY_MODE_LABEL,
  groupsForArea, assetDisplayIdentifier, findIdentityMatches,
} from '@/lib/technicalBase';
import { SurveyMode } from '@/lib/technicalBase';
import { AssetFormValues, emptyAssetValues, firstInvalidField, buildDevicePatch } from '@/lib/technicalAssetForm';
import { TechnicalAssetFields } from '@/components/clients/TechnicalAssetFields';
import { upsertSurvey, finalizeSurvey } from '@/lib/technicalSurveys';
import { persistSurveyAsset, newAssetId } from '@/lib/surveyCapture';
import { reconcile, summarizeOpenSurvey, ReconRecord, ReconStatus } from '@/lib/reconciliation';
import { insertPendencia } from '@/lib/pendencias';
import { Pendencia } from '@/lib/types';
import { Badge } from '@/components/DataListRow';
import { showToast } from '@/components/ui/Feedback';
import { isSupabaseConfigured } from '@/lib/inventory';
import { TechnicalCatalogItem } from '@/lib/technicalCatalog';
import { CameraCapture } from '@/components/ui/CameraCapture';
import { ensureSurveySession, captureSurveyEvidence } from '@/lib/fieldPhotoCapture';
import { FieldPhotoSession } from '@/lib/fieldPhotos';
import { getOutboxOwner } from '@/lib/offline/outbox';
import dynamic from 'next/dynamic';
import type { Client } from '@/lib/types';

const LevantamentoPdfInner = dynamic(() => import('@/components/documentos/LevantamentoPdfInner'), { ssr: false });

/* ==========================================================================
 * ETAPA 3D.2 — Fluxo de Levantamento Técnico que ALIMENTA a Base em tempo real.
 * Mobile-first (uma coluna, salvar / salvar e próximo). Cada save cria/atualiza
 * um device (source=LEVANTAMENTO) + device_verification imediatamente (§1).
 * Dedup por identidade contextual (§5); COMPLETO reconcilia contra a base (§4).
 * ========================================================================== */

const inputCls = 'w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-base text-fg placeholder:text-fg-muted focus:border-primary focus:outline-none';
const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="flex flex-col gap-1"><span className="text-xs font-semibold text-fg-secondary">{label}</span>{children}</label>
);

interface Props {
  area: TechArea;
  clienteId: string;
  clientName?: string;
  existingDevices: Device[];
  userRole: UserRole;
  currentUserId?: string;
  catalog?: TechnicalCatalogItem[];
  onClose: () => void;
  onChanged: () => void;   // recarrega a base no pai
}

interface Draft {
  assetId: string;         // pré-gerado p/ vincular fotos antes de salvar (§19)
  grupo: string;
  vals: AssetFormValues;   // valores do formulário contextual (fonte única §54)
  photos: number;          // fotos já capturadas para este rascunho
}
const emptyDraft = (): Draft => ({ assetId: newAssetId(), grupo: '', vals: emptyAssetValues(), photos: 0 });

export const TechnicalSurveyFlow: React.FC<Props> = ({ area, clienteId, clientName, existingDevices, userRole, currentUserId, catalog = [], onClose, onChanged }) => {
  const [phase, setPhase] = useState<'config' | 'capture' | 'finish'>('config');
  const [mode, setMode] = useState<SurveyMode>('PONTUAL');
  const [scopeText, setScopeText] = useState('');
  const [expectedCount, setExpectedCount] = useState('');
  const [survey, setSurvey] = useState<TechnicalSurvey | null>(null);
  const [session, setSession] = useState<FieldPhotoSession | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [showPdf, setShowPdf] = useState(false);

  const baseInArea = useMemo(() => existingDevices.filter((d) => d.sistema === area), [existingDevices, area]);

  // Ativos "conhecidos": base da área + os criados nesta visita.
  const [createdThisVisit, setCreatedThisVisit] = useState<Device[]>([]);
  const [records, setRecords] = useState<ReconRecord[]>([]);      // reconciliação (COMPLETO)
  const knownPool = useMemo(() => [...baseInArea, ...createdThisVisit], [baseInArea, createdThisVisit]);

  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [saving, setSaving] = useState(false);
  const [keepNext, setKeepNext] = useState(false);       // §26 — manter dados no próximo
  const [recordKind, setRecordKind] = useState<'ativo' | 'observacao'>('ativo');
  const [obs, setObs] = useState<{ assunto: string; localizacao: string; texto: string; criarPendencia: boolean; photos: number }>({ assunto: '', localizacao: '', texto: '', criarPendencia: false, photos: 0 });
  const [pendingMatch, setPendingMatch] = useState<{ draftAsset: any; matches: Device[] } | null>(null);

  const start = async () => {
    if (!isSupabaseConfigured()) { showToast('Supabase não configurado.'); return; }
    try {
      const exp = mode === 'COMPLETO' ? baseInArea.length : (expectedCount ? Number(expectedCount) : undefined);
      const s = await upsertSurvey({
        clienteId, area, mode, status: 'EM_ANDAMENTO',
        scope: scopeText ? { descricao: scopeText } : {},
        expectedCount: exp, verifiedCount: 0,
      });
      setSurvey(s);
      // Sessão de fotos do levantamento (best-effort; sem técnico, segue sem foto).
      const techId = currentUserId || getOutboxOwner();
      if (techId) {
        try { setSession(await ensureSurveySession({ clientId: clienteId, technicianId: techId, localSetor: scopeText || undefined })); }
        catch { /* segue sem captura de foto */ }
      }
      setPhase('capture');
    } catch (e: any) { showToast(`Falha ao iniciar: ${e?.message || e}`); }
  };

  // Device a partir do formulário contextual (fonte única §54).
  const buildDeviceFromDraft = (id: string): Device =>
    ({ ...buildDevicePatch(area, draft.grupo, draft.vals), id, clienteId, status: 'ativo', source: 'LEVANTAMENTO', sourceSurveyId: survey?.id } as Device);

  const draftAsset = () => ({
    central: draft.vals.central, laco: draft.vals.laco, endereco: draft.vals.endereco, technicalAttributes: draft.vals.attrs,
  });

  const invalidField = () => firstInvalidField(area, draft.grupo, draft.vals);

  // Reset preservando seletivamente dados úteis quando "manter dados" ligado (§26).
  // NUNCA mantém endereço/série/descrição (evita duplicar identificador §26).
  const nextDraft = (): Draft => {
    if (!keepNext) return emptyDraft();
    const v = draft.vals;
    return { assetId: newAssetId(), grupo: draft.grupo, photos: 0,
      vals: { attrs: {}, condicao: v.condicao, fabricante: v.fabricante, modelo: v.modelo, catalogItemId: v.catalogItemId, central: v.central, laco: v.laco } };
  };

  const onCapture = async (file: File) => {
    setShowCamera(false);
    if (!session) { showToast('Foto indisponível nesta sessão.'); return; }
    try {
      if (recordKind === 'observacao') {
        await captureSurveyEvidence({ file, session, clientId: clienteId, clientName: clientName || 'Cliente', technicalSurveyId: survey?.id, note: obs.texto || obs.assunto });
        setObs((p) => ({ ...p, photos: p.photos + 1 }));
      } else {
        await captureSurveyEvidence({ file, session, clientId: clienteId, clientName: clientName || 'Cliente', deviceId: draft.assetId, technicalSurveyId: survey?.id });
        setDraft((p) => ({ ...p, photos: p.photos + 1 }));
      }
      showToast('Foto anexada.');
    } catch (e: any) { showToast(`Falha na foto: ${e?.message || e}`); }
  };

  const doSaveNew = async (goNext: boolean) => {
    setSaving(true);
    try {
      const id = draft.assetId;           // mesmo id das fotos já capturadas
      const dev = buildDeviceFromDraft(id);
      const reconciliation: ReconStatus | undefined = mode === 'COMPLETO' ? 'NOVO' : undefined;
      const res = await persistSurveyAsset({
        device: dev, ownerUserId: currentUserId,
        // §34 — observação técnica vai junto da verificação, não fica presa ao survey.
        verification: { deviceId: id, clienteId, surveyId: survey?.id, condicao: draft.vals.condicao || 'NORMAL', reconciliation, notes: draft.vals.attrs['observacao'] || undefined },
      });
      setCreatedThisVisit((p) => [...p, res.device]);
      if (reconciliation) setRecords((p) => [...p, { deviceId: id, reconciliation }]);
      showToast(res.mode === 'offline' ? 'Salvo offline (sincroniza depois).' : 'Ativo adicionado à Base Técnica.');
      onChanged();
      setDraft(goNext ? nextDraft() : emptyDraft());
    } catch (e: any) { showToast(`Falha: ${e?.message || e}`); } finally { setSaving(false); }
  };

  const doVerifyExisting = async (existing: Device, altered: boolean, goNext: boolean) => {
    setSaving(true);
    try {
      // Atualiza campos só quando "alterado"; caso contrário preserva o existente (§6).
      const dev: Device = altered ? { ...existing, ...buildDeviceFromDraft(existing.id), id: existing.id } : { ...existing, condicao: draft.vals.condicao };
      const reconciliation: ReconStatus = altered ? 'ALTERADO' : 'VERIFICADO';
      await persistSurveyAsset({
        device: dev, ownerUserId: currentUserId,
        verification: { deviceId: existing.id, clienteId, surveyId: survey?.id, condicao: draft.vals.condicao || 'NORMAL', reconciliation, notes: draft.vals.attrs['observacao'] || undefined },
      });
      setRecords((p) => [...p, { deviceId: existing.id, reconciliation }]);
      showToast(`Verificação registrada (${reconciliation === 'ALTERADO' ? 'alterado' : 'verificado'}).`);
      onChanged();
      setPendingMatch(null);
      setDraft(goNext ? nextDraft() : emptyDraft());
    } catch (e: any) { showToast(`Falha: ${e?.message || e}`); } finally { setSaving(false); }
  };

  const onSave = (goNext: boolean) => {
    if (!draft.grupo) { showToast('Escolha o que está registrando (grupo).'); return; }
    const inv = invalidField();
    if (inv) { showToast(`Valor inválido em "${inv.label}".`); return; }
    const asset = draftAsset();
    const matches = findIdentityMatches(area, asset, knownPool);
    if (matches.length >= 1) { setPendingMatch({ draftAsset: asset, matches }); return; }
    doSaveNew(goNext);
  };

  // Observação geral (§17): NÃO cria device. Foto→survey; opcional cria Pendência.
  const saveObservacao = async () => {
    if (!obs.texto.trim() && !obs.assunto.trim()) { showToast('Descreva a observação.'); return; }
    if (!isSupabaseConfigured()) { showToast('Supabase não configurado.'); return; }
    setSaving(true);
    try {
      if (obs.criarPendencia) {
        const pend: Pendencia = {
          id: '', clienteId, grupo: `${AREA_LABEL[area]}${obs.assunto ? ' · ' + obs.assunto : ''}`,
          descricao: obs.texto || obs.assunto, local: obs.localizacao || undefined, quantidade: 1, status: 'aberta',
        } as Pendencia;
        await insertPendencia(pend);
      }
      showToast(obs.criarPendencia ? 'Observação registrada + pendência criada.' : 'Observação registrada.');
      setObs({ assunto: '', localizacao: '', texto: '', criarPendencia: false, photos: 0 });
      setRecordKind('ativo');
    } catch (e: any) { showToast(`Falha: ${e?.message || e}`); } finally { setSaving(false); }
  };

  const markNaoLocalizado = async (existing: Device) => {
    setSaving(true);
    try {
      await persistSurveyAsset({
        device: { ...existing, condicao: 'NAO_LOCALIZADO' }, ownerUserId: currentUserId,
        verification: { deviceId: existing.id, clienteId, surveyId: survey?.id, condicao: 'NAO_LOCALIZADO', reconciliation: 'NAO_LOCALIZADO' },
      });
      setRecords((p) => [...p, { deviceId: existing.id, reconciliation: 'NAO_LOCALIZADO' }]);
      onChanged();
    } catch (e: any) { showToast(`Falha: ${e?.message || e}`); } finally { setSaving(false); }
  };

  // Estado de reconciliação por ativo existente (para a checklist do COMPLETO).
  const statusByDevice = useMemo(() => {
    const m = new Map<string, ReconStatus>();
    for (const r of records) m.set(r.deviceId, r.reconciliation);
    return m;
  }, [records]);

  const summary = useMemo(() => {
    if (mode === 'COMPLETO') return reconcile(baseInArea.map((d) => d.id), records);
    return null;
  }, [mode, baseInArea, records]);

  const openSummary = useMemo(
    () => summarizeOpenSurvey({ known: knownPool.length, added: createdThisVisit.length, scopeExpected: expectedCount ? Number(expectedCount) : undefined }),
    [knownPool.length, createdThisVisit.length, expectedCount],
  );

  const finish = async () => {
    if (survey) {
      try {
        const verified = mode === 'COMPLETO' ? (summary?.resolved || 0) : createdThisVisit.length;
        await finalizeSurvey(survey.id, verified);
      } catch { /* não bloqueia o fecho local */ }
    }
    onChanged();
    onClose();
  };

  /* ------------------------- Render ------------------------- */
  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/50 sm:items-center sm:p-4" onClick={onClose}>
      <div className="flex max-h-screen w-full max-w-lg flex-col overflow-hidden bg-surface sm:max-h-[92vh] sm:rounded-2xl sm:border sm:border-border" onClick={(e) => e.stopPropagation()}>
        <header className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <div>
            <h3 className="text-base font-bold text-fg">Levantamento — {AREA_LABEL[area]}</h3>
            {phase !== 'config' && <p className="text-[11px] text-fg-muted">{SURVEY_MODE_LABEL[mode]} · {createdThisVisit.length} novos · {records.length} verificações</p>}
          </div>
          <button onClick={onClose} className="material-symbols-outlined text-fg-muted hover:text-fg">close</button>
        </header>

        <div className="flex-1 overflow-y-auto p-4">
          {phase === 'config' && (
            <div className="flex flex-col gap-4">
              <Field label="Modo do levantamento">
                <div className="grid grid-cols-3 gap-2">
                  {(['PONTUAL', 'PARCIAL', 'COMPLETO'] as SurveyMode[]).map((m) => (
                    <button key={m} onClick={() => setMode(m)} className={`rounded-lg border px-2 py-2 text-xs font-bold transition-colors ${mode === m ? 'border-primary bg-navy/5 text-primary' : 'border-border text-fg-secondary'}`}>{SURVEY_MODE_LABEL[m]}</button>
                  ))}
                </div>
              </Field>
              <p className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-[11px] text-fg-muted">
                {mode === 'PONTUAL' && 'Registra ativos avulsos. Adiciona à base, mas NÃO indica que a área está completa (§2).'}
                {mode === 'PARCIAL' && 'Declare o escopo (laço/setor/gravador…). A cobertura é calculada só dentro do escopo (§3).'}
                {mode === 'COMPLETO' && `Reconciliação contra a base atual: ${baseInArea.length} ativos servem de checklist (§4).`}
              </p>
              {mode === 'PARCIAL' && (
                <>
                  <Field label="Escopo declarado"><input value={scopeText} onChange={(e) => setScopeText(e.target.value)} placeholder="Ex.: Laço 2 · Pavimento térreo" className={inputCls} /></Field>
                  <Field label="Ativos esperados no escopo (opcional)"><input value={expectedCount} onChange={(e) => setExpectedCount(e.target.value)} inputMode="numeric" placeholder="Ex.: 40" className={inputCls} /></Field>
                </>
              )}
              {mode === 'PONTUAL' && (
                <Field label="Observação do escopo (opcional)"><input value={scopeText} onChange={(e) => setScopeText(e.target.value)} placeholder="Ex.: Visita pontual — câmera da recepção" className={inputCls} /></Field>
              )}
              <button onClick={start} className="mt-2 rounded-lg bg-primary px-4 py-3 text-sm font-bold text-white hover:bg-navy">Iniciar levantamento</button>
            </div>
          )}

          {phase === 'capture' && (
            <div className="flex flex-col gap-4">
              {/* Tipo de registro (§3/§17): equipamento (ativo) ou observação geral. */}
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setRecordKind('ativo')} className={`rounded-lg border px-2 py-2 text-xs font-bold ${recordKind === 'ativo' ? 'border-primary bg-navy/5 text-primary' : 'border-border text-fg-secondary'}`}>+ Registrar equipamento</button>
                <button onClick={() => setRecordKind('observacao')} className={`rounded-lg border px-2 py-2 text-xs font-bold ${recordKind === 'observacao' ? 'border-primary bg-navy/5 text-primary' : 'border-border text-fg-secondary'}`}>+ Observação geral</button>
              </div>

              {/* Câmera como ação de topo (§18/§27): captura rápida. */}
              {session && (
                <button onClick={() => setShowCamera(true)} className="flex items-center justify-center gap-2 rounded-lg border border-primary bg-navy/5 px-3 py-3 text-sm font-bold text-primary">
                  <span className="material-symbols-outlined text-lg">photo_camera</span>
                  {(recordKind === 'ativo' ? draft.photos : obs.photos) > 0 ? `Foto anexada (${recordKind === 'ativo' ? draft.photos : obs.photos}) · adicionar outra` : 'Abrir câmera'}
                </button>
              )}

              {recordKind === 'ativo' ? (
                <>
                  {/* Grupo → formulário CONTEXTUAL único (§4/§7/§54) */}
                  <Field label="O que você está registrando?">
                    <select value={draft.grupo} onChange={(e) => setDraft((p) => ({ ...p, grupo: e.target.value }))} className={inputCls}>
                      <option value="">Selecione o grupo…</option>
                      {groupsForArea(area).map((g) => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </Field>
                  {draft.grupo && <TechnicalAssetFields area={area} group={draft.grupo} catalog={catalog} value={draft.vals} onChange={(v) => setDraft((p) => ({ ...p, vals: v }))} />}
                  <label className="flex items-center gap-2 text-xs text-fg-secondary">
                    <input type="checkbox" checked={keepNext} onChange={(e) => setKeepNext(e.target.checked)} />
                    Manter grupo/fabricante/modelo/central/laço no próximo (não repete endereço, §26)
                  </label>
                </>
              ) : (
                /* Observação geral (§17): não cria device */
                <div className="grid grid-cols-1 gap-3">
                  <Field label="Assunto / categoria"><input value={obs.assunto} onChange={(e) => setObs((p) => ({ ...p, assunto: e.target.value }))} placeholder="Ex.: Área sem cobertura, acesso bloqueado…" className={inputCls} /></Field>
                  <Field label="Localização"><input value={obs.localizacao} onChange={(e) => setObs((p) => ({ ...p, localizacao: e.target.value }))} className={inputCls} /></Field>
                  <Field label="Observação técnica"><textarea value={obs.texto} onChange={(e) => setObs((p) => ({ ...p, texto: e.target.value }))} rows={3} className={inputCls} /></Field>
                  <label className="flex items-center gap-2 text-xs text-fg-secondary">
                    <input type="checkbox" checked={obs.criarPendencia} onChange={(e) => setObs((p) => ({ ...p, criarPendencia: e.target.checked }))} />
                    Criar pendência a partir desta observação
                  </label>
                  <p className="text-[10px] text-fg-muted">Observação pertence ao levantamento; não cria ativo (§17).</p>
                </div>
              )}

              {/* COMPLETO: checklist de reconciliação */}
              {mode === 'COMPLETO' && baseInArea.length > 0 && (
                <div className="rounded-xl border border-border">
                  <p className="border-b border-border px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-fg-muted">
                    Checklist da base ({records.filter((r) => r.reconciliation !== 'NOVO').length}/{baseInArea.length})
                  </p>
                  <div className="max-h-56 divide-y divide-border overflow-y-auto">
                    {baseInArea.map((d) => {
                      const st = statusByDevice.get(d.id);
                      const ident = assetDisplayIdentifier(area, { central: d.central, laco: d.laco, endereco: d.endereco, technicalAttributes: d.technicalAttributes });
                      return (
                        <div key={d.id} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                          <span className="min-w-0 flex-1 truncate">{ident || d.modelo || d.tipoAtivo || 'ativo'}</span>
                          {st ? <Badge color={st === 'NAO_LOCALIZADO' ? 'red' : st === 'ALTERADO' ? 'amber' : 'emerald'}>{st === 'NAO_LOCALIZADO' ? 'Não localizado' : st === 'ALTERADO' ? 'Alterado' : 'Verificado'}</Badge>
                            : <button onClick={() => markNaoLocalizado(d)} disabled={saving} className="shrink-0 rounded border border-border px-2 py-0.5 text-[10px] font-semibold text-danger hover:bg-danger/10">Não localizado</button>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {phase === 'finish' && (
            <div className="flex flex-col gap-3">
              <h4 className="text-sm font-bold text-fg">Resumo do levantamento</h4>
              {mode === 'COMPLETO' && summary ? (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <Stat label="Esperados" value={summary.expected} />
                  <Stat label="Verificados" value={summary.verified} />
                  <Stat label="Não localizados" value={summary.naoLocalizado} tone="red" />
                  <Stat label="Novos" value={summary.novo} tone="blue" />
                  <Stat label="Alterados" value={summary.alterado} tone="amber" />
                  <Stat label="Pendentes" value={summary.pendente} tone={summary.pendente ? 'amber' : 'emerald'} />
                  <div className="col-span-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs">
                    Cobertura: <b>{summary.coveragePct ?? 0}%</b>{' '}
                    {summary.canDeclare100 ? <Badge color="emerald">Reconciliação fechada</Badge> : <Badge color="amber">Não fecha 100% ({summary.pendente} pendente(s))</Badge>}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <Stat label="Conhecidos" value={openSummary.known} />
                  <Stat label="Adicionados nesta visita" value={openSummary.added} tone="blue" />
                  <div className="col-span-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs">
                    {openSummary.coverageDetermined
                      ? <>Cobertura no escopo: <b>{openSummary.coveragePct}%</b></>
                      : <>Cobertura <b>não determinada</b> {mode === 'PONTUAL' ? '(levantamento pontual)' : '(escopo sem total esperado)'}.</>}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <footer className="shrink-0 border-t border-border p-3">
          {phase === 'capture' && recordKind === 'ativo' && (
            <div className="flex gap-2">
              <button onClick={() => onSave(false)} disabled={saving} className="flex-1 rounded-lg border border-primary px-3 py-3 text-sm font-bold text-primary hover:bg-navy hover:text-white disabled:opacity-50">Salvar</button>
              <button onClick={() => onSave(true)} disabled={saving} className="flex-1 rounded-lg bg-primary px-3 py-3 text-sm font-bold text-white hover:bg-navy disabled:opacity-50">Salvar e próximo</button>
              <button onClick={() => setPhase('finish')} className="rounded-lg border border-border px-3 py-3 text-sm font-semibold text-fg-secondary hover:bg-surface-2">Concluir</button>
            </div>
          )}
          {phase === 'capture' && recordKind === 'observacao' && (
            <div className="flex gap-2">
              <button onClick={saveObservacao} disabled={saving} className="flex-1 rounded-lg bg-primary px-3 py-3 text-sm font-bold text-white hover:bg-navy disabled:opacity-50">Salvar observação</button>
              <button onClick={() => setPhase('finish')} className="rounded-lg border border-border px-3 py-3 text-sm font-semibold text-fg-secondary hover:bg-surface-2">Concluir</button>
            </div>
          )}
          {phase === 'finish' && (
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setPhase('capture')} className="flex-1 rounded-lg border border-border px-3 py-3 text-sm font-semibold text-fg-secondary hover:bg-surface-2">Voltar</button>
              <button onClick={() => setShowPdf(true)} className="flex-1 rounded-lg border border-primary px-3 py-3 text-sm font-bold text-primary hover:bg-navy hover:text-white">PDF do levantamento</button>
              <button onClick={finish} className="flex-1 rounded-lg bg-primary px-3 py-3 text-sm font-bold text-white hover:bg-navy">Finalizar</button>
            </div>
          )}
        </footer>
      </div>

      {showCamera && <CameraCapture onCapture={onCapture} onClose={() => setShowCamera(false)} title="Foto do ativo" />}

      {showPdf && (
        <LevantamentoPdfInner
          client={{ id: clienteId, name: clientName || 'Cliente' } as Client}
          area={area}
          mode={mode}
          scopeText={scopeText || undefined}
          deviceIds={Array.from(new Set([
            ...createdThisVisit.map((d) => d.id),
            ...records.map((r) => r.deviceId),
            ...(mode === 'COMPLETO' ? baseInArea.map((d) => d.id) : []),
          ]))}
          resumo={mode === 'COMPLETO' && summary
            ? { expected: summary.expected, verified: summary.verified, naoLocalizado: summary.naoLocalizado, novo: summary.novo, alterado: summary.alterado, pendente: summary.pendente, coveragePct: summary.coveragePct }
            : { expected: expectedCount ? Number(expectedCount) : undefined, verified: createdThisVisit.length, coveragePct: openSummary.coveragePct }}
          onClose={() => setShowPdf(false)}
        />
      )}

      {/* Confirmação de duplicidade / ambiguidade (§5) */}
      {pendingMatch && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={() => setPendingMatch(null)}>
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-4" onClick={(e) => e.stopPropagation()}>
            <h4 className="text-sm font-bold text-fg">{pendingMatch.matches.length > 1 ? 'Múltiplos ativos correspondem' : 'Ativo já existe na base'}</h4>
            <p className="mt-1 text-xs text-fg-secondary">
              {pendingMatch.matches.length > 1
                ? 'A identidade bate com mais de um ativo. Escolha qual verificar ou registre como novo (nunca fazemos merge silencioso, §5).'
                : 'Registrar como verificação deste ativo em vez de criar um novo?'}
            </p>
            <div className="mt-3 flex max-h-48 flex-col gap-2 overflow-y-auto">
              {pendingMatch.matches.map((d) => (
                <div key={d.id} className="rounded-lg border border-border px-3 py-2">
                  <p className="truncate text-xs font-semibold text-fg">{assetDisplayIdentifier(area, { central: d.central, laco: d.laco, endereco: d.endereco, technicalAttributes: d.technicalAttributes }) || d.modelo || 'ativo'}</p>
                  <p className="truncate text-[11px] text-fg-muted">{[d.grupo, d.fabricante, d.modelo].filter(Boolean).join(' · ')}</p>
                  <div className="mt-2 flex gap-2">
                    <button onClick={() => doVerifyExisting(d, false, true)} disabled={saving} className="rounded border border-emerald-500 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50">Verificado</button>
                    <button onClick={() => doVerifyExisting(d, true, true)} disabled={saving} className="rounded border border-amber-500 px-2 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50">Alterado (atualizar)</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => setPendingMatch(null)} className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-fg-secondary hover:bg-surface-2">Cancelar</button>
              <button onClick={() => { setPendingMatch(null); doSaveNew(true); }} disabled={saving} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-white hover:bg-navy disabled:opacity-50">Registrar como novo</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Stat: React.FC<{ label: string; value: number; tone?: 'emerald' | 'amber' | 'red' | 'blue' }> = ({ label, value, tone }) => (
  <div className="rounded-lg border border-border bg-surface px-3 py-2">
    <p className="text-[10px] uppercase tracking-wider text-fg-muted">{label}</p>
    <p className={`font-data-mono text-xl font-bold ${tone === 'red' ? 'text-danger' : tone === 'amber' ? 'text-amber-600' : tone === 'blue' ? 'text-blue-600' : tone === 'emerald' ? 'text-emerald-600' : 'text-fg'}`}>{value}</p>
  </div>
);
