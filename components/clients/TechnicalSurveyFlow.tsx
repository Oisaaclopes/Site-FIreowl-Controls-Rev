'use client';
import React, { useMemo, useState } from 'react';
import { Device, UserRole, AssetConditionValue, TechnicalSurvey } from '@/lib/types';
import {
  TechArea, AREA_LABEL, CONDITIONS, CONDITION_LABEL, SURVEY_MODE_LABEL,
  groupsForArea, identifierFields, assetDisplayIdentifier, validateIdentifier, findIdentityMatches,
} from '@/lib/technicalBase';
import { SurveyMode } from '@/lib/technicalBase';
import { upsertSurvey, finalizeSurvey } from '@/lib/technicalSurveys';
import { persistSurveyAsset, newAssetId } from '@/lib/surveyCapture';
import { reconcile, summarizeOpenSurvey, ReconRecord, ReconStatus } from '@/lib/reconciliation';
import { Badge } from '@/components/DataListRow';
import { showToast } from '@/components/ui/Feedback';
import { isSupabaseConfigured } from '@/lib/inventory';
import { EquipmentIdentifier, EquipmentIdentification } from '@/components/catalog/EquipmentIdentifier';
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
  assetId: string;         // pré-gerado p/ vincular fotos antes de salvar
  grupo: string; tipoAtivo: string; equip?: EquipmentIdentification; serial: string;
  localizacao: string; condicao: AssetConditionValue; values: Record<string, string>;
  photos: number;          // fotos já capturadas para este rascunho
}
const emptyDraft = (): Draft => ({ assetId: newAssetId(), grupo: '', tipoAtivo: '', equip: undefined, serial: '', localizacao: '', condicao: 'NORMAL', values: {}, photos: 0 });

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

  const fields = identifierFields(area);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [saving, setSaving] = useState(false);
  const [pendingMatch, setPendingMatch] = useState<{ draftAsset: any; matches: Device[] } | null>(null);

  const setV = (k: string, v: string) => setDraft((p) => ({ ...p, values: { ...p.values, [k]: v } }));

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

  const buildDeviceFromDraft = (id: string): Device => {
    const technicalAttributes: Record<string, unknown> = {};
    const dev: any = {
      id, clienteId, sistema: area, status: 'ativo',
      grupo: draft.grupo || undefined, tipoAtivo: draft.tipoAtivo || undefined,
      fabricante: draft.equip?.brand || undefined, modelo: draft.equip?.model || undefined,
      itemCatalogoId: draft.equip?.catalogItemId || undefined,
      serial: draft.serial || undefined, localizacao: draft.localizacao || undefined,
      condicao: draft.condicao, source: 'LEVANTAMENTO', sourceSurveyId: survey?.id,
    };
    for (const f of fields) {
      const v = (draft.values[f.key] || '').trim();
      if (!v) continue;
      if (f.store === 'attr') technicalAttributes[f.key] = v;
      else dev[f.store] = v;
    }
    dev.technicalAttributes = technicalAttributes;
    return dev as Device;
  };

  const draftAsset = () => {
    const ta: Record<string, string> = {};
    for (const f of fields) if (f.store === 'attr' && draft.values[f.key]) ta[f.key] = draft.values[f.key];
    return { central: fields.some(f=>f.store==='central') ? draft.values['central'] : undefined,
             laco: draft.values['laco'], endereco: draft.values['endereco'], technicalAttributes: ta };
  };

  const invalidField = fields.find((f) => !validateIdentifier(f.kind, draft.values[f.key] || ''));

  const onCapture = async (file: File) => {
    setShowCamera(false);
    if (!session) { showToast('Foto indisponível nesta sessão.'); return; }
    try {
      await captureSurveyEvidence({
        file, session, clientId: clienteId, clientName: clientName || 'Cliente',
        deviceId: draft.assetId, technicalSurveyId: survey?.id,
      });
      setDraft((p) => ({ ...p, photos: p.photos + 1 }));
      showToast('Foto anexada ao ativo.');
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
        verification: { deviceId: id, clienteId, surveyId: survey?.id, condicao: draft.condicao, reconciliation },
      });
      setCreatedThisVisit((p) => [...p, res.device]);
      if (reconciliation) setRecords((p) => [...p, { deviceId: id, reconciliation }]);
      showToast(res.mode === 'offline' ? 'Salvo offline (sincroniza depois).' : 'Ativo adicionado à Base Técnica.');
      onChanged();
      setDraft(goNext ? { ...emptyDraft(), grupo: draft.grupo, condicao: draft.condicao } : emptyDraft());
    } catch (e: any) { showToast(`Falha: ${e?.message || e}`); } finally { setSaving(false); }
  };

  const doVerifyExisting = async (existing: Device, altered: boolean, goNext: boolean) => {
    setSaving(true);
    try {
      // Atualiza campos só quando "alterado"; caso contrário preserva o existente (§6).
      const dev: Device = altered ? { ...existing, ...buildDeviceFromDraft(existing.id), id: existing.id } : { ...existing, condicao: draft.condicao };
      const reconciliation: ReconStatus = altered ? 'ALTERADO' : 'VERIFICADO';
      await persistSurveyAsset({
        device: dev, ownerUserId: currentUserId,
        verification: { deviceId: existing.id, clienteId, surveyId: survey?.id, condicao: draft.condicao, reconciliation },
      });
      setRecords((p) => [...p, { deviceId: existing.id, reconciliation }]);
      showToast(`Verificação registrada (${reconciliation === 'ALTERADO' ? 'alterado' : 'verificado'}).`);
      onChanged();
      setPendingMatch(null);
      setDraft(goNext ? { ...emptyDraft(), grupo: draft.grupo } : emptyDraft());
    } catch (e: any) { showToast(`Falha: ${e?.message || e}`); } finally { setSaving(false); }
  };

  const onSave = (goNext: boolean) => {
    if (invalidField) { showToast(`Valor inválido em "${invalidField.label}".`); return; }
    const asset = draftAsset();
    const matches = findIdentityMatches(area, asset, knownPool);
    if (matches.length === 1) { setPendingMatch({ draftAsset: asset, matches }); return; }
    if (matches.length > 1) { setPendingMatch({ draftAsset: asset, matches }); return; }
    doSaveNew(goNext);
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
              {/* Câmera como ação de topo (§26/§27): captura rápida, faz parte do cadastro. */}
              {session && (
                <button onClick={() => setShowCamera(true)} className="flex items-center justify-center gap-2 rounded-lg border border-primary bg-navy/5 px-3 py-3 text-sm font-bold text-primary">
                  <span className="material-symbols-outlined text-lg">photo_camera</span>
                  {draft.photos > 0 ? `Foto anexada (${draft.photos}) · adicionar outra` : 'Abrir câmera'}
                </button>
              )}
              {/* Formulário adaptativo à disciplina */}
              <div className="grid grid-cols-1 gap-3">
                <Field label="Grupo">
                  <select value={draft.grupo} onChange={(e) => setDraft((p) => ({ ...p, grupo: e.target.value }))} className={inputCls}>
                    <option value="">Selecione…</option>
                    {groupsForArea(area).map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </Field>
                <Field label="Tipo do ativo"><input value={draft.tipoAtivo} onChange={(e) => setDraft((p) => ({ ...p, tipoAtivo: e.target.value }))} className={inputCls} /></Field>
                {fields.map((f) => (
                  <Field key={f.key} label={f.label}>
                    <input value={draft.values[f.key] || ''} onChange={(e) => setV(f.key, e.target.value)} placeholder={f.placeholder}
                      className={`${inputCls} ${!validateIdentifier(f.kind, draft.values[f.key] || '') ? 'border-danger' : ''}`} />
                  </Field>
                ))}
                <Field label="Localização"><input value={draft.localizacao} onChange={(e) => setDraft((p) => ({ ...p, localizacao: e.target.value }))} className={inputCls} /></Field>
                {/* Fabricante/Modelo do catálogo técnico (§6/§7) + fallback manual (§9). */}
                <EquipmentIdentifier value={draft.equip} onChange={(v) => setDraft((p) => ({ ...p, equip: v }))} catalog={catalog} area={area} subcategory={draft.grupo || undefined} />
                <Field label="Condição constatada">
                  <select value={draft.condicao} onChange={(e) => setDraft((p) => ({ ...p, condicao: e.target.value as AssetConditionValue }))} className={inputCls}>
                    {CONDITIONS.map((c) => <option key={c} value={c}>{CONDITION_LABEL[c]}</option>)}
                  </select>
                </Field>
              </div>

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
          {phase === 'capture' && (
            <div className="flex gap-2">
              <button onClick={() => onSave(false)} disabled={saving} className="flex-1 rounded-lg border border-primary px-3 py-3 text-sm font-bold text-primary hover:bg-navy hover:text-white disabled:opacity-50">Salvar</button>
              <button onClick={() => onSave(true)} disabled={saving} className="flex-1 rounded-lg bg-primary px-3 py-3 text-sm font-bold text-white hover:bg-navy disabled:opacity-50">Salvar e próximo</button>
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
