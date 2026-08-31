import React from 'react';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { C, PdfHeader, PdfFooter } from './pdfKit';
import { PhotoComparisonBlock } from './PhotoComparisonBlock';
import type { PhotoSheetConfig } from '@/lib/photoSheet';
import type { ComparisonSheetItem } from '@/lib/comparisonSheet';

const styles = StyleSheet.create({
  page: { paddingTop: 58, paddingBottom: 46, paddingHorizontal: 40, fontFamily: 'Roboto', fontSize: 9, color: C.s700 },
  titleWrap: { marginBottom: 10 },
  eyebrow: { color: C.red, fontSize: 8, fontFamily: 'Roboto', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.6 },
  title: { color: C.navy, fontSize: 22, fontFamily: 'Poppins', fontWeight: 700, letterSpacing: 0.3, marginTop: 3 },
  titleBar: { width: 52, height: 4, backgroundColor: C.red, borderRadius: 2, marginTop: 7 },
  infoCard: { flexDirection: 'row', flexWrap: 'wrap', borderWidth: 1, borderColor: C.s200, borderRadius: 6, overflow: 'hidden', marginBottom: 12 },
  infoCell: { width: '50%', paddingVertical: 7, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: C.s100 },
  infoLabel: { color: C.s500, fontSize: 7, fontFamily: 'Roboto', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 },
  infoValue: { color: C.ink, fontSize: 9.5, fontFamily: 'Roboto', fontWeight: 700 },
  empty: { color: C.s500, fontSize: 10, marginTop: 10 },
});

const Info = ({ label, value, full }: { label: string; value?: string; full?: boolean }) => (
  <View style={[styles.infoCell, full ? { width: '100%' } : {}]}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value || '—'}</Text>
  </View>
);

/** Folha de Fotos no modo Antes × Depois — uma comparação por página (§A7). */
export const PhotoComparisonDocument = ({ config, items }: { config: PhotoSheetConfig; items: ComparisonSheetItem[] }) => {
  const data = new Date(config.dataEmissao).toLocaleDateString('pt-BR');
  return (
    <Document title={`${config.titulo} - ${config.clienteNome}`} author="Fireowl Controls">
      {items.length === 0 ? (
        <Page size="A4" style={styles.page}>
          <PdfHeader razao="Fireowl Controls" label="Folha de Fotos" />
          <PdfFooter numero="FDF" data={data} cliente={config.clienteNome} />
          <Text style={styles.empty}>Nenhuma comparação selecionada.</Text>
        </Page>
      ) : (
        items.map((item, i) => (
          <Page key={item.id} size="A4" style={styles.page}>
            <PdfHeader razao="Fireowl Controls" label="Folha de Fotos — Antes × Depois" />
            <PdfFooter numero="FDF" data={data} cliente={config.clienteNome} />
            {i === 0 && (
              <>
                <View style={styles.titleWrap}>
                  <Text style={styles.eyebrow}>Comprovação de Correção — Antes × Depois</Text>
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
                  <Info label="Comparações" value={String(items.length)} />
                </View>
              </>
            )}
            <PhotoComparisonBlock item={item} />
          </Page>
        ))
      )}
    </Document>
  );
};
