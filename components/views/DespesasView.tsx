'use client';

import React, { useState } from 'react';
import { FinancialTransaction, Supplier } from '@/lib/types';
import { DataListRow, RowMeta, Badge, RowAction } from '@/components/DataListRow';
import { usePrivacy } from '@/lib/privacy';

interface DespesasViewProps {
  transactions: FinancialTransaction[];
  suppliers: Supplier[];
  onAddTransaction: (t: FinancialTransaction) => void;
  onUpdateTransaction?: (t: FinancialTransaction) => void;
  onDeleteTransaction?: (id: string) => void;
}

let despSeq = 500;

const brl = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
const inputCls =
  'w-full border border-slate-200 rounded-lg p-2.5 text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#E63946]/20 focus:border-[#E63946]/40';
const labelCls = 'block text-slate-600 mb-1 font-semibold uppercase text-[11px]';

const DESPESA_CATEGORIES = [
  'Compra de Materiais / Insumos',
  'Folha & Encargos',
  'Impostos & Taxas',
  'Serviços de Terceiros',
  'Frota & Logística',
  'Infraestrutura / Aluguel',
  'Ferramentas & EPI',
  'Outros',
];
const PAYMENT_METHODS = ['PIX', 'Boleto', 'Transferência (TED)', 'Cartão', 'Dinheiro', 'A combinar'];
const COST_CENTERS = ['Operação de Campo', 'Comercial', 'Administrativo', 'Almoxarifado', 'Frota', 'Diretoria'];

const statusBadge = (status: FinancialTransaction['status']) =>
  status === 'CONFIRMADO' ? 'emerald' : status === 'PENDENTE' ? 'amber' : 'red';

