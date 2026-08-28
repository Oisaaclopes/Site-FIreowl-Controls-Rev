import React from 'react';
import { Document, Page, View, Text, StyleSheet, Image } from '@react-pdf/renderer';
import { C, A4, BlueprintBg, Logo, PdfFooter, nv } from './pdfKit';
import { ReportPdfData, RpCard, RpFoto } from '@/lib/reportPdfData';

/**
 * Relatório Técnico de Campo em react-pdf — reaproveita a identidade do pdfKit
 * (mesma empresa dos orçamentos), com linguagem própria de documento técnico.
 * Recebe dados já resolvidos (imagens em data URI). Nada é inventado: blocos
 * sem dados não aparecem. Níveis: simples | tecnico | corporativo.
 */

const gold = '#F2A900';
const styles = StyleSheet.create({
  page: { paddingTop: 62, paddingBottom: 46, paddingHorizontal: 40, fontSize: 9, fontFamily: 'Roboto', color: C.ink, backgroundColor: C.white },
  // capa
  cover: { padding: 0, backgroundColor: C.navy, color: C.white },
  coverInner: { flex: 1, padding: 40, justifyContent: 'space-between' },
  coverBrand: { color: C.white, fontFamily: 'Poppins', fontWeight: 700, fontSize: 15, letterSpacing: 1.2 },
  coverTagline: { color: C.s400, fontSize: 7, fontFamily: 'Roboto', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, marginTop: 3 },
  coverKicker: { color: gold, fontSize: 9, fontFamily: 'Roboto', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2 },
  coverTitle: { color: C.white, fontSize: 30, fontFamily: 'Poppins', fontWeight: 700, letterSpacing: 0.3, marginTop: 6, lineHeight: 1.05 },
  coverTipo: { color: gold, fontSize: 13, fontFamily: 'Poppins', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1, marginTop: 6 },
  coverBar: { width: 60, height: 4, backgroundColor: C.red, borderRadius: 2, marginTop: 12, marginBottom: 14 },
  coverCliente: { color: C.white, fontSize: 20, fontFamily: 'Poppins', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 },
  coverImg: { width: '100%', height: 210, borderRadius: 6, marginTop: 14, objectFit: 'cover' },
  coverMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  coverMetaLabel: { color: C.s400, fontSize: 7, fontFamily: 'Roboto', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 },
  coverMetaVal: { color: C.white, fontSize: 11, fontFamily: 'Poppins', fontWeight: 600, marginTop: 2 },
  // header/footer content
  header: { position: 'absolute', top: 0, left: 0, right: 0, height: 46, backgroundColor: C.white, borderBottomWidth: 1.5, borderBottomColor: C.red, paddingHorizontal: 40, flexDirection: 'row', alignItems: 'center' },
  headerBrand: { fontSize: 8.5, fontFamily: 'Poppins', fontWeight: 600, color: C.navy, letterSpacing: 0.8 },
  headerRight: { fontSize: 7, color: C.s500, fontFamily: 'Roboto', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 },
  // seções
  secHead: { flexDirection: 'row', alignItems: 'center', marginTop: 14, marginBottom: 7 },
  secNum: { fontSize: 12, fontFamily: 'Poppins', fontWeight: 700, color: C.red, marginRight: 8 },
  secTitle: { fontSize: 11, fontFamily: 'Poppins', fontWeight: 700, color: C.navy, textTransform: 'uppercase', letterSpacing: 0.6 },
  para: { fontSize: 9, color: C.s700, textAlign: 'justify', lineHeight: 1.45 },
  // info cards
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  infoCell: { width: '48.5%', backgroundColor: C.s50, borderWidth: 1, borderColor: C.s200, borderRadius: 5, paddingVertical: 6, paddingHorizontal: 10, marginBottom: 7 },
  infoLabel: { fontSize: 7, color: C.s500, fontFamily: 'Roboto', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { fontSize: 9.5, color: C.ink, fontFamily: 'Roboto', fontWeight: 700, marginTop: 2 },
  // indicadores
  indRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 6 },
  indCell: { width: '31.5%', backgroundColor: C.navy, borderRadius: 8, borderTopWidth: 3, borderTopColor: gold, paddingVertical: 10, paddingHorizontal: 12, marginBottom: 8 },
  indVal: { color: C.white, fontSize: 18, fontFamily: 'Poppins', fontWeight: 700 },
  indLabel: { color: C.s400, fontSize: 7.5, fontFamily: 'Roboto', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 3 },
  // status chips
  statusRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
  // cards técnicos
  card: { borderWidth: 1, borderColor: C.s200, borderRadius: 6, padding: 9, marginBottom: 8 },
  cardTitle: { fontSize: 9.5, fontFamily: 'Roboto', fontWeight: 700, color: C.navy },
  cardMeta: { fontSize: 8, color: C.s600, marginTop: 2 },
  // fotos
  fotoBox: { backgroundColor: C.s100, borderWidth: 1, borderColor: C.s200, borderRadius: 5, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  fotoImg: { width: '100%', height: '100%', objectFit: 'contain' },
  legenda: { fontSize: 7.5, color: C.s600, marginTop: 3 },
  // pendências
  pendCard: { borderLeftWidth: 3, borderLeftColor: C.red, backgroundColor: C.s50, borderRadius: 4, paddingVertical: 6, paddingHorizontal: 10, marginBottom: 7 },
  // assinaturas
  signRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 6 },
  signCol: { width: '48%', marginBottom: 12 },
  signImg: { width: '100%', height: 54, objectFit: 'contain', borderBottomWidth: 1, borderBottomColor: C.s400 },
  signLine: { borderBottomWidth: 1, borderBottomColor: C.s400, height: 54 },
  signName: { fontSize: 8.5, fontFamily: 'Roboto', fontWeight: 700, color: C.ink, marginTop: 3, textTransform: 'uppercase' },
  signRole: { fontSize: 7, color: C.s500, textTransform: 'uppercase' },
});

