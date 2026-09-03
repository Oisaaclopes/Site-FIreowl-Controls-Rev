'use client';
import { requestConfirm, showToast } from '@/components/ui/Feedback';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FieldOperation,
  FieldOperationAssignment,
  FieldOperationStatus,
  FieldOperationType,
} from '@/lib/types';
import { Badge } from '@/components/DataListRow';
import { isSupabaseConfigured } from '@/lib/inventory';
import { fetchAssignableTechnicians, ManagedUser } from '@/lib/users';
import {
  fetchFieldOperations,
  fetchFieldOperationAssignments,
  createFieldOperation,
  updateFieldOperation,
  assignTechnicianToOperation,
  endFieldOperationAssignment,
  planAssignmentReconcile,
  applyOperationStatus,
} from '@/lib/fieldOperationsDomain';

const inp = 'w-full border border-border rounded-lg p-2 text-xs text-fg bg-surface focus:outline-none focus:ring-2 focus:ring-primary/20';
const lbl = 'block text-fg-secondary mb-1 font-semibold uppercase text-[10px]';

const OPERATION_TYPES: FieldOperationType[] = ['AUDITORIA', 'PREVENTIVA', 'OPERACAO_RESIDENTE', 'INSPECAO', 'ACOMPANHAMENTO', 'OUTRO'];
const OPERATION_STATUSES: FieldOperationStatus[] = ['PLANEJADA', 'ATIVA', 'PAUSADA', 'ENCERRADA'];

const STATUS_TONE: Record<FieldOperationStatus, 'emerald' | 'amber' | 'red' | 'slate'> = {
  ATIVA: 'emerald', PAUSADA: 'amber', ENCERRADA: 'red', PLANEJADA: 'slate',
};

const humanize = (v: string) => v.replace(/_/g, ' ');
const today = () => new Date().toISOString().slice(0, 10);

interface FormState {
  id?: string;
  name: string;
  operationType: FieldOperationType;
  status: FieldOperationStatus;
  startDate: string;
  endDate: string;
  description: string;
  externalReference: string;
  externalSystemUrl: string;
  techIds: string[]; // conjunto que deve ficar ATIVO
}

const emptyForm = (): FormState => ({
  name: '', operationType: 'AUDITORIA', status: 'ATIVA', startDate: today(), endDate: '',
  description: '', externalReference: '', externalSystemUrl: '', techIds: [],
});

interface Props {
  clientId?: string;
  contractId?: string;
  /** Rótulo de contexto exibido no formulário (ex.: nome do cliente/contrato). */
  contextLabel?: string;
  /** Gestor/Admin administra; técnico apenas visualiza (RLS reforça no servidor). */
  canManage: boolean;
}

