'use client';

import React, { useMemo, useRef, useState } from 'react';
import { InventoryItem, StockMovement } from '@/lib/types';
import { insertStockMovement, fetchStockMovements, isSupabaseConfigured } from '@/lib/inventory';

interface EstoqueViewProps {
  inventory: InventoryItem[];
  onAddInventoryItem: (item: InventoryItem) => void | Promise<void>;
  onUpdateInventoryItem?: (item: InventoryItem) => void | Promise<void>;
  onDeleteInventoryItem?: (id: string) => void | Promise<void>;
  loading?: boolean;
}

let invSeq = 90;

// Unidades de medida agrupadas — exibidas na "nova janela" de seleção
const UNIT_GROUPS: { group: string; units: { code: string; label: string }[] }[] = [
  {
    group: 'Contagem',
    units: [
      { code: 'UN', label: 'Unidade' },
      { code: 'PC', label: 'Peça' },
      { code: 'PAR', label: 'Par' },
      { code: 'DZ', label: 'Dúzia' },
      { code: 'CX', label: 'Caixa' },
      { code: 'PCT', label: 'Pacote' },
      { code: 'KIT', label: 'Kit' },
      { code: 'CJ', label: 'Conjunto' },
      { code: 'JG', label: 'Jogo' },
      { code: 'RL', label: 'Rolo' },
    ],
  },
  {
    group: 'Comprimento',
    units: [
      { code: 'M', label: 'Metro' },
      { code: 'ML', label: 'Metro linear' },
      { code: 'CM', label: 'Centímetro' },
      { code: 'MM', label: 'Milímetro' },
      { code: 'KM', label: 'Quilômetro' },
    ],
  },
  {
    group: 'Área',
    units: [{ code: 'M2', label: 'Metro quadrado' }],
  },
  {
    group: 'Volume',
    units: [
      { code: 'M3', label: 'Metro cúbico' },
      { code: 'L', label: 'Litro' },
      { code: 'MLT', label: 'Mililitro' },
    ],
  },
  {
    group: 'Peso',
    units: [
      { code: 'KG', label: 'Quilograma' },
      { code: 'G', label: 'Grama' },
      { code: 'T', label: 'Tonelada' },
    ],
  },
  {
    group: 'Embalagem',
    units: [
      { code: 'FD', label: 'Fardo' },
      { code: 'SC', label: 'Saco' },
      { code: 'GL', label: 'Galão' },
      { code: 'TB', label: 'Tubo' },
      { code: 'BOB', label: 'Bobina' },
    ],
  },
];

const BASE_CATEGORIES = [
  'Sirenes & Sinalização',
  'Detecção de Incêndio',
  'Centrais & Painéis',
  'Acionadores Manuais',
  'Cabos & Infraestrutura',
  'Fontes & Baterias',
  'Câmeras & CFTV',
  'Controle de Acesso',
  'Automação Predial (BMS)',
  'Ferramentas & Insumos',
  'Diversos',
];

const round2 = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
const brl = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

// Máscara de moeda (BRL): dígitos preenchem os centavos da direita p/ esquerda
const parseMoney = (s: string): number => {
  const digits = s.replace(/\D/g, '');
  if (!digits) return 0;
  return parseInt(digits, 10) / 100;
};
const formatMoney = (n: number): string =>
  (Number.isFinite(n) ? n : 0).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// Ponto de informação (tooltip no hover)
