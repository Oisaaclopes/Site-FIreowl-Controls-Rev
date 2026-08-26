import React from 'react';
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { Pedido, CompanyProfile, PedidoEquipmentItem } from '@/lib/types';
import { C, brl, nv, PdfHeader, PdfFooter } from './pdfKit';
import { DocOptions } from '@/lib/documentos';

export type NotaVariante = 'servico' | 'produtos';

export type NotaPdfOptions = Partial<DocOptions>;

const styles = StyleSheet.create({
  page: { paddingTop: 58, paddingBottom: 42, paddingHorizontal: 40, fontSize: 9, fontFamily: 'Roboto', color: C.s700 },

  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  eyebrow: { color: C.red, fontSize: 8, fontFamily: 'Roboto', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.6 },
  title: { color: C.navy, fontSize: 24, fontFamily: 'Poppins', fontWeight: 700, letterSpacing: 0.3, marginTop: 3 },
  titleBar: { width: 52, height: 4, backgroundColor: C.red, borderRadius: 2, marginTop: 7 },
  // Selo "não fiscal"
  naoFiscal: { alignSelf: 'flex-start', borderWidth: 1.2, borderColor: C.red, borderRadius: 4, paddingVertical: 4, paddingHorizontal: 8 },
  naoFiscalText: { color: C.red, fontSize: 8, fontFamily: 'Poppins', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 },
  naoFiscalSub: { color: C.s400, fontSize: 6.5, fontFamily: 'Roboto', textTransform: 'uppercase', letterSpacing: 0.4, marginTop: 2, textAlign: 'right' },

  infoCard: { flexDirection: 'row', flexWrap: 'wrap', borderWidth: 1, borderColor: C.s200, borderRadius: 6, overflow: 'hidden', marginBottom: 14 },
  infoCell: { width: '50%', paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: C.s100 },
  infoLabel: { color: C.s500, fontSize: 7, fontFamily: 'Roboto', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 },
  infoValue: { color: C.ink, fontSize: 9.5, fontFamily: 'Roboto', fontWeight: 700 },

  th: { flexDirection: 'row', backgroundColor: C.navy },
  thCell: { color: C.white, fontSize: 7.5, fontFamily: 'Roboto', fontWeight: 700, textTransform: 'uppercase', paddingVertical: 6, paddingHorizontal: 6 },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.s200 },
  trAlt: { backgroundColor: C.s50 },
  td: { fontSize: 8, color: C.s700, paddingVertical: 5, paddingHorizontal: 6 },
  tfoot: { flexDirection: 'row', backgroundColor: C.s100, borderTopWidth: 1, borderTopColor: C.s300 },
  tfootCell: { fontSize: 8, fontFamily: 'Roboto', fontWeight: 700, color: C.ink, paddingVertical: 5, paddingHorizontal: 6 },

  totalWrap: { marginTop: 6, borderWidth: 1, borderColor: C.s200, borderRadius: 5, overflow: 'hidden', marginBottom: 12 },
  totalRowLight: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: C.s100, paddingVertical: 6, paddingHorizontal: 10 },
  totalRowNavy: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: C.navy, paddingVertical: 9, paddingHorizontal: 12, borderTopWidth: 3, borderTopColor: C.red },
  totalLabelGold: { color: C.gold, fontSize: 9, fontFamily: 'Poppins', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 },
  totalValue: { color: C.white, fontSize: 16, fontFamily: 'Poppins', fontWeight: 700 },

  disclaimer: { backgroundColor: '#fef3f2', borderWidth: 1, borderColor: '#f5c2c0', borderRadius: 5, padding: 9, marginBottom: 10 },
  disclaimerText: { fontSize: 8, color: '#a51515' },

  note: { fontSize: 8, color: C.s500, marginBottom: 4 },

  signRow: { flexDirection: 'row', marginTop: 22, gap: 28 },
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

