'use client';
import { showToast, requestConfirm } from '@/components/ui/Feedback';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Client,
  OrdemServico,
  InventoryItem,
  Contract,
  Pedido,
  FinancialTransaction,
  ServiceCatalogItem,
  TabPath,
  PartnerBrand,
  Supplier,
  UserRole,
  ReportInstance,
  Pendencia,
  ClientEvent,
} from '@/lib/types';
import { DataListRow, RowMeta, Badge, RowAction } from '@/components/DataListRow';
import { ClientLogo } from '@/components/ClientLogo';
import { usePrivacy } from '@/lib/privacy';
import { DevicesManager } from '@/components/reports/DevicesManager';
import { EmptyState } from '@/components/EmptyState';
import { fetchCnpjData } from '@/lib/cnpj';
import { uploadClientFachada, uploadClientLogo, removePropostaCapa } from '@/lib/propostaCapa';
import { nomeFantasiaCliente, razaoSocialCliente } from '@/lib/utils';
import { resolveLogoDataUrls } from '@/lib/institucional';
import { fetchReports } from '@/lib/reports';
import { OS_STATUS_ATIVOS } from '@/lib/ordensServico';
import { fetchPendencias } from '@/lib/pendencias';
import { isSupabaseConfigured } from '@/lib/inventory';
import { fetchClientEvents, insertClientEvent } from '@/lib/clientEvents';
import { ClientDossie } from '@/components/clients/ClientDossie';

interface CrmViewProps {
  clients: Client[];
  ordensServico: OrdemServico[];
  pedidos: Pedido[];
  contracts: Contract[];
  transactions: FinancialTransaction[];
  inventory: InventoryItem[];
  services: ServiceCatalogItem[];
  suppliers: Supplier[];
  partnerBrands: PartnerBrand[];
  onAddPartnerBrand: (brand: PartnerBrand) => void;
  onAddClient: (client: Client) => void;
  onDeleteClient: (client: Client) => Promise<void>;
  onSelectClientForReport?: (clientName: string) => void;
  onNavigateToTab?: (tab: TabPath) => void;
  userRole?: UserRole;
}

const brl = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
const labelCls = 'block text-fg-secondary mb-1 font-semibold uppercase text-[11px]';
const inputCls =
  'w-full border border-border rounded-lg p-2.5 text-fg bg-surface focus:outline-none focus:ring-2 focus:ring-danger/20 focus:border-danger/40';

const norm = (s: string) => (s || '').trim().toLowerCase();

interface ContactForm {
  name: string;
  role: string;
  phone: string;
  email: string;
}

const emptyContact = (): ContactForm => ({ name: '', role: '', phone: '', email: '' });

// Agrupamento de status de propostas
const PROPOSAL_ACEITO: Pedido['status'][] = ['aceito'];
const PROPOSAL_ABERTO: Pedido['status'][] = ['rascunho', 'em_revisao', 'aprovado_interno', 'enviado_ao_cliente', 'visualizado_cliente', 'em_negociacao'];
const PROPOSAL_CANCELADO: Pedido['status'][] = ['recusado', 'expirado'];

// Rótulo/cor canônicos da OS real (ordens_servico). Sem statuses MAIÚSCULOS de mock.
const OS_STATUS_UI: Record<OrdemServico['status'], { label: string; color: 'emerald' | 'amber' | 'blue' | 'red' | 'slate' }> = {
  aberta: { label: 'Aberta', color: 'amber' },
  agendada: { label: 'Agendada', color: 'blue' },
  em_execucao: { label: 'Em execução', color: 'amber' },
  concluida: { label: 'Concluída', color: 'emerald' },
  cancelada: { label: 'Cancelada', color: 'red' },
};

const proposalStatusLabel: Record<Pedido['status'], string> = {
  rascunho: 'Rascunho',
  em_revisao: 'Em revisão',
  aprovado_interno: 'Aprovado interno',
  enviado_ao_cliente: 'Enviado ao cliente',
  visualizado_cliente: 'Visualizada pelo cliente',
  em_negociacao: 'Em negociação',
  aceito: 'Aceito',
  concluido: 'Concluída / Recebida',
  recusado: 'Recusado',
  expirado: 'Expirado',
};

