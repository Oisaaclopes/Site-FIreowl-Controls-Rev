'use client';

import React from 'react';
import { Pedido, CompanyProfile, PedidoEquipmentItem } from '@/lib/types';
import { ArrowLeft, Printer, Send } from 'lucide-react';
import { OfficialLogo } from '@/components/OfficialLogo';
import {
  CARTA_APRESENTACAO,
  SERVICOS_OFERTADOS,
  EMBALAGEM_TRANSPORTE,
  SEGURANCA_TRABALHO,
  LIMITACAO_RESPONSABILIDADE,
  CONFIDENCIALIDADE,
  TERMO_ACEITE,
  CONDICOES_GERAIS,
  PRECOS_OBS,
  IMPOSTOS_OBS,
} from '@/lib/propostaTextos';

interface PdfDisplayOptions {
  showLogo: boolean;
  detailedSubtotal: boolean;
  showBankData: boolean;
  /** Seções opcionais do documento (default: incluídas). */
  showIndice?: boolean;
  showHistorico?: boolean;
  showCarta?: boolean;
  /** Cláusulas jurídicas: Segurança, Limitação de Responsabilidade, Confidencialidade, Condições Gerais. */
  showClausulas?: boolean;
  showTermoAceite?: boolean;
}

interface CommercialProposalPDFViewProps {
  pedido: Pedido;
  companyProfile: CompanyProfile;
  onClose: () => void;
  onSendEmail?: (pedido: Pedido) => void;
  options?: PdfDisplayOptions;
}

