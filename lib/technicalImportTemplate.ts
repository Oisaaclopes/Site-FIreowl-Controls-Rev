/* ===================================================================
 * ETAPA 3D.3 — Modelo OFICIAL de importação da Base Técnica (XLSX por área).
 * Colunas contextuais por disciplina (§14–§19), centralizadas aqui (§23) — as
 * CHAVES casam com lib/technicalImport (importTargets), então o modelo Fireowl
 * importa com mapeamento automático, e planilhas externas continuam no fluxo
 * assistido (§22). SEGURANÇA (§20): a aba IMPORTACAO (sheet1, a única lida pelo
 * parser) traz SÓ cabeçalhos; os EXEMPLOS ficam na aba INSTRUCOES (sheet2, nunca
 * importada). Assim nenhum exemplo entra como ativo real.
 * =================================================================== */
import { TechArea, AREA_LABEL } from './technicalBase';
import { importTargets } from './technicalImport';
import { buildXlsx, buildXlsxBlob, SheetSpec } from './xlsxWriter';

export interface TemplateColumn { label: string; key: string; example?: string }

/** Colunas oficiais por área (rótulo exibido + chave do motor). §15–§19. */
export const TEMPLATE_COLUMNS: Record<TechArea, TemplateColumn[]> = {
  SDAI: [
    { label: 'GRUPO', key: 'grupo', example: 'Acionador Manual' },
    { label: 'TIPO', key: 'tipoAtivo', example: 'Acionador Manual Endereçável' },
    { label: 'FABRICANTE', key: 'fabricante', example: 'Tecnohold' },
    { label: 'MODELO', key: 'modelo', example: 'AMET' },
    { label: 'CENTRAL', key: 'central', example: '1' },
    { label: 'LAÇO', key: 'laco', example: '2' },
    { label: 'ENDEREÇO', key: 'endereco', example: '45' },
    { label: 'DESCRIÇÃO PROGRAMADA', key: 'descricao_programada', example: 'L2 AM 45 RECEPCAO' },
    { label: 'LOCALIZAÇÃO', key: 'localizacao', example: 'Corredor próximo à padaria' },
    { label: 'SERIAL', key: 'serial', example: '' },
    { label: 'OBSERVAÇÃO', key: 'observacao', example: '' },
  ],
  CFTV: [
    { label: 'GRUPO', key: 'grupo', example: 'Câmera' },
    { label: 'TIPO', key: 'tipoAtivo', example: 'Câmera IP Bullet' },
    { label: 'TECNOLOGIA', key: 'tecnologia', example: 'IP' },
    { label: 'FABRICANTE', key: 'fabricante', example: 'Intelbras' },
    { label: 'MODELO', key: 'modelo', example: 'VIP 3230 B' },
    { label: 'GRAVADOR', key: 'nvr', example: 'NVR 01' },
    { label: 'IP', key: 'ip', example: '192.168.10.31' },
    { label: 'CANAL', key: 'canal', example: '08' },
    { label: 'MAC', key: 'mac', example: '' },
    { label: 'LOCALIZAÇÃO', key: 'localizacao', example: 'Estacionamento' },
    { label: 'SERIAL', key: 'serial', example: '' },
    { label: 'OBSERVAÇÃO', key: 'observacao', example: '' },
  ],
  ALARME: [
    { label: 'GRUPO', key: 'grupo', example: 'Sensor PIR' },
    { label: 'TIPO', key: 'tipoAtivo', example: 'Sensor de presença' },
    { label: 'FABRICANTE', key: 'fabricante', example: 'JFL' },
    { label: 'MODELO', key: 'modelo', example: 'IRPET-520' },
    { label: 'CENTRAL', key: 'central', example: '1' },
    { label: 'ZONA', key: 'zona', example: '12' },
    { label: 'PARTIÇÃO', key: 'particao', example: 'A' },
    { label: 'ENDEREÇO', key: 'endereco', example: '' },
    { label: 'DESCRIÇÃO PROGRAMADA', key: 'descricao_programada', example: 'ZONA 12 DEPOSITO' },
    { label: 'LOCALIZAÇÃO', key: 'localizacao', example: 'Depósito' },
    { label: 'SERIAL', key: 'serial', example: '' },
    { label: 'OBSERVAÇÃO', key: 'observacao', example: '' },
  ],
  BMS: [
    { label: 'GRUPO', key: 'grupo', example: 'Controlador' },
    { label: 'TIPO', key: 'tipoAtivo', example: 'Controlador BACnet' },
    { label: 'FABRICANTE', key: 'fabricante', example: 'Siemens' },
    { label: 'MODELO', key: 'modelo', example: 'PXC' },
    { label: 'CONTROLADOR', key: 'controlador', example: 'CLP-01' },
    { label: 'PROTOCOLO', key: 'protocolo', example: 'BACnet/IP' },
    { label: 'IP', key: 'ip', example: '192.168.20.5' },
    { label: 'DEVICE INSTANCE', key: 'device_instance', example: '2001' },
    { label: 'MODBUS ID', key: 'modbus_id', example: '' },
    { label: 'PONTO', key: 'ponto', example: 'AHU-01/SUP-TEMP' },
    { label: 'LOCALIZAÇÃO', key: 'localizacao', example: 'Casa de máquinas' },
    { label: 'SERIAL', key: 'serial', example: '' },
    { label: 'OBSERVAÇÃO', key: 'observacao', example: '' },
  ],
  CONTROLE_ACESSO: [
    { label: 'GRUPO', key: 'grupo', example: 'Controladora' },
    { label: 'TIPO', key: 'tipoAtivo', example: 'Controladora de porta' },
    { label: 'FABRICANTE', key: 'fabricante', example: 'Control iD' },
    { label: 'MODELO', key: 'modelo', example: 'iDBox' },
    { label: 'CONTROLADORA', key: 'controladora', example: 'CTRL-01' },
    { label: 'PORTA', key: 'porta', example: 'Entrada Funcionários' },
    { label: 'CANAL', key: 'canal', example: '1' },
    { label: 'IP', key: 'ip', example: '192.168.30.10' },
    { label: 'LOCALIZAÇÃO', key: 'localizacao', example: 'Recepção' },
    { label: 'SERIAL', key: 'serial', example: '' },
    { label: 'OBSERVAÇÃO', key: 'observacao', example: '' },
  ],
};

