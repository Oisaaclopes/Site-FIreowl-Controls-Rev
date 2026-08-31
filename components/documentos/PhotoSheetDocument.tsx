import React from 'react';
import { Document, Page, StyleSheet, Text, View, Image } from '@react-pdf/renderer';
import { C, PdfHeader, PdfFooter } from './pdfKit';
import type { PhotoSheetConfig, PhotoSheetItem } from '@/lib/photoSheet';

const MARKER_TONE: Record<string, { bg: string; fg: string }> = {
  Antes: { bg: '#E6F2FB', fg: '#1E6FA8' },
  Depois: { bg: '#E7F6EE', fg: '#1E7D52' },
  Falha: { bg: '#FBEAEA', fg: C.red },
  Corrigido: { bg: '#EFE9FA', fg: '#6D4BB6' },
  Pendente: { bg: '#FBF1DA', fg: '#8A5A00' },
};

const styles = StyleSheet.create({
  page: { paddingTop: 58, paddingBottom: 46, paddingHorizontal: 40, fontFamily: 'Roboto', fontSize: 9, color: C.s700 },

  titleWrap: { marginBottom: 10 },
  eyebrow: { color: C.red, fontSize: 8, fontFamily: 'Roboto', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.6 },
  title: { color: C.navy, fontSize: 24, fontFamily: 'Poppins', fontWeight: 700, letterSpacing: 0.3, marginTop: 3 },
  titleBar: { width: 52, height: 4, backgroundColor: C.red, borderRadius: 2, marginTop: 7 },

  infoCard: { flexDirection: 'row', flexWrap: 'wrap', borderWidth: 1, borderColor: C.s200, borderRadius: 6, overflow: 'hidden', marginBottom: 12 },
  infoCell: { width: '50%', paddingVertical: 7, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: C.s100 },
  infoLabel: { color: C.s500, fontSize: 7, fontFamily: 'Roboto', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 },
  infoValue: { color: C.ink, fontSize: 9.5, fontFamily: 'Roboto', fontWeight: 700 },
  obs: { borderWidth: 1, borderColor: C.s200, borderLeftWidth: 3, borderLeftColor: C.navy2, borderRadius: 5, padding: 8, marginBottom: 12, backgroundColor: C.s50 },
  obsLabel: { color: C.s500, fontSize: 7, fontFamily: 'Roboto', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 },
  obsText: { color: C.s700, fontSize: 9, lineHeight: 1.4 },

  // Bloco de evidência (não quebra entre páginas)
  block: { borderWidth: 1, borderColor: C.s200, borderRadius: 7, overflow: 'hidden', marginBottom: 10 },
  evHead: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.navy, paddingVertical: 5, paddingHorizontal: 10 },
  evNum: { color: C.white, fontSize: 8.5, fontFamily: 'Poppins', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' },
  chip: { marginLeft: 8, borderRadius: 3, paddingHorizontal: 6, paddingVertical: 1.5 },
  chipText: { fontSize: 7, fontFamily: 'Roboto', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3 },
  // 218pt: dois blocos + legenda cabem numa página A4 (2 evidências/página, §12).
  imgBox: { height: 218, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center' },
  img: { width: '100%', height: '100%', objectFit: 'contain' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', paddingVertical: 6, paddingHorizontal: 10 },
  legCell: { width: '50%', paddingVertical: 3, paddingRight: 8 },
  legLabel: { color: C.s500, fontSize: 6.8, fontFamily: 'Roboto', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 },
  legValue: { color: C.ink, fontSize: 9, marginTop: 1 },
  legFull: { width: '100%' },

  empty: { color: C.s500, fontSize: 10, marginTop: 10 },
});

const Info = ({ label, value, full }: { label: string; value?: string; full?: boolean }) => (
  <View style={[styles.infoCell, full ? { width: '100%' } : {}]}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value || '—'}</Text>
  </View>
);

const Leg = ({ label, value, full }: { label: string; value?: string; full?: boolean }) => {
  if (!value) return null;
  return (
    <View style={[styles.legCell, full ? styles.legFull : {}]}>
      <Text style={styles.legLabel}>{label}</Text>
      <Text style={styles.legValue}>{value}</Text>
    </View>
  );
};

const EvidenceBlock = ({ item }: { item: PhotoSheetItem }) => {
  const tone = item.marcador ? MARKER_TONE[item.marcador] : undefined;
  // Nota longa é limitada visualmente (a fonte de dados permanece completa, §17).
  const obs = item.observacao && item.observacao.length > 280 ? `${item.observacao.slice(0, 280)}…` : item.observacao;
  return (
    <View style={styles.block} wrap={false}>
      <View style={styles.evHead}>
        <Text style={styles.evNum}>{item.titulo}</Text>
        {tone && (
          <View style={[styles.chip, { backgroundColor: tone.bg }]}>
            <Text style={[styles.chipText, { color: tone.fg }]}>{item.marcador}</Text>
          </View>
        )}
      </View>
      <View style={styles.imgBox}>
        <Image src={item.imageDataUrl} style={styles.img} />
      </View>
      <View style={styles.legend}>
        <Leg label="Local / Setor" value={item.local} />
        <Leg label="Data / Hora" value={item.dataHora} />
        <Leg label="Técnico" value={item.tecnico} />
        <Leg label="Observação" value={obs} full />
      </View>
    </View>
  );
};

export const PhotoSheetDocument = ({ config, items }: { config: PhotoSheetConfig; items: PhotoSheetItem[] }) => {
  const data = new Date(config.dataEmissao).toLocaleDateString('pt-BR');
  return (
    <Document title={`${config.titulo} - ${config.clienteNome}`} author="Fireowl Controls">
      <Page size="A4" style={styles.page}>
        <PdfHeader razao="Fireowl Controls" label="Folha de Fotos" />
        <PdfFooter numero="FDF" data={data} cliente={config.clienteNome} />

        <View style={styles.titleWrap}>
          <Text style={styles.eyebrow}>Registro Fotográfico de Campo</Text>
          <Text style={styles.title}>{config.titulo || 'Folha de Fotos'}</Text>
          {config.subtitulo ? <Text style={{ color: C.s600, fontSize: 9.5, marginTop: 3 }}>{config.subtitulo}</Text> : null}
          <View style={styles.titleBar} />
        </View>

        <View style={styles.infoCard}>
          <Info label="Cliente" value={config.clienteNome} full />
          <Info label="Local / Unidade" value={config.localSetor} />
          <Info label="Referência" value={config.referencia} />
          <Info label="Responsável Técnico" value={config.responsavel} />
          <Info label="Data de Emissão" value={data} />
          <Info label="Evidências" value={String(items.length)} />
          <Info label="Documento" value="FDF" />
        </View>

        {config.observacao ? (
          <View style={styles.obs} wrap={false}>
            <Text style={styles.obsLabel}>Observação Geral</Text>
            <Text style={styles.obsText}>{config.observacao}</Text>
          </View>
        ) : null}

        {items.length ? (
          items.map((item) => <EvidenceBlock key={item.clientUuid} item={item} />)
        ) : (
          <Text style={styles.empty}>Nenhuma evidência selecionada.</Text>
        )}
      </Page>
    </Document>
  );
};
