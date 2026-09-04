import React from 'react';
import { View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import { C, nv } from './pdfKit';
import { websiteDisplay } from '@/lib/companyProfile';
import { CompanyProfile } from '@/lib/types';
import { DocAttendance, DocEvidencePhoto } from '@/lib/osDocuments';

/* Peças React-PDF compartilhadas pela OS executada e pelo Relatório Técnico.
 * Genéricas (não SDAI-específicas, §21N): comparação de evidências em colunas,
 * bloco de assinaturas e finalização institucional. */

const s = StyleSheet.create({
  compRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
  compCol: { borderWidth: 1, borderColor: C.s200, borderRadius: 4, padding: 4 },
  compLabel: { fontSize: 7, fontFamily: 'Roboto', fontWeight: 700, color: C.navy, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3, textAlign: 'center' },
  photoWrap: { marginBottom: 4 },
  cap: { fontSize: 6.5, color: C.s600, marginTop: 1, lineHeight: 1.3 },
  signRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  signCell: { flex: 1, borderWidth: 1, borderColor: C.s200, borderRadius: 5, padding: 8 },
  signCaption: { fontSize: 7, fontFamily: 'Roboto', fontWeight: 700, color: C.s600, textTransform: 'uppercase', letterSpacing: 0.5 },
  signImg: { height: 50, objectFit: 'contain', marginTop: 4, marginBottom: 2 },
  signName: { fontSize: 9.5, fontFamily: 'Roboto', fontWeight: 700, color: C.ink },
  signMeta: { fontSize: 7.5, color: C.s600 },
  signLine: { borderTopWidth: 1, borderTopColor: C.s400, marginTop: 6, paddingTop: 4 },
  inst: { marginTop: 16, borderTopWidth: 1, borderTopColor: C.s200, paddingTop: 8, alignItems: 'center' },
  instThanks: { fontSize: 8.5, color: C.s700, textAlign: 'center', lineHeight: 1.4, maxWidth: 380, marginBottom: 6 },
  instName: { fontSize: 9, fontFamily: 'Poppins', fontWeight: 600, color: C.navy },
  instLine: { fontSize: 7.5, color: C.s600, marginTop: 1 },
});

const fmtDate = (v?: string) => (v ? new Date(v).toLocaleDateString('pt-BR') : '');
const fmtTime = (v?: string) => (v ? new Date(v).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '');

export interface EvidenceColumn { label: string; photos: DocEvidencePhoto[] }

/**
 * Comparação de evidências em COLUNAS lado a lado (§21A–§21M). Recebe só as
 * colunas com fotos; a largura e a altura das imagens se ajustam ao número de
 * colunas (1 = grande, 2 = média, 3 = compacta). Preserva aspect ratio
 * (objectFit contain). Legenda = observação da foto (a identificação do
 * equipamento fica no cabeçalho do Item, §21J/§21K).
 */
export const EvidenceComparison: React.FC<{ columns: EvidenceColumn[] }> = ({ columns }) => {
  const cols = columns.filter((c) => c.photos.some((p) => p.dataUrl));
  if (cols.length === 0) return null;
  const n = Math.min(cols.length, 3);
  const h = n >= 3 ? 96 : n === 2 ? 132 : 190;
  const width = `${(100 / cols.length).toFixed(4)}%`;
  return (
    <View style={s.compRow} wrap={false}>
      {cols.map((col, ci) => (
        <View key={ci} style={{ ...s.compCol, width }}>
          <Text style={s.compLabel}>{col.label}</Text>
          {col.photos.filter((p) => p.dataUrl).map((p) => (
            <View key={p.id} style={s.photoWrap}>
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <Image src={p.dataUrl!} style={{ width: '100%', height: h, objectFit: 'contain' }} />
              {nv(p.note) ? <Text style={s.cap}>{p.note}</Text> : null}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
};

/** Bloco de assinaturas (responsável do cliente + técnico Fireowl) do atendimento. */
export const SignaturePair: React.FC<{ att: DocAttendance; clientCompany: string }> = ({ att, clientCompany }) => {
  const sig = att.signature;
  return (
    <View style={s.signRow} wrap={false}>
      <View style={s.signCell}>
        <Text style={s.signCaption}>Responsável pelo aceite do serviço</Text>
        {sig?.status === 'SIGNED' ? (
          <>
            {sig.dataUrl ? <Image src={sig.dataUrl} style={s.signImg} /> : null}
            <View style={s.signLine}>
              <Text style={s.signName}>{sig.name || '—'}</Text>
              {nv(sig.role) ? <Text style={s.signMeta}>{sig.role}</Text> : null}
              {nv(clientCompany) ? <Text style={s.signMeta}>{clientCompany}</Text> : null}
              {sig.signedAt ? <Text style={{ ...s.signMeta, marginTop: 2 }}>Assinado em: {fmtDate(sig.signedAt)} às {fmtTime(sig.signedAt)}</Text> : null}
            </View>
          </>
        ) : (
          <View style={{ marginTop: 6 }}>
            <Text style={{ fontSize: 9, fontFamily: 'Roboto', fontWeight: 700, color: C.ink }}>{sig?.status === 'REFUSED' ? 'Cliente recusou assinatura.' : 'Responsável indisponível para assinatura.'}</Text>
            {nv(sig?.note) ? <Text style={{ ...s.signMeta, marginTop: 2 }}>Motivo: {sig!.note}</Text> : null}
            {sig?.signedAt ? <Text style={{ ...s.signMeta, marginTop: 2 }}>Registrado em: {fmtDate(sig.signedAt)} às {fmtTime(sig.signedAt)}</Text> : null}
          </View>
        )}
      </View>
      <View style={s.signCell}>
        <Text style={s.signCaption}>Técnico responsável</Text>
        <View style={{ height: 50 }} />
        <View style={s.signLine}>
          <Text style={s.signName}>{att.technicianName}</Text>
          {nv(att.technicianRole) ? <Text style={s.signMeta}>{att.technicianRole}</Text> : null}
          <Text style={s.signMeta}>Fireowl Controls</Text>
          <Text style={{ ...s.signMeta, marginTop: 2, fontStyle: 'italic' }}>Assinatura não cadastrada.</Text>
        </View>
      </View>
    </View>
  );
};

/** Finalização institucional: agradecimento + dados canônicos da empresa (§2/§3/§17/§18). */
export const InstitutionalBlock: React.FC<{ company: CompanyProfile | null; compact?: boolean }> = ({ company, compact }) => {
  const razao = company?.razaoSocial || 'Fireowl Controls Technology Ltda.';
  const site = websiteDisplay(company?.website);
  const endereco = company?.endereco;
  return (
    <View style={{ ...s.inst, marginTop: compact ? 10 : 16 }} wrap={false}>
      <Text style={s.instThanks}>Agradecemos pela confiança nos serviços da Fireowl Controls. Permanecemos à disposição para esclarecimentos e suporte técnico.</Text>
      <Text style={s.instName}>{razao}</Text>
      <Text style={s.instLine}>Sistemas Integrados de Proteção</Text>
      {[site, endereco].filter(nv).length > 0 ? <Text style={s.instLine}>{[site, endereco].filter(nv).join('  •  ')}</Text> : null}
    </View>
  );
};
