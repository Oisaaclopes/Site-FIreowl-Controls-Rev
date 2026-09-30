import { describe, expect, it } from 'vitest';
import {
  COMMERCIAL_AREAS, effectiveAreas, appliesToArea, homeDomain, countsByDomain,
  normalizeApplicability, applicabilityError, diffApplicability, explicitApplicability,
} from './catalogApplicability';
import { buildCatalogTree, domainFamilies, transversalFamilies, areaFamilies, TaxonomyNode, TRANSVERSAL_DOMAIN } from './catalogTree';
import { canonicalFamilyGroups, productsInFamily, UNCLASSIFIED_GROUP, itemsInScope } from './catalogSelection';
import { CANONICAL_AREAS } from './catalogAudit';
import type { InventoryItem } from './types';

// Árvore mínima fiel ao banco pós-0115/0116/0117 (ids explícitos).
const N = (id: string, code: string, parentId: string | null, name: string, area: string | null, sortOrder = 10): TaxonomyNode =>
  ({ id, code, parentId, name, area, scope: area ? 'AREA' : 'TRANSVERSAL', sortOrder, nodeType: 'TYPE', active: true });
const tree = buildCatalogTree([
  N('cam', 'CFTV.CAMERAS', null, 'Câmeras', 'CFTV', 10),
  N('arm', 'CFTV.ARMAZENAMENTO', null, 'Armazenamento', 'CFTV', 30),
  N('hd', 'CFTV.ARMAZENAMENTO.HD', 'arm', 'Disco Rígido (HD)', 'CFTV'),
  N('tx', 'CFTV.TRANSMISSAO', null, 'Transmissão de Vídeo', 'CFTV', 40),
  N('balun', 'CFTV.TRANSMISSAO.BALUN', 'tx', 'Balun', 'CFTV'),
  N('bat', 'SDAI.BATERIAS', null, 'Baterias', 'SDAI', 80),
  N('batsel', 'SDAI.BATERIAS.SELADA', 'bat', 'Selada / VRLA', 'SDAI'),
  N('ien', 'INFRA.ENERGIA', null, 'Energia', null, 10),
  N('nob', 'INFRA.ENERGIA.NOBREAK', 'ien', 'Nobreak', null),
  N('irede', 'INFRA.REDE', null, 'Rede', null, 20),
  N('poe', 'INFRA.REDE.SWITCH_POE', 'irede', 'Switch PoE', null),
]);

const P = (id: string, o: Partial<InventoryItem>): InventoryItem =>
  ({ id, code: id, name: id, category: '', quantity: 5, minQuantity: 0, unitPrice: 0, supplier: '', location: '', ...o } as InventoryItem);

// Exemplos de referência aprovados
const hd = P('hd1', { category: 'CFTV', canonicalTaxonomyId: 'hd', applicableAreas: [], quantity: 12 });
const balun = P('bl1', { category: 'CFTV', canonicalTaxonomyId: 'balun', applicableAreas: [] });
const nobreak = P('nb1', { category: 'INFRA', canonicalTaxonomyId: 'nob', applicableAreas: ['CFTV', 'CONTROLE_ACESSO', 'ALARME', 'BMS'], quantity: 3 });
const switchPoe = P('sw1', { category: 'INFRA', canonicalTaxonomyId: 'poe', applicableAreas: ['CFTV', 'CONTROLE_ACESSO', 'BMS'] });
const batSdai = P('bt1', { category: 'SDAI', canonicalTaxonomyId: 'batsel', applicableAreas: [] });
const nobreakSemArea = P('nb2', { category: 'INFRA', canonicalTaxonomyId: 'nob', applicableAreas: [] });
const legado = P('lg1', { category: 'CFTV', subcategory: 'Switch PoE', classificationStatus: 'NAO_CLASSIFICADO' });
const legadoRotulo = P('lg2', { category: 'Controle de Acesso' });
const catalog = [hd, balun, nobreak, switchPoe, batSdai, nobreakSemArea, legado, legadoRotulo];

