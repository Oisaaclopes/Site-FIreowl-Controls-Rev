import React from 'react';
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import { C, nv, Logo, BlueprintBg, PdfFooter } from './pdfKit';
import { OsDocumentData, attendanceResultLabel } from '@/lib/osDocuments';
import { EvidenceComparison, SignaturePair, InstitutionalBlock } from './AtendimentoDocParts';

/* Relatório Técnico de Atendimento (React-PDF). Apresenta OS + Pedido +
 * Atendimentos + Itens de Evidência + fotos + assinaturas. Sem dado comercial. */

const s = StyleSheet.create({
  page: { paddingTop: 30, paddingBottom: 44, paddingHorizontal: 34, fontSize: 9, fontFamily: 'Roboto', color: C.ink },
  secTitle: { flexDirection: 'row', alignItems: 'center', borderLeftWidth: 3, borderLeftColor: C.red, paddingLeft: 8, marginTop: 14, marginBottom: 6 },
  secTitleTx: { color: C.navy, fontSize: 11, fontFamily: 'Poppins', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 },
  para: { fontSize: 9, color: C.s700, lineHeight: 1.45, textAlign: 'justify' },
  bullet: { flexDirection: 'row', marginBottom: 2 },
  bulletDot: { color: C.red, fontSize: 9, marginRight: 5 },
  row: { flexDirection: 'row', gap: 8 },
  infoCell: { flex: 1, backgroundColor: C.s50, borderWidth: 1, borderColor: C.s200, borderRadius: 5, padding: 7, marginBottom: 6 },
  infoLabel: { fontSize: 7, fontFamily: 'Roboto', fontWeight: 700, color: C.s600, textTransform: 'uppercase', letterSpacing: 0.5 },
  infoVal: { fontSize: 10, color: C.ink, marginTop: 2 },
  attHeader: { backgroundColor: C.navy, borderRadius: 5, padding: 8, marginTop: 10, marginBottom: 6 },
  attHeaderTx: { color: C.white, fontSize: 10, fontFamily: 'Poppins', fontWeight: 700 },
  attMeta: { color: C.s400, fontSize: 8, marginTop: 2 },
  itemBox: { borderWidth: 1, borderColor: C.s200, borderRadius: 5, padding: 8, marginBottom: 8 },
  itemTitle: { fontSize: 9.5, fontFamily: 'Roboto', fontWeight: 700, color: C.ink },
  itemSub: { fontSize: 8, color: C.s600, marginTop: 1 },
  photoRowLabel: { fontSize: 7.5, fontFamily: 'Roboto', fontWeight: 700, color: C.s600, textTransform: 'uppercase', marginTop: 5, marginBottom: 2 },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  photo: { width: 118, height: 88, borderRadius: 4, objectFit: 'cover', borderWidth: 1, borderColor: C.s200 },
  photoCap: { fontSize: 6.5, color: C.s600, width: 118, marginTop: 1 },
  signBox: { flexDirection: 'row', gap: 8, marginTop: 8 },
  signCell: { flex: 1, borderWidth: 1, borderColor: C.s200, borderRadius: 5, padding: 8 },
  signImg: { height: 54, objectFit: 'contain', marginBottom: 4 },
  signLine: { borderTopWidth: 1, borderTopColor: C.s400, marginTop: 4, paddingTop: 3 },
});

const Bullets = ({ items }: { items?: string[] }) => (
  <View>{(items || []).filter(nv).map((t, i) => (
    <View key={i} style={s.bullet}><Text style={s.bulletDot}>•</Text><Text style={{ flex: 1, fontSize: 9, color: C.s700, lineHeight: 1.4 }}>{t}</Text></View>
  ))}</View>
);

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <View minPresenceAhead={40}><View style={s.secTitle}><Text style={s.secTitleTx}>{title}</Text></View>{children}</View>
);