export function NotaDocument({ pedido, companyProfile, variante, options }: { pedido: Pedido; companyProfile: CompanyProfile; variante: NotaVariante; options?: NotaPdfOptions }) {
  const p = pedido.proposal;
  const razao = companyProfile.razaoSocial || 'Fireowl Controls';
  const isServico = variante === 'servico';

  const titulo = isServico ? 'Nota de Serviço' : 'Nota de Produtos';
  const numero = pedido.numeroPedido.replace(/^PED-/, isServico ? 'NS-' : 'NP-');
  const dataEmissao = pedido.dataEmissao || '';
  const cliente = pedido.clienteNome || '';
  const responsavel = pedido.responsavelComercialNome || 'Responsável';
  const referencia = pedido.referencia || (isServico ? 'Serviços executados' : 'Produtos entregues');

  const showLogo = options?.showLogo !== false;
  const showUnit = options?.showValorUnitario !== false;
  const showTotal = options?.showSubtotal !== false;
  const showDetalhe = options?.showDescricaoDetalhada !== false;
  const showAssinatura = options?.showAssinaturaCliente !== false;
  const dataDoc = options?.dataHoje ? new Date().toISOString().split('T')[0] : dataEmissao;

  const itens = (p.equipmentItems || []).filter((e: PedidoEquipmentItem) => (isServico ? e.tipo === 'servico' : e.tipo !== 'servico'));
  const showMarca = !isServico && showDetalhe;
  const maoDeObra = isServico ? (p.maoDeObra || 0) : 0;
  const subtotal = itens.reduce((a, e) => a + (e.precoUnitario || 0) * e.quantidade, 0);
  const total = subtotal + maoDeObra;

  return (
    <Document title={`${titulo} ${numero}`} author={razao}>
      <Page size="A4" style={styles.page}>
        <PdfHeader razao={razao} label={titulo} showLogo={showLogo} />
        <PdfFooter numero={numero} data={dataDoc} cliente={cliente} />

        <View style={styles.topRow}>
          <View>
            <Text style={styles.eyebrow}>{isServico ? 'Registro de Serviços' : 'Registro de Entrega'}</Text>
            <Text style={styles.title}>{titulo}</Text>
            <View style={styles.titleBar} />
          </View>
          <View>
            <View style={styles.naoFiscal}>
              <Text style={styles.naoFiscalText}>Documento não fiscal</Text>
            </View>
            <Text style={styles.naoFiscalSub}>Uso interno · não substitui NF</Text>
          </View>
        </View>

        <View style={styles.infoCard}>
          <InfoCell label="Cliente / Contratante" value={cliente} />
          <InfoCell label="Número (interno)" value={numero} />
          <InfoCell label="Referência / Projeto" value={referencia} full />
          <InfoCell label="Data de Emissão" value={dataDoc} />
          <InfoCell label="Responsável" value={responsavel} />
        </View>

        {itens.length > 0 ? (
          <View style={{ borderWidth: 1, borderColor: C.s200, borderRadius: 4, overflow: 'hidden' }}>
            <View style={styles.th} fixed>
              <Text style={[styles.thCell, { width: 24, textAlign: 'center' }]}>#</Text>
              <Text style={[styles.thCell, { flex: 1 }]}>Descrição</Text>
              {showMarca && <Text style={[styles.thCell, { width: 96 }]}>Marca / Modelo</Text>}
              <Text style={[styles.thCell, { width: 30, textAlign: 'center' }]}>Un.</Text>
              <Text style={[styles.thCell, { width: 30, textAlign: 'center' }]}>Qtd</Text>
              {showUnit && <Text style={[styles.thCell, { width: 62, textAlign: 'right' }]}>Unit.</Text>}
              {showTotal && <Text style={[styles.thCell, { width: 70, textAlign: 'right' }]}>Total</Text>}
            </View>
            {itens.map((eq, i) => {
              const unit = eq.precoUnitario || 0;
              const tot = unit * eq.quantidade;
              return (
                <View key={i} style={[styles.tr, i % 2 === 1 ? styles.trAlt : {}]} wrap={false}>
                  <Text style={[styles.td, { width: 24, textAlign: 'center', color: C.red, fontFamily: 'Roboto', fontWeight: 700 }]}>{i + 1}</Text>
                  <View style={[styles.td, { flex: 1 }]}><Text style={{ color: C.ink, fontFamily: 'Roboto', fontWeight: 700, fontSize: 8 }}>{eq.descricao}</Text>{showDetalhe && eq.descricaoDetalhada ? <Text style={{ color: C.s500, fontSize: 7, marginTop: 1, lineHeight: 1.3 }}>{eq.descricaoDetalhada}</Text> : null}</View>
                  {showMarca && <Text style={[styles.td, { width: 96 }]}>{eq.marcaModelo}</Text>}
                  <Text style={[styles.td, { width: 30, textAlign: 'center', textTransform: 'uppercase' }]}>{eq.unidade}</Text>
                  <Text style={[styles.td, { width: 30, textAlign: 'center', fontFamily: 'Roboto', fontWeight: 700 }]}>{eq.quantidade}</Text>
                  {showUnit && <Text style={[styles.td, { width: 62, textAlign: 'right' }]}>{unit > 0 ? unit.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—'}</Text>}
                  {showTotal && <Text style={[styles.td, { width: 70, textAlign: 'right', fontFamily: 'Roboto', fontWeight: 700, color: C.ink }]}>{tot > 0 ? tot.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—'}</Text>}
                </View>
              );
            })}
            {showTotal && (
              <View style={styles.tfoot} wrap={false}>
                <Text style={[styles.tfootCell, { flex: 1, textAlign: 'right', textTransform: 'uppercase' }]}>Subtotal</Text>
                <Text style={[styles.tfootCell, { width: 70, textAlign: 'right' }]}>{brl(subtotal)}</Text>
              </View>
            )}
          </View>
        ) : (
          <Text style={{ fontSize: 9, color: C.s400, fontStyle: 'italic' }}>
            {isServico ? 'Nenhum serviço lançado neste pedido.' : 'Nenhum produto (material) lançado neste pedido.'}
          </Text>
        )}

        <View style={styles.totalWrap} wrap={false}>
          {showTotal && maoDeObra > 0 && (
            <View style={styles.totalRowLight}>
              <Text style={{ fontSize: 8, fontFamily: 'Roboto', fontWeight: 700, color: C.ink, textTransform: 'uppercase' }}>Mão de obra / Serviços adicionais</Text>
              <Text style={{ fontSize: 8, fontFamily: 'Roboto', fontWeight: 700, color: C.ink }}>{brl(maoDeObra)}</Text>
            </View>
          )}
          <View style={styles.totalRowNavy}>
            <Text style={styles.totalLabelGold}>Valor Total</Text>
            <Text style={styles.totalValue}>{brl(total)}</Text>
          </View>
        </View>

        <View style={styles.disclaimer} wrap={false}>
          <Text style={styles.disclaimerText}>
            Este é um documento interno de controle e conferência. NÃO é documento fiscal e não substitui a Nota Fiscal
            {isServico ? ' de Serviços (NFS-e)' : ' Eletrônica (NF-e)'} exigida pela legislação. Não possui validade tributária.
          </Text>
        </View>

        {nv(p.faturamento) && <Text style={styles.note}><Text style={{ fontFamily: 'Roboto', fontWeight: 700, color: C.ink }}>Faturamento: </Text>{p.faturamento}</Text>}

        {showAssinatura && (
          <View style={styles.signRow} wrap={false}>
            <View style={styles.signCol}>
              <View style={styles.signLine} />
              <Text style={styles.signName}>{isServico ? 'Prestador' : 'Entregue por'}</Text>
              <Text style={styles.signRole}>{razao}</Text>
            </View>
            <View style={styles.signCol}>
              <View style={styles.signLine} />
              <Text style={styles.signName}>{isServico ? 'Contratante' : 'Recebido por'}</Text>
              <Text style={styles.signRole}>{cliente}</Text>
            </View>
          </View>
        )}
      </Page>
    </Document>
  );
}
