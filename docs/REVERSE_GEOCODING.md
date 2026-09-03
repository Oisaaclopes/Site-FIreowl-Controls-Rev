# Reverse geocoding das batidas de ponto

A função Supabase `reverse-geocode` usa a **Geoapify Reverse Geocoding API** exclusivamente no backend. A chave não deve ser adicionada ao `.env.local`, ao frontend ou ao Git.

## Configuração manual no Supabase

1. Crie uma chave dedicada no Geoapify e aplique as restrições disponíveis adequadas ao uso server-side.
2. Cadastre o secret no projeto Supabase:

   `supabase secrets set GEOAPIFY_API_KEY=SUA_CHAVE`

3. Publique a função manualmente:

   `supabase functions deploy reverse-geocode --no-verify-jwt`

4. A migration `0082_time_clock_participation_and_punch_address.sql` deve estar aplicada antes da função.

A batida é persistida antes do geocoding. A função recebe o `punchId`, valida o usuário, lê `lat/lon` no banco, consulta `https://api.geoapify.com/v1/geocode/reverse`, usa preferencialmente `features[0].properties.formatted` e grava `time_punches.location_address`. Se já houver endereço, retorna o cache sem chamar o Geoapify. No Dashboard, somente a última batida operacional relevante sem endereço é solicitada sob demanda; não há backfill histórico massivo.

Resposta vazia, erro HTTP, erro informado pela API, timeout de 8 segundos, indisponibilidade ou ausência da chave não invalidam a batida. Enquanto houver coordenadas sem endereço, a interface mostra “Endereço sendo identificado”; lat/lng continuam disponíveis nos detalhes de auditoria.
