import React from 'react';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import { C, PdfHeader, PdfFooter } from './pdfKit';
import {
  DailyTimeRecord,
  PeriodSummary,
  dateKeyToBr,
  dayStatusLabel,
  fmtDurationOrDash,
  fmtHoursShort,
  hhmm,
} from '@/lib/timecard';

// Tons de alerta discretos (âmbar), sem vermelho agressivo, para ocorrências
// de jornada. Feriado/atestado usam um tom neutro (ardósia).
const AMBER = '#8A5A00';
const AMBER_BG = '#FBF1DA';
const SLATE_BG = '#EEF2F7';

const styles = StyleSheet.create({
  page: { paddingTop: 58, paddingBottom: 46, paddingHorizontal: 40, fontFamily: 'Roboto', fontSize: 9, color: C.s700 },

  titleWrap: { marginBottom: 12 },
  eyebrow: { color: C.red, fontSize: 8, fontFamily: 'Roboto', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.6 },
  title: { color: C.navy, fontSize: 24, fontFamily: 'Poppins', fontWeight: 700, letterSpacing: 0.3, marginTop: 3 },
  titleBar: { width: 52, height: 4, backgroundColor: C.red, borderRadius: 2, marginTop: 7 },

  secHead: { flexDirection: 'row', alignItems: 'center', borderLeftWidth: 3, borderLeftColor: C.red, paddingLeft: 8, marginTop: 6, marginBottom: 6 },
  secNum: { backgroundColor: C.navy, color: C.white, fontSize: 8, fontFamily: 'Roboto', fontWeight: 700, paddingVertical: 1.5, paddingHorizontal: 5, borderRadius: 2, marginRight: 7 },
  secTitle: { color: C.navy, fontSize: 11, fontFamily: 'Poppins', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 },

  infoCard: { flexDirection: 'row', flexWrap: 'wrap', borderWidth: 1, borderColor: C.s200, borderRadius: 6, overflow: 'hidden', marginBottom: 14 },
  infoCell: { width: '50%', paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: C.s100 },
  infoLabel: { color: C.s500, fontSize: 7, fontFamily: 'Roboto', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 },
  infoValue: { color: C.ink, fontSize: 9.5, fontFamily: 'Roboto', fontWeight: 700 },

  // Resumo (cartões de indicadores)
  statRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  stat: { flex: 1, backgroundColor: C.s50, borderWidth: 1, borderColor: C.s200, borderLeftWidth: 3, borderRadius: 5, paddingVertical: 9, paddingHorizontal: 10 },
  statLabel: { color: C.s500, fontSize: 6.8, fontFamily: 'Roboto', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 },
  statValue: { color: C.navy, fontSize: 15, fontFamily: 'Poppins', fontWeight: 700, marginTop: 3 },
  statHint: { color: C.s500, fontSize: 6.5, marginTop: 2 },

  // Tabela
  table: { borderWidth: 1, borderColor: C.s200, borderRadius: 4, overflow: 'hidden' },
  th: { flexDirection: 'row', backgroundColor: C.navy },
  thCell: { color: C.white, fontSize: 7, fontFamily: 'Roboto', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.3, paddingVertical: 6, paddingHorizontal: 5 },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.s200, minHeight: 22, alignItems: 'center' },
  trAlt: { backgroundColor: C.s50 },
  td: { fontSize: 8, color: C.s700, paddingVertical: 5, paddingHorizontal: 5 },
  tdMono: { fontSize: 8.5, color: C.ink, paddingVertical: 5, paddingHorizontal: 5 },
  chip: { alignSelf: 'flex-start', borderRadius: 3, paddingHorizontal: 5, paddingVertical: 1.5, marginVertical: 4, marginHorizontal: 5 },
  chipText: { fontSize: 6.8, fontFamily: 'Roboto', fontWeight: 700 },

  guardian: { position: 'absolute', bottom: 31, left: 40, right: 40, textAlign: 'center', fontSize: 6, color: C.s400, letterSpacing: 0.3 },
  empty: { color: C.s500, fontSize: 10, marginTop: 10 },
});

