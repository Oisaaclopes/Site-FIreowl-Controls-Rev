import { resolverTituloPedido } from '@/lib/pedidoTitulos';
import React from 'react';
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { Pedido, CompanyProfile, PedidoEquipmentItem } from '@/lib/types';
import { C, brl, nv, PdfHeader, PdfFooter, CamposExtras, DocCover, QrCode, contatoQrUrl, AuthenticityStamp } from './pdfKit';
import { websiteDisplay } from '@/lib/companyProfile';
import { normalizeCommercialProposalData } from '@/lib/commercialProposal';
import { calculateCommercialProposalTotals } from '@/lib/commercialTotals';
import { renderWarranty } from '@/lib/commercialWarranty';
import { GARANTIA_MATERIAL_PADRAO } from '@/lib/commercialWarranty';
import { normalizeUnitCode } from '@/lib/commercialUnits';
import { verificationUrl } from '@/lib/documentVerification';
import {
  freteCondicaoTexto,
  impostosCondicaoTexto,
  AVISO_SEM_INSTALACAO,
} from '@/lib/fornecimentoComercial';

/**
 * Documento enxuto da modalidade SOMENTE MATERIAL — "Orçamento Comercial /
 * Fornecimento de Materiais". Reaproveita o pdfKit (mesma engine react-pdf,
 * capa, cabeçalho, rodapé, QR, selo) — NÃO é um motor comercial paralelo, é
 * uma variação de documento como Orçamento/Nota/Lista já são. Sem seções de
 * execução técnica (objetivo, escopo, entregáveis, premissas…).
 */
export type FornecimentoPdfOptions = {
  showLogo?: boolean;
  showValorUnitario?: boolean;
  showSubtotal?: boolean;
  showDescricaoDetalhada?: boolean;
  showCamposPersonalizados?: boolean;
  showAssinaturaCliente?: boolean;
  showCapa?: boolean;
  dataHoje?: boolean;
  capaImagemUrl?: string;
  logoUrl?: string;
};