describe('áreas comerciais × domínio transversal', () => {
  it('INFRA não é área comercial (CANONICAL_AREAS = só as 5)', () => {
    expect([...COMMERCIAL_AREAS]).toEqual(['SDAI', 'CFTV', 'ALARME', 'BMS', 'CONTROLE_ACESSO']);
    expect(CANONICAL_AREAS).toEqual([...COMMERCIAL_AREAS]);
    expect(CANONICAL_AREAS).not.toContain(TRANSVERSAL_DOMAIN);
  });
  it('famílias: área não enxerga INFRA; INFRA só as transversais', () => {
    expect(areaFamilies(tree, 'CFTV').map((n) => n.code)).toEqual(['CFTV.CAMERAS', 'CFTV.ARMAZENAMENTO', 'CFTV.TRANSMISSAO']);
    expect(transversalFamilies(tree).map((n) => n.code)).toEqual(['INFRA.ENERGIA', 'INFRA.REDE']);
    expect(domainFamilies(tree, TRANSVERSAL_DOMAIN).map((n) => n.name)).toEqual(['Energia', 'Rede']);
  });
});

describe('exemplos de referência', () => {
  it('HD → CFTV.ARMAZENAMENTO.HD, área implícita CFTV, sem linha', () => {
    expect(effectiveAreas(hd, tree)).toEqual({ areas: ['CFTV'], basis: 'AREA', primaryArea: 'CFTV', missingApplicability: false });
    expect(appliesToArea(hd, 'CFTV', tree)).toBe(true);
    expect(appliesToArea(hd, 'CONTROLE_ACESSO', tree)).toBe(false);
  });
  it('Balun → CFTV.TRANSMISSAO.BALUN', () => {
    expect(effectiveAreas(balun, tree).areas).toEqual(['CFTV']);
    expect(homeDomain(balun, tree)).toBe('CFTV');
  });
  it('Nobreak → INFRA + 4 aplicabilidades; nunca SDAI', () => {
    const e = effectiveAreas(nobreak, tree);
    expect(e).toEqual({ areas: ['CFTV', 'ALARME', 'BMS', 'CONTROLE_ACESSO'], basis: 'TRANSVERSAL', primaryArea: null, missingApplicability: false });
    expect(appliesToArea(nobreak, 'ALARME', tree)).toBe(true);
    expect(appliesToArea(nobreak, 'SDAI', tree)).toBe(false);
    expect(homeDomain(nobreak, tree)).toBe(TRANSVERSAL_DOMAIN);
  });
  it('Switch PoE → INFRA.REDE.SWITCH_POE + aplicabilidades', () => {
    expect(effectiveAreas(switchPoe, tree).areas).toEqual(['CFTV', 'BMS', 'CONTROLE_ACESSO']);
    expect(appliesToArea(switchPoe, 'ALARME', tree)).toBe(false);
  });
  it('Bateria SDAI permanece SDAI; extra opcional sem reclassificar', () => {
    expect(effectiveAreas(batSdai, tree).areas).toEqual(['SDAI']);
    const comAlarme = { ...batSdai, applicableAreas: ['ALARME'] };
    expect(effectiveAreas(comAlarme, tree)).toMatchObject({ areas: ['SDAI', 'ALARME'], basis: 'AREA', primaryArea: 'SDAI' });
    expect(appliesToArea(comAlarme, 'ALARME', tree)).toBe(true);
  });
  it('transversal sem aplicabilidade é sinalizado e não aparece em nenhuma área', () => {
    expect(effectiveAreas(nobreakSemArea, tree).missingApplicability).toBe(true);
    for (const a of COMMERCIAL_AREAS) expect(appliesToArea(nobreakSemArea, a, tree)).toBe(false);
  });
});

describe('fallback legado (NAO_CLASSIFICADO)', () => {
  it('usa a category como antes (tolerante a rótulo)', () => {
    expect(effectiveAreas(legado, tree)).toMatchObject({ areas: ['CFTV'], basis: 'LEGADO' });
    expect(appliesToArea(legadoRotulo, 'CONTROLE_ACESSO', tree)).toBe(true);
  });
  it('sem árvore carregada, classificado cai no legado (nunca some)', () => {
    expect(appliesToArea(hd, 'CFTV', null)).toBe(true);
    expect(appliesToArea(nobreak, 'CFTV', null)).toBe(true);   // via aplicabilidade explícita
    expect(appliesToArea(nobreak, 'SDAI', null)).toBe(false);  // category INFRA não casa área
  });
  it('área fora do canônico mantém o casamento textual', () => {
    expect(appliesToArea(P('x', { category: 'Incêndio' }), 'Incêndio', tree)).toBe(true);
  });
});

