import React from 'react';
import { Document, Page, View, Text, StyleSheet, Svg, Path, Line, Rect, Circle, Image, Font } from '@react-pdf/renderer';
import { Pedido, CompanyProfile, PedidoEquipmentItem } from '@/lib/types';
import { InclusoExcluso, ResumoExecutivoPage, SlaBloco } from '@/components/documentos/pdfKit';
import { gerarTituloProposta, faixaSiglas, tituloEscopo, conclusaoPorTipo, apresentacaoAreas } from '@/lib/propostaTitulo';
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
  /** Página institucional "Áreas de Atuação" (padrão: exibir). */
  showAreasAtuacao?: boolean;
  /** Página de fechamento com contatos/endereço (padrão: exibir). */
  showFechamento?: boolean;
  /** Imagem opcional da capa (URL ou data URI). Sem ela, usa o grafismo blueprint. */
  capaImagemUrl?: string;
}

// Tipografia de marca: corpo em Roboto, títulos em Poppins.
Font.register({
  family: 'Roboto',
  fonts: [
    { src: '/fonts/Roboto-Regular.ttf' },
    { src: '/fonts/Roboto-Bold.ttf', fontWeight: 700 },
    { src: '/fonts/Roboto-Italic.ttf', fontStyle: 'italic' },
  ],
});
Font.register({
  family: 'Poppins',
  fonts: [
    { src: '/fonts/Poppins-SemiBold.ttf', fontWeight: 600 },
    { src: '/fonts/Poppins-Bold.ttf', fontWeight: 700 },
  ],
});

Font.registerHyphenationCallback((word) => [word]);