const styles = StyleSheet.create({
  page: { paddingTop: 58, paddingBottom: 42, paddingHorizontal: 40, fontSize: 9, fontFamily: 'Roboto', color: C.s700 },
  titleWrap: { marginBottom: 12 },
  eyebrow: { color: C.red, fontSize: 8, fontFamily: 'Roboto', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.6 },
  title: { color: C.navy, fontSize: 22, fontFamily: 'Poppins', fontWeight: 700, letterSpacing: 0.3, marginTop: 3 },
  titleBar: { width: 52, height: 4, backgroundColor: C.red, borderRadius: 2, marginTop: 7 },

  infoCard: { flexDirection: 'row', flexWrap: 'wrap', borderWidth: 1, borderColor: C.s200, borderRadius: 6, overflow: 'hidden', marginBottom: 14 },
  infoCell: { width: '50%', paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: C.s100 },
  infoLabel: { color: C.s500, fontSize: 7, fontFamily: 'Roboto', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 },
  infoValue: { color: C.ink, fontSize: 9.5, fontFamily: 'Roboto', fontWeight: 700 },

  secHead: { flexDirection: 'row', alignItems: 'center', borderLeftWidth: 3, borderLeftColor: C.red, paddingLeft: 8, marginTop: 10, marginBottom: 6 },
  secNum: { backgroundColor: C.navy, color: C.white, fontSize: 8, fontFamily: 'Roboto', fontWeight: 700, paddingVertical: 1.5, paddingHorizontal: 5, borderRadius: 2, marginRight: 7 },
  secTitle: { color: C.navy, fontSize: 11, fontFamily: 'Poppins', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 },

  th: { flexDirection: 'row', backgroundColor: C.navy },
  thCell: { color: C.white, fontSize: 7.5, fontFamily: 'Roboto', fontWeight: 700, textTransform: 'uppercase', paddingVertical: 6, paddingHorizontal: 6 },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.s200 },
  trAlt: { backgroundColor: C.s50 },
  td: { fontSize: 8, color: C.s700, paddingVertical: 5, paddingHorizontal: 6 },

  totalWrap: { marginTop: 8, borderWidth: 1, borderColor: C.s200, borderRadius: 5, overflow: 'hidden', marginBottom: 14 },
  totalRowLight: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: C.s50, paddingVertical: 6, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: C.s100 },
  totalRowNavy: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: C.navy, paddingVertical: 9, paddingHorizontal: 12, borderTopWidth: 3, borderTopColor: C.red },
  totalLabel: { fontSize: 8.5, fontFamily: 'Roboto', fontWeight: 700, color: C.ink, textTransform: 'uppercase' },
  totalNum: { fontSize: 8.5, fontFamily: 'Roboto', fontWeight: 700, color: C.ink },
  totalLabelGold: { color: C.gold, fontSize: 9, fontFamily: 'Poppins', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 },
  totalValue: { color: C.white, fontSize: 16, fontFamily: 'Poppins', fontWeight: 700 },

  condCard: { backgroundColor: C.s50, borderWidth: 1, borderColor: C.s200, borderLeftWidth: 4, borderLeftColor: C.red, borderRadius: 5, padding: 10, marginBottom: 10 },
  condRow: { flexDirection: 'row', marginBottom: 4 },
  condLabel: { fontFamily: 'Roboto', fontWeight: 700, color: C.ink, textTransform: 'uppercase', fontSize: 8, width: 120 },
  condText: { fontSize: 9, color: C.s700, flex: 1 },
  para: { fontSize: 9, color: C.s700, textAlign: 'justify', lineHeight: 1.4 },
  obsItalic: { fontSize: 8.5, color: C.s600, fontStyle: 'italic', marginTop: 3 },
  contatoCard: { backgroundColor: C.s50, borderWidth: 1, borderColor: C.s200, borderLeftWidth: 4, borderLeftColor: C.navy, borderRadius: 5, padding: 10, marginTop: 4 },

  signRow: { flexDirection: 'row', marginTop: 26, gap: 28 },
  signCol: { flex: 1, alignItems: 'center' },
  signLine: { borderBottomWidth: 1, borderBottomColor: C.s400, width: '100%', height: 24, marginBottom: 5 },
  signName: { fontFamily: 'Roboto', fontWeight: 700, color: C.ink, fontSize: 8, textTransform: 'uppercase' },
  signRole: { fontSize: 7.5, color: C.s500, textTransform: 'uppercase' },
});

const InfoCell = ({ label, value, full }: { label: string; value: string; full?: boolean }) => (
  <View style={[styles.infoCell, full ? { width: '100%' } : {}]}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value || '—'}</Text>
  </View>
);

const SecHead = ({ n, titulo }: { n?: string; titulo: string }) => (
  <View style={styles.secHead} minPresenceAhead={50}>
    {n ? <Text style={styles.secNum}>{n}</Text> : null}
    <Text style={styles.secTitle}>{titulo}</Text>
  </View>
);

const CondRow = ({ label, value }: { label: string; value: string }) =>
  nv(value) ? (
    <View style={styles.condRow}>
      <Text style={styles.condLabel}>{label}</Text>
      <Text style={styles.condText}>{value}</Text>
    </View>
  ) : null;

