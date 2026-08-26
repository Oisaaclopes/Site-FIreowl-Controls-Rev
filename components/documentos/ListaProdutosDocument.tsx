import React from 'react';
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { Pedido, CompanyProfile, PedidoEquipmentItem } from '@/lib/types';
import { C, nv, PdfHeader, PdfFooter } from './pdfKit';

export interface ListaProdutosPdfOptions {
  showLogo?: boolean;
}

const styles = StyleSheet.create({
  page: { paddingTop: 58, paddingBottom: 42, paddingHorizontal: 40, fontSize: 9, fontFamily: 'Roboto', color: C.s700 },

  titleWrap: { marginBottom: 12 },
  eyebrow: { color: C.red, fontSize: 8, fontFamily: 'Roboto', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.6 },
  title: { color: C.navy, fontSize: 24, fontFamily: 'Poppins', fontWeight: 700, letterSpacing: 0.3, marginTop: 3 },
  titleBar: { width: 52, height: 4, backgroundColor: C.red, borderRadius: 2, marginTop: 7 },

  infoCard: { flexDirection: 'row', flexWrap: 'wrap', borderWidth: 1, borderColor: C.s200, borderRadius: 6, overflow: 'hidden', marginBottom: 12 },
  infoCell: { width: '50%', paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: C.s100 },
  infoLabel: { color: C.s500, fontSize: 7, fontFamily: 'Roboto', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 },
  infoValue: { color: C.ink, fontSize: 9.5, fontFamily: 'Roboto', fontWeight: 700 },

  summary: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  summaryCard: { flex: 1, backgroundColor: C.s50, borderWidth: 1, borderColor: C.s200, borderLeftWidth: 3, borderLeftColor: C.navy, borderRadius: 6, paddingVertical: 8, paddingHorizontal: 12 },
  summaryValue: { color: C.navy, fontSize: 18, fontFamily: 'Poppins', fontWeight: 700, lineHeight: 1 },
  summaryLabel: { color: C.s500, fontSize: 7.5, fontFamily: 'Roboto', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 3 },

  th: { flexDirection: 'row', backgroundColor: C.navy },
  thCell: { color: C.white, fontSize: 7.5, fontFamily: 'Roboto', fontWeight: 700, textTransform: 'uppercase', paddingVertical: 6, paddingHorizontal: 6 },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.s200, alignItems: 'center' },
  trAlt: { backgroundColor: C.s50 },
  td: { fontSize: 8.5, color: C.s700, paddingVertical: 6, paddingHorizontal: 6 },
  tdBox: { width: 10, height: 10, borderWidth: 1, borderColor: C.s400, borderRadius: 1.5 },
  tfoot: { flexDirection: 'row', backgroundColor: C.s100, borderTopWidth: 1, borderTopColor: C.s300 },
  tfootCell: { fontSize: 8.5, fontFamily: 'Roboto', fontWeight: 700, color: C.ink, paddingVertical: 6, paddingHorizontal: 6 },

  note: { fontSize: 8, color: C.s500, fontStyle: 'italic', marginTop: 10 },

  signRow: { flexDirection: 'row', marginTop: 24, gap: 28 },
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

export function ListaProdutosDocument({ pedido, companyProfile, options }: { pedido: Pedido; companyProfile: CompanyProfile; options?: ListaProdutosPdfOptions }) {
  const p = pedido.proposal;
  const razao = companyProfile.razaoSocial || 'Fireowl Controls';
  const numero = pedido.numeroPedido;
  const dataEmissao = pedido.dataEmissao || '';
  const cliente = pedido.clienteNome || '';
  const responsavel = pedido.responsavelComercialNome || 'Responsável';
  const referencia = pedido.referencia || 'Fornecimento de materiais';

  const showLogo = options?.showLogo !== false;

  const produtos = (p.equipmentItems || []).filter((e: PedidoEquipmentItem) => e.tipo !== 'servico');
  const totalItens = produtos.length;
  const totalQtd = produtos.reduce((a, e) => a + (e.quantidade || 0), 0);

  return (
    <Document title={`Lista de Produtos ${numero}`} author={razao}>
      <Page size="A4" style={styles.page}>
        <PdfHeader razao={razao} label="Lista de Produtos" showLogo={showLogo} />
        <PdfFooter numero={numero} data={dataEmissao} cliente={cliente} />

        <View style={styles.titleWrap}>
          <Text style={styles.eyebrow}>Separação & Conferência</Text>
          <Text style={styles.title}>Lista de Produtos</Text>
          <View style={styles.titleBar} />
        </View>

        <View style={styles.infoCard}>
          <InfoCell label="Cliente / Contratante" value={cliente} />
          <InfoCell label="Número" value={numero} />
          <InfoCell label="Referência / Projeto" value={referencia} full />
          <InfoCell label="Data de Emissão" value={dataEmissao} />
          <InfoCell label="Responsável" value={responsavel} />
        </View>

        <View style={styles.summary}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{totalItens}</Text>
            <Text style={styles.summaryLabel}>Itens distintos</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{totalQtd}</Text>
            <Text style={styles.summaryLabel}>Quantidade total</Text>
          </View>
        </View>

        {produtos.length > 0 ? (
          <View style={{ borderWidth: 1, borderColor: C.s200, borderRadius: 4, overflow: 'hidden' }}>
            <View style={styles.th} fixed>
              <Text style={[styles.thCell, { width: 28, textAlign: 'center' }]}>OK</Text>
              <Text style={[styles.thCell, { width: 24, textAlign: 'center' }]}>#</Text>
              <Text style={[styles.thCell, { flex: 1 }]}>Descrição do Produto</Text>
              <Text style={[styles.thCell, { width: 110 }]}>Marca / Modelo</Text>
              <Text style={[styles.thCell, { width: 34, textAlign: 'center' }]}>Un.</Text>
              <Text style={[styles.thCell, { width: 40, textAlign: 'center' }]}>Qtd</Text>
            </View>
            {produtos.map((eq, i) => (
              <View key={i} style={[styles.tr, i % 2 === 1 ? styles.trAlt : {}]} wrap={false}>
                <View style={{ width: 28, alignItems: 'center' }}><View style={styles.tdBox} /></View>
                <Text style={[styles.td, { width: 24, textAlign: 'center', color: C.red, fontFamily: 'Roboto', fontWeight: 700 }]}>{i + 1}</Text>
                <View style={[styles.td, { flex: 1 }]}><Text style={{ color: C.ink, fontFamily: 'Roboto', fontWeight: 700, fontSize: 8.5 }}>{eq.descricao}</Text>{eq.descricaoDetalhada ? <Text style={{ color: C.s500, fontSize: 7, marginTop: 1, lineHeight: 1.3 }}>{eq.descricaoDetalhada}</Text> : null}</View>
                <Text style={[styles.td, { width: 110 }]}>{eq.marcaModelo}</Text>
                <Text style={[styles.td, { width: 34, textAlign: 'center', textTransform: 'uppercase' }]}>{eq.unidade}</Text>
                <Text style={[styles.td, { width: 40, textAlign: 'center', fontFamily: 'Roboto', fontWeight: 700 }]}>{eq.quantidade}</Text>
              </View>
            ))}
            <View style={styles.tfoot} wrap={false}>
              <Text style={[styles.tfootCell, { flex: 1, textAlign: 'right', textTransform: 'uppercase' }]}>Quantidade total</Text>
              <Text style={[styles.tfootCell, { width: 40, textAlign: 'center' }]}>{totalQtd}</Text>
            </View>
          </View>
        ) : (
          <Text style={{ fontSize: 9, color: C.s400, fontStyle: 'italic' }}>Nenhum produto (material) cadastrado neste pedido.</Text>
        )}

        <Text style={styles.note}>
          Documento de separação e conferência de produtos. Marque a coluna &ldquo;OK&rdquo; à medida que cada item for
          separado/conferido. Não representa nota fiscal.
        </Text>

        <View style={styles.signRow} wrap={false}>
          <View style={styles.signCol}>
            <View style={styles.signLine} />
            <Text style={styles.signName}>Conferido por</Text>
            <Text style={styles.signRole}>{razao}</Text>
          </View>
          <View style={styles.signCol}>
            <View style={styles.signLine} />
            <Text style={styles.signName}>Recebido por</Text>
            <Text style={styles.signRole}>{cliente}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}