export const CrmView: React.FC<CrmViewProps> = ({
  clients,
  ordensServico,
  pedidos,
  contracts,
  transactions,
  inventory,
  services,
  suppliers,
  partnerBrands,
  onAddPartnerBrand,
  onAddClient,
  onDeleteClient,
  onSelectClientForReport,
  onNavigateToTab,
  userRole = 'ADMINISTRATIVO',
}) => {
  const { maskMoney } = usePrivacy();
  // O CRM não clona o menu lateral: mostra só a base de Clientes. (Estoque,
  // Pedidos e Serviços têm suas próprias abas.)
  const [crmSubTab] = useState<'clientes' | 'pedidos_os' | 'estoque' | 'servicos'>('clientes');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterContractStatus, setFilterContractStatus] = useState<Client['contractStatus'] | ''>('');
  const [filterSegment, setFilterSegment] = useState('');
  const [clientLogoUrls, setClientLogoUrls] = useState<Record<string, string>>({});
  const [showAddClientModal, setShowAddClientModal] = useState(false);
  const [selectedClientDetail, setSelectedClientDetail] = useState<Client | null>(null);

  // Dossiê do cliente (Client 360) em página cheia. A seleção é refletida na URL
  // (?cliente=<id>) para que o dossiê seja compartilhável e sobreviva a reload —
  // sem rota dinâmica de arquivo (incompatível com output:'export').
  const openClientDossie = React.useCallback((client: Client) => {
    setSelectedClientDetail(client);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('cliente', client.id);
      window.history.replaceState(window.history.state, '', url.toString());
    }
  }, []);
  const closeClientDossie = React.useCallback(() => {
    setSelectedClientDetail(null);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('cliente');
      window.history.replaceState(window.history.state, '', url.toString());
    }
  }, []);
  // Restaura o dossiê a partir de ?cliente=<id> quando os clientes estão prontos.
  const dossieRestored = React.useRef(false);
  useEffect(() => {
    if (dossieRestored.current || clients.length === 0 || typeof window === 'undefined') return;
    const id = new URLSearchParams(window.location.search).get('cliente');
    if (id) {
      const found = clients.find((c) => c.id === id);
      if (found) setSelectedClientDetail(found);
    }
    dossieRestored.current = true;
  }, [clients]);

  // Formulário de novo cliente (cadastro completo)
  const [nTipoPessoa, setNTipoPessoa] = useState<'PJ' | 'PF'>('PJ');
  const [nName, setNName] = useState('');
  const [nFantasia, setNFantasia] = useState('');
  const [nCNPJ, setNCNPJ] = useState('');
  const [nIE, setNIE] = useState('');
  const [nSegment, setNSegment] = useState('Shopping Center');
  const [nStatus, setNStatus] = useState<Client['contractStatus']>('EM DIA');
  const [nAddress, setNAddress] = useState('');
  const [nCity, setNCity] = useState('Londrina/PR');
  const [nAnnual, setNAnnual] = useState(0);
  const [nContacts, setNContacts] = useState<ContactForm[]>([emptyContact()]);
  // Foto da fachada (capa padrão das propostas do cliente).
  const [nFachada, setNFachada] = useState<string>('');
  const [nLogo, setNLogo] = useState<string>('');
  const [fachadaBusy, setFachadaBusy] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);
  const handleFachadaUpload = async (file: File) => {
    setFachadaBusy(true);
    try {
      const path = await uploadClientFachada(file, editingClient?.id || `c_${Date.now()}`);
      setNFachada(path);
    } catch {
      showToast('Não foi possível enviar a foto. Verifique a conexão com o Supabase.');
    } finally {
      setFachadaBusy(false);
    }
  };
  const handleFachadaRemove = async () => {
    if (nFachada) { try { await removePropostaCapa(nFachada); } catch { /* best-effort */ } }
    setNFachada('');
  };
  const handleLogoUpload = async (file: File) => {
    setLogoBusy(true);
    try {
      const path = await uploadClientLogo(file, editingClient?.id || `c_${Date.now()}`);
      setNLogo(path);
    } catch {
      showToast('Não foi possível enviar a logo. Verifique a conexão com o Supabase.');
    } finally {
      setLogoBusy(false);
    }
  };
  const handleLogoRemove = async () => {
    if (nLogo) { try { await removePropostaCapa(nLogo); } catch { /* best-effort */ } }
    setNLogo('');
  };

  // Busca automática de CNPJ
  const [isSearchingCnpj, setIsSearchingCnpj] = useState(false);
  const [cnpjSearchError, setCnpjSearchError] = useState('');

  const handleSearchCnpj = async (cnpjToSearch?: string) => {
    const targetCnpj = cnpjToSearch || nCNPJ;
    const digits = targetCnpj.replace(/\D/g, '');
    if (digits.length !== 14) {
      setCnpjSearchError('CNPJ deve conter 14 dígitos.');
      return;
    }

    setIsSearchingCnpj(true);
    setCnpjSearchError('');
    try {
      const data = await fetchCnpjData(digits);
      if (data.razaoSocial) setNName(data.razaoSocial);
      if (data.nomeFantasia) setNFantasia(data.nomeFantasia);
      if (data.logradouro) setNAddress(data.logradouro);
      if (data.cidadeUf) setNCity(data.cidadeUf);

      // Formata o CNPJ visualmente (XX.XXX.XXX/XXXX-XX)
      const formattedCnpj = digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
      setNCNPJ(formattedCnpj);

      // Preenche contato principal se houver e-mail ou telefone retornado
      if (data.email || data.telefone) {
        setNContacts((prev) => {
          const first = prev[0] || emptyContact();
          const updatedFirst: ContactForm = {
            name: first.name || 'Contato Principal',
            role: first.role || 'Responsável',
            phone: first.phone || data.telefone,
            email: first.email || data.email,
          };
          return [updatedFirst, ...prev.slice(1)];
        });
      }
    } catch (err: any) {
      setCnpjSearchError(err.message || 'Erro ao consultar CNPJ.');
    } finally {
      setIsSearchingCnpj(false);
    }
  };

  // Estado para edição de cliente existente
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const startEditClient = (client: Client) => {
    setEditingClient(client);

    // Separa Nome de Nome Fantasia se estiver formato "Razão (Fantasia)"
    const matchFantasia = client.name.match(/\(([^)]+)\)$/);
    if (matchFantasia) {
      setNFantasia(matchFantasia[1]);
      setNName(client.name.replace(/\s*\([^)]*\)$/, '').trim());
    } else {
      setNName(client.name);
      setNFantasia('');
    }

    setNCNPJ(client.cnpj || '');
    setNIE('');
    setNSegment(client.segment || 'Shopping Center');
    setNStatus(client.contractStatus || 'EM DIA');

    if (client.address && client.address.includes(' — ')) {
      const parts = client.address.split(' — ');
      setNAddress(parts[0]);
      setNCity(parts.slice(1).join(' — '));
    } else {
      setNAddress(client.address || '');
      setNCity('Londrina/PR');
    }

    setNAnnual(client.totalContractsValue || 0);
    setNContacts(client.contacts && client.contacts.length > 0 ? client.contacts : [emptyContact()]);
    setNFachada(client.fachadaPath || '');
    setNLogo(client.logoPath || '');

    const digits = (client.cnpj || '').replace(/\D/g, '');
    setNTipoPessoa(digits.length <= 11 ? 'PF' : 'PJ');
    setCnpjSearchError('');
    setIsSearchingCnpj(false);
    setShowAddClientModal(true);
  };

  const clientSegments = useMemo(() => Array.from(new Set(clients.map((c) => c.segment).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR')), [clients]);
  useEffect(() => {
    let alive = true;
    resolveLogoDataUrls(clients.map((c) => c.logoPath || '').filter(Boolean)).then((map) => { if (alive) setClientLogoUrls(map); }).catch(() => {});
    return () => { alive = false; };
  }, [clients]);
  const filteredClients = clients.filter((c) => {
    const q = searchTerm.toLowerCase();
    return (!q || c.name.toLowerCase().includes(q) || nomeFantasiaCliente(c.name).toLowerCase().includes(q) || c.code.toLowerCase().includes(q) || c.cnpj.includes(searchTerm))
      && (!filterContractStatus || c.contractStatus === filterContractStatus)
      && (!filterSegment || c.segment === filterSegment);
  });

  const resetClientForm = () => {
    setEditingClient(null);
    setNTipoPessoa('PJ');
    setNName('');
    setNFantasia('');
    setNCNPJ('');
    setNIE('');
    setNSegment('Shopping Center');
    setNStatus('EM DIA');
    setNAddress('');
    setNCity('Londrina/PR');
    setNAnnual(0);
    setNContacts([emptyContact()]);
    setNFachada('');
    setNLogo('');
    setFachadaBusy(false);
    setLogoBusy(false);
    setCnpjSearchError('');
    setIsSearchingCnpj(false);
  };

  const updateContact = (idx: number, field: keyof ContactForm, value: string) => {
    setNContacts((prev) => prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c)));
  };
  const addContactRow = () => setNContacts((prev) => [...prev, emptyContact()]);
  const removeContactRow = (idx: number) => setNContacts((prev) => prev.filter((_, i) => i !== idx));

  const handleCreateClientSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nName) return;

    const cleanContacts = nContacts
      .filter((c) => c.name.trim() || c.email.trim() || c.phone.trim())
      .map((c) => ({
        name: c.name || 'Contato',
        role: c.role || 'Responsável',
        phone: c.phone || '',
        email: c.email || '',
      }));

    const fullAddress = [nAddress, nCity].filter(Boolean).join(' — ');

    const payload: Client = {
      id: editingClient ? editingClient.id : `c_${Date.now()}`,
      code: editingClient ? editingClient.code : `#F0-${Date.now().toString().slice(-4)}`,
      name: nFantasia ? `${nName} (${nFantasia})` : nName,
      cnpj: nCNPJ || '00.000.000/0001-00',
      segment: nSegment,
      contractStatus: nStatus,
      lastOSDate: editingClient
        ? editingClient.lastOSDate
        : new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase(),
      lastOSType: editingClient ? editingClient.lastOSType : 'CADASTRO RECENTE',
      address: fullAddress || 'Londrina / PR',
      contacts: cleanContacts.length ? cleanContacts : [{ name: 'Responsável', role: 'Gerente', phone: '', email: '' }],
      totalContractsValue: Number(nAnnual) || 0,
      pendenteValidacao: editingClient ? editingClient.pendenteValidacao : undefined,
      createdByRole: editingClient ? editingClient.createdByRole : undefined,
      fachadaPath: nFachada || undefined,
      logoPath: nLogo || undefined,
    };

    onAddClient(payload);
    setShowAddClientModal(false);
    resetClientForm();
  };

  // Client 360 em página cheia: quando um cliente está selecionado, o dossiê
  // OCUPA o container do CRM (<main>, que já compensa a sidebar). Substituir o
  // diretório por completo evita padding/gaps extras e garante width:100% real.
  if (selectedClientDetail) {
    return (
      <ClientDossie
        client={selectedClientDetail}
        contracts={contracts}
        pedidos={pedidos}
        ordensServico={ordensServico}
        transactions={transactions}
        inventory={inventory}
        suppliers={suppliers}
        fabricantes={partnerBrands}
        onAddFabricante={(name) => onAddPartnerBrand({ id: `pb_${Date.now()}`, name, category: 'SDAI' })}
        onClose={closeClientDossie}
        onEditClient={(c) => {
          closeClientDossie();
          startEditClient(c);
        }}
        onDeleteClient={onDeleteClient}
        onOpenReport={(name) => {
          closeClientDossie();
          onSelectClientForReport?.(name);
        }}
        onNavigateToTab={(tab) => {
          closeClientDossie();
          onNavigateToTab?.(tab);
        }}
        userRole={userRole}
      />
    );
  }

  return (
    <div className="flex flex-col w-full min-h-screen relative p-4 md:p-8 gap-6">
      {/* Header & Search */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border pb-5">
        <div>
          <span className="text-xs font-semibold text-fg-secondary uppercase tracking-wider">
            Gestão Estrutural de Clientes &amp; Manutenção
          </span>
          <h1 className="text-2xl font-bold text-fg tracking-tight mt-0.5">
            Diretório de Clientes &amp; Operações
          </h1>
        </div>

        {/* Busca e filtros */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full lg:w-auto">
        <div className="relative sm:col-span-3 lg:w-96">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted text-lg">
            search
          </span>
          <input
            className="w-full pl-9 pr-4 py-2 bg-surface border border-border rounded-lg text-xs font-medium text-fg focus:outline-none focus:ring-2 focus:ring-danger/20 focus:border-danger transition-all placeholder:text-fg-muted uppercase"
            placeholder="Buscar por cliente, ID ou CNPJ..."
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
          <select value={filterContractStatus} onChange={(e) => setFilterContractStatus(e.target.value as Client['contractStatus'] | '')} className="px-3 py-2 text-xs border border-border rounded-lg bg-surface">
            <option value="">Todas as situações</option><option value="EM DIA">Em dia</option><option value="PENDENTE">Pendente</option><option value="ATRASADO">Atrasado</option>
          </select>
          <select value={filterSegment} onChange={(e) => setFilterSegment(e.target.value)} className="px-3 py-2 text-xs border border-border rounded-lg bg-surface">
            <option value="">Todos os segmentos</option>{clientSegments.map((segment) => <option key={segment} value={segment}>{segment}</option>)}
          </select>
          {(searchTerm || filterContractStatus || filterSegment) && <button type="button" onClick={() => { setSearchTerm(''); setFilterContractStatus(''); setFilterSegment(''); }} className="text-xs font-semibold text-primary hover:underline">Limpar</button>}
        </div>
      </div>

      {/* Ação do módulo (sem sub-abas que clonam o menu lateral) */}
      <div className="flex items-center justify-between gap-3 border-b border-border pb-2">
        <p className="text-xs font-bold uppercase tracking-wider text-fg-secondary">Base de clientes</p>
        <button
          onClick={() => setShowAddClientModal(true)}
          className="bg-danger hover:bg-danger-hover text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm flex items-center gap-1.5 uppercase tracking-wide"
        >
          <span className="material-symbols-outlined text-base">add</span> Novo Cliente
        </button>
      </div>

      {/* Subtab Content: CLIENTES */}
      {crmSubTab === 'clientes' && (
        <div className="flex flex-col gap-6">
          {/* Bento Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
            <div className="bg-surface p-6 rounded-xl shadow-sm">
              <p className="text-xs font-semibold text-fg-secondary uppercase">Total Ativos</p>
              <h3 className="text-3xl font-bold text-fg mt-2">{clients.length}</h3>
              <p className="text-xs text-emerald-600 mt-2 font-medium">100% monitorados</p>
            </div>

            <div className="bg-surface p-6 rounded-xl shadow-sm">
              <p className="text-xs font-semibold text-fg-secondary uppercase">Contratos Ativos</p>
              <h3 className="text-3xl font-bold text-fg mt-2">
                {contracts.filter((c) => c.status === 'ATIVO').length}
              </h3>
              <p className="text-xs text-fg-secondary mt-2 font-medium">de {contracts.length} no total</p>
            </div>

            <div className="md:col-span-2 bg-surface p-6 rounded-xl shadow-sm flex justify-between items-center gap-4">
              <div>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full uppercase">
                  Receita Recorrente (MRR)
                </span>
                <h3 className="font-data-mono text-2xl font-bold text-fg mt-2">
                  {maskMoney(brl(contracts.reduce((acc, c) => acc + c.monthlyValue, 0)))}
                </h3>
                <p className="text-xs text-fg-secondary mt-1">Somatório dos contratos vigentes</p>
              </div>
              <button
                onClick={() => onNavigateToTab?.('contratos')}
                className="shrink-0 border border-primary text-primary hover:bg-navy hover:text-white font-semibold text-xs px-4 py-2 rounded-lg transition-colors"
              >
                Ver Contratos
              </button>
            </div>
          </div>

          {/* Lista de clientes (DataListRow) */}
          {filteredClients.length === 0 ? (
            <EmptyState
              variant="clientes"
              title={searchTerm ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
              description={searchTerm ? 'Ajuste os termos da busca.' : 'Cadastre o primeiro cliente para começar.'}
              actionLabel={searchTerm ? undefined : 'Novo cliente'}
              onAction={searchTerm ? undefined : () => setShowAddClientModal(true)}
            />
          ) : (
            <div className="flex flex-col gap-3">
              {filteredClients.map((client) => {
                const statusColor =
                  client.contractStatus === 'EM DIA'
                    ? 'emerald'
                    : client.contractStatus === 'PENDENTE'
                    ? 'amber'
                    : 'red';
                const nContracts = contracts.filter((c) => norm(c.clientName) === norm(client.name)).length;
                const nProposals = pedidos.filter(
                  (p) => p.clienteId === client.id || norm(p.clienteNome) === norm(client.name)
                ).length;
                const nOS = ordensServico.filter((o) => o.clienteId === client.id).length;
                return (
                  <DataListRow
                    key={client.id}
                    onClick={() => openClientDossie(client)}
                    leading={<ClientLogo src={client.logoPath ? clientLogoUrls[client.logoPath] : undefined} name={nomeFantasiaCliente(client.name)} />}
                    title={<span className="uppercase">{nomeFantasiaCliente(client.name)}</span>}
                    meta={
                      <>
                        {nomeFantasiaCliente(client.name) !== razaoSocialCliente(client.name) && <span className="text-fg-muted truncate">{razaoSocialCliente(client.name)}</span>}
                        <RowMeta label="CNPJ" value={<span className="font-data-mono">{client.cnpj}</span>} />
                        <RowMeta label="Código" value={<span className="font-data-mono">{client.code}</span>} />
                        <RowMeta label="Segmento" value={client.segment} />
                      </>
                    }
                    center={
                      <div className="flex items-center gap-4 md:gap-3 text-center">
                        <div>
                          <p className="font-data-mono text-fg font-bold text-sm">{nContracts}</p>
                          <p className="text-[10px] text-fg-muted uppercase tracking-wider">Contratos</p>
                        </div>
                        <div>
                          <p className="font-data-mono text-fg font-bold text-sm">{nProposals}</p>
                          <p className="text-[10px] text-fg-muted uppercase tracking-wider">Propostas</p>
                        </div>
                        <div>
                          <p className="font-data-mono text-fg font-bold text-sm">{nOS}</p>
                          <p className="text-[10px] text-fg-muted uppercase tracking-wider">OS</p>
                        </div>
                      </div>
                    }
                    right={
                      <>
                        <Badge color={statusColor}>{client.contractStatus}</Badge>
                        <div className="flex items-center gap-1">
                          <RowAction
                            icon="edit"
                            label="Editar dados do cliente"
                            onClick={() => startEditClient(client)}
                          />
                          <RowAction
                            icon="visibility"
                            label="Ver ficha completa do cliente"
                            onClick={() => openClientDossie(client)}
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
              <p className="text-xs text-fg-secondary px-1 pt-1">
                Mostrando {filteredClients.length} de {clients.length} clientes cadastrados
              </p>
            </div>
          )}
        </div>
      )}

      {/* Subtab Content: PEDIDOS & OS */}
      {crmSubTab === 'pedidos_os' && (
        <div className="bg-surface rounded-xl border border-border p-6 shadow-sm">
          <h3 className="text-base font-bold text-fg uppercase tracking-wide mb-4 border-b border-border pb-3">
            Ordens de Serviço Ativas &amp; Manutenções
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ordensServico
              .filter((os) => OS_STATUS_ATIVOS.includes(os.status))
              .map((os) => {
                const ui = OS_STATUS_UI[os.status];
                const clienteNome = clients.find((c) => c.id === os.clienteId)?.name || os.clienteId || '—';
                return (
                  <div key={os.id} className="border border-border rounded-lg p-4 bg-surface-2/50 flex flex-col justify-between gap-3">
                    <div className="flex justify-between items-start">
                      <div className="min-w-0">
                        <span className="font-data-mono text-xs font-bold text-danger">{os.numero || os.id}</span>
                        <h4 className="font-bold text-fg text-sm uppercase truncate">{os.titulo || 'Ordem de serviço'}</h4>
                        <p className="text-xs text-fg-secondary mt-0.5">{nomeFantasiaCliente(clienteNome)}</p>
                      </div>
                      <span className="shrink-0"><Badge color={ui.color}>{ui.label}</Badge></span>
                    </div>
                    <div className="flex justify-between items-center font-data-mono text-xs text-fg-secondary pt-3 border-t border-border">
                      <span className="uppercase">{os.tipo}</span>
                      <span>{os.dataPrevista ? `Previsto ${os.dataPrevista}` : os.dataAbertura || ''}</span>
                    </div>
                  </div>
                );
              })}
            {ordensServico.filter((os) => OS_STATUS_ATIVOS.includes(os.status)).length === 0 && (
              <p className="text-sm text-fg-muted col-span-full py-6 text-center">Nenhuma ordem de serviço ativa.</p>
            )}
          </div>
        </div>
      )}

      {/* Subtab Content: ESTOQUE */}
      {crmSubTab === 'estoque' && (
        <div className="bg-surface rounded-xl border border-border p-6 shadow-sm">
          <h3 className="text-base font-bold text-fg uppercase tracking-wide mb-4 border-b border-border pb-3">
            Estoque de Componentes &amp; Rastreabilidade Série BP
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-surface-2 text-fg-secondary font-semibold uppercase tracking-wider border-b border-border">
                  <th className="py-3 px-4">Código / Série BP</th>
                  <th className="py-3 px-4">Descrição da Peça</th>
                  <th className="py-3 px-4">Categoria</th>
                  <th className="py-3 px-4 text-center">Estoque Atual</th>
                  <th className="py-3 px-4 text-right">Preço Unitário</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border font-medium text-fg-secondary">
                {inventory.map((item) => (
                  <tr key={item.id} className="hover:bg-surface-2/80">
                    <td className="py-3 px-4 font-data-mono font-bold text-danger">
                      {item.code} <br />
                      <span className="text-[10px] text-fg-muted font-normal">{item.serialBP}</span>
                    </td>
                    <td className="py-3 px-4 font-bold text-fg uppercase">{item.name}</td>
                    <td className="py-3 px-4 text-fg-secondary">{item.category}</td>
                    <td className="py-3 px-4 text-center font-data-mono font-bold">
                      <span className={item.quantity <= item.minQuantity ? 'text-danger' : 'text-emerald-700'}>
                        {item.quantity} un
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-data-mono text-fg">R$ {item.unitPrice.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Subtab Content: SERVIÇOS (catálogo real) */}
      {crmSubTab === 'servicos' && (
        <div className="bg-surface rounded-xl border border-border p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4 border-b border-border pb-3">
            <h3 className="text-base font-bold text-fg uppercase tracking-wide">
              Catálogo de Serviços Especializados SDAI
            </h3>
            <button
              onClick={() => onNavigateToTab?.('servicos')}
              className="text-[11px] font-semibold text-primary hover:text-danger uppercase tracking-wider"
            >
              Gerenciar catálogo →
            </button>
          </div>

          {services.length === 0 ? (
            <div className="py-12 text-center text-fg-muted">
              <span className="material-symbols-outlined text-4xl text-fg-muted">handyman</span>
              <p className="mt-2 text-sm font-bold text-fg-secondary uppercase tracking-wider">Catálogo vazio</p>
              <p className="text-xs text-fg-muted mt-1">Cadastre serviços na aba <strong>Serviços</strong>.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {services.map((svc) => (
                <div key={svc.id} className="border border-border rounded-lg p-5 bg-surface-2/50 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-data-mono text-[10px] font-bold text-danger">{svc.code}</span>
                      <Badge color={svc.active ? 'emerald' : 'slate'}>{svc.active ? 'ATIVO' : 'INATIVO'}</Badge>
                    </div>
                    <h4 className="font-bold uppercase text-fg text-sm mt-1.5">{svc.title}</h4>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-fg-secondary">
                      <RowMeta label="Categoria" value={svc.category} />
                      <RowMeta label="Norma" value={<span className="font-data-mono">{svc.nbrNormRef}</span>} />
                      <RowMeta label="Horas" value={`${svc.estimatedHours}h`} />
                    </div>
                  </div>
                  <p className="font-data-mono text-sm font-bold text-danger mt-4">
                    {maskMoney(brl(svc.standardValue))}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal Add Client — cadastro completo */}
      {showAddClientModal && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setShowAddClientModal(false)} aria-hidden="true" />
          {/* Drawer (desliza da direita) */}
          <div className="relative bg-surface-2 w-full max-w-lg h-full shadow-2xl border-l border-border flex flex-col animate-[slideIn_.25s_ease-out]">
            <style>{`@keyframes slideIn{from{transform:translateX(24px);opacity:.6}to{transform:translateX(0);opacity:1}}`}</style>
            <div className="flex items-start justify-between p-5 border-b border-border bg-surface">
              <div>
                <h3 className="text-base font-bold text-fg uppercase">
                  {editingClient ? 'Editar cliente' : 'Novo cliente'}
                </h3>
                <p className="text-[11px] text-fg-secondary mt-0.5">Vinculado a contratos, pedidos e OS.</p>
              </div>
              <button onClick={() => setShowAddClientModal(false)} className="text-fg-muted hover:text-fg-secondary font-bold text-lg leading-none">✕</button>
            </div>

            <form id="novoClienteForm" onSubmit={handleCreateClientSubmit} className="flex-1 overflow-y-auto p-4 space-y-3 text-xs font-medium">
              {/* Toggle PF / PJ */}
              <div className="flex items-center gap-1 bg-surface-3/70 p-1 rounded-lg w-full">
                {(['PJ', 'PF'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setNTipoPessoa(t)}
                    className={`flex-1 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-wide transition-colors ${
                      nTipoPessoa === t ? 'bg-surface text-primary shadow-sm' : 'text-fg-secondary hover:text-fg-secondary'
                    }`}
                  >
                    {t === 'PJ' ? 'Pessoa Jurídica' : 'Pessoa Física'}
                  </button>
                ))}
              </div>

              {/* Card: Identificação */}
              <section className="rounded-xl border border-border bg-surface p-3.5 space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-fg-secondary flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-primary">badge</span> Identificação
                </p>
                <div>
                  <label className={labelCls}>{nTipoPessoa === 'PJ' ? 'Razão Social *' : 'Nome completo *'}</label>
                  <input required type="text" value={nName} onChange={(e) => setNName(e.target.value)} className={inputCls} placeholder={nTipoPessoa === 'PJ' ? 'Ex: Londrina Norte Shopping Ltda' : 'Ex: João da Silva'} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className={labelCls}>{nTipoPessoa === 'PJ' ? 'CNPJ' : 'CPF'}</label>
                      {nTipoPessoa === 'PJ' && (
                        <button
                          type="button"
                          onClick={() => handleSearchCnpj()}
                          disabled={isSearchingCnpj || !nCNPJ.trim()}
                          className="text-[10px] font-bold text-primary hover:text-danger disabled:opacity-40 flex items-center gap-1 uppercase transition-colors"
                          title="Consultar dados na Receita Federal"
                        >
                          {isSearchingCnpj ? (
                            <>
                              <span className="material-symbols-outlined text-xs animate-spin">progress_activity</span> Buscando...
                            </>
                          ) : (
                            <>
                              <span className="material-symbols-outlined text-xs">search</span> Buscar Receita
                            </>
                          )}
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={nCNPJ}
                      onChange={(e) => {
                        const val = e.target.value;
                        setNCNPJ(val);
                        setCnpjSearchError('');
                        const digits = val.replace(/\D/g, '');
                        if (nTipoPessoa === 'PJ' && digits.length === 14 && !isSearchingCnpj) {
                          handleSearchCnpj(val);
                        }
                      }}
                      className={`${inputCls} font-data-mono`}
                      placeholder={nTipoPessoa === 'PJ' ? '00.000.000/0001-00' : '000.000.000-00'}
                    />
                    {cnpjSearchError && (
                      <p className="text-[10px] text-red-600 font-semibold mt-1 flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">error</span> {cnpjSearchError}
                      </p>
                    )}
                  </div>
                  {nTipoPessoa === 'PJ' ? (
                    <div>
                      <label className={labelCls}>Inscrição Estadual</label>
                      <input type="text" value={nIE} onChange={(e) => setNIE(e.target.value)} className={`${inputCls} font-data-mono`} placeholder="Isento / número" />
                    </div>
                  ) : (
                    <div>
                      <label className={labelCls}>Segmento</label>
                      <input type="text" value={nSegment} onChange={(e) => setNSegment(e.target.value)} className={inputCls} placeholder="Residencial, comércio..." />
                    </div>
                  )}
                </div>
                {nTipoPessoa === 'PJ' && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelCls}>Nome Fantasia</label>
                      <input type="text" value={nFantasia} onChange={(e) => setNFantasia(e.target.value)} className={inputCls} placeholder="Ex: Norte Shopping" />
                    </div>
                    <div>
                      <label className={labelCls}>Segmento</label>
                      <select value={nSegment} onChange={(e) => setNSegment(e.target.value)} className={inputCls}>
                        <option value="Shopping Center">Shopping Center</option>
                        <option value="Indústria">Indústria</option>
                        <option value="Condomínio Residencial">Condomínio Residencial</option>
                        <option value="Condomínio Comercial">Condomínio Comercial</option>
                        <option value="Logística & Galpões">Logística &amp; Galpões</option>
                        <option value="Varejo / Supermercado">Varejo / Supermercado</option>
                        <option value="Hospitalar">Hospitalar</option>
                        <option value="Educacional">Educacional</option>
                        <option value="Órgão Público">Órgão Público</option>
                      </select>
                    </div>
                  </div>
                )}
              </section>

              {/* Card: Endereço */}
              <section className="rounded-xl border border-border bg-surface p-3.5 space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-fg-secondary flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-primary">location_on</span> Endereço
                </p>
                <div>
                  <label className={labelCls}>Logradouro, nº, bairro</label>
                  <input type="text" value={nAddress} onChange={(e) => setNAddress(e.target.value)} className={inputCls} placeholder="Av. Higienópolis, 1200 — Centro" />
                </div>
                <div>
                  <label className={labelCls}>Cidade / UF</label>
                  <input type="text" value={nCity} onChange={(e) => setNCity(e.target.value)} className={inputCls} placeholder="Londrina/PR" />
                </div>
              </section>

              {/* Card: Dados comerciais */}
              <section className="rounded-xl border border-border bg-surface p-3.5 space-y-3">
                <p className="text-[11px] font-bold uppercase tracking-wider text-fg-secondary flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-primary">payments</span> Dados comerciais
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelCls}>Status cadastral</label>
                    <select value={nStatus} onChange={(e) => setNStatus(e.target.value as Client['contractStatus'])} className={inputCls}>
                      <option value="EM DIA">EM DIA</option>
                      <option value="PENDENTE">PENDENTE</option>
                      <option value="ATRASADO">ATRASADO</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Valor anual estimado (R$)</label>
                    <input type="number" min={0} step="0.01" inputMode="decimal" value={nAnnual} onChange={(e) => setNAnnual(Number(e.target.value))} className={`${inputCls} font-data-mono`} />
                  </div>
                </div>
              </section>

              {/* Card: Foto da fachada (capa padrão das propostas do cliente) */}
              <section className="rounded-xl border border-border bg-surface p-3.5 space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-fg-secondary flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-primary">storefront</span> Foto da fachada
                </p>
                <p className="text-[11px] text-fg-muted">Usada como capa padrão nas propostas e orçamentos deste cliente (dispensa subir por documento).</p>
                {nFachada ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-emerald-600 flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">check_circle</span>Foto definida</span>
                    <button type="button" onClick={handleFachadaRemove} className="text-[11px] font-bold uppercase text-fg-muted hover:text-danger">Remover</button>
                  </div>
                ) : (
                  <label className={`inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer ${fachadaBusy ? 'text-fg-muted' : 'text-primary hover:text-danger'}`}>
                    <span className="material-symbols-outlined text-[16px]">{fachadaBusy ? 'progress_activity' : 'add_a_photo'}</span>
                    {fachadaBusy ? 'Enviando…' : 'Enviar foto da fachada'}
                    <input type="file" accept="image/*" className="hidden" disabled={fachadaBusy}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFachadaUpload(f); e.target.value = ''; }} />
                  </label>
                )}
              </section>

              {/* Logo corporativa do cliente: distinta da fachada e usada no PDF técnico. */}
              <section className="rounded-xl border border-border bg-surface p-3.5 space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-fg-secondary flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-primary">branding_watermark</span> Logo do cliente
                </p>
                <p className="text-[11px] text-fg-muted">Aceita SVG ou PNG. A imagem é preservada em PNG transparente para uso seguro no PDF.</p>
                {nLogo ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-emerald-600 flex items-center gap-1"><span className="material-symbols-outlined text-[16px]">check_circle</span>Logo definida</span>
                    <button type="button" onClick={handleLogoRemove} className="text-[11px] font-bold uppercase text-fg-muted hover:text-danger">Remover</button>
                  </div>
                ) : (
                  <label className={`inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer ${logoBusy ? 'text-fg-muted' : 'text-primary hover:text-danger'}`}>
                    <span className={`material-symbols-outlined text-[16px] ${logoBusy ? 'animate-spin' : ''}`}>{logoBusy ? 'progress_activity' : 'upload_file'}</span>
                    {logoBusy ? 'Enviando…' : 'Enviar logo'}
                    <input type="file" accept="image/png,image/svg+xml" className="hidden" disabled={logoBusy}
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); e.target.value = ''; }} />
                  </label>
                )}
              </section>

              {/* Card: Contatos */}
              <section className="rounded-xl border border-border bg-surface p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-fg-secondary flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-primary">contacts</span> Contatos
                  </p>
                  <button type="button" onClick={addContactRow} className="text-[11px] font-semibold text-primary hover:text-danger flex items-center gap-1 uppercase">
                    <span className="material-symbols-outlined text-sm">add</span> Adicionar
                  </button>
                </div>
                <div className="space-y-2">
                  {nContacts.map((c, idx) => (
                    <div key={idx} className="grid grid-cols-2 gap-2 bg-surface-2 border border-border rounded-lg p-2 relative">
                      <input type="text" value={c.name} onChange={(e) => updateContact(idx, 'name', e.target.value)} className={inputCls} placeholder="Nome" />
                      <input type="text" value={c.role} onChange={(e) => updateContact(idx, 'role', e.target.value)} className={inputCls} placeholder="Cargo/Função" />
                      <input type="tel" inputMode="tel" value={c.phone} onChange={(e) => updateContact(idx, 'phone', e.target.value)} className={`${inputCls} font-data-mono`} placeholder="(43) 90000-0000" />
                      <input type="email" inputMode="email" value={c.email} onChange={(e) => updateContact(idx, 'email', e.target.value)} className={inputCls} placeholder="email@cliente.com" />
                      {nContacts.length > 1 && (
                        <button type="button" onClick={() => removeContactRow(idx)} className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-surface border border-border shadow-sm flex items-center justify-center text-fg-muted hover:text-danger" title="Remover contato">
                          <span className="material-symbols-outlined text-sm">close</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            </form>

            {/* Rodapé fixo */}
            <div className="p-4 border-t border-border bg-surface">
              <button
                type="submit"
                form="novoClienteForm"
                className="w-full bg-danger hover:bg-danger-hover text-white py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors shadow-sm"
              >
                {editingClient ? 'Salvar alterações' : `Cadastrar ${nTipoPessoa === 'PJ' ? 'empresa' : 'pessoa'}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
