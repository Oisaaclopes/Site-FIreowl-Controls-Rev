'use client';

import React, { useEffect, useState } from 'react';
import { Contract, ContractRoutine, ContractRoutineExecution, ContractHourEntry, ContractAttachment, ContractExecutionStatus } from '@/lib/types';
import { isSupabaseConfigured } from '@/lib/inventory';
import {
  fetchContractRoutines, upsertContractRoutine, deleteContractRoutine,
  fetchRoutineExecutions, ensureRoutineExecution, updateExecutionStatus,
  fetchHourLedger, addHourEntry, saldoBolsaHoras,
  fetchContractAttachments,
  proximaExecucaoRotina, generateOsFromExecution,
} from '@/lib/contractRoutines';

const inp = 'w-full border border-slate-200 rounded-lg p-2 text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#E63946]/20';
const lbl = 'block text-slate-500 mb-1 font-semibold uppercase text-[10px]';

const EXEC_LABEL: Record<ContractExecutionStatus, string> = {
  previsto: 'Previsto', agendado: 'Agendado', os_gerada: 'OS gerada', executado: 'Executado', relatorio_emitido: 'Relatório emitido', cancelado: 'Cancelado',
};
const EXEC_ORDER: ContractExecutionStatus[] = ['previsto', 'agendado', 'os_gerada', 'executado', 'relatorio_emitido'];

