'use client';

import React, { useEffect, useState } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { AuthModal } from '@/components/AuthModal';
import { PrivacyProvider } from '@/lib/privacy';
import {
  fetchInventory,
  insertInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  isSupabaseConfigured,
} from '@/lib/inventory';

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
  PedidoStatus,
  PdfPrefs
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
import { allowedTabs, isTabAllowed } from '@/lib/rbac';
import { fetchPunches, insertPunch } from '@/lib/timepunch';
import { fetchPedidos, upsertPedido, updatePedidoStatus, deletePedido } from '@/lib/pedidos';
import { fetchQuotes, insertQuote } from '@/lib/quotes';
import { fetchSuppliers, upsertSupplier, deleteSupplier } from '@/lib/suppliers';
import { fetchClients, upsertClient } from '@/lib/clients';
import { fetchTransactions, upsertTransaction, deleteTransaction } from '@/lib/transactions';
import { fetchContracts, upsertContract } from '@/lib/contracts';
import { WorkSchedule } from '@/lib/schedule';

let idSeq = 1000;
function getNextSeq() {
  return (idSeq++).toString();
}

interface CrmAppProps {
  initialRole?: UserRole;
  userName?: string;
  userEmail?: string;
  userSchedule?: WorkSchedule;
  onLogout?: () => void;
}