const fmtDate = (s2?: string) => (s2 ? new Date(s2).toLocaleDateString('pt-BR') : '—');
const fmtTime = (s2?: string) => (s2 ? new Date(s2).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—');

export function RelatorioAtendimentoDocument({ data }: { data: OsDocumentData }) {
  const razao = data.company?.razaoSocial || 'Fireowl Controls';
  const os = data.os;
  const numero = os.numero || os.id.slice(0, 8);
  const titulo = os.titulo || data.objetivo || data.mission.osTitulo || 'Relatório Técnico de Atendimento';
  const dataDoc = new Date().toLocaleDateString('pt-BR');
  const item = (label: string, value?: string) => (nv(value) ? (
    <View style={s.infoCell}><Text style={s.infoLabel}>{label}</Text><Text style={s.infoVal}>{value}</Text></View>
  ) : null);

  return (
    <Document title={`Relatório Técnico ${numero}`} author={razao}>
      {/* CAPA */}
      <Page size="A4" style={{ padding: 0, fontSize: 9, fontFamily: 'Roboto', color: C.white, backgroundColor: C.navy }}>
        <BlueprintBg />
        <View style={{ flex: 1, padding: 40, justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={{ backgroundColor: C.white, borderRadius: 8, padding: 4, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
              <Logo size={36} src={data.companyLogoDataUrl} />
            </View>
            <View><Text style={{ color: C.white, fontFamily: 'Poppins', fontWeight: 700, fontSize: 16, letterSpacing: 1.2 }}>FIREOWL CONTROLS</Text><Text style={{ color: C.s400, fontSize: 7, fontFamily: 'Roboto', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, marginTop: 3 }}>Sistemas Integrados de Proteção</Text></View>
          </View>

          {data.fachadaDataUrl ? <Image src={data.fachadaDataUrl} style={{ width: '100%', height: 220, borderRadius: 6, marginTop: 14, objectFit: 'cover' }} /> : null}

          <View>
            <Text style={{ color: C.gold, fontSize: 8, fontFamily: 'Roboto', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.3 }}>Relatório Técnico de Atendimento</Text>
            <View style={{ width: 56, height: 4, backgroundColor: C.red, borderRadius: 2, marginTop: 6, marginBottom: 4 }} />
            <Text style={{ color: C.white, fontSize: 26, fontFamily: 'Poppins', fontWeight: 700, lineHeight: 1.1 }}>{titulo}</Text>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <View>
              <Text style={{ color: C.gold, fontSize: 7.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 }}>Cliente</Text>
              <Text style={{ color: C.white, fontSize: 15, fontFamily: 'Poppins', fontWeight: 700 }}>{data.clientOperational}</Text>
              <Text style={{ color: C.s400, fontSize: 8, marginTop: 6 }}>{numero}   •   {dataDoc}</Text>
            </View>
            {data.clientLogoDataUrl ? <View style={{ backgroundColor: C.white, borderRadius: 6, padding: 5, width: 70, height: 50, alignItems: 'center', justifyContent: 'center' }}><Image src={data.clientLogoDataUrl} style={{ maxWidth: 60, maxHeight: 40, objectFit: 'contain' }} /></View> : null}
          </View>
        </View>
      </Page>

      {/* CORPO */}
      <Page size="A4" style={s.page}>
        <Section title="1. Identificação">
          <View style={s.row}>{item('Cliente', data.clientOperational)}{item('OS', numero)}</View>
          <View style={s.row}>{item('Tipo', os.tipo)}{item('Prioridade', os.prioridade)}{item('Abertura', os.dataAbertura ? fmtDate(os.dataAbertura) : undefined)}</View>
          {nv(data.clientLegal) && data.clientLegal !== data.clientOperational ? <View style={s.row}>{item('Razão social', data.clientLegal)}</View> : null}
        </Section>

        {(nv(data.objetivo) || nv(os.descricao)) && (
          <Section title="2. Objetivo"><Text style={s.para}>{data.objetivo || os.descricao}</Text></Section>
        )}

        {data.premissas && data.premissas.length > 0 && (
          <Section title="3. Premissas adotadas"><Bullets items={data.premissas} /></Section>
        )}

        {(data.mission.services.length > 0 || data.mission.materials.length > 0) && (
          <Section title="4. Escopo / Serviços previstos">
            {data.mission.services.length > 0 && <Bullets items={data.mission.services.map((i) => `${i.quantidade ? `${i.quantidade}${i.unidade ? ' ' + i.unidade : ''} · ` : ''}${i.descricao}`)} />}
            {data.mission.materials.length > 0 && (
              <View><Text style={{ ...s.photoRowLabel, marginTop: 6 }}>Materiais previstos</Text><Bullets items={data.mission.materials.map((i) => `${i.quantidade ? `${i.quantidade}${i.unidade ? ' ' + i.unidade : ''} × ` : ''}${i.descricao}${i.marcaModelo ? ` (${i.marcaModelo})` : ''}`)} /></View>
            )}
          </Section>
        )}

        <Section title="5. Atendimentos realizados">
          {data.attendances.length === 0 ? <Text style={s.para}>Nenhum atendimento registrado.</Text> : data.attendances.map((att) => (
            <View key={att.id} minPresenceAhead={80}>
              <View style={s.attHeader}>
                <Text style={s.attHeaderTx}>Atendimento {String(att.index).padStart(2, '0')} — {fmtDate(att.startedAt)}</Text>
                <Text style={s.attMeta}>{att.technicianName}   •   {fmtTime(att.startedAt)}{att.finishedAt ? ` → ${fmtTime(att.finishedAt)}` : ''}   •   {attendanceResultLabel(att.result)}</Text>
              </View>

              {nv(att.diagnosis) ? <View><Text style={s.photoRowLabel}>Diagnóstico</Text><Text style={s.para}>{att.diagnosis}</Text></View> : null}
              {nv(att.executionNotes) ? <View><Text style={s.photoRowLabel}>Serviço executado</Text><Text style={s.para}>{att.executionNotes}</Text></View> : null}

              {/* Condição da central: chegada × saída lado a lado quando houver (§21M) */}
              {(nv(att.centralConditionInitial) || nv(att.centralConditionFinal) || att.centralAntes.length > 0 || att.centralDepois.length > 0) && (
                <View minPresenceAhead={60}>
                  <Text style={s.photoRowLabel}>Condição da central</Text>
                  {(nv(att.centralConditionInitial) || nv(att.centralConditionFinal)) && (
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 2 }}>
                      {nv(att.centralConditionInitial) ? <Text style={{ ...s.para, flex: 1 }}><Text style={{ fontWeight: 700 }}>Inicial: </Text>{att.centralConditionInitial}</Text> : null}
                      {nv(att.centralConditionFinal) ? <Text style={{ ...s.para, flex: 1 }}><Text style={{ fontWeight: 700 }}>Final: </Text>{att.centralConditionFinal}</Text> : null}
                    </View>
                  )}
                  <EvidenceComparison columns={[{ label: 'Condição inicial', photos: att.centralAntes }, { label: 'Condição final', photos: att.centralDepois }]} />
                </View>
              )}

              {att.items.map((it) => (
                <View key={it.id} style={s.itemBox} minPresenceAhead={110}>
                  <Text style={s.itemTitle}>{it.title}</Text>
                  <Text style={s.itemSub}>{[it.equipmentType || it.category, [it.manufacturer, it.model].filter(Boolean).join(' '), it.deviceAddress ? `Endereço ${it.deviceAddress}` : '', it.location].filter(Boolean).join(' · ')}</Text>
                  {nv(it.notes) ? <Text style={{ ...s.para, marginTop: 2 }}>{it.notes}</Text> : null}
                  {/* Antes | Durante | Depois lado a lado (§21A–§21F) */}
                  <EvidenceComparison columns={[{ label: 'Antes', photos: it.antes }, { label: 'Durante', photos: it.durante }, { label: 'Depois', photos: it.depois }]} />
                </View>
              ))}

              <View wrap={false}><Text style={s.photoRowLabel}>Resultado</Text><Text style={s.para}>{attendanceResultLabel(att.result)}</Text></View>

              <SignaturePair att={att} clientCompany={data.clientOperational} />
            </View>
          ))}
        </Section>

        {(nv(data.conclusao) || data.attendances.length > 0) && (
          <Section title="6. Conclusão">
            <Text style={s.para}>{data.conclusao || `Foram realizados ${data.attendances.length} atendimento(s). Último resultado: ${attendanceResultLabel(data.attendances[data.attendances.length - 1]?.result)}. Status atual da OS: ${os.status.replace('_', ' ')}.`}</Text>
          </Section>
        )}

        <InstitutionalBlock company={data.company} />

        <PdfFooter numero={numero} data={dataDoc} cliente={data.clientOperational} />
      </Page>
    </Document>
  );
}
