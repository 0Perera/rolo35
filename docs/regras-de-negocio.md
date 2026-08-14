# Regras de negócio implementadas

Levantamento do que está de fato codificado no back-end (`api/src/main/java`) e
no schema (`api/src/main/resources/db/migration`), na data deste documento —
já cobre os épicos 4 e 5 (pagamento/ingressos e portaria). Não é um
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
- **E-mail é normalizado antes do lookup**: `trim()` + `toLowerCase(Locale.ROOT)` no
  service (`AuthService.java`) — `=` no Postgres é case-sensitive e o seed grava
  minúsculo, então sem isso um teclado de celular que capitaliza a primeira letra
  derruba o login como "credencial inválida". `Locale.ROOT` de propósito: em turco
  `"I".toLowerCase()` vira `ı` e quebraria e-mail com I maiúsculo.
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
  `POST /api/auth/login`, `POST /api/auth/cadastro`, `GET /actuator/health`,
  `GET /api/sessoes` e `GET /api/sessoes/{id}/mapa-assentos` são as rotas sem
  autenticação (`POST /api/auth/cadastro` é público porque quem cria conta ainda
  não tem token, e a Story 1.3 decidiu não gatear a escolha de papel);
  o matcher do mapa de assentos é por path exato (`/api/sessoes/*/mapa-assentos`)
  para não vazar `GET /api/sessoes/{id}` (gestão, só ORGANIZADOR) nem
  `GET /api/sessoes/gestao` (`SecurityConfig.java:48-57`).
- **Toda outra rota exige autenticação** (`anyRequest().authenticated()`,
  `SecurityConfig.java:57-58`).
- **`POST /api/auth/cadastro` tem teto por endereço de origem**: 5 tentativas por
  hora, configuráveis por `CADASTRO_LIMITE_TENTATIVAS` e
  `CADASTRO_LIMITE_JANELA_MINUTOS`; ao estourar, `429 LIMITE_DE_CADASTRO_EXCEDIDO`
  (`LimitadorDeCadastro`). É a única rota pública que escreve, e escreve conta com
  o papel que o corpo pedir — as demais são de leitura. O teto conta só tentativas
  que passaram do `@Valid`, para que errar o formulário não gaste a cota de quem
  nunca criou nada. **Não é fronteira de segurança**: o endereço vem de
  `X-Forwarded-For` (falsificável por quem alcança a API direto), quem dispõe de
  muitos endereços passa por cima, e a contagem vive na memória de um processo só
  — reiniciar a API zera, e duas instâncias contam separado.

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
- **Edição de sessão não é bloqueada por dono** (CAP-1): qualquer `ORGANIZADOR`
  autenticado edita qualquer sessão, porque a sessão é recurso do cinema e a
  equipe de organizadores é compartilhada. O que a edição ainda exige é que a
  conta do token exista (`OrganizadorNaoEncontradoException`, `SessaoService.java:130`)
  — um JWT válido de usuário já removido não edita nada. `sessoes.organizador_id`
  continua registrando quem criou, e é essa autoria (não quem editou) que volta
  na resposta. A regra anterior, com `SessaoNaoPertenceAoOrganizadorException`
  checada antes de validar o corpo, foi **removida**; a exceção não existe mais.
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

## Reservas (`reservas`)

- **Seleção de 1 a 6 assentos, sem duplicados**, validada **antes** de qualquer
  lock — a transação que segura linhas de `assento_sessao` precisa ser a mais
  curta possível (`ReservaService.java:29`, `:50-54`).
- **Sessão que já começou não pode receber nova reserva** (FR-10):
  `SessaoJaComecouException`, checado contra `sessaoRepository.jaComecou(...)`
  antes do lock — a vitrine só lista sessão futura, mas uma aba aberta há uma
  hora não sabe disso (`ReservaService.java:68-73`).
- **A seleção já cria o hold**: os assentos vão para `RESERVADO` com
  `expires_at = now() + 10min` e `reserva_id` preenchido; a `Reserva` nasce
  `ATIVA` com o mesmo `expires_at` (`ReservaService.java:30`, `:78-82`).
- **Reserva de múltiplos assentos é atômica**: se qualquer assento pedido não
  estiver efetivamente livre, nada é reservado (`AssentoIndisponivelException`,
  `ReservaService.java:72-76`); e o `UPDATE` de reivindicação devolve o número
  de linhas afetadas — divergir da quantidade pedida também aborta
  (`ReservaService.java:83-85`).
