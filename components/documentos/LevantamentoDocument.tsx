import React from 'react';
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import { C, nv, Logo, BlueprintBg, PdfFooter } from './pdfKit';
import { InstitutionalBlock } from './AtendimentoDocParts';
import { CompanyProfile, Device } from '@/lib/types';
import { TechArea, AREA_LABEL, SURVEY_MODE_LABEL, SurveyMode } from '@/lib/technicalBase';
import { pdfTableColumns, relevantAssets, evidenceCaption, SurveyResumoLine } from '@/lib/surveyPdfData';

/* ETAPA 3D.3 (Parte G) — PDF do Levantamento Técnico (React-PDF).
 * Reaproveita o toolkit de documentos (pdfKit/AtendimentoDocParts). Tabelas
 * adaptadas por disciplina (§50), evidências relevantes (§52), conclusão factual
 * (§55), assinaturas (§56) e bloco institucional (§57). Não reconstrói o motor. */

export interface LevantamentoDocData {
  company: CompanyProfile | null;
  clientName: string;
  clientLogoUrl?: string;
  facadeUrl?: string;
  area: TechArea;
  mode: SurveyMode;
  scopeText?: string;
  dateStr: string;
  technicianName?: string;
  technicianCargo?: string;
  devices: Device[];
  resumo: SurveyResumoLine[];
  conclusao: string;
  evidences: { caption: string; dataUrl: string }[];
}

const s = StyleSheet.create({
  page: { paddingTop: 30, paddingBottom: 44, paddingHorizontal: 34, fontSize: 9, fontFamily: 'Roboto', color: C.ink },
  coverWrap: { flex: 1, justifyContent: 'center' },
  coverKicker: { color: C.red, fontFamily: 'Poppins', fontWeight: 700, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase' },
  coverTitle: { color: C.navy, fontFamily: 'Poppins', fontWeight: 700, fontSize: 26, marginTop: 4 },
  coverMeta: { marginTop: 18, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  metaCell: { backgroundColor: C.s50, borderWidth: 1, borderColor: C.s200, borderRadius: 5, padding: 8, minWidth: 150 },
  metaLabel: { fontSize: 7, fontFamily: 'Roboto', fontWeight: 700, color: C.s600, textTransform: 'uppercase', letterSpacing: 0.5 },
  metaVal: { fontSize: 11, color: C.ink, marginTop: 2 },
  logos: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  clientLogo: { height: 42, maxWidth: 150, objectFit: 'contain' },
  facade: { marginTop: 18, height: 150, borderRadius: 6, objectFit: 'cover', borderWidth: 1, borderColor: C.s200 },
  secTitle: { borderLeftWidth: 3, borderLeftColor: C.red, paddingLeft: 8, marginTop: 16, marginBottom: 6 },
  secTitleTx: { color: C.navy, fontSize: 11, fontFamily: 'Poppins', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 },
  resumoRow: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: C.s200, paddingVertical: 3 },
  resumoLabel: { fontSize: 9, color: C.s700 },
  resumoVal: { fontSize: 9, fontFamily: 'Roboto', fontWeight: 700, color: C.ink },
  th: { flexDirection: 'row', backgroundColor: C.navy, borderRadius: 3, paddingVertical: 4, paddingHorizontal: 4 },
  thTx: { color: C.white, fontSize: 7.5, fontFamily: 'Roboto', fontWeight: 700, textTransform: 'uppercase' },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.s200, paddingVertical: 3, paddingHorizontal: 4 },
  td: { fontSize: 8, color: C.s700 },
  para: { fontSize: 9, color: C.s700, lineHeight: 1.45, textAlign: 'justify' },
  photoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  photoBox: { width: 160 },
  photo: { width: 160, height: 118, borderRadius: 4, objectFit: 'cover', borderWidth: 1, borderColor: C.s200 },
  photoCap: { fontSize: 6.8, color: C.s600, marginTop: 1 },
  signRow: { flexDirection: 'row', gap: 10, marginTop: 22 },
  signCell: { flex: 1, borderTopWidth: 1, borderTopColor: C.s400, paddingTop: 4 },
  signName: { fontSize: 9, fontFamily: 'Roboto', fontWeight: 700, color: C.ink },
  signRole: { fontSize: 7.5, color: C.s600 },
});

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <View minPresenceAhead={40}><View style={s.secTitle}><Text style={s.secTitleTx}>{title}</Text></View>{children}</View>
);

