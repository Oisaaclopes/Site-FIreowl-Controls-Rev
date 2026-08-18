'use client';

import React, { useState } from 'react';
import {
  Pedido,
  Client,
  InventoryItem,
  PartnerBrand,
  PedidoTemplate,
  PedidoEquipmentItem,
  PedidoBrand,
  PedidoStatus,
} from '@/lib/types';
import {
  X,
  Plus,
  Trash2,
  FileText,
  Eye,
  Save,
  CheckCircle,
  Copy,
  Building2,
  Layers,
  Wrench,
  ShieldCheck,
  DollarSign,
  Calendar,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  GripVertical,
} from 'lucide-react';

interface CommercialProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (pedido: Pedido) => void;
  initialPedido?: Pedido | null;
  clients: Client[];
  inventory: InventoryItem[];
  partnerBrands: PartnerBrand[];
  templates: PedidoTemplate[];
  onSaveTemplate?: (template: PedidoTemplate) => void;
  onPreviewPDF: (pedido: Pedido) => void;
}

export const CommercialProposalModal: React.FC<CommercialProposalModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialPedido,
  clients,
  inventory,
  partnerBrands,
  templates,
  onSaveTemplate,
  onPreviewPDF,
}) => {
  if (!isOpen) return null;

  // Tabs state: 'dados' | 'escopo_equip' | 'marcas_resp' | 'comercial' | 'modelos'
  const [activeTab, setActiveTab] = useState<'dados' | 'escopo_equip' | 'marcas_resp' | 'comercial' | 'modelos'>('dados');

  // Form Fields State
  const [numeroPedido, setNumeroPedido] = useState<string>(
    initialPedido?.numeroPedido || `PED-2026-${Math.floor(100 + Math.random() * 900)}`
  );
  const [referencia, setReferencia] = useState<string>(initialPedido?.referencia || 'Manutenção Preventiva SDAI');
  const [clienteId, setClienteId] = useState<string>(
    initialPedido?.clienteId || clients[0]?.id || ''
  );
  const [fornecedor, setFornecedor] = useState<string>(
    initialPedido?.fornecedor || 'Fireowl Controls Ltda.'
  );
  const [dataEmissao, setDataEmissao] = useState<string>(
    initialPedido?.dataEmissao || new Date().toISOString().split('T')[0]
  );
  const [responsavelNome, setResponsavelNome] = useState<string>(
    initialPedido?.responsavelComercialNome || 'Isaac Lopes'
  );
  const [status, setStatus] = useState<PedidoStatus>(
    initialPedido?.status || 'rascunho'
  );

  // Proposal Content State
  const [objetivo, setObjetivo] = useState<string>(
    initialPedido?.proposal?.objetivo ||
      'Prestação de serviços técnicos especializados de engenharia para fornecimento, manutenção e testes de sistemas de segurança e alarme de incêndio (SDAI).'
  );

  // Carta de apresentação (opcional). Vazio → o PDF usa o texto institucional padrão.
  const [cartaApresentacao, setCartaApresentacao] = useState<string>(
    initialPedido?.proposal?.cartaApresentacao || ''
  );

  const [diretrizes, setDiretrizes] = useState<string[]>(
    initialPedido?.proposal?.diretrizesNormativas || [
      'ABNT NBR 17240:2010 — Sistemas de detecção e alarme de incêndio',
      'ABNT NBR 5410:2004 — Instalações elétricas de baixa tensão',
      'Instrução Técnica do Corpo de Bombeiros Militar vigente',
    ]
  );

  const [escopoServico, setEscopoServico] = useState<string>(
    initialPedido?.proposal?.escopoServico ||
      'Inspeção física, ensaios funcionais e manutenção preventiva nos laços de detecção, verificação de centrais e comissionamento com emissão de laudo e ART.'
  );

  const [entregaveis, setEntregaveis] = useState<string[]>(
    initialPedido?.proposal?.entregaveis || [
      'Relatório Diário de Obra (RDO) e Checklist de Testes Normativos',
      'Anotação de Responsabilidade Técnica (ART CREA-PR) registrada',
      'Manual As-Built e cadastro de pontos atualizado',
    ]
  );

  const [equipmentItems, setEquipmentItems] = useState<PedidoEquipmentItem[]>(
    initialPedido?.proposal?.equipmentItems || [
      {
        itemNumero: 1,
        descricao: 'Detector Óptico de Fumaça Endereçável',
        marcaModelo: 'Notifier FSP-951',
        unidade: 'un',
        quantidade: 10,
        precoUnitario: 340,
      },
    ]
  );

  const [marcas, setMarcas] = useState<PedidoBrand[]>(
    initialPedido?.proposal?.marcas || [
      { marcaNome: 'Notifier Honeywell', marcaCategoria: 'Centrais & Módulos', ordemExibicao: 1 },
      { marcaNome: 'Intelbras Fire Systems', marcaCategoria: 'Botoeiras & Sirenes', ordemExibicao: 2 },
    ]
  );

  const [premissas, setPremissas] = useState<string[]>(
    initialPedido?.proposal?.premissas || [
      'Acesso livre e desembaraçado às áreas de intervenção técnica',
      'Acompanhamento do responsável de segurança do cliente durante os testes sonoros',
    ]
  );

  const [respContratada, setRespContratada] = useState<string[]>(
    initialPedido?.proposal?.responsabilidadesContratada || [
      'Fornecer equipe qualificada com certificações NR-10 e NR-35',
      'Fornecer EPIs, ferramentas calibradas e emitir laudo ART',
    ]
  );

  const [respContratante, setRespContratante] = useState<string[]>(
    initialPedido?.proposal?.responsabilidadesContratante || [
      'Liberar acessos e autorizações de trabalho no ambiente',
      'Garantir ponto de energia elétrica 220V e sinal telefônico/dados',
    ]
  );

  const [prazoExecucao, setPrazoExecucao] = useState<string>(
    initialPedido?.proposal?.prazoExecucao || '10 dias úteis após autorização formal de início'
  );

  const [garantia, setGarantia] = useState<string>(
    initialPedido?.proposal?.garantia || '90 dias para serviços de instalação e 12 meses para equipamentos fornecidos'
  );

  const [validadeDias, setValidadeDias] = useState<number>(
    initialPedido?.proposal?.validadePropostaDias || 15
  );

  const [validadeComplemento, setValidadeComplemento] = useState<string>(
    initialPedido?.proposal?.validadePropostaComplemento || 'dias corridos a partir da emissão'
  );

  const [conclusao, setConclusao] = useState<string>(
    initialPedido?.proposal?.conclusao ||
      'Permanecemos à disposição para eventuais esclarecimentos adicionais e renovamos nossos votos de estima.'
  );

  // Commercial Conditions
  const [composicaoValor, setComposicaoValor] = useState<string>(
    initialPedido?.proposal?.composicaoValor || ''
  );
  const [formaPagamento, setFormaPagamento] = useState<string>(
    initialPedido?.proposal?.formaPagamento || '30% no aceite / 70% na entrega e emissão do laudo'
  );
  const [faturamento, setFaturamento] = useState<string>(
    initialPedido?.proposal?.faturamento || 'Faturamento direto via Nota Fiscal de Serviços'
  );
  const [impostos, setImpostos] = useState<string>(
    initialPedido?.proposal?.impostos || 'Inclusos, Simples Nacional (Anexo III)'
  );

  // Custom brand addition state
  const [customBrandName, setCustomBrandName] = useState('');
  const [customBrandCategory, setCustomBrandCategory] = useState('');

  // Selected client helper
  const selectedClient = clients.find((c) => c.id === clienteId) || clients[0];

  // Calculated Equipment Total
  const calculatedEquipTotal = equipmentItems.reduce(
    (acc, item) => acc + (item.precoUnitario || 0) * item.quantidade,
    0
  );
  const [manualValorTotal, setManualValorTotal] = useState<number | null>(
    initialPedido?.proposal?.valorTotal || null
  );

  const effectiveValorTotal = manualValorTotal !== null ? manualValorTotal : calculatedEquipTotal;

  // List helpers
  const handleAddListString = (setter: React.Dispatch<React.SetStateAction<string[]>>, defaultText = '') => {
    setter((prev) => [...prev, defaultText]);
  };

  const handleUpdateListString = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    index: number,
    value: string
  ) => {
    setter((prev) => {
      const updated = [...prev];
      updated[index] = value;
      return updated;
    });
  };

  const handleRemoveListString = (setter: React.Dispatch<React.SetStateAction<string[]>>, index: number) => {
    setter((prev) => prev.filter((_, i) => i !== index));
  };

  // Equipment handlers
  const handleAddEquipment = () => {
    const nextNum = equipmentItems.length + 1;
    setEquipmentItems([
      ...equipmentItems,
      {
        itemNumero: nextNum,
        descricao: '',
        marcaModelo: '',
        unidade: 'un',
        quantidade: 1,
        precoUnitario: 0,
      },
    ]);
  };

  const handleSelectInventoryItem = (index: number, inventoryId: string) => {
    const inv = inventory.find((i) => i.id === inventoryId);
    if (!inv) return;

    setEquipmentItems((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        vinculoEstoqueId: inv.id,
        descricao: inv.name,
        marcaModelo: inv.supplier || inv.category,
        precoUnitario: inv.unitPrice,
      };
      return updated;
    });
  };

  const handleUpdateEquipment = (index: number, field: keyof PedidoEquipmentItem, val: unknown) => {
    setEquipmentItems((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: val };
      return updated;
    });
  };

  const handleRemoveEquipment = (index: number) => {
    setEquipmentItems((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((item, i) => ({ ...item, itemNumero: i + 1 }))
    );
  };

  // Brands handlers
  const handleTogglePartnerBrand = (brand: PartnerBrand) => {
    const exists = marcas.some((m) => m.marcaNome === brand.name);
    if (exists) {
      setMarcas(marcas.filter((m) => m.marcaNome !== brand.name));
    } else {
      setMarcas([
        ...marcas,
        {
          marcaNome: brand.name,
          marcaCategoria: brand.category,
          marcaLogoUrl: brand.logoUrl,
          ordemExibicao: marcas.length + 1,
        },
      ]);
    }
  };

  const handleAddCustomBrand = () => {
    if (!customBrandName.trim()) return;
    setMarcas([
      ...marcas,
      {
        marcaNome: customBrandName.trim(),
        marcaCategoria: customBrandCategory.trim() || 'Equipamentos Antincêndio',
        ordemExibicao: marcas.length + 1,
      },
    ]);
    setCustomBrandName('');
    setCustomBrandCategory('');
  };

  const handleRemoveBrand = (index: number) => {
    setMarcas(marcas.filter((_, i) => i !== index));
  };

  // Template Loader
  const handleLoadTemplate = (template: PedidoTemplate) => {
    setObjetivo(template.objetivo);
    setDiretrizes(template.diretrizesNormativas);
    setEscopoServico(template.escopoServico);
    setEntregaveis(template.entregaveis);
    setPremissas(template.premissas);
    setRespContratada(template.responsabilidadesContratada);
    setRespContratante(template.responsabilidadesContratante);
    setGarantia(template.garantia);
    setConclusao(template.conclusao);
    alert(`Modelo "${template.name}" aplicado com sucesso ao formulário!`);
  };

  // Construct current Pedido object
  const buildCurrentPedido = (overrideStatus?: PedidoStatus): Pedido => {
    const now = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
    return {
      id: initialPedido?.id || `ped_${Date.now()}`,
      numeroPedido,
      referencia,
      clienteId: selectedClient?.id || '',
      clienteNome: selectedClient?.name || 'Cliente Não Selecionado',
      fornecedor,
      dataEmissao,
      responsavelComercialId: 'u1',
      responsavelComercialNome: responsavelNome,
      status: overrideStatus || status,
      createdAt: initialPedido?.createdAt || now,
      updatedAt: now,
      proposal: {
        objetivo,
        cartaApresentacao,
        diretrizesNormativas: diretrizes,
        escopoServico,
        entregaveis,
        premissas,
        prazoExecucao,
        garantia,
        validadePropostaDias: validadeDias,
        validadePropostaComplemento: validadeComplemento,
        conclusao,
        equipmentItems,
        marcas,
        responsabilidadesContratada: respContratada,
        responsabilidadesContratante: respContratante,
        valorTotal: effectiveValorTotal,
        composicaoValor,
        formaPagamento,
        faturamento,
        impostos,
      },
    };
  };

  // Save as Draft
  const handleSaveDraft = () => {
    const draft = buildCurrentPedido('rascunho');
    onSave(draft);
    onClose();
  };

  // Validate & Save / Advance Status
  const handleSaveWithValidation = (targetStatus: PedidoStatus) => {
    if (targetStatus !== 'rascunho') {
      if (!selectedClient) {
        alert('Por favor, selecione o Cliente.');
        setActiveTab('dados');
        return;
      }
      if (equipmentItems.length === 0) {
        alert('O pedido deve conter ao menos 1 item de equipamento.');
        setActiveTab('escopo_equip');
        return;
      }
      if (effectiveValorTotal <= 0) {
        alert('O valor total do pedido deve ser maior que zero.');
        setActiveTab('comercial');
        return;
      }
    }

    const finalPedido = buildCurrentPedido(targetStatus);
    onSave(finalPedido);
    onClose();
  };

  const handlePreview = () => {
    const current = buildCurrentPedido();
    onPreviewPDF(current);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-white max-w-5xl w-full rounded-2xl border border-slate-200 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        
        {/* Header */}
        <div className="bg-[#0B1E38] text-white p-5 px-6 flex justify-between items-center shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#E63946] text-white rounded-xl flex items-center justify-center font-bold">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-[#F2A900] text-slate-950 font-black px-2 py-0.5 rounded uppercase">
                  Módulo CRM &bull; Novo Pedido
                </span>
                <span className="text-xs font-data-mono text-slate-300 font-bold">
                  {numeroPedido}
                </span>
              </div>
              <h2 className="text-xl font-bold font-display text-white tracking-wide mt-0.5">
                Elaboração de Proposta Comercial
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePreview}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 uppercase"
            >
              <Eye className="w-4 h-4" /> Pré-Visualizar PDF
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Multi-Step Tabs Bar */}
        <div className="bg-slate-100 border-b border-slate-200 px-6 py-2.5 flex overflow-x-auto gap-2 shrink-0">
          <button
            onClick={() => setActiveTab('dados')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'dados'
                ? 'bg-[#0B1E38] text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            <Building2 className="w-4 h-4" /> 1. Dados &amp; Objetivo
          </button>

          <button
            onClick={() => setActiveTab('escopo_equip')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'escopo_equip'
                ? 'bg-[#0B1E38] text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            <Wrench className="w-4 h-4" /> 2. Escopo &amp; Equipamentos ({equipmentItems.length})
          </button>

          <button
            onClick={() => setActiveTab('marcas_resp')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'marcas_resp'
                ? 'bg-[#0B1E38] text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4" /> 3. Premissas &amp; Responsabilidades
          </button>

          <button
            onClick={() => setActiveTab('comercial')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'comercial'
                ? 'bg-[#0B1E38] text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            <DollarSign className="w-4 h-4" /> 4. Condições Comerciais &amp; Validade
          </button>

          <button
            onClick={() => setActiveTab('modelos')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-colors ${
              activeTab === 'modelos'
                ? 'bg-[#0B1E38] text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4 text-[#F2A900]" /> Modelos Reutilizáveis
          </button>
        </div>

        {/* Tab Body Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 text-xs text-slate-700">
          
          {/* ================= TAB 1: DADOS & OBJETIVO ================= */}
          {activeTab === 'dados' && (
            <div className="space-y-6">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-slate-600 font-bold uppercase mb-1">
                    Número do Pedido (Auto)
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={numeroPedido}
                    className="w-full bg-slate-200/80 border border-slate-300 rounded-lg p-2.5 font-data-mono font-bold text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-bold uppercase mb-1">
                    Referência / Nome do Projeto
                  </label>
                  <input
                    type="text"
                    value={referencia}
                    onChange={(e) => setReferencia(e.target.value)}
                    placeholder="Ex.: Retrofit SDAI Bloco A"
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#E63946]/20"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-bold uppercase mb-1">
                    Cliente / Contratante <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={clienteId}
                    onChange={(e) => setClienteId(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-[#E63946]/20"
                  >
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} — CNPJ: {c.cnpj}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-600 font-bold uppercase mb-1">
                    Fornecedor
                  </label>
                  <input
                    type="text"
                    value={fornecedor}
                    onChange={(e) => setFornecedor(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-bold uppercase mb-1">
                    Data de Emissão
                  </label>
                  <input
                    type="date"
                    value={dataEmissao}
                    onChange={(e) => setDataEmissao(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900 font-data-mono"
                  />
                </div>

                <div>
                  <label className="block text-slate-600 font-bold uppercase mb-1">
                    Responsável Comercial
                  </label>
                  <input
                    type="text"
                    value={responsavelNome}
                    onChange={(e) => setResponsavelNome(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900"
                  />
                </div>
              </div>

              {/* Objetivo da Proposta */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2">
                <h3 className="font-bold text-[#0B1E38] uppercase text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#E63946]" /> Objetivo da Proposta
                </h3>
                <textarea
                  rows={3}
                  value={objetivo}
                  onChange={(e) => setObjetivo(e.target.value)}
                  placeholder="Descreva o objetivo geral da proposta comercial..."
                  className="w-full border border-slate-300 rounded-lg p-3 text-slate-900 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#E63946]/20"
                />
              </div>

              {/* Carta de Apresentação (opcional) */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2">
                <h3 className="font-bold text-[#0B1E38] uppercase text-sm flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#0B1E38]" /> Carta de Apresentação
                  <span className="text-[10px] font-semibold text-slate-400 normal-case">(opcional — 1 parágrafo por linha)</span>
                </h3>
                <textarea
                  rows={4}
                  value={cartaApresentacao}
                  onChange={(e) => setCartaApresentacao(e.target.value)}
                  placeholder="Deixe em branco para usar o texto institucional padrão da Fireowl. Cada linha vira um parágrafo na carta do PDF."
                  className="w-full border border-slate-300 rounded-lg p-3 text-slate-900 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#E63946]/20"
                />
                <p className="text-[10px] text-slate-400">Aparece na 2ª página do PDF (Carta de Apresentação), assinada pelo responsável comercial.</p>
              </div>

              {/* Diretrizes Normativas */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <h3 className="font-bold text-[#0B1E38] uppercase text-sm flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" /> Diretrizes Normativas &amp; Referências
                  </h3>
                  <button
                    type="button"
                    onClick={() => handleAddListString(setDiretrizes, 'ABNT NBR ')}
                    className="px-2.5 py-1 bg-slate-900 text-white rounded-lg text-[11px] font-bold hover:bg-slate-800 transition-colors flex items-center gap-1 uppercase"
                  >
                    <Plus className="w-3.5 h-3.5" /> Adicionar Norma
                  </button>
                </div>

                <div className="space-y-2">
                  {diretrizes.map((norm, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="font-bold text-slate-400 font-data-mono">{idx + 1}.</span>
                      <input
                        type="text"
                        value={norm}
                        onChange={(e) => handleUpdateListString(setDiretrizes, idx, e.target.value)}
                        className="flex-1 border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#E63946]/20"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveListString(setDiretrizes, idx)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 2: ESCOPO & EQUIPAMENTOS ================= */}
          {activeTab === 'escopo_equip' && (
            <div className="space-y-6">
              {/* Escopo do Serviço & Entregáveis */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2">
                  <h3 className="font-bold text-[#0B1E38] uppercase text-xs">
                    Escopo Técnico dos Serviços
                  </h3>
                  <textarea
                    rows={5}
                    value={escopoServico}
                    onChange={(e) => setEscopoServico(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-3 text-slate-900 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#E63946]/20"
                  />
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="font-bold text-[#0B1E38] uppercase text-xs">
                      Entregáveis do Projeto
                    </h3>
                    <button
                      type="button"
                      onClick={() => handleAddListString(setEntregaveis, 'Documento de Entregável')}
                      className="px-2 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded text-[10px] font-bold uppercase flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" /> Add Entregável
                    </button>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {entregaveis.map((ent, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={ent}
                          onChange={(e) => handleUpdateListString(setEntregaveis, idx, e.target.value)}
                          className="flex-1 border border-slate-300 rounded-lg p-2 text-slate-900"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveListString(setEntregaveis, idx)}
                          className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Tabela de Equipamentos e Materiais */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-4">
                <div className="flex flex-wrap justify-between items-center gap-2 border-b border-slate-200 pb-3">
                  <div>
                    <h3 className="font-bold text-[#0B1E38] uppercase text-sm flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-[#E63946]" /> Especificação de Equipamentos e Materiais
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Você pode digitar manualmente ou vincular itens cadastrados no Almoxarifado / Estoque.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddEquipment}
                    className="px-3.5 py-2 bg-[#E63946] hover:bg-[#a51515] text-white rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 uppercase shadow-sm"
                  >
                    <Plus className="w-4 h-4" /> Adicionar Item de Equipamento
                  </button>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-[#0B1E38] text-white font-bold uppercase text-[10px]">
                      <tr>
                        <th className="p-2.5 text-center w-10">#</th>
                        <th className="p-2.5 w-44">Vincular do Estoque</th>
                        <th className="p-2.5">Descrição do Item</th>
                        <th className="p-2.5 w-36">Marca / Modelo</th>
                        <th className="p-2.5 text-center w-20">Unid.</th>
                        <th className="p-2.5 text-center w-20">Qtde.</th>
                        <th className="p-2.5 text-right w-28">Preço Unit. (R$)</th>
                        <th className="p-2.5 text-right w-28">Subtotal</th>
                        <th className="p-2.5 text-center w-10">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 font-medium text-slate-700">
                      {equipmentItems.map((item, idx) => {
                        const subtotal = (item.precoUnitario || 0) * item.quantidade;
                        return (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-2.5 text-center font-bold font-data-mono text-[#E63946]">
                              {idx + 1}
                            </td>
                            <td className="p-2.5">
                              <select
                                value={item.vinculoEstoqueId || ''}
                                onChange={(e) => handleSelectInventoryItem(idx, e.target.value)}
                                className="w-full border border-slate-300 rounded p-1.5 text-[11px] bg-slate-50"
                              >
                                <option value="">Selecione item...</option>
                                {inventory.map((inv) => (
                                  <option key={inv.id} value={inv.id}>
                                    {inv.code} - {inv.name} (R$ {inv.unitPrice})
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="p-2.5">
                              <input
                                type="text"
                                value={item.descricao}
                                onChange={(e) => handleUpdateEquipment(idx, 'descricao', e.target.value)}
                                placeholder="Descrição técnica..."
                                className="w-full border border-slate-300 rounded p-1.5 text-slate-900 font-semibold"
                              />
                            </td>
                            <td className="p-2.5">
                              <input
                                type="text"
                                value={item.marcaModelo}
                                onChange={(e) => handleUpdateEquipment(idx, 'marcaModelo', e.target.value)}
                                placeholder="Ex.: Notifier FSP-951"
                                className="w-full border border-slate-300 rounded p-1.5 text-slate-900"
                              />
                            </td>
                            <td className="p-2.5 text-center">
                              <input
                                type="text"
                                value={item.unidade}
                                onChange={(e) => handleUpdateEquipment(idx, 'unidade', e.target.value)}
                                className="w-full border border-slate-300 rounded p-1.5 text-center font-bold uppercase"
                              />
                            </td>
                            <td className="p-2.5 text-center">
                              <input
                                type="number"
                                min={1}
                                value={item.quantidade}
                                onChange={(e) => handleUpdateEquipment(idx, 'quantidade', Number(e.target.value))}
                                className="w-full border border-slate-300 rounded p-1.5 text-center font-data-mono font-bold"
                              />
                            </td>
                            <td className="p-2.5 text-right">
                              <input
                                type="number"
                                value={item.precoUnitario || 0}
                                onChange={(e) => handleUpdateEquipment(idx, 'precoUnitario', Number(e.target.value))}
                                className="w-full border border-slate-300 rounded p-1.5 text-right font-data-mono"
                              />
                            </td>
                            <td className="p-2.5 text-right font-data-mono font-bold text-slate-900">
                              R$ {subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="p-2.5 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemoveEquipment(idx)}
                                className="p-1 text-red-500 hover:bg-red-50 rounded"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end bg-slate-900 text-white p-3 rounded-lg font-bold">
                  <span>
                    Total de Equipamentos Calculado: R${' '}
                    {calculatedEquipTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 3: MARCAS & RESPONSABILIDADES ================= */}
          {activeTab === 'marcas_resp' && (
            <div className="space-y-6">
              {/* Premissas Adotadas */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                  <h3 className="font-bold text-[#0B1E38] uppercase text-xs">Premissas Adotadas</h3>
                  <button
                    type="button"
                    onClick={() => handleAddListString(setPremissas, 'Acesso livre e facilitado')}
                    className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-[10px] font-bold uppercase"
                  >
                    + Add Premissa
                  </button>
                </div>
                <div className="space-y-2">
                  {premissas.map((p, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={p}
                        onChange={(e) => handleUpdateListString(setPremissas, idx, e.target.value)}
                        className="flex-1 border border-slate-300 rounded-lg p-2 text-slate-900"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveListString(setPremissas, idx)}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Responsabilidades (Contratada vs Contratante) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Contratada */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                    <h3 className="font-bold text-[#0B1E38] uppercase text-xs flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4 text-emerald-600" /> Responsabilidades da Contratada
                    </h3>
                    <button
                      type="button"
                      onClick={() => handleAddListString(setRespContratada, 'Fornecer equipe especializada')}
                      className="px-2 py-1 bg-emerald-50 text-emerald-800 rounded text-[10px] font-bold uppercase"
                    >
                      + Add Item
                    </button>
                  </div>
                  <div className="space-y-2">
                    {respContratada.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={item}
                          onChange={(e) => handleUpdateListString(setRespContratada, idx, e.target.value)}
                          className="flex-1 border border-slate-300 rounded-lg p-2 text-slate-900"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveListString(setRespContratada, idx)}
                          className="p-1 text-red-500 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Contratante */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                    <h3 className="font-bold text-[#0B1E38] uppercase text-xs flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-blue-600" /> Responsabilidades da Contratante
                    </h3>
                    <button
                      type="button"
                      onClick={() => handleAddListString(setRespContratante, 'Liberar autorizações')}
                      className="px-2 py-1 bg-blue-50 text-blue-800 rounded text-[10px] font-bold uppercase"
                    >
                      + Add Item
                    </button>
                  </div>
                  <div className="space-y-2">
                    {respContratante.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          value={item}
                          onChange={(e) => handleUpdateListString(setRespContratante, idx, e.target.value)}
                          className="flex-1 border border-slate-300 rounded-lg p-2 text-slate-900"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveListString(setRespContratante, idx)}
                          className="p-1 text-red-500 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ================= TAB 4: COMERCIAL & PRAZOS ================= */}
          {activeTab === 'comercial' && (
            <div className="space-y-6">
              <div className="bg-white p-4 rounded-xl border border-slate-200 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#0B1E38] text-white p-4 rounded-xl col-span-1 md:col-span-1 space-y-2">
                  <span className="text-[10px] font-bold text-[#F2A900] uppercase tracking-widest block">
                    VALOR TOTAL DA PROPOSTA (R$)
                  </span>
                  <input
                    type="number"
                    value={effectiveValorTotal}
                    onChange={(e) => setManualValorTotal(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-2xl font-black text-amber-400 font-data-mono"
                  />
                  <p className="text-[10px] text-slate-300">
                    Soma automática dos equipamentos: R$ {calculatedEquipTotal.toLocaleString('pt-BR')}
                  </p>
                </div>

                <div className="col-span-1 md:col-span-2 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 uppercase mb-1">Forma de Pagamento</label>
                      <input
                        type="text"
                        value={formaPagamento}
                        onChange={(e) => setFormaPagamento(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 uppercase mb-1">Faturamento</label>
                      <input
                        type="text"
                        value={faturamento}
                        onChange={(e) => setFaturamento(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                  <label className="block font-bold text-slate-800 uppercase text-xs">Impostos Incidência</label>
                  <input
                    type="text"
                    value={impostos}
                    onChange={(e) => setImpostos(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900"
                  />

                  <label className="block font-bold text-slate-800 uppercase text-xs pt-2">Prazo de Execução</label>
                  <input
                    type="text"
                    value={prazoExecucao}
                    onChange={(e) => setPrazoExecucao(e.target.value)}
                    placeholder="Ex.: 10 dias úteis após liberação"
                    className="w-full border border-slate-300 rounded-lg p-2.5 text-slate-900"
                  />
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                  <label className="block font-bold text-slate-800 uppercase text-xs">Garantia Técnica</label>
                  <textarea
                    rows={2}
                    value={garantia}
                    onChange={(e) => setGarantia(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg p-2 text-slate-900"
                  />

                  <div className="grid grid-cols-3 gap-2 pt-2">
                    <div>
                      <label className="block font-bold text-slate-800 uppercase text-[10px]">
                        Validade (Dias)
                      </label>
                      <input
                        type="number"
                        value={validadeDias}
                        onChange={(e) => setValidadeDias(Number(e.target.value))}
                        className="w-full border border-slate-300 rounded-lg p-2 text-slate-900 font-data-mono font-bold"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block font-bold text-slate-800 uppercase text-[10px]">
                        Texto Complementar
                      </label>
                      <input
                        type="text"
                        value={validadeComplemento}
                        onChange={(e) => setValidadeComplemento(e.target.value)}
                        className="w-full border border-slate-300 rounded-lg p-2 text-slate-900"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Conclusão */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-2">
                <label className="block font-bold text-[#0B1E38] uppercase text-xs">
                  Texto de Conclusão / Encerramento
                </label>
                <textarea
                  rows={2}
                  value={conclusao}
                  onChange={(e) => setConclusao(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-3 text-slate-900"
                />
              </div>
            </div>
          )}

          {/* ================= TAB 5: MODELOS REUTILIZÁVEIS ================= */}
          {activeTab === 'modelos' && (
            <div className="space-y-6">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <h3 className="font-bold text-[#0B1E38] uppercase text-sm flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#F2A900]" /> Modelos / Templates de Proposta Comercial
                </h3>
                <p className="text-xs text-slate-600">
                  Carregue um modelo padrão pré-configurado para preencher objetivo, diretrizes, escopo, entregáveis e garantias de forma instantânea.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {templates.map((tmpl) => (
                    <div
                      key={tmpl.id}
                      className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-3"
                    >
                      <div>
                        <h4 className="font-bold text-slate-900 text-xs uppercase">{tmpl.name}</h4>
                        <p className="text-[11px] text-slate-500 line-clamp-2 mt-1">{tmpl.objetivo}</p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleLoadTemplate(tmpl)}
                        className="px-3 py-2 bg-[#0B1E38] hover:bg-slate-800 text-white rounded-lg text-xs font-bold uppercase transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Copy className="w-3.5 h-3.5 text-[#F2A900]" /> Aplicar este Modelo
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="bg-slate-100 border-t border-slate-200 p-4 px-6 flex flex-wrap justify-between items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleSaveDraft}
            className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl text-xs transition-colors uppercase tracking-wide flex items-center gap-1.5"
          >
            <Save className="w-4 h-4 text-slate-600" /> Salvar Rascunho
          </button>

          <div className="flex items-center gap-2">
            {status === 'rascunho' && (
              <button
                type="button"
                onClick={() => handleSaveWithValidation('em_revisao')}
                className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl text-xs transition-colors uppercase tracking-wide flex items-center gap-1.5"
              >
                Enviar p/ Revisão
              </button>
            )}

            <button
              type="button"
              onClick={() => handleSaveWithValidation('enviado_ao_cliente')}
              className="px-5 py-2.5 bg-[#E63946] hover:bg-[#a51515] text-white font-bold rounded-xl text-xs transition-colors uppercase tracking-wide shadow-md flex items-center gap-1.5"
            >
              <CheckCircle className="w-4 h-4" /> Salvar &amp; Emitir Proposta
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
