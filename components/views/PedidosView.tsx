'use client';

import React, { useState } from 'react';
import { PedidoOS, Client, Pedido, InventoryItem, PartnerBrand, PedidoTemplate, PedidoStatus } from '@/lib/types';
import { CommercialProposalModal } from '@/components/proposta/CommercialProposalModal';
import { CommercialProposalPDFView } from '@/components/proposta/CommercialProposalPDFView';
import {
  FileText,
  Plus,
  Search,
  Eye,
  CheckCircle,
  Clock,
  AlertTriangle,
  FileCheck2,
  Wrench,
  Send,
  XCircle,
  ArrowRight,
  Printer,
  Sparkles,
} from 'lucide-react';

interface PedidosViewProps {
  pedidosOS: PedidoOS[];
  pedidos: Pedido[];
  clients: Client[];
  inventory: InventoryItem[];
  partnerBrands: PartnerBrand[];
  templates: PedidoTemplate[];
  companyProfile: any;
  onAddOS: (os: PedidoOS) => void;
  onSavePedido: (pedido: Pedido) => void;
  onUpdatePedidoStatus: (pedidoId: string, newStatus: PedidoStatus) => void;
  onGenerateOSFromPedido: (pedido: Pedido) => void;
  onSelectClientForReport?: (clientName: string) => void;
}

