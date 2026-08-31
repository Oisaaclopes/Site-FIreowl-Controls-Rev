import { describe, it, expect } from 'vitest';
import path from 'node:path';
import React from 'react';
import { Font, renderToBuffer } from '@react-pdf/renderer';
import { PhotoSheetDocument } from './PhotoSheetDocument';
import type { PhotoSheetConfig, PhotoSheetItem } from '../../lib/photoSheet';

// Reaponta as fontes ('/fonts/..' do pdfKit) para arquivos locais para o Node.
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
Font.register({ family: 'Helvetica', fonts: [
  { src: fontFile('Roboto-Regular.ttf') },
  { src: fontFile('Roboto-Bold.ttf'), fontWeight: 700 },
]});

// PNG opaco 2x2 (exercita o caminho <Image src> com dataURL).
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGN4aun21NKNQUqqSEqqCAAiWgQVI7g2/QAAAABJRU5ErkJggg==';
const MARKERS = ['Antes', 'Depois', 'Falha', 'Corrigido', 'Pendente'];

const config: PhotoSheetConfig = {
  titulo: 'Folha de Fotos', clienteNome: 'Super Muffato', localSetor: 'Bloco B · Central',
  referencia: 'OS-2026-0042', dataEmissao: '2026-08-31', responsavel: 'Isaac Lopes',
  observacao: 'Manutenção preventiva do sistema de detecção.',
};

const items = (n: number): PhotoSheetItem[] => Array.from({ length: n }, (_, i) => ({
  clientUuid: `uuid-${i}`, imageDataUrl: PNG, numero: String(i + 1).padStart(2, '0'),
  titulo: `EVIDÊNCIA ${String(i + 1).padStart(2, '0')}`, local: 'Bloco B',
  dataHora: '31/08/2026 15:30', marcador: MARKERS[i % MARKERS.length],
  observacao: i === 0 ? 'x'.repeat(400) : 'Detector obstruído por poeira.', tecnico: 'Isaac Lopes',
}));

async function renderOk(n: number) {
  const buf = await renderToBuffer(<PhotoSheetDocument config={config} items={items(n)} />);
  expect(buf.slice(0, 5).toString('latin1')).toBe('%PDF-');
  expect(buf.length).toBeGreaterThan(1000);
}

describe('PhotoSheetDocument render (Node smoke)', () => {
  it('1 evidência', async () => { await renderOk(1); }, 30000);
  it('2 evidências', async () => { await renderOk(2); }, 30000);
  it('3 evidências', async () => { await renderOk(3); }, 30000);
  it('multipágina com 20 evidências (nota longa e marcadores variados)', async () => { await renderOk(20); }, 60000);
});
