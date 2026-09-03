'use client';
import { showToast, requestConfirm } from '@/components/ui/Feedback';

import React, { useEffect, useState } from 'react';
import { InventoryItem, Supplier, SupplierProduct, PartnerBrand } from '@/lib/types';
import { SidePanel, FormSection, Toggle } from '@/components/SidePanel';
import { DataListRow, RowMeta, Badge, RowAction } from '@/components/DataListRow';
import { fetchCnpjData } from '@/lib/cnpj';
import { removeInstitucionalLogo, resolveLogoDataUrls, uploadInstitucionalLogo } from '@/lib/institucional';
import { normalizeSearch } from '@/lib/stockStatus';
import { deactivateSupplierProduct, fetchSupplierProducts, upsertSupplierProduct } from '@/lib/supplierProducts';

const supplierStatusColor = (status: Supplier['activeStatus']) =>
  status === 'HOMOLOGADO' ? 'emerald' : status === 'EM AVALIACAO' ? 'amber' : 'red';

interface FornecedoresViewProps {
  suppliers: Supplier[];
  inventory: InventoryItem[];
  partnerBrands: PartnerBrand[];
  onAddBrand?: (name: string) => void;
  onAddSupplier: (s: Supplier) => void;
  onUpdateSupplier?: (s: Supplier) => void;
  onDeleteSupplier?: (id: string) => void;
}

let fornSeq = 10;

const inputCls =
  'w-full border border-border rounded-lg p-2.5 text-fg bg-surface focus:outline-none focus:ring-2 focus:ring-danger/20 focus:border-danger/40';
const labelCls = 'block text-fg-secondary mb-1 font-semibold uppercase text-[11px]';

