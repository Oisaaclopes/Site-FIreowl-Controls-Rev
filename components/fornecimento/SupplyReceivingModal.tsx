'use client';
import { requestConfirm } from '@/components/ui/Feedback';

import React, { useEffect, useMemo, useState } from 'react';
import { SupplyOrder, InventoryItem, SupplyReceipt, RejectionReason } from '@/lib/types';
import { fetchReceipts, createReceipt, postReceiptToStock, syncSupplyOrderStatus, recebidoPorChave, keyOf, validaConferencia, excedente, PostItemResult } from '@/lib/supplyReceipts';
import { isSupabaseConfigured } from '@/lib/inventory';

interface Props {
  order: SupplyOrder;
  inventory: InventoryItem[];
  currentUserName?: string;
  onClose: () => void;
  /** Chamado após a entrada no estoque (para o pai recarregar estoque/pedidos). */
  onPosted?: () => void;
}

const REJEITO_MOTIVOS: { id: RejectionReason; label: string }[] = [
  { id: 'avariado', label: 'Avariado' },
  { id: 'produto_incorreto', label: 'Produto incorreto' },
  { id: 'quantidade_divergente', label: 'Quantidade divergente' },
  { id: 'modelo_divergente', label: 'Modelo divergente' },
  { id: 'embalagem_comprometida', label: 'Embalagem comprometida' },
  { id: 'faltante', label: 'Faltante' },
  { id: 'outro', label: 'Outro' },
];

interface Row {
  key: string;
  inventoryItemId?: string;
  vinculado: boolean;
  descricao: string;
  pedido: number;
  recebidoAntes: number;
  pendente: number;
  estoqueAtual?: number;
  receberAgora: number;
  aceito: number;
  rejeitado: number;
  motivo?: RejectionReason;
  custo?: number;
}