const PAPEL_LABEL: Record<string, string> = { cliente: 'Cliente', tecnico: 'Técnico executor', responsavel_tecnico: 'Responsável técnico' };
const ACAO_LABEL: Record<string, string> = { substituir: 'Substituir', instalar: 'Instalar', reposicionar: 'Reposicionar', reparar: 'Reparar', limpar: 'Limpar', desobstruir: 'Desobstruir', reprogramar: 'Reprogramar', investigar: 'Investigar' };
const PEND_TONE: Record<string, { bg: string; cor: string; label: string }> = {
  corrigida: { bg: '#F0FAF4', cor: C.green, label: 'Corrigida' },
  cancelada: { bg: C.s100, cor: C.s500, label: 'Cancelada' },
};
const pendVisual = (st?: string) => PEND_TONE[st || ''] || { bg: C.s50, cor: C.red, label: 'Pendente' };

const Header = ({ d }: { d: ReportPdfData }) => (
  <View fixed style={styles.header}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Logo size={18} src={d.logoFireowlUrl} />
      <Text style={styles.headerBrand}>{(d.fantasiaFireowl || d.razaoSocial || 'FIREOWL CONTROLS').toUpperCase()}</Text>
    </View>
    <View style={{ flex: 1 }} />
    {nv(d.clienteLogoUrl) ? (
      <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 10, paddingRight: 10, borderRightWidth: 1, borderRightColor: C.s200 }}>
        <View style={{ width: 30, height: 24, backgroundColor: C.white, borderWidth: 1, borderColor: C.s200, borderRadius: 3, alignItems: 'center', justifyContent: 'center', padding: 2 }}>
          <Image src={d.clienteLogoUrl!} style={{ maxWidth: '100%', maxHeight: 19, objectFit: 'contain' }} />
        </View>
        <Text style={{ fontSize: 6.5, color: C.s500, marginLeft: 4, fontFamily: 'Roboto', fontWeight: 700, textTransform: 'uppercase' }}>Cliente</Text>
      </View>
    ) : null}
    <Text style={styles.headerRight}>{d.tipoLabel}</Text>
  </View>
);

const SecHead = ({ n, titulo }: { n?: string; titulo: string }) => (
  <View style={styles.secHead} minPresenceAhead={60}>
    {n ? <Text style={styles.secNum}>{n}</Text> : null}
    <Text style={styles.secTitle}>{titulo}</Text>
  </View>
);

