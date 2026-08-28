import React from 'react';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { C, PdfFooter } from './pdfKit';
import { TimePunch } from '@/lib/types';

const styles = StyleSheet.create({
  page: { paddingTop: 58, paddingBottom: 44, paddingHorizontal: 36, fontFamily: 'Roboto', fontSize: 8.5, color: C.ink },
  header: { position: 'absolute', top: 0, left: 0, right: 0, height: 42, backgroundColor: C.navy, paddingHorizontal: 36, flexDirection: 'row', alignItems: 'center' },
  title: { color: C.white, fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, letterSpacing: .7 },
  sub: { color: C.s400, fontSize: 7.5, marginTop: 2 },
  section: { color: C.navy, fontFamily: 'Poppins', fontSize: 10, fontWeight: 700, marginTop: 14, marginBottom: 6, textTransform: 'uppercase' },
  cards: { flexDirection: 'row', gap: 7 }, card: { flex: 1, backgroundColor: C.s50, borderWidth: 1, borderColor: C.s200, borderRadius: 4, padding: 7 },
  label: { color: C.s500, fontSize: 6.5, textTransform: 'uppercase', fontWeight: 700 }, value: { color: C.ink, fontFamily: 'Poppins', fontSize: 10, fontWeight: 700, marginTop: 2 },
  table: { borderWidth: 1, borderColor: C.s200 }, tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.s200, minHeight: 23, alignItems: 'center' }, th: { backgroundColor: C.navy }, thText: { color: C.white, fontSize: 6.5, fontWeight: 700, textTransform: 'uppercase' }, td: { fontSize: 7.5, color: C.s700 },
});

const fmt = (at?: number) => at ? new Date(at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '--';
const dayKey = (at?: number) => at ? new Date(at).toLocaleDateString('pt-BR') : 'Sem data';
const duration = (p: TimePunch[]) => { const by = (t: TimePunch['type']) => p.find(x => x.type === t)?.at; const e = by('ENTRADA'), a = by('PAUSA'), r = by('RETORNO'), s = [...p].reverse().find(x => x.type === 'SAIDA')?.at; let ms = 0; if (e && (a || s)) ms += (a || s)! - e; if (r && s) ms += s - r; const m = Math.max(0, Math.floor(ms / 60000)); return `${String(Math.floor(m / 60)).padStart(2, '0')}h${String(m % 60).padStart(2, '0')}min`; };

export const TimecardDocument = ({ employee, punches, scheduleLabel, bank }: { employee: string; punches: TimePunch[]; scheduleLabel: string; bank: string }) => {
  const groups = new Map<string, TimePunch[]>();
  punches.filter(p => p.at).forEach(p => { const key = new Date(p.at!).toISOString().slice(0,10); groups.set(key, [...(groups.get(key) || []), p]); });
  const days = Array.from(groups.entries()).sort(([a],[b]) => a.localeCompare(b)).map(([, list]) => list.sort((a,b) => (a.at || 0) - (b.at || 0)));
  const cell = (width: string, content: string, head = false) => <View style={{ width, paddingHorizontal: 5 }}><Text style={head ? styles.thText : styles.td}>{content}</Text></View>;
  return <Document title={`Espelho de ponto - ${employee}`}><Page size="A4" style={styles.page}>
    <View fixed style={styles.header}><View><Text style={styles.title}>ESPELHO DE PONTO</Text><Text style={styles.sub}>Fireowl Controls - emitido em {new Date().toLocaleDateString('pt-BR')}</Text></View><View style={{ flex: 1 }}/><Text style={styles.sub}>Portaria MTP 671/2021</Text></View>
    <Text style={styles.section}>Identificação</Text><View style={styles.cards}><View style={styles.card}><Text style={styles.label}>Funcionário</Text><Text style={styles.value}>{employee}</Text></View><View style={styles.card}><Text style={styles.label}>Escala</Text><Text style={styles.value}>{scheduleLabel}</Text></View><View style={styles.card}><Text style={styles.label}>Banco de horas</Text><Text style={styles.value}>{bank}</Text></View></View>
    <Text style={styles.section}>Batidas por dia</Text><View style={styles.table}><View style={[styles.tr, styles.th]}>{cell('18%','Data',true)}{cell('16%','Entrada',true)}{cell('16%','Almoço',true)}{cell('16%','Retorno',true)}{cell('16%','Saída',true)}{cell('18%','Horas',true)}</View>{days.length ? days.map((list,i) => { const pick=(t:TimePunch['type']) => fmt(list.find(x=>x.type===t)?.at); return <View key={i} style={styles.tr} wrap={false}>{cell('18%',dayKey(list[0].at))}{cell('16%',pick('ENTRADA'))}{cell('16%',pick('PAUSA'))}{cell('16%',pick('RETORNO'))}{cell('16%',pick('SAIDA'))}{cell('18%',duration(list))}</View>; }) : <View style={styles.tr}>{cell('100%','Sem batidas no período disponível.')}</View>}</View>
    <PdfFooter numero="ESP-PT" data={new Date().toLocaleDateString('pt-BR')} cliente={employee} />
  </Page></Document>;
};
