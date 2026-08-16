import { Supplier } from './types';
import {
  CatalogoProduto,
  INTELBRAS_VISION_SDAI,
  MARCA_PADRAO,
  FORNECEDOR_PADRAO,
  MARGEM_PADRAO,
} from './catalogoIntelbrasVision';
import { TECNOHOLD_SDAI, TECNOHOLD_MARCA, TECNOHOLD_FORNECEDOR, TECNOHOLD_MARGEM, TECNOHOLD_SUPPLIER } from './catalogoTecnohold';

/* Registro dos catálogos de produtos importáveis para o Estoque. Cada catálogo
 * vira um banner "Importar" no Estoque e, depois de importado, alimenta a lista
 * pré-pronta de dispositivos da preventiva. */

export interface CatalogoConfig {
  key: string;
  label: string; // rótulo curto (fornecedor/linha)
  brand: string;
  supplier: string;
  margem: number;
  categoria: string; // categoria macro do Estoque (ex.: 'SDAI')
  produtos: CatalogoProduto[];
  /** Se informado, o fornecedor é criado no módulo Fornecedores na importação. */
  supplierInfo?: Supplier;
}

export const PRODUCT_CATALOGS: CatalogoConfig[] = [
  {
    key: 'intelbras',
    label: 'Intelbras (Vision)',
    brand: MARCA_PADRAO,
    supplier: FORNECEDOR_PADRAO,
    margem: MARGEM_PADRAO,
    categoria: 'SDAI',
    produtos: INTELBRAS_VISION_SDAI,
  },
  {
    key: 'tecnohold',
    label: 'Tecnohold',
    brand: TECNOHOLD_MARCA,
    supplier: TECNOHOLD_FORNECEDOR,
    margem: TECNOHOLD_MARGEM,
    categoria: 'SDAI',
    produtos: TECNOHOLD_SDAI,
    supplierInfo: TECNOHOLD_SUPPLIER,
  },
];