const Info = ({ label, value, full }: { label: string; value?: string; full?: boolean }) =>
  nv(value) ? (
    <View style={[styles.infoCell, full ? { width: '100%' } : {}]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  ) : null;

const StatusChip = ({ s }: { s: { label: string; valor: number; tone: 'ok' | 'warn' | 'info' } }) => {
  const cor = s.tone === 'ok' ? C.green : s.tone === 'warn' ? C.red : C.navy;
  const bg = s.tone === 'ok' ? '#F0FAF4' : s.tone === 'warn' ? '#FCF1F1' : C.s100;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: bg, borderRadius: 5, paddingVertical: 5, paddingHorizontal: 10, marginRight: 6, marginBottom: 6 }}>
      <Text style={{ fontSize: 11, fontFamily: 'Poppins', fontWeight: 700, color: cor, marginRight: 5 }}>{s.valor}</Text>
      <Text style={{ fontSize: 8, fontFamily: 'Roboto', fontWeight: 700, color: C.s600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{s.label}</Text>
    </View>
  );
};

const FotoBox = ({ url, w, h, label }: { url?: string; w: string | number; h: number; label?: string }) => (
  <View style={{ width: w }}>
    {label ? <Text style={{ fontSize: 7, color: C.s500, fontFamily: 'Roboto', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>{label}</Text> : null}
    <View style={[styles.fotoBox, { height: h }]}>
      {url ? <Image src={url} style={styles.fotoImg} /> : <Text style={{ fontSize: 8, color: C.s400 }}>sem imagem</Text>}
    </View>
  </View>
);

const CardTecnico = ({ c }: { c: RpCard }) => (
  <View style={styles.card} wrap={false}>
    <Text style={styles.cardTitle}>{c.titulo}</Text>
    {nv(c.descricao) ? <Text style={styles.cardMeta}>{c.descricao}</Text> : null}
    {(nv(c.local) || nv(c.acao) || nv(c.qtd)) ? (
      <Text style={styles.cardMeta}>
        {nv(c.local) ? `Local: ${c.local}` : ''}{nv(c.local) && (nv(c.acao) || nv(c.qtd)) ? '  ·  ' : ''}
        {nv(c.acao) ? `Ação: ${ACAO_LABEL[c.acao!] || c.acao}` : ''}{nv(c.acao) && nv(c.qtd) ? '  ·  ' : ''}
        {nv(c.qtd) ? `Qtd: ${c.qtd}` : ''}
      </Text>
    ) : null}
    {c.fotos.some((f) => f.tipo === 'antes') && c.fotos.some((f) => f.tipo === 'depois') ? (
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
        <FotoBox url={c.fotos.find((f) => f.tipo === 'antes')?.url} w="48.5%" h={110} label="Antes" />
        <FotoBox url={c.fotos.find((f) => f.tipo === 'depois')?.url} w="48.5%" h={110} label="Depois" />
      </View>
    ) : c.fotos.length > 0 ? (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start', marginTop: 6 }}>
        {c.fotos.map((f, i) => (
          <View key={i} style={{ width: '32%', marginRight: i % 3 === 2 ? 0 : '2%' }}>
            <FotoBox url={f.url} w="100%" h={78} label={f.tipo === 'antes' ? 'Antes' : f.tipo === 'depois' ? 'Depois' : undefined} />
            {nv(f.legenda) ? <Text style={styles.legenda}>{f.legenda}</Text> : null}
          </View>
        ))}
      </View>
    ) : null}
  </View>
);

export function ReportTechnicalDocument({ data }: { data: ReportPdfData }) {
  const d = data;
  const nivel = d.nivel;
  const showResumo = nivel !== 'simples';
  const showPend = nivel !== 'simples';
  const showConclusao = nivel !== 'simples';
  const showInstitucional = nivel === 'corporativo' && (nv(d.razaoSocial) || nv(d.contatoFireowl) || nv(d.cnpjFireowl));
  const temExec = d.secoes.some((s) => s.cards.length > 0);

  // Numeração dinâmica das seções (só as que aparecem).
  let n = 0;
  const num = () => String(++n).padStart(2, '0');

  return (
    <Document title={`${d.tituloDoc} ${d.numero}`} author={d.razaoSocial}>
      {/* ===== CAPA ===== */}
      <Page size="A4" style={styles.cover}>
        <BlueprintBg />
        <View style={styles.coverInner}>
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ backgroundColor: C.white, borderRadius: 8, padding: 4, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                <Logo size={36} src={d.logoFireowlUrl} />
              </View>
              <View>
                <Text style={styles.coverBrand}>{(d.fantasiaFireowl || 'FIREOWL CONTROLS').toUpperCase()}</Text>
                <Text style={styles.coverTagline}>Sistemas Integrados de Proteção</Text>
              </View>
              <View style={{ flex: 1 }} />
              {nv(d.clienteLogoUrl) ? (
                <View style={{ backgroundColor: C.white, borderRadius: 7, padding: 5, width: 96, height: 56, alignItems: 'center', justifyContent: 'center' }}>
                  <Image src={d.clienteLogoUrl!} style={{ maxWidth: '100%', maxHeight: 39, objectFit: 'contain' }} />
                  <Text style={{ color: C.s600, fontSize: 5.5, fontFamily: 'Roboto', fontWeight: 700, textTransform: 'uppercase', letterSpacing: .5, marginTop: 2 }}>Cliente</Text>
                </View>
              ) : null}
            </View>
            <View style={{ marginTop: 26 }}>
              <Text style={styles.coverKicker}>Relatório Técnico</Text>
              <Text style={styles.coverTipo}>{d.tipoLabel}</Text>
              <View style={styles.coverBar} />
              <Text style={styles.coverCliente}>{d.clienteFantasia || d.clienteNome}</Text>
              {nv(d.local) ? <Text style={{ color: C.s300, fontSize: 10, marginTop: 4 }}>{d.local}</Text> : null}
            </View>
            {nv(d.capaImagemUrl) ? <Image src={d.capaImagemUrl!} style={styles.coverImg} /> : null}
          </View>

          <View>
            <View style={{ height: 1, backgroundColor: '#22406B', marginBottom: 10 }} />
            <View style={styles.coverMetaRow}>
              <View>
                <Text style={styles.coverMetaLabel}>Número</Text>
                <Text style={styles.coverMetaVal}>{d.numero}</Text>
              </View>
              {nv(d.dataFim) ? (
                <View>
                  <Text style={styles.coverMetaLabel}>Data</Text>
                  <Text style={styles.coverMetaVal}>{d.dataFim}</Text>
                </View>
              ) : null}
              {nv(d.tecnicoNome) ? (
                <View>
                  <Text style={styles.coverMetaLabel}>Técnico</Text>
                  <Text style={styles.coverMetaVal}>{d.tecnicoNome}</Text>
                </View>
              ) : null}
            </View>
            <Text style={{ color: C.s400, fontSize: 7.5, marginTop: 12 }}>{`${d.razaoSocial}${nv(d.cnpjFireowl) ? ` — CNPJ ${d.cnpjFireowl}` : ''}`}</Text>
          </View>
        </View>
      </Page>

      {/* ===== CONTEÚDO ===== */}
      <Page size="A4" style={styles.page}>
        <Header d={d} />
        <PdfFooter numero={d.numero} data={d.dataFim || ''} cliente={d.clienteNome} />

        {/* Identificação do atendimento */}
        <SecHead n={num()} titulo="Identificação do Atendimento" />
        <View style={styles.infoGrid}>
          <Info label="Cliente" value={d.clienteNome} />
          <Info label="Nome fantasia" value={d.clienteFantasia} />
          <Info label="CNPJ" value={d.clienteCnpj} />
          <Info label="Unidade / Local" value={d.local} />
          <Info label="Endereço" value={d.clienteEndereco} full />
          <Info label="Tipo de atendimento" value={d.tipoLabel} />
          <Info label="Número do relatório" value={d.numero} />
          <Info label="Data de abertura" value={d.dataInicio} />
          <Info label="Data de conclusão" value={d.dataFim} />
          <Info label="Técnico executor" value={d.tecnicoNome} />
          <Info label="Responsável técnico" value={d.responsavelTecnico} />
          <Info label="Contato do cliente" value={d.clienteContato} full />
        </View>

        {/* Resumo + indicadores + status (técnico/corporativo) */}
        {showResumo && (d.indicadores.length > 0 || d.status.length > 0 || nv(d.resumoTexto)) ? (
          <>
            <SecHead n={num()} titulo="Resumo do Atendimento" />
            {nv(d.resumoTexto) ? <Text style={[styles.para, { marginBottom: 8 }]}>{d.resumoTexto}</Text> : null}
            {d.indicadores.length > 0 ? (
              <View style={styles.indRow}>
                {d.indicadores.map((ind, i) => (
                  <View key={i} style={styles.indCell} wrap={false}>
                    <Text style={styles.indVal}>{ind.valor}</Text>
                    <Text style={styles.indLabel}>{ind.label}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            {d.status.length > 0 ? (
              <View style={styles.statusRow}>
                {d.status.map((s, i) => <StatusChip key={i} s={s} />)}
              </View>
            ) : null}
          </>
        ) : null}

        {/* Execução — cards por seção/grupo */}
          {temExec ? (
          <>
            <SecHead n={num()} titulo={d.tipo === 'LEVANTAMENTO' ? 'Levantamento e Apontamentos' : d.tipo === 'PREVENTIVA' ? 'Inspeção e Apontamentos' : 'Serviços Executados e Apontamentos'} />
            {d.secoes.filter((s) => s.cards.length > 0).map((s) => (
              <View key={s.key}>
                <Text style={{ fontSize: 9, fontFamily: 'Poppins', fontWeight: 700, color: C.navy, borderBottomWidth: 2, borderBottomColor: gold, paddingBottom: 2, marginTop: 8, marginBottom: 6 }} minPresenceAhead={40}>{s.titulo}</Text>
                {s.cards.map((c, i) => <CardTecnico key={i} c={c} />)}
              </View>
            ))}
          </>
          ) : null}

        {/* Checklist e respostas escalares: usa os títulos oficiais do template,
            preservando a estrutura de Corretiva, Preventiva e Levantamento. */}
        {d.respostasPorSecao.length > 0 ? (
          <>
            <SecHead n={num()} titulo={d.tipo === 'PREVENTIVA' ? 'Checklist e Verificações' : d.tipo === 'CORRETIVA' ? 'Diagnóstico e Encerramento' : 'Informações do Levantamento'} />
            {d.respostasPorSecao.map((secao, i) => (
              <View key={i} wrap={false} style={{ marginBottom: 8 }}>
                <Text style={{ fontSize: 9, fontFamily: 'Poppins', fontWeight: 700, color: C.navy, borderBottomWidth: 2, borderBottomColor: gold, paddingBottom: 2, marginBottom: 5 }} minPresenceAhead={36}>{secao.titulo}</Text>
                <View style={styles.infoGrid}>
                  {secao.campos.map((campo, j) => (
                    <View key={j} style={[styles.infoCell, campo.reprovado ? { borderColor: C.red, backgroundColor: '#FCF1F1' } : {}]}>
                      <Text style={styles.infoLabel}>{campo.label}</Text>
                      <Text style={[styles.infoValue, campo.reprovado ? { color: C.red } : {}]}>{campo.valor}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </>
        ) : null}

        {/* Pendências e recomendações */}
        {showPend && d.pendencias.length > 0 ? (
          <>
            <SecHead n={num()} titulo="Pendências e Recomendações" />
            {d.pendencias.map((p, i) => {
              const pv = pendVisual(p.status);
              return (
                <View key={i} style={[styles.pendCard, { borderLeftColor: pv.cor, backgroundColor: pv.bg }]} wrap={false}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={{ fontSize: 9, fontFamily: 'Roboto', fontWeight: 700, color: C.navy }}>{p.grupo}</Text>
                    <Text style={{ fontSize: 7.5, fontFamily: 'Roboto', fontWeight: 700, color: pv.cor, textTransform: 'uppercase', letterSpacing: 0.5 }}>{pv.label}</Text>
                  </View>
                  {nv(p.descricao) ? <Text style={{ fontSize: 8.5, color: C.s700, marginTop: 2 }}>{p.descricao}</Text> : null}
                  {(nv(p.acao) || nv(p.norma)) ? (
                    <Text style={{ fontSize: 8, color: C.s600, marginTop: 2 }}>
                      {nv(p.acao) ? `Ação: ${ACAO_LABEL[p.acao!] || p.acao}` : ''}{nv(p.acao) && nv(p.norma) ? '  ·  ' : ''}
                      {nv(p.norma) ? `Norma: ${p.norma}` : ''}
                    </Text>
                  ) : null}
                  {nv(p.fotoUrl) ? <View style={{ marginTop: 5, width: '34%' }}><FotoBox url={p.fotoUrl} w="100%" h={72} label="Evidência associada" /></View> : null}
                </View>
              );
            })}
          </>
        ) : null}

        {/* Registro fotográfico geral */}
        {d.registroFotografico.length > 0 ? (
          <>
            <SecHead n={num()} titulo="Registro Fotográfico" />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-start' }}>
              {d.registroFotografico.map((f: RpFoto, i) => (
                <View key={i} style={{ width: '32%', marginRight: i % 3 === 2 ? 0 : '2%', marginBottom: 8 }} wrap={false}>
                  <FotoBox url={f.url} w="100%" h={92} />
                  {nv(f.contexto) ? <Text style={[styles.legenda, { color: C.navy, fontFamily: 'Roboto', fontWeight: 700 }]}>{f.contexto}</Text> : null}
                  {nv(f.legenda) ? <Text style={styles.legenda}>{f.legenda}</Text> : null}
                  {nv(f.nota) ? <Text style={[styles.legenda, { color: C.s500 }]}>{f.nota}</Text> : null}
                  {nv(f.marcadaUrl) ? <Text style={[styles.legenda, { color: C.navy }]}>Imagem com marcação técnica</Text> : null}
                </View>
              ))}
            </View>
          </>
        ) : null}

        {/* Conclusão técnica */}
        {showConclusao && nv(d.conclusaoTexto) ? (
          <View minPresenceAhead={60} wrap={false}>
            <SecHead n={num()} titulo="Conclusão Técnica" />
            <Text style={[styles.para, { fontStyle: 'italic' }]}>{d.conclusaoTexto}</Text>
          </View>
        ) : null}

        {/* No nível corporativo, identifica a emissora sem transformar o
            relatório técnico em material comercial. */}
        {showInstitucional ? (
          <View minPresenceAhead={70} wrap={false} style={{ backgroundColor: C.s50, borderLeftWidth: 3, borderLeftColor: C.navy, padding: 10, marginTop: 8 }}>
            <Text style={{ fontSize: 9, fontFamily: 'Poppins', fontWeight: 700, color: C.navy, textTransform: 'uppercase', letterSpacing: 0.5 }}>Identificação Institucional</Text>
            <Text style={[styles.cardMeta, { marginTop: 4 }]}>{d.razaoSocial}{nv(d.cnpjFireowl) ? `  ·  CNPJ ${d.cnpjFireowl}` : ''}</Text>
            {nv(d.contatoFireowl) ? <Text style={styles.cardMeta}>{d.contatoFireowl}</Text> : null}
          </View>
        ) : null}

        {/* Assinaturas */}
        <View minPresenceAhead={120} wrap={false}>
          <SecHead n={num()} titulo="Assinaturas" />
          {d.assinaturas.length > 0 ? (
            <View style={styles.signRow}>
              {d.assinaturas.map((s, i) => (
                <View key={i} style={styles.signCol}>
                  {nv(s.url) ? <Image src={s.url!} style={styles.signImg} /> : <View style={styles.signLine} />}
                  <Text style={styles.signName}>{s.nome}</Text>
                  <Text style={styles.signRole}>{PAPEL_LABEL[s.papel] || s.papel}{nv(s.cargo) ? ` — ${s.cargo}` : ''}{nv(s.documentoMasc) ? `  ·  ${s.documentoMasc}` : ''}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={{ fontSize: 8.5, color: C.s400, fontStyle: 'italic' }}>Sem assinaturas registradas.</Text>
          )}
        </View>

        {/* Encerramento / geo */}
        <View minPresenceAhead={50} wrap={false}>
          <SecHead titulo="Encerramento" />
          <View style={styles.infoGrid}>
            <Info label="Atendimento iniciado" value={d.dataInicio} />
            <Info label="Atendimento encerrado" value={d.dataFim} />
            <Info label="Localização registrada" value={d.geoRegistrada ? 'Sim' : undefined} />
          </View>
          <Text style={{ fontSize: 7, color: C.s400, marginTop: 2 }}>Coordenadas registradas como evidência indiciária; não constituem prova categórica de presença.</Text>
        </View>
      </Page>
    </Document>
  );
}
