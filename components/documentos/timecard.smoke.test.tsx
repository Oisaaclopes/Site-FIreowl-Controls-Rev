import { describe, it, expect } from 'vitest';
import path from 'node:path';
import React from 'react';
import { Font, renderToBuffer } from '@react-pdf/renderer';
import { TimecardDocument, TimecardBlock } from './TimecardDocument';
import { buildDailyTimeRecords, computePeriodSummary } from '../../lib/timecard';
import { TimePunch } from '../../lib/types';

// Reaponta as fontes (registradas em pdfKit como '/fonts/..') para arquivos
// locais, para que o renderToBuffer funcione fora do browser.
const fontFile = (f: string) => path.resolve(process.cwd(), 'public/fonts', f);
Font.clear();
Font.register({ family: 'Roboto', fonts: [
  { src: fontFile('Roboto-Regular.ttf') },
  { src: fontFile('Roboto-Bold.ttf'), fontWeight: 700 },
  { src: fontFile('Roboto-Italic.ttf'), fontStyle: 'italic' },
]});
Font.register({ family: 'Poppins', fonts: [
  { src: fontFile('Poppins-SemiBold.ttf'), fontWeight: 600 },
  { src: fontFile('Poppins-Bold.ttf'), fontWeight: 700 },
]});
// Fallback interno removido pelo Font.clear(): reaponta para o Roboto local.
Font.register({ family: 'Helvetica', fonts: [
  { src: fontFile('Roboto-Regular.ttf') },
  { src: fontFile('Roboto-Bold.ttf'), fontWeight: 700 },
]});

const p = (type: TimePunch['type'], y: number, mo: number, d: number, h: number, mi: number): TimePunch => ({
  id: `${type}_${d}_${h}${mi}`, employeeName: 'x', timestamp: '', type, locationStr: '', lat: 0, lng: 0, status: 'APROVADO',
  at: new Date(y, mo - 1, d, h, mi).getTime(),
});

function block(employee: string, punches: TimePunch[]): TimecardBlock {
  const records = buildDailyTimeRecords(punches);
  const summary = computePeriodSummary(records, () => 8 * 3600000);
  return { employee, records, summary, scheduleLabel: '09:00 às 19:00', bank: '+2h00', occurrences: {} };
}

describe('TimecardDocument render (Node smoke)', () => {
  it('renderiza multi-funcionário com dia OK e dia inconsistente (05/08)', async () => {
    const empA = [
      p('ENTRADA', 2026, 8, 4, 9, 0), p('PAUSA', 2026, 8, 4, 12, 0), p('RETORNO', 2026, 8, 4, 13, 0), p('SAIDA', 2026, 8, 4, 18, 0),
      // caso inconsistente 05/08
      p('ENTRADA', 2026, 8, 5, 16, 6), p('PAUSA', 2026, 8, 5, 16, 28), p('RETORNO', 2026, 8, 5, 18, 38), p('SAIDA', 2026, 8, 5, 17, 0),
    ];
    const empB = [p('ENTRADA', 2026, 8, 4, 9, 0)]; // incompleta
    // empC: mês completo (força >1 página → exercita cabeçalho de tabela
    // repetido e "Página X de Y").
    const empC: TimePunch[] = [];
    for (let d = 1; d <= 28; d++) {
      empC.push(p('ENTRADA', 2026, 8, d, 9, 0), p('PAUSA', 2026, 8, d, 12, 0), p('RETORNO', 2026, 8, d, 13, 0), p('SAIDA', 2026, 8, d, 18, 0));
    }
    const blocks = [block('Alice', empA), block('Bruno', empB), block('Carla', empC)];

    // Sem logo → cabeçalho cai no vetor da marca (não pode quebrar).
    const semLogo = <TimecardDocument blocks={blocks} periodLabel="01/08/2026 a 31/08/2026" />;
    const bufSem = await renderToBuffer(semLogo);
    expect(bufSem.slice(0, 5).toString('latin1')).toBe('%PDF-');
    expect(bufSem.length).toBeGreaterThan(1000);

    // Com logo (PNG opaco 2x2) → exercita o caminho <Image src> do cabeçalho.
    const pngLogo =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGN4aun21NKNQUqqSEqqCAAiWgQVI7g2/QAAAABJRU5ErkJggg==';
    const comLogo = <TimecardDocument blocks={blocks} periodLabel="01/08/2026 a 31/08/2026" logoUrl={pngLogo} />;
    const bufCom = await renderToBuffer(comLogo);
    expect(bufCom.slice(0, 5).toString('latin1')).toBe('%PDF-');
    expect(bufCom.length).toBeGreaterThan(1000);
  }, 30000);
});