export const FieldOperationsManager: React.FC<Props> = ({ clientId, contractId, contextLabel, canManage }) => {
  const online = isSupabaseConfigured();
  const [operations, setOperations] = useState<FieldOperation[]>([]);
  const [assignments, setAssignments] = useState<FieldOperationAssignment[]>([]);
  const [techs, setTechs] = useState<ManagedUser[]>([]);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);

  const techName = useCallback(
    (id: string) => techs.find((t) => t.id === id)?.name || 'Técnico',
    [techs]
  );

  const load = useCallback(async () => {
    if (!online) return;
    try {
      // Escopo: por contrato quando em contexto de contrato; senão por cliente.
      const ops = contractId
        ? await fetchFieldOperations({ contractId })
        : clientId
          ? await fetchFieldOperations({ clientId })
          : [];
      setOperations(ops);
      const ids = ops.map((o) => o.id);
      if (ids.length > 0) {
        const all = await fetchFieldOperationAssignments();
        setAssignments(all.filter((a) => ids.includes(a.operationId)));
      } else {
        setAssignments([]);
      }
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao carregar operações.');
    }
  }, [online, clientId, contractId]);

  useEffect(() => { void load(); }, [load]);

  // Técnicos elegíveis só são necessários para quem administra.
  useEffect(() => {
    if (!online || !canManage) return;
    let alive = true;
    fetchAssignableTechnicians().then((list) => { if (alive) setTechs(list); }).catch(() => {});
    return () => { alive = false; };
  }, [online, canManage]);

  const activeAssignments = useMemo(
    () => assignments.filter((a) => a.status === 'ATIVO'),
    [assignments]
  );
  const activeTechIdsFor = useCallback(
    (operationId: string) => activeAssignments.filter((a) => a.operationId === operationId).map((a) => a.technicianId),
    [activeAssignments]
  );

  const openCreate = () => { setErro(null); setForm(emptyForm()); };
  const openEdit = (op: FieldOperation) => {
    setErro(null);
    setForm({
      id: op.id,
      name: op.name,
      operationType: op.operationType,
      status: op.status,
      startDate: op.startDate || today(),
      endDate: op.endDate || '',
      description: op.description || '',
      externalReference: op.externalReference || '',
      externalSystemUrl: op.externalSystemUrl || '',
      techIds: activeTechIdsFor(op.id),
    });
  };

  /** Sincroniza as alocações da operação com o conjunto escolhido no formulário,
   *  preservando histórico (encerra em vez de excluir). §3/§8. */
  const reconcileAssignments = async (operationId: string, desired: string[]) => {
    const current = assignments.filter((a) => a.operationId === operationId);
    const plan = planAssignmentReconcile(current, desired);
    for (const id of plan.toAssign) await assignTechnicianToOperation(operationId, id);
    for (const a of plan.toEnd) await endFieldOperationAssignment(a.id); // encerra, não apaga
  };

  const saveForm = async () => {
    if (!form) return;
    if (!form.name.trim()) { setErro('Informe o nome da operação.'); return; }
    setBusy(true); setErro(null);
    try {
      const base: FieldOperation = {
        id: form.id || '',
        clientId: clientId || undefined,
        contractId: contractId || undefined,
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        operationType: form.operationType,
        status: form.status,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        externalSystemUrl: form.externalSystemUrl.trim() || undefined,
        externalReference: form.externalReference.trim() || undefined,
      };
      const saved = form.id ? await updateFieldOperation(base) : await createFieldOperation(base);
      await reconcileAssignments(saved.id, form.techIds);
      showToast(form.id ? 'Operação atualizada.' : 'Operação criada.', 'success');
      setForm(null);
      await load();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao salvar a operação.');
    } finally {
      setBusy(false);
    }
  };

  const changeStatus = async (op: FieldOperation, status: FieldOperationStatus) => {
    setBusy(true); setErro(null);
    try {
      // Ao encerrar, registra a data de término se ainda não houver (§7).
      await updateFieldOperation(applyOperationStatus(op, status));
      await load();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Falha ao atualizar status.');
    } finally {
      setBusy(false);
    }
  };

  const toggleFormTech = (id: string) => {
    setForm((f) => f ? { ...f, techIds: f.techIds.includes(id) ? f.techIds.filter((x) => x !== id) : [...f.techIds, id] } : f);
  };

  if (!online) {
    return <p className="text-center text-xs text-fg-muted py-6">A gestão de operações de campo exige o Supabase configurado.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-bold uppercase tracking-wider text-fg-secondary">Operações de campo ({operations.length})</p>
        {canManage && !form && (
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-1 rounded-lg bg-primary hover:bg-primary-hover text-white text-[11px] font-bold uppercase tracking-wide px-3 py-1.5 transition-colors"
          >
            <span className="material-symbols-outlined text-sm">add</span> Nova operação
          </button>
        )}
      </div>

      {erro && <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{erro}</p>}

      {/* Formulário (criação/edição) — agrupado: OPERAÇÃO / ALOCADOS / SISTEMA. */}
      {form && (
        <div className="rounded-xl border border-border bg-surface-2 p-3 space-y-4">
          {contextLabel && <p className="text-[10px] text-fg-muted">Contexto: <span className="font-semibold text-fg-secondary">{contextLabel}</span></p>}

          {/* --- OPERAÇÃO --- */}
          <div>
            <p className="text-[10px] font-bold uppercase text-primary mb-2">Operação</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <div className="col-span-2 md:col-span-3">
                <label className={lbl}>Nome *</label>
                <input value={form.name} onChange={(e) => setForm((f) => f && { ...f, name: e.target.value })} className={inp} placeholder="Ex.: Auditoria SDAI" />
              </div>
              <div>
                <label className={lbl}>Tipo *</label>
                <select value={form.operationType} onChange={(e) => setForm((f) => f && { ...f, operationType: e.target.value as FieldOperationType })} className={inp}>
                  {OPERATION_TYPES.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Status *</label>
                <select value={form.status} onChange={(e) => setForm((f) => f && { ...f, status: e.target.value as FieldOperationStatus })} className={inp}>
                  {OPERATION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className={lbl}>Início *</label>
                <input type="date" value={form.startDate} onChange={(e) => setForm((f) => f && { ...f, startDate: e.target.value })} className={inp} />
              </div>
              <div>
                <label className={lbl}>Término</label>
                <input type="date" value={form.endDate} onChange={(e) => setForm((f) => f && { ...f, endDate: e.target.value })} className={inp} />
              </div>
              <div className="col-span-2 md:col-span-3">
                <label className={lbl}>Descrição</label>
                <textarea value={form.description} onChange={(e) => setForm((f) => f && { ...f, description: e.target.value })} className={`${inp} min-h-[52px]`} placeholder="Atividade recorrente executada no cliente…" />
              </div>
            </div>
          </div>

          {/* --- ALOCADOS --- */}
          <div>
            <p className="text-[10px] font-bold uppercase text-primary mb-2">Técnicos alocados</p>
            {techs.length === 0 ? (
              <p className="text-[11px] text-fg-muted">Nenhum técnico elegível disponível.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {techs.map((t) => {
                  const on = form.techIds.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggleFormTech(t.id)}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${on ? 'border-primary bg-primary-soft text-primary' : 'border-border bg-surface text-fg-secondary hover:border-border-strong'}`}
                    >
                      {on ? '✓ ' : '+ '}{t.name}{t.cargo ? ` · ${t.cargo}` : ''}
                    </button>
                  );
                })}
              </div>
            )}
            <p className="mt-1 text-[10px] text-fg-muted">Remover um técnico encerra a alocação e preserva o histórico do período.</p>
          </div>

          {/* --- SISTEMA EXTERNO --- */}
          <div>
            <p className="text-[10px] font-bold uppercase text-primary mb-2">Sistema externo (opcional)</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <div>
                <label className={lbl}>Nome / referência</label>
                <input value={form.externalReference} onChange={(e) => setForm((f) => f && { ...f, externalReference: e.target.value })} className={inp} placeholder="Ex.: Auditoria Catuaí" />
              </div>
              <div>
                <label className={lbl}>URL</label>
                <input type="url" value={form.externalSystemUrl} onChange={(e) => setForm((f) => f && { ...f, externalSystemUrl: e.target.value })} className={inp} placeholder="https://…" />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-1">
            <button disabled={busy} onClick={() => setForm(null)} className="text-xs font-semibold text-fg-secondary px-3 py-2 rounded-lg hover:bg-surface-3">Cancelar</button>
            <button disabled={busy} onClick={saveForm} className="bg-primary hover:bg-primary-hover disabled:opacity-40 text-white text-xs font-bold uppercase rounded-lg px-4 py-2">{busy ? 'Salvando…' : form.id ? 'Salvar alterações' : 'Criar operação'}</button>
          </div>
        </div>
      )}

      {/* Lista de operações */}
      {operations.length === 0 && !form ? (
        <p className="text-center text-xs text-fg-muted py-6">Nenhuma operação de campo cadastrada.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {operations.map((op) => {
            const opTechs = activeTechIdsFor(op.id);
            return (
              <div key={op.id} className="rounded-xl border border-border bg-surface p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-fg">{op.name}</span>
                      <Badge color={STATUS_TONE[op.status]}>{op.status}</Badge>
                    </div>
                    <p className="mt-0.5 text-[11px] text-fg-secondary">
                      {humanize(op.operationType)}
                      {op.startDate ? ` · desde ${new Date(op.startDate).toLocaleDateString('pt-BR')}` : ''}
                      {op.endDate ? ` · até ${new Date(op.endDate).toLocaleDateString('pt-BR')}` : ''}
                    </p>
                    {opTechs.length > 0 && (
                      <p className="mt-0.5 text-[11px] font-medium text-fg-secondary">{opTechs.map(techName).join(', ')}</p>
                    )}
                    {op.externalSystemUrl && (
                      <a href={op.externalSystemUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline">
                        <span className="material-symbols-outlined text-sm">open_in_new</span>{op.externalReference || 'Abrir sistema externo'}
                      </a>
                    )}
                  </div>
                  {canManage && (
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <button onClick={() => openEdit(op)} className="text-[11px] font-bold uppercase text-primary hover:underline">Editar</button>
                      <div className="flex items-center gap-1.5">
                        {op.status === 'ATIVA' && (
                          <button disabled={busy} onClick={() => changeStatus(op, 'PAUSADA')} className="text-[10px] font-semibold uppercase text-amber-700 hover:underline">Pausar</button>
                        )}
                        {op.status === 'PAUSADA' && (
                          <button disabled={busy} onClick={() => changeStatus(op, 'ATIVA')} className="text-[10px] font-semibold uppercase text-emerald-700 hover:underline">Retomar</button>
                        )}
                        {op.status !== 'ENCERRADA' && (
                          <button
                            disabled={busy}
                            onClick={async () => { if (await requestConfirm(`Encerrar a operação “${op.name}”? O histórico é preservado.`)) void changeStatus(op, 'ENCERRADA'); }}
                            className="text-[10px] font-semibold uppercase text-danger hover:underline"
                          >
                            Encerrar
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