export const ContractDetailPanel: React.FC<{ contract: Contract; onClose: () => void }> = ({ contract, onClose }) => {
  const online = isSupabaseConfigured();
  const [tab, setTab] = useState<'rotinas' | 'horas' | 'docs'>('rotinas');
  const [routines, setRoutines] = useState<ContractRoutine[]>([]);
  const [execs, setExecs] = useState<ContractRoutineExecution[]>([]);
  const [hours, setHours] = useState<ContractHourEntry[]>([]);
  const [atts, setAtts] = useState<ContractAttachment[]>([]);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const load = async () => {
    if (!online) return;
    try {
      const [r, e, h, a] = await Promise.all([
        fetchContractRoutines(contract.id), fetchRoutineExecutions(contract.id),
        fetchHourLedger(contract.id), fetchContractAttachments(contract.id),
      ]);
      setRoutines(r); setExecs(e); setHours(h); setAtts(a);
    } catch (err) { setErro(err instanceof Error ? err.message : 'Falha ao carregar.'); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [contract.id]);

  // ---- Nova rotina ----
  const [nova, setNova] = useState<Partial<ContractRoutine>>({ tipo: 'preventiva', frequencia: 'mensal', diaRegra: 'primeiro_dia_util', qtdTecnicos: 1, ativo: true });
  const salvarRotina = async () => {
    setBusy(true); setErro(null);
    try {
      await upsertContractRoutine({ id: '', contractId: contract.id, tipo: nova.tipo || 'preventiva', frequencia: nova.frequencia, diaRegra: nova.diaRegra, horarioInicio: nova.horarioInicio, horarioFim: nova.horarioFim, qtdTecnicos: nova.qtdTecnicos, visitasMes: nova.visitasMes, horasMensais: nova.horasMensais, sla: nova.sla, area: nova.area, descricao: nova.descricao, ativo: nova.ativo ?? true });
      setNova({ tipo: 'preventiva', frequencia: 'mensal', diaRegra: 'primeiro_dia_util', qtdTecnicos: 1, ativo: true });
      await load();
    } catch (err) { setErro(err instanceof Error ? err.message : 'Falha ao salvar rotina.'); } finally { setBusy(false); }
  };
  const removerRotina = async (id: string) => {
    if (!window.confirm('Remover esta rotina? As execuções já geradas serão apagadas (o histórico de OS/relatórios permanece).')) return;
    setBusy(true);
    try { await deleteContractRoutine(id); await load(); } catch (err) { setErro(err instanceof Error ? err.message : 'Falha.'); } finally { setBusy(false); }
  };

  // ---- Materializa a PRÓXIMA competência (idempotente) ----
  const gerarProxima = async (r: ContractRoutine) => {
    setBusy(true); setErro(null);
    try {
      const existentes = execs.filter((e) => e.routineId === r.id).map((e) => e.competencia);
      const prox = proximaExecucaoRotina(r, existentes);
      if (!prox) { setErro('Sem próxima competência a programar (rotina sob demanda/inativa ou já programada).'); return; }
      const res = await ensureRoutineExecution(r.id, prox.competencia, prox.dataProgramada);
      if (res.alreadyExists) setErro(`Competência ${prox.competencia} já estava programada — nada duplicado.`);
      await load();
    } catch (err) { setErro(err instanceof Error ? err.message : 'Falha ao programar.'); } finally { setBusy(false); }
  };
  const avancar = async (e: ContractRoutineExecution) => {
    const idx = EXEC_ORDER.indexOf(e.status);
    if (idx < 0 || idx >= EXEC_ORDER.length - 1) return;
    const next = EXEC_ORDER[idx + 1];
    setBusy(true);
    try { await updateExecutionStatus(e.id, next); await load(); } catch (err) { setErro(err instanceof Error ? err.message : 'Falha.'); } finally { setBusy(false); }
  };
  // Gera OS a partir da competência (idempotente). Se já existir, apenas informa.
  const gerarOS = async (e: ContractRoutineExecution) => {
    setBusy(true); setErro(null);
    try {
      const res = await generateOsFromExecution(e.id);
      setErro(res.alreadyExisted ? `OS ${res.numero || ''} já existia para ${e.competencia} — nada duplicado.` : `OS ${res.numero || ''} gerada para ${e.competencia}.`);
      await load();
    } catch (err) { setErro(err instanceof Error ? err.message : 'Falha ao gerar OS.'); } finally { setBusy(false); }
  };

  // ---- Bolsa de horas ----
  const saldo = saldoBolsaHoras(hours);
  const [he, setHe] = useState<{ tipo: ContractHourEntry['tipo']; horas: number; referencia: string }>({ tipo: 'consumida', horas: 1, referencia: '' });
  const lancarHoras = async () => {
    if (!he.horas) return;
    setBusy(true); setErro(null);
    try { await addHourEntry({ contractId: contract.id, tipo: he.tipo, horas: Number(he.horas), referencia: he.referencia || undefined, data: new Date().toISOString().slice(0, 10) }); setHe({ tipo: 'consumida', horas: 1, referencia: '' }); await load(); }
    catch (err) { setErro(err instanceof Error ? err.message : 'Falha.'); } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-3xl rounded-2xl border border-slate-200 shadow-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div className="min-w-0">
            <h3 className="font-bold text-[#0B1E38] uppercase text-sm truncate">{contract.clientName}</h3>
            <p className="text-[11px] text-slate-400 font-data-mono">{contract.numero || contract.id}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 font-bold text-xl">✕</button>
        </div>

        {!online ? (
          <div className="p-8 text-center text-xs text-slate-400">Rotinas, agenda, bolsa de horas e documentos exigem o Supabase configurado.</div>
        ) : (
          <>
            <div className="flex gap-1 p-2 bg-slate-100 m-4 rounded-lg w-fit">
              {(['rotinas', 'horas', 'docs'] as const).map((t) => (
                <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded-md text-xs font-semibold uppercase ${tab === t ? 'bg-slate-900 text-white' : 'text-slate-600'}`}>
                  {t === 'rotinas' ? 'Rotinas & Agenda' : t === 'horas' ? 'Bolsa de horas' : 'Documentos'}
                </button>
              ))}
            </div>
            {erro && <p className="mx-4 mb-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{erro}</p>}

            <div className="overflow-y-auto px-4 pb-4 space-y-4">
              {tab === 'rotinas' && (
                <>
                  {/* Nova rotina */}
                  <div className="rounded-xl border border-slate-200 p-3">
                    <p className="text-[11px] font-bold uppercase text-[#0B1E38] mb-2">Nova rotina</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      <div><label className={lbl}>Tipo</label><select value={nova.tipo} onChange={(e) => setNova((n) => ({ ...n, tipo: e.target.value }))} className={inp}><option value="preventiva">Preventiva</option><option value="corretiva">Corretiva</option><option value="inspecao">Inspeção</option><option value="operacao">Operação</option><option value="suporte">Suporte</option></select></div>
                      <div><label className={lbl}>Frequência</label><select value={nova.frequencia} onChange={(e) => setNova((n) => ({ ...n, frequencia: e.target.value }))} className={inp}><option value="mensal">Mensal</option><option value="bimestral">Bimestral</option><option value="trimestral">Trimestral</option><option value="semestral">Semestral</option><option value="anual">Anual</option><option value="sob_demanda">Sob demanda</option></select></div>
                      <div><label className={lbl}>Dia</label><select value={nova.diaRegra} onChange={(e) => setNova((n) => ({ ...n, diaRegra: e.target.value }))} className={inp}><option value="primeiro_dia_util">Primeiro dia útil</option><option value="ultimo_dia_util">Último dia útil</option><option value="primeira_seg">Primeira segunda</option><option value="dia_fixo:5">Dia fixo 5</option><option value="dia_fixo:10">Dia fixo 10</option><option value="dia_fixo:15">Dia fixo 15</option></select></div>
                      <div><label className={lbl}>Início</label><input type="time" value={nova.horarioInicio || ''} onChange={(e) => setNova((n) => ({ ...n, horarioInicio: e.target.value }))} className={inp} /></div>
                      <div><label className={lbl}>Fim</label><input type="time" value={nova.horarioFim || ''} onChange={(e) => setNova((n) => ({ ...n, horarioFim: e.target.value }))} className={inp} /></div>
                      <div><label className={lbl}>Técnicos</label><input type="number" min={1} value={nova.qtdTecnicos ?? 1} onChange={(e) => setNova((n) => ({ ...n, qtdTecnicos: Number(e.target.value) }))} className={inp} /></div>
                      <div><label className={lbl}>Visitas/mês</label><input type="number" min={0} value={nova.visitasMes ?? ''} onChange={(e) => setNova((n) => ({ ...n, visitasMes: e.target.value === '' ? undefined : Number(e.target.value) }))} className={inp} /></div>
                      <div><label className={lbl}>Horas/mês</label><input type="number" min={0} value={nova.horasMensais ?? ''} onChange={(e) => setNova((n) => ({ ...n, horasMensais: e.target.value === '' ? undefined : Number(e.target.value) }))} className={inp} /></div>
                      <div><label className={lbl}>Área</label><input value={nova.area || ''} onChange={(e) => setNova((n) => ({ ...n, area: e.target.value }))} placeholder="SDAI…" className={inp} /></div>
                    </div>
                    <div className="mt-2"><label className={lbl}>SLA (texto)</label><input value={nova.sla || ''} onChange={(e) => setNova((n) => ({ ...n, sla: e.target.value }))} className={inp} placeholder="Ex.: Emergência em 4h" /></div>
                    <button disabled={busy} onClick={salvarRotina} className="mt-3 bg-[#0B1E38] hover:bg-[#13315C] disabled:opacity-40 text-white text-xs font-bold uppercase rounded-lg px-4 py-2">Adicionar rotina</button>
                  </div>

                  {routines.length === 0 ? (
                    <p className="text-center text-xs text-slate-400 py-6">Nenhuma rotina cadastrada.</p>
                  ) : routines.map((r) => {
                    const rExecs = execs.filter((e) => e.routineId === r.id);
                    return (
                      <div key={r.id} className="rounded-xl border border-slate-200 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-800 uppercase">{r.tipo} · {r.frequencia}{r.area ? ` · ${r.area}` : ''}</p>
                            <p className="text-[11px] text-slate-500">{[r.diaRegra?.replace(/_/g, ' '), r.horarioInicio && `${r.horarioInicio}–${r.horarioFim || ''}`, r.qtdTecnicos && `${r.qtdTecnicos} técnico(s)`, r.visitasMes && `${r.visitasMes} visita(s)/mês`, r.sla && `SLA: ${r.sla}`].filter(Boolean).join(' · ')}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button disabled={busy} onClick={() => gerarProxima(r)} className="text-[10px] font-bold uppercase text-emerald-700 border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 rounded-lg px-2.5 py-1.5 inline-flex items-center gap-1"><span className="material-symbols-outlined text-sm">event_available</span>Programar próxima</button>
                            <button onClick={() => removerRotina(r.id)} className="text-slate-400 hover:text-[#E63946] p-1"><span className="material-symbols-outlined text-base">delete</span></button>
                          </div>
                        </div>
                        {rExecs.length > 0 && (
                          <div className="mt-2 border-t border-slate-100 pt-2 space-y-1">
                            {rExecs.map((e) => (
                              <div key={e.id} className="flex items-center justify-between gap-2 text-[11px]">
                                <span className="font-data-mono text-slate-600">{e.competencia}{e.dataProgramada ? ` · ${e.dataProgramada}` : ''}</span>
                                <div className="flex items-center gap-2">
                                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${e.status === 'relatorio_emitido' || e.status === 'executado' ? 'bg-emerald-50 text-emerald-700' : e.status === 'cancelado' ? 'bg-slate-100 text-slate-400' : 'bg-sky-50 text-sky-700'}`}>{EXEC_LABEL[e.status]}</span>
                                  {(e.status === 'previsto' || e.status === 'agendado') && (
                                    <button disabled={busy} onClick={() => gerarOS(e)} className="text-[10px] font-bold uppercase text-emerald-700 hover:text-emerald-900 inline-flex items-center gap-0.5"><span className="material-symbols-outlined text-sm">assignment_add</span>Gerar OS</button>
                                  )}
                                  {e.status === 'os_gerada' && (
                                    <button disabled={busy} onClick={() => avancar(e)} className="text-[10px] font-bold uppercase text-slate-400 hover:text-[#1A1A72]">marcar executado →</button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <p className="text-[10px] text-slate-400">A rotina define a recorrência; a agenda materializa apenas a próxima competência, sem duplicar nem criar OS antecipadamente. A geração de OS a partir de uma competência entra na etapa de Agenda.</p>
                </>
              )}

              {tab === 'horas' && (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-center"><p className="text-[9px] uppercase text-slate-400">Contratada</p><p className="font-data-mono font-bold text-slate-800">{saldo.contratada}h</p></div>
                    <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-center"><p className="text-[9px] uppercase text-slate-400">Consumida</p><p className="font-data-mono font-bold text-[#E63946]">{saldo.consumida}h</p></div>
                    <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-center"><p className="text-[9px] uppercase text-emerald-600">Saldo</p><p className="font-data-mono font-bold text-emerald-700">{saldo.saldo}h</p></div>
                  </div>
                  <div className="rounded-xl border border-slate-200 p-3 grid grid-cols-[auto_1fr_2fr_auto] gap-2 items-end">
                    <div><label className={lbl}>Tipo</label><select value={he.tipo} onChange={(e) => setHe((h) => ({ ...h, tipo: e.target.value as ContractHourEntry['tipo'] }))} className={inp}><option value="contratada">Contratada</option><option value="consumida">Consumida</option><option value="ajuste">Ajuste</option></select></div>
                    <div><label className={lbl}>Horas</label><input type="number" step="0.5" value={he.horas} onChange={(e) => setHe((h) => ({ ...h, horas: Number(e.target.value) }))} className={inp} /></div>
                    <div><label className={lbl}>Referência</label><input value={he.referencia} onChange={(e) => setHe((h) => ({ ...h, referencia: e.target.value }))} placeholder="Ex.: OS-2026-0091 / preventiva set" className={inp} /></div>
                    <button disabled={busy} onClick={lancarHoras} className="bg-[#0B1E38] hover:bg-[#13315C] disabled:opacity-40 text-white text-xs font-bold uppercase rounded-lg px-3 py-2">Lançar</button>
                  </div>
                  {hours.length === 0 ? <p className="text-center text-xs text-slate-400 py-6">Nenhum lançamento.</p> : (
                    <ul className="divide-y divide-slate-100">
                      {hours.map((e) => (
                        <li key={e.id} className="py-2 flex items-center justify-between text-[11px]">
                          <span><span className={`font-bold uppercase ${e.tipo === 'consumida' ? 'text-[#E63946]' : 'text-emerald-700'}`}>{e.tipo}</span> <span className="text-slate-500">{e.referencia || ''}</span></span>
                          <span className="font-data-mono text-slate-600">{e.tipo === 'consumida' ? '−' : '+'}{Math.abs(e.horas)}h · {e.data}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}

              {tab === 'docs' && (
                <>
                  {contract.sourcePedidoId && (
                    <div className="rounded-lg bg-indigo-50 border border-indigo-100 px-3 py-2 text-[11px] text-indigo-900">Proposta de origem vinculada: <span className="font-data-mono font-bold">{contract.sourcePedidoId}</span></div>
                  )}
                  {atts.length === 0 ? (
                    <p className="text-center text-xs text-slate-400 py-6">Nenhum documento anexado.</p>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {atts.map((a) => (
                        <li key={a.id} className="py-2 flex items-center justify-between text-[11px]">
                          <span className="text-slate-700"><span className="font-bold uppercase">{a.tipo}</span> · {a.nome || a.storagePath}</span>
                          <span className="text-slate-400 font-data-mono">{a.createdAt?.slice(0, 10)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="text-[10px] text-slate-400">Os anexos reutilizam o bucket privado <b>report-media</b> (caminho <span className="font-data-mono">contracts/{contract.id}/…</span>). O upload de arquivos entra na sequência, reaproveitando o mesmo fluxo de mídia dos relatórios.</p>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
