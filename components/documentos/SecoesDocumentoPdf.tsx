import React from 'react';
import { View, Text, StyleSheet } from '@react-pdf/renderer';
import { CommercialProposalData, CompanyProfile, PedidoEquipmentItem } from '@/lib/types';
import { C, brl, nv, lnv, itemTotal, InclusoExcluso, SlaBloco } from './pdfKit';
import { SecaoDocKey, SECAO_TITULO } from '@/lib/documentoSecoes';
import { renderWarranty } from '@/lib/commercialWarranty';
import { resolverNormasReferencia } from '@/lib/normasReferencia';
import { normalizeUnitCode } from '@/lib/commercialUnits';
import { websiteDisplay } from '@/lib/companyProfile';
import { conclusaoPorTipo } from '@/lib/propostaTitulo';
import {
  CARTA_APRESENTACAO,
  SERVICOS_OFERTADOS,
  EMBALAGEM_TRANSPORTE,
  SEGURANCA_TRABALHO,
  MULTAS_ATRASO,
  LIMITACAO_RESPONSABILIDADE,
  CONFIDENCIALIDADE,
  TERMO_ACEITE,
  CONDICOES_GERAIS,
  PRECOS_OBS,
  IMPOSTOS_OBS,
} from '@/lib/propostaTextos';

/**
 * Blocos GENÉRICOS das seções do documento do Pedido ([[lib/documentoSecoes]]).
 *
 * Usado quando o usuário liga, num documento enxuto (Orçamento, Laudo,
 * Personalizado), uma seção que aquele gerador não desenha nativamente — p.ex.
 * Entregáveis num Orçamento. Mesmo kit visual dos documentos genéricos.
 * IMPORTANTE: sem lineHeight em containers (só em Text) — ver armadilhas do
 * rodapé fixo em [[react-pdf-gotchas-proposta]].
 */

const s = StyleSheet.create({
  secHead: { flexDirection: 'row', alignItems: 'center', borderLeftWidth: 3, borderLeftColor: C.red, paddingLeft: 8, marginTop: 10, marginBottom: 6 },
  secNum: { backgroundColor: C.navy, color: C.white, fontSize: 8, fontFamily: 'Roboto', fontWeight: 700, paddingVertical: 1.5, paddingHorizontal: 5, borderRadius: 2, marginRight: 7 },
  secTitle: { color: C.navy, fontSize: 11, fontFamily: 'Poppins', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 },
  para: { fontSize: 9, fontFamily: 'Roboto', color: C.s700, textAlign: 'justify', lineHeight: 1.4, marginBottom: 3 },
  sub: { color: C.navy, fontSize: 9, fontFamily: 'Roboto', fontWeight: 700, textTransform: 'uppercase', marginBottom: 3, marginTop: 4 },
  bulletRow: { flexDirection: 'row', marginBottom: 3 },
  bulletDot: { color: C.red, fontFamily: 'Roboto', fontWeight: 700, marginRight: 6, fontSize: 8.5 },
  bulletText: { flex: 1, fontSize: 8.5, fontFamily: 'Roboto', color: C.s700, lineHeight: 1.35 },
  strong: { fontFamily: 'Roboto', fontWeight: 700, color: C.ink },
  box: { backgroundColor: C.s50, borderWidth: 1, borderColor: C.s200, borderLeftWidth: 4, borderLeftColor: C.navy, borderRadius: 5, padding: 10 },
  th: { flexDirection: 'row', backgroundColor: C.navy },
  thCell: { color: C.white, fontSize: 7.5, fontFamily: 'Roboto', fontWeight: 700, textTransform: 'uppercase', paddingVertical: 6, paddingHorizontal: 6 },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.s200 },
  trAlt: { backgroundColor: C.s50 },
  td: { fontSize: 8, color: C.s700, paddingVertical: 5, paddingHorizontal: 6 },
  totalNavy: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: C.navy, paddingVertical: 9, paddingHorizontal: 12, borderTopWidth: 3, borderTopColor: C.red, borderRadius: 4, marginTop: 6 },
  totalLabel: { color: C.gold, fontSize: 9, fontFamily: 'Poppins', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 },
  totalValue: { color: C.white, fontSize: 15, fontFamily: 'Poppins', fontWeight: 700 },
  signRow: { flexDirection: 'row', marginTop: 22, gap: 28 },
  signCol: { flex: 1, alignItems: 'center' },
  signLine: { borderBottomWidth: 1, borderBottomColor: C.s400, width: '100%', height: 24, marginBottom: 5 },
  signName: { fontFamily: 'Roboto', fontWeight: 700, color: C.ink, fontSize: 8, textTransform: 'uppercase' },
  signRole: { fontSize: 7.5, color: C.s500, textTransform: 'uppercase' },
});

