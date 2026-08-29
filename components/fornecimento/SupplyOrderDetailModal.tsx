'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { SupplyOrder, InventoryItem, UserRole, SupplyPurchase, SupplyReceipt, SupplyReceiptItem } from '@/lib/types';
import { fetchReceipts, reverseReceiptItem, resumoItensFornecimento, deriveSupplyStatus, syncSupplyOrderStatus, mensagemErroFornecimento } from '@/lib/supplyReceipts';
import { fetchPurchases } from '@/lib/supplyPurchases';
import { isSupabaseConfigured } from '@/lib/inventory';
import { SupplyPurchaseModal } from './SupplyPurchaseModal';
import { SupplyReceivingModal } from './SupplyReceivingModal';

interface Props {
  order: SupplyOrder;
  inventory: InventoryItem[];
  currentUserName?: string;
  userRole: UserRole;
  onClose: () => void;
  onUpdateSupplyOrder?: (o: SupplyOrder) => void;
  onSupplyChanged?: () => void;
}

const money = (n?: number) => `R$ ${(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
const fmt = (s?: string) => (s ? new Date(s).toLocaleString('pt-BR') : '—');
const fmtD = (s?: string) => (s ? new Date(s).toLocaleDateString('pt-BR') : '—');
const STATUS_LABEL: Record<string, string> = { ABERTO: 'Aberto', EM_COTACAO: 'Em cotação', AGUARDANDO_COMPRA: 'Aguardando compra', COMPRADO: 'Comprado', RECEBIMENTO_PARCIAL: 'Recebimento parcial', RECEBIDO: 'Recebido', ENTRADA_PARCIAL_ESTOQUE: 'Entrada parcial', CONCLUIDO: 'Concluído', CANCELADO: 'Cancelado' };
const MOTIVOS_ESTORNO = ['Produto recebido incorretamente', 'Avaria constatada', 'Erro de conferência', 'Devolução ao fornecedor', 'Lançamento incorreto', 'Outro'];
const podeVerCusto = (role: UserRole) => role === 'ADMINISTRATIVO' || role === 'GESTOR' || role === 'FINANCEIRO';

export const SupplyOrderDetailModal: React.FC<Props> = ({ order: orderProp, inventory, currentUserName, userRole, onClose, onUpdateSupplyOrder, onSupplyChanged }) => {
  const online = isSupabaseConfigured();
  const [order, setOrder] = useState(orderProp);
  const [purchases, setPurchases] = useState<SupplyPurchase[]>([]);
  const [receipts, setReceipts] = useState<SupplyReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [sub, setSub] = useState<'comprar' | 'receber' | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [estorno, setEstorno] = useState<{ it: SupplyReceiptItem; rec: SupplyReceipt } | null>(null);
  const [motivo, setMotivo] = useState('');
  const [motivoTxt, setMotivoTxt] = useState('');
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [vincKey, setVincKey] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const custoVisivel = podeVerCusto(userRole);

  const carregar = async () => {
    setLoading(true);
    try {
      if (online) {
        const [p, r] = await Promise.all([fetchPurchases(order.id), fetchReceipts(order.id)]);
        setPurchases(p); setReceipts(r);
      }
    } catch (e) { setErro(mensagemErroFornecimento(e)); } finally { setLoading(false); }
  };
  useEffect(() => { carregar(); /* eslint-disable-next-line */ }, [order.id]);

  const statusDerivado = useMemo(() => deriveSupplyStatus(order, receipts, purchases), [order, receipts, purchases]);
  const resumo = useMemo(() => resumoItensFornecimento(order, purchases, receipts, inventory), [order, purchases, receipts, inventory]);

  const refetchTudo = async () => { await carregar(); onSupplyChanged?.(); };

  const confirmarEstorno = async () => {
    if (!estorno) return;
    const motivoFinal = [motivo, motivoTxt].filter(Boolean).join(' — ');
    if (!motivoFinal.trim()) { setErro('Informe o motivo do estorno.'); return; }
    setBusy(true); setErro(null);
    try {
      await reverseReceiptItem(estorno.it.id, motivoFinal, currentUserName);
      await syncSupplyOrderStatus(order);
      setEstorno(null); setMotivo(''); setMotivoTxt('');
      await refetchTudo();
    } catch (e) { setErro(mensagemErroFornecimento(e)); } finally { setBusy(false); }
  };

  const vincularProduto = (key: string, inv: InventoryItem) => {
    const items = order.items.map((it, i) => ((it.vinculoEstoqueId || `idx:${i}`) === key ? { ...it, vinculoEstoqueId: inv.id } : it));
    const updated = { ...order, items };
    setOrder(updated);
    onUpdateSupplyOrder?.(updated);
    setVincKey(null); setBusca('');
  };

  // Timeline (§22) — eventos derivados, sem poluir.
  const timeline = useMemo(() => {
    const ev: { at?: string; label: string; tone: 'info' | 'ok' | 'warn' }[] = [{ at: order.createdAt, label: 'Fornecimento criado', tone: 'info' }];
    purchases.forEach((p) => ev.push({ at: p.createdAt, label: `Compra registrada${p.supplier ? ` — ${p.supplier}` : ''} (${money(p.totalValue)})`, tone: 'info' }));
    receipts.forEach((r) => {
      ev.push({ at: r.receivedAt, label: `Recebimento${r.supplier ? ` — ${r.supplier}` : ''}`, tone: 'info' });
      (r.items || []).forEach((it) => {
        if (Number(it.quantityRejected || 0) > 0) ev.push({ at: r.receivedAt, label: `Item rejeitado: ${it.descricao} (${it.quantityRejected})`, tone: 'warn' });
        if (it.stockMovementId && !it.reversedAt) ev.push({ at: it.postedAt, label: `Entrada no estoque: ${it.descricao} (+${it.quantityAccepted})`, tone: 'ok' });
        if (it.reversedAt) ev.push({ at: it.reversedAt, label: `Estorno: ${it.descricao} (-${it.quantityAccepted})`, tone: 'warn' });
      });
    });
    if (statusDerivado === 'CONCLUIDO') ev.push({ at: undefined, label: 'Fornecimento concluído', tone: 'ok' });
    if (order.status === 'CANCELADO') ev.push({ at: undefined, label: 'Fornecimento cancelado', tone: 'warn' });
    return ev.sort((a, b) => (a.at || '').localeCompare(b.at || ''));
  }, [order, purchases, receipts, statusDerivado]);

  const primaria = () => {
    if (statusDerivado === 'CANCELADO' || statusDerivado === 'CONCLUIDO') return null;
    const temMaterial = order.items.some((it) => it.tipo !== 'servico');
    if (!temMaterial) return null;
    return (
      <div className="flex gap-2">
        <button onClick={() => setSub('comprar')} className="inline-flex items-center gap-1.5 border border-slate-300 hover:border-[#0B1E38] text-slate-700 text-xs font-bold uppercase rounded-lg px-3 py-2"><span className="material-symbols-outlined text-base">shopping_cart</span> {statusDerivado === 'RECEBIMENTO_PARCIAL' || statusDerivado === 'COMPRADO' ? 'Compra adicional' : 'Registrar compra'}</button>
        <button onClick={() => setSub('receber')} className="inline-flex items-center gap-1.5 bg-[#0B1E38] hover:bg-[#13315C] text-white text-xs font-bold uppercase rounded-lg px-3 py-2"><span className="material-symbols-outlined text-base">inventory_2</span> {statusDerivado === 'RECEBIMENTO_PARCIAL' ? 'Novo recebimento' : 'Registrar recebimento'}</button>
      </div>
    );
  };

  const th = 'text-[9px] font-bold uppercase tracking-wide text-slate-400 px-2 py-1 text-center';
  const td = 'px-2 py-1.5 text-[11px] text-slate-700 text-center font-data-mono';
  const invFiltrado = busca.trim() ? inventory.filter((i) => `${i.name} ${i.code} ${i.brand || ''} ${i.model || ''}`.toLowerCase().includes(busca.toLowerCase())).slice(0, 8) : [];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-sm flex items-start sm:items-center justify-center p-2 sm:p-5 overflow-y-auto">
      <div className="bg-slate-50 w-full max-w-4xl rounded-2xl border border-slate-200 shadow-2xl flex flex-col max-h-[96vh] overflow-hidden my-2">
        {/* Cabeçalho (§2) */}
        <div className="bg-[#0B1E38] text-white p-4 px-5 flex items-start justify-between shrink-0">
          <div className="min-w-0">
            <p className="font-data-mono text-[11px] text-sky-300 font-bold">{order.id}</p>
            <h3 className="text-base font-bold truncate">{order.clientName}</h3>
            <p className="text-[11px] text-slate-300">Origem: {order.sourcePedidoId} · Criado {fmtD(order.createdAt)}</p>
          </div>
          <div className="text-right shrink-0 ml-3">
            <span className="inline-block px-2.5 py-1 rounded-full bg-white/10 text-[10px] font-bold uppercase tracking-wide">{STATUS_LABEL[statusDerivado] || statusDerivado}</span>
            <p className="font-data-mono font-bold text-emerald-300 mt-1">{money(order.totalValue)}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 ml-2 shrink-0"><span className="material-symbols-outlined">close</span></button>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {erro && <div className="text-xs bg-red-50 border border-red-200 text-red-700 rounded-lg p-2.5">{erro}</div>}
          {!online && <div className="text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-2.5">Sem conexão com o servidor — dados podem estar incompletos.</div>}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Ações</p>
            <div className="flex items-center gap-2">
              {primaria()}
              {(userRole === 'ADMINISTRATIVO' || userRole === 'GESTOR') && statusDerivado !== 'CANCELADO' && statusDerivado !== 'CONCLUIDO' && (
                <button
                  onClick={() => { if (window.confirm('Cancelar este fornecimento? Compras, recebimentos e movimentações de estoque já feitos são preservados.')) { const upd = { ...order, status: 'CANCELADO' as const }; setOrder(upd); onUpdateSupplyOrder?.(upd); } }}
                  className="text-[11px] font-bold uppercase text-slate-400 hover:text-[#E63946] px-2 py-2"
                >Cancelar</button>
              )}
            </div>
          </div>

          {/* Resumo dos itens (§5/§6) */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-2">Itens</p>
            {/* desktop */}
            <div className="hidden md:block overflow-x-auto bg-white rounded-xl border border-slate-200">
              <table className="w-full">
                <thead><tr className="border-b border-slate-200 bg-slate-50"><th className={`${th} text-left`}>Produto</th><th className={th}>Pedido</th><th className={th}>Estoque</th><th className={th}>Comprado</th><th className={th}>Recebido</th><th className={th}>Aceito</th><th className={th}>Rejeitado</th><th className={th}>Entrada</th><th className={th}>Pend. receb.</th></tr></thead>
                <tbody>
                  {resumo.map((r) => (
                    <tr key={r.key} className="border-b border-slate-100">
                      <td className="px-2 py-1.5 text-[11px] text-left"><div className="font-semibold text-slate-800">{r.descricao}</div>{!r.vinculado && <button onClick={() => setVincKey(r.key)} className="text-[10px] text-amber-600 underline">vincular ao estoque</button>}</td>
                      <td className={td}>{r.pedido}</td><td className={`${td} text-slate-400`}>{r.estoque ?? '—'}</td><td className={td}>{r.comprado}</td><td className={td}>{r.recebido}</td><td className={td}>{r.aceito}</td><td className={`${td} ${r.rejeitado ? 'text-red-600' : 'text-slate-400'}`}>{r.rejeitado}</td><td className={`${td} font-bold ${r.entrada ? 'text-emerald-600' : ''}`}>{r.entrada}{r.estornado ? <span className="text-red-500"> (−{r.estornado})</span> : null}</td><td className={`${td} ${r.pendenteRecebimento ? 'text-amber-600 font-bold' : 'text-slate-400'}`}>{r.pendenteRecebimento}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* mobile */}
            <div className="md:hidden space-y-2">
              {resumo.map((r) => (
                <div key={r.key} className="bg-white rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center justify-between"><p className="text-xs font-bold text-slate-800">{r.descricao}</p>{r.entrada > 0 && <span className="text-[10px] font-bold text-emerald-600">em estoque: {r.entrada}</span>}</div>
                  {!r.vinculado && <button onClick={() => setVincKey(r.key)} className="text-[10px] text-amber-600 underline">vincular ao estoque</button>}
                  <div className="grid grid-cols-3 gap-1 mt-2 text-[10px] font-data-mono text-slate-600">
                    <span>Pedido: {r.pedido}</span><span>Estoque: {r.estoque ?? '—'}</span><span>Comprado: {r.comprado}</span>
                    <span>Recebido: {r.recebido}</span><span>Aceito: {r.aceito}</span><span className={r.rejeitado ? 'text-red-600' : ''}>Rejeit.: {r.rejeitado}</span>
                    <span className="col-span-3 text-amber-600">Pendente receb.: {r.pendenteRecebimento}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Compras (§7/§8) */}
          {purchases.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-2">Compras</p>
              <div className="space-y-2">{purchases.map((p) => (
                <div key={p.id} className="bg-white rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div><p className="text-xs font-bold text-slate-800">{p.supplier || 'Fornecedor não informado'}</p><p className="text-[10px] text-slate-400">Compra {fmtD(p.purchaseDate)}{p.expectedDate ? ` · previsão ${fmtD(p.expectedDate)}` : ''} · {(p.items || []).length} item(ns)</p></div>
                    {custoVisivel && <span className="font-data-mono font-bold text-slate-700">{money(p.totalValue)}</span>}
                  </div>
                </div>
              ))}</div>
            </div>
          )}

          {/* Recebimentos (§9/§10) + estorno (§11) */}
          {receipts.length > 0 && (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-2">Recebimentos</p>
              <div className="space-y-2">{receipts.map((r) => {
                const rid = r.id;
                const isOpen = !!expanded[rid];
                return (
                  <div key={rid} className="bg-white rounded-lg border border-slate-200">
                    <button onClick={() => setExpanded((e) => ({ ...e, [rid]: !e[rid] }))} className="w-full flex items-center justify-between p-3 text-left">
                      <div><p className="text-xs font-bold text-slate-800">{r.supplier || 'Recebimento'} · {fmtD(r.receivedAt)}</p><p className="text-[10px] text-slate-400">{(r.items || []).length} item(ns){r.receivedBy ? ` · por ${r.receivedBy}` : ''}</p></div>
                      <span className="material-symbols-outlined text-slate-400">{isOpen ? 'expand_less' : 'expand_more'}</span>
                    </button>
                    {isOpen && (
                      <div className="border-t border-slate-100 p-3 space-y-2">
                        {(r.items || []).map((it) => (
                          <div key={it.id} className="flex items-center justify-between gap-2 text-[11px]">
                            <div className="min-w-0"><p className="font-semibold text-slate-800 truncate">{it.descricao}</p><p className="text-[10px] text-slate-500 font-data-mono">Receb. {it.quantityReceived} · Aceito {it.quantityAccepted} · Rejeit. {it.quantityRejected}{it.rejectionReason ? ` (${it.rejectionReason})` : ''}{custoVisivel && it.unitCost ? ` · ${money(it.unitCost)}/un` : ''}</p></div>
                            <div className="shrink-0 text-right">
                              {it.reversedAt ? <span className="text-[10px] font-bold text-red-500 uppercase">Estornado</span>
                                : it.stockMovementId ? (
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-emerald-600">entrada +{it.quantityAccepted}</span>
                                    <button onClick={() => { setEstorno({ it, rec: r }); setMotivo(''); setMotivoTxt(''); }} className="text-[10px] font-bold uppercase text-slate-400 hover:text-[#E63946]">Estornar</button>
                                  </div>
                                ) : <span className="text-[10px] text-slate-400">não lançado</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}</div>
            </div>
          )}

          {/* Timeline (§22) */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 mb-2">Histórico</p>
            <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-1.5">
              {loading ? <p className="text-[11px] text-slate-400">Carregando…</p> : timeline.map((e, i) => (
                <div key={i} className="flex items-start gap-2 text-[11px]">
                  <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${e.tone === 'ok' ? 'bg-emerald-500' : e.tone === 'warn' ? 'bg-red-500' : 'bg-slate-300'}`} />
                  <span className="text-slate-400 font-data-mono w-28 shrink-0">{e.at ? fmt(e.at) : '—'}</span>
                  <span className="text-slate-700">{e.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Sub-modais reutilizados */}
      {sub === 'comprar' && <SupplyPurchaseModal order={order} inventory={inventory} onClose={() => setSub(null)} onSaved={refetchTudo} />}
      {sub === 'receber' && <SupplyReceivingModal order={order} inventory={inventory} currentUserName={currentUserName} onClose={() => setSub(null)} onPosted={refetchTudo} />}

      {/* Modal de estorno (§12/§13) */}
      {estorno && (
        <div className="fixed inset-0 z-[70] bg-slate-900/70 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
            <div className="bg-[#0B1E38] text-white p-4 px-5"><h4 className="text-sm font-bold uppercase">Estornar entrada de estoque</h4></div>
            <div className="p-5 space-y-3">
              <div className="text-xs text-slate-600"><p><b>Produto:</b> {estorno.it.descricao}</p><p><b>Quantidade:</b> {estorno.it.quantityAccepted} un</p><p><b>Movimentação original:</b> +{estorno.it.quantityAccepted}</p></div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Motivo (obrigatório)</label>
                <select value={motivo} onChange={(e) => setMotivo(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-2"><option value="">Selecione…</option>{MOTIVOS_ESTORNO.map((m) => <option key={m} value={m}>{m}</option>)}</select>
                <input value={motivoTxt} onChange={(e) => setMotivoTxt(e.target.value)} placeholder="Complemento (opcional)" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              {erro && <p className="text-xs text-red-600">{erro}</p>}
            </div>
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex gap-2">
              <button onClick={() => { setEstorno(null); setErro(null); }} className="px-4 py-2.5 text-xs font-bold uppercase text-slate-500">Cancelar</button>
              <div className="flex-1" />
              <button disabled={busy || !motivo} onClick={confirmarEstorno} className="bg-[#E63946] hover:bg-[#a51515] disabled:opacity-40 text-white py-2.5 px-5 rounded-lg text-xs font-bold uppercase tracking-wider">{busy ? 'Processando…' : 'Confirmar estorno'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Vincular produto (§17/§18) */}
      {vincKey && (
        <div className="fixed inset-0 z-[70] bg-slate-900/70 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl border border-slate-200 shadow-2xl overflow-hidden">
            <div className="bg-[#0B1E38] text-white p-4 px-5 flex items-center justify-between"><h4 className="text-sm font-bold uppercase">Vincular produto ao estoque</h4><button onClick={() => { setVincKey(null); setBusca(''); }} className="text-slate-400 hover:text-white"><span className="material-symbols-outlined">close</span></button></div>
            <div className="p-5">
              <input autoFocus value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome, código, marca ou modelo…" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" />
              <div className="mt-2 max-h-64 overflow-y-auto divide-y divide-slate-100">
                {invFiltrado.map((inv) => (
                  <button key={inv.id} onClick={() => vincularProduto(vincKey, inv)} className="w-full text-left py-2 px-1 hover:bg-slate-50 rounded"><p className="text-xs font-bold text-slate-800">{inv.name}</p><p className="text-[10px] text-slate-400 font-data-mono">{inv.code}{inv.brand ? ` · ${inv.brand}` : ''}{inv.model ? ` ${inv.model}` : ''} · saldo {inv.quantity}</p></button>
                ))}
                {busca.trim() && invFiltrado.length === 0 && <p className="text-[11px] text-slate-400 py-3 text-center">Nenhum produto encontrado. Cadastre no Estoque e volte para vincular.</p>}
              </div>
              <p className="text-[10px] text-slate-400 mt-2">Vincular não altera a descrição da proposta — cria só o vínculo operacional com o estoque.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