const InfoDot: React.FC<{ text: string }> = ({ text }) => (
  <span className="relative inline-flex group/info align-middle ml-1">
    <span
      className="w-4 h-4 rounded-full bg-slate-200 text-slate-600 text-[10px] font-bold flex items-center justify-center cursor-help select-none"
      tabIndex={0}
    >
      ?
    </span>
    <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-60 bg-[#1A1A72] text-white text-[10px] leading-relaxed rounded-lg p-2.5 opacity-0 group-hover/info:opacity-100 group-focus-within/info:opacity-100 transition-opacity z-20 shadow-xl normal-case font-normal tracking-normal">
      {text}
    </span>
  </span>
);

const SectionTitle: React.FC<{ icon: string; children: React.ReactNode }> = ({ icon, children }) => (
  <div className="flex items-center gap-2 mb-4">
    <span className="w-8 h-8 rounded-lg bg-[#1A1A72]/10 text-[#1A1A72] flex items-center justify-center">
      <span className="material-symbols-outlined text-lg">{icon}</span>
    </span>
    <h4 className="font-display text-sm font-bold uppercase tracking-wide text-[#1A1A72]">{children}</h4>
  </div>
);

const inputCls =
  'w-full border border-slate-200 rounded-lg p-2.5 text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#E63946]/20 focus:border-[#E63946]/40';
const labelCls = 'text-slate-600 mb-1 font-semibold uppercase text-[11px] flex items-center';
const cardCls = 'bg-white rounded-xl border border-slate-200 shadow-sm p-5';

// Select com opção de adicionar novo valor livre
const SelectOrAdd: React.FC<{
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
  error?: boolean;
}> = ({ value, onChange, options, placeholder, error }) => {
  const [adding, setAdding] = useState(false);

  if (adding) {
    return (
      <div className="flex gap-2">
        <input
          autoFocus
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Digite o novo valor..."
          className={inputCls}
        />
        <button
          type="button"
          onClick={() => setAdding(false)}
          title="Voltar à lista"
          className="shrink-0 px-3 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 flex items-center"
        >
          <span className="material-symbols-outlined text-base">list</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <select
        value={options.includes(value) ? value : value ? '__custom__' : ''}
        onChange={(e) => {
          if (e.target.value === '__add__') {
            onChange('');
            setAdding(true);
          } else if (e.target.value !== '__custom__') {
            onChange(e.target.value);
          }
        }}
        className={`${inputCls} ${error ? 'border-red-400 ring-2 ring-red-100' : ''}`}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
        {value && !options.includes(value) && <option value="__custom__">{value}</option>}
        <option value="__add__">+ Adicionar novo...</option>
      </select>
      <button
        type="button"
        onClick={() => {
          onChange('');
          setAdding(true);
        }}
        title="Adicionar novo"
        className="shrink-0 px-3 rounded-lg bg-[#1A1A72] text-white hover:bg-[#12124f] transition-colors flex items-center"
      >
        <span className="material-symbols-outlined text-base">add</span>
      </button>
    </div>
  );
};

// Campo numérico com botões diminuir (-) e aumentar (+)
const NumberStepper: React.FC<{
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
  min?: number;
}> = ({ value, onChange, disabled, min = 0 }) => (
  <div className="flex items-center gap-2">
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(Math.max(min, Math.floor(Number(value) || 0) - 1))}
      className="w-9 h-9 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 flex items-center justify-center shrink-0 disabled:opacity-40"
    >
      <span className="material-symbols-outlined text-base">remove</span>
    </button>
    <input
      type="number"
      min={min}
      disabled={disabled}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className={`${inputCls} font-data-mono text-center`}
    />
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(Math.floor(Number(value) || 0) + 1)}
      className="w-9 h-9 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 flex items-center justify-center shrink-0 disabled:opacity-40"
    >
      <span className="material-symbols-outlined text-base">add</span>
    </button>
  </div>
);

// Input com máscara de moeda (R$). Mantém o valor numérico no estado.
const MoneyInput: React.FC<{ value: number; onChange: (n: number) => void; icon: string }> = ({
  value,
  onChange,
  icon,
}) => (
  <div className="relative">
    <span className="material-symbols-outlined absolute left-2.5 top-2.5 text-slate-400 text-base">{icon}</span>
    <span className="absolute left-9 top-2.5 text-slate-500 font-data-mono text-xs pointer-events-none">R$</span>
    <input
      type="text"
      inputMode="numeric"
      value={formatMoney(value)}
      onChange={(e) => onChange(parseMoney(e.target.value))}
      className={`${inputCls} pl-16 font-data-mono text-right`}
    />
  </div>
);