// Paleta institucional Fireowl
const C = {
  navy: '#0B1E38',      // azul-marinho principal
  navy2: '#13315C',     // bloco/realce sobre o marinho
  navyLine: '#5B7DB1',  // linhas blueprint
  brand: '#1A1A72',     // escudo da logo
  logoRed: '#E63946',   // vermelho da logo
  red: '#C1272D',       // vermelho acentos/filetes
  gold: '#F2A900',      // âmbar/dourado de marca
  green: '#2E7D5B',     // verde de marca
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

const A4 = { w: 595.28, h: 841.89 };

const LOGO_PATHS = [
  { d: 'M49 147.168C49 116.147 74.1471 91 105.168 91L358.832 91C389.853 91 415 116.147 415 147.168L415 371.832C415 402.853 389.853 428 358.832 428L105.168 428C74.1471 428 49 402.853 49 371.832Z', fill: C.brand },
  { d: 'M107.082 128.023 380.116 128.023 380.358 128.42 380.116 129.808 381.082 130.601 378.427 135.954 375.288 142.299 371.667 149.635 367.804 157.368 363.701 165.498 360.321 172.239 357.665 177.593 354.044 184.73 351.147 190.282 348.009 196.627 347.526 197.024 176.125 197.024 173.228 194.644 171.297 193.256 167.917 190.481 165.986 189.093 164.055 187.506 162.123 186.118 157.778 182.549 155.847 181.161 152.467 178.386 150.536 176.998 147.639 174.817 143.535 171.644 141.121 169.662 139.189 168.273 136.292 165.894 134.361 164.506 131.464 162.127 129.533 160.739 126.395 158.161 124.463 156.773 121.566 154.394 119.635 153.006 117.704 151.42 115.773 150.032 111.91 147.058 107.565 143.489 107.082 142.498Z', fill: C.logoRed },
  { d: 'M105.448 156.05 106.416 156.249 111.252 160.225 113.187 161.616 118.023 165.592 119.958 166.983 126.004 171.953 127.938 173.344 130.84 175.73 132.775 177.121 139.546 182.687 141.481 184.078 145.592 187.259 148.494 189.445 150.428 191.036 152.363 192.427 155.265 194.812 157.2 196.204 161.311 199.385 163.729 201.173 165.664 202.565 166.148 203.161 166.389 231.388 166.389 285.059 166.148 285.655 165.664 285.854 159.618 285.854 153.814 284.86 136.644 281.481 124.795 279.294 111.252 276.71 107.141 275.915 106.174 275.319 105.69 273.728 105.448 270.349 105.206 231.786 104.964 230.593 103.03 231.984 100.853 233.773 98.9189 235.761 96.2586 238.743 93.115 242.719 89.0038 248.284 87.3108 251.266 85.86 254.844 84.8927 259.019 84.8927 262.199 85.6181 265.976 86.8273 269.157 88.7619 272.337 91.1801 275.12 93.3566 277.108 95.0496 278.698 97.7097 280.686 100.612 282.475 104.481 284.463 110.043 286.848 115.847 288.836 121.651 290.426 128.906 292.016 138.095 293.606 146.318 294.6 155.991 295.395 165.664 295.793 179.448 295.793 190.331 295.395 206.049 294.203 218.625 292.811 230.233 291.221 243.05 289.034 256.108 286.45 266.507 284.065 273.762 282.276 282.952 279.692 294.318 276.313 301.089 274.126 307.618 271.741 314.389 269.355 322.37 266.374 329.141 263.789 341.233 258.82 344.618 257.23 348.488 255.639 354.533 252.857 367.35 246.694 371.945 244.309 381.377 239.141 385.246 236.954 388.873 234.966 389.84 234.966 390.082 235.96 388.389 237.749 385.487 240.134 383.553 241.526 380.893 243.514 377.507 245.7 373.638 248.284 370.252 250.471 365.899 253.254 361.788 255.838 357.435 258.422 353.566 260.609 348.971 263.193 343.651 266.175 335.671 270.548 329.867 273.53 322.854 276.909 317.775 279.294 310.037 282.674 305.442 284.661 298.912 287.444 293.108 289.631 289.481 291.022 284.403 293.01 275.938 295.992 266.749 298.974 259.01 301.359 244.501 305.335 238.455 306.925 226.605 309.708 213.305 312.491 206.049 313.882 194.925 315.472 187.671 316.466 177.514 317.46 163.487 318.653 155.991 319.05 142.932 319.05 132.291 318.653 122.86 317.858 113.429 316.864 105.448 315.671 101.821 314.677 97.4678 313.286 93.5985 312.491 85.3762 309.708 79.3304 307.322 75.4612 305.335 72.5592 303.545 69.4156 301.359 65.788 298.377 62.8861 294.998 60.226 290.824 58.5332 287.047 57.324 282.276 57.0822 280.686 57.0822 276.71 58.2914 270.945 60.226 266.175 62.4025 262.199 65.5461 257.826 68.4481 254.447 71.5919 251.266 73.5265 249.278 75.9449 247.092 77.6377 245.502 83.6835 240.532 85.6181 239.141 88.52 236.954 91.6639 234.767 99.8862 229.599 103.514 227.413 105.206 226.419ZM104.723 227.81 104.481 228.605 104.964 228.605Z', fill: C.logoRed },
  { d: 'M176.153 206.099 207.881 206.099 287.08 206.298 339.152 206.298 338.91 208.089 339.152 209.482 338.91 211.87 330.433 225.801 325.589 234.955 322.199 241.323 319.292 247.094 315.417 254.656 311.058 263.014 308.151 268.786 307.424 269.383 297.494 269.781 277.876 270.378 258.742 271.174 240.578 271.771 220.959 272.567 218.295 272.567 218.295 282.517 218.053 284.507 217.811 284.706 197.95 285.502 179.059 286.099 176.637 286.099 176.395 285.104 176.153 281.124Z', fill: C.logoRed },
  { d: 'M216.992 319.209 218.186 319.409 216.276 322.202 214.844 323.798 208.876 328.786 206.967 330.182 204.341 332.177 201.715 333.973 198.851 335.968 194.793 338.562 190.496 341.355 186.438 344.148 183.335 346.343 179.992 348.937 178.083 350.333 175.457 352.328 173.547 353.725 170.205 356.119 164.954 359.71 161.851 361.905 159.225 363.701 157.554 366.494 152.064 369.088 149.676 370.883 147.767 372.28 144.425 374.674 142.038 376.47 140.128 377.866 137.741 379.662 135.115 381.457 132.967 383.253 131.057 384.65 127.954 387.044 122.702 390.635 118.883 393.229 116.257 395.024 112.915 397.418 109.335 400.012 107.664 401.209 107.425 401.209 107.186 395.623 107.186 388.64 107.664 349.934 107.902 334.971 108.141 328.187 108.857 327.988 121.031 328.586 136.547 328.586 146.096 328.187 157.315 327.589 173.309 326.192 186.676 324.596 195.986 323.199 208.399 321.005Z', fill: C.logoRed },
];

const styles = StyleSheet.create({
  // Página de conteúdo (fundo claro): paddingTop 54, paddingBottom 68 para dar respiro de 3cm antes do rodapé
  // IMPORTANTE: sem lineHeight aqui. lineHeight herdado (ou explícito) num
  // <Text fixed render> zera a pintura do rodapé no @react-pdf/renderer. O
  // espaçamento de linha é definido por estilo de texto (para, bulletText etc.).
  page: {
    paddingTop: 54,
    paddingBottom: 68,
    paddingHorizontal: 40,
    fontSize: 9,
    fontFamily: 'Roboto',
    color: C.s700,
  },
  // Página institucional (fundo marinho) — SEM PADDING no Page para que BlueprintBg e layout não estourem a altura A4
  darkPage: {
    padding: 0,
    fontSize: 9,
    fontFamily: 'Roboto',
    color: C.white,
    backgroundColor: C.navy,
  },

  // Cabeçalho fixo (páginas de conteúdo) — Fundo branco limpo, alinhamento vertical perfeito
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 44,
    backgroundColor: C.white,
    borderBottomWidth: 1.5,
    borderBottomColor: C.red,
    paddingHorizontal: 40,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerBrand: {
    fontSize: 8.5,
    fontFamily: 'Poppins',
    fontWeight: 600,
    color: C.navy,
    letterSpacing: 0.8,
    lineHeight: 1,
  },
  headerRight: {
    fontSize: 7,
    color: C.s500,
    fontFamily: 'Roboto',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    lineHeight: 1,
  },

  // Rodapé fixo: um único <Text fixed render> estilizado como barra marinho com
  // filete vermelho no topo. Padrão canônico do react-pdf para "Página X de Y"
  // (render + fixed no MESMO elemento Text). Texto centralizado.
  footerBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: C.navy,
    borderTopWidth: 2,
    borderTopColor: C.red,
    paddingVertical: 8,
    paddingHorizontal: 20,
    fontSize: 7.5,
    color: C.white,
    fontFamily: 'Roboto',
    textAlign: 'center',
    letterSpacing: 0.4,
  },

  // ===== Capa =====
  coverTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  coverLogoBox: {
    backgroundColor: C.white,
    borderRadius: 8,
    padding: 4,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverBrand: {
    color: C.white,
    fontFamily: 'Poppins',
    fontWeight: 700,
    fontSize: 16,
    letterSpacing: 1.2,
  },
  coverKicker: {
    color: C.gold,
    fontSize: 8,
    fontFamily: 'Roboto',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 1.3,
  },
  coverImage: {
    width: '100%',
    height: 200,
    borderRadius: 6,
    marginTop: 12,
    objectFit: 'cover',
  },
  coverTitle: {
    color: C.white,
    fontSize: 26,
    fontFamily: 'Poppins',
    fontWeight: 700,
    letterSpacing: 0.4,
    lineHeight: 1.1,
  },
  coverTitleBar: {
    width: 56,
    height: 4,
    backgroundColor: C.red,
    borderRadius: 2,
    marginTop: 6,
    marginBottom: 4,
  },
  coverBlockContainer: {
    backgroundColor: C.navy2,
    borderLeftWidth: 4,
    borderLeftColor: C.red,
    borderRadius: 6,
    padding: 10,
    marginTop: 12,
  },
  coverBlockItem: {
    marginBottom: 6,
  },
  coverBlockLabel: {
    color: C.gold,
    fontSize: 7.5,
    fontFamily: 'Roboto',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    marginBottom: 2,
  },
  coverBlockValue: {
    color: C.white,
    fontSize: 11.5,
    fontFamily: 'Roboto',
    fontWeight: 700,
    lineHeight: 1.2,
  },
  coverFooter: {
    borderTopWidth: 1,
    borderTopColor: C.navy2,
    paddingTop: 8,
    marginTop: 14,
  },
  coverFooterStrong: {
    color: C.white,
    fontSize: 8.5,
    fontFamily: 'Roboto',
    fontWeight: 700,
    letterSpacing: 0.4,
  },
  coverFooterText: {
    color: C.s400,
    fontSize: 7.5,
    marginTop: 2,
    letterSpacing: 0.3,
  },
  // Filete "letterhead": tick dourado + linha fina (capa)
  coverTopRule: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
  },
  coverTopRuleGold: {
    width: 40,
    height: 2,
    backgroundColor: C.gold,
    borderRadius: 1,
  },
  coverTopRuleLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#22406B',
    marginLeft: 8,
  },
  coverBlockDivider: {
    height: 1,
    backgroundColor: '#22406B',
    marginVertical: 8,
  },
  coverTagline: {
    color: C.s400,
    fontSize: 7,
    fontFamily: 'Roboto',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginTop: 3,
  },
  coverGoldDot: {
    width: 6,
    height: 6,
    backgroundColor: C.gold,
    borderRadius: 1,
    marginRight: 6,
  },

  // ===== Áreas de Atuação (Grade 2x3 limpa com ótimo espaçamento e UI) =====
  areasEyebrow: {
    color: C.gold,
    fontSize: 8,
    fontFamily: 'Roboto',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 1.6,
  },
  areasTitle: {
    color: C.white,
    fontSize: 24,
    fontFamily: 'Poppins',
    fontWeight: 700,
    letterSpacing: 0.3,
    marginTop: 5,
  },
  areasBar: {
    width: 52,
    height: 4,
    backgroundColor: C.red,
    borderRadius: 2,
    marginTop: 8,
    marginBottom: 10,
  },
  areasIntro: {
    color: C.s300,
    fontSize: 9,
    lineHeight: 1.5,
    marginBottom: 18,
    maxWidth: 470,
  },
  areasGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  areaCard: {
    width: '48%',
    backgroundColor: C.navy2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#22406B',
    padding: 14,
    marginBottom: 12,
    minHeight: 116,
  },
  areaCardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 9,
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0E2647',
    borderWidth: 1,
    borderColor: '#2A4A78',
    alignItems: 'center',
    justifyContent: 'center',
  },
  areaIndex: {
    fontSize: 18,
    fontFamily: 'Poppins',
    fontWeight: 700,
    color: '#31507F',
  },
  areaCardTitle: {
    color: C.white,
    fontSize: 10,
    fontFamily: 'Poppins',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  areaDivider: {
    width: 22,
    height: 2,
    backgroundColor: C.red,
    borderRadius: 1,
    marginTop: 5,
    marginBottom: 6,
  },
  areaCardDesc: {
    color: C.s300,
    fontSize: 7.8,
    lineHeight: 1.45,
  },
  chainStrip: {
    marginTop: 4,
    backgroundColor: '#0E2647',
    borderLeftWidth: 3,
    borderLeftColor: C.gold,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  chainLabel: {
    color: C.s400,
    fontSize: 7,
    fontFamily: 'Roboto',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 3,
  },
  chainText: {
    color: C.white,
    fontSize: 8.5,
    fontFamily: 'Poppins',
    fontWeight: 600,
    letterSpacing: 0.6,
  },

  // ===== Fechamento =====
  closeTitle: {
    color: C.white,
    fontSize: 22,
    fontFamily: 'Poppins',
    fontWeight: 700,
    lineHeight: 1.15,
    letterSpacing: 0.3,
    maxWidth: 420,
  },
  closeBar: {
    width: 48,
    height: 4,
    backgroundColor: C.red,
    borderRadius: 2,
    marginTop: 10,
    marginBottom: 14,
  },
  closeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 6,
  },
  closeItem: {
    width: '50%',
    marginBottom: 12,
    paddingRight: 12,
  },
  closeLabel: {
    color: C.gold,
    fontSize: 7.5,
    fontFamily: 'Roboto',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
    marginBottom: 2,
  },
  closeValue: {
    color: C.white,
    fontSize: 9.5,
    fontFamily: 'Roboto',
    fontWeight: 700,
    lineHeight: 1.3,
  },

  // ===== Seções =====
  section: {
    marginBottom: 14,
  },
  // Abertura de seção premium: barra vermelha lateral + chip do número +
  // título, e um "fio dourado" que se estende numa linha fina (letterhead).
  secHeadWrap: {
    marginTop: 4,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: C.red,
    paddingLeft: 8,
  },
  secHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 5,
  },
  secRule: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  secRuleGold: {
    width: 34,
    height: 2,
    backgroundColor: C.gold,
    borderRadius: 1,
  },
  secRuleLine: {
    flex: 1,
    height: 1,
    backgroundColor: C.s200,
    marginLeft: 6,
  },
  secNum: {
    backgroundColor: C.navy,
    color: C.white,
    fontSize: 8.5,
    fontFamily: 'Roboto',
    fontWeight: 700,
    paddingVertical: 1.5,
    paddingHorizontal: 5,
    borderRadius: 2,
    marginRight: 7,
  },
  secTitle: {
    color: C.navy,
    fontSize: 12,
    fontFamily: 'Poppins',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  subTitle: {
    color: C.navy,
    fontSize: 9.5,
    fontFamily: 'Roboto',
    fontWeight: 700,
    textTransform: 'uppercase',
    marginBottom: 4,
    marginTop: 6,
  },
  para: {
    fontSize: 9,
    color: C.s700,
    textAlign: 'justify',
    marginBottom: 6,
    lineHeight: 1.4,
  },
  bulletRow: {
    flexDirection: 'row',
    marginBottom: 3.5,
  },
  bulletDot: {
    color: C.red,
    fontFamily: 'Roboto',
    fontWeight: 700,
    marginRight: 6,
  },
  bulletText: {
    flex: 1,
    fontSize: 8.8,
    color: C.s700,
    textAlign: 'justify',
    lineHeight: 1.3,
  },

  // ===== Tabelas Zebradas Limpas =====
  th: {
    flexDirection: 'row',
    backgroundColor: C.navy,
  },
  thCell: {
    color: C.white,
    fontSize: 7.5,
    fontFamily: 'Roboto',
    fontWeight: 700,
    textTransform: 'uppercase',
    paddingVertical: 6,
    paddingHorizontal: 6,
  },
  tr: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: C.s200,
  },
  trAlt: {
    backgroundColor: C.s50,
  },
  td: {
    fontSize: 8,
    color: C.s700,
    paddingVertical: 5,
    paddingHorizontal: 6,
  },
  tfoot: {
    flexDirection: 'row',
    backgroundColor: C.s100,
    borderTopWidth: 1,
    borderTopColor: C.s300,
  },
  tfootCell: {
    fontSize: 8,
    fontFamily: 'Roboto',
    fontWeight: 700,
    color: C.ink,
    paddingVertical: 5,
    paddingHorizontal: 6,
  },

  // ===== Totais (Seção 05 / 09) =====
  totalWrap: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: C.s200,
    borderRadius: 5,
    overflow: 'hidden',
  },
  totalRowLight: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: C.s100,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  totalRowNavy: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: C.navy,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderTopWidth: 3,
    borderTopColor: C.red,
    width: '100%',
  },
  totalLabelGold: {
    color: C.gold,
    fontSize: 9,
    fontFamily: 'Poppins',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 1,
    lineHeight: 1,
  },
  totalValue: {
    color: C.white,
    fontSize: 16,
    fontFamily: 'Poppins',
    fontWeight: 700,
    lineHeight: 1,
  },

  // Card de Preço Destacado (Investimento Total em Bloco de 2 Linhas perfeitamente alinhadas)
  precoCardBlock: {
    backgroundColor: C.navy,
    borderRadius: 6,
    borderLeftWidth: 4,
    borderLeftColor: C.red,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 12,
    width: '100%',
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  precoCardLabel: {
    color: C.gold,
    fontSize: 8.5,
    fontFamily: 'Roboto',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 4,
    lineHeight: 1,
  },
  precoCardValue: {
    color: C.white,
    fontSize: 20,
    fontFamily: 'Poppins',
    fontWeight: 700,
    letterSpacing: 0.5,
    lineHeight: 1,
  },
  mensalCell: { width: '48.5%', marginBottom: 6, backgroundColor: C.s50, borderWidth: 1, borderColor: C.s200, borderRadius: 5, paddingVertical: 6, paddingHorizontal: 10 },
  mensalLabel: { fontSize: 7.5, color: C.s500, fontFamily: 'Roboto', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 },
  mensalValue: { fontSize: 12, color: C.navy, fontFamily: 'Poppins', fontWeight: 700, marginTop: 2 },

  // ===== Blocos =====
  infoBox: {
    backgroundColor: C.s50,
    borderWidth: 1,
    borderColor: C.s200,
    borderRadius: 5,
    padding: 10,
  },
  scenarioCard: {
    backgroundColor: C.s50,
    borderWidth: 1,
    borderColor: C.s200,
    borderLeftWidth: 4,
    borderLeftColor: C.red,
    borderRadius: 5,
    padding: 10,
    marginBottom: 8,
  },
  greenCard: {
    backgroundColor: '#f0f7f3',
    borderWidth: 1,
    borderColor: '#cfe6da',
    borderLeftWidth: 4,
    borderLeftColor: C.green,
    borderRadius: 5,
    padding: 10,
  },
  greenBadge: {
    alignSelf: 'flex-start',
    backgroundColor: C.green,
    color: C.white,
    fontSize: 7,
    fontFamily: 'Roboto',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: 3,
    marginBottom: 5,
  },

  // ===== Índice =====
  idxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: C.s100,
  },
  idxNum: {
    fontFamily: 'Roboto',
    fontWeight: 700,
    color: C.navy,
    width: 28,
    fontSize: 9,
  },

  // ===== Assinaturas =====
  signRow: {
    flexDirection: 'row',
    marginTop: 32,
    gap: 28,
  },
  signCol: {
    flex: 1,
    alignItems: 'center',
  },
  signLine: {
    borderBottomWidth: 1,
    borderBottomColor: C.s400,
    width: '100%',
    height: 26,
    marginBottom: 5,
  },
});

