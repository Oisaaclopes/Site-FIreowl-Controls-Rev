import React from 'react';
import { Document, Page, View, Text, StyleSheet, Svg, Path, Font } from '@react-pdf/renderer';
import { Pedido, CompanyProfile, PedidoEquipmentItem } from '@/lib/types';
import {
  CARTA_APRESENTACAO,
  SERVICOS_OFERTADOS,
  EMBALAGEM_TRANSPORTE,
  SEGURANCA_TRABALHO,
  MULTAS_ATRASO,
  LIMITACAO_RESPONSABILIDADE,
  CONFIDENCIALIDADE,
  TERMO_ACEITE,
  CONDICOES_GERAIS,
  PRECOS_OBS,
  IMPOSTOS_OBS,
} from '@/lib/propostaTextos';

export interface PropostaPdfOptions {
  showLogo?: boolean;
  detailedSubtotal?: boolean;
  showIndice?: boolean;
  showHistorico?: boolean;
  showCarta?: boolean;
}

// Quebra de linha apenas nos espaços (não corta palavras no meio). Corrige o
// "encavalado" de nomes longos do cliente na capa e nos textos justificados.
Font.registerHyphenationCallback((word) => [word]);

const C = {
  navy: '#0B1E38',
  brand: '#1A1A72',
  red: '#E63946',
  gold: '#F2A900',
  green: '#047857',
  ink: '#0f172a',
  s700: '#334155',
  s600: '#475569',
  s500: '#64748b',
  s400: '#94a3b8',
  s300: '#cbd5e1',
  s200: '#e2e8f0',
  s100: '#f1f5f9',
  s50: '#f8fafc',
  white: '#ffffff',
};

