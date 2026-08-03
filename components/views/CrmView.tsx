'use client';

import React, { useState } from 'react';
import { Client, PedidoOS, InventoryItem } from '@/lib/types';
import { DataListRow, RowMeta, Badge, RowAction } from '@/components/DataListRow';

interface CrmViewProps {
  clients: Client[];
  pedidosOS: PedidoOS[];
  inventory: InventoryItem[];
  onAddClient: (client: Client) => void;
  onAddOS: (os: PedidoOS) => void;
  onSelectClientForReport?: (clientName: string) => void;
}

export const CrmView: React.FC<CrmViewProps> = ({
  clients,
  pedidosOS,
  inventory,
  onAddClient,
  onAddOS,
  onSelectClientForReport,
}) => {
  const [crmSubTab, setCrmSubTab] = useState<'clientes' | 'pedidos_os' | 'estoque' | 'servicos'>('clientes');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddClientModal, setShowAddClientModal] = useState(false);
  const [selectedClientDetail, setSelectedClientDetail] = useState<Client | null>(null);

  // New client state
  const [newClientName, setNewClientName] = useState('');
  const [newClientCNPJ, setNewClientCNPJ] = useState('');
  const [newClientSegment, setNewClientSegment] = useState('Shopping Center');
  const [newClientAddress, setNewClientAddress] = useState('');

  const filteredClients = clients.filter(
    (c) =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.cnpj.includes(searchTerm)
  );

  const handleCreateClientSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName) return;

    const created: Client = {
      id: `c_${Date.now()}`,
      code: `#F0-${Date.now().toString().slice(-4)}`,
      name: newClientName,
      cnpj: newClientCNPJ || '00.000.000/0001-00',
      segment: newClientSegment,
      contractStatus: 'EM DIA',
      lastOSDate: new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase(),
      lastOSType: 'CADASTRO RECENTE',
      address: newClientAddress || 'Londrina / PR',
      contacts: [{ name: 'Responsável', role: 'Gerente', phone: '(43) 3300-0000', email: 'contato@cliente.com' }],
      totalContractsValue: 12000,
    };

    onAddClient(created);
    setShowAddClientModal(false);
    setNewClientName('');
    setNewClientCNPJ('');
    setNewClientAddress('');
  };

  return (
    <div className="flex flex-col w-full min-h-screen relative p-8 gap-6">
      {/* Header & Search */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Gestão Estrutural de Clientes &amp; Manutenção
          </span>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
            Diretório de Clientes &amp; Operações
          </h1>
        </div>

        {/* Search Bar */}
        <div className="relative w-full lg:w-96">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">
            search
          </span>
          <input
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#E63946]/20 focus:border-[#E63946] transition-all placeholder:text-slate-400 uppercase"
            placeholder="Buscar por cliente, ID ou CNPJ..."
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Sub Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-2">
        <div className="flex gap-2">
          {[
            { id: 'clientes', label: 'Clientes', icon: 'domain' },
            { id: 'pedidos_os', label: 'Pedidos & OS', icon: 'engineering' },
            { id: 'estoque', label: 'Estoque & Série BP', icon: 'inventory_2' },
            { id: 'servicos', label: 'Catálogo de Serviços', icon: 'handyman' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setCrmSubTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                crmSubTab === tab.id
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <span className="material-symbols-outlined text-base">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowAddClientModal(true)}
          className="bg-[#E63946] hover:bg-[#a51515] text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm flex items-center gap-1.5 uppercase tracking-wide"
        >
          <span className="material-symbols-outlined text-base">add</span> Novo Cliente
        </button>
      </div>

      {/* Subtab Content: CLIENTES */}
      {crmSubTab === 'clientes' && (
        <div className="flex flex-col gap-6">
          {/* Bento Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            <div className="bg-white p-6 rounded-xl shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase">Total Ativos</p>
              <h3 className="text-3xl font-bold text-slate-900 mt-2">{clients.length}</h3>
              <p className="text-xs text-emerald-600 mt-2 font-medium">100% monitorados</p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm">
              <p className="text-xs font-semibold text-slate-500 uppercase">Inadimplência</p>
              <h3 className="text-3xl font-bold text-[#E63946] mt-2">4.2%</h3>
              <p className="text-xs text-[#E63946] mt-2 font-medium">Revisão contratual</p>
            </div>

            <div className="md:col-span-2 bg-white p-6 rounded-xl shadow-sm flex justify-between items-center gap-4">
              <div>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full uppercase">
                  Capacidade de Atendimento
                </span>
                <h3 className="text-base font-bold text-slate-900 mt-2">Unidade Londrina &amp; Região</h3>
                <p className="text-xs text-slate-500 mt-1">Saturação operacional atual: 92%</p>
              </div>
              <button
                onClick={() => alert('Relatório técnico de saturação operacional exportado.')}
                className="shrink-0 border border-[#1A1A72] text-[#1A1A72] hover:bg-[#1A1A72] hover:text-white font-semibold text-xs px-4 py-2 rounded-lg transition-colors"
              >
                Exportar Laudo
              </button>
            </div>
          </div>

          {/* Lista de clientes (DataListRow) */}
          {filteredClients.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm py-16 text-center text-slate-400">
              <span className="material-symbols-outlined text-4xl text-slate-300">domain_disabled</span>
              <p className="mt-2 text-sm font-bold text-slate-500 uppercase tracking-wider">
                {searchTerm ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                {searchTerm ? 'Ajuste os termos da busca.' : 'Clique em "Novo Cliente" para começar.'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filteredClients.map((client) => {
                const statusColor =
                  client.contractStatus === 'EM DIA'
                    ? 'emerald'
                    : client.contractStatus === 'PENDENTE'
                    ? 'amber'
                    : 'red';
                return (
                  <DataListRow
                    key={client.id}
                    onClick={() => setSelectedClientDetail(client)}
                    leading={
                      <span className="w-10 h-10 rounded-lg bg-[#1A1A72]/10 text-[#1A1A72] flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-lg">domain</span>
                      </span>
                    }
                    title={<span className="uppercase">{client.name}</span>}
                    meta={
                      <>
                        <RowMeta label="CNPJ" value={<span className="font-data-mono">{client.cnpj}</span>} />
                        <RowMeta label="Código" value={<span className="font-data-mono">{client.code}</span>} />
                        <RowMeta label="Segmento" value={client.segment} />
                      </>
                    }
                    center={
                      <div className="text-left md:text-center">
                        <p className="text-[10px] text-slate-400 uppercase tracking-wider">Última OS</p>
                        <p className="font-data-mono text-slate-900 font-bold">{client.lastOSDate}</p>
                        <p className="text-[10px] text-slate-500 uppercase">{client.lastOSType}</p>
                      </div>
                    }
                    right={
                      <>
                        <Badge color={statusColor}>{client.contractStatus}</Badge>
                        <div className="flex items-center gap-1">
                          <RowAction
                            icon="visibility"
                            label="Ver detalhes do cliente"
                            onClick={() => setSelectedClientDetail(client)}
                          />
                          <RowAction
                            icon="description"
                            label="Abrir relatório técnico SDAI"
                            onClick={() => onSelectClientForReport?.(client.name)}
                          />
                        </div>
                      </>
                    }
                  />
                );
              })}
              <p className="text-xs text-slate-500 px-1 pt-1">
                Mostrando {filteredClients.length} de {clients.length} clientes cadastrados
              </p>
            </div>
          )}
        </div>
      )}

      {/* Subtab Content: PEDIDOS & OS */}
      {crmSubTab === 'pedidos_os' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-base font-bold text-slate-900 uppercase tracking-wide mb-4 border-b border-slate-100 pb-3">
            Ordens de Serviço Ativas &amp; Manutenções
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pedidosOS.map((os) => (
              <div key={os.id} className="border border-slate-200 rounded-lg p-4 bg-slate-50/50 flex flex-col justify-between gap-3">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-data-mono text-xs font-bold text-[#E63946]">{os.id}</span>
                    <h4 className="font-bold text-slate-900 text-sm uppercase">{os.title}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">{os.clientName}</p>
                  </div>
                  <span
                    className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase ${
                      os.status === 'CONCLUIDA'
                        ? 'bg-emerald-100 text-emerald-800'
                        : os.status === 'EM ANDAMENTO'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {os.status}
                  </span>
                </div>
                <div className="flex justify-between items-center font-data-mono text-xs text-slate-500 pt-3 border-t border-slate-200">
                  <span>Técnico: {os.technicianName}</span>
                  <span className="font-bold text-slate-900">R$ {os.value.toLocaleString('pt-BR')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Subtab Content: ESTOQUE */}
      {crmSubTab === 'estoque' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-base font-bold text-slate-900 uppercase tracking-wide mb-4 border-b border-slate-100 pb-3">
            Estoque de Componentes &amp; Rastreabilidade Série BP
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200">
                  <th className="py-3 px-4">Código / Série BP</th>
                  <th className="py-3 px-4">Descrição da Peça</th>
                  <th className="py-3 px-4">Categoria</th>
                  <th className="py-3 px-4 text-center">Estoque Atual</th>
                  <th className="py-3 px-4 text-right">Preço Unitário</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {inventory.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4 font-data-mono font-bold text-[#E63946]">
                      {item.code} <br />
                      <span className="text-[10px] text-slate-400 font-normal">{item.serialBP}</span>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900 uppercase">{item.name}</td>
                    <td className="py-3 px-4 text-slate-500">{item.category}</td>
                    <td className="py-3 px-4 text-center font-data-mono font-bold">
                      <span className={item.quantity <= item.minQuantity ? 'text-[#E63946]' : 'text-emerald-700'}>
                        {item.quantity} un
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-data-mono text-slate-900">R$ {item.unitPrice.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Subtab Content: SERVIÇOS */}
      {crmSubTab === 'servicos' && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm">
          <h3 className="text-base font-bold text-slate-900 uppercase tracking-wide mb-4 border-b border-slate-100 pb-3">
            Catálogo de Serviços Especializados SDAI
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { title: 'Manutenção Preventiva SDAI NBR 17240', desc: 'Inspeção mensal detalhada de laços, baterias 24V, sensores e central.', price: 'R$ 1.800/visita' },
              { title: 'Manutenção Corretiva & Programação', desc: 'Substituição rápida e repassagem de endereçamento em campo.', price: 'R$ 350/hora técnica' },
              { title: 'Laudo Pericial & Plano de Ação', desc: 'Vistoria fotográfica com emissão de ART registrada e matriz de risco.', price: 'R$ 4.500/unidade' },
            ].map((serv, i) => (
              <div key={i} className="border border-slate-200 rounded-lg p-5 bg-slate-50/50 flex flex-col justify-between">
                <div>
                  <h4 className="font-bold uppercase text-slate-900 text-sm">{serv.title}</h4>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed">{serv.desc}</p>
                </div>
                <p className="font-data-mono text-sm font-bold text-[#E63946] mt-4">{serv.price}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Add Client */}
      {showAddClientModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-xl p-6 shadow-2xl relative border border-slate-200">
            <button
              onClick={() => setShowAddClientModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 font-bold"
            >
              ✕
            </button>
            <h3 className="text-lg font-bold text-slate-900 uppercase mb-4">Novo Cadastro de Cliente</h3>
            <form onSubmit={handleCreateClientSubmit} className="space-y-4 text-xs font-medium">
              <div>
                <label className="block text-slate-600 mb-1 font-semibold uppercase">Razão Social / Nome Fantasia</label>
                <input
                  required
                  type="text"
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#E63946]/20"
                  placeholder="Ex: Londrina Norte Shopping"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1 font-semibold uppercase">CNPJ / CPF</label>
                <input
                  type="text"
                  value={newClientCNPJ}
                  onChange={(e) => setNewClientCNPJ(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-slate-900 font-data-mono focus:outline-none focus:ring-2 focus:ring-[#E63946]/20"
                  placeholder="00.000.000/0001-00"
                />
              </div>
              <div>
                <label className="block text-slate-600 mb-1 font-semibold uppercase">Segmento</label>
                <select
                  value={newClientSegment}
                  onChange={(e) => setNewClientSegment(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#E63946]/20"
                >
                  <option value="Shopping Center">Shopping Center</option>
                  <option value="Indústria">Indústria</option>
                  <option value="Condomínio Residencial">Condomínio Residencial</option>
                  <option value="Logística & Galpões">Logística &amp; Galpões</option>
                  <option value="Varejo / Supermercado">Varejo / Supermercado</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-600 mb-1 font-semibold uppercase">Endereço / Cidade</label>
                <input
                  type="text"
                  value={newClientAddress}
                  onChange={(e) => setNewClientAddress(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#E63946]/20"
                  placeholder="Londrina/PR"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-[#E63946] hover:bg-[#a51515] text-white py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors shadow-sm"
              >
                Cadastrar Cliente
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Client Detail Modal */}
      {selectedClientDetail && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-xl p-6 shadow-2xl relative border border-slate-200">
            <button
              onClick={() => setSelectedClientDetail(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 font-bold"
            >
              ✕
            </button>
            <span className="font-data-mono text-xs text-[#E63946] font-bold">{selectedClientDetail.code}</span>
            <h3 className="text-xl font-bold text-slate-900 uppercase mt-0.5">{selectedClientDetail.name}</h3>
            <p className="text-xs text-slate-500 mb-4">{selectedClientDetail.cnpj} | {selectedClientDetail.segment}</p>

            <div className="space-y-2 bg-slate-50 p-4 rounded-lg text-xs font-data-mono border border-slate-200 mb-5">
              <div><strong className="text-slate-900">Endereço:</strong> {selectedClientDetail.address}</div>
              <div><strong className="text-slate-900">Status do Contrato:</strong> {selectedClientDetail.contractStatus}</div>
              <div><strong className="text-slate-900">Última OS:</strong> {selectedClientDetail.lastOSDate} ({selectedClientDetail.lastOSType})</div>
              <div><strong className="text-slate-900">Valor Anual:</strong> R$ {selectedClientDetail.totalContractsValue.toLocaleString('pt-BR')}</div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  const clientName = selectedClientDetail.name;
                  setSelectedClientDetail(null);
                  if (onSelectClientForReport) onSelectClientForReport(clientName);
                }}
                className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-semibold py-2.5 rounded-lg text-xs uppercase transition-colors"
              >
                Abrir Relatório Técnico SDAI
              </button>
              <button
                onClick={() => setSelectedClientDetail(null)}
                className="px-4 border border-slate-200 text-slate-700 font-semibold rounded-lg text-xs hover:bg-slate-50 transition-colors"
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
