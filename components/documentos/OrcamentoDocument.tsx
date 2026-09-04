import React from 'react';
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { Pedido, CompanyProfile, PedidoEquipmentItem } from '@/lib/types';
import { C, brl, nv, lnv, PdfHeader, PdfFooter, CamposExtras, itemTotal, DocCover, AreasAtuacaoPage, InclusoExcluso, ResumoExecutivoPage, SlaBloco, QrCode, contatoQrUrl, AuthenticityStamp } from './pdfKit';
import { gerarTituloProposta, apresentacaoAreas } from '@/lib/propostaTitulo';
import { websiteDisplay } from '@/lib/companyProfile';
import { normalizeCommercialProposalData } from '@/lib/commercialProposal';
import { renderWarranty } from '@/lib/commercialWarranty';
import { normalizeUnitCode } from '@/lib/commercialUnits';
import { DocOptions } from '@/lib/documentos';
import { verificationUrl } from '@/lib/documentVerification';

export type OrcamentoPdfOptions = Partial<DocOptions> & {
  capaImagemUrl?: string;
  /** Exibir a capa e a página de Áreas de Atuação (padrão: sim). */
  showCapa?: boolean;
  showAreasAtuacao?: boolean;
};

const styles = StyleSheet.create({
  // IMPORTANTE: sem lineHeight na Page (zera o <Text fixed render> do rodapé).
  page: { paddingTop: 58, paddingBottom: 42, paddingHorizontal: 40, fontSize: 9, fontFamily: 'Roboto', color: C.s700 },

  titleWrap: { marginBottom: 12 },
  eyebrow: { color: C.red, fontSize: 8, fontFamily: 'Roboto', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.6 },
  title: { color: C.navy, fontSize: 24, fontFamily: 'Poppins', fontWeight: 700, letterSpacing: 0.3, marginTop: 3 },
  titleBar: { width: 52, height: 4, backgroundColor: C.red, borderRadius: 2, marginTop: 7 },

  infoCard: { flexDirection: 'row', flexWrap: 'wrap', borderWidth: 1, borderColor: C.s200, borderRadius: 6, overflow: 'hidden', marginBottom: 14 },
  infoCell: { width: '50%', paddingVertical: 8, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: C.s100 },
  infoLabel: { color: C.s500, fontSize: 7, fontFamily: 'Roboto', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 2 },
  infoValue: { color: C.ink, fontSize: 9.5, fontFamily: 'Roboto', fontWeight: 700 },

  subTitle: { color: C.navy, fontSize: 9.5, fontFamily: 'Roboto', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4, marginTop: 6 },

  secHead: { flexDirection: 'row', alignItems: 'center', borderLeftWidth: 3, borderLeftColor: C.red, paddingLeft: 8, marginTop: 10, marginBottom: 6 },
  secNum: { backgroundColor: C.navy, color: C.white, fontSize: 8, fontFamily: 'Roboto', fontWeight: 700, paddingVertical: 1.5, paddingHorizontal: 5, borderRadius: 2, marginRight: 7 },
  secTitle: { color: C.navy, fontSize: 11, fontFamily: 'Poppins', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 },
  para: { fontSize: 9, color: C.s700, textAlign: 'justify', lineHeight: 1.4 },
  contatoCard: { backgroundColor: C.s50, borderWidth: 1, borderColor: C.s200, borderLeftWidth: 4, borderLeftColor: C.navy, borderRadius: 5, padding: 10, marginTop: 4 },

  th: { flexDirection: 'row', backgroundColor: C.navy },
  thCell: { color: C.white, fontSize: 7.5, fontFamily: 'Roboto', fontWeight: 700, textTransform: 'uppercase', paddingVertical: 6, paddingHorizontal: 6 },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.s200 },
  trAlt: { backgroundColor: C.s50 },
  td: { fontSize: 8, color: C.s700, paddingVertical: 5, paddingHorizontal: 6 },
  tfoot: { flexDirection: 'row', backgroundColor: C.s100, borderTopWidth: 1, borderTopColor: C.s300 },
  tfootCell: { fontSize: 8, fontFamily: 'Roboto', fontWeight: 700, color: C.ink, paddingVertical: 5, paddingHorizontal: 6 },

  totalWrap: { marginTop: 6, borderWidth: 1, borderColor: C.s200, borderRadius: 5, overflow: 'hidden', marginBottom: 14 },
  totalRowLight: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: C.s100, paddingVertical: 6, paddingHorizontal: 10 },
  totalRowNavy: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: C.navy, paddingVertical: 9, paddingHorizontal: 12, borderTopWidth: 3, borderTopColor: C.red },
  totalLabelGold: { color: C.gold, fontSize: 9, fontFamily: 'Poppins', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1 },
  totalValue: { color: C.white, fontSize: 16, fontFamily: 'Poppins', fontWeight: 700 },
  mensalGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: -8, marginBottom: 14 },
  mensalCell: { width: '48.5%', marginBottom: 6, backgroundColor: C.s50, borderWidth: 1, borderColor: C.s200, borderRadius: 5, paddingVertical: 6, paddingHorizontal: 10 },
  mensalLabel: { fontSize: 7.5, color: C.s500, fontFamily: 'Roboto', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 },
  mensalValue: { fontSize: 11, color: C.navy, fontFamily: 'Poppins', fontWeight: 700, marginTop: 2 },

  condCard: { backgroundColor: C.s50, borderWidth: 1, borderColor: C.s200, borderLeftWidth: 4, borderLeftColor: C.red, borderRadius: 5, padding: 10, marginBottom: 10 },
  condRow: { marginBottom: 4 },
  condLabel: { fontFamily: 'Roboto', fontWeight: 700, color: C.ink, textTransform: 'uppercase', fontSize: 8 },
  condText: { fontSize: 9, color: C.s700 },

  obs: { fontSize: 8, color: C.s500, fontStyle: 'italic', marginBottom: 4 },

  signRow: { flexDirection: 'row', marginTop: 26, gap: 28 },
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

