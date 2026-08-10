# Deferred Work

## Deferred from: code review of 1-1-fundacao-e-login-com-papel-fixo (2026-08-10)

- Sem comportamento `ON DELETE` declarado nas FKs [`api/src/main/resources/db/migration/V1__schema.sql`] — nenhuma feature de exclusão existe ainda; default `NO ACTION` do Postgres é seguro por ora. Revisitar quando uma feature de exclusão (ex.: organizador cancelando sessão) for desenhada.
- `papel` é `String` solta no back (sem enum) e o front confia num cast não validado (`as T` em `web/src/api/client.ts:39`) sem `default` no switch de `rotaPorPapel` [`api/src/main/java/br/com/rolo35/api/auth/Usuario.java`; `web/src/pages/LoginPage.tsx:8`] — endurecimento de type-safety maior que o escopo desta story; nada quebra hoje porque front e back nascem da mesma fonte de verdade. Revisitar se um novo papel for adicionado ou se a resposta da API divergir do tipo esperado.

## Deferred from: code review of 1-2-busca-de-filmes-via-proxy-tmdb (2026-08-10)

- `spring.http.clients.connect-timeout`/`read-timeout` são propriedades globais do Spring Boot — qualquer `RestClient`/`RestTemplate` autoconfigurado que vier a existir no projeto herda silenciosamente o timeout 5s/8s pensado pro TMDb [`api/src/main/resources/application.properties`]. Revisitar se uma segunda integração de API externa precisar de timeout diferente.
- `TmdbMovieResult` não valida `id`/`title` nulos vindos do TMDb, enquanto `posterPath`/`releaseDate` têm guarda explícita [`api/src/main/java/br/com/rolo35/api/sessoes/catalogo/TmdbClient.java:63-68`]. Contrato do TMDb pra esses dois campos é estável na prática; revisitar se algum filme real disparar `tmdbId: null` no front.
- AC 2 (chave TMDb nunca no bundle) não tem verificação automatizada/CI — só checagem manual feita uma vez nesta sessão (`grep` no bundle de produção). Considerar um passo de build+grep no CI se o projeto ganhar pipeline de CI.
- Pacote `sessoes.catalogo` não segue literalmente o padrão `controller/service/repository` que o CLAUDE.md lista como non-negotiable de camadas — decisão já registrada nos Dev Notes da Story 1.2, mas diverge do texto literal do non-negotiable. Revisitar se o CLAUDE.md for atualizado pra abrir exceção explícita a pacotes finos feito este.
- `docs/decisions.md` (entrada "RestClient injetado...") descreve a tentativa anterior como "antes do commit" — impreciso após a reconstrução do histórico em commits separados (a versão com dois construtores foi de fato commitada em `45dd91b`, revertida só no `refactor` seguinte). Ajuste de texto cosmético.
- `key={filme.tmdbId}` em `BuscaFilmesPage` assume unicidade de `tmdbId` no array de resultados, nunca verificada contra a resposta real do TMDb. Risco baixo; revisitar só se o React acusar warning de key duplicada em uso real.
