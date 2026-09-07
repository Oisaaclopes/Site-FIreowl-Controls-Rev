'use client';
import React, { useState } from 'react';
import { Client, Contract, UserRole } from '@/lib/types';
import { nextContractNumero } from '@/lib/contracts';

/* =====================================================================
 * ContractForm — formulário ÚNICO de criação/edição de contrato, extraído
 * fielmente do ContratosView (sem alterar textos, layout, campos ou regras).
 * Reutilizado no módulo global e no Cliente 360. Persistência-agnóstico:
 * monta o payload e chama onSaved (o host persiste). `lockClientId` fixa o
 * cliente (Cliente 360). Mesma implementação em ambos os contextos.
 * ===================================================================== */

const labelCls = 'block text-fg-secondary mb-1 font-semibold uppercase text-[11px]';
const inputCls = 'w-full border border-border rounded-lg p-2.5 text-fg bg-surface focus:outline-none focus:ring-2 focus:ring-danger/20 focus:border-danger/40';
const _labelCls = labelCls;
const _inputCls = inputCls;

const AREAS_COBERTAS = ['SDAI', 'CFTV', 'BMS / Automação', 'Alarme / Intrusão', 'Controle de Acesso', 'Iluminação de Emergência', 'Pressurização'];
const TIPOS_ATENDIMENTO = ['Preventiva', 'Corretiva', 'Emergencial', 'Inspeção', 'Operação', 'Suporte remoto'];
const MATERIAIS_POLITICAS = [
  { v: 'inclusos', l: 'Materiais inclusos' },
  { v: 'nao_inclusos', l: 'Materiais não inclusos' },
  { v: 'limite', l: 'Inclusos até um limite' },
  { v: 'so_mao_de_obra', l: 'Somente mão de obra' },
  { v: 'mediante_aprovacao', l: 'Fornecimento mediante aprovação' },
];

const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

/** Converte "2026-12-30" (input date) para "30 DEZ 2026" (padrão exibido). */
const formatDateBR = (iso: string): string => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const meses = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
  return `${String(d).padStart(2, '0')} ${meses[m - 1]} ${y}`;
};
const parseBRtoISO = (s?: string): string => {
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const meses: Record<string, string> = { JAN: '01', FEV: '02', MAR: '03', ABR: '04', MAI: '05', JUN: '06', JUL: '07', AGO: '08', SET: '09', OUT: '10', NOV: '11', DEZ: '12' };
  const m = s.trim().toUpperCase().match(/^(\d{1,2})\s+([A-Z]{3})\s+(\d{4})$/);
  if (m && meses[m[2]]) return `${m[3]}-${meses[m[2]]}-${m[1].padStart(2, '0')}`;
  return '';
};