const Bullets = ({ itens }: { itens: string[] }) => (
  <>
    {itens.filter(nv).map((it, i) => (
      <View key={i} style={s.bulletRow} wrap={false}>
        <Text style={s.bulletDot}>•</Text>
        <Text style={s.bulletText}>{it}</Text>
      </View>
    ))}
  </>
);
const Paras = ({ paras }: { paras: string[] }) => (
  <>
    {paras.filter(nv).map((p, i) => (
      <Text key={i} style={s.para}>{p}</Text>
    ))}
  </>
);

/** Texto materializado da seção; template só para proposta histórica (mesma regra do PDF da proposta). */
const txtSec = (p: CommercialProposalData, stored: string[] | undefined, fallback: string[]) =>
  stored !== undefined ? stored : p.textosMaterializados ? [] : fallback;

export interface SecoesCtx {
  p: CommercialProposalData;
  companyProfile: CompanyProfile;
  cliente: string;
  assinante: string;
  /** Mostrar valores unitários / totais por item (opções do documento). */
  showUnit?: boolean;
  showTotal?: boolean;
  /** Sub-seções de "itens": lista de materiais / lista de serviços (padrão: ambas). */
  verMateriais?: boolean;
  verServicos?: boolean;
}

/** Itens que a seção "itens" mostra, conforme as listas ligadas. */
function itensVisiveis(ctx: SecoesCtx): PedidoEquipmentItem[] {
  return (ctx.p.equipmentItems || []).filter((e) => (e.tipo === 'servico' ? ctx.verServicos !== false : ctx.verMateriais !== false));
}

function servicosSec(p: CommercialProposalData) {
  return p.servicosOfertados !== undefined ? p.servicosOfertados : p.textosMaterializados ? [] : SERVICOS_OFERTADOS;
}

/** A seção tem algo para mostrar? (seção sem conteúdo não gera título vazio). */
export function secaoTemConteudo(key: SecaoDocKey, ctx: SecoesCtx): boolean {
  const { p } = ctx;
  switch (key) {
    case 'carta': return nv(p.cartaApresentacao) || p.cartaApresentacao === undefined;
    case 'historico': return true;
    case 'visao': return nv(p.objetivo);
    case 'normas': return lnv(resolverNormasReferencia(p));
    case 'escopo': return nv(p.escopoServico) || (p.slaTabela || []).length > 0 || nv(p.slaCritico);
    case 'itens': return itensVisiveis(ctx).length > 0;
    case 'itensServicos': return false; // sai dentro de "itens"
    case 'premissas': return lnv(p.premissas);
    case 'incluso': return lnv(p.incluso) || lnv(p.naoIncluso);
    case 'servicos': return servicosSec(p).some((g) => nv(g.titulo) || lnv(g.itens));
    case 'responsabilidades': return lnv(p.responsabilidadesContratada);
    case 'entregaveis': return lnv(p.entregaveis);
    case 'embalagem': return lnv(txtSec(p, p.embalagemTransporteTexto, EMBALAGEM_TRANSPORTE));
    case 'seguranca': return lnv(txtSec(p, p.segurancaTrabalhoTexto, SEGURANCA_TRABALHO));
    case 'obrigacoes': return lnv(p.responsabilidadesContratante);
    case 'precos': return true;
    case 'infoCompra': return true;
    case 'impostos': return nv(p.impostos) || lnv(txtSec(p, p.impostosObsTexto, IMPOSTOS_OBS));
    case 'pagamento': return true;
    case 'multas': return lnv(txtSec(p, p.multasAtrasoTexto, MULTAS_ATRASO));
    case 'limitacao': return lnv(txtSec(p, p.limitacaoRespTexto, LIMITACAO_RESPONSABILIDADE));
    case 'prazo': return nv(p.prazoExecucao);
    case 'garantia': return renderWarranty(p.warranty).hasAny;
    case 'confidencialidade': return lnv(txtSec(p, p.confidencialidadeTexto, CONFIDENCIALIDADE));
    case 'termoAceite': return lnv(txtSec(p, p.termoAceiteTexto, TERMO_ACEITE));
    case 'condicoesGerais': return lnv(txtSec(p, p.condicoesGeraisTexto, CONDICOES_GERAIS));
    case 'validade': return true;
    case 'conclusao': return nv(p.conclusao);
    case 'aceite': return true;
    default: return false;
  }
}

