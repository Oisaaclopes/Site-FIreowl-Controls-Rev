import { describe, it, expect } from 'vitest';
import path from 'node:path';
import React from 'react';
import { Font, renderToBuffer } from '@react-pdf/renderer';
import { PhotoComparisonDocument } from './PhotoComparisonDocument';
import type { PhotoSheetConfig } from '../../lib/photoSheet';
import type { ComparisonSheetItem } from '../../lib/comparisonSheet';

const fontFile = (f: string) => path.resolve(process.cwd(), 'public/fonts', f);
Font.clear();
Font.register({ family: 'Roboto', fonts: [
  { src: fontFile('Roboto-Regular.ttf') }, { src: fontFile('Roboto-Bold.ttf'), fontWeight: 700 }, { src: fontFile('Roboto-Italic.ttf'), fontStyle: 'italic' },
]});
Font.register({ family: 'Poppins', fonts: [{ src: fontFile('Poppins-SemiBold.ttf'), fontWeight: 600 }, { src: fontFile('Poppins-Bold.ttf'), fontWeight: 700 }]});
Font.register({ family: 'Helvetica', fonts: [{ src: fontFile('Roboto-Regular.ttf') }, { src: fontFile('Roboto-Bold.ttf'), fontWeight: 700 }]});

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGN4aun21NKNQUqqSEqqCAAiWgQVI7g2/QAAAABJRU5ErkJggg==';
const RESULTS = ['Corrigido', 'Parcialmente corrigido', 'Pendente'];

const config: PhotoSheetConfig = {
  titulo: 'Folha de Fotos', subtitulo: 'Comprovação de correções', clienteNome: 'Super Muffato',
  localSetor: 'Loja Saul Elkind', referencia: 'OS-2026-0042', dataEmissao: '2026-08-31', responsavel: 'Isaac Lopes',
};

const items = (n: number): ComparisonSheetItem[] => Array.from({ length: n }, (_, i) => ({
  id: `c${i}`, numero: String(i + 1).padStart(2, '0'), titulo: `Correção ${i + 1}`,
  beforeDataUrl: PNG, afterDataUrl: PNG,
  localBefore: 'Bloco A', localAfter: i % 2 ? 'Bloco B' : 'Bloco A', localDiff: i % 2 === 1,
  beforeDateHora: '10/08/2026 09:00', afterDateHora: '20/08/2026 15:30',
  beforeTecnico: 'Ana', afterTecnico: i % 3 ? 'Bruno' : 'Ana',
  descricao: i === 0 ? 'Substituição do detector danificado e normalização do ponto. '.repeat(6) : 'Ponto corrigido.',
  resultado: RESULTS[i % RESULTS.length],
}));

async function renderOk(n: number) {
  const buf = await renderToBuffer(<PhotoComparisonDocument config={config} items={items(n)} />);
  expect(buf.slice(0, 5).toString('latin1')).toBe('%PDF-');
  expect(buf.length).toBeGreaterThan(1000);
}

describe('PhotoComparisonDocument render (Node smoke)', () => {
  it('1 comparação', async () => { await renderOk(1); }, 30000);
  it('2 comparações', async () => { await renderOk(2); }, 30000);
  it('multipágina com 10 comparações', async () => { await renderOk(10); }, 60000);
});
