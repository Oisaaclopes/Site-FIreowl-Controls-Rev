import React from 'react';
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { Pedido, CompanyProfile, PedidoEquipmentItem } from '@/lib/types';
import { SEGURANCA_TRABALHO } from '@/lib/propostaTextos';
import { C, nv, lnv, PdfHeader, PdfFooter, CamposExtras } from './pdfKit';
import { DocOptions } from '@/lib/documentos';

export type OrdemServicoPdfOptions = Partial<DocOptions>;

const styles = StyleSheet.create({
  page: { paddingTop: 58, paddingBottom: 42, paddingHorizontal: 40, fontSize: 9, fontFamily: 'Roboto', color: C.s700 },

  titleWrap: { marginBottom: 12 },
  eyebrow: { color: C.red, fontSize: 8, fontFamily: 'Roboto', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.6 },
  title: { color: C.navy, fontSize: 24, fontFamily: 'Poppins', fontWeight: 700, letterSpacing: 0.3, marginTop: 3 },
  titleBar: { width: 52, height: 4, backgroundColor: C.red, borderRadius: 2, marginTop: 7 },

  infoCard: { flexDirection: 'row', flexWrap: 'wrap', borderWidth: 1, borderColor: C.s200, borderRadius: 6, overflow: 'hidden', marginBottom: 14 },
  infoCell: { width: '50%', paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: C.s100 },
  infoLabel: { color: C.s500, fontSize: 7, fontFamily: 'Roboto', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 },
  infoValue: { color: C.ink, fontSize: 9.5, fontFamily: 'Roboto', fontWeight: 700 },

  secHead: { flexDirection: 'row', alignItems: 'center', borderLeftWidth: 3, borderLeftColor: C.red, paddingLeft: 8, marginTop: 6, marginBottom: 6 },
  secNum: { backgroundColor: C.navy, color: C.white, fontSize: 8, fontFamily: 'Roboto', fontWeight: 700, paddingVertical: 1.5, paddingHorizontal: 5, borderRadius: 2, marginRight: 7 },
  secTitle: { color: C.navy, fontSize: 11, fontFamily: 'Poppins', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 },

  card: { backgroundColor: C.s50, borderWidth: 1, borderColor: C.s200, borderRadius: 5, padding: 10, marginBottom: 10 },
  para: { fontSize: 9, color: C.s700, textAlign: 'justify' },

  checkRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 },
  checkBox: { width: 9, height: 9, borderWidth: 1, borderColor: C.s400, borderRadius: 1.5, marginRight: 7, marginTop: 1 },
  checkText: { flex: 1, fontSize: 8.8, color: C.s700 },

  th: { flexDirection: 'row', backgroundColor: C.navy },
  thCell: { color: C.white, fontSize: 7.5, fontFamily: 'Roboto', fontWeight: 700, textTransform: 'uppercase', paddingVertical: 6, paddingHorizontal: 6 },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.s200, alignItems: 'center' },
  trAlt: { backgroundColor: C.s50 },
  td: { fontSize: 8, color: C.s700, paddingVertical: 5, paddingHorizontal: 6 },
  tdBox: { width: 9, height: 9, borderWidth: 1, borderColor: C.s400, borderRadius: 1.5 },

  execRow: { flexDirection: 'row', gap: 14, marginBottom: 8 },
  execField: { flex: 1 },
  execLabel: { fontSize: 7.5, color: C.s500, fontFamily: 'Roboto', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 3 },
  execLine: { borderBottomWidth: 1, borderBottomColor: C.s400, height: 16 },
  execBox: { borderWidth: 1, borderColor: C.s300, borderRadius: 4, height: 46, marginTop: 2 },

  signRow: { flexDirection: 'row', marginTop: 22, gap: 28 },
  signCol: { flex: 1, alignItems: 'center' },
  signLine: { borderBottomWidth: 1, borderBottomColor: C.s400, width: '100%', height: 24, marginBottom: 5 },
  signName: { fontFamily: 'Roboto', fontWeight: 700, color: C.ink, fontSize: 8, textTransform: 'uppercase' },
  signRole: { fontSize: 7.5, color: C.s500, textTransform: 'uppercase' },
});

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