// Logo oficial Fireowl (paths reaproveitados do componente OfficialLogo).
const LOGO_PATHS = [
  { d: 'M49 147.168C49 116.147 74.1471 91 105.168 91L358.832 91C389.853 91 415 116.147 415 147.168L415 371.832C415 402.853 389.853 428 358.832 428L105.168 428C74.1471 428 49 402.853 49 371.832Z', fill: C.brand },
  { d: 'M107.082 128.023 380.116 128.023 380.358 128.42 380.116 129.808 381.082 130.601 378.427 135.954 375.288 142.299 371.667 149.635 367.804 157.368 363.701 165.498 360.321 172.239 357.665 177.593 354.044 184.73 351.147 190.282 348.009 196.627 347.526 197.024 176.125 197.024 173.228 194.644 171.297 193.256 167.917 190.481 165.986 189.093 164.055 187.506 162.123 186.118 157.778 182.549 155.847 181.161 152.467 178.386 150.536 176.998 147.639 174.817 143.535 171.644 141.121 169.662 139.189 168.273 136.292 165.894 134.361 164.506 131.464 162.127 129.533 160.739 126.395 158.161 124.463 156.773 121.566 154.394 119.635 153.006 117.704 151.42 115.773 150.032 111.91 147.058 107.565 143.489 107.082 142.498Z', fill: C.red },
  { d: 'M105.448 156.05 106.416 156.249 111.252 160.225 113.187 161.616 118.023 165.592 119.958 166.983 126.004 171.953 127.938 173.344 130.84 175.73 132.775 177.121 139.546 182.687 141.481 184.078 145.592 187.259 148.494 189.445 150.428 191.036 152.363 192.427 155.265 194.812 157.2 196.204 161.311 199.385 163.729 201.173 165.664 202.565 166.148 203.161 166.389 231.388 166.389 285.059 166.148 285.655 165.664 285.854 159.618 285.854 153.814 284.86 136.644 281.481 124.795 279.294 111.252 276.71 107.141 275.915 106.174 275.319 105.69 273.728 105.448 270.349 105.206 231.786 104.964 230.593 103.03 231.984 100.853 233.773 98.9189 235.761 96.2586 238.743 93.115 242.719 89.0038 248.284 87.3108 251.266 85.86 254.844 84.8927 259.019 84.8927 262.199 85.6181 265.976 86.8273 269.157 88.7619 272.337 91.1801 275.12 93.3566 277.108 95.0496 278.698 97.7097 280.686 100.612 282.475 104.481 284.463 110.043 286.848 115.847 288.836 121.651 290.426 128.906 292.016 138.095 293.606 146.318 294.6 155.991 295.395 165.664 295.793 179.448 295.793 190.331 295.395 206.049 294.203 218.625 292.811 230.233 291.221 243.05 289.034 256.108 286.45 266.507 284.065 273.762 282.276 282.952 279.692 294.318 276.313 301.089 274.126 307.618 271.741 314.389 269.355 322.37 266.374 329.141 263.789 341.233 258.82 344.618 257.23 348.488 255.639 354.533 252.857 367.35 246.694 371.945 244.309 381.377 239.141 385.246 236.954 388.873 234.966 389.84 234.966 390.082 235.96 388.389 237.749 385.487 240.134 383.553 241.526 380.893 243.514 377.507 245.7 373.638 248.284 370.252 250.471 365.899 253.254 361.788 255.838 357.435 258.422 353.566 260.609 348.971 263.193 343.651 266.175 335.671 270.548 329.867 273.53 322.854 276.909 317.775 279.294 310.037 282.674 305.442 284.661 298.912 287.444 293.108 289.631 289.481 291.022 284.403 293.01 275.938 295.992 266.749 298.974 259.01 301.359 244.501 305.335 238.455 306.925 226.605 309.708 213.305 312.491 206.049 313.882 194.925 315.472 187.671 316.466 177.514 317.46 163.487 318.653 155.991 319.05 142.932 319.05 132.291 318.653 122.86 317.858 113.429 316.864 105.448 315.671 101.821 314.677 97.4678 313.286 93.5985 312.491 85.3762 309.708 79.3304 307.322 75.4612 305.335 72.5592 303.545 69.4156 301.359 65.788 298.377 62.8861 294.998 60.226 290.824 58.5332 287.047 57.324 282.276 57.0822 280.686 57.0822 276.71 58.2914 270.945 60.226 266.175 62.4025 262.199 65.5461 257.826 68.4481 254.447 71.5919 251.266 73.5265 249.278 75.9449 247.092 77.6377 245.502 83.6835 240.532 85.6181 239.141 88.52 236.954 91.6639 234.767 99.8862 229.599 103.514 227.413 105.206 226.419ZM104.723 227.81 104.481 228.605 104.964 228.605Z', fill: C.red },
  { d: 'M176.153 206.099 207.881 206.099 287.08 206.298 339.152 206.298 338.91 208.089 339.152 209.482 338.91 211.87 330.433 225.801 325.589 234.955 322.199 241.323 319.292 247.094 315.417 254.656 311.058 263.014 308.151 268.786 307.424 269.383 297.494 269.781 277.876 270.378 258.742 271.174 240.578 271.771 220.959 272.567 218.295 272.567 218.295 282.517 218.053 284.507 217.811 284.706 197.95 285.502 179.059 286.099 176.637 286.099 176.395 285.104 176.153 281.124Z', fill: C.red },
  { d: 'M216.992 319.209 218.186 319.409 216.276 322.202 214.844 323.798 208.876 328.786 206.967 330.182 204.341 332.177 201.715 333.973 198.851 335.968 194.793 338.562 190.496 341.355 186.438 344.148 183.335 346.343 179.992 348.937 178.083 350.333 175.457 352.328 173.547 353.725 170.205 356.119 164.954 359.71 161.851 361.905 159.225 363.701 157.554 365.097 155.644 366.494 152.064 369.088 149.676 370.883 147.767 372.28 144.425 374.674 142.038 376.47 140.128 377.866 137.741 379.662 135.115 381.457 132.967 383.253 131.057 384.65 127.954 387.044 122.702 390.635 118.883 393.229 116.257 395.024 112.915 397.418 109.335 400.012 107.664 401.209 107.425 401.209 107.186 395.623 107.186 388.64 107.664 349.934 107.902 334.971 108.141 328.187 108.857 327.988 121.031 328.586 136.547 328.586 146.096 328.187 157.315 327.589 173.309 326.192 186.676 324.596 195.986 323.199 208.399 321.005Z', fill: C.red },
];