/** Filtra as chaves que de fato serão desenhadas (para numerar antes de renderizar). */
export function secoesRenderizaveis(keys: SecaoDocKey[], ctx: SecoesCtx): SecaoDocKey[] {
  return keys.filter((k) => secaoTemConteudo(k, ctx));
}

const Head = ({ n, titulo }: { n?: string; titulo: string }) => (
  <View style={s.secHead} minPresenceAhead={50}>
    {n ? <Text style={s.secNum}>{n}</Text> : null}
    <Text style={s.secTitle}>{titulo}</Text>
  </View>
);

function corpo(key: SecaoDocKey, ctx: SecoesCtx): React.ReactNode {
  const { p, companyProfile } = ctx;
  switch (key) {
    case 'carta':
      return <Paras paras={nv(p.cartaApresentacao) ? p.cartaApresentacao!.split('\n').map((x) => x.trim()) : CARTA_APRESENTACAO} />;
    case 'historico':
      return (
        <View>
          {(p.revisoes || []).map((r, i) => (
            <Text key={i} style={s.para}><Text style={s.strong}>{r.numero}</Text>{` — ${r.data} — ${r.elaborador}${nv(r.motivo) ? ` — ${r.motivo}` : ''}`}</Text>
          ))}
          <Text style={s.para}>{(p.revisoes || []).length ? 'Versão vigente: este documento.' : 'Emissão inicial.'}</Text>
        </View>
      );
    case 'visao':
      return <Text style={s.para}>{p.objetivo}</Text>;
    case 'normas':
      return <Bullets itens={resolverNormasReferencia(p).filter(nv)} />;
    case 'responsabilidades':
      return <Bullets itens={p.responsabilidadesContratada || []} />;
    case 'escopo':
      return (
        <View>
          {nv(p.escopoServico) ? <Text style={s.para}>{p.escopoServico}</Text> : null}
          <SlaBloco tabela={p.slaTabela} slaCritico={p.slaCritico} />
        </View>
      );
    case 'itens': {
      const itens = itensVisiveis(ctx);
      const showUnit = ctx.showUnit !== false;
      const showTotal = ctx.showTotal !== false;
      return (
        <View style={{ borderWidth: 1, borderColor: C.s200, borderRadius: 4, overflow: 'hidden' }}>
          <View style={s.th} fixed>
            <Text style={[s.thCell, { width: 24, textAlign: 'center' }]}>#</Text>
            <Text style={[s.thCell, { flex: 1 }]}>Descrição</Text>
            <Text style={[s.thCell, { width: 30, textAlign: 'center' }]}>Un.</Text>
            <Text style={[s.thCell, { width: 34, textAlign: 'center' }]}>Qtd</Text>
            {showUnit && <Text style={[s.thCell, { width: 62, textAlign: 'right' }]}>Unit.</Text>}
            {showTotal && <Text style={[s.thCell, { width: 68, textAlign: 'right' }]}>Total</Text>}
          </View>
          {itens.map((eq: PedidoEquipmentItem, i) => (
            <View key={i} style={[s.tr, i % 2 === 1 ? s.trAlt : {}]} wrap={false}>
              <Text style={[s.td, { width: 24, textAlign: 'center', color: C.red, fontFamily: 'Roboto', fontWeight: 700 }]}>{i + 1}</Text>
              <View style={[s.td, { flex: 1 }]}>
                <Text style={{ color: C.ink, fontFamily: 'Roboto', fontWeight: 700, fontSize: 8 }}>{eq.descricao}</Text>
                {nv(eq.marcaModelo) ? <Text style={{ color: C.s500, fontSize: 7, marginTop: 1 }}>{eq.marcaModelo}</Text> : null}
              </View>
              <Text style={[s.td, { width: 30, textAlign: 'center' }]}>{normalizeUnitCode(eq.unidade)}</Text>
              <Text style={[s.td, { width: 34, textAlign: 'center', fontFamily: 'Roboto', fontWeight: 700 }]}>{(eq.quantidade || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 })}</Text>
              {showUnit && <Text style={[s.td, { width: 62, textAlign: 'right' }]}>{(eq.precoUnitario || 0) > 0 ? (eq.precoUnitario || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—'}</Text>}
              {showTotal && <Text style={[s.td, { width: 68, textAlign: 'right', fontFamily: 'Roboto', fontWeight: 700, color: C.ink }]}>{itemTotal(eq) > 0 ? itemTotal(eq).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—'}</Text>}
            </View>
          ))}
        </View>
      );
    }
    case 'premissas':
      return <Bullets itens={p.premissas || []} />;
    case 'incluso':
      return <InclusoExcluso incluso={p.incluso} naoIncluso={p.naoIncluso} />;
    case 'servicos':
      return (
        <View>
          {servicosSec(p).map((g, i) => (
            <View key={i} minPresenceAhead={40}>
              {nv(g.titulo) ? <Text style={s.sub}>{g.titulo}</Text> : null}
              <Bullets itens={g.itens} />
            </View>
          ))}
        </View>
      );
    case 'entregaveis':
      return <Bullets itens={p.entregaveis || []} />;
    case 'embalagem':
      return <Paras paras={txtSec(p, p.embalagemTransporteTexto, EMBALAGEM_TRANSPORTE)} />;
    case 'seguranca':
      return <Bullets itens={txtSec(p, p.segurancaTrabalhoTexto, SEGURANCA_TRABALHO)} />;
    case 'obrigacoes':
      return <Bullets itens={p.responsabilidadesContratante || []} />;
    case 'precos': {
      const recorrente = !!p.recorrente && (p.valorMensal || 0) > 0;
      return (
        <View>
          <View style={s.totalNavy} wrap={false}>
            <Text style={s.totalLabel}>{recorrente ? 'Investimento Mensal' : 'Investimento Total'}</Text>
            <Text style={s.totalValue}>{recorrente ? `${brl(p.valorMensal || 0)} / mês` : brl(p.valorTotal)}</Text>
          </View>
          <View style={{ marginTop: 6 }}><Paras paras={txtSec(p, p.precosObsTexto, PRECOS_OBS)} /></View>
        </View>
      );
    }
    case 'infoCompra': {
      const site = websiteDisplay(companyProfile.website);
      const linha = (rot: string, val?: string) => (nv(val) ? <Text style={{ fontSize: 9, marginBottom: 2 }}><Text style={s.strong}>{`${rot}: `}</Text>{val}</Text> : null);
      return (
        <View style={s.box}>
          {linha('Razão Social', companyProfile.razaoSocial)}
          {linha('CNPJ', companyProfile.cnpj)}
          {linha('Endereço', companyProfile.endereco)}
          {linha('Telefone', companyProfile.telefone)}
          {linha('E-mail', companyProfile.email)}
          {linha('Site', site)}
        </View>
      );
    }
    case 'impostos':
      return <Paras paras={nv(p.impostos) ? [`Regime/observação: ${p.impostos}`, ...txtSec(p, p.impostosObsTexto, IMPOSTOS_OBS)] : txtSec(p, p.impostosObsTexto, IMPOSTOS_OBS)} />;
    case 'pagamento': {
      const txt = p.formasPagamento?.length || p.condicoesPagamento?.length
        ? [p.formasPagamento?.length ? `Formas: ${p.formasPagamento.join(', ')}.` : '', p.condicoesPagamento?.length ? `Condições: ${p.condicoesPagamento.join(' · ')}.` : ''].filter(Boolean).join(' ')
        : nv(p.formaPagamento) ? p.formaPagamento : 'A combinar entre as partes.';
      return <Text style={s.para}>{txt}{nv(p.faturamento) ? ` Faturamento: ${p.faturamento}.` : ''}</Text>;
    }
    case 'multas':
      return <Paras paras={txtSec(p, p.multasAtrasoTexto, MULTAS_ATRASO)} />;
    case 'limitacao':
      return <Paras paras={txtSec(p, p.limitacaoRespTexto, LIMITACAO_RESPONSABILIDADE)} />;
    case 'prazo':
      return <Text style={s.para}>{p.prazoExecucao}</Text>;
    case 'garantia': {
      const w = renderWarranty(p.warranty);
      if (w.legacyText !== undefined) return <Text style={s.para}>{w.legacyText}</Text>;
      return (
        <View>
          {w.maoDeObra ? <Text style={s.para}><Text style={s.strong}>Mão de obra: </Text>{w.maoDeObra}</Text> : null}
          {w.materiais ? <Text style={s.para}><Text style={s.strong}>Materiais/equipamentos: </Text>{w.materiais}</Text> : null}
          {w.observacoes ? <Text style={s.para}>{w.observacoes}</Text> : null}
        </View>
      );
    }
    case 'confidencialidade':
      return <Paras paras={txtSec(p, p.confidencialidadeTexto, CONFIDENCIALIDADE)} />;
    case 'termoAceite':
      return <Paras paras={txtSec(p, p.termoAceiteTexto, TERMO_ACEITE)} />;
    case 'condicoesGerais':
      return <Paras paras={txtSec(p, p.condicoesGeraisTexto, CONDICOES_GERAIS)} />;
    case 'validade':
      return <Text style={s.para}>{`Os preços permanecem fixos por ${p.validadePropostaDias || 15} ${p.validadePropostaComplemento || 'dias corridos a partir da emissão'}. Após esse período, eventuais variações na base de preços dos fabricantes poderão ser repactuadas.`}</Text>;
    case 'conclusao':
      return <Text style={[s.para, { fontStyle: 'italic' }]}>{nv(p.conclusao) ? p.conclusao : conclusaoPorTipo(p.tipoServico)}</Text>;
    case 'aceite':
      return (
        <View wrap={false}>
          <Text style={s.para}>O Cliente aceita as condições deste documento, emitindo o seu “de acordo”.</Text>
          <View style={s.signRow}>
            <View style={s.signCol}>
              <View style={s.signLine} />
              <Text style={s.signName}>{companyProfile.razaoSocial || 'Fireowl Controls'}</Text>
              <Text style={s.signRole}>{ctx.assinante}</Text>
            </View>
            <View style={s.signCol}>
              <View style={s.signLine} />
              <Text style={s.signName}>{ctx.cliente}</Text>
              <Text style={s.signRole}>De acordo &amp; Aceite</Text>
            </View>
          </View>
        </View>
      );
    default:
      return null;
  }
}

/**
 * Desenha as seções `keys` (já filtradas por conteúdo, ver secoesRenderizaveis)
 * em sequência. `numero(k)` devolve o rótulo numérico de cada uma ('' = sem número).
 */
export function SecoesExtras({ keys, ctx, numero }: { keys: SecaoDocKey[]; ctx: SecoesCtx; numero?: (k: SecaoDocKey) => string }) {
  return (
    <>
      {keys.map((k) => (
        <View key={k} minPresenceAhead={60}>
          <Head n={numero?.(k)} titulo={SECAO_TITULO[k]} />
          {corpo(k, ctx)}
        </View>
      ))}
    </>
  );
}
