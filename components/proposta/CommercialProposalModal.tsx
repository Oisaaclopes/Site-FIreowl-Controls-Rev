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
  Wrench,
  ShieldCheck,
  DollarSign,
  Sparkles,
  ChevronDown,
  UserPlus,
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
  onAddClient?: (client: Client) => void;
  onPreviewPDF: (pedido: Pedido) => void;
}

const inputCls =
  'w-full border border-slate-300 rounded-lg p-2.5 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-[#0B1E38]/20 focus:border-[#0B1E38]/40';
const labelCls = 'block text-slate-600 font-bold uppercase text-[11px] mb-1';

/* ------------------------- componentes de módulo ------------------------- */

// Sanfona: cabeçalho clicável + corpo colapsável. Definida no módulo para os
// inputs internos não perderem o foco a cada render.
const Accordion: React.FC<{
  title: string;
  icon?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  badge?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, icon, open, onToggle, badge, children }) => (
  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center gap-2.5 px-4 py-3.5 text-left hover:bg-slate-50 transition-colors"
    >
      {icon}
      <span className="flex-1 font-bold text-[#0B1E38] uppercase text-sm">{title}</span>
      {badge}
      <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? '' : '-rotate-90'}`} />
    </button>
    {open && <div className="px-4 pb-4 pt-1 border-t border-slate-100">{children}</div>}
  </div>
);

// Editor de lista de strings (diretrizes, entregáveis, premissas, resp.).
const ListEditor: React.FC<{
  items: string[];
  onAdd: () => void;
  onUpdate: (i: number, v: string) => void;
  onRemove: (i: number) => void;
  addLabel: string;
  numbered?: boolean;
}> = ({ items, onAdd, onUpdate, onRemove, addLabel, numbered }) => (
  <div className="space-y-2">
    {items.length === 0 && <p className="text-[11px] text-slate-400 italic">Nenhum item adicionado.</p>}
    {items.map((it, idx) => (
      <div key={idx} className="flex items-center gap-2">
        {numbered && <span className="font-bold text-slate-400 font-data-mono text-xs w-5 shrink-0">{idx + 1}.</span>}
        <input type="text" value={it} onChange={(e) => onUpdate(idx, e.target.value)} className={`flex-1 ${inputCls}`} />
        <button
          type="button"
          onClick={() => onRemove(idx)}
          className="p-1.5 text-slate-400 hover:text-[#E63946] hover:bg-red-50 rounded-lg transition-colors shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    ))}
    <button
      type="button"
      onClick={onAdd}
      className="w-full py-2 rounded-lg border border-dashed border-[#0B1E38]/40 text-[11px] font-semibold text-[#0B1E38] hover:bg-[#0B1E38]/5 transition-colors flex items-center justify-center gap-1 uppercase"
    >
      <Plus className="w-3.5 h-3.5" /> {addLabel}
    </button>
  </div>
);

// Linha das "Informações Básicas": vazia mostra "+", preenchida mostra lixeira.
const BasicInfoRow: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
}> = ({ label, value, onChange, placeholder, multiline }) => {
  const [adding, setAdding] = useState(false);
  const filled = (value || '').trim() !== '';

  if (!filled && !adding) {
    return (
      <button
        type="button"
        onClick={() => setAdding(true)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border border-dashed border-slate-300 text-slate-500 hover:border-[#0B1E38] hover:text-[#0B1E38] transition-colors"
      >
        <span className="text-[11px] font-bold uppercase">{label}</span>
        <Plus className="w-4 h-4" />
      </button>
    );
  }

  return (
    <div className="flex items-start gap-2">
      <div className="flex-1">
        <label className={labelCls}>{label}</label>
        {multiline ? (
          <textarea autoFocus={adding} rows={2} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={inputCls} />
        ) : (
          <input autoFocus={adding} type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={inputCls} />
        )}
      </div>
      <button
        type="button"
        onClick={() => {
          onChange('');
          setAdding(false);
        }}
        title="Limpar / remover este campo"
        className="mt-6 p-2 text-slate-400 hover:text-[#E63946] hover:bg-red-50 rounded-lg transition-colors shrink-0"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
};

export const CommercialProposalModal: React.FC<CommercialProposalModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialPedido,
  clients,
  inventory,
  partnerBrands,
  templates,
  onAddClient,
  onPreviewPDF,
}) => {
  // Sanfonas abertas (por padrão as principais abertas).
  const [open, setOpen] = useState<Record<string, boolean>>({
    objetivo: true,
    equipamentos: true,
    basicas: true,
  });
  const toggle = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  // ----------------- estado do formulário -----------------
  const [numeroPedido] = useState<string>(
    initialPedido?.numeroPedido || `PED-2026-${Math.floor(100 + Math.random() * 900)}`
  );
  const [referencia, setReferencia] = useState<string>(initialPedido?.referencia || 'Manutenção Preventiva SDAI');
  const [clienteId, setClienteId] = useState<string>(initialPedido?.clienteId || clients[0]?.id || '');
  const [fornecedor, setFornecedor] = useState<string>(initialPedido?.fornecedor || 'Fireowl Controls Ltda.');
  const [dataEmissao, setDataEmissao] = useState<string>(
    initialPedido?.dataEmissao || new Date().toISOString().split('T')[0]
  );
  const [responsavelNome, setResponsavelNome] = useState<string>(
    initialPedido?.responsavelComercialNome || 'Isaac Lopes'
  );
  const [status, setStatus] = useState<PedidoStatus>(initialPedido?.status || 'rascunho');

  const [objetivo, setObjetivo] = useState<string>(
    initialPedido?.proposal?.objetivo ||
      'Prestação de serviços técnicos especializados de engenharia para fornecimento, manutenção e testes de sistemas de segurança e alarme de incêndio (SDAI).'
  );
  const [cartaApresentacao, setCartaApresentacao] = useState<string>(initialPedido?.proposal?.cartaApresentacao || '');

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
    initialPedido?.proposal?.equipmentItems || []
  );
  const [marcas] = useState<PedidoBrand[]>(initialPedido?.proposal?.marcas || []);
  const [premissas, setPremissas] = useState<string[]>(
    initialPedido?.proposal?.premissas || [
      'Acesso livre e desembaraçado às áreas de intervenção técnica',
      'Acompanhamento do responsável de segurança do cliente durante os testes sonoros',
    ]
  );
  const [respContratada, setRespContratada] = useState<string[]>(
    initialPedido?.proposal?.responsabilidadesContratada || [
      'Fornecer equipe qualificada, EPIs, ferramentas calibradas e emitir laudo ART',
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
  const [validadeDias, setValidadeDias] = useState<number>(initialPedido?.proposal?.validadePropostaDias || 15);
  const [validadeComplemento, setValidadeComplemento] = useState<string>(
    initialPedido?.proposal?.validadePropostaComplemento || 'dias corridos a partir da emissão'
  );
  const [conclusao, setConclusao] = useState<string>(
    initialPedido?.proposal?.conclusao ||
      'Permanecemos à disposição para eventuais esclarecimentos adicionais e renovamos nossos votos de estima.'
  );
  const [formaPagamento, setFormaPagamento] = useState<string>(
    initialPedido?.proposal?.formaPagamento || '30% no aceite / 70% na entrega e emissão do laudo'
  );
  const [faturamento, setFaturamento] = useState<string>(initialPedido?.proposal?.faturamento || '');
  const [impostos, setImpostos] = useState<string>(initialPedido?.proposal?.impostos || 'Inclusos, Simples Nacional (Anexo III)');

  const [manualValorTotal, setManualValorTotal] = useState<number | null>(initialPedido?.proposal?.valorTotal || null);

  // Cadastro rápido de cliente (dialog sobreposto).
  const [newClientOpen, setNewClientOpen] = useState(false);
  const [ncName, setNcName] = useState('');
  const [ncCnpj, setNcCnpj] = useState('');
  const [ncEmail, setNcEmail] = useState('');
  const [ncPhone, setNcPhone] = useState('');
  const [ncSegment, setNcSegment] = useState('');

  const selectedClient = clients.find((c) => c.id === clienteId) || clients[0];

  const calculatedEquipTotal = equipmentItems.reduce((acc, item) => acc + (item.precoUnitario || 0) * item.quantidade, 0);
  const effectiveValorTotal = manualValorTotal !== null ? manualValorTotal : calculatedEquipTotal;

  // ----------------- helpers de lista -----------------
  const addStr = (setter: React.Dispatch<React.SetStateAction<string[]>>, def = '') => setter((p) => [...p, def]);
  const updStr = (setter: React.Dispatch<React.SetStateAction<string[]>>, i: number, v: string) =>
    setter((p) => p.map((x, idx) => (idx === i ? v : x)));
  const rmStr = (setter: React.Dispatch<React.SetStateAction<string[]>>, i: number) =>
    setter((p) => p.filter((_, idx) => idx !== i));

  // ----------------- equipamentos -----------------
  const handleAddEquipment = () =>
    setEquipmentItems((prev) => [
      ...prev,
      { itemNumero: prev.length + 1, descricao: '', marcaModelo: '', unidade: 'un', quantidade: 1, precoUnitario: 0 },
    ]);
  const handleSelectInventoryItem = (index: number, inventoryId: string) => {
    const inv = inventory.find((i) => i.id === inventoryId);
    if (!inv) return;
    setEquipmentItems((prev) =>
      prev.map((it, i) =>
        i === index
          ? { ...it, vinculoEstoqueId: inv.id, descricao: inv.name, marcaModelo: inv.brand || inv.supplier || inv.category, precoUnitario: inv.salePrice ?? inv.unitPrice }
          : it
      )
    );
  };
  const handleUpdateEquipment = (index: number, field: keyof PedidoEquipmentItem, val: unknown) =>
    setEquipmentItems((prev) => prev.map((it, i) => (i === index ? { ...it, [field]: val } : it)));
  const handleRemoveEquipment = (index: number) =>
    setEquipmentItems((prev) => prev.filter((_, i) => i !== index).map((it, i) => ({ ...it, itemNumero: i + 1 })));

  // ----------------- templates -----------------
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
    alert(`Modelo "${template.name}" aplicado ao formulário!`);
  };

  // ----------------- cadastro rápido de cliente -----------------
  const openNewClient = () => {
    setNcName('');
    setNcCnpj('');
    setNcEmail('');
    setNcPhone('');
    setNcSegment('');
    setNewClientOpen(true);
  };
  const confirmNewClient = () => {
    const nome = ncName.trim();
    if (!nome) return;
    const seq = Math.floor(1000 + Math.random() * 9000);
    const novo: Client = {
      id: `c_${Date.now()}`,
      code: `#CLI-${seq}`,
      name: nome,
      cnpj: ncCnpj.trim() || '00.000.000/0000-00',
      segment: ncSegment.trim() || 'Cliente',
      contractStatus: 'EM DIA',
      lastOSDate: new Date().toLocaleDateString('pt-BR'),
      lastOSType: 'Proposta',
      address: 'Endereço a completar',
      contacts: [{ name: 'Contato', role: 'Representante', phone: ncPhone.trim(), email: ncEmail.trim() }],
      totalContractsValue: 0,
    };
    onAddClient?.(novo);
    setClienteId(novo.id); // já seleciona o novo cliente
    setNewClientOpen(false);
  };

  // ----------------- montar / salvar -----------------
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
        composicaoValor: '',
        formaPagamento,
        faturamento,
        impostos,
      },
    };
  };

  const handleSaveDraft = () => {
    onSave(buildCurrentPedido('rascunho'));
    onClose();
  };
  const handleSaveWithValidation = (targetStatus: PedidoStatus) => {
    if (targetStatus !== 'rascunho') {
      if (!selectedClient) {
        alert('Selecione o Cliente.');
        setOpen((o) => ({ ...o, pedido: true }));
        return;
      }
      if (effectiveValorTotal <= 0) {
        alert('O valor total da proposta deve ser maior que zero.');
        setOpen((o) => ({ ...o, valor: true }));
        return;
      }
    }
    onSave(buildCurrentPedido(targetStatus));
    onClose();
  };
  const handlePreview = () => onPreviewPDF(buildCurrentPedido());

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div className="bg-slate-50 max-w-4xl w-full rounded-2xl border border-slate-200 shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Cabeçalho */}
        <div className="bg-[#0B1E38] text-white p-5 px-6 flex justify-between items-center shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#E63946] text-white rounded-xl flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-[#F2A900] text-slate-950 font-black px-2 py-0.5 rounded uppercase">
                  Módulo CRM • Novo Pedido
                </span>
                <span className="text-xs font-data-mono text-slate-300 font-bold">{numeroPedido}</span>
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
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Corpo: rolagem vertical contínua com sanfonas */}
        <div className="p-4 md:p-6 overflow-y-auto flex-1 space-y-4">
          {/* ---- Informações do Pedido (sempre visível) ---- */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-[#0B1E38] uppercase text-sm flex items-center gap-2 mb-4">
              <Building2 className="w-4 h-4 text-[#E63946]" /> Informações do Pedido
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className={labelCls}>Número do Pedido</label>
                <input type="text" readOnly value={numeroPedido} className={`${inputCls} bg-slate-100 font-data-mono font-bold`} />
              </div>
              <div>
                <label className={labelCls}>Referência / Nome do Projeto</label>
                <input type="text" value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="Ex.: Retrofit SDAI Bloco A" className={inputCls} />
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>
                  Cliente / Contratante <span className="text-[#E63946]">*</span>
                </label>
                <div className="flex gap-2">
                  <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} className={`${inputCls} font-bold`}>
                    {clients.length === 0 && <option value="">Nenhum cliente</option>}
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} — CNPJ: {c.cnpj}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={openNewClient}
                    title="Cadastrar novo cliente"
                    className="shrink-0 px-3 rounded-lg bg-[#0B1E38] hover:bg-slate-800 text-white flex items-center gap-1.5 text-xs font-bold uppercase"
                  >
                    <UserPlus className="w-4 h-4" /> Novo
                  </button>
                </div>
              </div>
              <div>
                <label className={labelCls}>Fornecedor</label>
                <input type="text" value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Data de Emissão</label>
                <input type="date" value={dataEmissao} onChange={(e) => setDataEmissao(e.target.value)} className={`${inputCls} font-data-mono`} />
              </div>
              <div>
                <label className={labelCls}>Responsável Comercial</label>
                <input type="text" value={responsavelNome} onChange={(e) => setResponsavelNome(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as PedidoStatus)} className={inputCls}>
                  <option value="rascunho">Rascunho</option>
                  <option value="em_revisao">Em Revisão</option>
                  <option value="enviado_ao_cliente">Enviado ao Cliente</option>
                  <option value="aceito">Aceito</option>
                </select>
              </div>
            </div>
          </div>

          {/* ---- Valor da Proposta (sempre visível) ---- */}
          <div className="bg-[#0B1E38] text-white p-5 rounded-xl shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[10px] font-bold text-[#F2A900] uppercase tracking-widest block">Valor Total da Proposta (R$)</span>
              <p className="text-[10px] text-slate-300 mt-1">Soma dos equipamentos: R$ {calculatedEquipTotal.toLocaleString('pt-BR')}</p>
            </div>
            <input
              type="number"
              value={effectiveValorTotal}
              onChange={(e) => setManualValorTotal(Number(e.target.value))}
              className="w-full sm:w-56 bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-2xl font-black text-amber-400 font-data-mono text-right"
            />
          </div>

          {/* ---- Accordions de conteúdo ---- */}
          <Accordion title="Objetivo da Proposta" icon={<FileText className="w-4 h-4 text-[#E63946]" />} open={!!open.objetivo} onToggle={() => toggle('objetivo')}>
            <textarea rows={3} value={objetivo} onChange={(e) => setObjetivo(e.target.value)} placeholder="Objetivo geral da proposta..." className={inputCls} />
          </Accordion>

          <Accordion title="Carta de Apresentação" icon={<FileText className="w-4 h-4 text-[#0B1E38]" />} open={!!open.carta} onToggle={() => toggle('carta')}>
            <textarea
              rows={4}
              value={cartaApresentacao}
              onChange={(e) => setCartaApresentacao(e.target.value)}
              placeholder="Deixe em branco para usar o texto institucional padrão da Fireowl. Cada linha vira um parágrafo no PDF."
              className={inputCls}
            />
            <p className="text-[10px] text-slate-400 mt-1">Aparece na 2ª página do PDF, assinada pelo responsável comercial.</p>
          </Accordion>

          <Accordion title="Diretrizes Normativas" icon={<ShieldCheck className="w-4 h-4 text-emerald-600" />} open={!!open.diretrizes} onToggle={() => toggle('diretrizes')}>
            <ListEditor items={diretrizes} numbered onAdd={() => addStr(setDiretrizes, 'ABNT NBR ')} onUpdate={(i, v) => updStr(setDiretrizes, i, v)} onRemove={(i) => rmStr(setDiretrizes, i)} addLabel="Adicionar norma" />
          </Accordion>

          <Accordion title="Escopo Técnico dos Serviços" icon={<Wrench className="w-4 h-4 text-[#E63946]" />} open={!!open.escopo} onToggle={() => toggle('escopo')}>
            <textarea rows={4} value={escopoServico} onChange={(e) => setEscopoServico(e.target.value)} className={inputCls} />
          </Accordion>

          <Accordion title="Entregáveis do Projeto" icon={<CheckCircle className="w-4 h-4 text-emerald-600" />} open={!!open.entregaveis} onToggle={() => toggle('entregaveis')}>
            <ListEditor items={entregaveis} onAdd={() => addStr(setEntregaveis, 'Documento de entregável')} onUpdate={(i, v) => updStr(setEntregaveis, i, v)} onRemove={(i) => rmStr(setEntregaveis, i)} addLabel="Adicionar entregável" />
          </Accordion>

          <Accordion
            title="Equipamentos e Materiais"
            icon={<Wrench className="w-4 h-4 text-[#E63946]" />}
            open={!!open.equipamentos}
            onToggle={() => toggle('equipamentos')}
            badge={<span className="text-[10px] font-bold bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">{equipmentItems.length}</span>}
          >
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#0B1E38] text-white font-bold uppercase text-[10px]">
                  <tr>
                    <th className="p-2 text-center w-8">#</th>
                    <th className="p-2 w-40">Vincular do Estoque</th>
                    <th className="p-2">Descrição</th>
                    <th className="p-2 w-32">Marca/Modelo</th>
                    <th className="p-2 text-center w-14">Unid.</th>
                    <th className="p-2 text-center w-16">Qtd.</th>
                    <th className="p-2 text-right w-24">Unit. (R$)</th>
                    <th className="p-2 text-right w-24">Subtotal</th>
                    <th className="p-2 text-center w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-medium text-slate-700">
                  {equipmentItems.map((item, idx) => {
                    const subtotal = (item.precoUnitario || 0) * item.quantidade;
                    return (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-2 text-center font-bold font-data-mono text-[#E63946]">{idx + 1}</td>
                        <td className="p-2">
                          <select value={item.vinculoEstoqueId || ''} onChange={(e) => handleSelectInventoryItem(idx, e.target.value)} className="w-full border border-slate-300 rounded p-1.5 text-[11px] bg-slate-50">
                            <option value="">Selecione...</option>
                            {inventory.map((inv) => (
                              <option key={inv.id} value={inv.id}>
                                {inv.code} - {inv.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2">
                          <input type="text" value={item.descricao} onChange={(e) => handleUpdateEquipment(idx, 'descricao', e.target.value)} placeholder="Descrição..." className="w-full border border-slate-300 rounded p-1.5 text-slate-900 font-semibold" />
                        </td>
                        <td className="p-2">
                          <input type="text" value={item.marcaModelo} onChange={(e) => handleUpdateEquipment(idx, 'marcaModelo', e.target.value)} className="w-full border border-slate-300 rounded p-1.5" />
                        </td>
                        <td className="p-2 text-center">
                          <input type="text" value={item.unidade} onChange={(e) => handleUpdateEquipment(idx, 'unidade', e.target.value)} className="w-full border border-slate-300 rounded p-1.5 text-center font-bold uppercase" />
                        </td>
                        <td className="p-2 text-center">
                          <input type="number" min={1} value={item.quantidade} onChange={(e) => handleUpdateEquipment(idx, 'quantidade', Number(e.target.value))} className="w-full border border-slate-300 rounded p-1.5 text-center font-data-mono font-bold" />
                        </td>
                        <td className="p-2 text-right">
                          <input type="number" value={item.precoUnitario || 0} onChange={(e) => handleUpdateEquipment(idx, 'precoUnitario', Number(e.target.value))} className="w-full border border-slate-300 rounded p-1.5 text-right font-data-mono" />
                        </td>
                        <td className="p-2 text-right font-data-mono font-bold text-slate-900">
                          {subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-2 text-center">
                          <button type="button" onClick={() => handleRemoveEquipment(idx)} className="p-1 text-slate-400 hover:text-[#E63946] hover:bg-red-50 rounded">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {equipmentItems.length === 0 && (
                    <tr>
                      <td colSpan={9} className="p-4 text-center text-slate-400 italic">Nenhum item. Adicione abaixo.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <button type="button" onClick={handleAddEquipment} className="mt-3 w-full py-2 rounded-lg border border-dashed border-[#E63946]/50 text-[11px] font-semibold text-[#E63946] hover:bg-red-50 transition-colors flex items-center justify-center gap-1 uppercase">
              <Plus className="w-3.5 h-3.5" /> Adicionar item de equipamento
            </button>
          </Accordion>

          <Accordion title="Premissas Adotadas" icon={<ShieldCheck className="w-4 h-4 text-[#0B1E38]" />} open={!!open.premissas} onToggle={() => toggle('premissas')}>
            <ListEditor items={premissas} onAdd={() => addStr(setPremissas, 'Acesso livre e facilitado')} onUpdate={(i, v) => updStr(setPremissas, i, v)} onRemove={(i) => rmStr(setPremissas, i)} addLabel="Adicionar premissa" />
          </Accordion>

          <Accordion title="Responsabilidades da Contratada" icon={<CheckCircle className="w-4 h-4 text-emerald-600" />} open={!!open.respContratada} onToggle={() => toggle('respContratada')}>
            <ListEditor items={respContratada} onAdd={() => addStr(setRespContratada, 'Fornecer equipe qualificada')} onUpdate={(i, v) => updStr(setRespContratada, i, v)} onRemove={(i) => rmStr(setRespContratada, i)} addLabel="Adicionar item" />
          </Accordion>

          <Accordion title="Obrigações da Contratante" icon={<Building2 className="w-4 h-4 text-blue-600" />} open={!!open.respContratante} onToggle={() => toggle('respContratante')}>
            <ListEditor items={respContratante} onAdd={() => addStr(setRespContratante, 'Liberar autorizações')} onUpdate={(i, v) => updStr(setRespContratante, i, v)} onRemove={(i) => rmStr(setRespContratante, i)} addLabel="Adicionar item" />
          </Accordion>

          <Accordion title="Conclusão" icon={<FileText className="w-4 h-4 text-[#0B1E38]" />} open={!!open.conclusao} onToggle={() => toggle('conclusao')}>
            <textarea rows={3} value={conclusao} onChange={(e) => setConclusao(e.target.value)} className={inputCls} />
          </Accordion>

          {/* ---- Informações Básicas (colapsável com +/lixeira) ---- */}
          <Accordion title="Informações Básicas" icon={<DollarSign className="w-4 h-4 text-emerald-600" />} open={!!open.basicas} onToggle={() => toggle('basicas')}>
            <div className="space-y-2.5">
              <BasicInfoRow label="Garantia Técnica" value={garantia} onChange={setGarantia} placeholder="Ex.: 90 dias serviços / 12 meses equipamentos" multiline />
              <BasicInfoRow label="Prazo de Execução" value={prazoExecucao} onChange={setPrazoExecucao} placeholder="Ex.: 10 dias úteis após liberação" />
              <BasicInfoRow label="Forma de Pagamento" value={formaPagamento} onChange={setFormaPagamento} placeholder="Ex.: 30% no aceite / 70% na entrega" />
              <BasicInfoRow label="Faturamento" value={faturamento} onChange={setFaturamento} placeholder="Ex.: Nota Fiscal de Serviços" />
              <BasicInfoRow label="Impostos" value={impostos} onChange={setImpostos} placeholder="Ex.: Inclusos, Simples Nacional" />
              <div className="flex items-end gap-2 pt-1">
                <div className="w-28">
                  <label className={labelCls}>Validade (dias)</label>
                  <input type="number" value={validadeDias} onChange={(e) => setValidadeDias(Number(e.target.value))} className={`${inputCls} font-data-mono`} />
                </div>
                <div className="flex-1">
                  <label className={labelCls}>Texto complementar</label>
                  <input type="text" value={validadeComplemento} onChange={(e) => setValidadeComplemento(e.target.value)} className={inputCls} />
                </div>
              </div>
            </div>
          </Accordion>

          {/* ---- Modelos reutilizáveis ---- */}
          {templates.length > 0 && (
            <Accordion title="Modelos Reutilizáveis" icon={<Sparkles className="w-4 h-4 text-[#F2A900]" />} open={!!open.modelos} onToggle={() => toggle('modelos')}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {templates.map((tmpl) => (
                  <div key={tmpl.id} className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col justify-between gap-2">
                    <div>
                      <h4 className="font-bold text-slate-900 text-xs uppercase">{tmpl.name}</h4>
                      <p className="text-[11px] text-slate-500 line-clamp-2 mt-1">{tmpl.objetivo}</p>
                    </div>
                    <button type="button" onClick={() => handleLoadTemplate(tmpl)} className="px-3 py-2 bg-[#0B1E38] hover:bg-slate-800 text-white rounded-lg text-xs font-bold uppercase flex items-center justify-center gap-1.5">
                      <Copy className="w-3.5 h-3.5 text-[#F2A900]" /> Aplicar modelo
                    </button>
                  </div>
                ))}
              </div>
            </Accordion>
          )}
        </div>

        {/* Rodapé */}
        <div className="bg-white border-t border-slate-200 p-4 px-6 flex flex-wrap justify-between items-center gap-3 shrink-0">
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
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl text-xs transition-colors uppercase tracking-wide"
              >
                Enviar p/ Revisão
              </button>
            )}
            <button
              type="button"
              onClick={() => handleSaveWithValidation('enviado_ao_cliente')}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors uppercase tracking-wide shadow-md flex items-center gap-1.5"
            >
              <CheckCircle className="w-4 h-4" /> Salvar &amp; Emitir Proposta
            </button>
          </div>
        </div>
      </div>

      {/* ============ Dialog: cadastro rápido de cliente ============ */}
      {newClientOpen && (
        <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-xl shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#0B1E38]" />
                <h3 className="text-sm font-bold text-slate-900 uppercase">Novo Cliente</h3>
              </div>
              <button onClick={() => setNewClientOpen(false)} className="text-slate-400 hover:text-slate-700 font-bold text-lg leading-none">✕</button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className={labelCls}>Nome / Razão Social *</label>
                <input autoFocus type="text" value={ncName} onChange={(e) => setNcName(e.target.value)} placeholder="Nome do cliente" className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>CNPJ</label>
                  <input type="text" value={ncCnpj} onChange={(e) => setNcCnpj(e.target.value)} placeholder="00.000.000/0000-00" className={`${inputCls} font-data-mono`} />
                </div>
                <div>
                  <label className={labelCls}>Segmento</label>
                  <input type="text" value={ncSegment} onChange={(e) => setNcSegment(e.target.value)} placeholder="Ex.: Shopping" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>E-mail</label>
                  <input type="email" value={ncEmail} onChange={(e) => setNcEmail(e.target.value)} placeholder="contato@cliente.com" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Telefone</label>
                  <input type="text" value={ncPhone} onChange={(e) => setNcPhone(e.target.value)} placeholder="(00) 00000-0000" className={inputCls} />
                </div>
              </div>
              <p className="text-[10px] text-slate-400 flex items-start gap-1 bg-slate-50 border border-slate-200 rounded-lg p-2">
                <span className="material-symbols-outlined text-sm text-slate-400">info</span>
                <span>Você não perde os dados da proposta. O cliente é criado e já selecionado aqui.</span>
              </p>
            </div>
            <div className="flex items-center justify-between p-4 border-t border-slate-100">
              <button onClick={() => setNewClientOpen(false)} className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 uppercase">
                Cancelar
              </button>
              <button
                onClick={confirmNewClient}
                disabled={!ncName.trim()}
                className="px-5 py-2 rounded-lg bg-[#0B1E38] hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold uppercase tracking-wide"
              >
                Salvar e selecionar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
