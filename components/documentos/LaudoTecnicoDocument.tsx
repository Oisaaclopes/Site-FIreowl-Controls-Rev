import React from 'react';
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { Pedido, CompanyProfile, PedidoEquipmentItem } from '@/lib/types';
import { C, nv, lnv, PdfHeader, PdfFooter, CamposExtras } from './pdfKit';
import { DocOptions } from '@/lib/documentos';

export type LaudoTecnicoPdfOptions = Partial<DocOptions>;

const styles = StyleSheet.create({
  page: { paddingTop: 58, paddingBottom: 42, paddingHorizontal: 40, fontSize: 9, fontFamily: 'Roboto', color: C.s700 },

  titleWrap: { marginBottom: 12 },
  eyebrow: { color: C.red, fontSize: 8, fontFamily: 'Roboto', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.6 },
  title: { color: C.navy, fontSize: 24, fontFamily: 'Poppins', fontWeight: 700, letterSpacing: 0.3, marginTop: 3 },
  titleBar: { width: 52, height: 4, backgroundColor: C.red, borderRadius: 2, marginTop: 7 },

  infoCard: { flexDirection: 'row', flexWrap: 'wrap', borderWidth: 1, borderColor: C.s200, borderRadius: 6, overflow: 'hidden', marginBottom: 14 },
  infoCell: { width: '50%', paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: C.s100 },
  infoLabel: { color: C.s500, fontSize: 7, fontFamily: 'Roboto', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 },
  infoValue: { color: C.ink, fontSize: 9.5, fontFamily: 'Roboto', fontWeight: 700 },

  secHead: { flexDirection: 'row', alignItems: 'center', borderLeftWidth: 3, borderLeftColor: C.red, paddingLeft: 8, marginTop: 6, marginBottom: 6 },
  secNum: { backgroundColor: C.navy, color: C.white, fontSize: 8, fontFamily: 'Roboto', fontWeight: 700, paddingVertical: 1.5, paddingHorizontal: 5, borderRadius: 2, marginRight: 7 },
  secTitle: { color: C.navy, fontSize: 11, fontFamily: 'Poppins', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 },

  card: { backgroundColor: C.s50, borderWidth: 1, borderColor: C.s200, borderRadius: 5, padding: 10, marginBottom: 10 },
  para: { fontSize: 9, color: C.s700, textAlign: 'justify', lineHeight: 1.4 },

  bulletRow: { flexDirection: 'row', marginBottom: 3 },
  bulletDot: { color: C.red, fontFamily: 'Roboto', fontWeight: 700, marginRight: 6 },
  bulletText: { flex: 1, fontSize: 8.8, color: C.s700 },

  th: { flexDirection: 'row', backgroundColor: C.navy },
  thCell: { color: C.white, fontSize: 7.5, fontFamily: 'Roboto', fontWeight: 700, textTransform: 'uppercase', paddingVertical: 6, paddingHorizontal: 6 },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.s200, alignItems: 'center' },
  trAlt: { backgroundColor: C.s50 },
  td: { fontSize: 8, color: C.s700, paddingVertical: 5, paddingHorizontal: 6 },
  tdBox: { width: 9, height: 9, borderWidth: 1, borderColor: C.s400, borderRadius: 1.5 },

  parecerBox: { borderWidth: 1, borderColor: C.s300, borderRadius: 4, minHeight: 60, padding: 8, marginTop: 2 },
  artRow: { flexDirection: 'row', gap: 14, marginTop: 8, marginBottom: 4 },
  artField: { flex: 1 },
  artLabel: { fontSize: 7.5, color: C.s500, fontFamily: 'Roboto', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 3 },
  artLine: { borderBottomWidth: 1, borderBottomColor: C.s400, height: 16 },

  note: { fontSize: 8, color: C.s500, fontStyle: 'italic', marginTop: 8 },

  signRow: { flexDirection: 'row', marginTop: 22, gap: 28 },
  signCol: { flex: 1, alignItems: 'center' },
  signLine: { borderBottomWidth: 1, borderBottomColor: C.s400, width: '100%', height: 26, marginBottom: 5 },
  signName: { fontFamily: 'Roboto', fontWeight: 700, color: C.ink, fontSize: 8, textTransform: 'uppercase' },
  signRole: { fontSize: 7.5, color: C.s500, textTransform: 'uppercase' },
});

