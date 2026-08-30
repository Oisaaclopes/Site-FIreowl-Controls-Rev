import React from 'react';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { C, PdfFooter } from './pdfKit';
import {
  DailyTimeRecord,
  PeriodSummary,
  dateKeyToBr,
  dayStatusLabel,
  fmtDurationOrDash,
  fmtHoursShort,
  hhmm,
} from '@/lib/timecard';

const styles = StyleSheet.create({
  page: { paddingTop: 58, paddingBottom: 44, paddingHorizontal: 36, fontFamily: 'Roboto', fontSize: 8.5, color: C.ink },
  header: { position: 'absolute', top: 0, left: 0, right: 0, height: 42, backgroundColor: C.navy, paddingHorizontal: 36, flexDirection: 'row', alignItems: 'center' },
  title: { color: C.white, fontFamily: 'Poppins', fontSize: 13, fontWeight: 700, letterSpacing: 0.7 },
  sub: { color: C.s400, fontSize: 7.5, marginTop: 2 },
  section: { color: C.navy, fontFamily: 'Poppins', fontSize: 10, fontWeight: 700, marginTop: 14, marginBottom: 6, textTransform: 'uppercase' },
  cards: { flexDirection: 'row', gap: 7 },
  card: { flex: 1, backgroundColor: C.s50, borderWidth: 1, borderColor: C.s200, borderRadius: 4, padding: 7 },
  label: { color: C.s500, fontSize: 6.5, textTransform: 'uppercase', fontWeight: 700 },
  value: { color: C.ink, fontFamily: 'Poppins', fontSize: 10, fontWeight: 700, marginTop: 2 },
  table: { borderWidth: 1, borderColor: C.s200 },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.s200, minHeight: 20, alignItems: 'center' },
  th: { backgroundColor: C.navy },
  thText: { color: C.white, fontSize: 6.5, fontWeight: 700, textTransform: 'uppercase' },
  td: { fontSize: 7.5, color: C.s700 },
  tdWarn: { fontSize: 7.5, color: C.red, fontFamily: 'Roboto', fontWeight: 700 },
});

// Larguras das colunas da tabela de batidas.
const COLS = { data: '15%', ent: '12%', alm: '12%', ret: '12%', sai: '12%', horas: '15%', ocor: '22%' } as const;

const cell = (width: string, content: string, opts?: { head?: boolean; warn?: boolean }) => (
  <View style={{ width, paddingHorizontal: 5 }}>
    <Text style={opts?.head ? styles.thText : opts?.warn ? styles.tdWarn : styles.td}>{content}</Text>
  </View>
);

export interface TimecardBlock {
  employee: string;
  records: DailyTimeRecord[];
  summary: PeriodSummary;
  /** Ocorrência externa por dia (feriado/atestado/folga), YYYY-MM-DD → texto. */
  occurrences?: Record<string, string>;
  scheduleLabel: string;
  bank: string;
}

const TableHeader = () => (
  <View style={[styles.tr, styles.th]} fixed>
    {cell(COLS.data, 'Data', { head: true })}
    {cell(COLS.ent, 'Entrada', { head: true })}
    {cell(COLS.alm, 'Saída almoço', { head: true })}
    {cell(COLS.ret, 'Retorno', { head: true })}
    {cell(COLS.sai, 'Saída', { head: true })}
    {cell(COLS.horas, 'Horas trab.', { head: true })}
    {cell(COLS.ocor, 'Ocorrência', { head: true })}
  </View>
);

const EmployeePage = ({ block, periodLabel, emitido }: { block: TimecardBlock; periodLabel: string; emitido: string }) => {
  const { employee, records, summary, occurrences, scheduleLabel, bank } = block;
  const saldo = fmtHoursShort(summary.saldoMs, true);
  return (
    <Page size="A4" style={styles.page}>
      <View fixed style={styles.header}>
        <View>
          <Text style={styles.title}>ESPELHO DE PONTO</Text>
          <Text style={styles.sub}>Fireowl Controls · emitido em {emitido}</Text>
        </View>
        <View style={{ flex: 1 }} />
        <Text style={styles.sub}>Portaria MTP 671/2021</Text>
      </View>

      <Text style={styles.section}>Identificação</Text>
      <View style={styles.cards}>
        <View style={styles.card}>
          <Text style={styles.label}>Funcionário</Text>
          <Text style={styles.value}>{employee}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.label}>Período</Text>
          <Text style={styles.value}>{periodLabel}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.label}>Escala</Text>
          <Text style={styles.value}>{scheduleLabel}</Text>
        </View>
      </View>

      <Text style={styles.section}>Resumo</Text>
      <View style={styles.cards}>
        <View style={styles.card}>
          <Text style={styles.label}>Horas previstas</Text>
          <Text style={styles.value}>{fmtHoursShort(summary.previstoMs)}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.label}>Horas trabalhadas</Text>
          <Text style={styles.value}>{fmtHoursShort(summary.trabalhadoMs)}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.label}>Saldo do período</Text>
          <Text style={styles.value}>{saldo}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.label}>Banco de horas</Text>
          <Text style={styles.value}>{bank}</Text>
        </View>
      </View>

      <Text style={styles.section}>Batidas por dia</Text>
      <View style={styles.table}>
        <TableHeader />
        {records.length ? (
          records.map((r) => {
            const ext = occurrences?.[r.dateKey];
            const statusLabel = dayStatusLabel(r.status);
            const ocor = ext || statusLabel || '—';
            const warn = r.status === 'INCONSISTENTE' || r.status === 'INCOMPLETA';
            return (
              <View key={r.dateKey} style={styles.tr} wrap={false}>
                {cell(COLS.data, dateKeyToBr(r.dateKey))}
                {cell(COLS.ent, hhmm(r.entrada))}
                {cell(COLS.alm, hhmm(r.pausa))}
                {cell(COLS.ret, hhmm(r.retorno))}
                {cell(COLS.sai, hhmm(r.saida))}
                {cell(COLS.horas, fmtDurationOrDash(r.workedMs))}
                {cell(COLS.ocor, ocor, { warn: warn && !ext })}
              </View>
            );
          })
        ) : (
          <View style={styles.tr}>{cell('100%', 'Sem batidas no período selecionado.')}</View>
        )}
      </View>

      <PdfFooter numero="ESP-PT" data={emitido} cliente={employee} />
    </Page>
  );
};

export const TimecardDocument = ({ blocks, periodLabel }: { blocks: TimecardBlock[]; periodLabel: string }) => {
  const emitido = new Date().toLocaleDateString('pt-BR');
  const list = blocks.length ? blocks : [];
  const docTitle = list.length === 1 ? `Espelho de ponto - ${list[0].employee}` : 'Espelho de ponto';
  return (
    <Document title={docTitle}>
      {list.length ? (
        list.map((block, i) => <EmployeePage key={i} block={block} periodLabel={periodLabel} emitido={emitido} />)
      ) : (
        <Page size="A4" style={styles.page}>
          <View fixed style={styles.header}>
            <Text style={styles.title}>ESPELHO DE PONTO</Text>
          </View>
          <Text style={styles.section}>Sem registros no período selecionado.</Text>
        </Page>
      )}
    </Document>
  );
};