export function LevantamentoDocument({ data }: { data: LevantamentoDocData }) {
  const razao = data.company?.nomeFantasia || data.company?.razaoSocial || 'Fireowl Controls';
  const cols = pdfTableColumns(data.area);
  const relevantes = relevantAssets(data.devices);
  // Larguras proporcionais: primeira coluna (Tipo) maior; última (Condição) fixa.
  const flexFor = (i: number) => (i === 0 ? 2.2 : i === cols.length - 1 ? 1.3 : 1);

  return (
    <Document title={`Levantamento Técnico — ${AREA_LABEL[data.area]} — ${data.clientName}`}>
      {/* CAPA + IDENTIFICAÇÃO */}
      <Page size="A4" style={s.page}>
        <BlueprintBg />
        <View style={s.logos}>
          <Logo size={40} src={data.company?.logoUrl} />
          {nv(data.clientLogoUrl) && <Image style={s.clientLogo} src={data.clientLogoUrl!} />}
        </View>
        <View style={s.coverWrap}>
          <Text style={s.coverKicker}>{razao}</Text>
          <Text style={s.coverTitle}>Levantamento Técnico</Text>
          <View style={s.coverMeta}>
            <View style={s.metaCell}><Text style={s.metaLabel}>Área</Text><Text style={s.metaVal}>{AREA_LABEL[data.area]}</Text></View>
            <View style={s.metaCell}><Text style={s.metaLabel}>Modo</Text><Text style={s.metaVal}>{SURVEY_MODE_LABEL[data.mode]}</Text></View>
            <View style={s.metaCell}><Text style={s.metaLabel}>Cliente</Text><Text style={s.metaVal}>{data.clientName}</Text></View>
            <View style={s.metaCell}><Text style={s.metaLabel}>Data</Text><Text style={s.metaVal}>{data.dateStr}</Text></View>
            {nv(data.technicianName) && <View style={s.metaCell}><Text style={s.metaLabel}>Responsável técnico</Text><Text style={s.metaVal}>{data.technicianName}{data.technicianCargo ? ` · ${data.technicianCargo}` : ''}</Text></View>}
            {nv(data.scopeText) && <View style={s.metaCell}><Text style={s.metaLabel}>Escopo declarado</Text><Text style={s.metaVal}>{data.scopeText}</Text></View>}
          </View>
          {nv(data.facadeUrl) && <Image style={s.facade} src={data.facadeUrl!} />}
        </View>
        <PdfFooter numero={`LEV-${AREA_LABEL[data.area]}`} data={data.dateStr} cliente={data.clientName} />
      </Page>

      {/* RESUMO + TABELA + EVIDÊNCIAS + CONCLUSÃO */}
      <Page size="A4" style={s.page}>
        <BlueprintBg />
        <Section title="Resumo executivo">
          {data.resumo.map((l, i) => (
            <View key={i} style={s.resumoRow}><Text style={s.resumoLabel}>{l.label}</Text><Text style={s.resumoVal}>{l.value}</Text></View>
          ))}
        </Section>

        <Section title={`Ativos levantados (${data.devices.length})`}>
          <View style={s.th}>
            {cols.map((c, i) => <Text key={i} style={[s.thTx, { flex: flexFor(i) }]}>{c.label}</Text>)}
          </View>
          {data.devices.length === 0 ? (
            <Text style={[s.td, { paddingVertical: 6 }]}>Nenhum ativo registrado.</Text>
          ) : data.devices.map((d, r) => (
            <View key={d.id || r} style={s.tr} wrap={false}>
              {cols.map((c, i) => <Text key={i} style={[s.td, { flex: flexFor(i) }]}>{c.value(d) || '—'}</Text>)}
            </View>
          ))}
        </Section>

        {data.evidences.length > 0 && (
          <Section title={`Evidências relevantes (${data.evidences.length})`}>
            <View style={s.photoRow}>
              {data.evidences.map((e, i) => (
                <View key={i} style={s.photoBox} wrap={false}>
                  <Image style={s.photo} src={e.dataUrl} />
                  <Text style={s.photoCap}>{e.caption}</Text>
                </View>
              ))}
            </View>
            {relevantes.length > data.evidences.length && (
              <Text style={[s.photoCap, { marginTop: 4 }]}>Demais ocorrências constam na tabela acima.</Text>
            )}
          </Section>
        )}

        <Section title="Conclusão">
          <Text style={s.para}>{data.conclusao}</Text>
        </Section>

        <View style={s.signRow}>
          <View style={s.signCell}>
            <Text style={s.signName}>{data.technicianName || 'Responsável técnico'}</Text>
            <Text style={s.signRole}>{data.technicianCargo ? `${data.technicianCargo} · ` : ''}{razao}</Text>
          </View>
          <View style={s.signCell}>
            <Text style={s.signName}>Cliente / acompanhante</Text>
            <Text style={s.signRole}>Nome · cargo · empresa</Text>
          </View>
        </View>

        <View style={{ marginTop: 16 }}><InstitutionalBlock company={data.company} compact /></View>
        <PdfFooter numero={`LEV-${AREA_LABEL[data.area]}`} data={data.dateStr} cliente={data.clientName} />
      </Page>
    </Document>
  );
}