/** Multi-select por chips. */
const Chips: React.FC<{ options: string[]; selected: string[]; onToggle: (v: string) => void }> = ({ options, selected, onToggle }) => (
  <div className="flex flex-wrap gap-2">
    {options.map((o) => {
      const on = selected.includes(o);
      return (
        <button key={o} type="button" onClick={() => onToggle(o)} className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-colors ${on ? 'bg-navy-3 text-white border-navy' : 'bg-surface text-fg-secondary border-border-strong hover:border-navy'}`}>{o}</button>
      );
    })}
  </div>
);

/** Editor de lista de strings. */
const StrList: React.FC<{ items: string[]; onChange: (v: string[]) => void; addLabel: string; placeholder?: string }> = ({ items, onChange, addLabel, placeholder }) => (
  <div className="space-y-2">
    {items.map((it, i) => (
      <div key={i} className="flex items-center gap-2">
        <input value={it} onChange={(e) => onChange(items.map((x, idx) => (idx === i ? e.target.value : x)))} placeholder={placeholder} className={`flex-1 ${_inputCls}`} />
        <button type="button" onClick={() => onChange(items.filter((_, idx) => idx !== i))} className="p-1.5 text-fg-muted hover:text-danger hover:bg-red-50 rounded-lg shrink-0"><span className="material-symbols-outlined text-base">delete</span></button>
      </div>
    ))}
    <button type="button" onClick={() => onChange([...items, ''])} className="w-full py-2 rounded-lg border border-dashed border-navy/40 text-[11px] font-semibold text-primary hover:bg-navy-3/5 uppercase">+ {addLabel}</button>
  </div>
);

/** Seção do cadastro. */
const FormSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="rounded-xl border border-border p-4">
    <p className="text-[11px] font-bold uppercase tracking-wider text-primary mb-3">{title}</p>
    {children}
  </div>
);

export interface ContractFormProps {
  clients: Client[];
  contracts: Contract[];
  /** Contrato para edição; ausente/null = criação. */
  contract?: Contract | null;
  /** Cliente fixo (Cliente 360): trava o seletor de cliente. */
  lockClientId?: string;
  userRole?: UserRole;
  onSaved: (contract: Contract) => void;
  onCancel: () => void;
}

export const ContractForm: React.FC<ContractFormProps> = ({ clients, contracts, contract, lockClientId, onSaved, onCancel }) => {
  const editing = !!contract;
  const initialClientId = lockClientId || contract?.clientId || clients[0]?.id || '';
  const initialClient = clients.find((c) => c.id === initialClientId) || null;

  const [fClientId, setFClientId] = useState(initialClientId);
  const [fUnit, setFUnit] = useState(contract?.unit || initialClient?.address || '');
  const [fScope, setFScope] = useState(contract?.contractType || 'Manutenção Preventiva + Corretiva SDAI');
  const [fMonthly, setFMonthly] = useState(contract?.monthlyValue ?? 15000);
  const [fStatus, setFStatus] = useState<Contract['status']>(contract?.status || 'ATIVO');
  const [fStartDate, setFStartDate] = useState(parseBRtoISO(contract?.startDate));
  const [fRenewalDate, setFRenewalDate] = useState(parseBRtoISO(contract?.renewalDate));
  const [fIndex, setFIndex] = useState(contract?.readjustmentIndex || 'IPCA (+4.5%)');
  const [fHours, setFHours] = useState(contract?.contractedHours ?? 100);
  const [fPaymentDay, setFPaymentDay] = useState(contract?.paymentDay ?? 10);
  const [fResponsible, setFResponsible] = useState(contract?.responsibleTech || 'Isaac Lopes');
  const [fNumero, setFNumero] = useState(contract?.numero || '');
  const [fRespComercial, setFRespComercial] = useState(contract?.responsavelComercial || '');
  const [fRenovAuto, setFRenovAuto] = useState(!!contract?.renovacaoAutomatica);
  const [fAvisoDias, setFAvisoDias] = useState<number | ''>(contract?.avisoAntecedenciaDias ?? 30);
  const [fReajustePeriodo, setFReajustePeriodo] = useState<number | ''>(contract?.reajustePeriodicidadeMeses ?? 12);
  const [fFaturamento, setFFaturamento] = useState(contract?.faturamento || '');
  const [fObsFinanceiras, setFObsFinanceiras] = useState(contract?.observacoesFinanceiras || '');
  const [fAreas, setFAreas] = useState<string[]>(contract?.areasCobertas || []);
  const [fTiposAtend, setFTiposAtend] = useState<string[]>(contract?.tiposAtendimento || []);
  const [fIncluso, setFIncluso] = useState<string[]>(contract?.incluso || []);
  const [fNaoIncluso, setFNaoIncluso] = useState<string[]>(contract?.naoIncluso || []);
  const [fRespContratada, setFRespContratada] = useState<string[]>(contract?.respContratada || []);
  const [fRespContratante, setFRespContratante] = useState<string[]>(contract?.respContratante || []);
  const [fEntregaveis, setFEntregaveis] = useState<string[]>(contract?.entregaveis || []);
  const [fMateriaisPol, setFMateriaisPol] = useState(contract?.materiaisPolitica || '');
  const [fMateriaisObs, setFMateriaisObs] = useState(contract?.materiaisObs || '');
  const [fSla, setFSla] = useState<{ situacao: string; prazo: string; cobertura?: string }[]>(contract?.sla || []);
  const [fObsOper, setFObsOper] = useState(contract?.observacoesOperacionais || '');

  const selectedClient = clients.find((c) => c.id === fClientId) || null;

  const handleSelectClient = (id: string) => {
    setFClientId(id);
    const c = clients.find((x) => x.id === id);
    if (c) setFUnit(c.address);
  };

  const handleCreateContract = (e: React.FormEvent) => {
    e.preventDefault();
    const client = clients.find((c) => c.id === fClientId);
    if (!client) return;

    const existing = editing ? contract : null;
    const stamp = Date.now().toString(36);
    const clean = (arr: string[]) => arr.map((s) => s.trim()).filter(Boolean);
    onSaved({
      // Preserva o registro histórico ao editar (id, usedHours, art, source, createdAt).
      ...(existing || {}),
      id: existing?.id || `CTR-FOWL-${stamp}`,
      clientName: client.name,
      clientId: client.id,
      unit: fUnit || client.address || 'Unidade Londrina',
      contractType: fScope,
      monthlyValue: Number(fMonthly),
      startDate: formatDateBR(fStartDate),
      renewalDate: formatDateBR(fRenewalDate) || existing?.renewalDate || '30 DEZ 2026',
      readjustmentIndex: fIndex,
      contractedHours: Number(fHours),
      usedHours: existing?.usedHours ?? 0,
      paymentDay: Number(fPaymentDay),
      status: fStatus,
      responsibleTech: fResponsible,
      artDocumentRef: existing?.artDocumentRef || `ART-PR-2026-${stamp}`,
      numero: fNumero.trim() || existing?.numero || nextContractNumero(contracts),
      responsavelComercial: fRespComercial.trim() || undefined,
      renovacaoAutomatica: fRenovAuto,
      avisoAntecedenciaDias: fAvisoDias === '' ? undefined : Number(fAvisoDias),
      reajustePeriodicidadeMeses: fReajustePeriodo === '' ? undefined : Number(fReajustePeriodo),
      faturamento: fFaturamento.trim() || undefined,
      observacoesFinanceiras: fObsFinanceiras.trim() || undefined,
      areasCobertas: fAreas,
      tiposAtendimento: fTiposAtend,
      incluso: clean(fIncluso),
      naoIncluso: clean(fNaoIncluso),
      respContratada: clean(fRespContratada),
      respContratante: clean(fRespContratante),
      entregaveis: clean(fEntregaveis),
      materiaisPolitica: fMateriaisPol || undefined,
      materiaisObs: fMateriaisObs.trim() || undefined,
      sla: fSla.filter((r) => r.situacao.trim() || r.prazo.trim()),
      observacoesOperacionais: fObsOper.trim() || undefined,
    } as Contract);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface max-w-2xl w-full rounded-xl border border-border shadow-2xl relative max-h-[92vh] flex flex-col">
        <div className="flex items-start justify-between p-6 border-b border-border">
          <div>
            <h3 className="text-lg font-bold text-fg uppercase">{editing ? 'Editar Contrato' : 'Novo Contrato Recorrente'}</h3>
            <p className="text-xs text-fg-secondary mt-0.5">Vincule o contrato a um cliente da base e defina as condições comerciais.</p>
          </div>
          <button onClick={onCancel} className="text-fg-muted hover:text-fg-secondary font-bold text-lg leading-none">
            ✕
          </button>
        </div>

        {clients.length === 0 ? (
          <div className="p-8 text-center">
            <span className="material-symbols-outlined text-4xl text-fg-muted">group_off</span>
            <p className="mt-2 text-sm font-bold text-fg-secondary uppercase">Nenhum cliente cadastrado</p>
            <p className="text-xs text-fg-muted mt-1">Cadastre um cliente na aba <strong>Clientes</strong> antes de criar um contrato.</p>
            <button
              onClick={onCancel}
              className="mt-4 px-4 py-2 border border-border text-fg-secondary font-semibold rounded-lg text-xs uppercase hover:bg-surface-2"
            >
              Fechar
            </button>
          </div>
        ) : (
          <form onSubmit={handleCreateContract} className="p-6 space-y-4 text-xs font-medium overflow-y-auto">
            {/* Cliente vinculado */}
            <div>
              <label className={labelCls}>Cliente (base cadastral)</label>
              <select value={fClientId} onChange={(e) => handleSelectClient(e.target.value)} className={inputCls} required disabled={!!lockClientId}>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.cnpj}
                  </option>
                ))}
              </select>
            </div>

            {/* Dados do cliente selecionado (somente leitura) */}
            {selectedClient && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-surface-2 border border-border rounded-lg p-3 text-[11px]">
                <div>
                  <p className="text-fg-muted uppercase tracking-wider">Código</p>
                  <p className="font-data-mono text-fg font-semibold">{selectedClient.code}</p>
                </div>
                <div>
                  <p className="text-fg-muted uppercase tracking-wider">Segmento</p>
                  <p className="text-fg font-semibold">{selectedClient.segment}</p>
                </div>
                <div>
                  <p className="text-fg-muted uppercase tracking-wider">Status cadastral</p>
                  <p className="text-fg font-semibold">{selectedClient.contractStatus}</p>
                </div>
                <div>
                  <p className="text-fg-muted uppercase tracking-wider">Contato</p>
                  <p className="text-fg font-semibold truncate">{selectedClient.contacts?.[0]?.name || '—'}</p>
                </div>
              </div>
            )}

            {/* Unidade / local */}
            <div>
              <label className={labelCls}>Unidade / Local de Atendimento</label>
              <input
                type="text"
                value={fUnit}
                onChange={(e) => setFUnit(e.target.value)}
                className={inputCls}
                placeholder="Ex.: Unidade Londrina — Torre A"
              />
            </div>

            {/* Escopo do contrato */}
            <div>
              <label className={labelCls}>Escopo do Contrato</label>
              <select value={fScope} onChange={(e) => setFScope(e.target.value)} className={inputCls}>
                <option>Manutenção Preventiva SDAI</option>
                <option>Manutenção Preventiva + Corretiva SDAI</option>
                <option>CFTV &amp; Monitoramento</option>
                <option>Controle de Acesso</option>
                <option>Automação Predial (BMS)</option>
                <option>Full (Multissistemas)</option>
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Valor mensal */}
              <div>
                <label className={labelCls}>Valor Mensal Recorrente (R$)</label>
                <input
                  type="number"
                  required
                  min={0}
                  step="0.01"
                  value={fMonthly}
                  onChange={(e) => setFMonthly(Number(e.target.value))}
                  className={`${inputCls} font-data-mono`}
                />
              </div>
              {/* Horas contratadas */}
              <div>
                <label className={labelCls}>Bolsa de Horas / mês</label>
                <input
                  type="number"
                  min={0}
                  value={fHours}
                  onChange={(e) => setFHours(Number(e.target.value))}
                  className={`${inputCls} font-data-mono`}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Início da vigência */}
              <div>
                <label className={labelCls}>Início da Vigência</label>
                <input
                  type="date"
                  value={fStartDate}
                  onChange={(e) => setFStartDate(e.target.value)}
                  className={`${inputCls} font-data-mono`}
                />
              </div>
              {/* Renovação */}
              <div>
                <label className={labelCls}>Data de Renovação</label>
                <input
                  type="date"
                  value={fRenewalDate}
                  onChange={(e) => setFRenewalDate(e.target.value)}
                  className={`${inputCls} font-data-mono`}
                />
              </div>
              {/* Dia de vencimento */}
              <div>
                <label className={labelCls}>Dia de Vencimento</label>
                <input
                  type="number"
                  min={1}
                  max={28}
                  value={fPaymentDay}
                  onChange={(e) => setFPaymentDay(Number(e.target.value))}
                  className={`${inputCls} font-data-mono`}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Índice de reajuste */}
              <div>
                <label className={labelCls}>Índice de Reajuste</label>
                <select value={fIndex} onChange={(e) => setFIndex(e.target.value)} className={inputCls}>
                  <option>IPCA (+4.5%)</option>
                  <option>IGP-M (+5.0%)</option>
                  <option>INPC (+4.2%)</option>
                  <option>Sem reajuste</option>
                </select>
              </div>
              {/* Responsável técnico (movido) */}
              <div>
                <label className={labelCls}>Responsável Técnico (ART)</label>
                <input
                  type="text"
                  value={fResponsible}
                  onChange={(e) => setFResponsible(e.target.value)}
                  className={inputCls}
                  placeholder="Isaac Lopes"
                />
              </div>
            </div>

            <div>
              {/* Status */}
              <label className={labelCls}>Status do Contrato</label>
              <select value={fStatus} onChange={(e) => setFStatus(e.target.value as Contract['status'])} className={inputCls}>
                <option value="ATIVO">ATIVO</option>
                <option value="A VENCER">A VENCER</option>
                <option value="SUSPENSO">SUSPENSO</option>
              </select>
            </div>

            {/* ===== ETAPA 3 — cadastro estruturado ===== */}
            <FormSection title="Identificação">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><label className={_labelCls}>Número do contrato</label><input value={fNumero} onChange={(e) => setFNumero(e.target.value)} className={_inputCls} placeholder="Ex.: 2026-014" /></div>
                <div><label className={_labelCls}>Responsável comercial</label><input value={fRespComercial} onChange={(e) => setFRespComercial(e.target.value)} className={_inputCls} /></div>
              </div>
            </FormSection>

            <FormSection title="Vigência & reajuste">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
                <label className="flex items-center gap-2 text-fg-secondary"><input type="checkbox" checked={fRenovAuto} onChange={(e) => setFRenovAuto(e.target.checked)} /> Renovação automática</label>
                <div><label className={_labelCls}>Aviso de renovação (dias)</label><input type="number" min={0} value={fAvisoDias} onChange={(e) => setFAvisoDias(e.target.value === '' ? '' : Number(e.target.value))} className={_inputCls} /></div>
                <div><label className={_labelCls}>Reajuste a cada (meses)</label><input type="number" min={1} value={fReajustePeriodo} onChange={(e) => setFReajustePeriodo(e.target.value === '' ? '' : Number(e.target.value))} className={_inputCls} /></div>
              </div>
            </FormSection>

            <FormSection title="Financeiro">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div><label className={_labelCls}>Faturamento</label><input value={fFaturamento} onChange={(e) => setFFaturamento(e.target.value)} className={_inputCls} placeholder="Ex.: Mensal, dia 10, NF-e" /></div>
                <div><label className={_labelCls}>Observações financeiras</label><input value={fObsFinanceiras} onChange={(e) => setFObsFinanceiras(e.target.value)} className={_inputCls} /></div>
              </div>
            </FormSection>

            <FormSection title="Áreas / sistemas cobertos">
              <Chips options={AREAS_COBERTAS} selected={fAreas} onToggle={(v) => setFAreas((a) => toggle(a, v))} />
            </FormSection>

            <FormSection title="Tipos de atendimento">
              <Chips options={TIPOS_ATENDIMENTO} selected={fTiposAtend} onToggle={(v) => setFTiposAtend((a) => toggle(a, v))} />
            </FormSection>

            <FormSection title="SLA (situação → prazo)">
              <div className="space-y-2">
                {fSla.map((r, i) => (
                  <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                    <input value={r.situacao} onChange={(e) => setFSla((p) => p.map((x, idx) => (idx === i ? { ...x, situacao: e.target.value } : x)))} placeholder="Situação (ex.: Falha crítica)" className={_inputCls} />
                    <input value={r.prazo} onChange={(e) => setFSla((p) => p.map((x, idx) => (idx === i ? { ...x, prazo: e.target.value } : x)))} placeholder="Prazo (ex.: Até 4h)" className={_inputCls} />
                    <button type="button" onClick={() => setFSla((p) => p.filter((_, idx) => idx !== i))} className="text-fg-muted hover:text-danger p-1">✕</button>
                  </div>
                ))}
                <button type="button" onClick={() => setFSla((p) => [...p, { situacao: '', prazo: '' }])} className="text-[11px] font-semibold text-primary hover:text-danger uppercase">+ Adicionar SLA</button>
              </div>
            </FormSection>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormSection title="Incluso"><StrList items={fIncluso} onChange={setFIncluso} addLabel="Adicionar" placeholder="Item incluso" /></FormSection>
              <FormSection title="Não incluso"><StrList items={fNaoIncluso} onChange={setFNaoIncluso} addLabel="Adicionar" placeholder="Item fora do escopo" /></FormSection>
              <FormSection title="Responsabilidades da Contratada"><StrList items={fRespContratada} onChange={setFRespContratada} addLabel="Adicionar" /></FormSection>
              <FormSection title="Responsabilidades da Contratante"><StrList items={fRespContratante} onChange={setFRespContratante} addLabel="Adicionar" /></FormSection>
            </div>

            <FormSection title="Entregáveis"><StrList items={fEntregaveis} onChange={setFEntregaveis} addLabel="Adicionar entregável" placeholder="Ex.: Relatório mensal, ART, checklist" /></FormSection>

            <FormSection title="Materiais">
              <label className={_labelCls}>Política</label>
              <select value={fMateriaisPol} onChange={(e) => setFMateriaisPol(e.target.value)} className={_inputCls}>
                <option value="">Selecione…</option>
                {MATERIAIS_POLITICAS.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}
              </select>
              <label className={`${_labelCls} mt-2`}>Observações de materiais</label>
              <input value={fMateriaisObs} onChange={(e) => setFMateriaisObs(e.target.value)} className={_inputCls} />
            </FormSection>

            <FormSection title="Observações / cláusulas operacionais">
              <textarea rows={3} value={fObsOper} onChange={(e) => setFObsOper(e.target.value)} className={_inputCls} />
            </FormSection>

            <button
              type="submit"
              className="w-full bg-danger hover:bg-danger-hover text-white py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors shadow-sm"
            >
              {editing ? 'Salvar alterações do contrato' : 'Salvar e Ativar Contrato'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