- **Lock pessimista ordenado por `assento_id`** (`SELECT ... FOR UPDATE`): a
  ordenação é o mecanismo que evita deadlock entre duas reservas concorrentes
  que pedem os mesmos assentos em ordem diferente — não é estética
  (`AssentoSessaoRepository.travarParaReserva`, `:17-26`; provado por
  `ReservaConcorrenciaConflitoTest` com threads reais).
- **`lock_timeout` de 3s por transação** (`SET LOCAL`), e o estouro dele é uma
  exceção **distinta** de indisponibilidade: `AssentoEmDisputaException`
  (409 `ASSENTO_EM_DISPUTA`) significa "não deu pra confirmar a tempo", e o
  cliente pode repetir com os mesmos assentos (`ReservaService.java:59`,
  `:63-69`).
- **TTL do hold é resolvido na leitura, não por job**: um `RESERVADO` com
  `expires_at` vencido conta como livre na checagem de disponibilidade
  (`ReservaService.statusEfetivoLivre`, `:92-97`) e o `UPDATE` de reivindicação
  aceita explicitamente essa condição no `WHERE`
  (`AssentoSessaoRepository.reivindicar`, `:51-58`).
- **Defesa em profundidade no `UPDATE`**: `reivindicar` repete a condição de
  status/`expires_at` no `WHERE` e devolve linhas afetadas, mesmo o service já
  tendo checado — um call site futuro que pule a checagem não sobrescreve
  assento vendido em silêncio (`AssentoSessaoRepository.java:41-58`).

### Leitura da reserva para o checkout (Story 4.3)

- **`GET /api/reservas/{id}` é a única leitura de reserva sem lock**: devolve
  `ReservaCheckoutDto` (sessão, sala, data/hora, preço, assentos por fileira+número,
  `status`, `expiresAt`) para a tela de pagamento se reconstruir sozinha depois de um
  F5 — ler para exibir não disputa recurso com quem está pagando
  (`ReservaService.buscarParaCheckout`, `ReservaController:35-40`).
- **Reserva de outro cliente e `reservaId` inexistente devolvem o mesmo `403`**
  também nessa rota — mesma regra do pagamento, a rota não vira oráculo de existência.
- **Sem N+1**: assentos da reserva vêm por projection numa query só
  (`ReservaCheckoutProjection`, `AssentoSessaoRepository.buscarAssentosDaReserva`),
  com índice em `assento_sessao.reserva_id`
  (`V5__indice_assento_sessao_reserva.sql`) porque a coluna passou a ser critério de
  busca de produção, não só campo gravado.

## Pagamento simulado (`pagamentos`)

- **Resultado é parâmetro do corpo**, não de query string:
  `resultadoSimulado ∈ {APROVADO, RECUSADO}`
  (`ConfirmarPagamentoRequest`, `ResultadoSimulado`).
- **Só o dono da reserva confirma**, e "reserva de outro cliente" e "reserva
  inexistente" caem na **mesma** exceção/resposta (403 `NAO_AUTORIZADO`) — por
  design, pra rota não virar oráculo de existência de `reservaId`
  (`PagamentoService.java:60-64`).
- **Lock pessimista na linha da `Reserva`** antes de decidir qualquer coisa
  (`ReservaRepository.findByIdForUpdate`, `PagamentoService.java:62`), com o
  mesmo `lock_timeout` de 3s e exceção própria pro estouro
  (`ReservaEmDisputaException`, 409 `RESERVA_EM_DISPUTA`,
  `PagamentoService.java:57`, `:65-72`).
- **Idempotência**: reserva que não está mais `ATIVA` devolve `200` com o
  estado já persistido (e os ingressos, se `CONFIRMADA`), sem reprocessar o
  `resultadoSimulado` — duas confirmações concorrentes não emitem ingresso
  duplicado (`PagamentoService.java:74-78`, `:113-118`; provado por
  `PagamentoConcorrenciaConflitanteTest`).
- **Reserva expirada é recusada** (409 `RESERVA_EXPIRADA`), checada depois do
  lock, contra `now()` (`PagamentoService.java:79-81`).
- **Sessão que já começou não pode ser paga** (FR-12): `SessaoJaComecouException`,
  checada depois da idempotência (quem já confirmou continua recuperando os
  ingressos) e depois da expiração — um hold ainda dentro dos 10 minutos não
  basta se a sessão já começou nesse meio-tempo (`PagamentoService.java:86-92`).
