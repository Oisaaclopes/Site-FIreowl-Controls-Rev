'use client';

import React, { useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { AuthModal } from '@/components/AuthModal';

import {
  TabPath,
  UserRole,
  Client,
  PedidoOS,
  Contract,
  ClientEquipment,
  TimePunch,
  CustomQuote,
  FinancialTransaction,
  Supplier,
  ServiceCatalogItem,
  InventoryItem,
  Pedido,
  PartnerBrand,
  CompanyProfile,
  PedidoTemplate,
  PedidoStatus
} from '@/lib/types';

import {
  INITIAL_CLIENTS,
  INITIAL_PEDIDOS_OS,
  INITIAL_CONTRACTS,
  INITIAL_EQUIPMENT,
  INITIAL_PUNCH_LOGS,
  INITIAL_TECHNICAL_REPORT,
  INITIAL_AUDIT_SDAI,
  INITIAL_CUSTOM_QUOTES,
  INITIAL_FINANCIAL_TRANSACTIONS,
  INITIAL_INVENTORY,
  INITIAL_AUDIT_LOGS,
  INITIAL_SUPPLIERS,
  INITIAL_SERVICES,
  INITIAL_PEDIDOS,
  INITIAL_PARTNER_BRANDS,
  INITIAL_COMPANY_PROFILE,
  INITIAL_TEMPLATES,
} from '@/lib/mockData';

import { DashboardView } from '@/components/views/DashboardView';
import { PedidosView } from '@/components/views/PedidosView';
import { ContratosView } from '@/components/views/ContratosView';
import { ReceitasView } from '@/components/views/ReceitasView';
import { DespesasView } from '@/components/views/DespesasView';
import { FinancasView } from '@/components/views/FinancasView';
import { AgendaView } from '@/components/views/AgendaView';
import { CrmView } from '@/components/views/CrmView';
import { FornecedoresView } from '@/components/views/FornecedoresView';
import { EstoqueView } from '@/components/views/EstoqueView';
import { ServicosView } from '@/components/views/ServicosView';
import { PontoView } from '@/components/views/PontoView';
import { ContaView } from '@/components/views/ContaView';

let idSeq = 1000;
function getNextSeq() {
  return (idSeq++).toString();
}

interface CrmAppProps {
  initialRole?: UserRole;
  onLogout?: () => void;
}

export function CrmApp({ initialRole = 'ADMINISTRATIVO', onLogout }: CrmAppProps) {
  const [currentTab, setCurrentTab] = useState<TabPath>('painel');
  const [userRole, setUserRole] = useState<UserRole>(initialRole);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // System State Data
  const [clients, setClients] = useState<Client[]>(INITIAL_CLIENTS);
  const [pedidosOS, setPedidosOS] = useState<PedidoOS[]>(INITIAL_PEDIDOS_OS);
  const [pedidos, setPedidos] = useState<Pedido[]>(INITIAL_PEDIDOS);
  const [partnerBrands, setPartnerBrands] = useState<PartnerBrand[]>(INITIAL_PARTNER_BRANDS);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile>(INITIAL_COMPANY_PROFILE);
  const [templates, setTemplates] = useState<PedidoTemplate[]>(INITIAL_TEMPLATES);
  const [contracts, setContracts] = useState<Contract[]>(INITIAL_CONTRACTS);
  const [equipmentList, setEquipmentList] = useState<ClientEquipment[]>(INITIAL_EQUIPMENT);
  const [punches, setPunches] = useState<TimePunch[]>(INITIAL_PUNCH_LOGS);
  const [technicalReport, setTechnicalReport] = useState(INITIAL_TECHNICAL_REPORT);
  const [auditSdai] = useState(INITIAL_AUDIT_SDAI);
  const [quotes, setQuotes] = useState<CustomQuote[]>(INITIAL_CUSTOM_QUOTES);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>(INITIAL_FINANCIAL_TRANSACTIONS);
  const [suppliers, setSuppliers] = useState<Supplier[]>(INITIAL_SUPPLIERS);
  const [services] = useState<ServiceCatalogItem[]>(INITIAL_SERVICES);
  const [inventory, setInventory] = useState<InventoryItem[]>(INITIAL_INVENTORY);
  const [auditLogs, setAuditLogs] = useState(INITIAL_AUDIT_LOGS);

  // Handlers
  const handleSavePedido = (savedPedido: Pedido) => {
    setPedidos((prev) => {
      const idx = prev.findIndex((p) => p.id === savedPedido.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = savedPedido;
        return copy;
      }
      return [savedPedido, ...prev];
    });
    logAction('Proposta Comercial', 'Pedidos CRM', `Salvo pedido ${savedPedido.numeroPedido} (${savedPedido.status}) - R$ ${savedPedido.proposal.valorTotal}`);
  };

  const handleUpdatePedidoStatus = (pedidoId: string, newStatus: PedidoStatus) => {
    setPedidos((prev) =>
      prev.map((p) => (p.id === pedidoId ? { ...p, status: newStatus, updatedAt: new Date().toLocaleDateString('pt-BR') } : p))
    );
    const ped = pedidos.find((p) => p.id === pedidoId);
    logAction('Transição de Status', 'Pedidos CRM', `Pedido ${ped?.numeroPedido || pedidoId} alterado para ${newStatus}`);
  };

  const handleGenerateOSFromPedido = (pedido: Pedido) => {
    const seq = getNextSeq();
    const newOS: PedidoOS = {
      id: `OS-2026-${seq}`,
      pedidoId: pedido.numeroPedido,
      clientId: pedido.clienteId,
      clientName: pedido.clienteNome,
      title: pedido.referencia || 'Execução do Projeto e Proposta Aceita',
      type: 'Preventiva SDAI',
      technicianName: pedido.responsavelComercialNome || 'Eng. Ricardo M.',
      scheduledDate: `${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).toUpperCase()} | 08:30`,
      status: 'EM ANDAMENTO',
      priority: 'ALTA',
      value: pedido.proposal.valorTotal || 0,
    };
    handleAddOS(newOS);
    alert(`Ordem de Serviço (${newOS.id}) gerada com sucesso a partir da Proposta ${pedido.numeroPedido}!`);
    setCurrentTab('pedidos');
  };

  const handleUpdateCompanyProfile = (cp: CompanyProfile) => {
    setCompanyProfile(cp);
    logAction('Atualização Cadastral', 'Conta', `Dados da empresa atualizados: ${cp.razaoSocial}`);
  };

  const handleAddPartnerBrand = (brand: PartnerBrand) => {
    setPartnerBrands((prev) => [...prev, brand]);
    logAction('Cadastro de Marca', 'Conta', `Marca parceira homologada: ${brand.name}`);
  };

  const handleDeletePartnerBrand = (id: string) => {
    setPartnerBrands((prev) => prev.filter((b) => b.id !== id));
    logAction('Exclusão de Marca', 'Conta', `Marca parceira removida do catálogo.`);
  };

  // Handlers
  const handleAddClient = (newClient: Client) => {
    setClients([newClient, ...clients]);
    logAction('Cadastro de Cliente', 'Clientes', `Novo cliente cadastrado: ${newClient.name}`);
  };

  const handleAddOS = (newOS: PedidoOS) => {
    setPedidosOS([newOS, ...pedidosOS]);
    logAction('Abertura de Pedido / OS', 'Pedidos', `Aberto pedido ${newOS.id} para ${newOS.clientName}`);
  };

  const handleAddContract = (newContract: Contract) => {
    setContracts([newContract, ...contracts]);
    logAction('Novo Contrato', 'Contratos', `Cadastrado contrato ${newContract.id} - ${newContract.clientName}`);
  };

  const handleAddTransaction = (newTx: FinancialTransaction) => {
    setTransactions([newTx, ...transactions]);
    logAction(`Lançamento de ${newTx.type}`, 'Finanças', `Lançado ${newTx.id} - ${newTx.clientOrVendor} (R$ ${newTx.amount})`);
  };

  const handleAddSupplier = (newSupplier: Supplier) => {
    setSuppliers([newSupplier, ...suppliers]);
    logAction('Homologação de Fornecedor', 'Fornecedores', `Homologado ${newSupplier.name}`);
  };

  const handleAddInventoryItem = (newItem: InventoryItem) => {
    setInventory([newItem, ...inventory]);
    logAction('Entrada no Almoxarifado', 'Estoque', `Cadastrado item ${newItem.code} - ${newItem.name}`);
  };

  const handleAddPunch = (newPunch: TimePunch) => {
    setPunches([newPunch, ...punches]);
    logAction('Batida de Ponto', 'Ponto Eletrônico', `Ponto registrado por ${newPunch.employeeName} (${newPunch.type})`);
  };

  const handleAddQuote = (newQuote: CustomQuote) => {
    setQuotes([newQuote, ...quotes]);
    logAction('Elaboração de Orçamento', 'Serviços', `Orçamento ${newQuote.id} criado para ${newQuote.clientName}`);
  };

  const handleSelectClientForReport = (clientName: string) => {
    setTechnicalReport((prev) => ({
      ...prev,
      clientName,
      status: 'EM PROGRESSO',
      updatedAt: new Date().toLocaleTimeString('pt-BR', { hour12: false }),
    }));
    setCurrentTab('servicos');
  };

  const handleNewOSQuick = () => {
    const seq = getNextSeq();
    const quickOS: PedidoOS = {
      id: `OS-2024-${seq}`,
      pedidoId: `PED-QUICK-${seq}`,
      clientId: 'c4',
      clientName: 'Catuaí Shopping Londrina',
      title: 'Atendimento Emergencial Solicitado no Painel',
      type: 'Corretiva Urgente',
      technicianName: 'Eng. Ricardo M.',
      scheduledDate: '24 MAI 2024 | AGORA',
      status: 'EM ANDAMENTO',
      priority: 'CRITICA',
      value: 1850,
    };
    handleAddOS(quickOS);
    alert(`Nova Ordem de Serviço emergencial (${quickOS.id}) criada com sucesso!`);
    setCurrentTab('pedidos');
  };

  const logAction = (action: string, module: string, details: string) => {
    const nowStr = new Date().toLocaleTimeString('pt-BR', { hour12: false });
    const newLog = {
      id: `log_${Date.now()}`,
      timestamp: `24 MAI 2024 | ${nowStr}`,
      user: `Admin Fireowl (${userRole})`,
      action,
      module,
      details,
      ip: '189.34.120.4',
    };
    setAuditLogs((prev) => [newLog, ...prev]);
  };

  return (
    <div className="min-h-screen bg-[#F4F5F7] font-body-md text-[#131c28]">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        userRole={userRole}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onLogout={onLogout}
      />

      {/* Main Content Workspace Offset by Sidebar 256px */}
      <div className="pl-64">
        {/* Fixed Header */}
        <Header
          userRole={userRole}
          onOpenAuthModal={() => setIsAuthModalOpen(true)}
          onNewOSClick={handleNewOSQuick}
        />

        {/* View Switcher */}
        <main className="pt-16 min-h-[calc(100vh-64px)]">
          {currentTab === 'painel' && (
            <DashboardView
              transactions={transactions}
              pedidosOS={pedidosOS}
              onNewOSClick={handleNewOSQuick}
              onNavigateToTab={setCurrentTab}
            />
          )}

          {currentTab === 'pedidos' && (
            <PedidosView
              pedidosOS={pedidosOS}
              clients={clients}
              onAddOS={handleAddOS}
              onSelectClientForReport={handleSelectClientForReport}
            />
          )}

          {currentTab === 'contratos' && (
            <ContratosView contracts={contracts} onAddContract={handleAddContract} />
          )}

          {currentTab === 'receitas' && (
            <ReceitasView
              transactions={transactions}
              clients={clients}
              onAddTransaction={handleAddTransaction}
            />
          )}

          {currentTab === 'despesas' && (
            <DespesasView
              transactions={transactions}
              suppliers={suppliers}
              onAddTransaction={handleAddTransaction}
            />
          )}

          {currentTab === 'financas' && (
            <FinancasView
              transactions={transactions}
              onAddTransaction={handleAddTransaction}
            />
          )}

          {currentTab === 'agenda' && <AgendaView pedidosOS={pedidosOS} />}

          {currentTab === 'clientes' && (
            <CrmView
              clients={clients}
              pedidosOS={pedidosOS}
              inventory={inventory}
              onAddClient={handleAddClient}
              onAddOS={handleAddOS}
              onSelectClientForReport={handleSelectClientForReport}
            />
          )}

          {currentTab === 'fornecedores' && (
            <FornecedoresView suppliers={suppliers} onAddSupplier={handleAddSupplier} />
          )}

          {currentTab === 'estoque' && (
            <EstoqueView inventory={inventory} onAddInventoryItem={handleAddInventoryItem} />
          )}

          {currentTab === 'servicos' && (
            <ServicosView
              services={services}
              clients={clients}
              quotes={quotes}
              onAddQuote={handleAddQuote}
              onSelectClientForReport={handleSelectClientForReport}
            />
          )}

          {currentTab === 'ponto' && <PontoView punches={punches} onAddPunch={handleAddPunch} />}

          {currentTab === 'conta' && (
            <ContaView logs={auditLogs} userRole={userRole} onSelectRole={setUserRole} />
          )}
        </main>
      </div>

      {/* Auth & Operator Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        currentRole={userRole}
        onSelectRole={setUserRole}
      />
    </div>
  );
}