export const DespesasView: React.FC<DespesasViewProps> = ({
  transactions,
  suppliers,
  onAddTransaction,
  onUpdateTransaction,
  onDeleteTransaction,
}) => {
  const { maskMoney } = usePrivacy();
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  const [clientOrVendor, setClientOrVendor] = useState(suppliers[0]?.name || '');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState(0);
  const [status, setStatus] = useState<FinancialTransaction['status']>('CONFIRMADO');
  const [category, setCategory] = useState(DESPESA_CATEGORIES[0]);
  const [emissao, setEmissao] = useState('');
  const [vencimento, setVencimento] = useState('');
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0]);
  const [costCenter, setCostCenter] = useState(COST_CENTERS[0]);
  const [documentRef, setDocumentRef] = useState('');

  const despesas = transactions.filter((t) => t.type === 'DESPESA');
  const filteredDespesas = despesas.filter((t) => (filterStatus === 'ALL' ? true : t.status === filterStatus));

  const totalConfirmed = despesas.filter((t) => t.status === 'CONFIRMADO').reduce((acc, t) => acc + t.amount, 0);
  const totalPending = despesas.filter((t) => t.status !== 'CONFIRMADO').reduce((acc, t) => acc + t.amount, 0);

  const openCreate = () => {
    setEditingId(null);
    setClientOrVendor(suppliers[0]?.name || '');
    setDescription('');
    setAmount(0);
    setStatus('CONFIRMADO');
    setCategory(DESPESA_CATEGORIES[0]);
    setEmissao(new Date().toISOString().slice(0, 10));
    setVencimento('');
    setPaymentMethod(PAYMENT_METHODS[0]);
    setCostCenter(COST_CENTERS[0]);
    setDocumentRef('');
    setShowModal(true);
  };

  const openEdit = (t: FinancialTransaction) => {
    setEditingId(t.id);
    setClientOrVendor(t.clientOrVendor);
    setDescription(t.description);
    setAmount(t.amount);
    setStatus(t.status);
    setCategory(t.category || DESPESA_CATEGORIES[0]);
    setEmissao('');
    setVencimento(t.dueDate || '');
    setPaymentMethod(t.paymentMethod || PAYMENT_METHODS[0]);
    setCostCenter(t.costCenter || COST_CENTERS[0]);
    setDocumentRef(t.documentRef || '');
    setShowModal(true);
  };

  const handleDelete = (t: FinancialTransaction) => {
    if (!onDeleteTransaction) return;
    if (!window.confirm(`Excluir o lançamento "${t.description}" (${brl(t.amount)})?\n\nEsta ação não pode ser desfeita.`))
      return;
    onDeleteTransaction(t.id);
  };

  const formatEmissao = (iso: string) => {
    if (!iso) return new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
    const [y, m, d] = iso.split('-').map(Number);
    const meses = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
    return `${String(d).padStart(2, '0')} ${meses[m - 1]} ${y}`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const extra = {
      category,
      dueDate: vencimento || undefined,
      paymentMethod,
      costCenter,
      documentRef: documentRef || undefined,
    };
    if (editingId) {
      const existing = despesas.find((r) => r.id === editingId);
      if (existing) {
        onUpdateTransaction?.({ ...existing, clientOrVendor, description, amount: Number(amount), status, ...extra });
      }
    } else {
      // id único por timestamp (evita colisão/sobrescrita ao persistir no banco)
      const seq = `${despSeq++}-${Date.now().toString(36)}`;
      onAddTransaction({
        id: `#FOWL-DESP-${seq}`,
        type: 'DESPESA',
        clientOrVendor,
        description,
        date: formatEmissao(emissao),
        status,
        amount: Number(amount),
        ...extra,
      });
    }
    setShowModal(false);
  };

  return (
    <div className="flex flex-col w-full p-4 md:p-8 gap-5 md:gap-6">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-slate-200 pb-5">
        <div>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Gestão Financeira — Saídas, Insumos &amp; Custos
          </span>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
            Despesas &amp; Pagamentos a Fornecedores
          </h1>
        </div>

        <button
          onClick={openCreate}
          className="bg-[#E63946] hover:bg-[#a51515] text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm flex items-center gap-1.5 uppercase"
        >
          <span className="material-symbols-outlined text-base">add</span> Nova Despesa
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase">Despesas Pagas</p>
          <h2 className="font-data-mono text-3xl font-bold text-[#E63946] mt-2">{maskMoney(brl(totalConfirmed))}</h2>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase">A Pagar / Agendado</p>
          <h2 className="font-data-mono text-3xl font-bold text-amber-600 mt-2">{maskMoney(brl(totalPending))}</h2>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase">Total de Custos Acumulados</p>
          <h2 className="font-data-mono text-3xl font-bold text-[#E63946] mt-2">{maskMoney(brl(totalConfirmed + totalPending))}</h2>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase text-slate-400">Filtrar:</span>
        {['ALL', 'CONFIRMADO', 'PENDENTE', 'ATRASADO'].map((st) => (
          <button
            key={st}
            onClick={() => setFilterStatus(st)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold uppercase tracking-wide transition-colors ${
              filterStatus === st
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {st === 'ALL' ? 'Todas' : st}
          </button>
        ))}
      </div>

      {/* Lista de lançamentos */}
      {filteredDespesas.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm py-16 text-center text-slate-400">
          <span className="material-symbols-outlined text-4xl text-slate-300">trending_down</span>
          <p className="mt-2 text-sm font-bold text-slate-500 uppercase tracking-wider">Nenhuma despesa encontrada</p>
          <p className="text-xs text-slate-400 mt-1">Clique em &quot;Nova Despesa&quot; para lançar a primeira.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredDespesas.map((t) => (
            <DataListRow
              key={t.id}
              leading={
                <span className="w-10 h-10 rounded-full bg-red-50 text-[#E63946] flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-lg">north</span>
                </span>
              }
              title={<span className="uppercase">{t.clientOrVendor}</span>}
              meta={
                <>
                  <span className="text-slate-500">{t.description}</span>
                  <RowMeta label="Cód" value={<span className="font-data-mono">{t.id}</span>} />
                  {t.category && <Badge color="slate">{t.category}</Badge>}
                  {t.costCenter && <RowMeta label="C. Custo" value={t.costCenter} />}
                </>
              }
              center={
                <div className="text-left md:text-center">
                  <p className="text-[10px] text-slate-400 uppercase tracking-wider">Emissão</p>
                  <p className="font-data-mono text-slate-700 font-semibold">{t.date}</p>
                </div>
              }
              right={
                <>
                  <span className="font-data-mono font-bold text-[#E63946] text-base md:text-lg text-right">
                    {maskMoney(brl(t.amount))}
                  </span>
                  <Badge color={statusBadge(t.status)}>{t.status}</Badge>
                  <div className="flex items-center gap-1">
                    <RowAction icon="edit" label="Editar lançamento" onClick={() => openEdit(t)} />
                    <RowAction icon="delete" label="Excluir lançamento" danger onClick={() => handleDelete(t)} />
                  </div>
                </>
              }
            />
          ))}
        </div>
      )}

      {/* Modal Nova/Editar Despesa */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-2xl w-full rounded-xl border border-slate-200 shadow-2xl relative max-h-[92vh] flex flex-col">
            <div className="flex items-start justify-between p-6 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900 uppercase">
                  {editingId ? 'Editar Despesa' : 'Lançar Nova Despesa'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Classifique o custo por categoria e centro de custo para o DRE.</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-700 font-bold text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs font-medium overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Fornecedor / Beneficiário</label>
                  <select value={clientOrVendor} onChange={(e) => setClientOrVendor(e.target.value)} className={inputCls}>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                    <option value="Outros Fornecedores">Outros Fornecedores</option>
                    {clientOrVendor && !suppliers.some((s) => s.name === clientOrVendor) && clientOrVendor !== 'Outros Fornecedores' && (
                      <option value={clientOrVendor}>{clientOrVendor}</option>
                    )}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Categoria de Custo</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
                    {DESPESA_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className={labelCls}>Descrição do custo</label>
                <input
                  type="text"
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className={inputCls}
                  placeholder="Ex.: Compra de sirenes bitonal 24V — OS-2026-91"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Valor (R$)</label>
                  <input
                    type="number"
                    required
                    min={0}
                    step="0.01"
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className={`${inputCls} font-data-mono`}
                  />
                </div>
                <div>
                  <label className={labelCls}>Emissão</label>
                  <input type="date" value={emissao} onChange={(e) => setEmissao(e.target.value)} className={`${inputCls} font-data-mono`} />
                </div>
                <div>
                  <label className={labelCls}>Vencimento</label>
                  <input type="date" value={vencimento} onChange={(e) => setVencimento(e.target.value)} className={`${inputCls} font-data-mono`} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Forma de Pagamento</label>
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className={inputCls}>
                    {PAYMENT_METHODS.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Centro de Custo</label>
                  <select value={costCenter} onChange={(e) => setCostCenter(e.target.value)} className={inputCls}>
                    {COST_CENTERS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Nota Fiscal / Documento</label>
                  <input type="text" value={documentRef} onChange={(e) => setDocumentRef(e.target.value)} className={`${inputCls} font-data-mono`} placeholder="NF-e 12345" />
                </div>
                <div>
                  <label className={labelCls}>Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as FinancialTransaction['status'])}
                    className={inputCls}
                  >
                    <option value="CONFIRMADO">CONFIRMADO</option>
                    <option value="PENDENTE">PENDENTE</option>
                    <option value="ATRASADO">ATRASADO</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-[#E63946] hover:bg-[#a51515] text-white py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors shadow-sm"
              >
                {editingId ? 'Salvar Alterações' : 'Confirmar Lançamento de Despesa'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
