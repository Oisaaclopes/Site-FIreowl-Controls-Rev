import React from 'react';
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { Pedido, CompanyProfile, PedidoEquipmentItem } from '@/lib/types';
import { C, nv, PdfHeader, PdfFooter, CapaBanner } from './pdfKit';
import { PersonalizadoData } from './PersonalizadoConfigModal';

interface Props {
  pedido: Pedido;
  companyProfile: CompanyProfile;
  data: PersonalizadoData;
  showLogo?: boolean;
  dataHoje?: boolean;
  capaImagemUrl?: string;
}

const styles = StyleSheet.create({
  page: { paddingTop: 58, paddingBottom: 42, paddingHorizontal: 40, fontSize: 9, fontFamily: 'Roboto', color: C.s700 },

  eyebrow: { color: C.red, fontSize: 8, fontFamily: 'Roboto', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.6 },
  title: { color: C.navy, fontSize: 23, fontFamily: 'Poppins', fontWeight: 700, letterSpacing: 0.3, marginTop: 3, lineHeight: 1.15 },
  titleBar: { width: 52, height: 4, backgroundColor: C.red, borderRadius: 2, marginTop: 7, marginBottom: 12 },

  infoCard: { flexDirection: 'row', flexWrap: 'wrap', borderWidth: 1, borderColor: C.s200, borderRadius: 6, overflow: 'hidden', marginBottom: 14 },
  infoCell: { width: '50%', paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: C.s100 },
  infoLabel: { color: C.s500, fontSize: 7, fontFamily: 'Roboto', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 },
  infoValue: { color: C.ink, fontSize: 9.5, fontFamily: 'Roboto', fontWeight: 700 },

  secHead: { flexDirection: 'row', alignItems: 'center', borderLeftWidth: 3, borderLeftColor: C.red, paddingLeft: 8, marginTop: 8, marginBottom: 5 },
  secTitle: { color: C.navy, fontSize: 11, fontFamily: 'Poppins', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 },
  para: { fontSize: 9, color: C.s700, textAlign: 'justify', lineHeight: 1.45 },

  th: { flexDirection: 'row', backgroundColor: C.navy },
  thCell: { color: C.white, fontSize: 7.5, fontFamily: 'Roboto', fontWeight: 700, textTransform: 'uppercase', paddingVertical: 6, paddingHorizontal: 6 },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.s200 },
  trAlt: { backgroundColor: C.s50 },
  td: { fontSize: 8, color: C.s700, paddingVertical: 5, paddingHorizontal: 6 },

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

export function PersonalizadoDocument({ pedido, companyProfile, data, showLogo = true, dataHoje = false, capaImagemUrl }: Props) {
  const razao = companyProfile.razaoSocial || 'Fireowl Controls';
  const fantasia = companyProfile.nomeFantasia || razao;
  const numero = pedido.numeroPedido;
  const cliente = pedido.clienteNome || '';
  const responsavel = pedido.responsavelComercialNome || 'Responsável';
  const referencia = pedido.referencia || '—';
  const dataDoc = dataHoje ? new Date().toISOString().split('T')[0] : (pedido.dataEmissao || '');
  const titulo = data.titulo || 'Documento';
  const itens = pedido.proposal?.equipmentItems || [];

  return (
    <Document title={`${titulo} ${numero}`} author={razao}>
      <Page size="A4" style={styles.page}>
        <PdfHeader razao={fantasia} label={titulo} showLogo={showLogo} />
        <CapaBanner capaImagemUrl={capaImagemUrl} />
        <PdfFooter numero={numero} data={dataDoc} cliente={cliente} />

        <View>
          <Text style={styles.eyebrow}>Documento Personalizado</Text>
          <Text style={styles.title}>{titulo}</Text>
          <View style={styles.titleBar} />
        </View>

        <View style={styles.infoCard}>
          <InfoCell label="Cliente / Contratante" value={cliente} />
          <InfoCell label="Número" value={numero} />
          <InfoCell label="Referência / Projeto" value={referencia} full />
          <InfoCell label="Data" value={dataDoc} />
          <InfoCell label="Responsável" value={responsavel} />
        </View>

        {data.campos.map((campo, i) => (
          <View key={i} minPresenceAhead={50} wrap={false}>
            <View style={styles.secHead}>
              <Text style={styles.secTitle}>{campo.rotulo || `Campo ${i + 1}`}</Text>
            </View>
            <Text style={styles.para}>{campo.valor || '—'}</Text>
          </View>
        ))}

        {data.incluirItens && itens.length > 0 && (
          <View minPresenceAhead={60}>
            <View style={styles.secHead}>
              <Text style={styles.secTitle}>Itens do Pedido</Text>
            </View>
            <View style={{ borderWidth: 1, borderColor: C.s200, borderRadius: 4, overflow: 'hidden' }}>
              <View style={styles.th} fixed>
                <Text style={[styles.thCell, { width: 24, textAlign: 'center' }]}>#</Text>
                <Text style={[styles.thCell, { flex: 1 }]}>Descrição</Text>
                <Text style={[styles.thCell, { width: 96 }]}>Marca / Modelo</Text>
                <Text style={[styles.thCell, { width: 34, textAlign: 'center' }]}>Un.</Text>
                <Text style={[styles.thCell, { width: 34, textAlign: 'center' }]}>Qtd</Text>
              </View>
              {itens.map((eq: PedidoEquipmentItem, i) => (
                <View key={i} style={[styles.tr, i % 2 === 1 ? styles.trAlt : {}]} wrap={false}>
                  <Text style={[styles.td, { width: 24, textAlign: 'center', color: C.red, fontFamily: 'Roboto', fontWeight: 700 }]}>{i + 1}</Text>
                  <View style={[styles.td, { flex: 1 }]}>
                    <Text style={{ color: C.ink, fontFamily: 'Roboto', fontWeight: 700, fontSize: 8 }}>{eq.descricao}</Text>
                    {eq.descricaoDetalhada ? <Text style={{ color: C.s500, fontSize: 7, marginTop: 1, lineHeight: 1.3 }}>{eq.descricaoDetalhada}</Text> : null}
                  </View>
                  <Text style={[styles.td, { width: 96 }]}>{eq.marcaModelo}</Text>
                  <Text style={[styles.td, { width: 34, textAlign: 'center', textTransform: 'uppercase' }]}>{eq.unidade}</Text>
                  <Text style={[styles.td, { width: 34, textAlign: 'center', fontFamily: 'Roboto', fontWeight: 700 }]}>{eq.quantidade}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {data.campos.length === 0 && !(data.incluirItens && itens.length > 0) && (
          <Text style={{ fontSize: 9, color: C.s400, fontStyle: 'italic' }}>Documento sem campos definidos.</Text>
        )}

        {data.incluirAssinatura && (
          <View style={styles.signRow} wrap={false}>
            <View style={styles.signCol}>
              <View style={styles.signLine} />
              <Text style={styles.signName}>{razao}</Text>
              <Text style={styles.signRole}>{nv(responsavel) ? responsavel : 'Responsável'}</Text>
            </View>
            <View style={styles.signCol}>
              <View style={styles.signLine} />
              <Text style={styles.signName}>{cliente}</Text>
              <Text style={styles.signRole}>Ciente &amp; De acordo</Text>
            </View>
          </View>
        )}
      </Page>
    </Document>
  );
}