export function FornecimentoMateriaisDocument({
  pedido,
  companyProfile,
  options,
  verifKind = 'orcamento',
}: {
  pedido: Pedido;
  companyProfile: CompanyProfile;
  options?: FornecimentoPdfOptions;
  verifKind?: 'orcamento' | 'proposta';
}) {
  const p = normalizeCommercialProposalData(pedido.proposal);
  const razao = companyProfile.razaoSocial || 'Fireowl Controls';
  const fantasia = companyProfile.nomeFantasia || razao;
  const numero = pedido.numeroPedido;
  const cliente = pedido.clienteNome || '';
  const assinante = pedido.responsavelComercialNome || 'Responsável Comercial';
  const referencia = pedido.referencia || 'Fornecimento de Materiais';

  const showLogo = options?.showLogo !== false;
  const showUnit = options?.showValorUnitario !== false;
  const showTotal = options?.showSubtotal !== false;
  const showMarca = options?.showDescricaoDetalhada !== false;
  const showAssinatura = options?.showAssinaturaCliente !== false;
  const showCampos = options?.showCamposPersonalizados === true;
  const showCapa = options?.showCapa !== false;
  const capaImagemUrl = options?.capaImagemUrl;
  const dataDoc = options?.dataHoje ? new Date().toISOString().split('T')[0] : (pedido.dataEmissao || '');

  // Apenas materiais entram no documento; serviços eventualmente cadastrados
  // ficam preservados no pedido, mas fora deste orçamento de fornecimento.
  const materiais: PedidoEquipmentItem[] = (p.equipmentItems || []).filter((e) => e.tipo !== 'servico');

  // Fonte única de cálculo (mesma do editor). Material-only + frete + impostos.
  const totals = calculateCommercialProposalTotals({
    equipmentItems: p.equipmentItems,
    frete: p.frete,
    impostosAdicionais: p.impostosAdicionais,
    onlyMaterials: true,
    valorTotalManual: p.valorTotalManual,
  });
  const brutoProdutos = totals.materialsSubtotal + totals.discountTotal;

  const validade = `${p.validadePropostaDias || 15} ${p.validadePropostaComplemento || 'dias corridos a partir da emissão'}`;

  const pagamento =
    (p.formasPagamento?.length || p.condicoesPagamento?.length)
      ? [p.formasPagamento?.length ? `Formas: ${p.formasPagamento.join(', ')}` : '', p.condicoesPagamento?.length ? p.condicoesPagamento.join(' · ') : ''].filter(Boolean).join(' — ')
      : (nv(p.formaPagamento) ? p.formaPagamento! : 'A combinar entre as partes.');

  // Garantia: usa a informada; se vazia, cai no texto-padrão de fornecimento.
  const warrantyView = renderWarranty(p.warranty);
  const garantiaTexto = warrantyView.legacyText
    || [warrantyView.materiais ? `Materiais/equipamentos: ${warrantyView.materiais}` : '', warrantyView.observacoes || ''].filter(Boolean).join(' ')
    || GARANTIA_MATERIAL_PADRAO;

  const freteTxt = freteCondicaoTexto(p.frete);
  const impostosTxt = impostosCondicaoTexto(p.impostosAdicionais);

  const site = websiteDisplay(companyProfile.website);
  const contato = [companyProfile.telefone, companyProfile.email, site].filter(nv).join('  •  ');
  const qrUrl = contatoQrUrl(companyProfile.telefone, companyProfile.email);
  const authenticityUrl = verificationUrl(verifKind, pedido.id);

  return (
    <Document title={`Orçamento ${numero}`} author={razao}>
      {showCapa && (
        <DocCover
          razao={razao}
          cnpj={companyProfile.cnpj}
          endereco={companyProfile.endereco}
          telefone={companyProfile.telefone}
          email={companyProfile.email}
          website={site}
          titulo="Orçamento Comercial"
          subtitulo={resolverTituloPedido(p) || 'Fornecimento de Materiais'}
          cliente={cliente}
          numero={numero}
          escopo={referencia}
          data={dataDoc}
          capaImagemUrl={capaImagemUrl}
          showLogo={showLogo}
          logoUrl={options?.logoUrl}
        />
      )}

      <Page size="A4" style={styles.page}>
        <PdfHeader razao={fantasia} label="Orçamento Comercial" showLogo={showLogo} logoUrl={options?.logoUrl} />
        <PdfFooter numero={numero} data={dataDoc} cliente={cliente} />

        <View style={styles.titleWrap}>
          <Text style={styles.eyebrow}>Orçamento Comercial</Text>
          <Text style={styles.title}>Fornecimento de Materiais</Text>
          <View style={styles.titleBar} />
        </View>

        <View style={styles.infoCard}>
          <InfoCell label="Cliente / Contratante" value={cliente} full />
          <InfoCell label="Referência" value={referencia} />
          <InfoCell label="Número" value={numero} />
          <InfoCell label="Data de Emissão" value={dataDoc} />
          <InfoCell label="Validade" value={validade} />
          <InfoCell label="Responsável" value={assinante} full />
        </View>
        <AuthenticityStamp url={authenticityUrl} />

        {/* Produtos */}
        <SecHead n="01" titulo="Produtos" />
        <View style={{ borderWidth: 1, borderColor: C.s200, borderRadius: 4, overflow: 'hidden', marginBottom: 4 }}>
          <View style={styles.th} fixed>
            <Text style={[styles.thCell, { width: 22, textAlign: 'center' }]}>#</Text>
            <Text style={[styles.thCell, { flex: 1 }]}>Produto</Text>
            {showMarca && <Text style={[styles.thCell, { width: 96 }]}>Fabricante / Modelo</Text>}
            <Text style={[styles.thCell, { width: 26, textAlign: 'center' }]}>Un.</Text>
            <Text style={[styles.thCell, { width: 30, textAlign: 'center' }]}>Qtd</Text>
            {showUnit && <Text style={[styles.thCell, { width: 62, textAlign: 'right' }]}>Vlr. Unit.</Text>}
            {showTotal && <Text style={[styles.thCell, { width: 68, textAlign: 'right' }]}>Vlr. Total</Text>}
          </View>
          {materiais.map((eq, i) => {
            const unit = eq.precoUnitario || 0;
            const tot = (Number(eq.precoUnitario) || 0) * (Number(eq.quantidade) || 0) - (Number(eq.desconto) || 0);
            return (
              <View key={i} style={[styles.tr, i % 2 === 1 ? styles.trAlt : {}]} wrap={false}>
                <Text style={[styles.td, { width: 22, textAlign: 'center', color: C.red, fontFamily: 'Roboto', fontWeight: 700 }]}>{i + 1}</Text>
                <View style={[styles.td, { flex: 1 }]}>
                  <Text style={{ color: C.ink, fontFamily: 'Roboto', fontWeight: 700, fontSize: 8 }}>{eq.descricao}</Text>
                  {showMarca && eq.descricaoDetalhada ? <Text style={{ color: C.s500, fontSize: 7, marginTop: 1, lineHeight: 1.3 }}>{eq.descricaoDetalhada}</Text> : null}
                  {eq.desconto ? <Text style={{ color: C.red, fontSize: 6.5, marginTop: 1 }}>{`desconto: ${brl(eq.desconto)}`}</Text> : null}
                </View>
                {showMarca && <Text style={[styles.td, { width: 96 }]}>{eq.marcaModelo}</Text>}
                <Text style={[styles.td, { width: 26, textAlign: 'center' }]}>{normalizeUnitCode(eq.unidade)}</Text>
                <Text style={[styles.td, { width: 30, textAlign: 'center', fontFamily: 'Roboto', fontWeight: 700 }]}>{(eq.quantidade || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 })}</Text>
                {showUnit && <Text style={[styles.td, { width: 62, textAlign: 'right' }]}>{unit > 0 ? unit.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—'}</Text>}
                {showTotal && <Text style={[styles.td, { width: 68, textAlign: 'right', fontFamily: 'Roboto', fontWeight: 700, color: C.ink }]}>{tot > 0 ? tot.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—'}</Text>}
              </View>
            );
          })}
          {materiais.length === 0 && (
            <View style={styles.tr} wrap={false}><Text style={[styles.td, { flex: 1, color: C.s400, fontStyle: 'italic' }]}>Itens conforme especificação acordada.</Text></View>
          )}
        </View>

        {/* Resumo Financeiro */}
        <SecHead n="02" titulo="Resumo Financeiro" />
        <View style={styles.totalWrap} wrap={false}>
          {showTotal && (
            <>
              <View style={styles.totalRowLight}>
                <Text style={styles.totalLabel}>Subtotal dos produtos</Text>
                <Text style={styles.totalNum}>{brl(brutoProdutos)}</Text>
              </View>
              {totals.discountTotal > 0 && (
                <View style={styles.totalRowLight}>
                  <Text style={styles.totalLabel}>Desconto</Text>
                  <Text style={[styles.totalNum, { color: C.red }]}>{`− ${brl(totals.discountTotal)}`}</Text>
                </View>
              )}
              {totals.freteTotal > 0 && (
                <View style={styles.totalRowLight}>
                  <Text style={styles.totalLabel}>Frete</Text>
                  <Text style={styles.totalNum}>{brl(totals.freteTotal)}</Text>
                </View>
              )}
              {totals.impostosTotal > 0 && (
                <View style={styles.totalRowLight}>
                  <Text style={styles.totalLabel}>Impostos adicionais</Text>
                  <Text style={styles.totalNum}>{brl(totals.impostosTotal)}</Text>
                </View>
              )}
            </>
          )}
          <View style={styles.totalRowNavy}>
            <Text style={styles.totalLabelGold}>Total Geral</Text>
            <Text style={styles.totalValue}>{brl(p.valorTotal)}</Text>
          </View>
        </View>

        {/* Condições Comerciais */}
        <SecHead n="03" titulo="Condições Comerciais" />
        <View style={styles.condCard}>
          <CondRow label="Prazo de entrega" value={nv(p.prazoExecucao) ? p.prazoExecucao : 'A combinar após a confirmação do pedido.'} />
          <CondRow label="Forma de pagamento" value={`${pagamento}${nv(p.faturamento) ? ` — Faturamento: ${p.faturamento}.` : ''}`} />
          <CondRow label="Validade" value={validade} />
          <CondRow label="Garantia" value={garantiaTexto} />
          {freteTxt && p.frete?.modo !== 'valor' ? <CondRow label="Frete" value={freteTxt} /> : null}
          {impostosTxt ? <CondRow label="Impostos" value={impostosTxt} /> : null}
        </View>

        {/* Observações */}
        <SecHead n="04" titulo="Observações" />
        <View minPresenceAhead={40}>
          {nv(p.observacoesComerciais) ? <Text style={styles.para}>{p.observacoesComerciais}</Text> : null}
          <Text style={[styles.para, { marginTop: nv(p.observacoesComerciais) ? 4 : 0 }]}>{AVISO_SEM_INSTALACAO}</Text>
        </View>

        {showCampos && <CamposExtras campos={p.camposPersonalizados} />}

        {/* Contato */}
        <View minPresenceAhead={70} wrap={false}>
          <SecHead titulo="Contato" />
          <View style={[styles.contatoCard, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 9, color: C.ink, fontFamily: 'Roboto', fontWeight: 700 }}>{razao}</Text>
              {nv(companyProfile.endereco) ? <Text style={{ fontSize: 8.5, color: C.s600, marginTop: 2 }}>{companyProfile.endereco}</Text> : null}
              {nv(companyProfile.cnpj) ? <Text style={{ fontSize: 8.5, color: C.s600, marginTop: 1 }}>CNPJ {companyProfile.cnpj}</Text> : null}
              {nv(contato) ? <Text style={{ fontSize: 9, color: C.navy, fontFamily: 'Roboto', fontWeight: 700, marginTop: 3 }}>{contato}</Text> : null}
            </View>
            {nv(qrUrl) ? (
              <View style={{ alignItems: 'center', marginLeft: 10 }}>
                <QrCode text={qrUrl} size={62} />
                <Text style={{ fontSize: 6.5, color: C.s500, fontFamily: 'Roboto', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>Fale conosco</Text>
              </View>
            ) : null}
          </View>
        </View>

        {showAssinatura && (
          <View style={styles.signRow} wrap={false}>
            <View style={styles.signCol}>
              <View style={styles.signLine} />
              <Text style={styles.signName}>{razao}</Text>
              <Text style={styles.signRole}>{assinante}</Text>
            </View>
            <View style={styles.signCol}>
              <View style={styles.signLine} />
              <Text style={styles.signName}>{cliente}</Text>
              <Text style={styles.signRole}>De acordo &amp; Aceite</Text>
            </View>
          </View>
        )}
      </Page>
    </Document>
  );
}