const brl = (n: number) => `R$ ${(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
const nv = (s?: string) => !!s && s.trim().length > 0;
const lnv = (a?: string[]) => Array.isArray(a) && a.filter((x) => nv(x)).length > 0;

const Logo = ({ size = 36 }: { size?: number }) => (
  <Svg viewBox="0 0 503 503" style={{ width: size, height: size }}>
    {LOGO_PATHS.map((p, i) => (
      <Path key={i} d={p.d} fill={p.fill} stroke="#0C0C0C" strokeWidth={4} fillRule="evenodd" />
    ))}
  </Svg>
);

// BlueprintBg: fundo ancorado à página (fixed) — fora do fluxo, para não ser
// medido como conteúdo e gerar páginas em branco antes das páginas marinhas.
const BlueprintBg = () => (
  <Svg fixed style={{ position: 'absolute', top: 0, left: 0 }} width={A4.w} height={A4.h}>
    {Array.from({ length: Math.ceil(A4.w / 28) }).map((_, i) => (
      <Line key={`v${i}`} x1={i * 28} y1={0} x2={i * 28} y2={A4.h} stroke={C.navyLine} strokeOpacity={0.14} strokeWidth={0.5} />
    ))}
    {Array.from({ length: Math.ceil(A4.h / 28) }).map((_, i) => (
      <Line key={`h${i}`} x1={0} y1={i * 28} x2={A4.w} y2={i * 28} stroke={C.navyLine} strokeOpacity={0.14} strokeWidth={0.5} />
    ))}
    <Line x1={0} y1={A4.h * 0.18} x2={A4.w * 0.28} y2={0} stroke={C.red} strokeOpacity={0.22} strokeWidth={1.2} />
    <Line x1={A4.w} y1={A4.h * 0.82} x2={A4.w * 0.72} y2={A4.h} stroke={C.red} strokeOpacity={0.22} strokeWidth={1.2} />
  </Svg>
);

const AreaIcon = ({ kind }: { kind: string }) => {
  const S = 22;
  const sw = 1.6;
  const p = (d: string, extra?: object) => <Path d={d} stroke={C.red} strokeWidth={sw} fill="none" {...extra} />;
  return (
    <Svg viewBox="0 0 24 24" style={{ width: S, height: S }}>
      {kind === 'sdai' && (
        p('M12 2 C12 7 16 8 14 13 C13 16 10 16 9 13 C8 15 9 16.5 9 18 C6 16 6.5 10.5 10 8 C10 10.5 12 10.5 12 8 C12 5.5 12 3.5 12 2 Z')
      )}
      {kind === 'cftv' && (
        <>
          <Rect x={3} y={7} width={13} height={10} rx={1.5} stroke={C.red} strokeWidth={sw} fill="none" />
          <Circle cx={9.5} cy={12} r={3} stroke={C.red} strokeWidth={sw} fill="none" />
          {p('M16 10 L21 7 L21 17 L16 14 Z')}
        </>
      )}
      {kind === 'acesso' && (
        <>
          <Rect x={4} y={4} width={16} height={11} rx={1.5} stroke={C.red} strokeWidth={sw} fill="none" />
          <Circle cx={12} cy={9} r={2.2} stroke={C.red} strokeWidth={sw} fill="none" />
          {p('M8.5 15 C8.5 12.5 15.5 12.5 15.5 15')}
          {p('M9 19 L15 19')}
        </>
      )}
      {kind === 'alarme' && (
        <>
          {p('M12 3 C8.5 3 7 6 7 10 L6 15 L18 15 L17 10 C17 6 15.5 3 12 3 Z')}
          {p('M10 18 C10 20 14 20 14 18')}
          <Circle cx={12} cy={3} r={0.8} stroke={C.red} strokeWidth={sw} fill="none" />
        </>
      )}
      {kind === 'bms' && (
        <>
          <Rect x={3} y={4} width={18} height={12} rx={1.5} stroke={C.red} strokeWidth={sw} fill="none" />
          <Circle cx={12} cy={10} r={3} stroke={C.red} strokeWidth={sw} fill="none" />
          {p('M12 6 L12 4.5')}
          {p('M12 14 L12 15.5')}
          {p('M8 10 L6.5 10')}
          {p('M16 10 L17.5 10')}
          {p('M9 20 L15 20')}
        </>
      )}
      {kind === 'integracao' && (
        <>
          <Circle cx={5} cy={6} r={2} stroke={C.red} strokeWidth={sw} fill="none" />
          <Circle cx={19} cy={6} r={2} stroke={C.red} strokeWidth={sw} fill="none" />
          <Circle cx={12} cy={19} r={2} stroke={C.red} strokeWidth={sw} fill="none" />
          {p('M6.5 7.5 L11 17.5')}
          {p('M17.5 7.5 L13 17.5')}
          {p('M7 6 L17 6')}
        </>
      )}
    </Svg>
  );
};

const AREAS = [
  { kind: 'sdai', titulo: 'Detecção e Alarme (SDAI)', desc: 'Projeto, instalação e manutenção de sistemas de detecção e alarme de incêndio conforme NBR 17240 e NPT 019.' },
  { kind: 'cftv', titulo: 'CFTV / Videomonitoramento', desc: 'Câmeras IP e analíticos de vídeo para monitoramento, gravação e supervisão remota de perímetros e ambientes.' },
  { kind: 'acesso', titulo: 'Controle de Acesso', desc: 'Controle de portas, catracas e biometria com gestão de credenciais, níveis de acesso e trilha de auditoria.' },
  { kind: 'alarme', titulo: 'Alarme de Intrusão', desc: 'Sensores, centrais e comunicação para proteção perimetral e detecção de intrusão com notificação em tempo real.' },
  { kind: 'bms', titulo: 'Automação Predial (BMS)', desc: 'Supervisão e automação de utilidades prediais, integrando climatização, energia e iluminação em uma central.' },
  { kind: 'integracao', titulo: 'Integração de Sistemas', desc: 'Convergência de SDAI, CFTV, acesso e alarme em plataforma unificada, com dashboards e resposta coordenada.' },
];

const Header = ({ razao }: { razao: string }) => (
  <View fixed style={styles.header}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Logo size={18} />
      <Text style={styles.headerBrand}>{(razao || 'FIREOWL CONTROLS').toUpperCase()}</Text>
    </View>
    <View style={{ flex: 1 }} />
    <View style={{ justifyContent: 'center', alignItems: 'center' }}>
      <Text style={styles.headerRight}>DOCUMENTO TÉCNICO-COMERCIAL</Text>
    </View>
  </View>
);

const Footer = ({ cliente, numero, data }: { cliente: string; numero: string; data: string }) => (
  <Text
    fixed
    style={styles.footerBar}
    render={({ pageNumber, totalPages }) =>
      `${numero}   •   ${data}   •   ${cliente}   •   Página ${pageNumber} de ${totalPages}`
    }
  />
);

const SecHead = ({ n, titulo }: { n: string; titulo: string }) => (
  <View style={styles.secHeadWrap} minPresenceAhead={48}>
    <View style={styles.secHeadRow}>
      {n ? <Text style={styles.secNum}>{n}</Text> : null}
      <Text style={styles.secTitle}>{titulo}</Text>
    </View>
    <View style={styles.secRule}>
      <View style={styles.secRuleGold} />
      <View style={styles.secRuleLine} />
    </View>
  </View>
);

const MensalCell = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.mensalCell}>
    <Text style={styles.mensalLabel}>{label}</Text>
    <Text style={styles.mensalValue}>{value}</Text>
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

const CheckIcon = () => (
  <Svg viewBox="0 0 12 12" style={{ width: 9, height: 9 }}>
    <Path d="M2 6.4 L4.7 9 L10 2.6" stroke={C.green} strokeWidth={1.8} fill="none" />
  </Svg>
);

const Checks = ({ itens }: { itens: string[] }) => (
  <>
    {itens.filter(nv).map((it, i) => (
      <View key={i} style={[styles.bulletRow, { alignItems: 'flex-start' }]}>
        <View style={{ marginRight: 5, marginTop: 1.5 }}><CheckIcon /></View>
        <Text style={styles.bulletText}>{it}</Text>
      </View>
    ))}
  </>
);

// Tabela de itens zebrada
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
  const subtotal = itens.reduce((a, e) => a + Math.max(0, (e.precoUnitario || 0) * e.quantidade - (e.desconto || 0)), 0);
  return (
    <View style={{ marginBottom: 10 }} minPresenceAhead={56}>
      <Text style={styles.subTitle}>{titulo}</Text>
      <View style={{ borderWidth: 1, borderColor: C.s200, borderRadius: 4, overflow: 'hidden' }}>
        <View style={[styles.th, { backgroundColor: accent }]} fixed>
          <Text style={[styles.thCell, { width: 26, textAlign: 'center' }]}>#</Text>
          <Text style={[styles.thCell, { flex: 1 }]}>Descrição</Text>
          {showMarca && <Text style={[styles.thCell, { width: 90 }]}>Marca / Modelo</Text>}
          <Text style={[styles.thCell, { width: 34, textAlign: 'center' }]}>Un.</Text>
          <Text style={[styles.thCell, { width: 34, textAlign: 'center' }]}>Qtd</Text>
          {detailed && <Text style={[styles.thCell, { width: 64, textAlign: 'right' }]}>Unit.</Text>}
          {detailed && <Text style={[styles.thCell, { width: 70, textAlign: 'right' }]}>Total</Text>}
        </View>
        {itens.map((eq, i) => {
          const unit = eq.precoUnitario || 0;
          const tot = Math.max(0, unit * eq.quantidade - (eq.desconto || 0));
          return (
            <View key={i} style={[styles.tr, i % 2 === 1 ? styles.trAlt : {}]} wrap={false}>
              <Text style={[styles.td, { width: 26, textAlign: 'center', color: C.red, fontFamily: 'Roboto', fontWeight: 700 }]}>{i + 1}</Text>
              <View style={[styles.td, { flex: 1 }]}><Text style={{ color: C.ink, fontFamily: 'Roboto', fontWeight: 700, fontSize: 8 }}>{eq.descricao}</Text>{eq.descricaoDetalhada ? <Text style={{ color: C.s500, fontSize: 7, marginTop: 1, lineHeight: 1.3 }}>{eq.descricaoDetalhada}</Text> : null}</View>
              {showMarca && <Text style={[styles.td, { width: 90 }]}>{eq.marcaModelo}</Text>}
              <Text style={[styles.td, { width: 34, textAlign: 'center', textTransform: 'uppercase' }]}>{eq.unidade}</Text>
              <Text style={[styles.td, { width: 34, textAlign: 'center', fontFamily: 'Roboto', fontWeight: 700 }]}>{eq.quantidade}</Text>
              {detailed && <Text style={[styles.td, { width: 64, textAlign: 'right' }]}>{unit > 0 ? unit.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—'}</Text>}
              {detailed && <Text style={[styles.td, { width: 70, textAlign: 'right', fontFamily: 'Roboto', fontWeight: 700, color: C.ink }]}>{tot > 0 ? tot.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '—'}</Text>}
            </View>
          );
        })}
        {detailed && (
          <View style={styles.tfoot} wrap={false}>
            <Text style={[styles.tfootCell, { flex: 1, textAlign: 'right', textTransform: 'uppercase' }]}>{`Subtotal ${titulo}`}</Text>
            <Text style={[styles.tfootCell, { width: 70, textAlign: 'right' }]}>{brl(subtotal)}</Text>
          </View>
        )}
      </View>
    </View>
  );
};

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
  const fantasia = companyProfile.nomeFantasia || razao;
  // §15 — contrato recorrente (valor mensal / anual / vigência).
  const recorrente = !!p.recorrente && (p.valorMensal || 0) > 0;
  const vMensal = p.valorMensal || 0;
  const vMeses = p.vigenciaMeses || 0;

  // §18/§28 — indicadores do resumo executivo (só os preenchidos).
  const indicadores: { valor: string; label: string }[] = [];
  if (recorrente) indicadores.push({ valor: brl(vMensal), label: 'Valor mensal' });
  if ((p.unidadesAtendidas || 0) > 0) indicadores.push({ valor: String(p.unidadesAtendidas), label: 'Unidades atendidas' });
  if (nv(p.frequenciaManutencao)) indicadores.push({ valor: p.frequenciaManutencao!, label: 'Frequência' });
  if (nv(p.slaCritico)) indicadores.push({ valor: p.slaCritico!, label: 'SLA falhas críticas' });
  if (recorrente && vMeses > 0) indicadores.push({ valor: `${vMeses} meses`, label: 'Vigência' });
  const objetoBase = nv(p.objetivo) ? p.objetivo : nv(p.escopoServico) ? p.escopoServico : (pedido.referencia || '');
  const objetoResumo = objetoBase.length > 320 ? `${objetoBase.slice(0, 317)}…` : objetoBase;
  const numero = pedido.numeroPedido;
  const dataEmissao = pedido.dataEmissao || '';
  const clienteNome = pedido.clienteNome || '';
  const assinante = pedido.responsavelComercialNome || 'Responsável Comercial';
  const escopoTitulo = pedido.referencia || 'Fornecimento e Serviços de Engenharia';
  // P1 — título dinâmico (área × tipo) e faixa de siglas (§3/§7).
  const tituloDin = gerarTituloProposta(p.areaPrincipal || [], p.tipoServico);
  const siglas = faixaSiglas(p.areaPrincipal || []);
  // §22/§23 — Áreas de atuação contextuais (destaca as selecionadas).
  const areaSel = new Set(p.areaPrincipal || []);
  const temAreaSel = AREAS.some((a) => areaSel.has(a.kind));
  const areasOrd = temAreaSel ? [...AREAS].sort((a, b) => (areaSel.has(b.kind) ? 1 : 0) - (areaSel.has(a.kind) ? 1 : 0)) : AREAS;

  const showLogo = options?.showLogo !== false;
  const detailed = options?.detailedSubtotal !== false;
  const showIndice = options?.showIndice !== false;
  const showHistorico = options?.showHistorico !== false;
  // §37/§38 — nível da proposta dimensiona o documento.
  const nivel = p.nivelProposta || 'tecnica';
  const showCarta = options?.showCarta !== false && nivel !== 'simples';
  const showAreas = options?.showAreasAtuacao !== false && nivel !== 'simples';
  const showFechamento = options?.showFechamento !== false;
  const capaImagemUrl = options?.capaImagemUrl;

  const itens = p.equipmentItems || [];
  const materiais = itens.filter((e) => e.tipo !== 'servico');
  const servicos = itens.filter((e) => e.tipo === 'servico');

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
    { key: 'escopo', titulo: tituloEscopo(p.tipoServico), visible: true },
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
      {/* ===================== 01. CAPA (marinho, sem padding no Page para 0 overflow) ===================== */}
      <Page size="A4" style={styles.darkPage}>
        <BlueprintBg />
        <View style={{ flex: 1, padding: 40, justifyContent: 'space-between' }}>
          <View>
            <View style={styles.coverTopRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                {showLogo && (
                  <View style={styles.coverLogoBox}>
                    <Logo size={36} />
                  </View>
                )}
                <View>
                  <Text style={styles.coverBrand}>FIREOWL CONTROLS</Text>
                  <Text style={styles.coverTagline}>Sistemas Integrados de Proteção</Text>
                </View>
              </View>
              <Text style={styles.coverKicker}>Engenharia de Segurança{'\n'}& Detecção de Incêndio</Text>
            </View>
            <View style={styles.coverTopRule}>
              <View style={styles.coverTopRuleGold} />
              <View style={styles.coverTopRuleLine} />
            </View>
          </View>

          {nv(capaImagemUrl) && <Image src={capaImagemUrl!} style={styles.coverImage} />}

          <View style={{ marginTop: nv(capaImagemUrl) ? 10 : 28 }}>
            <Text style={styles.coverKicker}>Documento Técnico-Comercial</Text>
            <View style={styles.coverTitleBar} />
            <Text style={styles.coverTitle}>Proposta{'\n'}Técnico-Comercial</Text>
            {tituloDin ? <Text style={{ color: '#F2A900', fontSize: 11, fontFamily: 'Poppins', fontWeight: 600, marginTop: 8, letterSpacing: 0.2 }}>{tituloDin}</Text> : null}
            {nv(siglas) ? <Text style={{ color: C.s300, fontSize: 8.5, fontFamily: 'Roboto', fontWeight: 700, letterSpacing: 1.5, marginTop: 4 }}>{siglas}</Text> : null}
          </View>

          <View style={styles.coverBlockContainer}>
            <View>
              <Text style={styles.coverBlockLabel}>CLIENTE</Text>
              <Text style={styles.coverBlockValue}>{clienteNome || '—'}</Text>
            </View>

            <View style={styles.coverBlockDivider} />

            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text style={styles.coverBlockLabel}>NÚMERO DA PROPOSTA</Text>
                <Text style={styles.coverBlockValue}>{numero || '—'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.coverBlockLabel}>DATA DE EMISSÃO</Text>
                <Text style={styles.coverBlockValue}>{dataEmissao || '—'}</Text>
              </View>
            </View>

            <View style={styles.coverBlockDivider} />

            <View>
              <Text style={styles.coverBlockLabel}>ESCOPO DE FORNECIMENTO</Text>
              <Text style={styles.coverBlockValue}>{escopoTitulo || '—'}</Text>
            </View>
          </View>

          <View style={styles.coverFooter}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={styles.coverGoldDot} />
              <Text style={styles.coverFooterStrong}>{`${razao} — CNPJ ${companyProfile.cnpj}`}</Text>
            </View>
            <Text style={styles.coverFooterText}>{companyProfile.endereco}</Text>
            {(nv(companyProfile.telefone) || nv(companyProfile.email)) && (
              <Text style={styles.coverFooterText}>{[companyProfile.telefone, companyProfile.email].filter(nv).join('  •  ')}</Text>
            )}
          </View>
        </View>
      </Page>

      {/* ===================== RESUMO EXECUTIVO (§18/§28) — indicadores + nível ≠ simples ===================== */}
      {indicadores.length > 0 && nivel !== 'simples' && (
        <ResumoExecutivoPage fantasia={fantasia} numero={numero} data={dataEmissao} cliente={clienteNome} indicadores={indicadores} objeto={objetoResumo} />
      )}

      {/* ===================== 02. ÁREAS DE ATUAÇÃO (Grade 2x3 sem estouro de altura) ===================== */}
      {showAreas && (
        <Page size="A4" style={styles.darkPage}>
          <BlueprintBg />
          <Footer cliente={clienteNome} numero={numero} data={dataEmissao} />
          <View style={{ flex: 1, paddingTop: 40, paddingHorizontal: 40, paddingBottom: 40 }}>
            <Text style={styles.areasEyebrow}>QUEM É A FIREOWL CONTROLS</Text>
            <Text style={styles.areasTitle}>Áreas de Atuação</Text>
            <View style={styles.areasBar} />
            {temAreaSel && nv(siglas) ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#0E2647', borderLeftWidth: 3, borderLeftColor: '#F2A900', borderRadius: 6, paddingVertical: 7, paddingHorizontal: 12, marginBottom: 12 }}>
                <Text style={{ color: '#F2A900', fontSize: 10, fontFamily: 'Poppins', fontWeight: 700, letterSpacing: 1.5 }}>{siglas}</Text>
              </View>
            ) : null}
            <Text style={styles.areasIntro}>{apresentacaoAreas(p.areaPrincipal || [])}</Text>
            <View style={styles.areasGrid}>
              {areasOrd.map((a, i) => {
                const on = areaSel.has(a.kind);
                const destaque = temAreaSel && on;
                return (
                  <View key={a.kind} style={[styles.areaCard, destaque ? { borderColor: '#F2A900', borderWidth: 1.5 } : {}, temAreaSel && !on ? { opacity: 0.72 } : {}]} wrap={false}>
                    <View style={styles.areaCardHead}>
                      <View style={[styles.iconBadge, destaque ? { borderColor: '#F2A900' } : {}]}>
                        <AreaIcon kind={a.kind} />
                      </View>
                      <Text style={[styles.areaIndex, destaque ? { color: '#F2A900' } : {}]}>{String(i + 1).padStart(2, '0')}</Text>
                    </View>
                    <Text style={styles.areaCardTitle}>{a.titulo}</Text>
                    <View style={styles.areaDivider} />
                    <Text style={styles.areaCardDesc}>{a.desc}</Text>
                  </View>
                );
              })}
            </View>
            <View style={styles.chainStrip}>
              <Text style={styles.chainLabel}>Ciclo completo de engenharia</Text>
              <Text style={styles.chainText}>Projeto   ·   Instalação   ·   Comissionamento   ·   Manutenção   ·   Suporte</Text>
              <Text style={{ color: '#F2A900', fontSize: 7.5, fontFamily: 'Roboto', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginTop: 5 }}>Engenharia   ·   Responsabilidade Técnica   ·   Rastreabilidade   ·   Comissionamento</Text>
            </View>
          </View>
        </Page>
      )}

      {/* ===================== 03. CARTA DE APRESENTAÇÃO (Página Exclusiva) ===================== */}
      {on('carta') && (
        <Page size="A4" style={styles.page}>
          <Header razao={fantasia} />
          <Footer cliente={clienteNome} numero={numero} data={dataEmissao} />

          <Sec k="carta">
            <Paras paras={nv(p.cartaApresentacao) ? p.cartaApresentacao!.split('\n').map((x) => x.trim()).filter(Boolean) : CARTA_APRESENTACAO} />
            <View style={{ marginTop: 18 }} wrap={false}>
              <Text style={{ marginBottom: 14, fontSize: 9 }}>Atenciosamente,</Text>
              <Text style={{ fontFamily: 'Roboto', fontWeight: 700, color: C.ink, fontSize: 9.5 }}>{assinante}</Text>
              <Text style={{ color: C.s600, fontSize: 9 }}>{`Responsável Comercial — ${razao}`}</Text>
              {nv(companyProfile.telefone) && <Text style={{ color: C.s500, fontSize: 8.5, marginTop: 2 }}>{companyProfile.telefone}</Text>}
              {nv(companyProfile.email) && <Text style={{ color: C.s500, fontSize: 8.5 }}>{companyProfile.email}</Text>}
            </View>
          </Sec>
        </Page>
      )}

      {/* ===================== 04. ÍNDICE (Página Exclusiva) ===================== */}
      {showIndice && (
        <Page size="A4" style={styles.page}>
          <Header razao={fantasia} />
          <Footer cliente={clienteNome} numero={numero} data={dataEmissao} />

          <View style={styles.section}>
            <SecHead n="" titulo="ÍNDICE" />
            <View style={{ marginTop: 8 }}>
              {vis.map((s, i) => (
                <View key={s.key} style={styles.idxRow}>
                  <Text style={styles.idxNum}>{String(i + 1).padStart(2, '0')}</Text>
                  <Text style={{ fontSize: 9, color: C.s700, fontFamily: 'Roboto', fontWeight: 700 }}>{s.titulo}</Text>
                </View>
              ))}
            </View>
          </View>
        </Page>
      )}

      {/* ===================== 05. CORPO DA PROPOSTA ===================== */}
      <Page size="A4" style={styles.page}>
        <Header razao={fantasia} />
        <Footer cliente={clienteNome} numero={numero} data={dataEmissao} />

        {on('historico') && (
          <Sec k="historico">
            <View style={{ borderWidth: 1, borderColor: C.s200, borderRadius: 4, overflow: 'hidden' }}>
              <View style={styles.th}>
                <Text style={[styles.thCell, { width: 100 }]}>Revisão / Número</Text>
                <Text style={[styles.thCell, { width: 64 }]}>Data</Text>
                <Text style={[styles.thCell, { width: 108 }]}>Elaborador</Text>
                <Text style={[styles.thCell, { flex: 1 }]}>Motivo da Revisão</Text>
              </View>
              {(p.revisoes || []).map((rev, i) => (
                <View key={i} style={[styles.tr, i % 2 === 1 ? styles.trAlt : {}]} wrap={false}>
                  <Text style={[styles.td, { width: 100, fontFamily: 'Roboto', fontWeight: 700, color: C.ink }]}>{rev.numero}</Text>
                  <Text style={[styles.td, { width: 64 }]}>{rev.data}</Text>
                  <Text style={[styles.td, { width: 108 }]}>{rev.elaborador}</Text>
                  <Text style={[styles.td, { flex: 1 }]}>{nv(rev.motivo) ? rev.motivo : '—'}</Text>
                </View>
              ))}
              <View style={[styles.tr, { backgroundColor: '#fffbeb' }]} wrap={false}>
                <Text style={[styles.td, { width: 100, fontFamily: 'Roboto', fontWeight: 700, color: C.ink }]}>{numero}</Text>
                <Text style={[styles.td, { width: 64 }]}>{pedido.dataEmissao}</Text>
                <Text style={[styles.td, { width: 108 }]}>{assinante}</Text>
                <Text style={[styles.td, { flex: 1, color: C.ink, fontFamily: 'Roboto', fontWeight: 700 }]}>{(p.revisoes && p.revisoes.length > 0) ? 'Versão vigente' : 'Emissão inicial'}</Text>
              </View>
            </View>
          </Sec>
        )}

        <Sec k="visao">
          <Text style={styles.subTitle}>{`${num('visao')}.1. Introdução`}</Text>
          <Text style={styles.para}>{nv(p.objetivo) ? p.objetivo : `Apresentamos nossa proposta para o fornecimento e execução dos serviços referentes a ${escopoTitulo}, para ${clienteNome}.`}</Text>
          {lnv(p.diretrizesNormativas) && (
            <>
              <Text style={styles.subTitle}>Diretrizes normativas de referência</Text>
              <Bullets itens={p.diretrizesNormativas} />
            </>
          )}
        </Sec>

        <Sec k="escopo">
          <Text style={styles.subTitle}>{`${num('escopo')}.1. Descrição do escopo proposto`}</Text>
          <View style={styles.scenarioCard}>
            <Text style={{ fontSize: 9, color: C.s700, textAlign: 'justify', lineHeight: 1.4 }}>{nv(p.escopoServico) ? p.escopoServico : 'Escopo conforme especificação técnica acordada com o cliente.'}</Text>
          </View>
          {/* §17 — SLA em destaque (quando cadastrado) */}
          <SlaBloco tabela={p.slaTabela} slaCritico={p.slaCritico} />
        </Sec>

        {/* Item 05 - Materiais e Serviços Ofertados. O orfão do título é evitado
            pelo minPresenceAhead do próprio SecHead (48pt) + o da 1ª tabela (56pt);
            valores altos aqui criavam um vão grande antes da seção. */}
        <View style={styles.section}>
          <SecHead n={num('itens')} titulo={secoes.find((s) => s.key === 'itens')!.titulo} />
          <View>
            {materiais.length > 0 && <ItensTable titulo="Materiais" itens={materiais} detailed={detailed} showMarca />}
            {servicos.length > 0 && <ItensTable titulo="Serviços" itens={servicos} detailed={detailed} showMarca={false} accent={C.green} />}
            {materiais.length === 0 && servicos.length === 0 && (
              <Text style={{ fontSize: 9, color: C.s400, fontStyle: 'italic' }}>Itens conforme especificação técnica acordada.</Text>
            )}
            {detailed && (
              <View style={styles.totalWrap} wrap={false}>
                {(p.maoDeObra || 0) > 0 && (
                  <View style={styles.totalRowLight}>
                    <Text style={{ fontSize: 8, fontFamily: 'Roboto', fontWeight: 700, color: C.ink, textTransform: 'uppercase', lineHeight: 1 }}>Mão de obra / Serviços adicionais</Text>
                    <Text style={{ fontSize: 8, fontFamily: 'Roboto', fontWeight: 700, color: C.ink, lineHeight: 1 }}>{brl(p.maoDeObra || 0)}</Text>
                  </View>
                )}
                <View style={styles.totalRowNavy}>
                  <Text style={styles.totalLabelGold}>VALOR TOTAL</Text>
                  <Text style={styles.totalValue}>{brl(p.valorTotal)}</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        <Sec k="premissas">
          {lnv(p.premissas) ? <Bullets itens={p.premissas} /> : <Text style={{ fontSize: 9, color: C.s500, fontStyle: 'italic' }}>Premissas conforme rotinas padrão de execução.</Text>}
          <InclusoExcluso incluso={p.incluso} naoIncluso={p.naoIncluso} />
        </Sec>

        <Sec k="servicos">
          {SERVICOS_OFERTADOS.map((s, i) => (
            <View key={i} minPresenceAhead={50}>
              <Text style={styles.subTitle}>{`${num('servicos')}.${i + 1}. ${s.titulo}`}</Text>
              <Bullets itens={s.itens} />
            </View>
          ))}
          {lnv(p.entregaveis) && (
            <View minPresenceAhead={50}>
              <Text style={styles.subTitle}>Entregáveis do projeto</Text>
              <Checks itens={p.entregaveis} />
            </View>
          )}
          {lnv(p.responsabilidadesContratada) && (
            <View minPresenceAhead={50}>
              <Text style={styles.subTitle}>Responsabilidades da Contratada</Text>
              <Bullets itens={p.responsabilidadesContratada} />
            </View>
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

        {/* Item 09 - Preços em 2 Linhas limpas (Rótulo no topo, valor em baixo) */}
        <Sec k="precos">
          <View style={styles.precoCardBlock} wrap={false}>
            <Text style={styles.precoCardLabel}>{recorrente ? 'INVESTIMENTO MENSAL' : 'INVESTIMENTO TOTAL'}</Text>
            <Text style={styles.precoCardValue}>{recorrente ? `${brl(vMensal)} / mês` : brl(p.valorTotal)}</Text>
          </View>
          {recorrente && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 8 }} wrap={false}>
              <MensalCell label="Valor mensal" value={brl(vMensal)} />
              <MensalCell label="Valor anual" value={brl(vMensal * 12)} />
              {vMeses > 0 && <MensalCell label="Vigência" value={`${vMeses} meses`} />}
              {vMeses > 0 && <MensalCell label="Valor estimado do contrato" value={brl(vMensal * vMeses)} />}
            </View>
          )}
          <Paras paras={PRECOS_OBS} />
        </Sec>

        <Sec k="infoCompra">
          <View style={styles.infoBox}>
            <Text style={{ fontSize: 9, marginBottom: 3 }}><Text style={{ fontFamily: 'Roboto', fontWeight: 700, color: C.ink }}>Razão Social: </Text>{razao}</Text>
            <Text style={{ fontSize: 9, marginBottom: 3 }}><Text style={{ fontFamily: 'Roboto', fontWeight: 700, color: C.ink }}>CNPJ: </Text>{companyProfile.cnpj}</Text>
            <Text style={{ fontSize: 9, marginBottom: 3 }}><Text style={{ fontFamily: 'Roboto', fontWeight: 700, color: C.ink }}>Endereço: </Text>{companyProfile.endereco}</Text>
            {nv(companyProfile.telefone) && <Text style={{ fontSize: 9, marginBottom: 3 }}><Text style={{ fontFamily: 'Roboto', fontWeight: 700, color: C.ink }}>Telefone: </Text>{companyProfile.telefone}</Text>}
            {nv(companyProfile.email) && <Text style={{ fontSize: 9 }}><Text style={{ fontFamily: 'Roboto', fontWeight: 700, color: C.ink }}>E-mail: </Text>{companyProfile.email}</Text>}
          </View>
        </Sec>

        <Sec k="impostos">
          <Paras paras={nv(p.impostos) ? [`Regime/observação: ${p.impostos}`, ...IMPOSTOS_OBS] : IMPOSTOS_OBS} />
        </Sec>

        <Sec k="pagamento">
          {p.formasPagamento?.length || p.condicoesPagamento?.length ? (
            <>
              {p.formasPagamento && p.formasPagamento.length > 0 && (
                <Text style={{ fontSize: 9, marginBottom: 4 }}><Text style={{ fontFamily: 'Roboto', fontWeight: 700, color: C.ink, textTransform: 'uppercase' }}>Formas de pagamento aceitas: </Text>{p.formasPagamento.join(', ')}.</Text>
              )}
              {p.condicoesPagamento && p.condicoesPagamento.length > 0 && (
                <>
                  <Text style={{ fontSize: 9, fontFamily: 'Roboto', fontWeight: 700, color: C.ink, textTransform: 'uppercase', marginBottom: 3 }}>Condições:</Text>
                  <Bullets itens={p.condicoesPagamento} />
                </>
              )}
            </>
          ) : (
            <Text style={styles.para}>{nv(p.formaPagamento) ? p.formaPagamento : 'A combinar entre as partes.'}</Text>
          )}
          {nv(p.faturamento) && (
            <Text style={{ fontSize: 9, marginTop: 4 }}><Text style={{ fontFamily: 'Roboto', fontWeight: 700, color: C.ink, textTransform: 'uppercase' }}>Faturamento: </Text>{p.faturamento}</Text>
          )}
        </Sec>

        {on('multas') && <Sec k="multas"><Paras paras={MULTAS_ATRASO} /></Sec>}
        {on('limitacao') && <Sec k="limitacao"><Paras paras={LIMITACAO_RESPONSABILIDADE} /></Sec>}

        <Sec k="prazo">
          <Text style={styles.para}>{nv(p.prazoExecucao) ? p.prazoExecucao : 'Prazo a ser definido após confirmação do pedido.'}</Text>
        </Sec>

        <Sec k="garantia">
          <View style={styles.greenCard} wrap={false}>
            <Text style={styles.greenBadge}>Garantia Assegurada</Text>
            <Text style={{ fontSize: 9, color: C.s700, textAlign: 'justify', lineHeight: 1.4 }}>{nv(p.garantia) ? p.garantia : 'Garantia de 90 (noventa) dias sobre os serviços de instalação e de 12 (doze) meses para os equipamentos fornecidos, contra defeitos de fabricação, a contar da entrega.'}</Text>
          </View>
        </Sec>

        {on('confidencialidade') && <Sec k="confidencialidade"><Paras paras={CONFIDENCIALIDADE} /></Sec>}
        {on('termoAceite') && <Sec k="termoAceite"><Paras paras={TERMO_ACEITE} /></Sec>}
        {on('condicoesGerais') && <Sec k="condicoesGerais"><Paras paras={CONDICOES_GERAIS} /></Sec>}

        <Sec k="validade">
          <Text style={styles.para}>{`Os preços permanecem fixos dentro do período de validade desta proposta, que é de ${p.validadePropostaDias || 15} ${p.validadePropostaComplemento || 'dias corridos a partir da emissão'}. Após este período, eventuais variações na base de preços dos fabricantes poderão ser repactuadas.`}</Text>
        </Sec>

        <Sec k="conclusao">
          <Text style={[styles.para, { fontStyle: 'italic' }]}>{nv(p.conclusao) ? p.conclusao : conclusaoPorTipo(p.tipoServico)}</Text>
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
              <Text style={{ fontFamily: 'Roboto', fontWeight: 700, color: C.ink, fontSize: 8, textTransform: 'uppercase' }}>{razao}</Text>
              <Text style={{ fontSize: 7.5, color: C.s500, textTransform: 'uppercase' }}>{assinante}</Text>
            </View>
            <View style={styles.signCol}>
              <View style={styles.signLine} />
              <Text style={{ fontFamily: 'Roboto', fontWeight: 700, color: C.ink, fontSize: 8, textTransform: 'uppercase' }}>{clienteNome}</Text>
              <Text style={{ fontSize: 7.5, color: C.s500, textTransform: 'uppercase' }}>De acordo &amp; Aceite da Proposta</Text>
            </View>
          </View>
        </View>
      </Page>

      {/* ===================== FECHAMENTO (marinho) ===================== */}
      {showFechamento && (
        <Page size="A4" style={styles.darkPage}>
          <BlueprintBg />
          <Footer cliente={clienteNome} numero={numero} data={dataEmissao} />
          <View style={{ paddingHorizontal: 40, marginTop: 'auto', marginBottom: 'auto' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 24 }}>
              {showLogo && (
                <View style={styles.coverLogoBox}>
                  <Logo size={36} />
                </View>
              )}
              <Text style={styles.coverBrand}>FIREOWL CONTROLS</Text>
            </View>
            <Text style={styles.coverKicker}>Obrigado pela oportunidade</Text>
            <Text style={[styles.closeTitle, { marginTop: 6 }]}>Vamos proteger o seu patrimônio com engenharia de verdade.</Text>
            <View style={styles.closeBar} />
            <Text style={{ color: C.s300, fontSize: 9, lineHeight: 1.5, maxWidth: 440, marginBottom: 24 }}>
              Nossa equipe está à disposição para esclarecer qualquer ponto desta proposta, ajustar escopos e agendar
              a visita técnica. Fale com a gente pelos canais abaixo.
            </Text>
            <View style={styles.closeRow}>
              <View style={styles.closeItem}>
                <Text style={styles.closeLabel}>Empresa</Text>
                <Text style={styles.closeValue}>{razao}</Text>
                <Text style={{ color: C.s400, fontSize: 8, marginTop: 2 }}>{`CNPJ ${companyProfile.cnpj}`}</Text>
              </View>
              <View style={styles.closeItem}>
                <Text style={styles.closeLabel}>Endereço</Text>
                <Text style={styles.closeValue}>{companyProfile.endereco}</Text>
              </View>
              {nv(companyProfile.telefone) && (
                <View style={styles.closeItem}>
                  <Text style={styles.closeLabel}>Telefone</Text>
                  <Text style={styles.closeValue}>{companyProfile.telefone}</Text>
                </View>
              )}
              {nv(companyProfile.email) && (
                <View style={styles.closeItem}>
                  <Text style={styles.closeLabel}>E-mail</Text>
                  <Text style={styles.closeValue}>{companyProfile.email}</Text>
                </View>
              )}
              <View style={styles.closeItem}>
                <Text style={styles.closeLabel}>Referência desta Proposta</Text>
                <Text style={styles.closeValue}>{numero}</Text>
              </View>
            </View>
          </View>
        </Page>
      )}
    </Document>
  );
}
