import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Client } from './types';
import { clientCnpjLabel, clientDisplayName, clientLegalName, filterClients } from './clientSelection';

const make = (id:string,name:string,cnpj:string):Client => ({id,name,cnpj,code:'',segment:'',contractStatus:'EM DIA',lastOSDate:'',lastOSType:'',address:'',contacts:[],totalContractsValue:0});
const clients=[make('1','Zeta Ltda. (Águia)','11.222.333/0001-44'),make('2','Beta Serviços (Beta)','55.666.777/0001-88'),make('3','Casa Alfa','99.000.111/0001-22')];

describe('seleção padronizada de clientes',()=>{
  it('ordena alfabeticamente pelo nome fantasia',()=>expect(filterClients(clients).map(clientDisplayName)).toEqual(['Águia','Beta','Casa Alfa']));
  it('busca por fantasia',()=>expect(filterClients(clients,'aguia').map(c=>c.id)).toEqual(['1']));
  it('busca por razão social',()=>expect(filterClients(clients,'zeta ltda').map(c=>c.id)).toEqual(['1']));
  it('busca por CNPJ com ou sem pontuação',()=>expect(filterClients(clients,'55666777000188').map(c=>c.id)).toEqual(['2']));
});

describe('seletor de cliente do Pedido', () => {
  const beagle = make('b', 'BY BEAGLE LONDRINA COMÉRCIO DE ROUPAS LTDA (BEAGLE L2 — CATUAÍ LONDRINA)', '15.159.399/0002-06');
  const semCnpj = make('s', 'Cliente Rápido', '00.000.000/0000-00');
  const base = [...clients, beagle, semCnpj];

  it('apresenta fantasia/unidade, razão social e CNPJ separados', () => {
    expect(clientDisplayName(beagle)).toBe('BEAGLE L2 — CATUAÍ LONDRINA');
    expect(clientLegalName(beagle.name)).toBe('BY BEAGLE LONDRINA COMÉRCIO DE ROUPAS LTDA');
    expect(clientCnpjLabel(beagle.cnpj)).toBe('CNPJ 15.159.399/0002-06');
  });
  it('placeholder 00.000.000/0000-00 aparece como "CNPJ não informado" sem alterar o dado', () => {
    expect(clientCnpjLabel(semCnpj.cnpj)).toBe('CNPJ não informado');
    expect(clientCnpjLabel('')).toBe('CNPJ não informado');
    expect(semCnpj.cnpj).toBe('00.000.000/0000-00');
    expect(filterClients(base, '0000').map((c) => c.id)).not.toContain('s');
  });
  it('fallback para razão social quando não há fantasia', () => {
    expect(clientDisplayName(clients[2])).toBe('Casa Alfa');
  });
  it('"Todos" acha pelos três campos, sem acento e sem diferenciar caixa', () => {
    expect(filterClients(base, 'catuai').map((c) => c.id)).toEqual(['b']);
    expect(filterClients(base, 'BY BEAGLE').map((c) => c.id)).toEqual(['b']);
    expect(filterClients(base, 'comercio de roupas').map((c) => c.id)).toEqual(['b']);
    expect(filterClients(base, '15.159.399/0002').map((c) => c.id)).toEqual(['b']);
    expect(filterClients(base, '151593990002').map((c) => c.id)).toEqual(['b']);
  });
  it('texto com dígito não casa CNPJ por acaso ("L2")', () => {
    expect(filterClients(base, 'l2').map((c) => c.id)).toEqual(['b']);
  });
  it('filtros específicos restringem o campo', () => {
    expect(filterClients(base, 'beagle', 'fantasia').map((c) => c.id)).toEqual(['b']);
    expect(filterClients(base, 'roupas', 'fantasia')).toEqual([]);
    expect(filterClients(base, 'roupas', 'razao').map((c) => c.id)).toEqual(['b']);
    expect(filterClients(base, 'catuai', 'razao')).toEqual([]);
    expect(filterClients(base, '55.666', 'cnpj').map((c) => c.id)).toEqual(['2']);
    expect(filterClients(base, 'beta', 'cnpj')).toEqual([]);
  });
  it('Pedido usa o seletor canônico (sem <select> gigante) e mantém o id do cliente', () => {
    const modal = readFileSync('components/proposta/CommercialProposalModal.tsx', 'utf8');
    expect(modal).toContain('<ClientSelector');
    expect(modal).toContain('onChange={setClienteId}');
    expect(modal).toContain('onCreate={openNewClient}');
    expect(modal).not.toContain('<select value={clienteId}');
    expect(modal).toContain("clienteId: selectedClient?.id || ''");
  });
});
