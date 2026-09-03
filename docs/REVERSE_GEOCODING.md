# Reverse geocoding das batidas de ponto

A função Supabase `reverse-geocode` usa a **Google Geocoding API** exclusivamente no backend. A chave não deve ser adicionada ao `.env.local`, ao frontend ou ao Git.

## Configuração manual no Supabase

1. No Google Cloud, habilite somente a **Geocoding API** para o projeto da Fireowl.
2. Crie uma chave dedicada e aplique restrição de API para `Geocoding API`. Use as restrições de aplicação compatíveis com chamadas server-side definidas pela conta Google Cloud da empresa.
3. Cadastre o secret no projeto Supabase:

   `supabase secrets set GOOGLE_MAPS_GEOCODING_API_KEY=SUA_CHAVE`

4. Publique as funções alteradas:

   `supabase functions deploy reverse-geocode --no-verify-jwt`

   `supabase functions deploy create-user --no-verify-jwt`

5. Aplique a migration `0082_time_clock_participation_and_punch_address.sql` antes de publicar o frontend.

A batida é persistida antes do geocoding. A função recebe o `punchId`, valida o usuário, lê as coordenadas no banco e grava `time_punches.location_address`. Se já houver endereço, retorna o cache sem chamar o Google. No Dashboard, somente a última batida operacional relevante sem endereço é solicitada sob demanda; não há backfill histórico massivo.

Falha, indisponibilidade ou ausência da chave não invalida a batida. Enquanto houver coordenadas sem endereço, a interface mostra “Endereço sendo identificado”; lat/lng continuam disponíveis nos detalhes de auditoria.
