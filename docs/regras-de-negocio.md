# Regras de negócio implementadas

Levantamento do que está de fato codificado no back-end (`api/src/main/java`) e
no schema (`api/src/main/resources/db/migration`) na branch
`epic-3-reserva-de-assentos-cliente`, na data deste documento. Não é um
espelho das stories/epics — é o que existe em código, com o arquivo/linha de
origem pra cada regra. Regras descritas em stories mas ainda não
implementadas estão marcadas explicitamente como pendentes.

> Atualizar este arquivo sempre que uma regra nova entrar ou uma existente
> mudar de comportamento — ele não é gerado automaticamente.

## Autenticação e autorização (`auth`)

- **Papéis fixos**: `ORGANIZADOR`, `CLIENTE`, `PORTARIA`, via `CHECK` na coluna
  `usuarios.papel` (`V1__schema.sql:6`) — não existe papel livre.
- **Login por e-mail único**: `uk_usuarios_email` (`V1__schema.sql:8`).
- **Senha nunca comparada em texto puro**: hash BCrypt (`AuthService.java`,
  `SecurityConfig.passwordEncoder()`).
- **Tempo de resposta do login não vaza quais e-mails existem**: quando o
  e-mail não é encontrado, o login roda BCrypt contra um hash dummy antes de
  recusar, em vez de recusar na hora — evita side-channel por timing
  (`AuthService.java:15-19`, comentário explícito sobre a AC5).
- **JWT assinado (HMAC) com expiração**: claims `sub` (e-mail) e `papel`,
  `issuedAt`/`expiration` obrigatórios (`JwtService.java`).
- **Autorização é decidida por rota, não por token isolado**: autenticação
  (token válido) é checada no filtro; o papel é checado por
  `@PreAuthorize` em cada método de controller — uma rota nova sem anotação
  não herda permissão por esquecimento (`SecurityConfig.java:40-42`,
  comentário no código).
- **Superfície pública é allowlist explícita, não por prefixo amplo**:
  `POST /api/auth/login`, `GET /actuator/health`, `GET /api/sessoes` e
  `GET /api/sessoes/{id}/mapa-assentos` são as únicas rotas sem autenticação;
  o matcher do mapa de assentos é por path exato (`/api/sessoes/*/mapa-assentos`)
  para não vazar `GET /api/sessoes/{id}` (gestão, só ORGANIZADOR) nem
  `GET /api/sessoes/minhas` (`SecurityConfig.java:48-57`).
- **Toda outra rota exige autenticação** (`anyRequest().authenticated()`,
  `SecurityConfig.java:57-58`).

## Catálogo de filmes (`sessoes/catalogo`)

- **TMDb é proxied pelo back-end**: `FilmeController` chama `TmdbClient`
  internamente; o front nunca recebe a chave TMDb.
- **Busca exige `query` não vazio**: `ParametroInvalidoException` se vier
  em branco (`FilmeController.java:19-21`).
- **Indisponibilidade do TMDb é um erro de domínio próprio**, não repassa o
  erro cru do provedor (`CatalogoIndisponivelException`).

## Sessões (`sessoes`)

- **Capacidade da sessão vem do mapa de assentos real da sala**, não do
  retângulo `linhas × colunas` declarado — as duas fontes podem divergir; é
  o mapa (`assentos`) que determina quantos ingressos existem pra vender
  (`SessaoService.java:87-94`, comentário AC1).
- **Sala sem assento cadastrado não pode virar sessão**:
  `SalaSemAssentosException` (`SessaoService.java:91-93`).
- **Sessão não pode ser criada/editada com data/hora no passado**:
  `DataHoraNoPassadoException` (`SessaoService.java:71-73`, `:137-139`).
- **Sala não pode ter duas sessões sobrepostas**: buffer de **4h**
  (`BUFFER_MINUTOS = 240`) entre o início de uma sessão e o início da
  próxima na mesma sala, checado nos dois sentidos, na criação e na edição
  (`SessaoService.java:83-85`, `:147-149`; query em
  `SessaoRepository.java:19-40`). Buffer é intervalo **aberto**: sessão
  exatamente 4h depois não conflita (testado em
  `SessaoConflitoHorarioTest.aceitaSessaoExatamenteNaFronteiraDoBuffer`).
  - Garantida sob concorrência via lock pessimista (`SELECT ... FOR UPDATE`)
    na linha da **sala** antes de checar o conflito — duas criações
    simultâneas serializam, só uma vence
    (`SalaRepository.findByIdForUpdate`, `SessaoService.java:80-85`;
    provado por `SessaoConcorrenciaConflitoTest` com duas threads reais).
  - ⚠️ Essa garantia é só de aplicação (lock + query dentro da transação do
    service), **não** existe constraint de exclusão no banco
    (`EXCLUDE USING gist` ou similar) — qualquer escrita em `sessoes` que
    não passe por `SessaoService` não é protegida pelo schema.
  - `lock_timeout` de 3s setado antes do lock, pra falhar rápido em vez de
    travar a requisição indefinidamente se a linha da sala já estiver
    lockada (`SessaoService.java:80`, `:128`).
