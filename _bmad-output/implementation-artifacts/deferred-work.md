# Deferred Work

## Deferred from: code review of 1-1-fundacao-e-login-com-papel-fixo (2026-08-10)

- Sem comportamento `ON DELETE` declarado nas FKs [`api/src/main/resources/db/migration/V1__schema.sql`] — nenhuma feature de exclusão existe ainda; default `NO ACTION` do Postgres é seguro por ora. Revisitar quando uma feature de exclusão (ex.: organizador cancelando sessão) for desenhada.
- `papel` é `String` solta no back (sem enum) e o front confia num cast não validado (`as T` em `web/src/api/client.ts:39`) sem `default` no switch de `rotaPorPapel` [`api/src/main/java/br/com/rolo35/api/auth/Usuario.java`; `web/src/pages/LoginPage.tsx:8`] — endurecimento de type-safety maior que o escopo desta story; nada quebra hoje porque front e back nascem da mesma fonte de verdade. Revisitar se um novo papel for adicionado ou se a resposta da API divergir do tipo esperado.