// Larguras das colunas (somam 100%). Ocorrência recebe a maior fatia.
const COLS = { data: '13%', ent: '12%', alm: '13%', ret: '12%', sai: '12%', horas: '13%', ocor: '25%' } as const;

type Align = 'left' | 'center';
const HeadCell = ({ w, children, align = 'center' }: { w: string; children: string; align?: Align }) => (
  <View style={{ width: w }}><Text style={[styles.thCell, { textAlign: align }]}>{children}</Text></View>
);
const DataCell = ({ w, children, mono, align = 'center' }: { w: string; children: string; mono?: boolean; align?: Align }) => (
  <View style={{ width: w }}><Text style={[mono ? styles.tdMono : styles.td, { textAlign: align }]}>{children}</Text></View>
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

// Cartão de indicador com acento na borda esquerda e uma dica textual (o
// significado não depende só da cor).
const Stat = ({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent: string }) => (
  <View style={[styles.stat, { borderLeftColor: accent }]}>
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={styles.statValue}>{value}</Text>
    {hint ? <Text style={styles.statHint}>{hint}</Text> : null}
  </View>
);

const TableHeader = () => (
  <View style={styles.th} fixed>
    <HeadCell w={COLS.data}>Data</HeadCell>
    <HeadCell w={COLS.ent}>Entrada</HeadCell>
    <HeadCell w={COLS.alm}>Saída almoço</HeadCell>
    <HeadCell w={COLS.ret}>Retorno</HeadCell>
    <HeadCell w={COLS.sai}>Saída</HeadCell>
    <HeadCell w={COLS.horas}>Horas trab.</HeadCell>
    <HeadCell w={COLS.ocor} align="left">Ocorrência</HeadCell>
  </View>
);

const OccCell = ({ text, tone }: { text: string; tone: 'none' | 'warn' | 'info' }) => {
  if (tone === 'none') return <View style={{ width: COLS.ocor }}><Text style={[styles.td, { textAlign: 'left', color: C.s400 }]}>—</Text></View>;
  const bg = tone === 'warn' ? AMBER_BG : SLATE_BG;
  const fg = tone === 'warn' ? AMBER : C.s600;
  return (
    <View style={{ width: COLS.ocor }}>
      <View style={[styles.chip, { backgroundColor: bg }]}>
        <Text style={[styles.chipText, { color: fg }]}>{text}</Text>
      </View>
    </View>
  );
};

// Dicas textuais de saldo/banco (significado sem depender da cor).
const balanceAccent = (ms: number) => (Math.round(ms / 60000) === 0 ? C.s300 : ms > 0 ? C.green : C.gold);
const saldoHint = (ms: number) => (Math.round(ms / 60000) === 0 ? 'Em dia com o previsto' : ms > 0 ? 'Acima do previsto' : 'Abaixo do previsto');
const bankHintText = (ms: number) => (Math.round(ms / 60000) === 0 ? 'Zerado' : ms > 0 ? 'Saldo credor' : 'Saldo devedor');

const EmployeePage = ({ block, periodLabel, emitido, logoUrl }: { block: TimecardBlock; periodLabel: string; emitido: string; logoUrl?: string }) => {
  const { employee, records, summary, occurrences, scheduleLabel, bank } = block;
  const saldo = fmtHoursShort(summary.saldoMs, true);
  return (
    <Page size="A4" style={styles.page}>
      <PdfHeader razao="Fireowl Controls" label="Espelho de Ponto" logoUrl={logoUrl} />
      <PdfFooter numero="ESP-PT" data={emitido} cliente={employee} />
      <Text fixed style={styles.guardian}>
        Documento gerado pelo Fireowl Guardian   ·   Ref. Portaria MTP 671/2021
      </Text>

      <View style={styles.titleWrap}>
        <Text style={styles.eyebrow}>Controle de Jornada e Frequência</Text>
        <Text style={styles.title}>Espelho de Ponto</Text>
        <View style={styles.titleBar} />
      </View>

      <SecHead n="01" titulo="Identificação" />
      <View style={styles.infoCard}>
        <InfoCell label="Funcionário" value={employee} full />
        <InfoCell label="Período" value={periodLabel} />
        <InfoCell label="Escala" value={scheduleLabel} />
        <InfoCell label="Emissão" value={emitido} />
        <InfoCell label="Código do documento" value="ESP-PT" />
      </View>

      <SecHead n="02" titulo="Resumo do período" />
      <View style={styles.statRow}>
        <Stat label="Horas previstas" value={fmtHoursShort(summary.previstoMs)} accent={C.navy2} />
        <Stat label="Horas trabalhadas" value={fmtHoursShort(summary.trabalhadoMs)} accent={C.navy2} />
        <Stat label="Saldo do período" value={saldo} hint={saldoHint(summary.saldoMs)} accent={balanceAccent(summary.saldoMs)} />
        <Stat label="Banco de horas" value={bank} hint={bankHintText(summary.saldoMs)} accent={balanceAccent(summary.saldoMs)} />
      </View>

      <SecHead n="03" titulo="Batidas por dia" />
      <View style={styles.table}>
        <TableHeader />
        {records.length ? (
          records.map((r, i) => {
            const ext = occurrences?.[r.dateKey];
            const warn = r.status === 'INCONSISTENTE' || r.status === 'INCOMPLETA';
            const adjusted = r.punches.some((p) => p.effectiveSource === 'adjusted');
            const occText = [ext || dayStatusLabel(r.status), adjusted ? 'Ajuste aprovado' : ''].filter(Boolean).join(' · ');
            const tone: 'none' | 'warn' | 'info' = ext || adjusted ? 'info' : warn ? 'warn' : 'none';
            return (
              <View key={r.dateKey} style={[styles.tr, i % 2 ? styles.trAlt : {}]} wrap={false}>
                <DataCell w={COLS.data} mono>{dateKeyToBr(r.dateKey)}</DataCell>
                <DataCell w={COLS.ent} mono>{hhmm(r.entrada)}</DataCell>
                <DataCell w={COLS.alm} mono>{hhmm(r.pausa)}</DataCell>
                <DataCell w={COLS.ret} mono>{hhmm(r.retorno)}</DataCell>
                <DataCell w={COLS.sai} mono>{hhmm(r.saida)}</DataCell>
                <DataCell w={COLS.horas} mono>{fmtDurationOrDash(r.workedMs)}</DataCell>
                <OccCell text={occText} tone={tone} />
              </View>
            );
          })
        ) : (
          <View style={styles.tr}><DataCell w="100%" align="left">Sem batidas no período selecionado.</DataCell></View>
        )}
      </View>
    </Page>
  );
};

export const TimecardDocument = ({ blocks, periodLabel, logoUrl }: { blocks: TimecardBlock[]; periodLabel: string; logoUrl?: string }) => {
  const emitido = new Date().toLocaleDateString('pt-BR');
  const list = blocks.length ? blocks : [];
  const docTitle = list.length === 1 ? `Espelho de ponto - ${list[0].employee}` : 'Espelho de ponto';
  return (
    <Document title={docTitle} author="Fireowl Controls">
      {list.length ? (
        list.map((block, i) => <EmployeePage key={i} block={block} periodLabel={periodLabel} emitido={emitido} logoUrl={logoUrl} />)
      ) : (
        <Page size="A4" style={styles.page}>
          <PdfHeader razao="Fireowl Controls" label="Espelho de Ponto" logoUrl={logoUrl} />
          <PdfFooter numero="ESP-PT" data={emitido} cliente="—" />
          <View style={styles.titleWrap}>
            <Text style={styles.eyebrow}>Controle de Jornada e Frequência</Text>
            <Text style={styles.title}>Espelho de Ponto</Text>
            <View style={styles.titleBar} />
          </View>
          <Text style={styles.empty}>Sem registros no período selecionado.</Text>
        </Page>
      )}
    </Document>
  );
};