const styles = StyleSheet.create({
  page: { paddingTop: 40, paddingBottom: 54, paddingHorizontal: 40, fontSize: 9, fontFamily: 'Helvetica', color: C.s700, lineHeight: 1.5 },
  // Rodapé fixo
  footer: {
    position: 'absolute', bottom: 22, left: 40, right: 40,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderTopWidth: 1, borderTopColor: C.s200, paddingTop: 5,
  },
  footerText: { fontSize: 7, color: C.s500, textTransform: 'uppercase', letterSpacing: 0.4 },
  footerMono: { fontSize: 7, color: C.s500, fontFamily: 'Helvetica-Bold' },
  // Capa
  coverBanner: { backgroundColor: C.navy, borderRadius: 10, padding: 22, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  logoBox: { backgroundColor: C.white, borderRadius: 8, padding: 5, width: 46, height: 46, alignItems: 'center', justifyContent: 'center' },
  brandName: { color: C.white, fontFamily: 'Helvetica-Bold', fontSize: 16, letterSpacing: 1 },
  coverKicker: { color: C.gold, fontSize: 8, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 1.4 },
  coverMid: { marginTop: 60, borderLeftWidth: 4, borderLeftColor: C.red, paddingLeft: 16 },
  coverLabel: { fontSize: 8, color: C.s400, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 2 },
  coverValueBig: { fontSize: 22, color: C.ink, fontFamily: 'Helvetica-Bold', marginBottom: 18 },
  coverValue: { fontSize: 13, color: C.s700, fontFamily: 'Helvetica-Bold', marginBottom: 18 },
  coverFooter: { marginTop: 'auto', borderTopWidth: 1, borderTopColor: C.s200, paddingTop: 8, flexDirection: 'row', justifyContent: 'space-between' },
  coverFooterText: { fontSize: 7.5, color: C.s500, textTransform: 'uppercase', letterSpacing: 0.4 },
  // Seções
  section: { marginBottom: 16 },
  secHead: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1.5, borderBottomColor: C.red, paddingBottom: 3, marginBottom: 7 },
  secNum: { backgroundColor: C.navy, color: C.white, fontSize: 8, fontFamily: 'Helvetica-Bold', paddingVertical: 1.5, paddingHorizontal: 5, borderRadius: 2, marginRight: 6 },
  secTitle: { color: C.navy, fontSize: 12, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.3 },
  subTitle: { color: C.navy, fontSize: 9, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', marginBottom: 3, marginTop: 4 },
  para: { fontSize: 9, color: C.s700, textAlign: 'justify', marginBottom: 5 },
  bulletRow: { flexDirection: 'row', marginBottom: 3 },
  bulletDot: { color: C.red, fontFamily: 'Helvetica-Bold', marginRight: 5 },
  bulletText: { flex: 1, fontSize: 9, color: C.s700, textAlign: 'justify' },
  // Tabelas
  th: { flexDirection: 'row', backgroundColor: C.navy },
  thCell: { color: C.white, fontSize: 7.5, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', padding: 5 },
  tr: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.s200 },
  trAlt: { backgroundColor: C.s50 },
  td: { fontSize: 8, color: C.s700, padding: 5 },
  tfoot: { flexDirection: 'row', backgroundColor: C.s100 },
  tfootCell: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.ink, padding: 5 },
  // Totais
  totalWrap: { marginTop: 2, borderWidth: 1, borderColor: C.s200, borderRadius: 4, overflow: 'hidden' },
  totalRowLight: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: C.s100, paddingVertical: 5, paddingHorizontal: 8 },
  totalRowNavy: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: C.navy, paddingVertical: 6, paddingHorizontal: 8 },
  totalLabelGold: { color: C.gold, fontSize: 8, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 0.8 },
  totalValue: { color: C.white, fontSize: 14, fontFamily: 'Helvetica-Bold' },
  // Blocos
  infoBox: { backgroundColor: C.s50, borderWidth: 1, borderColor: C.s200, borderRadius: 5, padding: 10 },
  precoCard: { backgroundColor: C.navy, borderRadius: 6, padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  // Índice
  idxRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  idxNum: { fontFamily: 'Helvetica-Bold', color: C.navy, width: 22, fontSize: 9 },
  // Assinaturas
  signRow: { flexDirection: 'row', marginTop: 34, gap: 30 },
  signCol: { flex: 1, alignItems: 'center' },
  signLine: { borderBottomWidth: 1, borderBottomColor: C.s400, width: '100%', height: 28, marginBottom: 5 },
});

const brl = (n: number) => `R$ ${(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
const nv = (s?: string) => !!s && s.trim().length > 0;
const lnv = (a?: string[]) => Array.isArray(a) && a.filter((x) => nv(x)).length > 0;

const Logo = () => (
  <Svg viewBox="0 0 503 503" style={{ width: 36, height: 36 }}>
    {LOGO_PATHS.map((p, i) => (
      <Path key={i} d={p.d} fill={p.fill} stroke="#0C0C0C" strokeWidth={4} fillRule="evenodd" />
    ))}
  </Svg>
);

const Footer = ({ razao, numero }: { razao: string; numero: string }) => (
  <View fixed style={styles.footer}>
    <Text style={styles.footerText}>{`© ${new Date().getFullYear()} ${razao}`}</Text>
    <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Página ${pageNumber} de ${totalPages}`} />
    <Text style={styles.footerMono}>{numero}</Text>
  </View>
);

const SecHead = ({ n, titulo }: { n: string; titulo: string }) => (
  <View style={styles.secHead} minPresenceAhead={44}>
    {n ? <Text style={styles.secNum}>{n}</Text> : null}
    <Text style={styles.secTitle}>{titulo}</Text>
  </View>
);

const Paras = ({ paras }: { paras: string[] }) => (
  <>
    {paras.filter(nv).map((p, i) => (
      <Text key={i} style={styles.para}>{p}</Text>
    ))}
  </>
);