- **Edição de sessão é bloqueada por dono**: só o organizador que criou pode
  editar; checagem de ownership roda **antes** de qualquer validação de
  corpo, pra nunca vazar um 400 antes de confirmar quem é o dono (mesmo ID
  certo + corpo malformado ainda dá 403) —
  `SessaoNaoPertenceAoOrganizadorException`
  (`SessaoService.java:134-136`, comentário AC2).
- **Sessão com ingresso confirmado não pode mais ser editada**:
  `SessaoComIngressoConfirmadoException`, checado via
  `existeIngressoConfirmado` (`SessaoService.java:140-142`).
- **Troca de sala numa edição reconstrói o mapa de assentos do zero**
  (todas as linhas antigas de `assento_sessao` da sessão são apagadas e
  recriadas como `LIVRE` para a sala nova) — só é permitido porque o passo
  anterior já garantiu que não há ingresso confirmado, então nenhum estado
  de venda real se perde (`SessaoService.java:152-164`).
- **Listagem pública só traz sessões futuras** (`data_hora >= now()`,
  `SessaoRepository.listarPublicadas`) e marca esgotada quando
  `assentosLivres == 0` (`SessaoService.java:213-221`).
- **Hold de assento expira automaticamente por tempo, não por processo em
  background**: um assento `RESERVADO` cujo `expires_at` já passou é
  reportado como `LIVRE` no mapa de assentos, calculado on-read a cada
  chamada — não existe job que reescreve o status no banco
  (`SessaoService.statusEfetivo`, `SessaoService.java:246-251`).

## Modelagem / banco (`V1__schema.sql`)

- **Um assento não pode estar em dois estados ao mesmo tempo por sessão**:
  chave primária composta `(sessao_id, assento_id)` em `assento_sessao`
  (`V1__schema.sql:60`) — um assento só existe uma vez por sessão, o status
  (`LIVRE`/`RESERVADO`/`VENDIDO`) é campo único dessa linha, não múltiplas
  linhas concorrentes.
- **Posição de assento é única dentro da sala**:
  `uk_assentos_sala_posicao (sala_id, fileira, numero)` (`V1__schema.sql:25`).
- **Status de domínio restritos por `CHECK`, não só validação de aplicação**:
  `usuarios.papel`, `reservas.status` (`ATIVA`/`CONFIRMADA`/`RECUSADA`),
  `assento_sessao.status`, `ingressos.status` (`VALIDO`/`UTILIZADO`)
  (`V1__schema.sql:6,49,57,68`).
- **Índices nos caminhos de busca/join das telas**: `usuarios.email`,
  `sessoes.data_hora`, `sessoes.sala_id`, e o composto
  `sessoes (sala_id, data_hora)` (`V3__indice_sessoes_sala_data_hora.sql`)
  que serve exatamente a query de conflito de horário acima.

## Pendente (schema existe, regra de serviço ainda não implementada)

As tabelas `reservas` e `ingressos` já existem no schema
(`V1__schema.sql:45-71`) mas não há `Service`/`Controller` para elas ainda
neste checkout — as regras abaixo estão descritas nas stories
(`_bmad-output/implementation-artifacts/3-2-*`, `4-1-*`, `4-2-*`) mas **não
estão em código**:

- Hold temporário de assento na reserva (criação de `RESERVADO` + `expires_at`).
- Pagamento simulado (aprovação/recusa determinística).
- Emissão de ingresso com código assinado (HMAC/JWT) — não forjável por
  incremento de ID.
- Garantia de não vender o mesmo assento duas vezes / não validar o mesmo
  ingresso duas vezes sob concorrência real (constraint/lock).
- Link público de compartilhamento de ingresso (somente leitura, sem
  vazar dado de outro usuário, sem bypass de validação de portaria).
- Validação de ingresso na portaria (papel `PORTARIA`).

Este documento cobre só o que existe hoje; ao implementar cada item acima,
mover a entrada correspondente para a seção do módulo e apagar daqui.
