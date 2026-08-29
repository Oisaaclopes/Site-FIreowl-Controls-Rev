import { SDAI_TECHNICAL_SEED } from './sdai';
import { SECURITY_TECHNICAL_SEED } from './security';
import { AUTOMATION_TECHNICAL_SEED } from './automation';
export { normalizedCatalogKey } from './types';
export const TECHNICAL_CATALOG_SEED = [...SDAI_TECHNICAL_SEED, ...SECURITY_TECHNICAL_SEED, ...AUTOMATION_TECHNICAL_SEED];