const Bullets = ({ itens }: { itens: string[] }) => (
  <>
    {itens.filter(nv).map((it, i) => (
      <View key={i} style={styles.bulletRow}>
        <Text style={styles.bulletDot}>•</Text>
        <Text style={styles.bulletText}>{it}</Text>
      </View>
    ))}
  </>
);

// Tabela de itens (Materiais/Serviços) com zebra e subtotal.
const ItensTable = ({
  titulo,
  itens,
  detailed,
  showMarca = true,
  accent = C.navy,
}: {
  titulo: string;
  itens: PedidoEquipmentItem[];
  detailed: boolean;
  showMarca?: boolean;
  accent?: string;
}) => {
  const subtotal = itens.reduce((a, e) => a + (e.precoUnitario || 0) * e.quantidade, 0);
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={styles.subTitle}>{titulo}</Text>
      <View style={{ borderWidth: 1, borderColor: C.s200, borderRadius: 4, overflow: 'hidden' }}>
        <View style={[styles.th, { backgroundColor: accent }]} fixed>
          <Text style={[styles.thCell, { width: 26, textAlign: 'center' }]}>#</Text>
          <Text style={[styles.thCell, { flex: 1 }]}>Descrição</Text>
          {showMarca && <Text style={[styles.thCell, { width: 90 }]}>Marca / Modelo</Text>}
          <Text style={[styles.thCell, { width: 34, textAlign: 'center' }]}>Un.</Text>
          <Text style={[styles.thCell, { width: 34, textAlign: 'center' }]}>Qtd</Text>
          {detailed && <Text style={[styles.thCell, { width: 60, textAlign: 'right' }]}>Unit.</Text>}
          {detailed && <Text style={[styles.thCell, { width: 66, textAlign: 'right' }]}>Total</Text>}
        </View>
        {itens.map((eq, i) => {
          const unit = eq.precoUnitario || 0;
          const tot = unit * eq.quantidade;
          return (
            <View key={i} style={[styles.tr, i % 2 === 1 ? styles.trAlt : {}]} wrap={false}>
              <Text style={[styles.td, { width: 26, textAlign: 'center', color: C.red, fontFamily: 'Helvetica-Bold' }]}>{i + 1}</Text>
              <Text style={[styles.td, { flex: 1, color: C.ink, fontFamily: 'Helvetica-Bold' }]}>{eq.descricao}</Text>
              {showMarca && <Text style={[styles.td, { width: 90 }]}>{eq.marcaModelo}</Text>}
              <Text style={[styles.td, { width: 34, textAlign: 'center', textTransform: 'uppercase' }]}>{eq.unidade}</Text>
              <Text style={[styles.td, { width: 34, textAlign: 'center', fontFamily: 'Helvetica-Bold' }]}>{eq.quantidade}</Text>
              {detailed && <Text style={[styles.td, { width: 60, textAlign: 'right' }]}>{unit > 0 ? unit.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—'}</Text>}
              {detailed && <Text style={[styles.td, { width: 66, textAlign: 'right', fontFamily: 'Helvetica-Bold', color: C.ink }]}>{tot > 0 ? tot.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—'}</Text>}
            </View>
          );
        })}
        {detailed && (
          <View style={styles.tfoot}>
            <Text style={[styles.tfootCell, { flex: 1, textAlign: 'right', textTransform: 'uppercase' }]}>{`Subtotal ${titulo}`}</Text>
            <Text style={[styles.tfootCell, { width: 66, textAlign: 'right' }]}>{brl(subtotal)}</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const CoverField = ({ label, value, big, size }: { label: string; value: string; big?: boolean; size?: number }) => (
  <View style={{ width: '100%' }}>
    <Text style={styles.coverLabel}>{label}</Text>
    <Text style={[big ? styles.coverValueBig : styles.coverValue, size ? { fontSize: size, lineHeight: 1.25 } : {}]}>
      {value || '—'}
    </Text>
  </View>
);

export function PropostaDocument({
  pedido,
  companyProfile,
  options,
}: {
  pedido: Pedido;
  companyProfile: CompanyProfile;
  options?: PropostaPdfOptions;
}) {
  const p = pedido.proposal;
  const razao = companyProfile.razaoSocial || 'Fireowl Controls';
  const numero = pedido.numeroPedido;
  const assinante = pedido.responsavelComercialNome || 'Responsável Comercial';
  const escopoTitulo = pedido.referencia || 'Fornecimento e Serviços de Engenharia';

  const showLogo = options?.showLogo !== false;
  const detailed = options?.detailedSubtotal !== false;
  const showIndice = options?.showIndice !== false;
  const showHistorico = options?.showHistorico !== false;
  const showCarta = options?.showCarta !== false;

  // Fonte do nome do cliente reduz conforme o comprimento (nomes muito longos
  // acomodam com elegância, sem estourar a largura da capa).
  const clienteNome = pedido.clienteNome || '';
  const clienteFont = clienteNome.length > 60 ? 13 : clienteNome.length > 44 ? 15 : clienteNome.length > 30 ? 18 : 22;

  const itens = p.equipmentItems || [];
  const materiais = itens.filter((e) => e.tipo !== 'servico');
  const servicos = itens.filter((e) => e.tipo === 'servico');

  // Cláusulas controladas pela proposta.
  const incMultas = p.incluirMultas !== false;
  const incLimitacao = p.incluirLimitacao !== false;
  const incConfid = p.incluirConfidencialidade !== false;
  const incCondGerais = p.incluirCondicoesGerais !== false;
  const incSeguranca = p.incluirSeguranca !== false;
  const incTermoAceite = p.incluirTermoAceite !== false;
  const temMateriais = materiais.length > 0;

  const secoes = [
    { key: 'carta', titulo: 'Carta de Apresentação', visible: showCarta },
    { key: 'historico', titulo: 'Histórico de Propostas', visible: showHistorico },
    { key: 'visao', titulo: 'Visão Geral da Proposta', visible: true },
    { key: 'escopo', titulo: 'Escopo da Proposta', visible: true },
    { key: 'itens', titulo: 'Materiais e Serviços Ofertados', visible: true },
    { key: 'premissas', titulo: 'Premissas Adotadas', visible: true },
    { key: 'servicos', titulo: 'Descrição dos Serviços Ofertados', visible: true },
    { key: 'embalagem', titulo: 'Embalagem, Transporte e Armazenamento', visible: temMateriais },
    { key: 'seguranca', titulo: 'Segurança do Trabalho', visible: incSeguranca },
    { key: 'obrigacoes', titulo: 'Obrigações da Contratante', visible: true },
    { key: 'precos', titulo: 'Preços', visible: true },
    { key: 'infoCompra', titulo: 'Informações para o Pedido de Compra', visible: true },
    { key: 'impostos', titulo: 'Impostos e Taxas', visible: true },
    { key: 'pagamento', titulo: 'Condições de Pagamento', visible: true },
    { key: 'multas', titulo: 'Multas por Atraso de Pagamento', visible: incMultas },
    { key: 'limitacao', titulo: 'Limitação de Responsabilidade', visible: incLimitacao },
    { key: 'prazo', titulo: 'Prazo de Fornecimento', visible: true },
    { key: 'garantia', titulo: 'Garantia', visible: true },
    { key: 'confidencialidade', titulo: 'Confidencialidade', visible: incConfid },
    { key: 'termoAceite', titulo: 'Termo de Aceite da Proposta', visible: incTermoAceite },
    { key: 'condicoesGerais', titulo: 'Condições Gerais', visible: incCondGerais },
    { key: 'validade', titulo: 'Validade da Proposta', visible: true },
    { key: 'conclusao', titulo: 'Conclusão', visible: true },
    { key: 'aceite', titulo: 'Aceite da Proposta', visible: true },
  ];
  const vis = secoes.filter((s) => s.visible);
  const num = (key: string) => {
    const i = vis.findIndex((s) => s.key === key);
    return i >= 0 ? String(i + 1).padStart(2, '0') : '';
  };
  const on = (key: string) => vis.some((s) => s.key === key);

  const Sec = ({ k, children }: { k: string; children: React.ReactNode }) => (
    <View style={styles.section}>
      <SecHead n={num(k)} titulo={secoes.find((s) => s.key === k)!.titulo} />
      {children}
    </View>
  );

  return (
    <Document title={`Proposta ${numero}`} author={razao}>
      {/* ===== CAPA ===== */}
      <Page size="A4" style={styles.page}>
        <Footer razao={razao} numero={numero} />
        <View style={styles.coverBanner}>
          {showLogo ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={styles.logoBox}>
                <Logo />
              </View>
              <Text style={styles.brandName}>FIREOWL CONTROLS</Text>
            </View>
          ) : (
            <Text style={styles.brandName}>FIREOWL CONTROLS</Text>
          )}
          <Text style={styles.coverKicker}>Documento Técnico-Comercial</Text>
        </View>
        <View style={styles.coverMid}>
          <Text style={{ color: C.red, fontSize: 9, fontFamily: 'Helvetica-Bold', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 10 }}>
            Proposta Técnico-Comercial
          </Text>
          <CoverField label="Cliente" value={pedido.clienteNome} big size={clienteFont} />
          <CoverField label="Número da Proposta" value={numero} />
          <CoverField label="Escopo de Fornecimento" value={escopoTitulo} />
          <CoverField label="Data" value={pedido.dataEmissao} />
        </View>
        <View style={styles.coverFooter}>
          <Text style={styles.coverFooterText}>{`${razao} • CNPJ ${companyProfile.cnpj}`}</Text>
          <Text style={styles.coverFooterText}>{companyProfile.endereco}</Text>
        </View>
      </Page>

      {/* ===== CONTEÚDO ===== */}
      <Page size="A4" style={styles.page}>
        <Footer razao={razao} numero={numero} />

        {on('carta') && (
          <Sec k="carta">
            <Paras paras={nv(p.cartaApresentacao) ? p.cartaApresentacao!.split('\n').map((x) => x.trim()).filter(Boolean) : CARTA_APRESENTACAO} />
            <View style={{ marginTop: 12 }}>
              <Text style={{ marginBottom: 14, fontSize: 9 }}>Atenciosamente,</Text>
              <Text style={{ fontFamily: 'Helvetica-Bold', color: C.ink, fontSize: 9 }}>{assinante}</Text>
              <Text style={{ color: C.s600, fontSize: 9 }}>{`Responsável Comercial — ${razao}`}</Text>
              {nv(companyProfile.telefone) && <Text style={{ color: C.s500, fontSize: 9 }}>{companyProfile.telefone}</Text>}
              {nv(companyProfile.email) && <Text style={{ color: C.s500, fontSize: 9 }}>{companyProfile.email}</Text>}
            </View>
          </Sec>
        )}

        {showIndice && (
          <View style={styles.section}>
            <SecHead n="" titulo="Índice" />
            {vis.map((s, i) => (
              <View key={s.key} style={styles.idxRow}>
                <Text style={styles.idxNum}>{String(i + 1).padStart(2, '0')}</Text>
                <Text style={{ fontSize: 9, color: C.s700 }}>{s.titulo}</Text>
              </View>
            ))}
          </View>
        )}

        {on('historico') && (
          <Sec k="historico">
            <View style={{ borderWidth: 1, borderColor: C.s200, borderRadius: 4, overflow: 'hidden' }}>
              <View style={styles.th}>
                <Text style={[styles.thCell, { width: 120 }]}>Revisão / Número</Text>
                <Text style={[styles.thCell, { width: 70 }]}>Data</Text>
                <Text style={[styles.thCell, { flex: 1 }]}>Elaborador</Text>
                <Text style={[styles.thCell, { width: 80 }]}>Status</Text>
              </View>
              {(p.revisoes || []).map((rev, i) => (
                <View key={i} style={[styles.tr, i % 2 === 1 ? styles.trAlt : {}]}>
                  <Text style={[styles.td, { width: 120, fontFamily: 'Helvetica-Bold', color: C.ink }]}>{rev.numero}</Text>
                  <Text style={[styles.td, { width: 70 }]}>{rev.data}</Text>
                  <Text style={[styles.td, { flex: 1 }]}>{rev.elaborador}{rev.motivo ? ` — ${rev.motivo}` : ''}</Text>
                  <Text style={[styles.td, { width: 80, textTransform: 'uppercase' }]}>{(rev.status || '').replace(/_/g, ' ')}</Text>
                </View>
              ))}
              <View style={[styles.tr, { backgroundColor: '#fffbeb' }]}>
                <Text style={[styles.td, { width: 120, fontFamily: 'Helvetica-Bold', color: C.ink }]}>{numero}</Text>
                <Text style={[styles.td, { width: 70 }]}>{pedido.dataEmissao}</Text>
                <Text style={[styles.td, { flex: 1 }]}>{`${assinante} (versão atual)`}</Text>
                <Text style={[styles.td, { width: 80, textTransform: 'uppercase', color: C.red, fontFamily: 'Helvetica-Bold' }]}>{pedido.status.replace(/_/g, ' ')}</Text>
              </View>
            </View>
          </Sec>
        )}

        <Sec k="visao">
          <Text style={styles.subTitle}>{`${num('visao')}.1. Introdução`}</Text>
          <Text style={styles.para}>{nv(p.objetivo) ? p.objetivo : `Apresentamos nossa proposta para o fornecimento e execução dos serviços referentes a ${escopoTitulo}, para ${pedido.clienteNome}.`}</Text>
          {lnv(p.diretrizesNormativas) && (
            <>
              <Text style={styles.subTitle}>Diretrizes normativas de referência</Text>
              <Bullets itens={p.diretrizesNormativas} />
            </>
          )}
        </Sec>

        <Sec k="escopo">
          <Text style={styles.subTitle}>{`${num('escopo')}.1. Descrição do escopo proposto`}</Text>
          <View style={[styles.infoBox]}>
            <Text style={{ fontSize: 9, color: C.s700, textAlign: 'justify' }}>{nv(p.escopoServico) ? p.escopoServico : 'Escopo conforme especificação técnica acordada com o cliente.'}</Text>
          </View>
        </Sec>

        <Sec k="itens">
          {materiais.length > 0 && <ItensTable titulo="Materiais" itens={materiais} detailed={detailed} showMarca />}
          {servicos.length > 0 && <ItensTable titulo="Serviços" itens={servicos} detailed={detailed} showMarca={false} accent={C.green} />}
          {materiais.length === 0 && servicos.length === 0 && (
            <Text style={{ fontSize: 9, color: C.s400, fontStyle: 'italic' }}>Itens conforme especificação técnica acordada.</Text>
          )}
          {detailed && (
            <View style={styles.totalWrap} wrap={false}>
              {(p.maoDeObra || 0) > 0 && (
                <View style={styles.totalRowLight}>
                  <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.ink, textTransform: 'uppercase' }}>Mão de obra / Serviços adicionais</Text>
                  <Text style={{ fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.ink }}>{brl(p.maoDeObra || 0)}</Text>
                </View>
              )}
              <View style={styles.totalRowNavy}>
                <Text style={styles.totalLabelGold}>Valor Total</Text>
                <Text style={styles.totalValue}>{brl(p.valorTotal)}</Text>
              </View>
            </View>
          )}
        </Sec>

        <Sec k="premissas">
          {lnv(p.premissas) ? <Bullets itens={p.premissas} /> : <Text style={{ fontSize: 9, color: C.s500, fontStyle: 'italic' }}>Premissas conforme rotinas padrão de execução.</Text>}
        </Sec>

        <Sec k="servicos">
          {SERVICOS_OFERTADOS.map((s, i) => (
            <View key={i}>
              <Text style={styles.subTitle}>{`${num('servicos')}.${i + 1}. ${s.titulo}`}</Text>
              <Bullets itens={s.itens} />
            </View>
          ))}
          {lnv(p.entregaveis) && (
            <>
              <Text style={styles.subTitle}>Entregáveis do projeto</Text>
              <Bullets itens={p.entregaveis} />
            </>
          )}
          {lnv(p.responsabilidadesContratada) && (
            <>
              <Text style={styles.subTitle}>Responsabilidades da Contratada</Text>
              <Bullets itens={p.responsabilidadesContratada} />
            </>
          )}
        </Sec>

        {on('embalagem') && (
          <Sec k="embalagem"><Paras paras={EMBALAGEM_TRANSPORTE} /></Sec>
        )}
        {on('seguranca') && (
          <Sec k="seguranca"><Bullets itens={SEGURANCA_TRABALHO} /></Sec>
        )}

        <Sec k="obrigacoes">
          {lnv(p.responsabilidadesContratante) ? (
            <Bullets itens={p.responsabilidadesContratante} />
          ) : (
            <Bullets itens={['Liberação das frentes de trabalho e dos acessos necessários à equipe.', 'Fornecimento de ponto de energia elétrica 120/220 Vac para os serviços.', 'Local seguro e adequado para guarda de materiais e ferramentas.']} />
          )}
        </Sec>

        <Sec k="precos">
          <View style={styles.precoCard} wrap={false}>
            <Text style={styles.totalLabelGold}>Investimento Total</Text>
            <Text style={styles.totalValue}>{brl(p.valorTotal)}</Text>
          </View>
          <Paras paras={PRECOS_OBS} />
        </Sec>

        <Sec k="infoCompra">
          <View style={styles.infoBox}>
            <Text style={{ fontSize: 9, marginBottom: 3 }}><Text style={{ fontFamily: 'Helvetica-Bold', color: C.ink }}>Razão Social: </Text>{razao}</Text>
            <Text style={{ fontSize: 9, marginBottom: 3 }}><Text style={{ fontFamily: 'Helvetica-Bold', color: C.ink }}>CNPJ: </Text>{companyProfile.cnpj}</Text>
            <Text style={{ fontSize: 9, marginBottom: 3 }}><Text style={{ fontFamily: 'Helvetica-Bold', color: C.ink }}>Endereço: </Text>{companyProfile.endereco}</Text>
            {nv(companyProfile.telefone) && <Text style={{ fontSize: 9, marginBottom: 3 }}><Text style={{ fontFamily: 'Helvetica-Bold', color: C.ink }}>Telefone: </Text>{companyProfile.telefone}</Text>}
            {nv(companyProfile.email) && <Text style={{ fontSize: 9 }}><Text style={{ fontFamily: 'Helvetica-Bold', color: C.ink }}>E-mail: </Text>{companyProfile.email}</Text>}
          </View>
        </Sec>

        <Sec k="impostos">
          <Paras paras={nv(p.impostos) ? [`Regime/observação: ${p.impostos}`, ...IMPOSTOS_OBS] : IMPOSTOS_OBS} />
        </Sec>

        <Sec k="pagamento">
          {p.formasPagamento?.length || p.condicoesPagamento?.length ? (
            <>
              {p.formasPagamento && p.formasPagamento.length > 0 && (
                <Text style={{ fontSize: 9, marginBottom: 4 }}><Text style={{ fontFamily: 'Helvetica-Bold', color: C.ink, textTransform: 'uppercase' }}>Formas de pagamento aceitas: </Text>{p.formasPagamento.join(', ')}.</Text>
              )}
              {p.condicoesPagamento && p.condicoesPagamento.length > 0 && (
                <>
                  <Text style={{ fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.ink, textTransform: 'uppercase', marginBottom: 3 }}>Condições:</Text>
                  <Bullets itens={p.condicoesPagamento} />
                </>
              )}
            </>
          ) : (
            <Text style={styles.para}>{nv(p.formaPagamento) ? p.formaPagamento : 'A combinar entre as partes.'}</Text>
          )}
          {nv(p.faturamento) && (
            <Text style={{ fontSize: 9, marginTop: 4 }}><Text style={{ fontFamily: 'Helvetica-Bold', color: C.ink, textTransform: 'uppercase' }}>Faturamento: </Text>{p.faturamento}</Text>
          )}
        </Sec>

        {on('multas') && <Sec k="multas"><Paras paras={MULTAS_ATRASO} /></Sec>}
        {on('limitacao') && <Sec k="limitacao"><Paras paras={LIMITACAO_RESPONSABILIDADE} /></Sec>}

        <Sec k="prazo">
          <Text style={styles.para}>{nv(p.prazoExecucao) ? p.prazoExecucao : 'Prazo a ser definido após confirmação do pedido.'}</Text>
        </Sec>

        <Sec k="garantia">
          <Text style={styles.para}>{nv(p.garantia) ? p.garantia : 'Garantia de 90 (noventa) dias sobre os serviços de instalação e de 12 (doze) meses para os equipamentos fornecidos, contra defeitos de fabricação, a contar da entrega.'}</Text>
        </Sec>

        {on('confidencialidade') && <Sec k="confidencialidade"><Paras paras={CONFIDENCIALIDADE} /></Sec>}
        {on('termoAceite') && <Sec k="termoAceite"><Paras paras={TERMO_ACEITE} /></Sec>}
        {on('condicoesGerais') && <Sec k="condicoesGerais"><Paras paras={CONDICOES_GERAIS} /></Sec>}

        <Sec k="validade">
          <Text style={styles.para}>{`Os preços permanecem fixos dentro do período de validade desta proposta, que é de ${p.validadePropostaDias || 15} ${p.validadePropostaComplemento || 'dias corridos a partir da emissão'}. Após este período, eventuais variações na base de preços dos fabricantes poderão ser repactuadas.`}</Text>
        </Sec>

        <Sec k="conclusao">
          <Text style={[styles.para, { fontStyle: 'italic' }]}>{nv(p.conclusao) ? p.conclusao : 'Reiteramos nosso compromisso com a qualidade e a segurança, permanecendo à disposição para eventuais esclarecimentos e negociações. Aguardamos sua análise e retorno.'}</Text>
        </Sec>

        {/* Aceite: mantém junto para não quebrar no meio */}
        <View style={styles.section} minPresenceAhead={160} wrap={false}>
          <SecHead n={num('aceite')} titulo="Aceite da Proposta" />
          <Text style={[styles.para, { marginBottom: 8 }]}>
            O Cliente aceita as condições desta proposta, emitindo o seu &ldquo;de acordo&rdquo; para o fornecimento em tela. O aceite é documento suficiente para que as Partes se obriguem nos termos e condições aqui previstos.
          </Text>
          <View style={styles.infoBox}>
            <Text style={{ fontSize: 9, lineHeight: 1.9 }}>
              Pelo presente, a empresa ______________________________, situada na ______________________________, nº ________, CEP ____________, cidade ______________________, inscrita no CNPJ __________________ IE ______________, representada legalmente pelo Sr.(a) ______________________________, CPF __________________, telefone ______________, e-mail ______________________, aceita as condições desta proposta.
            </Text>
          </View>
          <View style={styles.signRow}>
            <View style={styles.signCol}>
              <View style={styles.signLine} />
              <Text style={{ fontFamily: 'Helvetica-Bold', color: C.ink, fontSize: 8, textTransform: 'uppercase' }}>{razao}</Text>
              <Text style={{ fontSize: 7.5, color: C.s500, textTransform: 'uppercase' }}>{assinante}</Text>
            </View>
            <View style={styles.signCol}>
              <View style={styles.signLine} />
              <Text style={{ fontFamily: 'Helvetica-Bold', color: C.ink, fontSize: 8, textTransform: 'uppercase' }}>{pedido.clienteNome}</Text>
              <Text style={{ fontSize: 7.5, color: C.s500, textTransform: 'uppercase' }}>De acordo &amp; Aceite da Proposta</Text>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  );
}
