import React from 'react';
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import { C, nv, PdfHeader, PdfFooter } from './pdfKit';
import { OsDocumentData, attendanceResultLabel } from '@/lib/osDocuments';

/* Ordem de Serviço executada (React-PDF): comprovante formal, curto e
 * operacional, do serviço executado + aceite/assinatura por atendimento. */

const s = StyleSheet.create({
  page: { paddingTop: 30, paddingBottom: 44, paddingHorizontal: 34, fontSize: 9, fontFamily: 'Roboto', color: C.ink },
  secTitle: { flexDirection: 'row', alignItems: 'center', borderLeftWidth: 3, borderLeftColor: C.red, paddingLeft: 8, marginTop: 12, marginBottom: 5 },
  secTitleTx: { color: C.navy, fontSize: 10.5, fontFamily: 'Poppins', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 },
  row: { flexDirection: 'row', gap: 8 },
  cell: { flex: 1, backgroundColor: C.s50, borderWidth: 1, borderColor: C.s200, borderRadius: 5, padding: 7, marginBottom: 6 },
  label: { fontSize: 7, fontFamily: 'Roboto', fontWeight: 700, color: C.s600, textTransform: 'uppercase', letterSpacing: 0.5 },
  val: { fontSize: 10, color: C.ink, marginTop: 2 },
  para: { fontSize: 9, color: C.s700, lineHeight: 1.4 },
  bullet: { flexDirection: 'row', marginBottom: 2 },
  att: { borderWidth: 1, borderColor: C.s200, borderRadius: 5, padding: 8, marginBottom: 8 },
  attHead: { fontSize: 9.5, fontFamily: 'Roboto', fontWeight: 700, color: C.navy },
  attMeta: { fontSize: 8, color: C.s600, marginTop: 1, marginBottom: 4 },
  sub: { fontSize: 7.5, fontFamily: 'Roboto', fontWeight: 700, color: C.s600, textTransform: 'uppercase', marginTop: 4 },
  signRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  signCell: { flex: 1, borderTopWidth: 1, borderTopColor: C.s400, paddingTop: 3 },
  signImg: { height: 40, objectFit: 'contain', marginBottom: 2 },
});

const fmtDate = (v?: string) => (v ? new Date(v).toLocaleDateString('pt-BR') : '—');
const fmtTime = (v?: string) => (v ? new Date(v).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—');

export function OrdemServicoExecutadaDocument({ data }: { data: OsDocumentData }) {
  const razao = data.company?.razaoSocial || 'Fireowl Controls';
  const os = data.os;
  const numero = os.numero || os.id.slice(0, 8);
  const dataDoc = new Date().toLocaleDateString('pt-BR');
  const cell = (label: string, value?: string) => (nv(value) ? <View style={s.cell}><Text style={s.label}>{label}</Text><Text style={s.val}>{value}</Text></View> : null);

  return (
    <Document title={`OS ${numero}`} author={razao}>
      <Page size="A4" style={s.page}>
        <PdfHeader razao={razao} label="Ordem de Serviço Executada" showLogo logoUrl={data.companyLogoDataUrl} />

        <View style={s.secTitle}><Text style={s.secTitleTx}>Identificação</Text></View>
        <View style={s.row}>{cell('Cliente', data.clientOperational)}{cell('OS', numero)}</View>
        <View style={s.row}>{cell('Título', os.titulo || data.mission.osTitulo)}{cell('Tipo', os.tipo)}{cell('Prioridade', os.prioridade)}</View>
        <View style={s.row}>{cell('Abertura', os.dataAbertura ? fmtDate(os.dataAbertura) : undefined)}{cell('Status', os.status.replace('_', ' '))}{cell('Área', (data.mission.area[0] || '').toUpperCase() || undefined)}</View>

        {(data.mission.services.length > 0 || data.mission.materials.length > 0) && (
          <>
            <View style={s.secTitle}><Text style={s.secTitleTx}>Escopo previsto</Text></View>
            {data.mission.services.map((i, k) => <View key={`sv${k}`} style={s.bullet}><Text style={{ color: C.red, marginRight: 5 }}>•</Text><Text style={s.para}>{i.quantidade ? `${i.quantidade}${i.unidade ? ' ' + i.unidade : ''} · ` : ''}{i.descricao}</Text></View>)}
            {data.mission.materials.length > 0 ? <Text style={s.sub}>Materiais previstos</Text> : null}
            {data.mission.materials.map((i, k) => <View key={`mt${k}`} style={s.bullet}><Text style={{ color: C.red, marginRight: 5 }}>•</Text><Text style={s.para}>{i.quantidade ? `${i.quantidade}${i.unidade ? ' ' + i.unidade : ''} × ` : ''}{i.descricao}{i.marcaModelo ? ` (${i.marcaModelo})` : ''}</Text></View>)}
          </>
        )}

        <View style={s.secTitle}><Text style={s.secTitleTx}>Atendimentos</Text></View>
        {data.attendances.length === 0 ? <Text style={s.para}>Nenhum atendimento registrado.</Text> : data.attendances.map((att) => (
          <View key={att.id} style={s.att} wrap={false}>
            <Text style={s.attHead}>Atendimento {String(att.index).padStart(2, '0')} — {fmtDate(att.startedAt)}</Text>
            <Text style={s.attMeta}>{att.technicianName}   •   {fmtTime(att.startedAt)}{att.finishedAt ? ` → ${fmtTime(att.finishedAt)}` : ''}   •   {attendanceResultLabel(att.result)}</Text>
            {nv(att.diagnosis) ? <><Text style={s.sub}>Diagnóstico</Text><Text style={s.para}>{att.diagnosis}</Text></> : null}
            {nv(att.executionNotes) ? <><Text style={s.sub}>Serviço executado</Text><Text style={s.para}>{att.executionNotes}</Text></> : null}
            {nv(att.centralConditionFinal) ? <><Text style={s.sub}>Condição final da central</Text><Text style={s.para}>{att.centralConditionFinal}</Text></> : null}
            <View style={s.signRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Responsável do cliente</Text>
                {att.signature?.status === 'SIGNED' ? (
                  <View>
                    {att.signature.dataUrl ? <Image src={att.signature.dataUrl} style={s.signImg} /> : null}
                    <View style={s.signCell}><Text style={{ fontSize: 9, fontWeight: 700 }}>{att.signature.name || '—'}</Text>{nv(att.signature.role) ? <Text style={{ fontSize: 7.5, color: C.s600 }}>{att.signature.role}</Text> : null}<Text style={{ fontSize: 7, color: C.s600 }}>{fmtDate(att.signature.signedAt)} {fmtTime(att.signature.signedAt)}</Text></View>
                  </View>
                ) : <Text style={{ ...s.para, marginTop: 4 }}>{att.signature?.status === 'REFUSED' ? 'Cliente recusou assinar.' : att.signature?.status === 'UNAVAILABLE' ? 'Responsável indisponível.' : 'Sem assinatura.'}{att.signature?.note ? ` ${att.signature.note}` : ''}</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.label}>Técnico Fireowl</Text>
                <View style={{ height: 40 }} />
                <View style={s.signCell}><Text style={{ fontSize: 9, fontWeight: 700 }}>{att.technicianName}</Text><Text style={{ fontSize: 7.5, color: C.s600 }}>Fireowl Controls</Text></View>
              </View>
            </View>
          </View>
        ))}

        <PdfFooter numero={numero} data={dataDoc} cliente={data.clientOperational} />
      </Page>
    </Document>
  );
}