describe('estoque: um produto, um lugar, um saldo', () => {
  it('produto transversal conta uma única vez (em INFRA)', () => {
    const c = countsByDomain(catalog, tree);
    expect(c.get(TRANSVERSAL_DOMAIN)).toBe(3); // nobreak, switchPoe, nobreakSemArea
    expect(c.get('CFTV')).toBe(3);              // hd, balun, legado
    expect(c.get('SDAI')).toBe(1);
    const total = [...c.values()].reduce((s, n) => s + n, 0);
    expect(total).toBe(catalog.length);
  });
  it('aplicabilidade não duplica saldo: soma das quantidades é invariante', () => {
    const qty = (list: InventoryItem[]) => list.reduce((s, i) => s + i.quantity, 0);
    const porArea = COMMERCIAL_AREAS.map((a) => catalog.filter((i) => appliesToArea(i, a, tree)));
    // o mesmo objeto (mesmo id/saldo) aparece em várias áreas — nunca uma cópia
    expect(porArea[1].find((i) => i.id === 'nb1')).toBe(nobreak);
    expect(porArea[4].find((i) => i.id === 'nb1')).toBe(nobreak);
    expect(qty(catalog)).toBe(qty([...new Map(porArea.flat().map((i) => [i.id, i])).values()]) + nobreakSemArea.quantity);
  });
});

describe('gravação da aplicabilidade', () => {
  it('remove área implícita e normaliza', () => {
    expect(normalizeApplicability(['cftv', 'ALARME', 'ALARME', 'INFRA', 'X'], 'CFTV')).toEqual(['ALARME']);
    expect(normalizeApplicability(['BMS', 'CFTV'], null)).toEqual(['CFTV', 'BMS']);
  });
  it('transversal exige ≥ 1 área; área comercial não', () => {
    expect(applicabilityError(TRANSVERSAL_DOMAIN, [])).toMatch(/ao menos uma/);
    expect(applicabilityError(TRANSVERSAL_DOMAIN, ['CFTV'])).toBeNull();
    expect(applicabilityError('CFTV', [])).toBeNull();
  });
  it('diff grava só o necessário', () => {
    expect(diffApplicability(['CFTV', 'BMS'], ['BMS', 'ALARME'])).toEqual({ toAdd: ['ALARME'], toRemove: ['CFTV'] });
    expect(diffApplicability(['CFTV'], ['CFTV'])).toEqual({ toAdd: [], toRemove: [] });
  });
  it('explicitApplicability tolera undefined (banco pré-0118)', () => {
    expect(explicitApplicability(P('y', {}))).toEqual([]);
  });
});

describe('seletor da proposta por áreas efetivas', () => {
  const scopedFor = (area: string) => catalog.filter((i) => appliesToArea(i, area, tree));

  it('CFTV = produtos CFTV + Infraestrutura aplicável a CFTV', () => {
    expect(scopedFor('CFTV').map((i) => i.id).sort()).toEqual(['bl1', 'hd1', 'lg1', 'nb1', 'sw1']);
  });

  it('famílias: área → Infraestrutura → outras áreas → não classificados', () => {
    const groups = canonicalFamilyGroups(tree, scopedFor('CFTV'), 'CFTV');
    expect(groups.map((g) => g.label)).toEqual([
      'Armazenamento', 'Transmissão de Vídeo', 'Infraestrutura · Energia', 'Infraestrutura · Rede', 'Outros / Não classificados',
    ]);
    expect(productsInFamily(tree, scopedFor('CFTV'), 'ien').map((i) => i.id)).toEqual(['nb1']);
    expect(productsInFamily(tree, scopedFor('CFTV'), UNCLASSIFIED_GROUP).map((i) => i.id)).toEqual(['lg1']);
  });

  it('ALARME vê Nobreak (transversal) e a Bateria SDAI marcada como extra', () => {
    const extra = { ...batSdai, applicableAreas: ['ALARME'] };
    const scoped = [...catalog.filter((i) => i !== batSdai), extra].filter((i) => appliesToArea(i, 'ALARME', tree));
    expect(scoped.map((i) => i.id).sort()).toEqual(['bt1', 'nb1']);
    expect(canonicalFamilyGroups(tree, scoped, 'ALARME').map((g) => g.label)).toEqual(['Infraestrutura · Energia', 'SDAI · Baterias']);
  });

  it('itemsInScope aceita casamento customizado (domínio INFRA no cadastro)', () => {
    const infra = itemsInScope(catalog, { area: TRANSVERSAL_DOMAIN, match: (i) => homeDomain(i, tree) === TRANSVERSAL_DOMAIN });
    expect(infra.map((i) => i.id).sort()).toEqual(['nb1', 'nb2', 'sw1']);
  });
});