export const EstoqueView: React.FC<EstoqueViewProps> = ({
  inventory,
  onAddInventoryItem,
  onUpdateInventoryItem,
  onDeleteInventoryItem,
  loading = false,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showPanel, setShowPanel] = useState(false);
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [errors, setErrors] = useState<{ name?: boolean; category?: boolean; unit?: boolean }>({});
  const fileRef = useRef<HTMLInputElement>(null);

  // Movimentação rápida (entrada/saída de estoque)
  const [movementItem, setMovementItem] = useState<InventoryItem | null>(null);
  const [movementType, setMovementType] = useState<'entrada' | 'saida'>('entrada');
  const [movementQty, setMovementQty] = useState(1);
  const [movementNote, setMovementNote] = useState('');
  const [movementSaving, setMovementSaving] = useState(false);

  // Histórico de movimentações
  const [historyItem, setHistoryItem] = useState<InventoryItem | null>(null);
  const [historyRows, setHistoryRows] = useState<StockMovement[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Foto
  const [imageUrl, setImageUrl] = useState('');
  // Básicas
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [code, setCode] = useState('');
  const [unit, setUnit] = useState('');
  // Preços
  const [salePrice, setSalePrice] = useState(0);
  const [costPrice, setCostPrice] = useState(0);
  const [margin, setMargin] = useState(0);
  const [markup, setMarkup] = useState(0);
  // Estoque
  const [stockManaged, setStockManaged] = useState(true);
  const [quantity, setQuantity] = useState(0);
  const [idealQuantity, setIdealQuantity] = useState(0);
  const [minQuantity, setMinQuantity] = useState(0);
  const [reservedQuantity, setReservedQuantity] = useState(0);
  // Outras
  const [supplier, setSupplier] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [description, setDescription] = useState('');

  // Listas para os selects (base + valores já existentes no estoque)
  const categoryOptions = useMemo(() => {
    const set = new Set<string>(BASE_CATEGORIES);
    inventory.forEach((i) => i.category && set.add(i.category));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [inventory]);

  const supplierOptions = useMemo(() => {
    const set = new Set<string>();
    inventory.forEach((i) => i.supplier && set.add(i.supplier));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [inventory]);

  const brandOptions = useMemo(() => {
    const set = new Set<string>();
    inventory.forEach((i) => i.brand && set.add(i.brand));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [inventory]);

  const generateCode = (cat: string) => {
    const prefix =
      (cat || 'PROD')
        .normalize('NFD')
        .replace(/[^A-Za-z ]/g, '')
        .trim()
        .split(/\s+/)[0]
        .substring(0, 4)
        .toUpperCase() || 'PROD';
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `${prefix}-${rand}`;
  };

  const openPanel = () => {
    setEditingItem(null);
    setErrors({});
    setImageUrl('');
    setName('');
    setCategory('');
    setCode(generateCode(''));
    setUnit('');
    setSalePrice(0);
    setCostPrice(0);
    setMargin(0);
    setMarkup(0);
    setStockManaged(true);
    setQuantity(0);
    setIdealQuantity(0);
    setMinQuantity(0);
    setReservedQuantity(0);
    setSupplier('');
    setBrand('');
    setModel('');
    setDescription('');
    setShowPanel(true);
  };

  const openEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setErrors({});
    setImageUrl(item.imageUrl || '');
    setName(item.name);
    setCategory(item.category || '');
    setCode(item.code || '');
    setUnit(item.unit || '');
    setSalePrice(item.salePrice ?? item.unitPrice ?? 0);
    setCostPrice(item.costPrice ?? 0);
    setMargin(item.profitMargin ?? 0);
    setMarkup(item.markup ?? 0);
    setStockManaged(item.stockManaged ?? true);
    setQuantity(item.quantity ?? 0);
    setIdealQuantity(item.idealQuantity ?? 0);
    setMinQuantity(item.minQuantity ?? 0);
    setReservedQuantity(item.reservedQuantity ?? 0);
    setSupplier(item.supplier || '');
    setBrand(item.brand || '');
    setModel(item.model || '');
    setDescription(item.description || '');
    setShowPanel(true);
  };

  const closePanel = () => {
    setShowPanel(false);
    setEditingItem(null);
  };

  const handleDelete = async (item: InventoryItem) => {
    if (!onDeleteInventoryItem) return;
    if (!window.confirm(`Excluir o produto "${item.name}"?\n\nEsta ação não pode ser desfeita.`)) return;
    await onDeleteInventoryItem(item.id);
  };

  const openMovement = (item: InventoryItem) => {
    setMovementItem(item);
    setMovementType('entrada');
    setMovementQty(1);
    setMovementNote('');
    setMovementSaving(false);
  };

  const openHistory = async (item: InventoryItem) => {
    setHistoryItem(item);
    setHistoryRows([]);
    if (!isSupabaseConfigured()) return;
    setHistoryLoading(true);
    try {
      const rows = await fetchStockMovements(item.id);
      setHistoryRows(rows);
    } catch (err) {
      console.error('Falha ao carregar histórico de movimentações:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const movementResult = (): number => {
    if (!movementItem) return 0;
    const delta = Math.max(0, Math.floor(Number(movementQty) || 0));
    return movementType === 'entrada'
      ? movementItem.quantity + delta
      : Math.max(0, movementItem.quantity - delta);
  };

  const handleConfirmMovement = async () => {
    if (!movementItem || !onUpdateInventoryItem || movementSaving) return;
    const delta = Math.max(0, Math.floor(Number(movementQty) || 0));
    if (delta <= 0) return;
    const newBalance = movementResult();
    const updated: InventoryItem = { ...movementItem, quantity: newBalance };
    try {
      setMovementSaving(true);
      await onUpdateInventoryItem(updated);
      if (isSupabaseConfigured()) {
        try {
          await insertStockMovement({
            id: '',
            itemId: movementItem.id,
            itemCode: movementItem.code,
            itemName: movementItem.name,
            type: movementType,
            quantity: delta,
            resultingBalance: newBalance,
            note: movementNote || undefined,
          });
        } catch (err) {
          console.error('Movimentação registrada no estoque, mas falhou ao gravar o histórico:', err);
        }
      }
      setMovementItem(null);
    } finally {
      setMovementSaving(false);
    }
  };

  const handleImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImageUrl(reader.result as string);
    reader.readAsDataURL(file);
  };

  // ---- Cálculos de preço (reativos) ----
  const onCostChange = (cost: number) => {
    setCostPrice(cost);
    if (salePrice > 0) {
      setMargin(round2(((salePrice - cost) / salePrice) * 100));
      setMarkup(cost > 0 ? round2(((salePrice - cost) / cost) * 100) : 0);
    }
  };

  const onSaleChange = (sale: number) => {
    setSalePrice(sale);
    setMargin(sale > 0 ? round2(((sale - costPrice) / sale) * 100) : 0);
    setMarkup(costPrice > 0 ? round2(((sale - costPrice) / costPrice) * 100) : 0);
  };

  // Ao informar a margem, calcula automaticamente markup e preço de venda
  const onMarginChange = (m: number) => {
    setMargin(m);
    if (m < 100) {
      const sale = costPrice / (1 - m / 100);
      setSalePrice(round2(sale));
      setMarkup(costPrice > 0 ? round2(((sale - costPrice) / costPrice) * 100) : 0);
    }
  };

  const onMarkupChange = (mk: number) => {
    setMarkup(mk);
    const sale = costPrice * (1 + mk / 100);
    setSalePrice(round2(sale));
    setMargin(sale > 0 ? round2(((sale - costPrice) / sale) * 100) : 0);
  };

  const filteredInventory = inventory.filter(
    (item) =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.serialBP || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (saving) return;

    // Validação dos campos obrigatórios
    const errs = { name: !name.trim(), category: !category.trim(), unit: !unit };
    setErrors(errs);
    if (errs.unit && !errs.name && !errs.category) {
      setShowUnitModal(true);
      return;
    }
    if (errs.name || errs.category || errs.unit) return;

    const seq = (invSeq++).toString();
    const payload: InventoryItem = {
      id: editingItem ? editingItem.id : `inv-${seq}`,
      code: code || generateCode(category),
      serialBP: editingItem ? editingItem.serialBP : `BP-EQUIP-${seq}00`,
      name,
      category,
      quantity: stockManaged ? Number(quantity) : 0,
      minQuantity: stockManaged ? Number(minQuantity) : 0,
      unitPrice: Number(salePrice),
      supplier,
      location: editingItem?.location ?? '',
      imageUrl: imageUrl || undefined,
      unit,
      salePrice: Number(salePrice),
      costPrice: Number(costPrice),
      profitMargin: Number(margin),
      markup: Number(markup),
      stockManaged,
      idealQuantity: stockManaged ? Number(idealQuantity) : undefined,
      reservedQuantity: stockManaged ? Number(reservedQuantity) : undefined,
      brand: brand || undefined,
      model: model || undefined,
      description: description || undefined,
    };
    try {
      setSaving(true);
      if (editingItem) {
        await onUpdateInventoryItem?.(payload);
      } else {
        await onAddInventoryItem(payload);
      }
      closePanel();
    } finally {
      setSaving(false);
    }
  };

  const SaveButton = (
    <button
      type="button"
      onClick={() => handleSave()}
      disabled={saving}
      className="bg-[#E63946] hover:bg-[#a51515] text-white px-5 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors shadow-sm flex items-center gap-1.5 disabled:opacity-70 disabled:cursor-not-allowed"
    >
      <span className={`material-symbols-outlined text-base ${saving ? 'animate-spin' : ''}`}>
        {saving ? 'progress_activity' : 'save'}
      </span>
      {saving ? 'Salvando...' : 'Salvar'}
    </button>
  );

  return (
    <div className="flex flex-col w-full p-8 gap-6">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-slate-200 pb-5">
        <div>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Gestão de Almoxarifado, Peças &amp; Rastreabilidade BP
          </span>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight mt-0.5">
            Estoque de Componentes SDAI &amp; Equipamentos
          </h1>
        </div>

        <button
          onClick={openPanel}
          className="bg-[#E63946] hover:bg-[#a51515] text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm flex items-center gap-1.5 uppercase tracking-wide"
        >
          <span className="material-symbols-outlined text-base">add</span> Novo Produto
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-[11px] font-semibold text-slate-500 uppercase">Itens Catalogados</p>
          <p className="font-data-mono text-2xl font-bold text-slate-900 mt-1">{inventory.length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-[11px] font-semibold text-slate-500 uppercase">Peças em Nível Crítico</p>
          <p className="font-data-mono text-2xl font-bold text-red-600 mt-1">
            {inventory.filter((i) => i.quantity <= i.minQuantity).length}
          </p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-[11px] font-semibold text-slate-500 uppercase">Total de Unidades</p>
          <p className="font-data-mono text-2xl font-bold text-emerald-600 mt-1">
            {inventory.reduce((acc, i) => acc + i.quantity, 0)}
          </p>
        </div>
        <div className="bg-[#1A1A72] text-white p-4 rounded-xl border border-[#1A1A72] shadow-sm">
          <p className="text-[11px] font-semibold text-white/60 uppercase">Patrimônio de Almoxarifado</p>
          <p className="font-data-mono text-2xl font-bold text-emerald-400 mt-1">
            R$ {inventory.reduce((acc, i) => acc + i.quantity * i.unitPrice, 0).toLocaleString('pt-BR')}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative w-full sm:w-96">
          <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 text-lg">search</span>
          <input
            type="text"
            placeholder="Buscar por código, série BP, nome ou categoria..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#E63946]/20 uppercase"
          />
        </div>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-[#1A1A72] px-6 py-4 text-white text-xs font-bold uppercase tracking-wider">
          Listagem de Estoque e Equipamentos
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200">
                <th className="p-4">Cód. Peça / Série BP</th>
                <th className="p-4">Descrição do Componente</th>
                <th className="p-4">Categoria</th>
                <th className="p-4">Fornecedor</th>
                <th className="p-4 text-center">Qtd. Atual</th>
                <th className="p-4 text-right">Valor Unitário</th>
                <th className="p-4 text-right">Subtotal</th>
                <th className="p-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {loading && (
                <tr>
                  <td colSpan={8} className="p-10 text-center text-slate-400">
                    <span className="material-symbols-outlined text-3xl animate-spin inline-block">progress_activity</span>
                    <p className="mt-2 text-xs font-semibold uppercase tracking-wider">Carregando estoque...</p>
                  </td>
                </tr>
              )}
              {!loading && filteredInventory.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-400">
                    <span className="material-symbols-outlined text-4xl text-slate-300">inventory_2</span>
                    <p className="mt-2 text-sm font-bold text-slate-500 uppercase tracking-wider">
                      {searchTerm ? 'Nenhum item encontrado' : 'Nenhum produto cadastrado'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      {searchTerm
                        ? 'Ajuste os termos da busca.'
                        : 'Clique em "Novo Produto" para cadastrar o primeiro item.'}
                    </p>
                  </td>
                </tr>
              )}
              {!loading &&
                filteredInventory.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-4">
                      <span className="font-data-mono font-bold text-[#E63946]">{item.code}</span> <br />
                      <span className="font-data-mono text-[10px] text-slate-400">{item.serialBP}</span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        {item.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="w-9 h-9 rounded-md object-cover border border-slate-200 shrink-0"
                          />
                        ) : (
                          <span className="w-9 h-9 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                            <span className="material-symbols-outlined text-base">inventory_2</span>
                          </span>
                        )}
                        <span className="font-bold text-slate-900 uppercase">{item.name}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="text-slate-900 font-semibold">{item.category}</span>
                      {item.unit ? (
                        <>
                          <br />
                          <span className="text-[10px] text-slate-500 font-data-mono">{item.unit}</span>
                        </>
                      ) : null}
                    </td>
                    <td className="p-4 text-slate-600">{item.supplier}</td>
                    <td className="p-4 text-center font-data-mono font-bold">
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          item.quantity <= item.minQuantity ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {item.quantity} un (mín: {item.minQuantity})
                      </span>
                    </td>
                    <td className="p-4 text-right font-data-mono text-slate-900">
                      R$ {item.unitPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-4 text-right font-data-mono font-bold text-slate-900">
                      R$ {(item.quantity * item.unitPrice).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => openMovement(item)}
                          title="Entrada / Saída de estoque"
                          aria-label="Movimentar estoque"
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                        >
                          <span className="material-symbols-outlined text-lg">swap_vert</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openHistory(item)}
                          title="Histórico de movimentações"
                          aria-label="Histórico de movimentações"
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-[#1A1A72] hover:bg-slate-100 transition-colors"
                        >
                          <span className="material-symbols-outlined text-lg">history</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(item)}
                          title="Editar produto"
                          aria-label="Editar produto"
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-[#1A1A72] hover:bg-slate-100 transition-colors"
                        >
                          <span className="material-symbols-outlined text-lg">edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(item)}
                          title="Excluir produto"
                          aria-label="Excluir produto"
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-[#E63946] hover:bg-red-50 transition-colors"
                        >
                          <span className="material-symbols-outlined text-lg">delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== SIDE-PANEL: Novo / Editar Produto ===== */}
      {showPanel && (
        <div className="fixed inset-0 z-50 flex justify-end bg-[#1A1A72]/50 backdrop-blur-sm">
          {/* área para fechar clicando fora */}
          <div className="flex-1 hidden md:block" onClick={closePanel} />

          <div className="bg-slate-50 w-full max-w-2xl h-full shadow-2xl flex flex-col">
            {/* Cabeçalho fixo */}
            <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200">
              <div>
                <h3 className="font-display text-lg font-bold text-[#1A1A72] uppercase tracking-wide">
                  {editingItem ? 'Editar produto' : 'Novo produto'}
                </h3>
                <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">
                  {editingItem ? code : 'Preencha as informações do item'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {SaveButton}
                <button
                  onClick={closePanel}
                  aria-label="Fechar"
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              </div>
            </div>

            {/* Corpo rolável */}
            <form onSubmit={handleSave} className="overflow-y-auto px-6 py-5 space-y-5 text-xs font-medium flex-1">
              {/* FOTO */}
              <div className={cardCls}>
                <SectionTitle icon="photo_camera">Foto do produto</SectionTitle>
                <input ref={fileRef} type="file" accept="image/*" onChange={handleImage} className="hidden" />
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="w-24 h-24 rounded-xl border-2 border-dashed border-slate-300 hover:border-[#E63946] flex items-center justify-center text-slate-400 hover:text-[#E63946] transition-colors overflow-hidden relative shrink-0"
                  >
                    {imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imageUrl} alt="Prévia" className="absolute inset-0 w-full h-full object-cover" />
                    ) : (
                      <span className="material-symbols-outlined text-3xl">image</span>
                    )}
                  </button>
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wide transition-colors shadow-sm flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-base">photo_camera</span>
                      Adicionar imagem
                    </button>
                    {imageUrl && (
                      <button
                        type="button"
                        onClick={() => setImageUrl('')}
                        className="text-[10px] font-semibold uppercase text-slate-500 hover:text-[#E63946] text-left"
                      >
                        Remover foto
                      </button>
                    )}
                    <p className="text-[10px] text-slate-400">JPG ou PNG. A imagem aparece na listagem do estoque.</p>
                  </div>
                </div>
              </div>

              {/* INFORMAÇÕES BÁSICAS */}
              <div className={cardCls}>
                <SectionTitle icon="info">Informações básicas</SectionTitle>
                <div className="space-y-3">
                  <div>
                    <label className={labelCls}>Nome *</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        if (errors.name) setErrors((p) => ({ ...p, name: false }));
                      }}
                      placeholder="Ex.: Sirene Bitonal 24V Strobe IP66"
                      className={`${inputCls} ${errors.name ? 'border-red-400 ring-2 ring-red-100' : ''}`}
                    />
                    {errors.name && <p className="text-[10px] text-[#E63946] mt-1 font-semibold">Informe o nome do produto.</p>}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Categoria *</label>
                      <SelectOrAdd
                        value={category}
                        onChange={(v) => {
                          setCategory(v);
                          if (errors.category) setErrors((p) => ({ ...p, category: false }));
                        }}
                        options={categoryOptions}
                        placeholder="Selecionar categoria..."
                        error={errors.category}
                      />
                      {errors.category && (
                        <p className="text-[10px] text-[#E63946] mt-1 font-semibold">Selecione ou informe a categoria.</p>
                      )}
                    </div>
                    <div>
                      <label className={labelCls}>Código</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={code}
                          onChange={(e) => setCode(e.target.value)}
                          className={`${inputCls} font-data-mono`}
                        />
                        <button
                          type="button"
                          onClick={() => setCode(generateCode(category))}
                          title="Gerar código automaticamente"
                          className="shrink-0 px-3 rounded-lg bg-[#1A1A72] text-white hover:bg-[#12124f] transition-colors flex items-center"
                        >
                          <span className="material-symbols-outlined text-base">refresh</span>
                        </button>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Unidade de medida *</label>
                    <button
                      type="button"
                      onClick={() => setShowUnitModal(true)}
                      className={`${inputCls} flex items-center justify-between text-left ${
                        unit ? 'text-slate-900' : 'text-slate-400'
                      } ${errors.unit ? 'border-red-400 ring-2 ring-red-100' : ''}`}
                    >
                      <span className="font-data-mono">{unit || 'Selecionar unidade de medida...'}</span>
                      <span className="material-symbols-outlined text-base text-slate-400">straighten</span>
                    </button>
                    {errors.unit && <p className="text-[10px] text-[#E63946] mt-1 font-semibold">Selecione a unidade de medida.</p>}
                  </div>
                </div>
              </div>

              {/* PREÇOS */}
              <div className={cardCls}>
                <SectionTitle icon="attach_money">Preço de venda e custo</SectionTitle>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Preço de venda</label>
                    <MoneyInput value={salePrice} onChange={onSaleChange} icon="sell" />
                  </div>
                  <div>
                    <label className={labelCls}>Preço de custo</label>
                    <MoneyInput value={costPrice} onChange={onCostChange} icon="point_of_sale" />
                  </div>
                  <div>
                    <label className={labelCls}>
                      Margem de lucro
                      <InfoDot text="Margem de lucro = (Preço de venda − Preço de custo) ÷ Preço de venda × 100. Representa quanto do preço de venda é lucro. Ao informar a margem, o markup e o preço de venda são calculados automaticamente." />
                    </label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-2.5 top-2.5 text-slate-400 text-base">percent</span>
                      <input
                        type="number"
                        step="0.01"
                        value={margin}
                        onChange={(e) => onMarginChange(Number(e.target.value))}
                        className={`${inputCls} pl-9 font-data-mono`}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>
                      Markup
                      <InfoDot text="Markup = (Preço de venda − Preço de custo) ÷ Preço de custo × 100. Representa o quanto foi acrescentado sobre o custo para chegar ao preço de venda." />
                    </label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-2.5 top-2.5 text-slate-400 text-base">percent</span>
                      <input
                        type="number"
                        step="0.01"
                        value={markup}
                        onChange={(e) => onMarkupChange(Number(e.target.value))}
                        className={`${inputCls} pl-9 font-data-mono`}
                      />
                    </div>
                  </div>
                </div>
                <p className="mt-3 text-[10px] text-slate-500 flex items-start gap-1">
                  <span className="material-symbols-outlined text-sm text-[#1A1A72]">info</span>
                  <span>
                    Ao informar o <strong>preço de custo</strong> e a <strong>margem de lucro</strong>, o{' '}
                    <strong>markup</strong> e o <strong>preço de venda</strong> são calculados automaticamente.
                  </span>
                </p>
              </div>

              {/* GERENCIAMENTO DE ESTOQUE */}
              <div className={cardCls}>
                <div className="flex items-center justify-between">
                  <SectionTitle icon="monitoring">Gerenciamento de estoque</SectionTitle>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <span className="text-[10px] font-semibold uppercase text-slate-500">Ativar gerenciamento</span>
                    <button
                      type="button"
                      onClick={() => setStockManaged((v) => !v)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        stockManaged ? 'bg-[#E63946]' : 'bg-slate-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          stockManaged ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </label>
                </div>
                <div
                  className={`grid grid-cols-1 sm:grid-cols-2 gap-4 transition-opacity ${
                    stockManaged ? '' : 'opacity-40 pointer-events-none'
                  }`}
                >
                  <div>
                    <label className={labelCls}>Quantidade (estoque atual)</label>
                    <NumberStepper value={quantity} onChange={setQuantity} disabled={!stockManaged} />
                  </div>
                  <div>
                    <label className={labelCls}>Quantidade ideal</label>
                    <NumberStepper value={idealQuantity} onChange={setIdealQuantity} disabled={!stockManaged} />
                  </div>
                  <div>
                    <label className={labelCls}>Quantidade mínima</label>
                    <NumberStepper value={minQuantity} onChange={setMinQuantity} disabled={!stockManaged} />
                  </div>
                  <div>
                    <label className={labelCls}>
                      Quantidade reservada
                      <InfoDot text="Quantidade já comprometida (ex.: vinculada a pedidos/OS). É apenas informativa e não pode ser editada manualmente." />
                    </label>
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-2.5 top-2.5 text-slate-400 text-base">lock</span>
                      <input
                        type="number"
                        value={reservedQuantity}
                        readOnly
                        disabled
                        className={`${inputCls} pl-9 font-data-mono bg-slate-100 text-slate-500 cursor-not-allowed`}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* OUTRAS INFORMAÇÕES */}
              <div className={cardCls}>
                <SectionTitle icon="assignment">Outras informações</SectionTitle>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className={labelCls}>Fornecedor</label>
                    <SelectOrAdd
                      value={supplier}
                      onChange={setSupplier}
                      options={supplierOptions}
                      placeholder="Selecionar fornecedor..."
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Marca</label>
                    <SelectOrAdd
                      value={brand}
                      onChange={setBrand}
                      options={brandOptions}
                      placeholder="Selecionar marca..."
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Modelo</label>
                    <input type="text" value={model} onChange={(e) => setModel(e.target.value)} className={inputCls} />
                  </div>
                </div>
                <div className="mt-3">
                  <label className={labelCls}>Descrição</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    placeholder="Detalhes técnicos, aplicação, observações..."
                    className={`${inputCls} resize-none`}
                  />
                </div>
              </div>
            </form>

            {/* Rodapé fixo */}
            <div className="px-6 py-4 bg-white border-t border-slate-200 flex items-center justify-between gap-3">
              <div className="text-[11px] text-slate-500 font-data-mono">
                Venda {brl(salePrice)} · Custo {brl(costPrice)} · Margem {round2(margin)}%
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={closePanel}
                  disabled={saving}
                  className="px-4 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                {SaveButton}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Janela: Movimentação rápida de estoque (entrada/saída) */}
      {movementItem && (
        <div className="fixed inset-0 z-[60] bg-[#1A1A72]/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full rounded-xl border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#1A1A72]">swap_vert</span>
                <h3 className="font-display text-base font-bold text-[#1A1A72] uppercase tracking-wide">
                  Movimentar Estoque
                </h3>
              </div>
              <button
                onClick={() => setMovementItem(null)}
                className="text-slate-400 hover:text-slate-700 font-bold text-xl"
              >
                ✕
              </button>
            </div>

            <div className="px-6 py-5 space-y-4 text-xs font-medium">
              <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg p-3">
                <div>
                  <p className="font-bold text-slate-900 uppercase">{movementItem.name}</p>
                  <p className="font-data-mono text-[10px] text-slate-400">{movementItem.code}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-500 uppercase">Saldo atual</p>
                  <p className="font-data-mono text-lg font-bold text-slate-900">{movementItem.quantity}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMovementType('entrada')}
                  className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg border font-semibold uppercase tracking-wide transition-colors ${
                    movementType === 'entrada'
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 text-slate-500 hover:border-emerald-300'
                  }`}
                >
                  <span className="material-symbols-outlined text-base">arrow_downward</span>
                  Entrada
                </button>
                <button
                  type="button"
                  onClick={() => setMovementType('saida')}
                  className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg border font-semibold uppercase tracking-wide transition-colors ${
                    movementType === 'saida'
                      ? 'border-[#E63946] bg-red-50 text-[#E63946]'
                      : 'border-slate-200 text-slate-500 hover:border-red-300'
                  }`}
                >
                  <span className="material-symbols-outlined text-base">arrow_upward</span>
                  Saída
                </button>
              </div>

              <div>
                <label className={labelCls}>Quantidade</label>
                <NumberStepper value={movementQty} onChange={setMovementQty} min={1} />
                <div className="flex gap-1.5 mt-2">
                  {[5, 10, 50].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setMovementQty(n)}
                      className="px-3 py-1 rounded-md border border-slate-200 text-slate-500 hover:border-[#1A1A72] hover:text-[#1A1A72] font-data-mono text-[11px]"
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={labelCls}>Observação (opcional)</label>
                <input
                  type="text"
                  value={movementNote}
                  onChange={(e) => setMovementNote(e.target.value)}
                  placeholder="Ex.: Nota fiscal 1234, uso em OS-2026-91..."
                  className={inputCls}
                />
              </div>

              <div className="flex items-center justify-between bg-[#1A1A72]/5 border border-[#1A1A72]/15 rounded-lg p-3">
                <span className="text-[11px] font-semibold uppercase text-slate-600">Saldo após movimentação</span>
                <span className="font-data-mono text-lg font-bold text-[#1A1A72]">{movementResult()}</span>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMovementItem(null)}
                disabled={movementSaving}
                className="px-4 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmMovement}
                disabled={movementSaving || Math.floor(Number(movementQty) || 0) <= 0}
                className={`px-6 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider text-white transition-colors shadow-sm flex items-center gap-1.5 disabled:opacity-60 disabled:cursor-not-allowed ${
                  movementType === 'entrada' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-[#E63946] hover:bg-[#a51515]'
                }`}
              >
                <span className={`material-symbols-outlined text-base ${movementSaving ? 'animate-spin' : ''}`}>
                  {movementSaving ? 'progress_activity' : 'check'}
                </span>
                {movementSaving ? 'Salvando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Janela: Histórico de movimentações do produto */}
      {historyItem && (
        <div className="fixed inset-0 z-[60] bg-[#1A1A72]/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-xl w-full rounded-xl border border-slate-200 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div className="flex items-center gap-2 min-w-0">
                <span className="material-symbols-outlined text-[#1A1A72]">history</span>
                <div className="min-w-0">
                  <h3 className="font-display text-base font-bold text-[#1A1A72] uppercase tracking-wide truncate">
                    Histórico — {historyItem.name}
                  </h3>
                  <p className="font-data-mono text-[10px] text-slate-400">{historyItem.code}</p>
                </div>
              </div>
              <button
                onClick={() => setHistoryItem(null)}
                className="text-slate-400 hover:text-slate-700 font-bold text-xl shrink-0"
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-4">
              {!isSupabaseConfigured() ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  Histórico disponível apenas com o Supabase configurado.
                </div>
              ) : historyLoading ? (
                <div className="text-center py-10 text-slate-400">
                  <span className="material-symbols-outlined text-3xl animate-spin inline-block">progress_activity</span>
                  <p className="mt-2 text-xs font-semibold uppercase tracking-wider">Carregando histórico...</p>
                </div>
              ) : historyRows.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <span className="material-symbols-outlined text-4xl text-slate-300">receipt_long</span>
                  <p className="mt-2 text-sm font-bold text-slate-500 uppercase tracking-wider">
                    Nenhuma movimentação registrada
                  </p>
                  <p className="text-xs text-slate-400 mt-1">As entradas e saídas deste produto aparecerão aqui.</p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {historyRows.map((mv) => (
                    <li key={mv.id} className="py-3 flex items-center gap-3">
                      <span
                        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                          mv.type === 'entrada' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-[#E63946]'
                        }`}
                      >
                        <span className="material-symbols-outlined text-lg">
                          {mv.type === 'entrada' ? 'arrow_downward' : 'arrow_upward'}
                        </span>
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-900 uppercase">
                          {mv.type === 'entrada' ? 'Entrada' : 'Saída'} de {mv.quantity} un
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">{mv.note || '—'}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-data-mono text-xs font-bold text-slate-900">Saldo: {mv.resultingBalance ?? '—'}</p>
                        <p className="font-data-mono text-[10px] text-slate-400">
                          {mv.createdAt
                            ? new Date(mv.createdAt).toLocaleString('pt-BR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : ''}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Nova janela: seleção de Unidade de Medida */}
      {showUnitModal && (
        <div className="fixed inset-0 z-[70] bg-[#1A1A72]/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white max-w-lg w-full rounded-xl border border-slate-200 shadow-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#E63946]">straighten</span>
                <h3 className="font-display text-base font-bold text-[#1A1A72] uppercase tracking-wide">
                  Unidades de Medida
                </h3>
              </div>
              <button
                onClick={() => setShowUnitModal(false)}
                className="text-slate-400 hover:text-slate-700 font-bold text-xl"
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto px-6 py-4 space-y-5">
              {UNIT_GROUPS.map((g) => (
                <div key={g.group}>
                  <p className="font-display text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    {g.group}
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {g.units.map((u) => {
                      const value = `${u.code} — ${u.label}`;
                      const selected = unit === value;
                      return (
                        <button
                          key={u.code}
                          type="button"
                          onClick={() => {
                            setUnit(value);
                            setErrors((p) => ({ ...p, unit: false }));
                            setShowUnitModal(false);
                          }}
                          className={`text-left px-3 py-2 rounded-lg border transition-colors ${
                            selected
                              ? 'border-[#E63946] bg-red-50 text-[#E63946]'
                              : 'border-slate-200 hover:border-[#1A1A72] hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <span className="font-data-mono font-bold text-xs block">{u.code}</span>
                          <span className="text-[10px] text-slate-500">{u.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