export const FornecedoresView: React.FC<FornecedoresViewProps> = ({
  suppliers,
  inventory,
  partnerBrands,
  onAddBrand,
  onAddSupplier,
  onUpdateSupplier,
  onDeleteSupplier,
}) => {
  const [showPanel, setShowPanel] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);

  // Form State
  const [isPJ, setIsPJ] = useState(true);
  const [name, setName] = useState('');
  const [cnpj, setCNPJ] = useState('');
  const [category, setCategory] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  const [stateUf, setStateUf] = useState('');
  const [consultingCnpj, setConsultingCnpj] = useState(false);
  const [logoPath, setLogoPath] = useState('');
  const [logoUrls, setLogoUrls] = useState<Record<string, string>>({});
  const [contacts, setContacts] = useState<NonNullable<Supplier['contacts']>>([]);
  const [areas, setAreas] = useState<string[]>([]);
  const [pickupAvailable, setPickupAvailable] = useState(false);
  const [carrier, setCarrier] = useState('');
  const [freightMode, setFreightMode] = useState('');
  const [logisticsNotes, setLogisticsNotes] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [minimumOrderValue, setMinimumOrderValue] = useState('');
  const [standardDiscount, setStandardDiscount] = useState('');
  const [freightPolicy, setFreightPolicy] = useState('');
  const [quoteValidityDays, setQuoteValidityDays] = useState('');
  const [commercialNotes, setCommercialNotes] = useState('');
  const [homologatedAt, setHomologatedAt] = useState('');
  const [homologatedBy, setHomologatedBy] = useState('');
  const [homologationValidUntil, setHomologationValidUntil] = useState('');
  const [homologationNotes, setHomologationNotes] = useState('');
  const [supplierProducts, setSupplierProducts] = useState<SupplierProduct[]>([]);
  const [productQuery, setProductQuery] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [productCost, setProductCost] = useState('');
  const [productLeadTime, setProductLeadTime] = useState('');
  const [productMinimumQty, setProductMinimumQty] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [city, setCity] = useState('');
  const [leadTimeDays, setLeadTimeDays] = useState(0);
  const [brands, setBrands] = useState<string[]>([]);

  const [novaMarca, setNovaMarca] = useState('');
  useEffect(() => {
    let active = true;
    resolveLogoDataUrls(suppliers.map((supplier) => supplier.logoPath || '').filter(Boolean)).then((urls) => { if (active) setLogoUrls(urls); }).catch(() => {});
    return () => { active = false; };
  }, [suppliers]);
  useEffect(() => {
    if (!editing?.id) { setSupplierProducts([]); return; }
    fetchSupplierProducts(editing.id).then(setSupplierProducts).catch(() => setSupplierProducts([]));
  }, [editing?.id]);
  const availableAreas = Array.from(new Set(inventory.map((item) => item.category?.trim()).filter((value): value is string => Boolean(value)))).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const [brandHint, setBrandHint] = useState('');

  const normalizeBrand = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/gi, '').toLowerCase();

  const toggleBrand = (nome: string) =>
    setBrands((prev) => (prev.includes(nome) ? prev.filter((b) => b !== nome) : [...prev, nome]));

  const adicionarMarcaExistente = () => {
    const nome = novaMarca.trim();
    if (!nome) return;
    const existing = partnerBrands.find((brand) => normalizeBrand(brand.name) === normalizeBrand(nome));
    if (!existing) { setBrandHint('Marca não encontrada. Use “Cadastrar novo fabricante” após confirmar os dados.'); return; }
    setBrands((prev) => (prev.some((brand) => normalizeBrand(brand) === normalizeBrand(existing.name)) ? prev : [...prev, existing.name]));
    setNovaMarca('');
    setBrandHint('');
  };
  const cadastrarNovoFabricante = async () => {
    const nome = novaMarca.trim();
    if (!nome || !onAddBrand) return;
    const existing = partnerBrands.find((brand) => normalizeBrand(brand.name) === normalizeBrand(nome));
    if (existing) { setBrandHint(`A marca já existe como “${existing.name}”. Ela foi selecionada.`); setBrands((prev) => prev.includes(existing.name) ? prev : [...prev, existing.name]); return; }
    if (!await requestConfirm(`Cadastrar o fabricante “${nome}” no catálogo global?\n\nConfira a grafia antes de continuar para evitar duplicidade.`)) return;
    onAddBrand(nome);
    setBrands((prev) => [...prev, nome]);
    setNovaMarca('');
    setBrandHint('Fabricante cadastrado e selecionado.');
  };

  const openPanel = () => {
    setEditing(null);
    setIsPJ(true);
    setName('');
    setCNPJ('');
    setCategory('');
    setTradeName(''); setZipCode(''); setStreet(''); setNumber(''); setNeighborhood(''); setStateUf(''); setLogoPath(''); setContacts([]); setAreas([]);
    setPickupAvailable(false); setCarrier(''); setFreightMode(''); setLogisticsNotes(''); setPaymentTerms(''); setMinimumOrderValue(''); setStandardDiscount(''); setFreightPolicy(''); setQuoteValidityDays(''); setCommercialNotes(''); setHomologatedAt(''); setHomologatedBy(''); setHomologationValidUntil(''); setHomologationNotes('');
    setContactName('');
    setPhone('');
    setEmail('');
    setCity('');
    setLeadTimeDays(0);
    setBrands([]);
    setShowPanel(true);
  };

  const openEdit = (s: Supplier) => {
    setEditing(s);
    setIsPJ(true);
    setName(s.name);
    setCNPJ(s.cnpj);
    setCategory(s.category);
    setTradeName(s.tradeName || ''); setZipCode(s.address?.zipCode || ''); setStreet(s.address?.street || ''); setNumber(s.address?.number || ''); setNeighborhood(s.address?.neighborhood || ''); setStateUf(s.address?.state || ''); setLogoPath(s.logoPath || ''); setContacts(s.contacts?.length ? s.contacts : (s.contactName || s.phone || s.email ? [{ name: s.contactName, phone: s.phone, email: s.email, primary: true, role: 'Principal' }] : [])); setAreas(s.areas ?? []);
    setPickupAvailable(s.logistics?.pickupAvailable ?? false); setCarrier(s.logistics?.carrier || ''); setFreightMode(s.logistics?.freightMode || ''); setLogisticsNotes(s.logistics?.notes || ''); setPaymentTerms(s.commercial?.paymentTerms || ''); setMinimumOrderValue(s.commercial?.minimumOrderValue?.toString() || ''); setStandardDiscount(s.commercial?.standardDiscount?.toString() || ''); setFreightPolicy(s.commercial?.freightPolicy || ''); setQuoteValidityDays(s.commercial?.quoteValidityDays?.toString() || ''); setCommercialNotes(s.commercial?.notes || ''); setHomologatedAt(s.homologation?.homologatedAt || ''); setHomologatedBy(s.homologation?.homologatedBy || ''); setHomologationValidUntil(s.homologation?.validUntil || ''); setHomologationNotes(s.homologation?.notes || '');
    setContactName(s.contactName);
    setPhone(s.phone);
    setEmail(s.email);
    setCity(s.city);
    setLeadTimeDays(s.leadTimeDays);
    setBrands(s.brands ?? []);
    setShowPanel(true);
  };

  const handleDelete = async (s: Supplier) => {
    if (!onDeleteSupplier) return;
    try {
      const linked = await fetchSupplierProducts(s.id);
      if (linked.length) {
        if (await requestConfirm(`Este fornecedor possui ${linked.length} vínculo(s) de produto. Para preservar o histórico, ele será suspenso em vez de excluído. Continuar?`)) onUpdateSupplier?.({ ...s, activeStatus: 'SUSPENSO' });
        return;
      }
    } catch { /* Sem acesso ao vínculo, mantém a confirmação de exclusão normal. */ }
    if (await requestConfirm(`Excluir o fornecedor "${s.name}"?\n\nEsta ação não pode ser desfeita.`)) onDeleteSupplier(s.id);
  };

  const consultCnpj = async () => {
    if (!cnpj.trim()) return;
    setConsultingCnpj(true);
    try {
      const found = await fetchCnpjData(cnpj);
      const summary = [found.razaoSocial && `Razão social: ${found.razaoSocial}`, found.nomeFantasia && `Fantasia: ${found.nomeFantasia}`, found.cidadeUf && `Cidade/UF: ${found.cidadeUf}`].filter(Boolean).join('\n');
      if (!await requestConfirm(`Dados encontrados:\n\n${summary}\n\nDeseja preencher os campos disponíveis? Campos já preenchidos serão atualizados somente com esta confirmação.`)) return;
      if (found.razaoSocial) setName(found.razaoSocial);
      if (found.nomeFantasia) setTradeName(found.nomeFantasia);
      if (found.cep) setZipCode(found.cep);
      if (found.logradouro) setStreet(found.logradouro);
      if (found.email) setEmail(found.email);
      if (found.telefone) setPhone(found.telefone);
      if (found.cidadeUf) { const [cityValue, ufValue] = found.cidadeUf.split('/'); setCity(cityValue?.trim() || ''); setStateUf(ufValue?.trim() || ''); }
      if (found.cnaeDescricao && !category) setCategory(found.cnaeDescricao);
    } catch (error) { showToast(error instanceof Error ? error.message : 'Não foi possível consultar o CNPJ.'); }
    finally { setConsultingCnpj(false); }
  };
  const uploadLogo = async (file?: File) => {
    if (!file) return;
    try { setLogoPath(await uploadInstitucionalLogo(file, `supplier_${editing?.id || name || Date.now()}`)); }
    catch { showToast('Não foi possível enviar o logo.'); }
  };
  const structuredFields = () => ({
    tradeName,
    logoPath: logoPath || undefined,
    contacts: contacts.filter((contact) => contact.name.trim() || contact.phone || contact.email),
    areas,
    address: { zipCode, street, number, neighborhood, city, state: stateUf },
    logistics: { pickupAvailable, carrier: carrier || undefined, freightMode: freightMode || undefined, notes: logisticsNotes || undefined },
    commercial: { paymentTerms: paymentTerms || undefined, minimumOrderValue: minimumOrderValue ? Number(minimumOrderValue) : undefined, standardDiscount: standardDiscount ? Number(standardDiscount) : undefined, freightPolicy: freightPolicy || undefined, quoteValidityDays: quoteValidityDays ? Number(quoteValidityDays) : undefined, notes: commercialNotes || undefined },
    homologation: { homologatedAt: homologatedAt || undefined, homologatedBy: homologatedBy || undefined, validUntil: homologationValidUntil || undefined, notes: homologationNotes || undefined },
  });
  const saveSupplierProduct = async () => {
    if (!editing || !selectedProductId) return;
    const selected = inventory.find((item) => item.id === selectedProductId);
    if (!selected) return;
    const existing = supplierProducts.find((item) => item.inventoryItemId === selected.id);
    try {
      const saved = await upsertSupplierProduct({ id: existing?.id || `sp_${Date.now()}`, supplierId: editing.id, inventoryItemId: selected.id, supplierCode: selected.code, supplierDescription: selected.name, cost: productCost ? Number(productCost) : undefined, leadTimeDays: productLeadTime ? Number(productLeadTime) : undefined, minimumOrderQty: productMinimumQty ? Number(productMinimumQty) : undefined, active: true });
      setSupplierProducts((items) => [saved, ...items.filter((item) => item.id !== saved.id)]);
      setSelectedProductId(''); setProductQuery(''); setProductCost(''); setProductLeadTime(''); setProductMinimumQty('');
    } catch { showToast('Não foi possível salvar o vínculo do produto. Verifique se a migration 0058 foi aplicada.'); }
  };
  const deactivateProduct = async (product: SupplierProduct) => {
    try { await deactivateSupplierProduct(product.id); setSupplierProducts((items) => items.map((item) => item.id === product.id ? { ...item, active: false } : item)); }
    catch { showToast('Não foi possível desativar o vínculo.'); }
  };

  const handleCreateSupplier = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim()) return;
    if (editing) {
      onUpdateSupplier?.({
        ...editing,
        name,
        cnpj,
        category,
        contactName,
        phone,
        email,
        city,
        leadTimeDays: Number(leadTimeDays),
        brands,
        ...structuredFields(),
      });
      setShowPanel(false);
      setEditing(null);
      return;
    }
    const seq = (fornSeq++).toString();
    const created: Supplier = {
      id: `forn-${seq}`,
      code: `FORN-0${seq}`,
      name,
      cnpj,
      category,
      contactName,
      phone,
      email,
      city,
      rating: 4.8,
      leadTimeDays: Number(leadTimeDays),
      activeStatus: 'HOMOLOGADO',
      brands,
      ...structuredFields(),
    };
    onAddSupplier(created);
    setShowPanel(false);
  };

  return (
    <div className="flex flex-col w-full p-4 md:p-8 gap-5 md:gap-6">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-border pb-5">
        <div>
          <span className="text-xs font-semibold text-fg-secondary uppercase tracking-wider">
            Gestão de Cadeia de Suprimentos &amp; Homologação
          </span>
          <h1 className="text-2xl font-bold text-fg tracking-tight mt-0.5">
            Fornecedores &amp; Parceiros Homologados
          </h1>
        </div>

        <button
          onClick={openPanel}
          className="bg-danger hover:bg-danger-hover text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm flex items-center gap-1.5 uppercase tracking-wide"
        >
          <span className="material-symbols-outlined text-base">add</span> Novo Fornecedor
        </button>
      </div>

      {/* Lista de fornecedores */}
      {suppliers.length === 0 ? (
        <div className="bg-surface rounded-xl shadow-sm py-16 text-center text-fg-muted">
          <span className="material-symbols-outlined text-4xl text-fg-muted">local_shipping</span>
          <p className="mt-2 text-sm font-bold text-fg-secondary uppercase tracking-wider">Nenhum fornecedor cadastrado</p>
          <p className="text-xs text-fg-muted mt-1">Clique em &quot;Novo Fornecedor&quot; para homologar o primeiro.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {suppliers.map((s) => (
            <DataListRow
              key={s.id}
              leading={s.logoPath && logoUrls[s.logoPath] ? <span className="w-10 h-10 bg-surface border border-border rounded-lg p-1 shrink-0"><img src={logoUrls[s.logoPath]} alt={`Logo ${s.tradeName || s.name}`} className="w-full h-full object-contain" /></span> : <span className="w-10 h-10 bg-navy text-white font-bold rounded-lg flex items-center justify-center text-xs shrink-0">{(s.tradeName || s.name).slice(0, 2).toUpperCase()}</span>}
              title={<span className="uppercase">{s.tradeName || s.name}</span>}
              meta={
                <>
                  <RowMeta label="Cód" value={<span className="font-data-mono">{s.code}</span>} />
                  {s.tradeName && <RowMeta label="Razão social" value={s.name} />}
                  <RowMeta label="CNPJ" value={<span className="font-data-mono">{s.cnpj}</span>} />
                  <RowMeta label="Categoria" value={s.category} />
                  <RowMeta label="Cidade" value={s.city} />
                  {s.address?.state && <RowMeta label="UF" value={s.address.state} />}
                </>
              }
              center={
                <div className="text-left md:text-center">
                  <p className="text-fg-secondary font-semibold">{s.contactName}</p>
                  <p className="text-[10px] text-fg-secondary font-data-mono">{s.phone}</p>
                  <p className="text-[10px] text-amber-600 font-bold mt-0.5">
                    ★ {s.rating.toFixed(1)} · {s.leadTimeDays}d
                  </p>
                </div>
              }
              right={
                <>
                  <Badge color={supplierStatusColor(s.activeStatus)}>{s.activeStatus}</Badge>
                  <div className="flex items-center gap-1">
                    <RowAction
                      icon="mail"
                      label="Enviar e-mail ao fornecedor"
                      onClick={() => {
                        window.location.href = `mailto:${s.email}`;
                      }}
                    />
                    <RowAction icon="edit" label="Editar fornecedor" onClick={() => openEdit(s)} />
                    <RowAction icon="delete" label="Excluir fornecedor" danger onClick={() => handleDelete(s)} />
                  </div>
                </>
              }
            />
          ))}
        </div>
      )}

      {/* Drawer: Novo / Editar Fornecedor */}
      <SidePanel
        open={showPanel}
        title={editing ? 'Editar fornecedor' : 'Novo fornecedor'}
        subtitle={editing ? editing.code : 'Cadastro e homologação'}
        onClose={() => {
          setShowPanel(false);
          setEditing(null);
        }}
        onSave={() => handleCreateSupplier()}
        saveLabel="Salvar"
      >
        <form onSubmit={handleCreateSupplier} className="space-y-5 text-xs font-medium">
          {/* Bloco: Dados da empresa */}
          <FormSection
            icon="apartment"
            title="Dados da empresa"
            action={<Toggle checked={isPJ} onChange={setIsPJ} label={isPJ ? 'Pessoa jurídica' : 'Pessoa física'} />}
          >
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Razão social / Nome *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex.: Siemens Building Technologies"
                  className={inputCls}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>{isPJ ? 'CNPJ' : 'CPF'}</label>
                  <div className="flex gap-1.5"><input
                    type="text"
                    value={cnpj}
                    onChange={(e) => setCNPJ(e.target.value)}
                    placeholder={isPJ ? '00.000.000/0001-00' : '000.000.000-00'}
                    className={`${inputCls} font-data-mono`}
                  /><button type="button" onClick={() => void consultCnpj()} disabled={consultingCnpj || cnpj.replace(/\D/g, '').length !== 14} className="px-2 rounded-lg border border-primary text-primary text-[10px] font-bold disabled:opacity-40">{consultingCnpj ? '...' : 'Consultar'}</button></div>
                </div>
                <div>
                  <label className={labelCls}>Categoria</label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="Ex.: Centrais & Detecção"
                    className={inputCls}
                  />
                </div>
              </div>
            </div>
          </FormSection>

          <FormSection icon="badge" title="Nome de exibição">
            <label className={labelCls}>Nome fantasia</label><input value={tradeName} onChange={(e) => setTradeName(e.target.value)} placeholder="Ex.: Fire & Segurança Distribuidora" className={inputCls} />
          </FormSection>

          <FormSection icon="category" title="Áreas de fornecimento">
            <p className="text-[11px] text-fg-secondary mb-2">As opções são derivadas das categorias já existentes no catálogo técnico.</p>
            <div className="flex flex-wrap gap-1.5">{availableAreas.length ? availableAreas.map((area) => <button key={area} type="button" onClick={() => setAreas((current) => current.includes(area) ? current.filter((value) => value !== area) : [...current, area])} className={`px-2.5 py-1 rounded-full border text-[11px] font-semibold ${areas.includes(area) ? 'bg-navy text-white border-primary' : 'bg-surface text-fg-secondary border-border'}`}>{areas.includes(area) ? '✓ ' : ''}{area}</button>) : <span className="text-[11px] text-fg-muted">Cadastre categorias no catálogo para disponibilizá-las aqui.</span>}</div>
          </FormSection>

          <FormSection icon="image" title="Logo">
            <div className="flex items-center gap-3"><span className="w-14 h-14 rounded-lg border border-border flex items-center justify-center overflow-hidden">{logoPath && logoUrls[logoPath] ? <img src={logoUrls[logoPath]} alt="Logo" className="w-full h-full object-contain" /> : <span className="font-bold text-primary">{(tradeName || name || 'FO').slice(0, 2).toUpperCase()}</span>}</span><label className="px-3 py-2 rounded-lg border border-primary text-primary text-[11px] font-bold cursor-pointer">Enviar / substituir<input type="file" accept="image/*,.svg" className="hidden" onChange={(e) => void uploadLogo(e.target.files?.[0])} /></label>{logoPath && <button type="button" onClick={() => { void removeInstitucionalLogo(logoPath).catch(() => {}); setLogoPath(''); }} className="text-[11px] font-semibold text-red-600">Remover</button>}</div>
          </FormSection>

          <FormSection icon="location_on" title="Endereço">
            <div className="grid grid-cols-2 gap-3"><div><label className={labelCls}>CEP</label><input value={zipCode} onChange={(e) => setZipCode(e.target.value)} className={inputCls} /></div><div><label className={labelCls}>UF</label><input value={stateUf} onChange={(e) => setStateUf(e.target.value.toUpperCase())} maxLength={2} className={inputCls} /></div></div>
            <div className="grid grid-cols-[1fr_7rem] gap-3 mt-3"><div><label className={labelCls}>Logradouro</label><input value={street} onChange={(e) => setStreet(e.target.value)} className={inputCls} /></div><div><label className={labelCls}>Número</label><input value={number} onChange={(e) => setNumber(e.target.value)} className={inputCls} /></div></div>
            <div className="mt-3"><label className={labelCls}>Bairro</label><input value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} className={inputCls} /></div>
          </FormSection>

          <FormSection icon="group" title="Contatos adicionais">
            <div className="space-y-2">{contacts.map((contact, index) => <div key={index} className="grid grid-cols-2 gap-2 border border-border rounded-lg p-2"><input value={contact.name} onChange={(e) => setContacts((list) => list.map((item, i) => i === index ? { ...item, name: e.target.value } : item))} placeholder="Nome" className={inputCls} /><input value={contact.role || ''} onChange={(e) => setContacts((list) => list.map((item, i) => i === index ? { ...item, role: e.target.value } : item))} placeholder="Função" className={inputCls} /><input value={contact.phone || ''} onChange={(e) => setContacts((list) => list.map((item, i) => i === index ? { ...item, phone: e.target.value } : item))} placeholder="Telefone" className={inputCls} /><input value={contact.email || ''} onChange={(e) => setContacts((list) => list.map((item, i) => i === index ? { ...item, email: e.target.value } : item))} placeholder="E-mail" className={inputCls} /><button type="button" onClick={() => setContacts((list) => list.map((item, i) => ({ ...item, primary: i === index })))} className={`text-[10px] font-bold ${contact.primary ? 'text-emerald-700' : 'text-fg-muted'}`}>{contact.primary ? 'Principal' : 'Definir principal'}</button><button type="button" onClick={() => setContacts((list) => list.filter((_, i) => i !== index))} className="text-[10px] font-bold text-red-600">Remover</button></div>)}</div><button type="button" onClick={() => setContacts((list) => [...list, { name: '', role: 'Comercial' }])} className="mt-2 text-[11px] font-bold text-primary">+ Adicionar contato</button>
          </FormSection>

          {/* Bloco: Contatos */}
          <FormSection icon="contacts" title="Contatos">
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Contato principal</label>
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Nome do responsável"
                  className={inputCls}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Telefone</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(00) 0000-0000"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>E-mail comercial</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vendas@fornecedor.com"
                    className={inputCls}
                  />
                </div>
              </div>
            </div>
          </FormSection>

          {/* Bloco: Logística & homologação */}
          <FormSection icon="local_shipping" title="Logística">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Cidade / UF</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Londrina / PR"
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Prazo de entrega (dias)</label>
                <input
                  type="number"
                  min={0}
                  value={leadTimeDays}
                  onChange={(e) => setLeadTimeDays(Number(e.target.value))}
                  className={`${inputCls} font-data-mono`}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3"><div><label className={labelCls}>Transportadora preferida</label><input value={carrier} onChange={(e) => setCarrier(e.target.value)} className={inputCls} /></div><div><label className={labelCls}>Modal de frete</label><input value={freightMode} onChange={(e) => setFreightMode(e.target.value)} placeholder="CIF, FOB..." className={inputCls} /></div></div>
            <div className="mt-3"><Toggle checked={pickupAvailable} onChange={setPickupAvailable} label="Retirada disponível" /></div>
            <div className="mt-3"><label className={labelCls}>Observações logísticas</label><textarea value={logisticsNotes} onChange={(e) => setLogisticsNotes(e.target.value)} rows={2} className={inputCls} /></div>
          </FormSection>

          <FormSection icon="payments" title="Condições comerciais">
            <div className="grid grid-cols-2 gap-3"><div><label className={labelCls}>Pagamento</label><input value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} placeholder="28 dias" className={inputCls} /></div><div><label className={labelCls}>Pedido mínimo (R$)</label><input type="number" min="0" value={minimumOrderValue} onChange={(e) => setMinimumOrderValue(e.target.value)} className={inputCls} /></div><div><label className={labelCls}>Desconto padrão (%)</label><input type="number" min="0" value={standardDiscount} onChange={(e) => setStandardDiscount(e.target.value)} className={inputCls} /></div><div><label className={labelCls}>Validade da cotação (dias)</label><input type="number" min="0" value={quoteValidityDays} onChange={(e) => setQuoteValidityDays(e.target.value)} className={inputCls} /></div></div>
            <div className="mt-3"><label className={labelCls}>Política de frete</label><input value={freightPolicy} onChange={(e) => setFreightPolicy(e.target.value)} className={inputCls} /></div><div className="mt-3"><label className={labelCls}>Observações comerciais</label><textarea value={commercialNotes} onChange={(e) => setCommercialNotes(e.target.value)} rows={2} className={inputCls} /></div>
          </FormSection>

          <FormSection icon="verified" title="Homologação">
            <div className="grid grid-cols-2 gap-3"><div><label className={labelCls}>Homologado em</label><input type="date" value={homologatedAt} onChange={(e) => setHomologatedAt(e.target.value)} className={inputCls} /></div><div><label className={labelCls}>Válido até</label><input type="date" value={homologationValidUntil} onChange={(e) => setHomologationValidUntil(e.target.value)} className={inputCls} /></div></div>
            <div className="mt-3"><label className={labelCls}>Responsável</label><input value={homologatedBy} onChange={(e) => setHomologatedBy(e.target.value)} className={inputCls} /></div><div className="mt-3"><label className={labelCls}>Observações</label><textarea value={homologationNotes} onChange={(e) => setHomologationNotes(e.target.value)} rows={2} className={inputCls} /></div>
          </FormSection>

          <FormSection icon="sell" title="Marcas que trabalha">
            <p className="text-[11px] text-fg-secondary mb-2">
              Selecione fabricantes já cadastrados. O cadastro de um novo fabricante é uma ação separada, com confirmação e proteção contra variações de grafia.
            </p>
            {/* Digitar nova marca */}
            <div className="flex gap-1.5 mb-2">
              <input
                type="text"
                value={novaMarca}
                onChange={(e) => setNovaMarca(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); adicionarMarcaExistente(); }
                }}
                placeholder="Ex.: Bosch, Notifier, Intelbras…"
                className={inputCls}
              />
              <button
                type="button"
                onClick={adicionarMarcaExistente}
                disabled={!novaMarca.trim()}
                className="shrink-0 px-3 rounded-lg bg-navy hover:bg-navy-3 text-white text-[11px] font-bold uppercase disabled:opacity-40"
              >
                Selecionar
              </button>
              <button type="button" onClick={cadastrarNovoFabricante} disabled={!novaMarca.trim() || !onAddBrand} className="shrink-0 px-3 rounded-lg border border-primary text-primary hover:bg-navy/5 text-[11px] font-bold uppercase disabled:opacity-40">Cadastrar novo fabricante</button>
            </div>
            {brandHint && <p className="text-[11px] text-amber-700 mb-2">{brandHint}</p>}
            {/* Chips: união das marcas do catálogo + as já selecionadas (mostra a recém-digitada na hora) */}
            {(() => {
              const todas = Array.from(new Set([...partnerBrands.map((b) => b.name), ...brands]));
              if (todas.length === 0) {
                return <p className="text-[11px] text-fg-muted italic">Nenhuma marca cadastrada. Use o botão específico acima para cadastrar a primeira.</p>;
              }
              return (
                <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                  {todas.map((nome) => {
                    const on = brands.includes(nome);
                    return (
                      <button
                        key={nome}
                        type="button"
                        onClick={() => toggleBrand(nome)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${
                          on
                            ? 'bg-navy text-white border-primary'
                            : 'bg-surface text-fg-secondary border-border hover:border-primary'
                        }`}
                      >
                        {on ? '✓ ' : ''}{nome}
                      </button>
                    );
                  })}
                </div>
              );
            })()}
            {brands.length > 0 && <p className="text-[10px] text-fg-muted mt-2">{brands.length} marca(s) selecionada(s).</p>}
          </FormSection>

          {editing && <FormSection icon="inventory_2" title="Produtos fornecidos">
            <p className="text-[11px] text-fg-secondary mb-2">Vincule somente itens já cadastrados no catálogo. Isto não altera preço, custo ou saldo do estoque mestre.</p>
            <input value={productQuery} onChange={(e) => { setProductQuery(e.target.value); setSelectedProductId(''); }} placeholder="Buscar por código, produto, marca ou modelo" className={inputCls} />
            {productQuery.trim() && !selectedProductId && <div className="mt-1 max-h-32 overflow-y-auto border border-border rounded-lg">{inventory.filter((item) => normalizeSearch(`${item.code} ${item.name} ${item.brand || ''} ${item.model || ''}`).includes(normalizeSearch(productQuery))).slice(0, 8).map((item) => <button key={item.id} type="button" onClick={() => { setSelectedProductId(item.id); setProductQuery(`${item.code} — ${item.name}`); }} className="w-full text-left px-3 py-2 hover:bg-surface-2 border-b border-border last:border-0"><span className="font-data-mono text-[10px] text-primary">{item.code}</span> <span className="text-[11px]">{item.name}</span></button>)}</div>}
            {selectedProductId && <div className="grid grid-cols-3 gap-2 mt-2"><input value={productCost} onChange={(e) => setProductCost(e.target.value)} type="number" min="0" placeholder="Custo R$" className={inputCls} /><input value={productLeadTime} onChange={(e) => setProductLeadTime(e.target.value)} type="number" min="0" placeholder="Prazo dias" className={inputCls} /><input value={productMinimumQty} onChange={(e) => setProductMinimumQty(e.target.value)} type="number" min="0" placeholder="Qtd mínima" className={inputCls} /><button type="button" onClick={() => void saveSupplierProduct()} className="col-span-3 px-3 py-2 rounded-lg bg-navy text-white text-[11px] font-bold">Vincular produto</button></div>}
            <div className="mt-3 space-y-1.5">{supplierProducts.length === 0 ? <p className="text-[11px] text-fg-muted">Nenhum produto vinculado.</p> : supplierProducts.map((link) => { const item = inventory.find((current) => current.id === link.inventoryItemId); return <div key={link.id} className="flex items-center justify-between gap-2 border border-border rounded-lg p-2"><div className="min-w-0"><p className={`text-[11px] font-semibold truncate ${link.active ? 'text-fg-secondary' : 'text-fg-muted line-through'}`}>{item?.name || link.supplierDescription || link.inventoryItemId}</p><p className="text-[10px] text-fg-secondary">{link.supplierCode || item?.code || 'Sem código'} · {link.cost != null ? `R$ ${link.cost.toFixed(2)}` : 'Custo não informado'} · {link.leadTimeDays ?? '—'} dias</p></div>{link.active && <button type="button" onClick={() => void deactivateProduct(link)} className="text-[10px] font-bold text-red-600">Desativar</button>}</div>; })}</div>
          </FormSection>}

          {/* submit oculto: permite salvar com Enter */}
          <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
        </form>
      </SidePanel>
    </div>
  );
};