- **Aprovado**: `Reserva` vira `CONFIRMADA`, sai **um ingresso por assento**
  (`StatusIngresso.VALIDO`) e os assentos viram `VENDIDO` — estado final, não
  expira (`PagamentoService.java:88-101`).
- **Recusado**: `Reserva` vira `RECUSADA` e os assentos são liberados
  **imediatamente** (`LIVRE`, `reserva_id`/`expires_at` limpos), sem esperar o
  TTL — decisão explícita, este caminho é escrita imediata
  (`PagamentoService.java:104-110`, `AssentoSessaoRepository.liberar`, `:82-91`).
- **Os dois `UPDATE`s de escrita filtram por `reserva_id`** e conferem o número
  de linhas afetadas: um `assentoIds` calculado errado em call site futuro não
  sobrescreve assento de outra reserva
  (`AssentoSessaoRepository.reivindicarVendido`, `liberar`).

## Ingressos (`ingressos`)

- **Código do ingresso é `UUID` + assinatura HMAC-SHA256**, no formato
  `<uuid>.<base64url-da-assinatura>` — não é ID adivinhável nem incrementável
  (`CodigoIngressoService.gerar`, `:32-34`; `ingressos.id` é UUID no schema).
- **Secret do ingresso é próprio e obrigatório**: `TICKET_HMAC_SECRET`, distinto
  do `JWT_SECRET`, sem fallback — o boot falha se vier em branco, em vez de
  assinar com chave degenerada (`CodigoIngressoService.java:21-30`).
- **Validação recomputa a assinatura** e compara com `MessageDigest.isEqual`
  (comparação em tempo constante); base64 malformado é rejeitado sem exceção
  vazando (`CodigoIngressoService.validar`, `:36-49`).
- **"Meus ingressos" é filtrado por dono no banco**, via `reservas.cliente_id`,
  numa query só com `JOIN` de assento/sessão/sala (sem N+1), ordenada pela
  compra (`ingressos.created_at DESC`) e desempatada por `id DESC` — a carteira
  é histórico de compra, não agenda: quem sai do pagamento acha o ingresso novo
  na primeira linha, mesmo que a sessão dele seja anterior à de uma compra velha
  (`IngressoRepository.buscarPorCliente`, `:17-29`;
  `IngressoService.listarMinhas`, `:41-50`). Índices em
  `V4__indices_ingressos_por_cliente.sql`.
- **Rota pública valida a assinatura ANTES de tocar o banco**: código com HMAC
  inválido nunca chega ao repositório — evita usar a rota como oráculo pra
  diferenciar "não existe" de "assinatura errada"
  (`IngressoService.buscarPublico`, `:55-64`).
- **"Não existe" e "assinatura inválida" devolvem a mesma resposta**
  (404 `INGRESSO_NAO_ENCONTRADO`), pelo mesmo motivo
  (`GlobalExceptionHandler`, handler de `IngressoNaoEncontradoException`).
- **Link público expõe só filme, sala, horário, status e o código curto** — nada do
  comprador (`IngressoPublicoDto`). O código curto vai junto porque quem recebeu o
  link é quem vai entrar na sala, e sem ele a página não tem o que ditar na portaria
  se a câmera falhar; não é exposição nova, já que a própria URL carrega o código
  assinado, que a portaria também aceita.
- **QR é gerado no front a partir do código assinado**, não por endpoint de imagem
  da API (`qrcode.react` em `components/CanhotoIngresso.tsx`). Ele carrega o código
  em si, **não uma URL** — apontar a câmera do celular pra ele mostra texto, não abre
  página. A URL pública é outra coisa: montada num único lugar
  (`web/src/lib/ingressos.ts`), serve só ao botão de compartilhar, pra que o link da
  carteira e o da página pública nunca divirjam. `ContratoQrPortaria.test.tsx` existe
  pra vigiar exatamente essa confusão, que já virou bug uma vez.
- **O canhoto imprime só o código curto**: o assinado não aparece em tela nenhuma —
  vive dentro do QR e na URL do link público. O botão de copiar entrega o curto, que
  é o formato que alguém consegue transcrever e ditar.
- **Nenhum dado de cartão trafega ou é persistido**: o corpo de
  `POST /api/pagamentos/confirmar` aceita só `{reservaId, resultadoSimulado}`; os
  campos do checkout são validados no cliente (`web/src/lib/cartao.ts`) e descartados.