export const PedidosView: React.FC<PedidosViewProps> = ({
  pedidosOS,
  pedidos,
  clients,
  inventory,
  partnerBrands,
  templates,
  companyProfile,
  onAddOS,
  onSavePedido,
  onUpdatePedidoStatus,
  onGenerateOSFromPedido,
  onSelectClientForReport,
}) => {
  // Main view tab: 'propostas' (CRM Pedidos) or 'ordens_servico' (OS de Campo)
  const [viewTab, setViewTab] = useState<'propostas' | 'ordens_servico'>('propostas');

  // Filters & Search
  const [filterStatus, setFilterStatus] = useState<string>('TODOS');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals & Overlays
  const [isProposalModalOpen, setIsProposalModalOpen] = useState(false);
  const [editingPedido, setEditingPedido] = useState<Pedido | null>(null);

  const [pdfPreviewPedido, setPdfPreviewPedido] = useState<Pedido | null>(null);

  // Filtered Pedidos (Commercial Proposals)
  const filteredPedidos = pedidos.filter((p) => {
    const matchesStatus = filterStatus === 'TODOS' || p.status === filterStatus;
    const matchesSearch =
      p.numeroPedido.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.clienteNome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.referencia.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Filtered Pedidos OS (Technical Orders)
  const filteredOS = pedidosOS.filter((p) => {
    const matchesStatus = filterStatus === 'TODOS' || p.status === filterStatus;
    const matchesSearch =
      p.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.technicianName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Status Badge Colors & Labels
  const getStatusBadge = (status: PedidoStatus) => {
    switch (status) {
      case 'rascunho':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 uppercase">Rascunho</span>;
      case 'em_revisao':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 uppercase">Em Revisão</span>;
      case 'aprovado_interno':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 uppercase">Aprovado Interno</span>;
      case 'enviado_ao_cliente':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 uppercase">Enviado ao Cliente</span>;
      case 'aceito':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 uppercase">Aceito</span>;
      case 'recusado':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-800 uppercase">Recusado</span>;
      case 'expirado':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-600 uppercase">Expirado</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 uppercase">{status}</span>;
    }
  };

  const handleOpenNewProposal = () => {
    setEditingPedido(null);
    setIsProposalModalOpen(true);
  };

  const handleEditProposal = (ped: Pedido) => {
    setEditingPedido(ped);
    setIsProposalModalOpen(true);
  };

  return (
    <div className="flex flex-col w-full p-8 gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Módulo CRM &bull; Gestão Comercial &amp; Execução
          </span>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
            Pedidos, Propostas Comerciais &amp; Ordens de Serviço (OS)
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleOpenNewProposal}
            className="bg-[#E63946] hover:bg-[#a51515] text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-colors shadow-sm flex items-center gap-1.5 uppercase tracking-wide"
          >
            <Plus className="w-4 h-4" /> Nova Proposta Comercial
          </button>
        </div>
      </div>

      {/* Main View Mode Selector (CRM Proposals vs Technical OS) */}
      <div className="flex items-center gap-3 bg-slate-200 p-1.5 rounded-xl w-fit">
        <button
          onClick={() => {
            setViewTab('propostas');
            setFilterStatus('TODOS');
          }}
          className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
            viewTab === 'propostas'
              ? 'bg-[#0B1E38] text-white shadow-md'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileText className="w-4 h-4 text-[#F2A900]" /> Propostas Comerciais (CRM) ({pedidos.length})
        </button>

        <button
          onClick={() => {
            setViewTab('ordens_servico');
            setFilterStatus('TODOS');
          }}
          className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
            viewTab === 'ordens_servico'
              ? 'bg-[#0B1E38] text-white shadow-md'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Wrench className="w-4 h-4 text-emerald-400" /> Ordens de Serviço (Campo) ({pedidosOS.length})
        </button>
      </div>

      {/* Metrics Row */}
      {viewTab === 'propostas' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-[11px] font-semibold text-slate-500 uppercase">Total de Propostas</p>
            <p className="font-data-mono text-2xl font-bold text-slate-900 mt-1">{pedidos.length}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-[11px] font-semibold text-slate-500 uppercase">Enviadas ao Cliente</p>
            <p className="font-data-mono text-2xl font-bold text-purple-600 mt-1">
              {pedidos.filter((p) => p.status === 'enviado_ao_cliente').length}
            </p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-[11px] font-semibold text-slate-500 uppercase">Propostas Aceitas</p>
            <p className="font-data-mono text-2xl font-bold text-emerald-600 mt-1">
              {pedidos.filter((p) => p.status === 'aceito').length}
            </p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-[11px] font-semibold text-slate-500 uppercase">Volume Comercial R$</p>
            <p className="font-data-mono text-2xl font-bold text-[#E63946] mt-1">
              R$ {pedidos.reduce((acc, p) => acc + (p.proposal.valorTotal || 0), 0).toLocaleString('pt-BR')}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-[11px] font-semibold text-slate-500 uppercase">Ordens de Serviço</p>
            <p className="font-data-mono text-2xl font-bold text-slate-900 mt-1">{pedidosOS.length}</p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-[11px] font-semibold text-slate-500 uppercase">Em Andamento</p>
            <p className="font-data-mono text-2xl font-bold text-amber-600 mt-1">
              {pedidosOS.filter((p) => p.status === 'EM ANDAMENTO').length}
            </p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-[11px] font-semibold text-slate-500 uppercase">Concluídas</p>
            <p className="font-data-mono text-2xl font-bold text-emerald-600 mt-1">
              {pedidosOS.filter((p) => p.status === 'CONCLUIDA').length}
            </p>
          </div>
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <p className="text-[11px] font-semibold text-slate-500 uppercase">Faturamento de OS</p>
            <p className="font-data-mono text-2xl font-bold text-[#E63946] mt-1">
              R$ {pedidosOS.reduce((acc, p) => acc + p.value, 0).toLocaleString('pt-BR')}
            </p>
          </div>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 text-slate-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Buscar por número, cliente, referência..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E63946]/20"
          />
        </div>

        {viewTab === 'propostas' ? (
          <div className="flex gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            {['TODOS', 'rascunho', 'em_revisao', 'aprovado_interno', 'enviado_ao_cliente', 'aceito', 'recusado'].map(
              (st) => (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors whitespace-nowrap uppercase ${
                    filterStatus === st
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {st.replace('_', ' ')}
                </button>
              )
            )}
          </div>
        ) : (
          <div className="flex gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
            {['TODOS', 'ABERTA', 'EM ANDAMENTO', 'CONCLUIDA', 'ATRASADA'].map((st) => (
              <button
                key={st}
                onClick={() => setFilterStatus(st)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                  filterStatus === st
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Table: Commercial Proposals (CRM) */}
      {viewTab === 'propostas' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-[#0B1E38] px-6 py-4 text-white text-xs font-bold uppercase tracking-wider flex justify-between items-center">
            <span>Listagem de Pedidos de Proposta Comercial Fireowl Controls</span>
            <span className="text-[11px] text-[#F2A900]">Formato de Saída: Proposta PDF Normativa</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200">
                  <th className="p-4">Nº Pedido / Data</th>
                  <th className="p-4">Cliente / Projeto</th>
                  <th className="p-4">Responsável</th>
                  <th className="p-4 text-center">Status Workflow</th>
                  <th className="p-4 text-right">Valor Total</th>
                  <th className="p-4 text-center">Ações / Transições</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredPedidos.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400 font-semibold">
                      Nenhum pedido de proposta encontrado.
                    </td>
                  </tr>
                ) : (
                  filteredPedidos.map((ped) => (
                    <tr key={ped.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4">
                        <span className="font-data-mono font-bold text-[#E63946] text-sm">{ped.numeroPedido}</span>
                        <br />
                        <span className="text-[10px] text-slate-400 font-data-mono">{ped.dataEmissao}</span>
                      </td>

                      <td className="p-4">
                        <span className="font-bold text-slate-900 uppercase">{ped.clienteNome}</span>
                        <br />
                        <span className="text-[11px] text-slate-600 font-medium">{ped.referencia}</span>
                      </td>

                      <td className="p-4">
                        <span className="text-slate-900 font-bold">{ped.responsavelComercialNome}</span>
                        <br />
                        <span className="text-[10px] text-slate-400">{ped.fornecedor}</span>
                      </td>

                      <td className="p-4 text-center">{getStatusBadge(ped.status)}</td>

                      <td className="p-4 text-right font-data-mono font-bold text-slate-900 text-sm">
                        R$ {(ped.proposal.valorTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>

                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          {/* Preview PDF */}
                          <button
                            onClick={() => setPdfPreviewPedido(ped)}
                            title="Gerar / Pré-visualizar PDF da Proposta"
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5 text-blue-600" /> PDF
                          </button>

                          {/* Edit Proposal */}
                          <button
                            onClick={() => handleEditProposal(ped)}
                            title="Editar Proposta"
                            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-bold transition-colors"
                          >
                            Editar
                          </button>

                          {/* Workflow Actions */}
                          {ped.status === 'rascunho' && (
                            <button
                              onClick={() => onUpdatePedidoStatus(ped.id, 'em_revisao')}
                              className="px-2 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-[10px] font-bold uppercase"
                            >
                              Revisar
                            </button>
                          )}

                          {ped.status === 'em_revisao' && (
                            <button
                              onClick={() => onUpdatePedidoStatus(ped.id, 'aprovado_interno')}
                              className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[10px] font-bold uppercase"
                            >
                              Aprovar
                            </button>
                          )}

                          {(ped.status === 'aprovado_interno' || ped.status === 'em_revisao') && (
                            <button
                              onClick={() => onUpdatePedidoStatus(ped.id, 'enviado_ao_cliente')}
                              className="px-2 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded text-[10px] font-bold uppercase flex items-center gap-1"
                            >
                              <Send className="w-3 h-3" /> Enviar
                            </button>
                          )}

                          {ped.status === 'enviado_ao_cliente' && (
                            <>
                              <button
                                onClick={() => onUpdatePedidoStatus(ped.id, 'aceito')}
                                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-bold uppercase"
                              >
                                Aceito
                              </button>
                              <button
                                onClick={() => onUpdatePedidoStatus(ped.id, 'recusado')}
                                className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-[10px] font-bold uppercase"
                              >
                                Recusado
                              </button>
                            </>
                          )}

                          {ped.status === 'aceito' && (
                            <button
                              onClick={() => onGenerateOSFromPedido(ped)}
                              className="px-2.5 py-1 bg-[#E63946] hover:bg-[#a51515] text-white rounded text-[10px] font-bold uppercase flex items-center gap-1 shadow-xs"
                            >
                              <Wrench className="w-3 h-3" /> Gerar OS
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Table: Technical Field OS */}
      {viewTab === 'ordens_servico' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="bg-slate-900 px-6 py-4 text-white text-xs font-bold uppercase tracking-wider">
            Listagem de Ordens de Serviço (OS) em Execução Técnica de Campo
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200">
                  <th className="p-4">Cód. OS / Pedido</th>
                  <th className="p-4">Cliente / Unidade</th>
                  <th className="p-4">Tipo &amp; Escopo</th>
                  <th className="p-4">Técnico Responsável</th>
                  <th className="p-4 text-center">Prioridade</th>
                  <th className="p-4 text-center">Status OS</th>
                  <th className="p-4 text-right">Valor do Pedido</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredOS.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-400 font-semibold">
                      Nenhuma ordem de serviço encontrada.
                    </td>
                  </tr>
                ) : (
                  filteredOS.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-4">
                        <span className="font-data-mono font-bold text-[#E63946]">{p.id}</span> <br />
                        <span className="font-data-mono text-[10px] text-slate-400">{p.pedidoId}</span>
                      </td>
                      <td className="p-4">
                        <span className="font-bold text-slate-900 uppercase">{p.clientName}</span>
                      </td>
                      <td className="p-4">
                        <span className="text-slate-900 font-semibold">{p.title}</span> <br />
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold uppercase mt-1 inline-block">
                          {p.type}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-slate-900 font-semibold">{p.technicianName}</span> <br />
                        <span className="text-[10px] text-slate-400 font-data-mono">{p.scheduledDate}</span>
                      </td>
                      <td className="p-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            p.priority === 'CRITICA'
                              ? 'bg-red-100 text-red-800'
                              : p.priority === 'ALTA'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {p.priority}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            p.status === 'CONCLUIDA'
                              ? 'bg-emerald-100 text-emerald-800'
                              : p.status === 'EM ANDAMENTO'
                              ? 'bg-blue-100 text-blue-800'
                              : p.status === 'ATRASADA'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="p-4 text-right font-data-mono font-bold text-slate-900">
                        R$ {p.value.toLocaleString('pt-BR')}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Commercial Proposal Form Modal */}
      <CommercialProposalModal
        isOpen={isProposalModalOpen}
        onClose={() => setIsProposalModalOpen(false)}
        onSave={onSavePedido}
        initialPedido={editingPedido}
        clients={clients}
        inventory={inventory}
        partnerBrands={partnerBrands}
        templates={templates}
        onPreviewPDF={(ped) => setPdfPreviewPedido(ped)}
      />

      {/* PDF View Overlay */}
      {pdfPreviewPedido && (
        <CommercialProposalPDFView
          pedido={pdfPreviewPedido}
          companyProfile={companyProfile}
          onClose={() => setPdfPreviewPedido(null)}
          onSendEmail={(ped) => {
            alert(`Proposta comercial ${ped.numeroPedido} enviada com sucesso para o e-mail do cliente!`);
          }}
        />
      )}
    </div>
  );
};