export function CrmApp({
  initialRole = 'ADMINISTRATIVO',
  userName = 'Operador Fireowl',
  userEmail = '',
  userSchedule,
  onLogout,
}: CrmAppProps) {
  const [currentTab, setCurrentTab] = useState<TabPath>(allowedTabs(initialRole)[0]);
  const [userRole, setUserRole] = useState<UserRole>(initialRole);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false); // menu off-canvas (mobile)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false); // mini-sidebar (desktop)

  // RBAC: se a aba atual não é permitida ao perfil, volta para a primeira permitida
  useEffect(() => {
    if (!isTabAllowed(userRole, currentTab)) {
      setCurrentTab(allowedTabs(userRole)[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userRole]);

  // System State Data
  const [clients, setClients] = useState<Client[]>(isSupabaseConfigured() ? [] : INITIAL_CLIENTS);
  const [pedidosOS, setPedidosOS] = useState<PedidoOS[]>(INITIAL_PEDIDOS_OS);
  const [pedidos, setPedidos] = useState<Pedido[]>(isSupabaseConfigured() ? [] : INITIAL_PEDIDOS);
  const [partnerBrands, setPartnerBrands] = useState<PartnerBrand[]>(INITIAL_PARTNER_BRANDS);
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile>(INITIAL_COMPANY_PROFILE);
  const [templates, setTemplates] = useState<PedidoTemplate[]>(INITIAL_TEMPLATES);
  const [contracts, setContracts] = useState<Contract[]>(isSupabaseConfigured() ? [] : INITIAL_CONTRACTS);
  const [equipmentList, setEquipmentList] = useState<ClientEquipment[]>(INITIAL_EQUIPMENT);
  const [punches, setPunches] = useState<TimePunch[]>(
    isSupabaseConfigured() ? [] : INITIAL_PUNCH_LOGS
  );
  const [technicalReport, setTechnicalReport] = useState(INITIAL_TECHNICAL_REPORT);
  const [auditSdai] = useState(INITIAL_AUDIT_SDAI);
  const [quotes, setQuotes] = useState<CustomQuote[]>(isSupabaseConfigured() ? [] : INITIAL_CUSTOM_QUOTES);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>(
    isSupabaseConfigured() ? [] : INITIAL_FINANCIAL_TRANSACTIONS
  );
  const [suppliers, setSuppliers] = useState<Supplier[]>(isSupabaseConfigured() ? [] : INITIAL_SUPPLIERS);
  const [services, setServices] = useState<ServiceCatalogItem[]>(INITIAL_SERVICES);
  // Com Supabase configurado, inicia vazio e carrega do banco (evita
  // "flash" de dados de exemplo). Sem Supabase, usa os dados locais.
  const [inventory, setInventory] = useState<InventoryItem[]>(
    isSupabaseConfigured() ? [] : INITIAL_INVENTORY
  );
  const [inventoryLoading, setInventoryLoading] = useState(isSupabaseConfigured());
  const [auditLogs, setAuditLogs] = useState(INITIAL_AUDIT_LOGS);

  // Preferências de geração de PDF (persistidas no navegador)
  const DEFAULT_PDF_PREFS: PdfPrefs = {
    configBeforeGenerate: true,
    detailedSubtotal: true,
    showLogo: true,
    showBankData: false,
  };
  const [pdfPrefs, setPdfPrefs] = useState<PdfPrefs>(DEFAULT_PDF_PREFS);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('fireowl_pdf_prefs');
      if (saved) setPdfPrefs({ ...DEFAULT_PDF_PREFS, ...JSON.parse(saved) });
    } catch {
      /* localStorage indisponível */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Carrega propostas (pedidos) e orçamentos de serviço do Supabase
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    fetchPedidos()
      .then((rows) => setPedidos(rows))
      .catch((err) => console.warn('Propostas: falha ao carregar do Supabase.', err));
    fetchQuotes()
      .then((rows) => setQuotes(rows))
      .catch((err) => console.warn('Orçamentos: falha ao carregar do Supabase.', err));
    fetchSuppliers()
      .then((rows) => setSuppliers(rows))
      .catch((err) => console.warn('Fornecedores: falha ao carregar do Supabase.', err));
    fetchClients()
      .then((rows) => setClients(rows))
      .catch((err) => console.warn('Clientes: falha ao carregar do Supabase.', err));
    fetchTransactions()
      .then((rows) => setTransactions(rows))
      .catch((err) => console.warn('Financeiro: falha ao carregar do Supabase.', err));
    fetchContracts()
      .then((rows) => setContracts(rows))
      .catch((err) => console.warn('Contratos: falha ao carregar do Supabase.', err));
  }, []);

  const handleUpdatePdfPrefs = (p: PdfPrefs) => {
    setPdfPrefs(p);
    try {
      localStorage.setItem('fireowl_pdf_prefs', JSON.stringify(p));
    } catch {
      /* ignore */
    }
  };

  // Carrega o estoque persistido no Supabase ao abrir o sistema.
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let active = true;
    setInventoryLoading(true);
    fetchInventory()
      .then((items) => {
        if (active) setInventory(items);
      })
      .catch((err) => {
        console.warn('Estoque: falha ao carregar do Supabase, usando dados locais.', err);
        if (active) setInventory(INITIAL_INVENTORY);
      })
      .finally(() => {
        if (active) setInventoryLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Handlers
  const upsertPedidoLocal = (saved: Pedido) => {
    setPedidos((prev) => {
      const idx = prev.findIndex((p) => p.id === saved.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = saved;
        return copy;
      }
      return [saved, ...prev];
    });
  };

  const handleSavePedido = async (savedPedido: Pedido) => {
    if (isSupabaseConfigured()) {
      try {
        const persisted = await upsertPedido(savedPedido);
        upsertPedidoLocal(persisted);
        logAction('Proposta Comercial', 'Pedidos CRM', `Salvo pedido ${persisted.numeroPedido} (${persisted.status}) - R$ ${persisted.proposal.valorTotal}`);
        return;
      } catch (err) {
        console.error('Falha ao salvar proposta no Supabase:', err);
        alert('Não foi possível salvar a proposta no banco. Salva apenas nesta sessão.');
      }
    }
    upsertPedidoLocal(savedPedido);
    logAction('Proposta Comercial', 'Pedidos CRM', `Salvo pedido ${savedPedido.numeroPedido} (${savedPedido.status}) - R$ ${savedPedido.proposal.valorTotal}`);
  };

  const handleUpdatePedidoStatus = async (pedidoId: string, newStatus: PedidoStatus) => {
    const ped = pedidos.find((p) => p.id === pedidoId);
    setPedidos((prev) =>
      prev.map((p) => (p.id === pedidoId ? { ...p, status: newStatus, updatedAt: new Date().toLocaleDateString('pt-BR') } : p))
    );
    if (isSupabaseConfigured()) {
      try {
        await updatePedidoStatus(pedidoId, newStatus);
      } catch (err) {
        console.error('Falha ao atualizar status da proposta:', err);
      }
    }
    logAction('Transição de Status', 'Pedidos CRM', `Pedido ${ped?.numeroPedido || pedidoId} alterado para ${newStatus}`);
  };

  const handleDeletePedido = async (pedidoId: string) => {
    const ped = pedidos.find((p) => p.id === pedidoId);
    setPedidos((prev) => prev.filter((p) => p.id !== pedidoId));
    if (isSupabaseConfigured()) {
      try {
        await deletePedido(pedidoId);
      } catch (err) {
        console.error('Falha ao excluir proposta:', err);
        alert('Não foi possível excluir a proposta no banco.');
      }
    }
    logAction('Exclusão de Proposta', 'Pedidos CRM', `Removida proposta ${ped?.numeroPedido || pedidoId}`);
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
  const handleAddClient = async (newClient: Client) => {
    setClients((prev) => [newClient, ...prev]);
    logAction('Cadastro de Cliente', 'Clientes', `Novo cliente cadastrado: ${newClient.name}`);
    if (isSupabaseConfigured()) {
      try {
        const saved = await upsertClient(newClient);
        setClients((prev) => prev.map((x) => (x.id === saved.id ? saved : x)));
      } catch (err) {
        console.error('Falha ao salvar cliente no Supabase:', err);
        alert('Não foi possível salvar o cliente no banco. Salvo apenas nesta sessão.');
      }
    }
  };

  const handleAddOS = (newOS: PedidoOS) => {
    setPedidosOS([newOS, ...pedidosOS]);
    logAction('Abertura de Pedido / OS', 'Pedidos', `Aberto pedido ${newOS.id} para ${newOS.clientName}`);
  };

  const handleAddContract = async (newContract: Contract) => {
    setContracts((prev) => [newContract, ...prev]);
    logAction('Novo Contrato', 'Contratos', `Cadastrado contrato ${newContract.id} - ${newContract.clientName}`);
    if (isSupabaseConfigured()) {
      try {
        const saved = await upsertContract(newContract);
        setContracts((prev) => prev.map((x) => (x.id === saved.id ? saved : x)));
      } catch (err) {
        console.error('Falha ao salvar contrato no Supabase:', err);
        alert('Não foi possível salvar o contrato no banco. Salvo apenas nesta sessão.');
      }
    }
  };

  const handleAddTransaction = async (newTx: FinancialTransaction) => {
    setTransactions((prev) => [newTx, ...prev]);
    logAction(`Lançamento de ${newTx.type}`, 'Finanças', `Lançado ${newTx.id} - ${newTx.clientOrVendor} (R$ ${newTx.amount})`);
    if (isSupabaseConfigured()) {
      try {
        const saved = await upsertTransaction(newTx);
        setTransactions((prev) => prev.map((t) => (t.id === saved.id ? saved : t)));
      } catch (err) {
        console.error('Falha ao salvar lançamento no Supabase:', err);
        alert('Não foi possível salvar o lançamento no banco. Salvo apenas nesta sessão.');
      }
    }
  };

  const handleUpdateTransaction = async (tx: FinancialTransaction) => {
    setTransactions((prev) => prev.map((t) => (t.id === tx.id ? tx : t)));
    logAction(`Edição de ${tx.type}`, 'Finanças', `Atualizado ${tx.id} - ${tx.clientOrVendor} (R$ ${tx.amount})`);
    if (isSupabaseConfigured()) {
      try {
        await upsertTransaction(tx);
      } catch (err) {
        console.error('Falha ao atualizar lançamento no Supabase:', err);
      }
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    const tx = transactions.find((t) => t.id === id);
    setTransactions((prev) => prev.filter((t) => t.id !== id));
    logAction(`Exclusão de ${tx?.type || 'Lançamento'}`, 'Finanças', `Removido ${tx?.id || id}`);
    if (isSupabaseConfigured()) {
      try {
        await deleteTransaction(id);
      } catch (err) {
        console.error('Falha ao excluir lançamento no Supabase:', err);
      }
    }
  };

  const handleAddSupplier = async (newSupplier: Supplier) => {
    setSuppliers((prev) => [newSupplier, ...prev]);
    logAction('Homologação de Fornecedor', 'Fornecedores', `Homologado ${newSupplier.name}`);
    if (isSupabaseConfigured()) {
      try {
        const saved = await upsertSupplier(newSupplier);
        setSuppliers((prev) => prev.map((x) => (x.id === saved.id ? saved : x)));
      } catch (err) {
        console.error('Falha ao salvar fornecedor no Supabase:', err);
      }
    }
  };

  const handleUpdateSupplier = async (s: Supplier) => {
    setSuppliers((prev) => prev.map((x) => (x.id === s.id ? s : x)));
    logAction('Atualização de Fornecedor', 'Fornecedores', `Atualizado ${s.name}`);
    if (isSupabaseConfigured()) {
      try {
        await upsertSupplier(s);
      } catch (err) {
        console.error('Falha ao atualizar fornecedor no Supabase:', err);
      }
    }
  };

  const handleDeleteSupplier = async (id: string) => {
    const s = suppliers.find((x) => x.id === id);
    setSuppliers((prev) => prev.filter((x) => x.id !== id));
    logAction('Exclusão de Fornecedor', 'Fornecedores', `Removido ${s?.name || id}`);
    if (isSupabaseConfigured()) {
      try {
        await deleteSupplier(id);
      } catch (err) {
        console.error('Falha ao excluir fornecedor no Supabase:', err);
      }
    }
  };

  const handleAddInventoryItem = async (newItem: InventoryItem) => {
    if (!isSupabaseConfigured()) {
      setInventory((prev) => [newItem, ...prev]);
      logAction('Entrada no Almoxarifado', 'Estoque', `Cadastrado item ${newItem.code} - ${newItem.name}`);
      return;
    }
    try {
      const saved = await insertInventoryItem(newItem);
      setInventory((prev) => [saved, ...prev]);
      logAction('Entrada no Almoxarifado', 'Estoque', `Cadastrado item ${saved.code} - ${saved.name}`);
    } catch (err) {
      console.error('Falha ao salvar o item no Supabase:', err);
      setInventory((prev) => [newItem, ...prev]);
      logAction(
        'Entrada no Almoxarifado (local)',
        'Estoque',
        `Item ${newItem.code} - ${newItem.name} adicionado apenas localmente (não persistido)`
      );
      alert(
        'Não foi possível salvar no banco de dados (Supabase).\n\n' +
          'O item foi adicionado apenas nesta sessão. Verifique se a tabela ' +
          '"inventory_items" foi criada no Supabase (script lib/db/migrations/0002_inventory_items.sql).'
      );
    }
  };

  const handleUpdateInventoryItem = async (item: InventoryItem) => {
    if (!isSupabaseConfigured()) {
      setInventory((prev) => prev.map((i) => (i.id === item.id ? item : i)));
      logAction('Atualização de Item', 'Estoque', `Item ${item.code} - ${item.name} atualizado`);
      return;
    }
    try {
      const saved = await updateInventoryItem(item);
      setInventory((prev) => prev.map((i) => (i.id === saved.id ? saved : i)));
      logAction('Atualização de Item', 'Estoque', `Item ${saved.code} - ${saved.name} atualizado`);
    } catch (err) {
      console.error('Falha ao atualizar o item no Supabase:', err);
      setInventory((prev) => prev.map((i) => (i.id === item.id ? item : i)));
      alert('Não foi possível atualizar o item no banco de dados (Supabase). A alteração vale só nesta sessão.');
    }
  };

  const handleDeleteInventoryItem = async (id: string) => {
    const target = inventory.find((i) => i.id === id);
    if (!isSupabaseConfigured()) {
      setInventory((prev) => prev.filter((i) => i.id !== id));
      logAction('Exclusão de Item', 'Estoque', `Item ${target?.code || id} removido`);
      return;
    }
    try {
      await deleteInventoryItem(id);
      setInventory((prev) => prev.filter((i) => i.id !== id));
      logAction('Exclusão de Item', 'Estoque', `Item ${target?.code || id} removido`);
    } catch (err) {
      console.error('Falha ao excluir o item no Supabase:', err);
      alert('Não foi possível excluir o item no banco de dados (Supabase). Tente novamente.');
    }
  };

  // Ponto no Supabase (tabela enxuta, sem foto). Sem Supabase, cai no
  // localStorage como reserva.
  const PUNCHES_KEY = 'fireowl_punches';

  useEffect(() => {
    if (isSupabaseConfigured()) {
      fetchPunches()
        .then((rows) => setPunches(rows))
        .catch((err) => console.warn('Ponto: falha ao carregar do Supabase.', err));
      return;
    }
    try {
      const saved = localStorage.getItem(PUNCHES_KEY);
      if (saved) setPunches(JSON.parse(saved));
    } catch {
      /* localStorage indisponível */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddPunch = async (newPunch: TimePunch) => {
    if (isSupabaseConfigured()) {
      try {
        const saved = await insertPunch(newPunch);
        setPunches((prev) => [saved, ...prev]);
        logAction('Batida de Ponto', 'Ponto Eletrônico', `Ponto registrado por ${saved.employeeName} (${saved.type})`);
        return;
      } catch (err) {
        console.error('Falha ao registrar ponto no Supabase:', err);
        // segue para o fallback local
      }
    }
    setPunches((prev) => {
      const next = [newPunch, ...prev].slice(0, 300);
      try {
        localStorage.setItem(PUNCHES_KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
    logAction('Batida de Ponto', 'Ponto Eletrônico', `Ponto registrado por ${newPunch.employeeName} (${newPunch.type})`);
  };

  // Recarrega as batidas do banco (usado após materializar um ajuste aprovado).
  const reloadPunches = async () => {
    if (!isSupabaseConfigured()) return;
    try {
      const rows = await fetchPunches();
      setPunches(rows);
    } catch (err) {
      console.warn('Ponto: falha ao recarregar do Supabase.', err);
    }
  };

  const handleAddQuote = async (newQuote: CustomQuote) => {
    if (isSupabaseConfigured()) {
      try {
        const saved = await insertQuote(newQuote);
        setQuotes((prev) => [saved, ...prev]);
        logAction('Elaboração de Orçamento', 'Serviços', `Orçamento ${saved.id} criado para ${saved.clientName}`);
        return;
      } catch (err) {
        console.error('Falha ao salvar orçamento no Supabase:', err);
        alert('Não foi possível salvar o orçamento no banco. Salvo apenas nesta sessão.');
      }
    }
    setQuotes((prev) => [newQuote, ...prev]);
    logAction('Elaboração de Orçamento', 'Serviços', `Orçamento ${newQuote.id} criado para ${newQuote.clientName}`);
  };

  const handleUpdateService = (svc: ServiceCatalogItem) => {
    setServices((prev) => prev.map((s) => (s.id === svc.id ? svc : s)));
    logAction('Atualização de Serviço', 'Serviços', `Serviço ${svc.code} - ${svc.title} atualizado`);
  };

  const handleDeleteService = (id: string) => {
    const svc = services.find((s) => s.id === id);
    setServices((prev) => prev.filter((s) => s.id !== id));
    logAction('Exclusão de Serviço', 'Serviços', `Serviço ${svc?.code || id} removido do catálogo`);
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

  // Papel REAL (autenticado). Só o admin pode simular outros perfis na UI,
  // e mesmo simulando continua sendo admin de verdade (não trava).
  const canSwitchRole = initialRole === 'ADMINISTRATIVO';

  return (
    <PrivacyProvider>
    <div className="min-h-screen bg-slate-50 font-body-md text-[#131c28]">
      {/* Sidebar Navigation (off-canvas no mobile, fixa no desktop) */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        userRole={userRole}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
        onLogout={onLogout}
        canSwitchRole={canSwitchRole}
        mobileOpen={sidebarOpen}
        onCloseMobile={() => setSidebarOpen(false)}
        collapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((v) => !v)}
        onExpand={() => setIsSidebarCollapsed(false)}
      />

      {/* Main Content Workspace — deslocado pela sidebar apenas no desktop */}
      <div className={`transition-[padding] duration-300 ease-out ${isSidebarCollapsed ? 'lg:pl-20' : 'lg:pl-64'}`}>
        {/* Fixed Header */}
        <Header
          userRole={userRole}
          onOpenAuthModal={() => setIsAuthModalOpen(true)}
          onOpenMenu={() => setSidebarOpen(true)}
          canSwitchRole={canSwitchRole}
          sidebarCollapsed={isSidebarCollapsed}
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
              pedidos={pedidos}
              clients={clients}
              inventory={inventory}
              partnerBrands={partnerBrands}
              templates={templates}
              companyProfile={companyProfile}
              onAddOS={handleAddOS}
              onSavePedido={handleSavePedido}
              onUpdatePedidoStatus={handleUpdatePedidoStatus}
              onDeletePedido={handleDeletePedido}
              onGenerateOSFromPedido={handleGenerateOSFromPedido}
              onSelectClientForReport={handleSelectClientForReport}
              pdfPrefs={pdfPrefs}
              userRole={userRole}
              currentUserName={userName}
            />
          )}

          {currentTab === 'contratos' && (
            <ContratosView contracts={contracts} clients={clients} onAddContract={handleAddContract} />
          )}

          {currentTab === 'receitas' && (
            <ReceitasView
              transactions={transactions}
              clients={clients}
              contracts={contracts}
              onAddTransaction={handleAddTransaction}
              onUpdateTransaction={handleUpdateTransaction}
              onDeleteTransaction={handleDeleteTransaction}
            />
          )}

          {currentTab === 'despesas' && (
            <DespesasView
              transactions={transactions}
              suppliers={suppliers}
              onAddTransaction={handleAddTransaction}
              onUpdateTransaction={handleUpdateTransaction}
              onDeleteTransaction={handleDeleteTransaction}
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
              pedidos={pedidos}
              contracts={contracts}
              transactions={transactions}
              inventory={inventory}
              onAddClient={handleAddClient}
              onAddOS={handleAddOS}
              onSelectClientForReport={handleSelectClientForReport}
              onNavigateToTab={setCurrentTab}
            />
          )}

          {currentTab === 'fornecedores' && (
            <FornecedoresView
              suppliers={suppliers}
              onAddSupplier={handleAddSupplier}
              onUpdateSupplier={handleUpdateSupplier}
              onDeleteSupplier={handleDeleteSupplier}
            />
          )}

          {currentTab === 'estoque' && (
            <EstoqueView
              inventory={inventory}
              suppliers={suppliers}
              onAddInventoryItem={handleAddInventoryItem}
              onUpdateInventoryItem={handleUpdateInventoryItem}
              onDeleteInventoryItem={handleDeleteInventoryItem}
              loading={inventoryLoading}
            />
          )}

          {currentTab === 'servicos' && (
            <ServicosView
              services={services}
              clients={clients}
              quotes={quotes}
              onAddQuote={handleAddQuote}
              onUpdateService={handleUpdateService}
              onDeleteService={handleDeleteService}
              onSelectClientForReport={handleSelectClientForReport}
            />
          )}

          {currentTab === 'ponto' && (
            <PontoView
              punches={punches}
              onAddPunch={handleAddPunch}
              onReloadPunches={reloadPunches}
              currentUser={userName}
              userRole={userRole}
              schedule={userSchedule}
            />
          )}

          {currentTab === 'conta' && (
            <ContaView
              logs={auditLogs}
              userRole={userRole}
              onSelectRole={setUserRole}
              companyProfile={companyProfile}
              onUpdateCompanyProfile={handleUpdateCompanyProfile}
              partnerBrands={partnerBrands}
              onAddPartnerBrand={handleAddPartnerBrand}
              onDeletePartnerBrand={handleDeletePartnerBrand}
              pdfPrefs={pdfPrefs}
              onUpdatePdfPrefs={handleUpdatePdfPrefs}
              canSwitchRole={canSwitchRole}
              currentEmail={userEmail}
            />
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
    </PrivacyProvider>
  );
}
