'use client';

import React, { useState } from 'react';
import { FinancialTransaction, Client } from '@/lib/types';
import { DataListRow, RowMeta, Badge, RowAction } from '@/components/DataListRow';

interface ReceitasViewProps {
  transactions: FinancialTransaction[];
  clients: Client[];
  onAddTransaction: (t: FinancialTransaction) => void;
  onUpdateTransaction?: (t: FinancialTransaction) => void;
  onDeleteTransaction?: (id: string) => void;
}

let recSeq = 300;

const brl = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
const inputCls =
  'w-full border border-slate-200 rounded-lg p-2.5 text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/40';
const labelCls = 'block text-slate-600 mb-1 font-semibold uppercase text-[11px]';

const statusBadge = (status: FinancialTransaction['status']) =>
  status === 'CONFIRMADO' ? 'emerald' : status === 'PENDENTE' ? 'amber' : 'red';

export const ReceitasView: React.FC<ReceitasViewProps> = ({
  transactions,
  clients,
  onAddTransaction,
  onUpdateTransaction,
  onDeleteTransaction,
}) => {
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Form
  const [clientOrVendor, setClientOrVendor] = useState(clients[0]?.name || '');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState(0);
  const [status, setStatus] = useState<FinancialTransaction['status']>('CONFIRMADO');

  const receitas = transactions.filter((t) => t.type === 'RECEITA');
  const filteredReceitas = receitas.filter((t) => (filterStatus === 'ALL' ? true : t.status === filterStatus));

  const totalConfirmed = receitas
    .filter((t) => t.status === 'CONFIRMADO')
    .reduce((acc, t) => acc + t.amount, 0);
  const totalPending = receitas
    .filter((t) => t.status !== 'CONFIRMADO')
    .reduce((acc, t) => acc + t.amount, 0);

  const openCreate = () => {
    setEditingId(null);
    setClientOrVendor(clients[0]?.name || '');
    setDescription('');
    setAmount(0);
    setStatus('CONFIRMADO');
    setShowModal(true);
  };

  const openEdit = (t: FinancialTransaction) => {
    setEditingId(t.id);
    setClientOrVendor(t.clientOrVendor);
    setDescription(t.description);
    setAmount(t.amount);
    setStatus(t.status);
    setShowModal(true);
  };

  const handleDelete = (t: FinancialTransaction) => {
    if (!onDeleteTransaction) return;
    if (!window.confirm(`Excluir o lançamento "${t.description}" (${brl(t.amount)})?\n\nEsta ação não pode ser desfeita.`))
      return;
    onDeleteTransaction(t.id);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      const existing = receitas.find((r) => r.id === editingId);
      if (existing) {
        onUpdateTransaction?.({
          ...existing,
          clientOrVendor,
          description,
          amount: Number(amount),
          status,
        });
      }
    } else {
      // id único por timestamp (evita colisão/sobrescrita ao persistir no banco)
      const seq = `${recSeq++}-${Date.now().toString(36)}`;
      onAddTransaction({
        id: `#FOWL-REC-${seq}`,
        type: 'RECEITA',
        clientOrVendor,
        description,
        date: new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase(),
        status,
        amount: Number(amount),
      });
    }
    setShowModal(false);
  };

  return (
    <div className="flex flex-col w-full p-8 gap-6">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-slate-200 pb-5">
        <div>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Gestão Financeira — Entradas &amp; Faturamento
          </span>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
            Receitas &amp; Mensalidades de Contratos
          </h1>
        </div>

        <button
          onClick={openCreate}
          className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm flex items-center gap-1.5 uppercase"
        >
          <span className="material-symbols-outlined text-base">add</span> Nova Receita
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white p-6 rounded-xl shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase">Receitas Confirmadas (Pagas)</p>
          <h2 className="font-data-mono text-3xl font-bold text-emerald-600 mt-2">{brl(totalConfirmed)}</h2>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase">A Receber / Pendente</p>
          <h2 className="font-data-mono text-3xl font-bold text-amber-600 mt-2">{brl(totalPending)}</h2>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase">Faturamento Bruto Total</p>
          <h2 className="font-data-mono text-3xl font-bold text-emerald-600 mt-2">
            {brl(totalConfirmed + totalPending)}
          </h2>
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

      {/* Lista de lançamentos (DataListRow) */}
      {filteredReceitas.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm py-16 text-center text-slate-400">
          <span className="material-symbols-outlined text-4xl text-slate-300">trending_up</span>
          <p className="mt-2 text-sm font-bold text-slate-500 uppercase tracking-wider">Nenhuma receita encontrada</p>
          <p className="text-xs text-slate-400 mt-1">Clique em &quot;Nova Receita&quot; para lançar a primeira.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredReceitas.map((t) => (
            <DataListRow
              key={t.id}
              leading={
                <span className="w-10 h-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-lg">south</span>
                </span>
              }
              title={<span className="uppercase">{t.clientOrVendor}</span>}
              meta={
                <>
                  <span className="text-slate-500">{t.description}</span>
                  <RowMeta label="Cód" value={<span className="font-data-mono">{t.id}</span>} />
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
                  <span className="font-data-mono font-bold text-emerald-600 text-base md:text-lg text-right">
                    {brl(t.amount)}
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

      {/* Modal Nova/Editar Receita */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-xl border border-slate-200 p-6 shadow-2xl relative">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 font-bold"
            >
              ✕
            </button>
            <h3 className="text-lg font-bold text-slate-900 uppercase mb-4">
              {editingId ? 'Editar Receita' : 'Lançar Nova Receita'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4 text-xs font-medium">
              <div>
                <label className={labelCls}>Cliente / Origem</label>
                <select
                  value={clientOrVendor}
                  onChange={(e) => setClientOrVendor(e.target.value)}
                  className={inputCls}
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                  {clientOrVendor && !clients.some((c) => c.name === clientOrVendor) && (
                    <option value={clientOrVendor}>{clientOrVendor}</option>
                  )}
                </select>
              </div>

              <div>
                <label className={labelCls}>Descrição</label>
                <input
                  type="text"
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className={inputCls}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
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
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors shadow-sm"
              >
                {editingId ? 'Salvar Alterações' : 'Confirmar Lançamento de Receita'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
