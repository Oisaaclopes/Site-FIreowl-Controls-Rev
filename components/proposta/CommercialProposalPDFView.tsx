'use client';

import React from 'react';
import { Pedido, CompanyProfile } from '@/lib/types';
import { Download, Printer, ArrowLeft, Send, CheckCircle2, Building2, ShieldCheck, FileCheck2 } from 'lucide-react';

interface PdfDisplayOptions {
  showLogo: boolean;
  detailedSubtotal: boolean;
  showBankData: boolean;
}

interface CommercialProposalPDFViewProps {
  pedido: Pedido;
  companyProfile: CompanyProfile;
  onClose: () => void;
  onSendEmail?: (pedido: Pedido) => void;
  options?: PdfDisplayOptions;
}

export const CommercialProposalPDFView: React.FC<CommercialProposalPDFViewProps> = ({
  pedido,
  companyProfile,
  onClose,
  onSendEmail,
  options,
}) => {
  const { proposal } = pedido;
  const showLogo = options?.showLogo ?? true;
  const detailedSubtotal = options?.detailedSubtotal ?? true;
  const showBankData = options?.showBankData ?? false;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md overflow-y-auto p-4 md:p-8 flex flex-col items-center print:p-0 print:bg-white print:fixed print:inset-0 print:z-[9999]">
      {/* Top Controls Bar (Hidden in Print) */}
      <div className="w-full max-w-4xl bg-slate-800 text-white rounded-xl p-4 mb-6 shadow-xl flex flex-wrap justify-between items-center gap-3 print:hidden">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-semibold uppercase"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar ao Sistema
          </button>
          <div className="h-4 w-px bg-slate-700 hidden sm:block" />
          <span className="text-xs font-data-mono text-amber-400 font-bold hidden sm:inline">
            PROPOSTA: {pedido.numeroPedido}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {onSendEmail && (
            <button
              onClick={() => onSendEmail(pedido)}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm uppercase tracking-wider"
            >
              <Send className="w-3.5 h-3.5" /> Enviar por E-mail
            </button>
          )}
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-[#E63946] hover:bg-[#a51515] text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 shadow-sm uppercase tracking-wider"
          >
            <Printer className="w-4 h-4" /> Imprimir / Baixar PDF
          </button>
        </div>
      </div>

      {/* Main Document Canvas */}
      <div className="w-full max-w-4xl bg-white text-slate-800 shadow-2xl rounded-none border border-slate-200 p-8 md:p-12 font-body-md print:shadow-none print:border-none print:p-0 print:w-full print:max-w-none">
        
        {/* ==================== 1. CAPA ==================== */}
        <div className="border-b-4 border-[#E63946] pb-8 mb-10">
          {/* Navy Banner */}
          <div className="bg-[#0B1E38] text-white p-6 md:p-8 rounded-t-xl mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              {showLogo && companyProfile.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={companyProfile.logoUrl} alt="Logo" className="h-12 object-contain mb-2" />
              ) : (
                <div className="flex items-center gap-2">
                  <Building2 className="w-8 h-8 text-[#F2A900]" />
                  <h1 className="text-2xl md:text-3xl font-black uppercase tracking-wider text-white font-display">
                    FIREOWL CONTROLS
                  </h1>
                </div>
              )}
              <p className="text-[11px] md:text-xs text-slate-300 font-medium tracking-wide mt-1">
                Segurança Eletrônica • Detecção e Alarme de Incêndio • CFTV • Automação
              </p>
            </div>
            <div className="text-right md:border-l md:border-slate-700 md:pl-6">
              <span className="text-[10px] uppercase font-bold text-[#F2A900] tracking-widest block">
                DOCUMENTO TÉCNICO
              </span>
              <span className="text-xs font-data-mono text-slate-300">
                Emissão: {pedido.dataEmissao}
              </span>
            </div>
          </div>

          {/* Proposal Header Block */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-lg border border-slate-200">
            <div>
              <span className="text-[10px] font-bold text-[#E63946] uppercase tracking-widest block mb-1">
                PROPOSTA COMERCIAL & TÉCNICA
              </span>
              <h2 className="text-3xl font-black text-slate-900 font-display">
                {pedido.numeroPedido}
              </h2>
              <p className="text-sm font-bold text-slate-700 mt-2">
                REF: <span className="text-slate-900">{pedido.referencia || 'Instalação e Manutenção de Engenharia'}</span>
              </p>
            </div>

            <div className="space-y-1.5 text-xs text-slate-600 border-t md:border-t-0 md:border-l border-slate-200 pt-4 md:pt-0 md:pl-6">
              <p><strong className="text-slate-900 uppercase">Cliente / Contratante:</strong> {pedido.clienteNome}</p>
              <p><strong className="text-slate-900 uppercase">Fornecedor / Contratada:</strong> {pedido.fornecedor || companyProfile.razaoSocial}</p>
              <p><strong className="text-slate-900 uppercase">Responsável Comercial:</strong> {pedido.responsavelComercialNome}</p>
              <p className="pt-1">
                <strong className="text-slate-900 uppercase">Status da Proposta:</strong>{' '}
                <span className="uppercase font-bold text-[#E63946]">{pedido.status.replace('_', ' ')}</span>
              </p>
            </div>
          </div>
        </div>

        {/* ==================== 2. OBJETIVO ==================== */}
        <section className="mb-8">
          <div className="border-b-2 border-[#E63946] pb-1 mb-3 flex items-center gap-2">
            <span className="bg-[#0B1E38] text-white text-[10px] font-bold px-2 py-0.5 rounded">01</span>
            <h3 className="text-base font-bold text-[#0B1E38] uppercase font-display tracking-wide">
              OBJETIVO
            </h3>
          </div>
          <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line text-justify">
            {proposal.objetivo || 'Não especificado.'}
          </p>
        </section>

        {/* ==================== 3. DIRETRIZES NORMATIVAS ==================== */}
        <section className="mb-8">
          <div className="border-b-2 border-[#E63946] pb-1 mb-3 flex items-center gap-2">
            <span className="bg-[#0B1E38] text-white text-[10px] font-bold px-2 py-0.5 rounded">02</span>
            <h3 className="text-base font-bold text-[#0B1E38] uppercase font-display tracking-wide">
              DIRETRIZES NORMATIVAS E REFERÊNCIAS
            </h3>
          </div>
          <ul className="grid grid-cols-1 gap-2 text-xs text-slate-700">
            {proposal.diretrizesNormativas && proposal.diretrizesNormativas.length > 0 ? (
              proposal.diretrizesNormativas.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2 bg-slate-50 p-2 rounded border border-slate-200">
                  <ShieldCheck className="w-4 h-4 text-[#E63946] shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))
            ) : (
              <li className="text-slate-400 italic">Nenhuma norma especificada.</li>
            )}
          </ul>
        </section>

        {/* ==================== 4. DESCRIÇÃO DO SERVIÇO ==================== */}
        <section className="mb-8">
          <div className="border-b-2 border-[#E63946] pb-1 mb-3 flex items-center gap-2">
            <span className="bg-[#0B1E38] text-white text-[10px] font-bold px-2 py-0.5 rounded">03</span>
            <h3 className="text-base font-bold text-[#0B1E38] uppercase font-display tracking-wide">
              DESCRIÇÃO DOS SERVIÇOS & ENTREGÁVEIS
            </h3>
          </div>
          
          <div className="space-y-4 text-xs text-slate-700">
            <div>
              <h4 className="font-bold text-[#0B1E38] uppercase text-[11px] mb-1">Escopo Técnico dos Serviços:</h4>
              <p className="whitespace-pre-line text-justify bg-slate-50 p-3 rounded border border-slate-200 leading-relaxed">
                {proposal.escopoServico || 'Conforme especificação da equipe de engenharia.'}
              </p>
            </div>

            <div>
              <h4 className="font-bold text-[#0B1E38] uppercase text-[11px] mb-1">Entregáveis do Projeto:</h4>
              <ul className="space-y-1.5">
                {proposal.entregaveis && proposal.entregaveis.length > 0 ? (
                  proposal.entregaveis.map((ent, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <FileCheck2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <span>{ent}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-slate-400 italic">Relatório Diário de Obra e ART CREA.</li>
                )}
              </ul>
            </div>
          </div>
        </section>

        {/* ==================== 5. EQUIPAMENTOS (detalhamento — opcional) ==================== */}
        {detailedSubtotal && (
        <section className="mb-8">
          <div className="border-b-2 border-[#E63946] pb-1 mb-3 flex items-center gap-2">
            <span className="bg-[#0B1E38] text-white text-[10px] font-bold px-2 py-0.5 rounded">04</span>
            <h3 className="text-base font-bold text-[#0B1E38] uppercase font-display tracking-wide">
              ESPECIFICAÇÃO DOS EQUIPAMENTOS E MATERIAIS
            </h3>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0B1E38] text-white font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-2.5 text-center w-12">Item</th>
                  <th className="p-2.5">Descrição do Equipamento</th>
                  <th className="p-2.5">Marca / Modelo</th>
                  <th className="p-2.5 text-center w-16">Unid.</th>
                  <th className="p-2.5 text-center w-16">Qtde.</th>
                  <th className="p-2.5 text-right w-24">Unit. (R$)</th>
                  <th className="p-2.5 text-right w-28">Total (R$)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-medium text-slate-700">
                {proposal.equipmentItems && proposal.equipmentItems.length > 0 ? (
                  proposal.equipmentItems.map((eq, i) => {
                    const unitPrice = eq.precoUnitario || 0;
                    const totalItem = unitPrice * eq.quantidade;
                    return (
                      <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                        <td className="p-2.5 text-center font-bold text-[#E63946] font-data-mono">{eq.itemNumero || i + 1}</td>
                        <td className="p-2.5 font-semibold text-slate-900">{eq.descricao}</td>
                        <td className="p-2.5 text-slate-600">{eq.marcaModelo}</td>
                        <td className="p-2.5 text-center font-bold uppercase">{eq.unidade}</td>
                        <td className="p-2.5 text-center font-data-mono font-bold">{eq.quantidade}</td>
                        <td className="p-2.5 text-right font-data-mono">
                          {unitPrice > 0 ? unitPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—'}
                        </td>
                        <td className="p-2.5 text-right font-data-mono font-bold text-slate-900">
                          {totalItem > 0 ? totalItem.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—'}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="p-4 text-center text-slate-400 italic">
                      Nenhum equipamento listado nesta proposta.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
        )}

        {/* ==================== 6. MARCAS E FABRICANTES ==================== */}
        <section className="mb-8">
          <div className="border-b-2 border-[#E63946] pb-1 mb-3 flex items-center gap-2">
            <span className="bg-[#0B1E38] text-white text-[10px] font-bold px-2 py-0.5 rounded">05</span>
            <h3 className="text-base font-bold text-[#0B1E38] uppercase font-display tracking-wide">
              MARCAS E FABRICANTES HOMOLOGADOS
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {proposal.marcas && proposal.marcas.length > 0 ? (
              proposal.marcas.map((brand, idx) => (
                <div
                  key={idx}
                  className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-3 shadow-xs"
                >
                  {brand.marcaLogoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={brand.marcaLogoUrl} alt={brand.marcaNome} className="w-10 h-10 object-contain shrink-0" />
                  ) : (
                    <div className="w-9 h-9 bg-[#0B1E38] text-[#F2A900] rounded flex items-center justify-center font-bold text-xs shrink-0">
                      {brand.marcaNome.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h5 className="font-bold text-slate-900 text-xs">{brand.marcaNome}</h5>
                    <p className="text-[10px] text-slate-500 uppercase">{brand.marcaCategoria}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-slate-400 italic text-xs col-span-3">Marcas e fabricantes homologados padrão Fireowl Controls.</p>
            )}
          </div>
        </section>

        {/* ==================== 7. PREMISSAS ==================== */}
        <section className="mb-8">
          <div className="border-b-2 border-[#E63946] pb-1 mb-3 flex items-center gap-2">
            <span className="bg-[#0B1E38] text-white text-[10px] font-bold px-2 py-0.5 rounded">06</span>
            <h3 className="text-base font-bold text-[#0B1E38] uppercase font-display tracking-wide">
              PREMISSAS ADOTADAS
            </h3>
          </div>
          <ul className="space-y-1.5 text-xs text-slate-700">
            {proposal.premissas && proposal.premissas.length > 0 ? (
              proposal.premissas.map((prem, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-[#E63946] font-bold">•</span>
                  <span>{prem}</span>
                </li>
              ))
            ) : (
              <li className="text-slate-400 italic">Conforme rotinas padrão do contratante.</li>
            )}
          </ul>
        </section>

        {/* ==================== 8. RESPONSABILIDADES ==================== */}
        <section className="mb-8">
          <div className="border-b-2 border-[#E63946] pb-1 mb-3 flex items-center gap-2">
            <span className="bg-[#0B1E38] text-white text-[10px] font-bold px-2 py-0.5 rounded">07</span>
            <h3 className="text-base font-bold text-[#0B1E38] uppercase font-display tracking-wide">
              DIVISÃO DE RESPONSABILIDADES
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Contratada */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <h4 className="font-bold text-[#0B1E38] uppercase text-xs border-b border-slate-200 pb-2 mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Responsabilidades da Contratada
              </h4>
              <ul className="space-y-2 text-slate-700">
                {proposal.responsabilidadesContratada && proposal.responsabilidadesContratada.length > 0 ? (
                  proposal.responsabilidadesContratada.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-emerald-600 font-bold">✓</span>
                      <span>{item}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-slate-400 italic">Mão de obra e ferramentas inclusas.</li>
                )}
              </ul>
            </div>

            {/* Contratante */}
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
              <h4 className="font-bold text-[#0B1E38] uppercase text-xs border-b border-slate-200 pb-2 mb-2 flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-blue-600" /> Responsabilidades da Contratante
              </h4>
              <ul className="space-y-2 text-slate-700">
                {proposal.responsabilidadesContratante && proposal.responsabilidadesContratante.length > 0 ? (
                  proposal.responsabilidadesContratante.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-blue-600 font-bold">✓</span>
                      <span>{item}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-slate-400 italic">Liberação de acessos e pontos de energia.</li>
                )}
              </ul>
            </div>
          </div>
        </section>

        {/* ==================== 9 & 10. CONDIÇÕES COMERCIAIS & PRAZO ==================== */}
        <section className="mb-8">
          <div className="border-b-2 border-[#E63946] pb-1 mb-3 flex items-center gap-2">
            <span className="bg-[#0B1E38] text-white text-[10px] font-bold px-2 py-0.5 rounded">08</span>
            <h3 className="text-base font-bold text-[#0B1E38] uppercase font-display tracking-wide">
              CONDIÇÕES COMERCIAIS & PRAZOS
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {/* Value Card */}
            <div className="bg-[#0B1E38] text-white p-5 rounded-lg border border-slate-800 col-span-1 md:col-span-1 flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#F2A900]">
                  INVESTIMENTO TOTAL
                </span>
                <p className="text-2xl md:text-3xl font-black text-white font-data-mono mt-1">
                  R$ {(proposal.valorTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <p className="text-[10px] text-slate-300 mt-3 pt-2 border-t border-slate-700">
                Impostos: {proposal.impostos || 'Simples Nacional Incluso'}
              </p>
            </div>

            {/* Terms Details */}
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 col-span-1 md:col-span-2 space-y-2 text-xs">
              <p><strong className="text-slate-900 uppercase">Composição do Valor:</strong> {proposal.composicaoValor || 'Conforme orçado'}</p>
              <p><strong className="text-slate-900 uppercase">Forma de Pagamento:</strong> {proposal.formaPagamento || 'A combinar'}</p>
              <p><strong className="text-slate-900 uppercase">Faturamento:</strong> {proposal.faturamento || 'Por etapa'}</p>
              <p><strong className="text-slate-900 uppercase">Prazo de Execução:</strong> {proposal.prazoExecucao || 'A definir'}</p>
            </div>
          </div>
        </section>

        {/* ==================== 11 & 12. GARANTIA & VALIDADE ==================== */}
        <section className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <h4 className="font-bold text-[#0B1E38] uppercase text-xs mb-1">GARANTIA TÉCNICA</h4>
            <p className="text-slate-700 leading-relaxed">{proposal.garantia || '90 dias para serviços / 12 meses para peças.'}</p>
          </div>

          <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
            <h4 className="font-bold text-amber-900 uppercase text-xs mb-1">VALIDADE DA PROPOSTA</h4>
            <p className="text-amber-800 font-bold font-data-mono">
              {proposal.validadePropostaDias || 15} {proposal.validadePropostaComplemento || 'dias corridos a partir da emissão'}
            </p>
          </div>
        </section>

        {/* ==================== DADOS PARA PAGAMENTO (opcional) ==================== */}
        {showBankData && (
          <section className="mb-8">
            <div className="border-b-2 border-[#E63946] pb-1 mb-3 flex items-center gap-2">
              <span className="bg-[#0B1E38] text-white text-[10px] font-bold px-2 py-0.5 rounded">$</span>
              <h3 className="text-base font-bold text-[#0B1E38] uppercase font-display tracking-wide">
                DADOS PARA PAGAMENTO
              </h3>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-700 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <p><strong className="text-slate-900 uppercase">Beneficiário:</strong> {companyProfile.razaoSocial}</p>
              <p><strong className="text-slate-900 uppercase">Chave PIX (CNPJ):</strong> <span className="font-data-mono">{companyProfile.cnpj}</span></p>
              <p className="sm:col-span-2 text-[10px] text-slate-500">
                Pagamento mediante emissão de nota fiscal. Confirme o comprovante junto ao responsável comercial.
              </p>
            </div>
          </section>
        )}

        {/* ==================== 13. CONCLUSÃO ==================== */}
        <section className="mb-12">
          <div className="border-b-2 border-[#E63946] pb-1 mb-3 flex items-center gap-2">
            <span className="bg-[#0B1E38] text-white text-[10px] font-bold px-2 py-0.5 rounded">09</span>
            <h3 className="text-base font-bold text-[#0B1E38] uppercase font-display tracking-wide">
              CONCLUSÃO
            </h3>
          </div>
          <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line text-justify italic">
            {proposal.conclusao || 'Permanecemos à inteira disposição para quaisquer esclarecimentos.'}
          </p>
        </section>

        {/* ==================== ASSINATURAS ==================== */}
        <div className="pt-10 border-t border-slate-200 grid grid-cols-2 gap-8 text-center text-xs mt-12">
          <div>
            <div className="border-b border-slate-400 h-12 mb-2" />
            <p className="font-bold text-slate-900 uppercase">{pedido.fornecedor || companyProfile.razaoSocial}</p>
            <p className="text-[10px] text-slate-500 uppercase">{pedido.responsavelComercialNome} — Engenharia</p>
          </div>

          <div>
            <div className="border-b border-slate-400 h-12 mb-2" />
            <p className="font-bold text-slate-900 uppercase">{pedido.clienteNome}</p>
            <p className="text-[10px] text-slate-500 uppercase">De acordo & Aceite da Proposta</p>
          </div>
        </div>

        {/* ==================== FOOTER ==================== */}
        <div className="mt-12 pt-4 border-t border-slate-200 text-center text-[10px] text-slate-400 uppercase tracking-wider flex justify-between items-center">
          <span>{companyProfile.razaoSocial} • CNPJ {companyProfile.cnpj}</span>
          <span>{companyProfile.endereco}</span>
        </div>
      </div>
    </div>
  );
};