const INSTRUCTIONS: string[] = [
  'INSTRUÇÕES — MODELO DE IMPORTAÇÃO DA BASE TÉCNICA (FIREOWL GUARDIAN)',
  '',
  '1. Preencha os ativos na aba "IMPORTACAO" (uma linha = um ativo).',
  '2. NÃO altere o significado nem a ordem das colunas.',
  '3. Campos opcionais podem ficar vazios.',
  '4. Não duplique identificadores (ex.: mesmo Laço + Endereço) no mesmo cliente.',
  '5. Importar NÃO significa verificação em campo — os ativos entram como "não verificados".',
  '6. Abaixo, um exemplo de preenchimento (NÃO copie para a aba IMPORTACAO como está).',
  '',
];

/** Todas as chaves de coluna existem como alvo de importação (garante auto-map). */
export function templateColumnKeys(area: TechArea): string[] {
  return TEMPLATE_COLUMNS[area].map((c) => c.key);
}

/** Cabeçalhos oficiais da área (linha 1 da aba IMPORTACAO). */
export function templateHeaders(area: TechArea): string[] {
  return TEMPLATE_COLUMNS[area].map((c) => c.label);
}

/** Monta as abas do modelo: IMPORTACAO (só cabeçalhos) + INSTRUCOES (com exemplo). */
export function buildTemplateSheets(area: TechArea): SheetSpec[] {
  const cols = TEMPLATE_COLUMNS[area];
  const importSheet: SheetSpec = { name: 'IMPORTACAO', rows: [cols.map((c) => c.label)] };
  const instr: (string | number)[][] = INSTRUCTIONS.map((l) => [l]);
  instr.push(['COLUNA', 'SIGNIFICADO / EXEMPLO']);
  for (const c of cols) instr.push([c.label, c.example ? `Ex.: ${c.example}` : '(opcional)']);
  instr.push([]);
  instr.push(['EXEMPLO DE LINHA (ilustrativo — não importar):']);
  instr.push(cols.map((c) => c.label));
  instr.push(cols.map((c) => c.example || ''));
  const instrSheet: SheetSpec = { name: 'INSTRUCOES', rows: instr };
  return [importSheet, instrSheet]; // IMPORTACAO é sheet1 (a única lida na importação)
}

export function buildTemplateXlsx(area: TechArea): Uint8Array {
  return buildXlsx(buildTemplateSheets(area));
}

export function buildTemplateXlsxBlob(area: TechArea): Blob {
  return buildXlsxBlob(buildTemplateSheets(area));
}

export function templateFileName(area: TechArea): string {
  const slug = AREA_LABEL[area].normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').toUpperCase();
  return `MODELO_BASE_TECNICA_${slug}.xlsx`;
}
