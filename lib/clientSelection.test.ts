import { describe, expect, it } from 'vitest';
import { Client } from './types';
import { clientDisplayName, filterClients } from './clientSelection';

const make = (id:string,name:string,cnpj:string):Client => ({id,name,cnpj,code:'',segment:'',contractStatus:'EM DIA',lastOSDate:'',lastOSType:'',address:'',contacts:[],totalContractsValue:0});
const clients=[make('1','Zeta Ltda. (Águia)','11.222.333/0001-44'),make('2','Beta Serviços (Beta)','55.666.777/0001-88'),make('3','Casa Alfa','99.000.111/0001-22')];

describe('seleção padronizada de clientes',()=>{
  it('ordena alfabeticamente pelo nome fantasia',()=>expect(filterClients(clients).map(clientDisplayName)).toEqual(['Águia','Beta','Casa Alfa']));
  it('busca por fantasia',()=>expect(filterClients(clients,'aguia').map(c=>c.id)).toEqual(['1']));
  it('busca por razão social',()=>expect(filterClients(clients,'zeta ltda').map(c=>c.id)).toEqual(['1']));
  it('busca por CNPJ com ou sem pontuação',()=>expect(filterClients(clients,'55666777000188').map(c=>c.id)).toEqual(['2']));
});
