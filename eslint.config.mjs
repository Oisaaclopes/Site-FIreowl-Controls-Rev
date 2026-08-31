import { defineConfig } from "eslint/config";
import next from "eslint-config-next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig([
  // Edge Functions são Deno (imports por URL, Deno.serve) — fora do lint do Next.
  { ignores: ['supabase/**'] },
  {
    extends: [...next],
  },
]);