const Checklist = ({ itens }: { itens: string[] }) => (
  <>
    {itens.filter(nv).map((it, i) => (
      <View key={i} style={styles.checkRow}>
        <View style={styles.checkBox} />
        <Text style={styles.checkText}>{it}</Text>
      </View>
    ))}
  </>
);

export function OrdemServicoDocument({ pedido, companyProfile, options }: { pedido: Pedido; companyProfile: CompanyProfile; options?: OrdemServicoPdfOptions }) {
  const p = pedido.proposal;
  const razao = companyProfile.razaoSocial || 'Fireowl Controls';
  const fantasia = companyProfile.nomeFantasia || razao;
  const numero = pedido.numeroPedido;
  const os = numero.replace(/^PED-/, 'OS-');
  const dataEmissao = pedido.dataEmissao || '';
  const cliente = pedido.clienteNome || '';
  const responsavel = pedido.responsavelComercialNome || 'Responsável Técnico';
  const referencia = pedido.referencia || 'Serviço de engenharia';

  const showLogo = options?.showLogo !== false;
  const showMarca = options?.showDescricaoDetalhada !== false;
  const showAssinatura = options?.showAssinaturaCliente !== false;
  const showCampos = options?.showCamposPersonalizados === true;
  const dataDoc = options?.dataHoje ? new Date().toISOString().split('T')[0] : dataEmissao;

  const itens = p.equipmentItems || [];
  const materiais = itens.filter((e) => e.tipo !== 'servico');
  const servicos = itens.filter((e) => e.tipo === 'servico');
  const prazo = nv(p.prazoExecucao) ? p.prazoExecucao : 'A definir com a equipe técnica';

  const preRequisitos = lnv(p.responsabilidadesContratante)
    ? p.responsabilidadesContratante
    : ['Liberação das frentes de trabalho e dos acessos necessários à equipe.', 'Ponto de energia elétrica 120/220 Vac disponível.', 'Local seguro para guarda de materiais e ferramentas.'];

  return (
    <Document title={`Ordem de Serviço ${os}`} author={razao}>
      <Page size="A4" style={styles.page}>
        <PdfHeader razao={fantasia} label="Ordem de Serviço" showLogo={showLogo} />
        <PdfFooter numero={os} data={dataDoc} cliente={cliente} />

        <View style={styles.titleWrap}>
          <Text style={styles.eyebrow}>Documento Operacional</Text>
          <Text style={styles.title}>Ordem de Serviço</Text>
          <View style={styles.titleBar} />
        </View>

        <View style={styles.infoCard}>
          <InfoCell label="Cliente / Contratante" value={cliente} />
          <InfoCell label="Número da OS" value={os} />
          <InfoCell label="Local / Referência" value={referencia} full />
          <InfoCell label="Data de Emissão" value={dataDoc} />
          <InfoCell label="Prazo Previsto" value={prazo} />
          <InfoCell label="Responsável Técnico" value={responsavel} full />
        </View>

        <SecHead n="01" titulo="Serviços a Executar" />
        <View style={styles.card}>
          <Text style={styles.para}>{nv(p.escopoServico) ? p.escopoServico : 'Execução conforme escopo técnico acordado com o cliente.'}</Text>
        </View>
        {servicos.length > 0 && <Checklist itens={servicos.map((s) => `${s.descricao}${s.quantidade ? ` (${s.quantidade} ${s.unidade || 'un'})` : ''}`)} />}
        {lnv(p.entregaveis) && (
          <View minPresenceAhead={40}>
            <Text style={{ ...styles.execLabel, marginTop: 4 }}>Entregáveis</Text>
            <Checklist itens={p.entregaveis} />
          </View>
        )}

        {materiais.length > 0 && (
          <View minPresenceAhead={70}>
            <SecHead n="02" titulo="Materiais e Equipamentos" />
            <View style={{ borderWidth: 1, borderColor: C.s200, borderRadius: 4, overflow: 'hidden', marginBottom: 10 }}>
              <View style={styles.th} fixed>
                <Text style={[styles.thCell, { width: 26, textAlign: 'center' }]}>OK</Text>
                <Text style={[styles.thCell, { width: 22, textAlign: 'center' }]}>#</Text>
                <Text style={[styles.thCell, { flex: 1 }]}>Descrição</Text>
                {showMarca && <Text style={[styles.thCell, { width: 92 }]}>Marca / Modelo</Text>}
                <Text style={[styles.thCell, { width: 30, textAlign: 'center' }]}>Un.</Text>
                <Text style={[styles.thCell, { width: 30, textAlign: 'center' }]}>Qtd</Text>
              </View>
              {materiais.map((eq: PedidoEquipmentItem, i) => (
                <View key={i} style={[styles.tr, i % 2 === 1 ? styles.trAlt : {}]} wrap={false}>
                  <View style={{ width: 26, alignItems: 'center' }}><View style={styles.tdBox} /></View>
                  <Text style={[styles.td, { width: 22, textAlign: 'center', color: C.red, fontFamily: 'Roboto', fontWeight: 700 }]}>{i + 1}</Text>
                  <View style={[styles.td, { flex: 1 }]}><Text style={{ color: C.ink, fontFamily: 'Roboto', fontWeight: 700, fontSize: 8 }}>{eq.descricao}</Text>{showMarca && eq.descricaoDetalhada ? <Text style={{ color: C.s500, fontSize: 7, marginTop: 1, lineHeight: 1.3 }}>{eq.descricaoDetalhada}</Text> : null}</View>
                  {showMarca && <Text style={[styles.td, { width: 92 }]}>{eq.marcaModelo}</Text>}
                  <Text style={[styles.td, { width: 30, textAlign: 'center', textTransform: 'uppercase' }]}>{eq.unidade}</Text>
                  <Text style={[styles.td, { width: 30, textAlign: 'center', fontFamily: 'Roboto', fontWeight: 700 }]}>{eq.quantidade}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View minPresenceAhead={70}>
          <SecHead n={materiais.length > 0 ? '03' : '02'} titulo="Pré-requisitos no Local" />
          <Checklist itens={preRequisitos} />
        </View>

        <View minPresenceAhead={80} wrap={false}>
          <SecHead n={materiais.length > 0 ? '04' : '03'} titulo="Diretrizes de Segurança" />
          <Checklist itens={SEGURANCA_TRABALHO} />
        </View>

        {showCampos && <CamposExtras campos={p.camposPersonalizados} />}

        <View minPresenceAhead={150} wrap={false}>
          <SecHead n={materiais.length > 0 ? '05' : '04'} titulo="Registro de Execução" />
          <View style={styles.execRow}>
            <View style={styles.execField}>
              <Text style={styles.execLabel}>Data de início</Text>
              <View style={styles.execLine} />
            </View>
            <View style={styles.execField}>
              <Text style={styles.execLabel}>Data de conclusão</Text>
              <View style={styles.execLine} />
            </View>
            <View style={styles.execField}>
              <Text style={styles.execLabel}>Horário (início / fim)</Text>
              <View style={styles.execLine} />
            </View>
          </View>
          <Text style={styles.execLabel}>Observações da execução</Text>
          <View style={styles.execBox} />

          <View style={styles.signRow}>
            <View style={styles.signCol}>
              <View style={styles.signLine} />
              <Text style={styles.signName}>{responsavel}</Text>
              <Text style={styles.signRole}>Técnico Responsável — {razao}</Text>
            </View>
            {showAssinatura && (
              <View style={styles.signCol}>
                <View style={styles.signLine} />
                <Text style={styles.signName}>{cliente}</Text>
                <Text style={styles.signRole}>Responsável no Local — Conclusão &amp; Aceite</Text>
              </View>
            )}
          </View>
        </View>
      </Page>
    </Document>
  );
}
