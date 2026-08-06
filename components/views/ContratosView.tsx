'use client';

import React, { useState } from 'react';
import { Contract } from '@/lib/types';
import { DataListRow, RowMeta, Badge, RowAction } from '@/components/DataListRow';
import { usePrivacy } from '@/lib/privacy';

interface ContratosViewProps {
  contracts: Contract[];
  onAddContract: (contract: Contract) => void;
}

const brl = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
const contractStatusColor = (status: Contract['status']) =>
  status === 'ATIVO' ? 'emerald' : status === 'A VENCER' ? 'amber' : 'red';

export const ContratosView: React.FC<ContratosViewProps> = ({
  contracts,
  onAddContract,
}) => {
  const { maskMoney } = usePrivacy();
  const [showModal, setShowModal] = useState(false);
  const [selectedPdfContract, setSelectedPdfContract] = useState<Contract | null>(null);
  const [clientName, setClientName] = useState('');
  const [monthlyVal, setMonthlyVal] = useState(15000);

  const handleCreateContract = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName) return;

    // id único por timestamp (evita colisão/sobrescrita ao persistir no banco)
    const stamp = Date.now().toString(36);
    onAddContract({
      id: `CTR-FOWL-${stamp}`,
      clientName,
      unit: 'Unidade Londrina',
      monthlyValue: Number(monthlyVal),
      renewalDate: '30 DEZ 2026',
      readjustmentIndex: 'IPCA (+4.5%)',
      contractedHours: 100,
      usedHours: 12,
      status: 'ATIVO',
      responsibleTech: 'Eng. Ricardo M.',
      artDocumentRef: `ART-PR-2024-${stamp}`
    });

    setShowModal(false);
    setClientName('');
  };

  const totalMonthlyRec = contracts.reduce((acc, c) => acc + c.monthlyValue, 0);

  return (
    <div className="flex flex-col w-full p-4 md:p-8 gap-5 md:gap-6">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-slate-200 pb-5">
        <div>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Módulo de Receita Recorrente (MRR)
          </span>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
            Gestão de Contratos de Manutenção
          </h1>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-[#E63946] hover:bg-[#a51515] text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm flex items-center gap-1.5 uppercase tracking-wide"
        >
          <span className="material-symbols-outlined text-base">add</span> Novo Contrato
        </button>
      </div>

      {/* Contract Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase">Receita Mensal Recorrente (MRR)</p>
          <h2 className="font-data-mono text-3xl font-bold text-slate-900 mt-2">
            {maskMoney(brl(totalMonthlyRec))}
          </h2>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase">Contratos Vigentes</p>
          <h2 className="font-data-mono text-3xl font-bold text-emerald-600 mt-2">{contracts.length}</h2>
        </div>
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase">Índice de Reajuste Anual</p>
          <h2 className="font-data-mono text-3xl font-bold text-[#E63946] mt-2">IPCA (+4.8%)</h2>
        </div>
      </div>

      {/* Lista de contratos */}
      {contracts.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm py-16 text-center text-slate-400">
          <span className="material-symbols-outlined text-4xl text-slate-300">description</span>
          <p className="mt-2 text-sm font-bold text-slate-500 uppercase tracking-wider">Nenhum contrato cadastrado</p>
          <p className="text-xs text-slate-400 mt-1">Clique em &quot;Novo Contrato&quot; para começar.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {contracts.map((ctr) => {
            const pct = ctr.contractedHours > 0 ? Math.round((ctr.usedHours / ctr.contractedHours) * 100) : 0;
            return (
              <DataListRow
                key={ctr.id}
                leading={
                  <span className="w-10 h-10 rounded-lg bg-[#1A1A72]/10 text-[#1A1A72] flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-lg">description</span>
                  </span>
                }
                title={<span className="uppercase">{ctr.clientName}</span>}
                meta={
                  <>
                    <RowMeta label="Ref" value={<span className="font-data-mono">{ctr.id}</span>} />
                    <RowMeta label="Unidade" value={ctr.unit} />
                    <RowMeta label="Resp" value={ctr.responsibleTech} />
                    <RowMeta label="ART" value={<span className="font-data-mono">{ctr.artDocumentRef}</span>} />
                  </>
                }
                center={
                  <div className="w-40">
                    <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase tracking-wider">
                      <span>Bolsa de horas</span>
                      <span className="font-data-mono">
                        {ctr.usedHours}/{ctr.contractedHours}h
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden mt-1">
                      <div
                        className="bg-[#1A1A72] h-full rounded-full"
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 font-data-mono">
                      Renova: {ctr.renewalDate} · {ctr.readjustmentIndex}
                    </p>
                  </div>
                }
                right={
                  <>
                    <div className="text-right">
                      <span className="font-data-mono font-bold text-emerald-600 text-base md:text-lg block">
                        {maskMoney(brl(ctr.monthlyValue))}
                      </span>
                      <span className="text-[10px] text-slate-400 uppercase">por mês</span>
                    </div>
                    <Badge color={contractStatusColor(ctr.status)}>{ctr.status}</Badge>
                    <RowAction icon="print" label="Imprimir resumo do contrato" onClick={() => setSelectedPdfContract(ctr)} />
                  </>
                }
              />
            );
          })}
        </div>
      )}

      {/* Modal Add Contract */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-xl border border-slate-200 p-6 shadow-2xl relative">
            <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 font-bold">
              ✕
            </button>
            <h3 className="text-lg font-bold text-slate-900 uppercase mb-4">Novo Contrato Recorrente</h3>
            <form onSubmit={handleCreateContract} className="space-y-4 text-xs font-medium">
              <div>
                <label className="block text-slate-600 mb-1 font-semibold uppercase">Razão Social do Cliente</label>
                <input
                  type="text"
                  required
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#E63946]/20"
                  placeholder="Ex: Londrina Norte Shopping"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1 font-semibold uppercase">Valor Mensal Recorrente (R$)</label>
                <input
                  type="number"
                  required
                  value={monthlyVal}
                  onChange={(e) => setMonthlyVal(Number(e.target.value))}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-slate-900 font-data-mono focus:outline-none focus:ring-2 focus:ring-[#E63946]/20"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-[#E63946] hover:bg-[#a51515] text-white py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors shadow-sm"
              >
                Salvar e Ativar Contrato
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal PDF Preview */}
      {selectedPdfContract && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full rounded-xl border border-slate-200 p-6 shadow-2xl relative">
            <button onClick={() => setSelectedPdfContract(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 font-bold">
              ✕
            </button>
            <div className="border-b border-slate-200 pb-3 mb-4">
              <span className="font-data-mono text-xs text-[#E63946] font-bold">{selectedPdfContract.id}</span>
              <h3 className="text-xl font-bold text-slate-900 uppercase">{selectedPdfContract.clientName}</h3>
              <p className="text-xs text-slate-500">Contrato de Manutenção de Sistemas SDAI &amp; Hidráulicos</p>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg space-y-2 text-xs font-data-mono border border-slate-200 mb-6">
              <div><strong>Valor Mensal:</strong> R$ {selectedPdfContract.monthlyValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
              <div><strong>Renovação Automática:</strong> {selectedPdfContract.renewalDate}</div>
              <div><strong>Reajuste Aplicável:</strong> {selectedPdfContract.readjustmentIndex}</div>
              <div><strong>Bolsa de Horas de Campo:</strong> {selectedPdfContract.usedHours}h / {selectedPdfContract.contractedHours}h</div>
              <div><strong>Responsável Técnico:</strong> {selectedPdfContract.responsibleTech}</div>
              <div><strong>Registro ART CREA:</strong> {selectedPdfContract.artDocumentRef}</div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  window.print();
                  setSelectedPdfContract(null);
                }}
                className="bg-[#E63946] hover:bg-[#a51515] text-white font-semibold px-5 py-2 rounded-lg text-xs uppercase"
              >
                Imprimir Documento
              </button>
              <button
                onClick={() => setSelectedPdfContract(null)}
                className="px-4 border border-slate-200 text-slate-700 font-semibold rounded-lg text-xs"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