const money = (n?: number) => (n || n === 0 ? `R$ ${Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—');

export const SupplyReceivingModal: React.FC<Props> = ({ order, inventory, currentUserName, onClose, onPosted }) => {
  const online = isSupabaseConfigured();
  const [step, setStep] = useState<'receber' | 'conferencia' | 'entrada' | 'done'>('receber');
  const [receipts, setReceipts] = useState<SupplyReceipt[] | null>(null);
  const [fornecedor, setFornecedor] = useState(order.supplier || '');
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<PostItemResult[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // Carrega recebimentos anteriores e monta as linhas dos materiais.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const recs = online ? await fetchReceipts(order.id) : [];
        if (!alive) return;
        setReceipts(recs);
        const jaRecebido = recebidoPorChave(recs);
        const base: Row[] = (order.items || [])
          .map((it, i) => ({ it, i }))
          .filter((x) => x.it.tipo !== 'servico')
          .map(({ it, i }) => {
            const key = keyOf(it, i);
            const inv = it.vinculoEstoqueId ? inventory.find((s) => s.id === it.vinculoEstoqueId) : undefined;
            const pedido = Number(it.quantidade || 0);
            const recebidoAntes = jaRecebido[key] || 0;
            const pendente = Math.max(0, pedido - recebidoAntes);
            return {
              key,
              inventoryItemId: it.vinculoEstoqueId,
              vinculado: !!inv,
              descricao: it.descricao || inv?.name || 'Item',
              pedido,
              recebidoAntes,
              pendente,
              estoqueAtual: inv?.quantity,
              receberAgora: pendente, // sugestão (usuário confere §8)
              aceito: pendente,
              rejeitado: 0,
              custo: it.precoUnitario || undefined,
            };
          });
        setRows(base);
      } catch (e: any) {
        if (alive) setErro(e?.message || 'Falha ao carregar recebimentos.');
      }
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id]);

  const set = (key: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const receberRows = useMemo(() => rows.filter((r) => r.receberAgora > 0), [rows]);
  const excedentes = useMemo(() => rows.filter((r) => excedente(r.pendente, r.receberAgora) > 0), [rows]);
  const conferenciaOk = receberRows.every((r) => validaConferencia(r.receberAgora, r.aceito, r.rejeitado) && (r.rejeitado === 0 || !!r.motivo));

  const avancarReceber = async () => {
    if (excedentes.length > 0 && !await requestConfirm(`Alguns itens excedem o previsto (${excedentes.map((r) => r.descricao).join(', ')}). Deseja continuar mesmo assim?`)) return;
    // sincroniza aceito = receberAgora ao entrar na conferência
    setRows((rs) => rs.map((r) => ({ ...r, aceito: r.receberAgora, rejeitado: 0, motivo: undefined })));
    setStep('conferencia');
  };

  const confirmarEntrada = async () => {
    if (!online) { setErro('Conecte-se à internet para confirmar a entrada no estoque.'); return; }
    if (busy) return;
    setBusy(true);
    setErro(null);
    try {
      const receipt = await createReceipt(
        { supplyOrderId: order.id, supplier: fornecedor || undefined, receivedAt: new Date().toISOString(), receivedBy: currentUserName, status: 'conferido' },
        receberRows.map((r) => ({
          orderItemKey: r.key,
          inventoryItemId: r.vinculado ? r.inventoryItemId : undefined,
          descricao: r.descricao,
          quantityReceived: r.receberAgora,
          quantityAccepted: r.aceito,
          quantityRejected: r.rejeitado,
          rejectionReason: r.rejeitado > 0 ? r.motivo : undefined,
          unitCost: r.custo,
        }))
      );
      const res = await postReceiptToStock(receipt, currentUserName);
      try { await syncSupplyOrderStatus(order); } catch { /* status derivado é best-effort */ }
      setResults(res);
      setStep('done');
      onPosted?.();
    } catch (e: any) {
      setErro(e?.message || 'Não foi possível concluir a entrada no estoque.');
    } finally {
      setBusy(false);
    }
  };

  const th = 'text-[10px] font-bold uppercase tracking-wide text-fg-muted px-2 py-1 text-left';
  const td = 'px-2 py-1.5 text-xs text-fg-secondary';
  const inputMini = 'w-16 border border-border-strong rounded px-1.5 py-1 text-xs text-right font-data-mono';

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div className="bg-surface w-full max-w-3xl rounded-2xl border border-border shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        <div className="bg-navy-3 text-white p-4 px-5 flex items-center justify-between shrink-0">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wide">Registrar recebimento</h3>
            <p className="text-[11px] text-fg-muted">{order.id} · {order.clientName}</p>
          </div>
          <button onClick={onClose} className="text-fg-muted hover:text-white p-1"><span className="material-symbols-outlined">close</span></button>
        </div>

        {/* stepper */}
        <div className="flex items-center gap-2 px-5 py-2 border-b border-border text-[10px] font-bold uppercase tracking-wide shrink-0">
          {(['receber', 'conferencia', 'entrada'] as const).map((s, i) => (
            <span key={s} className={`px-2 py-0.5 rounded ${step === s || (step === 'done' && s === 'entrada') ? 'bg-navy-3 text-white' : 'text-fg-muted'}`}>{i + 1}. {s === 'receber' ? 'Receber' : s === 'conferencia' ? 'Conferência' : 'Entrada'}</span>
          ))}
        </div>

        <div className="p-5 overflow-y-auto">
          {erro && <div className="mb-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded-lg p-2.5">{erro}</div>}
          {!online && <div className="mb-3 text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-2.5">Sem conexão com o servidor. A entrada no estoque exige internet.</div>}
          {receipts === null && online ? (
            <p className="text-xs text-fg-muted">Carregando…</p>
          ) : step === 'receber' ? (
            <>
              <div className="mb-3">
                <label className="block text-[10px] font-bold uppercase text-fg-secondary mb-1">Fornecedor (deste recebimento)</label>
                <input value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} placeholder="Nome do fornecedor" className="w-full border border-border-strong rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px]">
                  <thead><tr className="border-b border-border"><th className={th}>Produto</th><th className={th}>Pedido</th><th className={th}>Recebido</th><th className={th}>Pendente</th><th className={th}>Estoque</th><th className={th}>Receber agora</th></tr></thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.key} className="border-b border-border">
                        <td className={td}><div className="font-semibold text-fg">{r.descricao}</div>{!r.vinculado && <span className="text-[10px] text-amber-600">não vinculado ao estoque</span>}</td>
                        <td className={`${td} text-center font-data-mono`}>{r.pedido}</td>
                        <td className={`${td} text-center font-data-mono text-fg-muted`}>{r.recebidoAntes}</td>
                        <td className={`${td} text-center font-data-mono font-bold`}>{r.pendente}</td>
                        <td className={`${td} text-center font-data-mono text-fg-muted`}>{r.estoqueAtual ?? '—'}</td>
                        <td className={`${td} text-right`}><input type="number" min={0} value={r.receberAgora} onChange={(e) => set(r.key, { receberAgora: Math.max(0, Number(e.target.value) || 0) })} className={`${inputMini} ${excedente(r.pendente, r.receberAgora) > 0 ? 'border-amber-400 bg-amber-50' : ''}`} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {excedentes.length > 0 && <p className="mt-2 text-[11px] text-amber-700">⚠ Alguns itens excedem o previsto — exigirá confirmação.</p>}
            </>
          ) : step === 'conferencia' ? (
            <div className="space-y-3">
              <p className="text-[11px] text-fg-secondary">Confira o que foi aceito e o que foi rejeitado. <b>Aceito + Rejeitado = Recebido.</b></p>
              {receberRows.map((r) => {
                const ok = validaConferencia(r.receberAgora, r.aceito, r.rejeitado);
                return (
                  <div key={r.key} className="rounded-lg border border-border p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-fg">{r.descricao}</p>
                      <span className="text-[10px] font-data-mono text-fg-muted">Recebido: {r.receberAgora}</span>
                    </div>
                    {!r.vinculado && <p className="text-[10px] text-amber-600 mt-0.5">Produto não vinculado ao estoque — será registrado no recebimento, mas não dará entrada até ser vinculado.</p>}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 items-end">
                      <div><label className="block text-[9px] uppercase text-fg-muted mb-0.5">Aceito</label><input type="number" min={0} value={r.aceito} onChange={(e) => set(r.key, { aceito: Math.max(0, Number(e.target.value) || 0) })} className={`${inputMini} w-full`} /></div>
                      <div><label className="block text-[9px] uppercase text-fg-muted mb-0.5">Rejeitado</label><input type="number" min={0} value={r.rejeitado} onChange={(e) => set(r.key, { rejeitado: Math.max(0, Number(e.target.value) || 0) })} className={`${inputMini} w-full`} /></div>
                      <div><label className="block text-[9px] uppercase text-fg-muted mb-0.5">Custo un.</label><input type="number" min={0} step="0.01" value={r.custo ?? ''} onChange={(e) => set(r.key, { custo: e.target.value === '' ? undefined : Number(e.target.value) })} className={`${inputMini} w-full`} /></div>
                      {r.rejeitado > 0 && <div><label className="block text-[9px] uppercase text-fg-muted mb-0.5">Motivo</label><select value={r.motivo || ''} onChange={(e) => set(r.key, { motivo: (e.target.value || undefined) as RejectionReason })} className="w-full border border-border-strong rounded px-1 py-1 text-xs"><option value="">—</option>{REJEITO_MOTIVOS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select></div>}
                    </div>
                    {!ok && <p className="text-[10px] text-red-600 mt-1">Aceito + Rejeitado deve somar {r.receberAgora}.</p>}
                  </div>
                );
              })}
            </div>
          ) : step === 'entrada' ? (
            <div className="space-y-2">
              <p className="text-xs text-fg-secondary">Você está prestes a adicionar ao estoque:</p>
              {receberRows.filter((r) => r.vinculado && r.aceito > 0).map((r) => (
                <div key={r.key} className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                  <span className="text-xs font-bold text-fg">{r.descricao}</span>
                  <span className="text-sm font-data-mono font-bold text-emerald-700">+{r.aceito}</span>
                </div>
              ))}
              {receberRows.some((r) => !r.vinculado) && <p className="text-[11px] text-amber-700">Itens não vinculados serão registrados no recebimento, mas não entram no estoque agora.</p>}
              <p className="text-[11px] text-fg-secondary mt-1">Esta operação ficará registrada no histórico de estoque e é <b>idempotente</b> (não duplica).</p>
            </div>
          ) : (
            <div className="text-center py-4">
              <span className="material-symbols-outlined text-4xl text-emerald-500">check_circle</span>
              <p className="mt-2 text-sm font-bold text-fg">Entrada concluída</p>
              <div className="mt-3 text-left text-xs space-y-1 max-w-sm mx-auto">
                {(results || []).map((res, i) => {
                  const r = receberRows[i];
                  return <div key={res.itemId} className="flex items-center justify-between"><span className="text-fg-secondary">{r?.descricao || res.itemId}</span><span className={res.error ? 'text-red-600' : res.skipped ? 'text-fg-muted' : res.alreadyPosted ? 'text-amber-600' : 'text-emerald-600'}>{res.error ? 'erro' : res.skipped ? 'sem vínculo' : res.alreadyPosted ? 'já lançado' : 'entrada ok'}</span></div>;
                })}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border bg-surface-2 flex gap-2 shrink-0">
          {step === 'done' ? (
            <button onClick={onClose} className="flex-1 bg-navy-3 text-white py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider">Fechar</button>
          ) : (
            <>
              <button onClick={step === 'receber' ? onClose : () => setStep(step === 'entrada' ? 'conferencia' : 'receber')} className="px-4 py-2.5 text-xs font-bold uppercase text-fg-secondary hover:text-fg">{step === 'receber' ? 'Cancelar' : 'Voltar'}</button>
              <div className="flex-1" />
              {step === 'receber' && <button disabled={receberRows.length === 0} onClick={avancarReceber} className="bg-navy-3 disabled:opacity-40 text-white py-2.5 px-5 rounded-lg text-xs font-bold uppercase tracking-wider">Conferir ({receberRows.length})</button>}
              {step === 'conferencia' && <button disabled={!conferenciaOk} onClick={() => setStep('entrada')} className="bg-navy-3 disabled:opacity-40 text-white py-2.5 px-5 rounded-lg text-xs font-bold uppercase tracking-wider">Revisar entrada</button>}
              {step === 'entrada' && <button disabled={busy || !online} onClick={confirmarEntrada} className="bg-danger hover:bg-danger-hover disabled:opacity-40 text-white py-2.5 px-5 rounded-lg text-xs font-bold uppercase tracking-wider">{busy ? 'Processando…' : 'Confirmar entrada'}</button>}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