const SecHead = ({ n, titulo }: { n?: string; titulo: string }) => (
  <View style={styles.secHead} minPresenceAhead={50}>
    {n ? <Text style={styles.secNum}>{n}</Text> : null}
    <Text style={styles.secTitle}>{titulo}</Text>
  </View>
);

// §15 — célula do resumo de valores do contrato recorrente.
const MensalCell = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.mensalCell}>
    <Text style={styles.mensalLabel}>{label}</Text>
    <Text style={styles.mensalValue}>{value}</Text>
  </View>
);

const ItensTable = ({ titulo, itens, showUnit, showTotal, showMarca, accent }: { titulo: string; itens: PedidoEquipmentItem[]; showUnit: boolean; showTotal: boolean; showMarca: boolean; accent: string }) => {
  const subtotal = itens.reduce((a, e) => a + itemTotal(e), 0);
  return (
    <View style={{ marginBottom: 10 }} minPresenceAhead={60}>
      <Text style={styles.subTitle}>{titulo}</Text>
      <View style={{ borderWidth: 1, borderColor: C.s200, borderRadius: 4, overflow: 'hidden' }}>
        <View style={[styles.th, { backgroundColor: accent }]} fixed>
          <Text style={[styles.thCell, { width: 24, textAlign: 'center' }]}>#</Text>
          <Text style={[styles.thCell, { flex: 1 }]}>Descrição</Text>
          {showMarca && <Text style={[styles.thCell, { width: 88 }]}>Marca / Modelo</Text>}
          <Text style={[styles.thCell, { width: 30, textAlign: 'center' }]}>Un.</Text>
          <Text style={[styles.thCell, { width: 30, textAlign: 'center' }]}>Qtd</Text>
          {showUnit && <Text style={[styles.thCell, { width: 62, textAlign: 'right' }]}>Unit.</Text>}
          {showTotal && <Text style={[styles.thCell, { width: 68, textAlign: 'right' }]}>Total</Text>}
        </View>
        {itens.map((eq, i) => {
          const unit = eq.precoUnitario || 0;
          const tot = itemTotal(eq);
          return (
            <View key={i} style={[styles.tr, i % 2 === 1 ? styles.trAlt : {}]} wrap={false}>
              <Text style={[styles.td, { width: 24, textAlign: 'center', color: C.red, fontFamily: 'Roboto', fontWeight: 700 }]}>{i + 1}</Text>
              <View style={[styles.td, { flex: 1 }]}><Text style={{ color: C.ink, fontFamily: 'Roboto', fontWeight: 700, fontSize: 8 }}>{eq.descricao}</Text>{showMarca && eq.descricaoDetalhada ? <Text style={{ color: C.s500, fontSize: 7, marginTop: 1, lineHeight: 1.3 }}>{eq.descricaoDetalhada}</Text> : null}{eq.desconto ? <Text style={{ color: C.red, fontSize: 6.5, marginTop: 1 }}>{`desconto: ${brl(eq.desconto)}`}</Text> : null}</View>
              {showMarca && <Text style={[styles.td, { width: 88 }]}>{eq.marcaModelo}</Text>}
              <Text style={[styles.td, { width: 30, textAlign: 'center' }]}>{normalizeUnitCode(eq.unidade)}</Text>
              <Text style={[styles.td, { width: 30, textAlign: 'center', fontFamily: 'Roboto', fontWeight: 700 }]}>{(eq.quantidade || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 })}</Text>
              {showUnit && <Text style={[styles.td, { width: 62, textAlign: 'right' }]}>{unit > 0 ? unit.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—'}</Text>}
              {showTotal && <Text style={[styles.td, { width: 68, textAlign: 'right', fontFamily: 'Roboto', fontWeight: 700, color: C.ink }]}>{tot > 0 ? tot.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—'}</Text>}
            </View>
          );
        })}
        {showTotal && (
          <View style={styles.tfoot} wrap={false}>
            <Text style={[styles.tfootCell, { flex: 1, textAlign: 'right', textTransform: 'uppercase' }]}>{`Subtotal ${titulo}`}</Text>
            <Text style={[styles.tfootCell, { width: 68, textAlign: 'right' }]}>{brl(subtotal)}</Text>
          </View>
        )}
      </View>
    </View>
  );
};

export function OrcamentoDocument({ pedido, companyProfile, options }: { pedido: Pedido; companyProfile: CompanyProfile; options?: OrcamentoPdfOptions }) {
  const p = normalizeCommercialProposalData(pedido.proposal);
  const warrantyView = renderWarranty(p.warranty);
  const razao = companyProfile.razaoSocial || 'Fireowl Controls';
  const fantasia = companyProfile.nomeFantasia || razao;
  const numero = pedido.numeroPedido;
  const dataEmissao = pedido.dataEmissao || '';
  const cliente = pedido.clienteNome || '';
  const assinante = pedido.responsavelComercialNome || 'Responsável Comercial';
  const referencia = pedido.referencia || 'Fornecimento e Serviços';

  const showLogo = options?.showLogo !== false;
  const showUnit = options?.showValorUnitario !== false;
  const showTotal = options?.showSubtotal !== false;
  const showMarca = options?.showDescricaoDetalhada !== false;
  const showAssinatura = options?.showAssinaturaCliente !== false;
  const showCampos = options?.showCamposPersonalizados === true;
  // §37/§38 — nível dimensiona o documento (simples = mais enxuto).
  const nivel = p.nivelProposta || 'tecnica';
  const showCapa = options?.showCapa !== false;
  const showAreas = options?.showAreasAtuacao !== false && nivel !== 'simples';
  const capaImagemUrl = options?.capaImagemUrl;
  const dataDoc = options?.dataHoje ? new Date().toISOString().split('T')[0] : dataEmissao;

  const itens = p.equipmentItems || [];
  const materiais = itens.filter((e) => e.tipo !== 'servico');
  const servicos = itens.filter((e) => e.tipo === 'servico');
  const validade = `${p.validadePropostaDias || 15} ${p.validadePropostaComplemento || 'dias corridos a partir da emissão'}`;

  // §15 — Contrato recorrente (valor mensal / anual / vigência).
  const recorrente = !!p.recorrente && (p.valorMensal || 0) > 0;
  const vMensal = p.valorMensal || 0;
  const vMeses = p.vigenciaMeses || 0;

  // §18/§28 — indicadores do resumo executivo (só os preenchidos).
  const indicadores: { valor: string; label: string }[] = [];
  if (recorrente) indicadores.push({ valor: `${brl(vMensal)}`, label: 'Valor mensal' });
  if ((p.unidadesAtendidas || 0) > 0) indicadores.push({ valor: String(p.unidadesAtendidas), label: 'Unidades atendidas' });
  if (nv(p.frequenciaManutencao)) indicadores.push({ valor: p.frequenciaManutencao!, label: 'Frequência' });
  if (nv(p.slaCritico)) indicadores.push({ valor: p.slaCritico!, label: 'SLA falhas críticas' });
  if (recorrente && vMeses > 0) indicadores.push({ valor: `${vMeses} meses`, label: 'Vigência' });
  const objetoBase = nv(p.objetivo) ? p.objetivo : nv(p.escopoServico) ? p.escopoServico : referencia;
  const objetoResumo = objetoBase.length > 320 ? `${objetoBase.slice(0, 317)}…` : objetoBase;

  const pagamento =
    (p.formasPagamento?.length || p.condicoesPagamento?.length)
      ? [p.formasPagamento?.length ? `Formas: ${p.formasPagamento.join(', ')}` : '', p.condicoesPagamento?.length ? p.condicoesPagamento.join(' · ') : ''].filter(Boolean).join(' — ')
      : (nv(p.formaPagamento) ? p.formaPagamento! : 'A combinar entre as partes.');

  const site = websiteDisplay(companyProfile.website);
  const contato = [companyProfile.telefone, companyProfile.email, site].filter(nv).join('  •  ');
  const qrUrl = contatoQrUrl(companyProfile.telefone, companyProfile.email); // §32
  const authenticityUrl = verificationUrl('orcamento', pedido.id);
  // P1 — título dinâmico (área × tipo) usado como subtítulo da capa.
  const tituloDin = (p.tituloManual && p.tituloManual.trim()) || gerarTituloProposta(p.areaPrincipal || [], p.tipoServico);

  return (
    <Document title={`Orçamento ${numero}`} author={razao}>
      {/* Capa (com a foto opcional, igual à proposta) */}
      {showCapa && (
        <DocCover
          razao={razao}
          cnpj={companyProfile.cnpj}
          endereco={companyProfile.endereco}
          telefone={companyProfile.telefone}
          email={companyProfile.email}
          website={site}
          titulo="Orçamento"
          subtitulo={tituloDin || 'Documento Comercial'}
          cliente={cliente}
          numero={numero}
          escopo={referencia}
          data={dataDoc}
          capaImagemUrl={capaImagemUrl}
          showLogo={showLogo}
          logoUrl={options?.logoUrl}
        />
      )}

      {/* Resumo Executivo (§18/§28) — só quando há indicadores */}
      {indicadores.length > 0 && nivel !== 'simples' && (
        <ResumoExecutivoPage fantasia={fantasia} numero={numero} data={dataDoc} cliente={cliente} indicadores={indicadores} objeto={objetoResumo} />
      )}

      {/* Áreas de Atuação */}
      {showAreas && <AreasAtuacaoPage razao={fantasia} numero={numero} data={dataDoc} cliente={cliente} areaIds={p.areaPrincipal} intro={apresentacaoAreas(p.areaPrincipal || [], { geral: companyProfile.apresentacaoGeral, porArea: companyProfile.apresentacaoAreas })} />}

      {/* Conteúdo */}
      <Page size="A4" style={styles.page}>
        <PdfHeader razao={fantasia} label="Orçamento" showLogo={showLogo} logoUrl={options?.logoUrl} />
        <PdfFooter numero={numero} data={dataDoc} cliente={cliente} />

        <View style={styles.titleWrap}>
          <Text style={styles.eyebrow}>Documento Comercial</Text>
          <Text style={styles.title}>Orçamento</Text>
          <View style={styles.titleBar} />
        </View>

        {/* Cabeçalho básico */}
        <View style={styles.infoCard}>
          <InfoCell label="Cliente / Contratante" value={cliente} full />
          <InfoCell label="Referência / Projeto" value={referencia} />
          <InfoCell label="Número" value={numero} />
          <InfoCell label="Data de Emissão" value={dataDoc} />
          <InfoCell label="Validade" value={validade} />
          <InfoCell label="Responsável" value={assinante} full />
        </View>
        <AuthenticityStamp url={authenticityUrl} />

        {(nv(p.objetivo) || nv(p.escopoServico)) && (
          <View minPresenceAhead={50}>
            <SecHead n="01" titulo="Objetivo" />
            <Text style={styles.para}>{nv(p.objetivo) ? p.objetivo : p.escopoServico}</Text>
            {nv(p.objetivo) && nv(p.escopoServico) && p.escopoServico.trim() !== p.objetivo.trim() && (
              <Text style={[styles.para, { marginTop: 4 }]}>
                <Text style={{ fontFamily: 'Roboto', fontWeight: 700, color: C.ink }}>Escopo: </Text>{p.escopoServico}
              </Text>
            )}
            {lnv(p.diretrizesNormativas) && (
              <Text style={{ fontSize: 8, color: C.s500, marginTop: 4 }}>
                <Text style={{ fontFamily: 'Roboto', fontWeight: 700, color: C.ink }}>Normas de referência: </Text>
                {p.diretrizesNormativas.filter(nv).join(' · ')}
              </Text>
            )}
          </View>
        )}

        {/* Seção 05 — Materiais e Serviços (o coração do orçamento) */}
        <SecHead n="02" titulo="Materiais e Serviços" />
        {materiais.length > 0 && <ItensTable titulo="Materiais" itens={materiais} showUnit={showUnit} showTotal={showTotal} showMarca={showMarca} accent={C.navy} />}
        {servicos.length > 0 && <ItensTable titulo="Serviços" itens={servicos} showUnit={showUnit} showTotal={showTotal} showMarca={showMarca} accent={C.green} />}
        {materiais.length === 0 && servicos.length === 0 && (
          <Text style={{ fontSize: 9, color: C.s400, fontStyle: 'italic', marginBottom: 8 }}>Itens conforme especificação técnica acordada.</Text>
        )}

        <InclusoExcluso incluso={p.incluso} naoIncluso={p.naoIncluso} />

        {/* Seção 11 — Preços */}
        <SecHead n="03" titulo="Preços" />
        <View style={styles.totalWrap} wrap={false}>
          {showTotal && (p.maoDeObra || 0) > 0 && (
            <View style={styles.totalRowLight}>
              <Text style={{ fontSize: 8, fontFamily: 'Roboto', fontWeight: 700, color: C.ink, textTransform: 'uppercase' }}>Mão de obra / Serviços adicionais</Text>
              <Text style={{ fontSize: 8, fontFamily: 'Roboto', fontWeight: 700, color: C.ink }}>{brl(p.maoDeObra || 0)}</Text>
            </View>
          )}
          <View style={styles.totalRowNavy}>
            <Text style={styles.totalLabelGold}>{recorrente ? 'Investimento Mensal' : 'Investimento Total'}</Text>
            <Text style={styles.totalValue}>{recorrente ? `${brl(vMensal)} / mês` : brl(p.valorTotal)}</Text>
          </View>
        </View>
        {recorrente && (
          <View style={styles.mensalGrid} wrap={false}>
            <MensalCell label="Valor mensal" value={brl(vMensal)} />
            <MensalCell label="Valor anual" value={brl(vMensal * 12)} />
            {vMeses > 0 && <MensalCell label="Vigência" value={`${vMeses} meses`} />}
            {vMeses > 0 && <MensalCell label="Valor estimado do contrato" value={brl(vMensal * vMeses)} />}
          </View>
        )}

        {/* Seção 13 — Impostos e Taxas */}
        <View minPresenceAhead={50} wrap={false}>
          <SecHead n="04" titulo="Impostos e Taxas" />
          <Text style={styles.para}>{nv(p.impostos) ? p.impostos : 'Impostos inclusos conforme o regime tributário vigente.'} Não inclui taxas de condomínio, aluguéis ou custos de estadia não previstos.</Text>
        </View>

        {/* Seção 14 — Condições de Pagamento */}
        <View minPresenceAhead={50} wrap={false}>
          <SecHead n="05" titulo="Condições de Pagamento" />
          <Text style={styles.para}>{pagamento}{nv(p.faturamento) ? ` Faturamento: ${p.faturamento}.` : ''}</Text>
        </View>

        {/* Seção 17 — Prazo de Fornecimento */}
        <View minPresenceAhead={50} wrap={false}>
          <SecHead n="06" titulo="Prazo de Fornecimento" />
          <Text style={styles.para}>{nv(p.prazoExecucao) ? p.prazoExecucao : 'A combinar após a confirmação do pedido.'}</Text>
        </View>

        {/* Seção 17 (SLA) — SLA em destaque, quando cadastrado */}
        <SlaBloco tabela={p.slaTabela} slaCritico={p.slaCritico} />

        {/* Seção 18 — Garantia (só aparece quando há condição informada) */}
        {warrantyView.hasAny && (
          <View minPresenceAhead={50} wrap={false}>
            <SecHead n="07" titulo="Garantia" />
            {warrantyView.legacyText !== undefined ? (
              <Text style={styles.para}>{warrantyView.legacyText}</Text>
            ) : (
              <View>
                {warrantyView.maoDeObra && (
                  <Text style={styles.para}><Text style={{ fontFamily: 'Roboto', fontWeight: 700, color: C.ink }}>Mão de obra: </Text>{warrantyView.maoDeObra}</Text>
                )}
                {warrantyView.materiais && (
                  <Text style={styles.para}><Text style={{ fontFamily: 'Roboto', fontWeight: 700, color: C.ink }}>Materiais/equipamentos: </Text>{warrantyView.materiais}</Text>
                )}
                {warrantyView.observacoes && <Text style={styles.para}>{warrantyView.observacoes}</Text>}
              </View>
            )}
          </View>
        )}

        {/* Seção 22 — Validade da Proposta */}
        <View minPresenceAhead={50} wrap={false}>
          <SecHead n="08" titulo="Validade da Proposta" />
          <Text style={styles.para}>Os preços permanecem fixos dentro do período de validade: {validade}. Após esse período, eventuais variações na base de preços dos fabricantes poderão ser repactuadas.</Text>
        </View>

        {lnv(p.premissas) && (
          <View wrap={false} minPresenceAhead={50}>
            <Text style={styles.subTitle}>Premissas</Text>
            {p.premissas.filter(nv).map((it, i) => (
              <View key={i} style={{ flexDirection: 'row', marginBottom: 3 }}>
                <Text style={{ color: C.red, fontFamily: 'Roboto', fontWeight: 700, marginRight: 6 }}>•</Text>
                <Text style={{ flex: 1, fontSize: 8.5, color: C.s700 }}>{it}</Text>
              </View>
            ))}
          </View>
        )}

        {showCampos && <CamposExtras campos={p.camposPersonalizados} />}

        {/* Dados de contato */}
        <View minPresenceAhead={70} wrap={false}>
          <SecHead titulo="Contato" />
          <View style={[styles.contatoCard, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 9, color: C.ink, fontFamily: 'Roboto', fontWeight: 700 }}>{razao}</Text>
              {nv(companyProfile.endereco) ? <Text style={{ fontSize: 8.5, color: C.s600, marginTop: 2 }}>{companyProfile.endereco}</Text> : null}
              {nv(companyProfile.cnpj) ? <Text style={{ fontSize: 8.5, color: C.s600, marginTop: 1 }}>CNPJ {companyProfile.cnpj}</Text> : null}
              {nv(contato) ? <Text style={{ fontSize: 9, color: C.navy, fontFamily: 'Roboto', fontWeight: 700, marginTop: 3 }}>{contato}</Text> : null}
            </View>
            {nv(qrUrl) ? (
              <View style={{ alignItems: 'center', marginLeft: 10 }}>
                <QrCode text={qrUrl} size={62} />
                <Text style={{ fontSize: 6.5, color: C.s500, fontFamily: 'Roboto', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 }}>Fale conosco</Text>
              </View>
            ) : null}
          </View>
        </View>

        {showAssinatura && (
          <View style={styles.signRow} wrap={false}>
            <View style={styles.signCol}>
              <View style={styles.signLine} />
              <Text style={styles.signName}>{razao}</Text>
              <Text style={styles.signRole}>{assinante}</Text>
            </View>
            <View style={styles.signCol}>
              <View style={styles.signLine} />
              <Text style={styles.signName}>{cliente}</Text>
              <Text style={styles.signRole}>De acordo &amp; Aceite</Text>
            </View>
          </View>
        )}
      </Page>
    </Document>
  );
}