- **Leitura pública não muta estado**: `buscarPublico()` não marca o ingresso
  como utilizado nem consome nada; a portaria é o único caminho de consumo
  (provado explicitamente em `IngressoServiceTest`).

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
- **Ingresso aponta pra uma linha real do mapa da sessão**: FK composta
  `fk_ingressos_assento_sessao (sessao_id, assento_id)` contra `assento_sessao`
  (`V8__backstops_ingressos.sql`) — as FKs simples de `sessao_id` e `assento_id`
  isoladas não bastavam, pois cada uma valida sua coluna sem impedir um assento
  de outra sala num ingresso de sessão diferente.
- **Uma reserva não emite dois ingressos pro mesmo assento**:
  `uq_ingressos_reserva_assento UNIQUE (reserva_id, assento_id)`
  (`V8__backstops_ingressos.sql`) — backstop de banco pro mesmo invariante que
  `PagamentoService.confirmar()` já garante por construção.

## Portaria (épico 5, implementado)

`PortariaService`/`PortariaController` existem neste checkout, com as regras
abaixo:

- Seleção da sessão do turno pela portaria (`turno_portaria`, uma linha por
  usuário, PK `usuario_id` — reselecionar é update na mesma linha); validação
  sem sessão selecionada recusada com `409 SESSAO_ATIVA_NAO_SELECIONADA`.
- Retorno inequívoco da validação (`VALIDO` / `INVALIDO` / `JA_UTILIZADO` /
  `EVENTO_ERRADO`) como `200` + campo `resultado`, com sessão checada antes do
  status.
- **Dois formatos aceitos, um caminho** (`PortariaService.localizar`): texto na
  forma `uuid.assinatura` tem a HMAC conferida e é buscado por id; qualquer outra
  coisa é normalizada como código curto de 8 caracteres e resolvida por
  `findByCodigoCurtoForUpdate`. Daí em diante o fluxo é idêntico. A leitura por
  câmera usa o primeiro; a digitação manual, na prática, o segundo — é o que está
  impresso no canhoto.
- Formato recusado **antes** de qualquer consulta ou lock, nos dois caminhos:
  assinatura inválida e código curto fora do alfabeto param na mesma porta, sem
  chegar a segurar uma linha de `ingressos`.
- Todo motivo de falha vira o mesmo `INVALIDO` — formato, assinatura adulterada,
  código inexistente. A resposta não pode virar oráculo de quais códigos existem.
- Não-validação-duplicada do mesmo ingresso sob concorrência real: lock
  pessimista em `ingressos` (`findByIdForUpdate` / `findByCodigoCurtoForUpdate` +
  `SET LOCAL lock_timeout`), provado por `PortariaValidacaoConcorrenciaTest` com
  duas threads contra Postgres real — exatamente uma responde `VALIDO`.
- O QR do ingresso carrega o **código assinado** (`uuid.assinatura`), que é um dos
  dois payloads que a validação aceita — não o link público, que serve o botão de
  compartilhar. A travessia entre as duas pontas é coberta por
  `web/src/pages/ContratoQrPortaria.test.tsx`.

- Janela operacional do turno: `POST /api/portaria/turno` só aceita sessão cujo
  `data_hora` esteja entre 2h no passado e 30min no futuro a partir de agora —
  fora disso, `409 SESSAO_FORA_DA_JANELA_DO_TURNO`. Existe porque a sessão ativa
  é o que separa `VALIDO` de `EVENTO_ERRADO`: ativar por engano a sessão de
  outro dia faz a fila inteira ser recusada com ingresso legítimo na mão. As
  constantes são próprias (`JANELA_TURNO_ANTES_MINUTOS` /
  `JANELA_TURNO_DEPOIS_HORAS`), separadas do buffer de 4h do conflito de sala —
  conceitos diferentes. A tela repete o motivo da recusa em
  `SelecaoTurnoPortariaPage`, senão o operador tenta a mesma sessão pra sempre.

Os achados de revisão adversarial sobre as regras **já implementadas** estão em
`_bmad-output/implementation-artifacts/business-rules-gaps.md`. Todos foram
fechados, com uma exceção declarada: **não existe estratégia de rotação do
secret HMAC** (AD-8). Se o secret precisar trocar, todo ingresso já emitido —
inclusive link público, que não expira — vira inválido de uma vez, sem janela de
migração. O fix correto (secret versionado com validação dupla durante a
transição) não coube no prazo; a limitação está declarada também no README.

Este documento cobre só o que existe hoje; ao fechar um item, mover a entrada
correspondente para a seção do módulo e apagar daqui.