const brl = (n: number) => `R$ ${(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
const naoVazio = (s?: string) => !!s && s.trim().length > 0;
const listaNaoVazia = (a?: string[]) => Array.isArray(a) && a.filter((x) => naoVazio(x)).length > 0;

/* --------------------------- subcomponentes --------------------------- */

// Cabeçalho numerado de seção (padrão do documento).
const SecHead: React.FC<{ n: string; titulo: string }> = ({ n, titulo }) => (
  <div className="border-b-2 border-[#E63946] pb-1 mb-3 flex items-center gap-2">
    <span className="bg-[#0B1E38] text-white text-[10px] font-bold px-2 py-0.5 rounded font-data-mono">{n}</span>
    <h3 className="text-[15px] font-bold text-[#0B1E38] uppercase font-display tracking-wide">{titulo}</h3>
  </div>
);

// Bloco de parágrafos justificados (cláusulas).
const Paras: React.FC<{ paras: string[] }> = ({ paras }) => (
  <div className="space-y-2 text-xs text-slate-700 leading-relaxed text-justify">
    {paras.map((p, i) => (
      <p key={i}>{p}</p>
    ))}
  </div>
);

// Lista com marcadores (bullets).
const Bullets: React.FC<{ itens: string[] }> = ({ itens }) => (
  <ul className="space-y-1.5 text-xs text-slate-700">
    {itens
      .filter((x) => naoVazio(x))
      .map((item, i) => (
        <li key={i} className="flex items-start gap-2">
          <span className="text-[#E63946] font-bold leading-5">•</span>
          <span className="text-justify">{item}</span>
        </li>
      ))}
  </ul>
);

// Tabela de itens (Materiais ou Serviços) com subtotal.
const ItensTable: React.FC<{
  titulo: string;
  itens: PedidoEquipmentItem[];
  detailed: boolean;
  showMarca?: boolean;
  accent?: string;
}> = ({ titulo, itens, detailed, showMarca = true, accent = '#0B1E38' }) => {
  const subtotal = itens.reduce((a, e) => a + (e.precoUnitario || 0) * e.quantidade, 0);
  const cols = 3 + (showMarca ? 1 : 0) + (detailed ? 2 : 0); // Item, Descr, [Marca], Unid, Qtd, [Unit, Total]
  return (
    <div className="mb-4">
      <h4 className="font-bold text-[#0B1E38] uppercase text-[11px] mb-1">{titulo}</h4>
      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full text-left text-xs">
          <thead className="text-white font-bold uppercase text-[10px]" style={{ backgroundColor: accent }}>
            <tr>
              <th className="p-2.5 text-center w-12">Item</th>
              <th className="p-2.5">Descrição</th>
              {showMarca && <th className="p-2.5">Marca / Modelo</th>}
              <th className="p-2.5 text-center w-14">Unid.</th>
              <th className="p-2.5 text-center w-14">Qtd.</th>
              {detailed && <th className="p-2.5 text-right w-24">Unit. (R$)</th>}
              {detailed && <th className="p-2.5 text-right w-28">Total (R$)</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 font-medium text-slate-700">
            {itens.map((eq, i) => {
              const unit = eq.precoUnitario || 0;
              const tot = unit * eq.quantidade;
              return (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                  <td className="p-2.5 text-center font-bold text-[#E63946] font-data-mono">{i + 1}</td>
                  <td className="p-2.5 font-semibold text-slate-900">{eq.descricao}</td>
                  {showMarca && <td className="p-2.5 text-slate-600">{eq.marcaModelo}</td>}
                  <td className="p-2.5 text-center font-bold uppercase">{eq.unidade}</td>
                  <td className="p-2.5 text-center font-data-mono font-bold">{eq.quantidade}</td>
                  {detailed && (
                    <td className="p-2.5 text-right font-data-mono">
                      {unit > 0 ? unit.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—'}
                    </td>
                  )}
                  {detailed && (
                    <td className="p-2.5 text-right font-data-mono font-bold text-slate-900">
                      {tot > 0 ? tot.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—'}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
          {detailed && (
            <tfoot>
              <tr className="bg-slate-100 font-bold text-slate-800">
                <td colSpan={cols - 1} className="p-2.5 text-right uppercase text-[11px]">Subtotal {titulo}</td>
                <td className="p-2.5 text-right font-data-mono">{brl(subtotal)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};

// Linha de assinatura com campo em branco.
const linhaBranca = (largura = 'flex-1') => (
  <span className={`inline-block border-b border-slate-400 ${largura} mx-1 align-baseline`} style={{ minWidth: 60 }} />
);

export const CommercialProposalPDFView: React.FC<CommercialProposalPDFViewProps> = ({
  pedido,
  companyProfile,
  onClose,
  onSendEmail,
  options,
}) => {
  const { proposal } = pedido;
  const showLogo = options?.showLogo ?? true;
  const detailed = options?.detailedSubtotal ?? true;
  const showIndice = options?.showIndice !== false;
  const showHistorico = options?.showHistorico !== false;
  const showCarta = options?.showCarta !== false;
  const showClausulas = options?.showClausulas !== false;
  const showTermoAceite = options?.showTermoAceite !== false;

  const handlePrint = () => window.print();

  const itensProposta = proposal.equipmentItems || [];
  const materiaisPdf = itensProposta.filter((e) => e.tipo !== 'servico');
  const servicosPdf = itensProposta.filter((e) => e.tipo === 'servico');

  const razao = companyProfile.razaoSocial || 'Fireowl Controls';
  const escopoTitulo = pedido.referencia || 'Fornecimento e Serviços de Engenharia';
  const assinante = pedido.responsavelComercialNome || 'Responsável Comercial';

  // Índice (numeração fixa do padrão completo).
  // Seções do documento com numeração DINÂMICA: seções não visíveis (ex.:
  // Embalagem/Transporte quando não há materiais ofertados) são omitidas e não
  // deixam buraco no número nem no índice.
  const embalagemVisivel = materiaisPdf.length > 0;
  const secoes = [
    { key: 'carta', titulo: 'Carta de Apresentação', visible: showCarta },
    { key: 'historico', titulo: 'Histórico de Propostas', visible: showHistorico },
    { key: 'visao', titulo: 'Visão Geral da Proposta', visible: true },
    { key: 'escopo', titulo: 'Escopo da Proposta', visible: true },
    { key: 'itens', titulo: 'Materiais e Serviços Ofertados', visible: true },
    { key: 'premissas', titulo: 'Premissas Adotadas', visible: true },
    { key: 'servicos', titulo: 'Descrição dos Serviços Ofertados', visible: true },
    { key: 'embalagem', titulo: 'Embalagem, Transporte e Armazenamento', visible: embalagemVisivel },
    { key: 'seguranca', titulo: 'Segurança do Trabalho', visible: showClausulas },
    { key: 'obrigacoes', titulo: 'Obrigações da Contratante', visible: true },
    { key: 'precos', titulo: 'Preços', visible: true },
    { key: 'infoCompra', titulo: 'Informações para o Pedido de Compra', visible: true },
    { key: 'impostos', titulo: 'Impostos e Taxas', visible: true },
    { key: 'pagamento', titulo: 'Condições de Pagamento', visible: true },
    { key: 'limitacao', titulo: 'Limitação de Responsabilidade', visible: showClausulas },
    { key: 'prazo', titulo: 'Prazo de Fornecimento', visible: true },
    { key: 'garantia', titulo: 'Garantia', visible: true },
    { key: 'confidencialidade', titulo: 'Confidencialidade', visible: showClausulas },
    { key: 'termoAceite', titulo: 'Termo de Aceite da Proposta', visible: showTermoAceite },
    { key: 'condicoesGerais', titulo: 'Condições Gerais', visible: showClausulas },
    { key: 'validade', titulo: 'Validade da Proposta', visible: true },
    { key: 'conclusao', titulo: 'Conclusão', visible: true },
    { key: 'aceite', titulo: 'Aceite da Proposta', visible: true },
  ];
  const visibleSecoes = secoes.filter((s) => s.visible);
  // Numeração dinâmica por chave: seções omitidas não deixam buraco no número.
  const num = (key: string) => {
    const i = visibleSecoes.findIndex((s) => s.key === key);
    return i >= 0 ? String(i + 1).padStart(2, '0') : '';
  };
  const vis = (key: string) => visibleSecoes.some((s) => s.key === key);
  // Mapeia o número fixo (ordem original) para o número dinâmico da seção.
  const nn = (fixed: number) => {
    const key = secoes[fixed - 1]?.key;
    return key ? num(key) : String(fixed).padStart(2, '0');
  };

  const Rodape = (
    <div className="pdf-footer">
      <span>© {new Date().getFullYear()} {razao}. Todos os direitos reservados.</span>
      <span className="font-data-mono">{pedido.numeroPedido}</span>
    </div>
  );

  return (
    <div className="pdf-print-root fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md overflow-y-auto p-4 md:p-8 flex flex-col items-center">
      {/* CSS de impressão: isola SÓ o documento (o resto do app fica oculto),
          força as cores dos blocos e trata as quebras de página. */}
      <style>{`
        .pdf-footer { display: none; }
        @media print {
          @page { size: A4; margin: 14mm 12mm 16mm 12mm; }
          html, body { background: #fff !important; margin: 0 !important; padding: 0 !important; }
          /* Imprime só o documento: esconde todo o resto do app */
          body * { visibility: hidden !important; }
          .pdf-print-root, .pdf-print-root * { visibility: visible !important; }
          .no-print, .no-print * { visibility: hidden !important; display: none !important; }
          /* Força a impressão das cores de fundo (banners, tabelas, cabeçalhos) */
          .pdf-print-root, .pdf-print-root * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .pdf-print-root {
            position: absolute !important; left: 0 !important; top: 0 !important; right: auto !important; bottom: auto !important;
            width: 100% !important; background: #fff !important; backdrop-filter: none !important;
            padding: 0 !important; margin: 0 !important; display: block !important; overflow: visible !important; z-index: auto !important;
          }
          .pdf-doc {
            box-shadow: none !important; border: none !important; padding: 0 !important;
            margin: 0 !important; max-width: none !important; width: 100% !important;
          }
          .pdf-cover { min-height: 82vh !important; }
          .pdf-break { break-after: page; page-break-after: always; }
          .pdf-section { break-inside: avoid; page-break-inside: avoid; }
          .pdf-footer {
            display: flex !important; justify-content: space-between; align-items: center;
            position: fixed; left: 0; right: 0; bottom: 4mm;
            font-size: 8px; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em;
            border-top: 1px solid #e2e8f0; padding-top: 3px; background: #fff;
          }
        }
      `}</style>

      {/* Barra de controles (não vai para o PDF) */}
      <div className="no-print w-full max-w-4xl bg-slate-800 text-white rounded-xl p-4 mb-6 shadow-xl flex flex-wrap justify-between items-center gap-3">
        <button
          onClick={onClose}
          className="p-2 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 text-xs font-semibold uppercase"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar ao Sistema
        </button>
        <span className="text-xs font-data-mono text-amber-400 font-bold hidden sm:inline">
          PROPOSTA: {pedido.numeroPedido}
        </span>
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

      {/* Documento */}
      <div className="pdf-doc w-full max-w-4xl bg-white text-slate-800 shadow-2xl border border-slate-200 p-8 md:p-12 font-body-md">
        {Rodape}

        {/* ============================ CAPA ============================ */}
        <div className="pdf-break pdf-cover min-h-[80vh] flex flex-col">
          <div className="bg-[#0B1E38] text-white p-8 rounded-xl flex items-center justify-between gap-4">
            {showLogo &&
              (companyProfile.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={companyProfile.logoUrl} alt="Logo" className="h-14 object-contain" />
              ) : (
                <div className="flex items-center gap-3">
                  <span className="bg-white rounded-xl p-1.5 shrink-0 inline-flex">
                    <OfficialLogo className="w-11 h-11" />
                  </span>
                  <h1 className="text-2xl font-black uppercase tracking-wider text-white font-display">FIREOWL CONTROLS</h1>
                </div>
              ))}
            <span className="text-[10px] uppercase font-bold text-[#F2A900] tracking-widest text-right">
              Documento Técnico-Comercial
            </span>
          </div>

          <div className="grow flex flex-col justify-center py-10">
            <span className="text-[11px] font-bold text-[#E63946] uppercase tracking-[0.3em] mb-3">
              Proposta Técnico-Comercial
            </span>
            <div className="border-l-4 border-[#E63946] pl-5 space-y-6">
              <CapaCampo rotulo="Cliente" valor={pedido.clienteNome} destaque />
              <CapaCampo rotulo="Número da Proposta" valor={pedido.numeroPedido} mono />
              <CapaCampo rotulo="Escopo de Fornecimento" valor={escopoTitulo} />
              <CapaCampo rotulo="Data" valor={pedido.dataEmissao} mono />
            </div>
          </div>

          <div className="border-t border-slate-200 pt-4 text-[10px] text-slate-500 uppercase tracking-wider flex justify-between">
            <span>{razao} • CNPJ {companyProfile.cnpj}</span>
            <span>{companyProfile.endereco}</span>
          </div>
        </div>

        {/* ===================== 1. CARTA DE APRESENTAÇÃO ===================== */}
        {vis('carta') && (
        <section className="pdf-break pdf-section mb-8">
          <SecHead n={nn(1)} titulo="Carta de Apresentação" />
          <Paras
            paras={
              naoVazio(proposal.cartaApresentacao)
                ? proposal.cartaApresentacao!.split('\n').map((p) => p.trim()).filter(Boolean)
                : CARTA_APRESENTACAO
            }
          />
          <div className="mt-6 text-xs text-slate-700">
            <p className="mb-6">Atenciosamente,</p>
            <p className="font-bold text-slate-900">{assinante}</p>
            <p className="text-slate-600">Responsável Comercial — {razao}</p>
            {naoVazio(companyProfile.telefone) && <p className="text-slate-500 font-data-mono">{companyProfile.telefone}</p>}
            {naoVazio(companyProfile.email) && <p className="text-slate-500 font-data-mono">{companyProfile.email}</p>}
          </div>
        </section>
        )}

        {/* ============================ ÍNDICE ============================ */}
        {showIndice && (
        <section className="pdf-break pdf-section mb-8">
          <SecHead n="—" titulo="Índice" />
          <ol className="space-y-1.5 text-xs text-slate-700">
            {visibleSecoes.map((s, i) => (
              <li key={s.key} className="flex items-center gap-2">
                <span className="font-data-mono font-bold text-[#0B1E38] w-6 shrink-0">{String(i + 1).padStart(2, '0')}</span>
                <span className="flex-1">{s.titulo}</span>
                <span className="flex-1 border-b border-dotted border-slate-300 mx-1" />
              </li>
            ))}
          </ol>
        </section>
        )}

        {/* ===================== 2. HISTÓRICO DE PROPOSTAS ===================== */}
        {vis('historico') && (
        <section className="pdf-section mb-8">
          <SecHead n={nn(2)} titulo="Histórico de Propostas" />
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0B1E38] text-white font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-2.5">Revisão / Número</th>
                  <th className="p-2.5">Data</th>
                  <th className="p-2.5">Elaborador</th>
                  <th className="p-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-700">
                <tr>
                  <td className="p-2.5 font-data-mono font-bold text-slate-900">{pedido.numeroPedido}</td>
                  <td className="p-2.5 font-data-mono">{pedido.dataEmissao}</td>
                  <td className="p-2.5">{assinante}</td>
                  <td className="p-2.5 uppercase font-semibold text-[#E63946]">{pedido.status.replace(/_/g, ' ')}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
        )}

        {/* ===================== 3. VISÃO GERAL ===================== */}
        <section className="pdf-section mb-8">
          <SecHead n={nn(3)} titulo="Visão Geral da Proposta" />
          <h4 className="font-bold text-[#0B1E38] uppercase text-[11px] mb-1">{nn(3)}.1. Introdução</h4>
          <p className="text-xs text-slate-700 leading-relaxed text-justify whitespace-pre-line">
            {naoVazio(proposal.objetivo)
              ? proposal.objetivo
              : `Apresentamos nossa proposta para o fornecimento e execução dos serviços referentes a ${escopoTitulo}, para ${pedido.clienteNome}.`}
          </p>
          {listaNaoVazia(proposal.diretrizesNormativas) && (
            <div className="mt-3">
              <h4 className="font-bold text-[#0B1E38] uppercase text-[11px] mb-1">Diretrizes normativas de referência</h4>
              <Bullets itens={proposal.diretrizesNormativas} />
            </div>
          )}
        </section>

        {/* ===================== 4. ESCOPO ===================== */}
        <section className="pdf-section mb-8">
          <SecHead n={nn(4)} titulo="Escopo da Proposta" />
          <h4 className="font-bold text-[#0B1E38] uppercase text-[11px] mb-1">{nn(4)}.1. Descrição do escopo proposto</h4>
          <p className="text-xs text-slate-700 leading-relaxed text-justify whitespace-pre-line bg-slate-50 p-3 rounded border border-slate-200">
            {naoVazio(proposal.escopoServico) ? proposal.escopoServico : 'Escopo conforme especificação técnica acordada com o cliente.'}
          </p>
        </section>

        {/* ===================== 5. MATERIAIS OFERTADOS ===================== */}
        <section className="pdf-section mb-8">
          <SecHead n={nn(5)} titulo="Materiais e Serviços Ofertados" />

          {materiaisPdf.length > 0 && <ItensTable titulo="Materiais" itens={materiaisPdf} detailed={detailed} showMarca />}
          {servicosPdf.length > 0 && (
            <ItensTable titulo="Serviços" itens={servicosPdf} detailed={detailed} showMarca={false} accent="#047857" />
          )}
          {materiaisPdf.length === 0 && servicosPdf.length === 0 && (
            <p className="text-xs text-slate-400 italic">Itens conforme especificação técnica acordada.</p>
          )}

          {/* Fecho de valores */}
          {detailed && (
            <div className="mt-1 border border-slate-200 rounded-lg overflow-hidden">
              {(proposal.maoDeObra || 0) > 0 && (
                <div className="flex items-center justify-between px-3 py-2 bg-slate-100 text-slate-800 text-xs font-semibold">
                  <span className="uppercase">Mão de obra / Serviços adicionais</span>
                  <span className="font-data-mono">{brl(proposal.maoDeObra || 0)}</span>
                </div>
              )}
              <div className="flex items-center justify-between px-3 py-2.5 bg-[#0B1E38] text-white">
                <span className="text-[11px] font-bold uppercase tracking-widest text-[#F2A900]">Valor Total</span>
                <span className="text-lg font-black font-data-mono">{brl(proposal.valorTotal)}</span>
              </div>
            </div>
          )}
        </section>

        {/* ===================== 6. PREMISSAS ===================== */}
        <section className="pdf-section mb-8">
          <SecHead n={nn(6)} titulo="Premissas Adotadas" />
          {listaNaoVazia(proposal.premissas) ? (
            <Bullets itens={proposal.premissas} />
          ) : (
            <p className="text-xs text-slate-500 italic">Premissas conforme rotinas padrão de execução.</p>
          )}
        </section>

        {/* ===================== 7. DESCRIÇÃO DOS SERVIÇOS ===================== */}
        <section className="pdf-section mb-8">
          <SecHead n={nn(7)} titulo="Descrição dos Serviços Ofertados" />
          <div className="space-y-3">
            {SERVICOS_OFERTADOS.map((s, i) => (
              <div key={i}>
                <h4 className="font-bold text-[#0B1E38] uppercase text-[11px] mb-1">{nn(7)}.{i + 1}. {s.titulo}</h4>
                <Bullets itens={s.itens} />
              </div>
            ))}
            {listaNaoVazia(proposal.entregaveis) && (
              <div>
                <h4 className="font-bold text-[#0B1E38] uppercase text-[11px] mb-1">Entregáveis do projeto</h4>
                <Bullets itens={proposal.entregaveis} />
              </div>
            )}
            {listaNaoVazia(proposal.responsabilidadesContratada) && (
              <div>
                <h4 className="font-bold text-[#0B1E38] uppercase text-[11px] mb-1">Responsabilidades da Contratada</h4>
                <Bullets itens={proposal.responsabilidadesContratada} />
              </div>
            )}
          </div>
        </section>

        {/* ===================== 8. EMBALAGEM (só quando há materiais) ===================== */}
        {embalagemVisivel && (
          <section className="pdf-section mb-8">
            <SecHead n={nn(8)} titulo="Embalagem, Transporte e Armazenamento" />
            <Paras paras={EMBALAGEM_TRANSPORTE} />
          </section>
        )}

        {/* ===================== 9. SEGURANÇA DO TRABALHO ===================== */}
        {vis('seguranca') && (
        <section className="pdf-section mb-8">
          <SecHead n={nn(9)} titulo="Segurança do Trabalho" />
          <Bullets itens={SEGURANCA_TRABALHO} />
        </section>
        )}

        {/* ===================== 10. OBRIGAÇÕES DA CONTRATANTE ===================== */}
        <section className="pdf-section mb-8">
          <SecHead n={nn(10)} titulo="Obrigações da Contratante" />
          {listaNaoVazia(proposal.responsabilidadesContratante) ? (
            <Bullets itens={proposal.responsabilidadesContratante} />
          ) : (
            <Bullets
              itens={[
                'Liberação das frentes de trabalho e dos acessos necessários à equipe.',
                'Fornecimento de ponto de energia elétrica 120/220 Vac para os serviços.',
                'Local seguro e adequado para guarda de materiais e ferramentas.',
              ]}
            />
          )}
        </section>

        {/* ===================== 11. PREÇOS ===================== */}
        <section className="pdf-section mb-8">
          <SecHead n={nn(11)} titulo="Preços" />
          <div className="bg-[#0B1E38] text-white p-5 rounded-lg flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#F2A900]">Investimento Total</span>
            <span className="text-2xl font-black font-data-mono">{brl(proposal.valorTotal)}</span>
          </div>
          <Paras paras={PRECOS_OBS} />
        </section>

        {/* ===================== 12. INFORMAÇÕES PARA PEDIDO DE COMPRA ===================== */}
        <section className="pdf-section mb-8">
          <SecHead n={nn(12)} titulo="Informações para o Pedido de Compra" />
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-700 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <p><strong className="text-slate-900 uppercase">Razão Social:</strong> {razao}</p>
            <p><strong className="text-slate-900 uppercase">CNPJ:</strong> <span className="font-data-mono">{companyProfile.cnpj}</span></p>
            <p className="sm:col-span-2"><strong className="text-slate-900 uppercase">Endereço:</strong> {companyProfile.endereco}</p>
            {naoVazio(companyProfile.telefone) && <p><strong className="text-slate-900 uppercase">Telefone:</strong> {companyProfile.telefone}</p>}
            {naoVazio(companyProfile.email) && <p><strong className="text-slate-900 uppercase">E-mail:</strong> {companyProfile.email}</p>}
          </div>
        </section>

        {/* ===================== 13. IMPOSTOS E TAXAS ===================== */}
        <section className="pdf-section mb-8">
          <SecHead n={nn(13)} titulo="Impostos e Taxas" />
          <Paras paras={naoVazio(proposal.impostos) ? [`Regime/observação: ${proposal.impostos}`, ...IMPOSTOS_OBS] : IMPOSTOS_OBS} />
        </section>

        {/* ===================== 14. CONDIÇÕES DE PAGAMENTO ===================== */}
        <section className="pdf-section mb-8">
          <SecHead n={nn(14)} titulo="Condições de Pagamento" />
          <p className="text-xs text-slate-700 leading-relaxed text-justify">
            {naoVazio(proposal.formaPagamento) ? proposal.formaPagamento : 'A combinar entre as partes.'}
          </p>
          {naoVazio(proposal.faturamento) && (
            <p className="text-xs text-slate-700 leading-relaxed text-justify mt-1">
              <strong className="text-slate-900 uppercase">Faturamento:</strong> {proposal.faturamento}
            </p>
          )}
        </section>

        {/* ===================== 15. LIMITAÇÃO DE RESPONSABILIDADE ===================== */}
        {vis('limitacao') && (
        <section className="pdf-section mb-8">
          <SecHead n={nn(15)} titulo="Limitação de Responsabilidade" />
          <Paras paras={LIMITACAO_RESPONSABILIDADE} />
        </section>
        )}

        {/* ===================== 16. PRAZO DE FORNECIMENTO ===================== */}
        <section className="pdf-section mb-8">
          <SecHead n={nn(16)} titulo="Prazo de Fornecimento" />
          <p className="text-xs text-slate-700 leading-relaxed text-justify">
            {naoVazio(proposal.prazoExecucao) ? proposal.prazoExecucao : 'Prazo a ser definido após confirmação do pedido.'}
          </p>
        </section>

        {/* ===================== 17. GARANTIA ===================== */}
        <section className="pdf-section mb-8">
          <SecHead n={nn(17)} titulo="Garantia" />
          <p className="text-xs text-slate-700 leading-relaxed text-justify whitespace-pre-line">
            {naoVazio(proposal.garantia)
              ? proposal.garantia
              : 'Garantia de 90 (noventa) dias sobre os serviços de instalação e de 12 (doze) meses para os equipamentos fornecidos, contra defeitos de fabricação, a contar da entrega.'}
          </p>
        </section>

        {/* ===================== 18. CONFIDENCIALIDADE ===================== */}
        {vis('confidencialidade') && (
        <section className="pdf-section mb-8">
          <SecHead n={nn(18)} titulo="Confidencialidade" />
          <Paras paras={CONFIDENCIALIDADE} />
        </section>
        )}

        {/* ===================== 19. TERMO DE ACEITE ===================== */}
        {vis('termoAceite') && (
        <section className="pdf-section mb-8">
          <SecHead n={nn(19)} titulo="Termo de Aceite da Proposta" />
          <Paras paras={TERMO_ACEITE} />
        </section>
        )}

        {/* ===================== 20. CONDIÇÕES GERAIS ===================== */}
        {vis('condicoesGerais') && (
        <section className="pdf-section mb-8">
          <SecHead n={nn(20)} titulo="Condições Gerais" />
          <Paras paras={CONDICOES_GERAIS} />
        </section>
        )}

        {/* ===================== 21. VALIDADE ===================== */}
        <section className="pdf-section mb-8">
          <SecHead n={nn(21)} titulo="Validade da Proposta" />
          <p className="text-xs text-slate-700 leading-relaxed text-justify">
            Os preços permanecem fixos dentro do período de validade desta proposta, que é de{' '}
            <strong>{proposal.validadePropostaDias || 15} {proposal.validadePropostaComplemento || 'dias corridos a partir da emissão'}</strong>.
            Após este período, eventuais variações na base de preços dos fabricantes poderão ser repactuadas.
          </p>
        </section>

        {/* ===================== 22. CONCLUSÃO ===================== */}
        <section className="pdf-section mb-8">
          <SecHead n={nn(22)} titulo="Conclusão" />
          <p className="text-xs text-slate-700 leading-relaxed text-justify italic whitespace-pre-line">
            {naoVazio(proposal.conclusao)
              ? proposal.conclusao
              : 'Reiteramos nosso compromisso com a qualidade e a segurança, permanecendo à disposição para eventuais esclarecimentos e negociações. Aguardamos sua análise e retorno.'}
          </p>
        </section>

        {/* ===================== 23. ACEITE DA PROPOSTA ===================== */}
        <section className="pdf-section mb-8">
          <SecHead n={nn(23)} titulo="Aceite da Proposta" />
          <p className="text-xs text-slate-700 leading-relaxed text-justify mb-4">
            O Cliente aceita as condições desta proposta, emitindo o seu &ldquo;de acordo&rdquo; para o fornecimento em tela.
            O aceite é documento suficiente para que as Partes se obriguem nos termos e condições aqui previstos.
          </p>
          <div className="text-xs text-slate-800 leading-8 bg-slate-50 border border-slate-200 rounded-lg p-4">
            Pelo presente, a empresa {linhaBranca('w-64')}, situada na {linhaBranca('w-64')}, nº {linhaBranca('w-16')},
            CEP {linhaBranca('w-24')}, cidade {linhaBranca('w-40')}, inscrita no CNPJ {linhaBranca('w-40')}
            IE {linhaBranca('w-28')}, representada legalmente pelo Sr.(a) {linhaBranca('w-56')},
            CPF {linhaBranca('w-32')}, telefone {linhaBranca('w-36')}, e-mail {linhaBranca('w-56')},
            aceita as condições desta proposta.
          </div>

          <div className="pt-12 grid grid-cols-2 gap-8 text-center text-xs">
            <div>
              <div className="border-b border-slate-400 h-10 mb-2" />
              <p className="font-bold text-slate-900 uppercase">{razao}</p>
              <p className="text-[10px] text-slate-500 uppercase">{assinante}</p>
            </div>
            <div>
              <div className="border-b border-slate-400 h-10 mb-2" />
              <p className="font-bold text-slate-900 uppercase">{pedido.clienteNome}</p>
              <p className="text-[10px] text-slate-500 uppercase">De acordo &amp; Aceite da Proposta</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

// Campo da capa (rótulo + valor).
const CapaCampo: React.FC<{ rotulo: string; valor: string; destaque?: boolean; mono?: boolean }> = ({
  rotulo,
  valor,
  destaque,
  mono,
}) => (
  <div>
    <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">{rotulo}</span>
    <span
      className={`block ${destaque ? 'text-2xl font-black text-slate-900' : 'text-lg font-bold text-slate-800'} ${
        mono ? 'font-data-mono' : 'font-display'
      }`}
    >
      {valor || '—'}
    </span>
  </div>
);
