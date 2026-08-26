import React from 'react';
import { Page, View, Text, Svg, Path, Line, Rect, Circle, Image, Font } from '@react-pdf/renderer';

/**
 * Primitivos compartilhados de PDF (fontes, paleta, logo, rodapé) para os
 * documentos gerados com @react-pdf/renderer. Segue as armadilhas já mapeadas:
 * - NÃO colocar lineHeight no estilo da <Page> (zera <Text fixed render>).
 * - Rodapé = um único <Text fixed render>.
 * - SVG de fundo de página inteira precisa ser <Svg fixed>.
 * Ver memória "react-pdf-gotchas-proposta".
 */

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

// Paleta institucional Fireowl (idêntica à da proposta).
export const C = {
  navy: '#0B1E38',
  navy2: '#13315C',
  navyLine: '#5B7DB1',
  brand: '#1A1A72',
  logoRed: '#E63946',
  red: '#C1272D',
  gold: '#F2A900',
  green: '#2E7D5B',
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

export const A4 = { w: 595.28, h: 841.89 };

export const brl = (n: number) => `R$ ${(n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
/** Total da linha do item: preço × qtd − desconto (nunca negativo). */
export const itemTotal = (eq: { precoUnitario?: number; quantidade: number; desconto?: number }) =>
  Math.max(0, (eq.precoUnitario || 0) * eq.quantidade - (eq.desconto || 0));
export const nv = (s?: string) => !!s && s.trim().length > 0;
export const lnv = (a?: string[]) => Array.isArray(a) && a.filter((x) => nv(x)).length > 0;

const LOGO_PATHS = [
  { d: 'M49 147.168C49 116.147 74.1471 91 105.168 91L358.832 91C389.853 91 415 116.147 415 147.168L415 371.832C415 402.853 389.853 428 358.832 428L105.168 428C74.1471 428 49 402.853 49 371.832Z', fill: C.brand },
  { d: 'M107.082 128.023 380.116 128.023 380.358 128.42 380.116 129.808 381.082 130.601 378.427 135.954 375.288 142.299 371.667 149.635 367.804 157.368 363.701 165.498 360.321 172.239 357.665 177.593 354.044 184.73 351.147 190.282 348.009 196.627 347.526 197.024 176.125 197.024 173.228 194.644 171.297 193.256 167.917 190.481 165.986 189.093 164.055 187.506 162.123 186.118 157.778 182.549 155.847 181.161 152.467 178.386 150.536 176.998 147.639 174.817 143.535 171.644 141.121 169.662 139.189 168.273 136.292 165.894 134.361 164.506 131.464 162.127 129.533 160.739 126.395 158.161 124.463 156.773 121.566 154.394 119.635 153.006 117.704 151.42 115.773 150.032 111.91 147.058 107.565 143.489 107.082 142.498Z', fill: C.logoRed },
  { d: 'M105.448 156.05 106.416 156.249 111.252 160.225 113.187 161.616 118.023 165.592 119.958 166.983 126.004 171.953 127.938 173.344 130.84 175.73 132.775 177.121 139.546 182.687 141.481 184.078 145.592 187.259 148.494 189.445 150.428 191.036 152.363 192.427 155.265 194.812 157.2 196.204 161.311 199.385 163.729 201.173 165.664 202.565 166.148 203.161 166.389 231.388 166.389 285.059 166.148 285.655 165.664 285.854 159.618 285.854 153.814 284.86 136.644 281.481 124.795 279.294 111.252 276.71 107.141 275.915 106.174 275.319 105.69 273.728 105.448 270.349 105.206 231.786 104.964 230.593 103.03 231.984 100.853 233.773 98.9189 235.761 96.2586 238.743 93.115 242.719 89.0038 248.284 87.3108 251.266 85.86 254.844 84.8927 259.019 84.8927 262.199 85.6181 265.976 86.8273 269.157 88.7619 272.337 91.1801 275.12 93.3566 277.108 95.0496 278.698 97.7097 280.686 100.612 282.475 104.481 284.463 110.043 286.848 115.847 288.836 121.651 290.426 128.906 292.016 138.095 293.606 146.318 294.6 155.991 295.395 165.664 295.793 179.448 295.793 190.331 295.395 206.049 294.203 218.625 292.811 230.233 291.221 243.05 289.034 256.108 286.45 266.507 284.065 273.762 282.276 282.952 279.692 294.318 276.313 301.089 274.126 307.618 271.741 314.389 269.355 322.37 266.374 329.141 263.789 341.233 258.82 344.618 257.23 348.488 255.639 354.533 252.857 367.35 246.694 371.945 244.309 381.377 239.141 385.246 236.954 388.873 234.966 389.84 234.966 390.082 235.96 388.389 237.749 385.487 240.134 383.553 241.526 380.893 243.514 377.507 245.7 373.638 248.284 370.252 250.471 365.899 253.254 361.788 255.838 357.435 258.422 353.566 260.609 348.971 263.193 343.651 266.175 335.671 270.548 329.867 273.53 322.854 276.909 317.775 279.294 310.037 282.674 305.442 284.661 298.912 287.444 293.108 289.631 289.481 291.022 284.403 293.01 275.938 295.992 266.749 298.974 259.01 301.359 244.501 305.335 238.455 306.925 226.605 309.708 213.305 312.491 206.049 313.882 194.925 315.472 187.671 316.466 177.514 317.46 163.487 318.653 155.991 319.05 142.932 319.05 132.291 318.653 122.86 317.858 113.429 316.864 105.448 315.671 101.821 314.677 97.4678 313.286 93.5985 312.491 85.3762 309.708 79.3304 307.322 75.4612 305.335 72.5592 303.545 69.4156 301.359 65.788 298.377 62.8861 294.998 60.226 290.824 58.5332 287.047 57.324 282.276 57.0822 280.686 57.0822 276.71 58.2914 270.945 60.226 266.175 62.4025 262.199 65.5461 257.826 68.4481 254.447 71.5919 251.266 73.5265 249.278 75.9449 247.092 77.6377 245.502 83.6835 240.532 85.6181 239.141 88.52 236.954 91.6639 234.767 99.8862 229.599 103.514 227.413 105.206 226.419ZM104.723 227.81 104.481 228.605 104.964 228.605Z', fill: C.logoRed },
  { d: 'M176.153 206.099 207.881 206.099 287.08 206.298 339.152 206.298 338.91 208.089 339.152 209.482 338.91 211.87 330.433 225.801 325.589 234.955 322.199 241.323 319.292 247.094 315.417 254.656 311.058 263.014 308.151 268.786 307.424 269.383 297.494 269.781 277.876 270.378 258.742 271.174 240.578 271.771 220.959 272.567 218.295 272.567 218.295 282.517 218.053 284.507 217.811 284.706 197.95 285.502 179.059 286.099 176.637 286.099 176.395 285.104 176.153 281.124Z', fill: C.logoRed },
  { d: 'M216.992 319.209 218.186 319.409 216.276 322.202 214.844 323.798 208.876 328.786 206.967 330.182 204.341 332.177 201.715 333.973 198.851 335.968 194.793 338.562 190.496 341.355 186.438 344.148 183.335 346.343 179.992 348.937 178.083 350.333 175.457 352.328 173.547 353.725 170.205 356.119 164.954 359.71 161.851 361.905 159.225 363.701 157.554 365.097 155.644 366.494 152.064 369.088 149.676 370.883 147.767 372.28 144.425 374.674 142.038 376.47 140.128 377.866 137.741 379.662 135.115 381.457 132.967 383.253 131.057 384.65 127.954 387.044 122.702 390.635 118.883 393.229 116.257 395.024 112.915 397.418 109.335 400.012 107.664 401.209 107.425 401.209 107.186 395.623 107.186 388.64 107.664 349.934 107.902 334.971 108.141 328.187 108.857 327.988 121.031 328.586 136.547 328.586 146.096 328.187 157.315 327.589 173.309 326.192 186.676 324.596 195.986 323.199 208.399 321.005Z', fill: C.logoRed },
];

export const Logo = ({ size = 36 }: { size?: number }) => (
  <Svg viewBox="0 0 503 503" style={{ width: size, height: size }}>
    {LOGO_PATHS.map((p, i) => (
      <Path key={i} d={p.d} fill={p.fill} stroke="#0C0C0C" strokeWidth={4} fillRule="evenodd" />
    ))}
  </Svg>
);

// Fundo "blueprint" ancorado (fixed) para páginas marinho.
export const BlueprintBg = () => (
  <Svg fixed style={{ position: 'absolute', top: 0, left: 0 }} width={A4.w} height={A4.h}>
    {Array.from({ length: Math.ceil(A4.w / 28) }).map((_, i) => (
      <Line key={`v${i}`} x1={i * 28} y1={0} x2={i * 28} y2={A4.h} stroke={C.navyLine} strokeOpacity={0.14} strokeWidth={0.5} />
    ))}
    {Array.from({ length: Math.ceil(A4.h / 28) }).map((_, i) => (
      <Line key={`h${i}`} x1={0} y1={i * 28} x2={A4.w} y2={i * 28} stroke={C.navyLine} strokeOpacity={0.14} strokeWidth={0.5} />
    ))}
  </Svg>
);

/** Cabeçalho fixo: logo pequena + marca à esquerda, rótulo do documento à direita. */
export const PdfHeader = ({ razao, label, showLogo = true }: { razao: string; label: string; showLogo?: boolean }) => (
  <View
    fixed
    style={{
      position: 'absolute', top: 0, left: 0, right: 0, height: 44,
      backgroundColor: C.white, borderBottomWidth: 1.5, borderBottomColor: C.red,
      paddingHorizontal: 40, flexDirection: 'row', alignItems: 'center',
    }}
  >
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {showLogo && <Logo size={18} />}
      <Text style={{ fontSize: 8.5, fontFamily: 'Poppins', fontWeight: 600, color: C.navy, letterSpacing: 0.8 }}>
        {(razao || 'FIREOWL CONTROLS').toUpperCase()}
      </Text>
    </View>
    <View style={{ flex: 1 }} />
    <Text style={{ fontSize: 7, color: C.s500, fontFamily: 'Roboto', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8 }}>
      {label}
    </Text>
  </View>
);

/** Seção "Informações Adicionais" com os campos personalizados do pedido. */
export const CamposExtras = ({ campos, titulo = 'Informações Adicionais' }: { campos?: { rotulo: string; valor: string }[]; titulo?: string }) => {
  const list = (campos || []).filter((c) => (c.rotulo || '').trim() || (c.valor || '').trim());
  if (!list.length) return null;
  return (
    <View minPresenceAhead={50}>
      <View style={{ flexDirection: 'row', alignItems: 'center', borderLeftWidth: 3, borderLeftColor: C.red, paddingLeft: 8, marginTop: 8, marginBottom: 5 }}>
        <Text style={{ color: C.navy, fontSize: 11, fontFamily: 'Poppins', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4 }}>{titulo}</Text>
      </View>
      {list.map((c, i) => (
        <View key={i} style={{ marginBottom: 4 }} wrap={false}>
          {(c.rotulo || '').trim() ? <Text style={{ fontFamily: 'Roboto', fontWeight: 700, color: C.ink, fontSize: 8.5, textTransform: 'uppercase' }}>{c.rotulo}</Text> : null}
          <Text style={{ fontSize: 9, color: C.s700, textAlign: 'justify', lineHeight: 1.4 }}>{c.valor}</Text>
        </View>
      ))}
    </View>
  );
};

/** Rodapé fixo (barra marinho, texto centralizado, "Página X de Y"). */
export const PdfFooter = ({ numero, data, cliente }: { numero: string; data: string; cliente: string }) => (
  <Text
    fixed
    style={{
      position: 'absolute', bottom: 0, left: 0, right: 0,
      backgroundColor: C.navy, borderTopWidth: 2, borderTopColor: C.red,
      paddingVertical: 8, paddingHorizontal: 20,
      fontSize: 7.5, color: C.white, fontFamily: 'Roboto', textAlign: 'center', letterSpacing: 0.4,
    }}
    render={({ pageNumber, totalPages }) =>
      `${numero}   •   ${data}   •   ${cliente}   •   Página ${pageNumber} de ${totalPages}`
    }
  />
);

// ===================== Capa e Áreas de Atuação (compartilhadas) =====================

const g = { gold: C.gold, red: C.red, navy2: C.navy2, deep: '#0E2647', line2: '#22406B', ring: '#2A4A78', muteNum: '#31507F' };

const CoverBlock = ({ label, value }: { label: string; value: string }) => (
  <View style={{ backgroundColor: g.navy2, borderLeftWidth: 3, borderLeftColor: g.red, borderRadius: 4, paddingVertical: 9, paddingHorizontal: 12, marginBottom: 8 }}>
    <Text style={{ color: g.gold, fontSize: 7.5, fontFamily: 'Roboto', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 3 }}>{label}</Text>
    <Text style={{ color: C.white, fontSize: 13, fontFamily: 'Roboto', fontWeight: 700, lineHeight: 1.2 }}>{value || '—'}</Text>
  </View>
);

/** Capa institucional marinho (reaproveita o visual da proposta). Renderiza uma <Page>. */
export const DocCover = ({
  razao, cnpj, endereco, telefone, email, titulo, subtitulo, cliente, numero, escopo, data, capaImagemUrl, showLogo = true,
}: {
  razao: string; cnpj?: string; endereco?: string; telefone?: string; email?: string;
  titulo: string; subtitulo?: string; cliente: string; numero: string; escopo: string; data: string;
  capaImagemUrl?: string; showLogo?: boolean;
}) => (
  <Page size="A4" style={{ padding: 0, fontSize: 9, fontFamily: 'Roboto', color: C.white, backgroundColor: C.navy }}>
    <BlueprintBg />
    <View style={{ flex: 1, padding: 40, justifyContent: 'space-between' }}>
      <View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {showLogo && (
              <View style={{ backgroundColor: C.white, borderRadius: 8, padding: 4, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                <Logo size={36} />
              </View>
            )}
            <View>
              <Text style={{ color: C.white, fontFamily: 'Poppins', fontWeight: 700, fontSize: 16, letterSpacing: 1.2 }}>FIREOWL CONTROLS</Text>
              <Text style={{ color: C.s400, fontSize: 7, fontFamily: 'Roboto', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2, marginTop: 3 }}>Sistemas Integrados de Proteção</Text>
            </View>
          </View>
          <Text style={{ color: g.gold, fontSize: 8, fontFamily: 'Roboto', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.3, textAlign: 'right' }}>Engenharia de Segurança{'\n'}& Detecção de Incêndio</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14 }}>
          <View style={{ width: 40, height: 2, backgroundColor: g.gold, borderRadius: 1 }} />
          <View style={{ flex: 1, height: 1, backgroundColor: g.line2, marginLeft: 8 }} />
        </View>
      </View>

      {nv(capaImagemUrl) ? <Image src={capaImagemUrl!} style={{ width: '100%', height: 150, borderRadius: 6, marginTop: 12, objectFit: 'cover' }} /> : null}

      <View style={{ marginTop: nv(capaImagemUrl) ? 12 : 28 }}>
        <Text style={{ color: g.gold, fontSize: 8, fontFamily: 'Roboto', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.3 }}>{subtitulo || 'Documento Comercial'}</Text>
        <View style={{ width: 56, height: 4, backgroundColor: g.red, borderRadius: 2, marginTop: 6, marginBottom: 4 }} />
        <Text style={{ color: C.white, fontSize: 30, fontFamily: 'Poppins', fontWeight: 700, letterSpacing: 0.5, lineHeight: 1.1 }}>{titulo}</Text>
      </View>

      <View>
        <CoverBlock label="Cliente" value={cliente} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}><CoverBlock label="Número da Proposta" value={numero} /></View>
          <View style={{ flex: 1 }}><CoverBlock label="Data de Emissão" value={data} /></View>
        </View>
        <CoverBlock label="Escopo de Fornecimento" value={escopo} />
      </View>

      <View style={{ borderTopWidth: 1, borderTopColor: g.navy2, paddingTop: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ width: 6, height: 6, backgroundColor: g.gold, borderRadius: 1, marginRight: 6 }} />
          <Text style={{ color: C.white, fontSize: 8.5, fontFamily: 'Roboto', fontWeight: 700 }}>{`${razao}${cnpj ? ` — CNPJ ${cnpj}` : ''}`}</Text>
        </View>
        {nv(endereco) ? <Text style={{ color: C.s400, fontSize: 7.5, marginTop: 2 }}>{endereco}</Text> : null}
        {(nv(telefone) || nv(email)) ? <Text style={{ color: C.s400, fontSize: 7.5, marginTop: 2 }}>{[telefone, email].filter(nv).join('  •  ')}</Text> : null}
      </View>
    </View>
  </Page>
);

const AreaIcon = ({ kind }: { kind: string }) => {
  const S = 22, sw = 1.6;
  const p = (d: string) => <Path d={d} stroke={g.red} strokeWidth={sw} fill="none" />;
  return (
    <Svg viewBox="0 0 24 24" style={{ width: S, height: S }}>
      {kind === 'sdai' && p('M12 2 C12 7 16 8 14 13 C13 16 10 16 9 13 C8 15 9 16.5 9 18 C6 16 6.5 10.5 10 8 C10 10.5 12 10.5 12 8 C12 5.5 12 3.5 12 2 Z')}
      {kind === 'cftv' && (<><Rect x={3} y={7} width={13} height={10} rx={1.5} stroke={g.red} strokeWidth={sw} fill="none" /><Circle cx={9.5} cy={12} r={3} stroke={g.red} strokeWidth={sw} fill="none" />{p('M16 10 L21 7 L21 17 L16 14 Z')}</>)}
      {kind === 'acesso' && (<><Rect x={4} y={4} width={16} height={11} rx={1.5} stroke={g.red} strokeWidth={sw} fill="none" /><Circle cx={12} cy={9} r={2.2} stroke={g.red} strokeWidth={sw} fill="none" />{p('M8.5 15 C8.5 12.5 15.5 12.5 15.5 15')}{p('M9 19 L15 19')}</>)}
      {kind === 'alarme' && (<>{p('M12 3 C8.5 3 7 6 7 10 L6 15 L18 15 L17 10 C17 6 15.5 3 12 3 Z')}{p('M10 18 C10 20 14 20 14 18')}<Circle cx={12} cy={3} r={0.8} stroke={g.red} strokeWidth={sw} fill="none" /></>)}
      {kind === 'bms' && (<><Rect x={3} y={4} width={18} height={12} rx={1.5} stroke={g.red} strokeWidth={sw} fill="none" /><Circle cx={12} cy={10} r={3} stroke={g.red} strokeWidth={sw} fill="none" />{p('M12 6 L12 4.5')}{p('M12 14 L12 15.5')}{p('M8 10 L6.5 10')}{p('M16 10 L17.5 10')}{p('M9 20 L15 20')}</>)}
      {kind === 'integracao' && (<><Circle cx={5} cy={6} r={2} stroke={g.red} strokeWidth={sw} fill="none" /><Circle cx={19} cy={6} r={2} stroke={g.red} strokeWidth={sw} fill="none" /><Circle cx={12} cy={19} r={2} stroke={g.red} strokeWidth={sw} fill="none" />{p('M6.5 7.5 L11 17.5')}{p('M17.5 7.5 L13 17.5')}{p('M7 6 L17 6')}</>)}
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

/** Página institucional "Áreas de Atuação" (reaproveita o visual da proposta). Renderiza uma <Page>. */
export const AreasAtuacaoPage = ({ razao, numero, data, cliente }: { razao?: string; numero: string; data: string; cliente: string }) => (
  <Page size="A4" style={{ padding: 0, fontSize: 9, fontFamily: 'Roboto', color: C.white, backgroundColor: C.navy }}>
    <BlueprintBg />
    <PdfFooter numero={numero} data={data} cliente={cliente} />
    <View style={{ flex: 1, paddingTop: 40, paddingHorizontal: 40, paddingBottom: 40 }}>
      <Text style={{ color: g.gold, fontSize: 8, fontFamily: 'Roboto', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.6 }}>Quem é a {razao || 'Fireowl Controls'}</Text>
      <Text style={{ color: C.white, fontSize: 24, fontFamily: 'Poppins', fontWeight: 700, letterSpacing: 0.3, marginTop: 5 }}>Áreas de Atuação</Text>
      <View style={{ width: 52, height: 4, backgroundColor: g.red, borderRadius: 2, marginTop: 8, marginBottom: 10 }} />
      <Text style={{ color: C.s300, fontSize: 9, lineHeight: 1.5, marginBottom: 18, maxWidth: 470 }}>
        Engenharia especializada em segurança eletrônica e proteção contra incêndio. Projetamos, instalamos,
        comissionamos e mantemos soluções integradas — do sensor de campo à central de supervisão.
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        {AREAS.map((a, i) => (
          <View key={a.kind} style={{ width: '48%', backgroundColor: g.navy2, borderRadius: 10, borderWidth: 1, borderColor: g.line2, padding: 14, marginBottom: 12, minHeight: 116 }} wrap={false}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 9 }}>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: g.deep, borderWidth: 1, borderColor: g.ring, alignItems: 'center', justifyContent: 'center' }}>
                <AreaIcon kind={a.kind} />
              </View>
              <Text style={{ fontSize: 18, fontFamily: 'Poppins', fontWeight: 700, color: g.muteNum }}>{String(i + 1).padStart(2, '0')}</Text>
            </View>
            <Text style={{ color: C.white, fontSize: 10, fontFamily: 'Poppins', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{a.titulo}</Text>
            <View style={{ width: 22, height: 2, backgroundColor: g.red, borderRadius: 1, marginTop: 5, marginBottom: 6 }} />
            <Text style={{ color: C.s300, fontSize: 7.8, lineHeight: 1.45 }}>{a.desc}</Text>
          </View>
        ))}
      </View>
      <View style={{ marginTop: 4, backgroundColor: g.deep, borderLeftWidth: 3, borderLeftColor: g.gold, borderRadius: 8, paddingVertical: 10, paddingHorizontal: 14 }}>
        <Text style={{ color: C.s400, fontSize: 7, fontFamily: 'Roboto', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 3 }}>Ciclo completo de engenharia</Text>
        <Text style={{ color: C.white, fontSize: 8.5, fontFamily: 'Poppins', fontWeight: 600, letterSpacing: 0.6 }}>Projeto   ·   Instalação   ·   Comissionamento   ·   Manutenção   ·   Suporte</Text>
      </View>
    </View>
  </Page>
);
