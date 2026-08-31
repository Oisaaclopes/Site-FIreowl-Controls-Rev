import React from 'react';
import { StyleSheet, Text, View, Image } from '@react-pdf/renderer';
import { C } from './pdfKit';
import type { ComparisonSheetItem } from '@/lib/comparisonSheet';

const RESULT_TONE: Record<string, { bg: string; fg: string }> = {
  Corrigido: { bg: '#E7F6EE', fg: '#1E7D52' },
  'Parcialmente corrigido': { bg: '#FBF1DA', fg: '#8A5A00' },
  Pendente: { bg: '#FBEAEA', fg: C.red },
};

const s = StyleSheet.create({
  block: { borderWidth: 1, borderColor: C.s200, borderRadius: 8, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.navy, paddingVertical: 6, paddingHorizontal: 12 },
  headNum: { color: C.white, fontSize: 9, fontFamily: 'Poppins', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' },
  chip: { borderRadius: 3, paddingHorizontal: 7, paddingVertical: 2 },
  chipText: { fontSize: 7.5, fontFamily: 'Roboto', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3 },

  pair: { flexDirection: 'row' },
  col: { width: '50%' },
  colLabel: { paddingVertical: 4, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  labelAntes: { color: '#1E6FA8', fontSize: 8, fontFamily: 'Roboto', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 },
  labelDepois: { color: '#1E7D52', fontSize: 8, fontFamily: 'Roboto', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 },
  meta: { fontSize: 7, color: C.s500 },
  imgBox: { height: 258, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center' },
  imgBoxRight: { borderLeftWidth: 1, borderLeftColor: C.s200 },
  img: { width: '100%', height: '100%', objectFit: 'contain' },

  info: { paddingVertical: 8, paddingHorizontal: 12, borderTopWidth: 1, borderTopColor: C.s200 },
  titulo: { color: C.navy, fontSize: 12, fontFamily: 'Poppins', fontWeight: 700 },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  cell: { width: '50%', paddingVertical: 2, paddingRight: 8 },
  cellFull: { width: '100%' },
  label: { color: C.s500, fontSize: 6.8, fontFamily: 'Roboto', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 },
  value: { color: C.ink, fontSize: 9, marginTop: 1 },
});

const Cell = ({ label, value, full }: { label: string; value?: string; full?: boolean }) => {
  if (!value) return null;
  return (
    <View style={[s.cell, full ? s.cellFull : {}]}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.value}>{value}</Text>
    </View>
  );
};

/** Bloco reutilizável Antes | Depois (Folha de Fotos e, futuramente, Corretiva). */
export const PhotoComparisonBlock = ({ item }: { item: ComparisonSheetItem }) => {
  const tone = item.resultado ? RESULT_TONE[item.resultado] : undefined;
  const desc = item.descricao && item.descricao.length > 320 ? `${item.descricao.slice(0, 320)}…` : item.descricao;
  return (
    <View style={s.block} wrap={false}>
      <View style={s.head}>
        <Text style={s.headNum}>Comparação {item.numero}</Text>
        {tone && <View style={[s.chip, { backgroundColor: tone.bg }]}><Text style={[s.chipText, { color: tone.fg }]}>{item.resultado}</Text></View>}
      </View>

      <View style={s.pair}>
        <View style={s.col}>
          <View style={s.colLabel}><Text style={s.labelAntes}>Antes</Text><Text style={s.meta}>{item.beforeDateHora}</Text></View>
          <View style={s.imgBox}><Image src={item.beforeDataUrl} style={s.img} /></View>
        </View>
        <View style={s.col}>
          <View style={s.colLabel}><Text style={s.labelDepois}>Depois</Text><Text style={s.meta}>{item.afterDateHora}</Text></View>
          <View style={[s.imgBox, s.imgBoxRight]}><Image src={item.afterDataUrl} style={s.img} /></View>
        </View>
      </View>

      <View style={s.info}>
        <Text style={s.titulo}>{item.titulo}</Text>
        <View style={s.rowWrap}>
          {item.localDiff
            ? (<><Cell label="Local (Antes)" value={item.localBefore || '—'} /><Cell label="Local (Depois)" value={item.localAfter || '—'} /></>)
            : <Cell label="Local / Setor" value={item.localBefore || item.localAfter} full />}
          <Cell label="Técnico (Antes)" value={item.beforeTecnico} />
          <Cell label="Técnico (Depois)" value={item.afterTecnico} />
          <Cell label="Descrição" value={desc} full />
        </View>
      </View>
    </View>
  );
};