const InfoCell = ({ label, value, full }: { label: string; value: string; full?: boolean }) => (
  <View style={[styles.infoCell, full ? { width: '100%' } : {}]}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value || '—'}</Text>
  </View>
);

const SecHead = ({ n, titulo }: { n: string; titulo: string }) => (
  <View style={styles.secHead} minPresenceAhead={50}>
    <Text style={styles.secNum}>{n}</Text>
    <Text style={styles.secTitle}>{titulo}</Text>
  </View>
);

export function LaudoTecnicoDocument({ pedido, companyProfile, options }: { pedido: Pedido; companyProfile: CompanyProfile; options?: LaudoTecnicoPdfOptions }) {
  const p = pedido.proposal;
  const razao = companyProfile.razaoSocial || 'Fireowl Controls';
  const fantasia = companyProfile.nomeFantasia || razao;
  const numero = pedido.numeroPedido.replace(/^PED-/, 'LT-');
  const dataEmissao = pedido.dataEmissao || '';
  const cliente = pedido.clienteNome || '';
  const responsavel = pedido.responsavelComercialNome || 'Responsável Técnico';
  const referencia = pedido.referencia || 'Inspeção técnica';

  const showLogo = options?.showLogo !== false;
  const showMarca = options?.showDescricaoDetalhada !== false;
  const showAssinatura = options?.showAssinaturaCliente !== false;
  const showCampos = options?.showCamposPersonalizados === true;
  const dataDoc = options?.dataHoje ? new Date().toISOString().split('T')[0] : dataEmissao;

  const itens = p.equipmentItems || [];
  const normas = lnv(p.diretrizesNormativas) ? p.diretrizesNormativas : ['NBR 17240 — Sistemas de detecção e alarme de incêndio', 'NPT 019 (CBPMESP) — SDAI', 'Instrução Técnica do Corpo de Bombeiros aplicável'];
  const objetivo = nv(p.escopoServico) ? p.escopoServico : (nv(p.objetivo) ? p.objetivo : 'Verificação das condições técnicas e de conformidade do sistema, conforme normas de referência.');
  const parecer = nv(p.conclusao) ? p.conclusao : 'Com base na inspeção realizada e nas normas de referência, o sistema encontra-se em conformidade nos pontos verificados, ressalvadas as observações registradas neste laudo. Recomenda-se a manutenção periódica para preservação do desempenho.';

  return (
    <Document title={`Laudo Técnico ${numero}`} author={razao}>
      <Page size="A4" style={styles.page}>
        <PdfHeader razao={fantasia} label="Laudo Técnico" showLogo={showLogo} />
        <PdfFooter numero={numero} data={dataDoc} cliente={cliente} />

        <View style={styles.titleWrap}>
          <Text style={styles.eyebrow}>Inspeção Técnica de Conformidade</Text>
          <Text style={styles.title}>Laudo Técnico</Text>
          <View style={styles.titleBar} />
        </View>

        <View style={styles.infoCard}>
          <InfoCell label="Cliente / Contratante" value={cliente} />
          <InfoCell label="Número do Laudo" value={numero} />
          <InfoCell label="Local / Referência" value={referencia} full />
          <InfoCell label="Data da Inspeção" value={dataDoc} />
          <InfoCell label="Responsável Técnico" value={responsavel} />
        </View>

        <SecHead n="01" titulo="Objetivo da Inspeção" />
        <View style={styles.card}>
          <Text style={styles.para}>{objetivo}</Text>
        </View>

        <SecHead n="02" titulo="Normas e Referências" />
        {normas.filter(nv).map((it, i) => (
          <View key={i} style={styles.bulletRow}>
            <Text style={styles.bulletDot}>•</Text>
            <Text style={styles.bulletText}>{it}</Text>
          </View>
        ))}

        {itens.length > 0 && (
          <View minPresenceAhead={70}>
            <SecHead n="03" titulo="Itens Inspecionados" />
            <View style={{ borderWidth: 1, borderColor: C.s200, borderRadius: 4, overflow: 'hidden', marginBottom: 10 }}>
              <View style={styles.th} fixed>
                <Text style={[styles.thCell, { width: 22, textAlign: 'center' }]}>#</Text>
                <Text style={[styles.thCell, { flex: 1 }]}>Descrição / Dispositivo</Text>
                {showMarca && <Text style={[styles.thCell, { width: 92 }]}>Marca / Modelo</Text>}
                <Text style={[styles.thCell, { width: 30, textAlign: 'center' }]}>Qtd</Text>
                <Text style={[styles.thCell, { width: 46, textAlign: 'center' }]}>Conf.</Text>
                <Text style={[styles.thCell, { width: 46, textAlign: 'center' }]}>N/Conf.</Text>
              </View>
              {itens.map((eq: PedidoEquipmentItem, i) => (
                <View key={i} style={[styles.tr, i % 2 === 1 ? styles.trAlt : {}]} wrap={false}>
                  <Text style={[styles.td, { width: 22, textAlign: 'center', color: C.red, fontFamily: 'Roboto', fontWeight: 700 }]}>{i + 1}</Text>
                  <View style={[styles.td, { flex: 1 }]}>
                    <Text style={{ color: C.ink, fontFamily: 'Roboto', fontWeight: 700, fontSize: 8 }}>{eq.descricao}</Text>
                    {showMarca && eq.descricaoDetalhada ? <Text style={{ color: C.s500, fontSize: 7, marginTop: 1, lineHeight: 1.3 }}>{eq.descricaoDetalhada}</Text> : null}
                  </View>
                  {showMarca && <Text style={[styles.td, { width: 92 }]}>{eq.marcaModelo}</Text>}
                  <Text style={[styles.td, { width: 30, textAlign: 'center', fontFamily: 'Roboto', fontWeight: 700 }]}>{eq.quantidade}</Text>
                  <View style={{ width: 46, alignItems: 'center' }}><View style={styles.tdBox} /></View>
                  <View style={{ width: 46, alignItems: 'center' }}><View style={styles.tdBox} /></View>
                </View>
              ))}
            </View>
          </View>
        )}

        <View minPresenceAhead={110} wrap={false}>
          <SecHead n={itens.length > 0 ? '04' : '03'} titulo="Parecer Técnico" />
          <View style={styles.card}>
            <Text style={styles.para}>{parecer}</Text>
          </View>
          <Text style={styles.artLabel}>Observações e não conformidades</Text>
          <View style={styles.parecerBox} />
        </View>

        {showCampos && <CamposExtras campos={p.camposPersonalizados} />}

        <View minPresenceAhead={130} wrap={false}>
          <SecHead n={itens.length > 0 ? '05' : '04'} titulo="Responsável Técnico" />
          <View style={styles.artRow}>
            <View style={styles.artField}>
              <Text style={styles.artLabel}>ART / CREA nº</Text>
              <View style={styles.artLine} />
            </View>
            <View style={styles.artField}>
              <Text style={styles.artLabel}>Data</Text>
              <View style={styles.artLine} />
            </View>
          </View>

          <View style={styles.signRow}>
            <View style={styles.signCol}>
              <View style={styles.signLine} />
              <Text style={styles.signName}>{responsavel}</Text>
              <Text style={styles.signRole}>Responsável Técnico — {razao}</Text>
            </View>
            {showAssinatura && (
              <View style={styles.signCol}>
                <View style={styles.signLine} />
                <Text style={styles.signName}>{cliente}</Text>
                <Text style={styles.signRole}>Ciente — Contratante</Text>
              </View>
            )}
          </View>

          <Text style={styles.note}>
            Este laudo reflete as condições verificadas na data da inspeção. A validade e a emissão de ART, quando
            aplicável, seguem a legislação vigente e a responsabilidade do profissional habilitado.
          </Text>
        </View>
      </Page>
    </Document>
  );
}
