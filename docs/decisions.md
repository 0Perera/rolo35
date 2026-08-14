# Registro de decisões — Rolo 35

Log leve de decisões não-triviais tomadas durante a implementação. Alimenta as
seções de Uso de IA e Decisões técnicas do README final.

---

## [exemplo] Nome curto da decisão

- **Decisão**: o que foi decidido.
- **Por quê**: motivo ou trade-off considerado.

---

## Escopo de um único cinema, não plataforma multi-local

- **Decisão**: o projeto modela um cinema único com várias salas, não uma plataforma multi-tenant com vários cinemas/endereços. "Local" (atributo pedido no enunciado) é representado pela sala escolhida na criação da sessão — não existe entidade `cinema` nem campo de endereço em nenhuma tabela. Salas são um pool compartilhado entre todos os organizadores, sem conceito de posse.
- **Por quê**: o enunciado pede que o organizador defina "local" por evento e que a listagem mostre "local" — isso é satisfeito literalmente pela sala (nome exibido em toda listagem pública e de gestão), sem precisar de endereço textual ou de múltiplas unidades: nada no enunciado do desafio pede múltiplos locais. Modelar multi-cinema abriria uma segunda dimensão de autorização (organizador × cinema × sala) sem agregar valor real ao que foi pedido — só multiplicaria a superfície de bugs de ownership numa área que já exige cuidado (FR-2, organizador só gerencia sessão própria). É a mesma filosofia das outras simplificações já assumidas no projeto (buffer fixo de horário, sem rate limiting): resolver o problema pedido, não generalizar pra um caso não solicitado. Do ponto de vista de produto, um cinema de bairro com várias salas é um negócio completo por si só — multi-local é expansão de um produto validado, não parte do MVP que prova o conceito.

---

## Catálogo único — TMDb

- **Decisão**: usar só TMDb como fonte de catálogo, descartando Ticketmaster e a opção de integrar os dois.
- **Por quê**: preferência criativa — cinema como domínio permite mais refinamento dada a simplicidade, tem menor tempo de integração, e força modelagem própria (sessão, sala, assento, preço) em vez de herdar conceito pronto de API de eventos genérica, dando mais controle sobre o domínio.

---

## Mapa de assentos de cinema, não pista

- **Decisão**: reserva por mapa de assentos de cinema, descartando pista/quantidade e a opção de implementar os dois modelos.
- **Por quê**: é o ponto de maior complexidade de engenharia do projeto — exige modelagem de concorrência real (lock por assento individual) em vez de só decrementar um contador, o que faz mais sentido dentro do escopo cinema-only do projeto; implementar os dois modelos arriscava estourar o prazo de 7 dias.

---

## Java + Spring Boot

- **Decisão**: back-end em Java + Spring Boot, descartando Node e Python.
- **Por quê**: decisão segura — familiaridade prévia com Spring e Java, aceitando o trade-off de mais boilerplate que Node ou Python.

---

## `turno_portaria` como tabela própria, não coluna em `usuarios`

- **Decisão**: o ponteiro "sessão ativa do turno da portaria" (Story 5.1) vive numa tabela própria (`turno_portaria`, PK = `usuario_id`, sem entidade de domínio rica), não como coluna `sessao_ativa_id` em `usuarios`.
- **Por quê**: a arquitetura já registra `usuarios` como "uma tabela pros três papéis... nenhum papel tem campo próprio que justifique split". Uma coluna preenchida só por linhas `papel = PORTARIA` seria exatamente esse split. Tabela própria resolve sem contradizer a decisão já tomada, e ausência de linha vira o estado natural "nenhuma sessão selecionada ainda" — sem precisar de coluna nullable.

---

## Seleção de sessão do turno reaproveita a listagem pública, sem endpoint dedicado

- **Decisão**: a tela de seleção de sessão da portaria (Story 5.1) reaproveita `GET /api/sessoes` (`listarSessoesPublicadas()`), a mesma listagem da home, em vez de uma rota nova de "sessões disponíveis pra portaria".
- **Por quê**: simplificação consciente dentro do prazo de 7 dias. Isso traz junto o filtro `data_hora >= now()` já existente no repository — a portaria escolhe entre sessões futuras/em andamento no sentido de "ainda não passaram da lista pública", não uma janela mais estrita de "sessão rolando agora". Nenhum FR pede uma janela mais precisa.

---

## `PortariaService.obterSessaoAtivaOuLancar()` nasce na Story 5.1 para a Story 5.2 reusar

- **Decisão**: `obterSessaoAtivaOuLancar()` devolve a entidade `Sessao` (não o DTO) e lança `SessaoAtivaNaoSelecionadaException` quando a portaria não tem turno selecionado. Ele já existe e é exercitado ponta a ponta hoje via `GET /api/portaria/turno`, embora a validação de ingresso em si (que vai chamá-lo) só chegue na próxima story.
- **Por quê**: não é código especulativo — é o mecanismo de bloqueio que a AC1 desta story pede ("operação bloqueada sem sessão selecionada"), e a validação de ingresso da próxima story precisa exatamente desse primitivo antes de tocar em qualquer `Ingresso`, para não reimplementar a mesma checagem em dois lugares.

---

## Vite + React puro em vez de Next.js

- **Decisão**: front-end em Vite + React puro (SPA).
- **Por quê**: Next.js não se justifica pra baixa complexidade do projeto (SPA sem necessidade de SSR/rotas de servidor); Vite + React reduz a superfície mantendo o React exigido pelos requisitos do projeto.

---

## PostgreSQL + Flyway

- **Decisão**: Postgres como banco, Flyway pra migrations.
- **Por quê**: familiaridade e experiência prévia com ambos.

---

## Pagamento simulado por endpoint interno, sem sandbox real

- **Decisão**: endpoint interno determinístico, sem integrar sandbox de provedor real (Stripe test mode etc.), apesar dos requisitos permitirem.
- **Por quê**: economia de tempo no prazo de 7 dias — integrar sandbox real consome tempo que não se justifica agora. Candidato pra v2/v3, fora do escopo atual.

---

## JWT para autenticação

- **Decisão**: autenticação via JWT.
- **Por quê**: o papel de portaria sugere um cliente potencialmente separado (app/dispositivo dedicado na entrada); JWT se encaixa melhor nesse contexto que sessão/cookie, que pressupõe navegador único e mesmo domínio.

---

## Link de compartilhamento público sem login

- **Decisão**: link do ingresso é público, somente leitura, sem exigir login.
- **Por quê**: fidelidade literal ao requisito documentado; o risco extra de exposição pública é compensado pela regra de segurança contra uso duplicado do ingresso (lock/constraint) — o link não abre via de bypass.

---

## ~~Deploy Render + Vercel, aceitando limitação de free tier~~ — revogada pelo CAP-6

> **Revogada.** A Vercel saiu do plano de deploy: o `render.yaml` sobe os três serviços numa conta
> só. Ver "Deploy inteiro no Render por blueprint, em vez de API no Render + front na Vercel
> (CAP-6)" mais abaixo.

- **Decisão**: API no Render (free), front na Vercel; limitação documentada no README.
- **Por quê**: risco aceito conscientemente — mitigado no README, com possibilidade de upgrade pro plano pago do Render se necessário pra evitar cold start; Docker Compose cobrindo a aplicação inteira garante caminho alternativo de "sobe com um comando" se o deploy falhar.

---

## Identidade visual cinema 35mm anos 80/90

- **Decisão**: tema clássico de cinema anos 80/90 — paleta sépia/âmbar, vermelho veludo, dourado, tipografia marquise, perfuração de película como moldura.
- **Por quê**: gosto pessoal pela estética clássica de cinema da época; inspirou inclusive o nome do projeto ("rolo35", referência ao rolo de película 35mm).

---

## Estratégia de teste por camada, não Testcontainers universal

- **Decisão**: unitário / `@WebMvcTest` / Testcontainers restrito aos dois cenários de concorrência — não Testcontainers cobrindo tudo.
- **Por quê**: a ideia inicial era Testcontainers pra aplicação inteira, evitando bugs de produção no deploy; com o prazo curto, a divisão atual prioriza cobertura robusta nas partes críticas (concorrência) e cobertura mais simples nas de baixo risco. Se sobrar tempo, cobertura mais ampla continua sendo meta do projeto.

---

## Edição de sessão trava todos os campos após venda, sem exceção

- **Decisão**: sessão com ≥1 ingresso confirmado bloqueia edição de todos os campos — data, sala/capacidade, preço, título e sinopse — sem carve-out. Revisa uma decisão anterior do brief que deixava título/sinopse editáveis mesmo pós-venda.
- **Por quê**: título e sinopse vêm do catálogo TMDb, não de digitação livre do organizador — não existe cenário de "corrigir erro de digitação" que justifique deixá-los abertos. Permitir a troca depois da venda abriria uma brecha de fraude: vender ingresso pra um filme e substituir por outro depois que o cliente já pagou.

---

## Cadastro só obrigatório no momento da compra

- **Decisão**: cliente explora o catálogo de sessões e o mapa de assentos sem login; cadastro/autenticação como `CLIENTE` só é exigido ao reservar assento.
- **Por quê**: reduz fricção de descoberta — cliente vê disponibilidade real antes de decidir se cadastra. Nada sensível é exposto na exploração pública (sessão, sala, preço, disponibilidade de assento não são dado de outro usuário), e é o padrão de mercado (ingresso.com, eventim permitem navegação sem conta).

---

## Nenhum stretch priorizado — foco total no V1

- **Decisão**: dos três candidatos a stretch listados no brief (painel do organizador além do CRUD básico, busca/filtro avançado de eventos, mapa de assentos em tempo real via WebSocket), nenhum é priorizado agora. Ficam registrados como candidatos, sem compromisso de tempo.
- **Por quê**: com ~5 dias restantes no momento da decisão e a fatia vertical completa como prioridade central do projeto, qualquer tempo gasto em stretch antes do V1 rodar ponta a ponta e testado é risco de prazo não justificado — especialmente o WebSocket, que é o mais custoso e o de maior risco de estourar o cronograma.

---

## Fluxo de reserva: seleção do assento já é o hold, conflito volta ao mapa

- **Decisão**: selecionar um assento no mapa já cria o hold temporário de 10 minutos (não é uma etapa de "carrinho" separada da reserva). O mapa distingue três estados por assento — livre, reservado temporariamente, vendido/pago. Se dois clientes disputam o mesmo assento, quem perde a corrida recebe um erro claro e volta ao mapa de assentos da mesma sessão (não reinicia da escolha de sessão).
- **Por quê**: sem sincronização em tempo real no V1 (WebSocket é stretch não priorizado), o conflito de concorrência é inevitável na interface — o comportamento precisa ser explícito pra não virar bug de UX descoberto tarde. Manter o cliente na mesma sessão, só atualizando o mapa, é mais barato de implementar que preservar contexto de carrinho e menos confuso que reiniciar o fluxo inteiro.

---

## Empacotamento por domínio, não por camada técnica

- **Decisão**: pacotes Java organizados por domínio primeiro (`sessoes`, `reservas`, `pagamentos`, `ingressos`, `auth`), cada um contendo suas próprias camadas `controller/service/repository` — não um pacote `controller`/`service`/`repository` único guardando classes de todos os domínios. Camadas dentro de cada pacote de domínio seguem o non-negotiable já fixado nas instruções do projeto (controller → service → repository, sem regra de negócio no controller). Direção de dependência entre pacotes: `{pagamentos, ingressos} → reservas → sessoes → auth` (`A → B` = "A depende de B") — `auth` não depende de nenhum outro domínio, `pagamentos` depende de `reservas` (precisa travar/ler `Reserva` na confirmação de pagamento), `ingressos` depende de `reservas` e `pagamentos` — nunca o inverso.
- **Por quê**: com 6+ entidades caindo em ~5 áreas de domínio bem distintas e a prática de fatia vertical por feature (XP/TDD do projeto), empacotar por domínio mantém uma feature inteira dentro de um diretório — commits ficam localizados, revisão fica mais fácil, e reduz o risco de uma mudança de feature espalhar por três pacotes técnicos dispersos. A direção de dependência fixada evita que dois pacotes de domínio construídos em momentos diferentes acabem se importando um ao outro em ciclo.

---

## Camada `api/` dedicada no front, sem fetch direto em componente

- **Decisão**: SPA React acessa o back-end só através de uma camada `api/` própria — um módulo por domínio (`api/sessoes.ts`, `api/reservas.ts`, `api/pagamentos.ts`, `api/ingressos.ts`, `api/auth.ts`) exportando funções tipadas que encapsulam o `fetch`. Componente nunca chama `fetch` direto.
- **Por quê**: TypeScript estrito é non-negotiable das instruções do projeto — fetch espalhado por componente arrisca cada tela inventar sua própria forma de tipar a resposta. Além disso, a camada central é o lugar natural pra anexar o JWT condicionalmente (rotas públicas vs autenticadas) e parsear o envelope de erro do back-end uma vez só, reaproveitado por toda tela — o que sustenta o NFR de loading/vazio/erro tratados em toda tela que busca dado. Espelha, um nível acima, a regra já fixada de que o back-end é fronteira exclusiva pro TMDb.

---

## Disponibilidade de assento: linha pré-criada por sessão + lock pessimista, TTL lazy

- **Decisão**: ao criar uma sessão, popula-se `assento_sessao` com uma linha por assento da sala (`status=LIVRE`), na mesma transação do insert da sessão — não "ausência de linha = livre". Reservar assentos adquire `SELECT ... FOR UPDATE` nas linhas pedidas (ordenadas por `assento_id`, evita deadlock entre reservas concorrentes) dentro de uma transação curta (sem chamada externa, com `lock_timeout` próprio); se qualquer assento não está disponível, a reserva inteira falha, sem hold parcial. TTL de 10 minutos não tem job agendado: todo lugar que lê ou escreve o estado de um assento calcula o status *efetivo* a partir de `expires_at` (um `RESERVADO` vencido é tratado como livre), nunca confiando no valor bruto da coluna.
- **Por quê**: FR-11 exige lock/constraint de banco, não checagem de aplicação — lock pessimista via `SELECT FOR UPDATE` é o padrão mais idiomático dado que o projeto já usa Spring Data JPA (evita cair pra SQL nativo de um UPSERT). Job agendado pra expirar reserva foi descartado porque o Render free dorme após 15min sem tráfego (o job não rodaria durante o sono) e o V1 não tem WebSocket/sync ao vivo — outro cliente só vê o estado atualizado ao consultar de novo, momento em que o cálculo lazy já resolve sozinho. `lock_timeout` curto evita que uma transação presa esgote o pool de conexão pequeno do Render free sob concorrência no mesmo assento.

---

## Conflito de horário na sala: sobreposição real com buffer fixo, não timestamp exato

- **Decisão**: criar uma sessão adquire lock pessimista na linha da `sala` e checa se alguma sessão existente pra essa sala se sobrepõe à janela `[data_hora, data_hora + 4h)` — sobreposição real de intervalo, não só colisão de timestamp idêntico.
- **Por quê**: sessão não modela duração/runtime do filme (o TMDb fornece, mas o snapshot local não captura); um buffer fixo de 4h cobre a duração de qualquer filme real + troca de sala sem precisar modelar runtime. Só checar timestamp exato deixaria passar duas sessões de fato sobrepostas na mesma sala com horários de início diferentes — furo real na proteção que a FR-6 pede (mesma classe de proteção da FR-11).

---

## Confirmação de pagamento: lock pessimista na reserva, sem estado "expirada" persistido, parâmetro no corpo

- **Decisão**: confirmar pagamento adquire `SELECT ... FOR UPDATE` na linha da `reserva` (mesmo padrão do assento). `reserva` só grava 3 estados — `ATIVA`, `CONFIRMADA`, `RECUSADA`; "expirada" não é persistido, é calculado (`ATIVA` + `expires_at` vencido) na hora da confirmação. Se o estado já não é `ATIVA`-não-vencida ao adquirir o lock, a chamada não reprocessa o parâmetro recebido — devolve o que já está persistido. Aprovado transiciona os assentos da reserva pra `VENDIDO`; recusado libera pra `LIVRE` imediatamente, na mesma transação. O parâmetro de teste que decide aprovação/recusa vai no corpo do POST (`resultadoSimulado`), não em query param ou header.
- **Por quê**: reaproveita o mesmo primitivo de lock já usado pro assento em vez de inventar mecanismo novo — mesma classe de problema de concorrência. Não persistir "expirada" evita um write path a mais sem necessidade (diferente do assento, ninguém mais "retoma" a reserva de outro cliente). Garantir que a chamada perdedora da corrida nunca reprocessa seu próprio parâmetro é o que fecha a FR-13 mesmo com parâmetros de teste conflitantes entre duas confirmações concorrentes. Corpo do POST porque é dado de negócio, não filtro nem metadado — valida com Bean Validation como qualquer DTO do domínio.

---

## Código do ingresso via HMAC (não JWT); rotas separadas pra link público e validação de portaria

- **Decisão**: código do ingresso é `uuid + "." + base64url(HMAC-SHA256(secret, uuid))`, onde `uuid` é a própria PK da linha `ingressos` — sem coluna própria de código, computado on-the-fly. `GET /ingressos/{codigo}` é pública, somente leitura, nunca muda estado; `POST /portaria/validacoes` exige papel `PORTARIA` + sessão selecionada e é a única rota que transiciona `VALIDO → UTILIZADO`, com o mesmo lock pessimista de linha usado no assento e na reserva.
- **Por quê**: HMAC gera um QR mais curto e simples que JWT, importante pra leitura confiável numa fila real de portaria — e como a validação sempre precisa ir ao banco pra checar o status mutável ("já utilizado"), duplicar `sessao_id` como claim de JWT não compraria nada, já que esse dado vem de graça na mesma consulta. Separar a rota de leitura pública da rota de validação é o que impede o link de compartilhamento virar bypass da portaria — non-negotiable explícito das instruções do projeto.

---

## Autenticação SPA↔API: Bearer JWT em localStorage, sem cookie

- **Decisão**: token JWT transportado via header `Authorization: Bearer <token>`, guardado em `localStorage` no front. CORS no back com allow-list explícita de origens, sem `credentials`.
- **Por quê**: já decidido JWT em vez de sessão/cookie (ver decisão "JWT para autenticação" acima, pensando na portaria como cliente potencialmente separado) — isso já empurra pra bearer-token-em-header. Cookie cross-site (Vercel e Render são origens diferentes) exigiria `SameSite=None`+`Secure`+CORS credentials, trabalho de configuração extra que nenhum non-negotiable de segurança do projeto (XSS/CSRF não estão na lista) justifica.

---

## Sem tabela `filmes` própria — sessão guarda snapshot do TMDb

- **Decisão**: `sessoes` grava direto os campos do TMDb usados pela tela (`tmdb_id`, `titulo`, `poster_url`, `sinopse`, `data_estreia`) no momento da criação, em vez de referenciar uma tabela `filmes` separada.
- **Por quê**: nenhuma FR do V1 precisa de catálogo relacional local — FR-8 filtra direto em `sessoes`. Uma tabela e um join a menos sem nenhuma feature que os exija.

---

## Envelope de erro único via `GlobalExceptionHandler`

- **Decisão**: toda resposta de erro da API segue `{"codigo": "<ENUM_ESTAVEL>", "mensagem": "<texto>"}`, mapeada por um `GlobalExceptionHandler` (`@RestControllerAdvice`) central, com handler de fallback genérico (`500`, `codigo=ERRO_INTERNO`) pra qualquer exceção não mapeada.
- **Por quê**: sustenta o NFR de loading/vazio/erro tratado em toda tela (a camada `api/` do front parseia esse formato uma vez só) e evita que uma exceção não tratada vaze mensagem/stacktrace do Postgres/Hibernate na resposta — o que feriria o non-negotiable de não expor campo sensível de banco.

---

## TypeScript 6.x em vez da major mais recente (7.0)

- **Decisão**: fixar TypeScript 6.x no front, não a versão mais nova disponível (TypeScript 7.0, com compilador nativo em Go).
- **Por quê**: TS 7.0 tinha saído (GA) só 5 dias antes da verificação de stack desta arquitetura — cedo demais pra apostar numa reescrita de compilador sob prazo de 5 dias restantes, com risco real de fricção de tooling (plugins do ESLint, integração com Vite) recém-lançada. TS 6.x já está estável há meses.

---

## Design tokens do tema cinema 35mm definidos na Story 1.1, sem sessão de UX dedicada

- **Decisão**: em vez de rodar uma sessão de UX dedicada antes de começar a implementação, os tokens de cor e tipografia do tema (sépia/âmbar, vermelho veludo, dourado, tipografia marquise) foram fixados como valores concretos direto na Story 1.1 — via `@theme` do Tailwind 4 em `web/src/index.css` — no momento em que o front é re-scaffolded pra Vite+React. Paleta: `sepia-950 #14100d` a `sepia-700 #3b2a1a` (fundo/superfície), `amber-400 #d99a44` (destaque secundário), `velvet-700 #7a1220` / `velvet-600 #8c1c2c` (ação primária), `gold-500 #c9a227` (borda/foco), `cream-100 #f2e8d5` (texto sobre fundo escuro). Tipografia: `Bebas Neue` (título, estilo marquise) + `Lora` (corpo, serifada legível), self-hosted via `@fontsource`. Nenhum componente (moldura de perfuração, transição de contagem regressiva) construído junto — só os tokens.
- **Por quê**: o `epics.md` já tinha decidido não ter story de UX dedicada, tratando a identidade visual como requisito transversal de cada story de UI — reabrir isso com uma sessão de UX completa consumiria tempo do prazo de 7 dias sem ganho proporcional, já que as instruções do projeto já descrevem a direção qualitativa da paleta e tipografia. Definir os tokens concretos agora, no exato momento em que o Tailwind é configurado pela primeira vez, evita que cada tela futura hardcode cor solta e precise de retrabalho de retrofit quando o tema for aplicado depois. Fontes self-hosted (`@fontsource`) em vez de CDN do Google Fonts pra manter o build da SPA autocontido, sem round-trip de rede externa no boot.

---

## `RestClient` injetado via `spring-boot-starter-restclient`, não construído na mão

- **Decisão**: `TmdbClient` (proxy TMDb da Story 1.2) recebe `RestClient.Builder` por injeção de dependência padrão do Spring — construtor único, `TmdbClient(RestClient.Builder builder, @Value("${tmdb.api.token}") String apiToken)`. Isso exigiu adicionar a dependência `spring-boot-starter-restclient` ao `pom.xml`. Timeout de conexão/leitura configurado via propriedade padrão do Boot (`spring.http.clients.connect-timeout`/`spring.http.clients.read-timeout` em `application.properties`), não em código. Revisa uma primeira tentativa (dentro da mesma story, antes do commit) em que `TmdbClient` construía o próprio `RestClient` na mão, com dois construtores — um de produção, um package-private só pra permitir teste com `MockRestServiceServer` — justamente pra evitar essa dependência nova.
- **Por quê**: `spring-boot-starter-webmvc` traz a *classe* `RestClient` (via `spring-web`), mas não autoconfigura o *bean* `RestClient.Builder` — isso só vem do módulo `spring-boot-restclient`. A primeira tentativa evitou essa dependência, mas o custo disso foi maior que o benefício: código não-idiomático (dois construtores, um deles existindo só pra contornar teste), timeout hard-coded em vez de configurável por ambiente, e — o motivo decisivo — esse padrão de "construir `RestClient` na mão" teria que ser **reaprendido e reaplicado** em qualquer story futura que precise falar com uma segunda API externa, herdando a mesma gambiarra em vez de reusar um caminho padrão já resolvido pelo framework. `spring-boot-starter-restclient` é um módulo oficial do próprio Spring Boot (não uma lib terceira) — o custo real de adicioná-lo (uma linha no `pom.xml`, baixo risco de CVE/manutenção) é pequeno perto do ganho.

---

## `AssentoSessao` no pacote `sessoes`, não em `reservas` (Story 2.1)

- **Decisão**: `AssentoSessao`/`AssentoSessaoId`/`AssentoSessaoRepository` vivem em `br.com.rolo35.api.sessoes` (e `sessoes/repository`), não em `reservas` como o Structural Seed da Architecture Spine sugere pelo nome da tabela (`assento_sessao`).
- **Por quê**: AD-3 exige popular `assento_sessao` na mesma transação do insert de `sessoes` — isso é código do domínio `sessoes`. AD-1 fixa a direção de dependência como `reservas → sessoes` (nunca o inverso); se o repository vivesse em `reservas`, `sessoes` teria que depender de `reservas` só pra popular a tabela na criação da sessão, violando o grafo de dependência. Colocar a entidade onde ela é escrita primeiro — não onde parece "pertencer" conceitualmente pelo nome — é a única ordem que não viola AD-1; `reservas` (Epic 3) poderá chamar esse repository livremente depois, porque já depende de `sessoes`. Mesmo tratamento já dado ao pacote `sessoes.catalogo` na Story 1.2.

---

## `lock_timeout` por transação via `SET LOCAL` nativo, não hint JPA (Story 2.1)

- **Decisão**: `SessaoService.criar` emite `SET LOCAL lock_timeout = '3s'` via `EntityManager.createNativeQuery(...).executeUpdate()`, dentro da mesma transação `@Transactional` que faz o `SELECT ... FOR UPDATE` da sala — não usa o hint JPA `jakarta.persistence.lock.timeout`.
- **Por quê**: AD-5 pede um timeout próprio e curto pra essa transação de lock, sem depender de configuração global de `lock_timeout` do Postgres (que afetaria toda conexão do pool). `SET LOCAL` escopado à transação é a forma direta e sem ambiguidade de tradução Hibernate/driver — evita apostar que o hint JPA se traduz certo pra essa combinação de Hibernate 7.4/Spring Boot 4.1/Postgres sem verificação prévia. O que o teste de concorrência com Testcontainers (Story 2.1, Task 7) valida é o `SELECT ... FOR UPDATE`: trocando-o por um `findById` sem lock, o teste falha de forma determinística (2 sessões criadas em vez de 1), confirmando que a proteção é lock de banco real e não checagem isolada de aplicação. **O estouro do `lock_timeout` em si não é exercitado por teste** — com duas threads e transação de dezenas de ms, os 3s nunca são atingidos. O que o code review acrescentou foi o tratamento do desfecho: `PessimisticLockingFailureException` passou a ter handler dedicado (`503 SALA_OCUPADA`), porque antes ele caía no handler genérico e virava `500 ERRO_INTERNO` — um 500 opaco pra uma requisição válida que só perdeu a vez na fila.

---

## `GET /api/salas` sem FR própria — infraestrutura mínima pra AC1 funcionar ponta a ponta (Story 2.1)

- **Decisão**: endpoint `GET /api/salas` (autenticado, sem restrição de papel, sem CRUD) foi criado mesmo sem nenhuma FR do PRD pedir gestão de salas.
- **Por quê**: sem ele, a tela de criação de sessão do organizador teria que hardcodar `salaId=1` — código morto/fake que quebraria silenciosamente no dia em que uma segunda sala fosse semeada. É só a infraestrutura mínima real pra AC1 (Story 2.1) funcionar de ponta a ponta pela UI, não abre escopo novo de gestão de salas.

---

## Fix incidental: `MethodArgumentNotValidException` sem handler dedicado (Story 2.1)

- **Decisão**: `GlobalExceptionHandler` passou a agrupar `MethodArgumentNotValidException` no mesmo handler de `PARAMETRO_INVALIDO` (`400`), junto com `ParametroInvalidoException` e `MissingServletRequestParameterException`.
- **Por quê**: antes da Story 2.1, qualquer falha de `@Valid` em qualquer DTO do projeto (inclusive `LoginRequest`, já existente desde a Story 1.1) caía no handler genérico `Exception.class` e virava `500 ERRO_INTERNO` em vez de `400` — um bug latente que nunca tinha sido exercitado porque nenhum DTO anterior tinha validação de campo capaz de falhar via `@Valid` de um jeito que chegasse até esse ponto. `CriarSessaoRequest` é o primeiro DTO da Story 2.1 com validação de verdade (`@NotNull`/`@NotBlank`/`@Positive`), então o gap ficou visível durante o RED da Task 4 — o handler novo corrige os dois casos de uma vez. Mudança puramente aditiva, sem regressão, registrada aqui porque o blast radius toca o domínio `auth` de raspão.

---

## Fuso horário fixado por variável de ambiente, não por conversão no código (Story 2.1, code review)

- **Decisão**: `TZ=America/Sao_Paulo` no `Dockerfile` da API, nos dois serviços do `docker-compose.yml` e documentado no `.env.example` pra ser configurado também no Render. `sessoes.data_hora` continua `LocalDateTime`/`TIMESTAMP` sem zona, e o front continua enviando a string local do `<input type="datetime-local">` sem conversão.
- **Por quê**: o back-end comparava `request.dataHora()` (wall-clock do navegador do organizador) com `LocalDateTime.now()` (fuso default do JVM). Em dev os dois coincidem; em produção o container roda em UTC, então uma sessão marcada para hoje às 20:00 em BRT era comparada com 23:00 e rejeitada como `DATA_HORA_NO_PASSADO` — toda a janela das próximas ~3h ficava inacessível, e o mesmo desvio deslocava o buffer de 4h. Alinhar os três relógios por configuração é uma linha; a alternativa correta em multi-timezone (front converte pra UTC, entidade vira `Instant`, coluna vira `TIMESTAMPTZ`) mexeria em schema, DTO, front e toda a suíte, sem ganho real pra um produto de cinema que opera num fuso só. A premissa aceita — operação single-timezone — fica registrada aqui em vez de implícita. `SessaoServiceTest.aceitaDataHoraPoucasHorasAFrenteDoRelogioLocal` é a guarda de regressão: quem trocar a comparação por uma referência em UTC quebra o teste.

---

## Papel checado por `@PreAuthorize` no método, não por matcher de path (Story 2.1, code review)

- **Decisão**: `@EnableMethodSecurity` em `SecurityConfig` e `@PreAuthorize("hasRole('ORGANIZADOR')")` em `SessaoController.criar`. O `requestMatchers(POST, "/api/sessoes").hasRole("ORGANIZADOR")` foi removido; `SecurityConfig` decide só autenticação (`permitAll` no login/health, `authenticated` no resto).
- **Por quê**: a regra presa à string exata `POST /api/sessoes` deixava todo o resto de `/api/sessoes/**` caindo no `anyRequest().authenticated()`. Na prática, o `PUT /api/sessoes/{id}` da Story 2.2 e o `GET` de listagem da 2.3 nasceriam abertos a CLIENTE e PORTARIA sem nenhum teste falhar — a proteção dependia de alguém lembrar de editar `SecurityConfig` a cada rota nova. Com a regra ao lado do endpoint, rota sem anotação não herda permissão por acidente. Efeito colateral que precisou de tratamento: `@PreAuthorize` nega **dentro** do `DispatcherServlet`, então a `AccessDeniedException` chega no `@RestControllerAdvice` em vez de passar pelo `RestAccessDeniedHandler` — sem um handler dedicado viraria `500`. Os dois caminhos (negação na filter chain e negação no método) agora devolvem o mesmo envelope `403 NAO_AUTORIZADO`.

---

## Capacidade derivada do mapa de assentos, não de `linhas × colunas` (Story 2.1, code review)

- **Decisão**: `SessaoService` calcula `capacidade = assentos.size()` a partir de `assentoRepository.findBySalaId(...)`, e rejeita com `SalaSemAssentosException` (`409 SALA_SEM_ASSENTOS`) uma sala sem mapa cadastrado.
- **Por quê**: a versão anterior usava `sala.getLinhas() * sala.getColunas()` enquanto as linhas de `assento_sessao` vinham de `findBySalaId` — duas fontes independentes, sem constraint no schema ligando as dimensões da sala à contagem em `assentos`. Uma sala com dimensões declaradas mas mapa incompleto criaria a sessão anunciando "capacidade 40" com menos (ou zero) assentos vendáveis, e o defeito só apareceria no mapa de assentos da Epic 3. A AC1 pede literalmente capacidade "derivada do mapa de assentos da sala" — é o mapa que determina quantos ingressos existem pra vender.

---

## `AssentoSessao` implementa `Persistable` (Story 2.1, code review)

- **Decisão**: `AssentoSessao` implementa `Persistable<AssentoSessaoId>` com flag `@Transient novo`, marcada `false` em `@PostPersist`/`@PostLoad`. O `@Builder` do Lombok saiu; o service usa o construtor explícito.
- **Por quê**: com `@EmbeddedId` atribuído em código, o `isNew()` padrão do Spring Data olha só pro id não-nulo e conclui "já existe" — o `saveAll` vira `merge()`, que dispara um `SELECT` por linha antes de cada `INSERT`. Pra "Sala 1" isso são 40 selects + 40 inserts **dentro da transação que segura o lock pessimista da sala**, exatamente o oposto do que AD-5 pede (transação de lock a mais curta possível) e o padrão N+1 que os non-negotiables proíbem. Escala linear com o tamanho da sala: uma sala de 300 lugares seriam 600 statements sob lock, aumentando a chance de o `lock_timeout` de 3s estourar em quem está na fila.

---

## Sem coluna `publicada`/estado de rascunho em `sessoes` (Story 2.3)

- **Decisão**: `listarPublicadas()` lista todas as linhas de `sessoes`, sem filtro de status — não existe (nem foi adicionada) coluna de publicação/rascunho na tabela.
- **Por quê**: `V1__schema.sql` nunca teve esse campo, e nenhuma AC de nenhuma story até aqui pediu um fluxo de rascunho — toda sessão criada pela Story 2.1 já é, por definição, listável publicamente. Inventar uma coluna/flag nova pra esta story seria escopo não solicitado; se um fluxo de rascunho vier a ser pedido depois, é decisão de uma story futura, não uma antecipação silenciosa agora.

---

## Listagem pública: uma query nativa com `JOIN`+`GROUP BY`, não duas consultas (Story 2.3)

- **Decisão**: `SessaoRepository.listarPublicadas()` é uma única `@Query(nativeQuery = true)` que junta `sessoes`+`salas`+`assentos`+`assento_sessao` via `JOIN`/`LEFT JOIN` e agrega `capacidade` (`COUNT(DISTINCT a.id)`) e `assentosLivres` (`COUNT(DISTINCT CASE WHEN status='LIVRE' ...)`) num `GROUP BY s.id, sa.nome`. O booleano `esgotada` é calculado no `SessaoService` (`assentosLivres == 0`), não na query nem persistido — o DTO público (`SessaoListagemDto`) não expõe a contagem crua de assentos livres, só o booleano derivado.
- **Por quê**: a AC2 desta story exige "uma única consulta (projection/fetch join)", mesmo padrão de estilo já usado em `SessaoRepository.existeConflitante` (Story 2.1) — `@Query` nativa com agregação em SQL, não fetch join JPQL, porque o `CASE WHEN` + `COUNT DISTINCT` correlacionado não é natural em JPQL sem subquery, o que reintroduziria risco de N+1 dependendo de como o Hibernate traduz. Não expor `assentosLivres` bruto evita que um visitante estime quantos ingressos já foram vendidos de uma sessão — informação sem valor pro caso de uso e desnecessária de vazar.

---

## Listagem pública esconde sessões passadas (code review da Story 2.3)

- **Decisão**: `listarPublicadas()` ganhou `WHERE s.data_hora >= now()`, dentro da mesma query nativa — sessão já ocorrida some da listagem pública.
- **Por quê**: nenhuma AC original da Story 2.3 pedia filtro temporal (só status esgotada/vaga), mas sem ele a listagem acumularia toda sessão já ocorrida pra sempre — "Sessões em cartaz" misturaria filmes de meses atrás com os futuros, indefinidamente, sem nenhuma forma de esconder o que já passou. Levantado no code review adversarial da story (Blind Hunter + Edge Case Hunter, achado independente pelos dois); usuário decidiu corrigir na hora em vez de deferir. Filtro na própria query nativa mantém a garantia de uma única consulta (AC2), sem segunda chamada nem filtro em memória.

---

## Edição de sessão reescreve `assento_sessao` inteiro quando a sala muda (Story 2.2)

- **Decisão**: `SessaoService.editar` apaga todas as linhas de `AssentoSessao` da sessão e insere uma linha `LIVRE` por assento da sala nova sempre que `salaId` muda. A checagem de trava pós-venda (`existeIngressoConfirmado`) roda antes desse passo, na mesma transação, e bloqueia a edição inteira caso exista qualquer ingresso.
- **Por quê**: `capacidade` e a listagem pública (Story 2.3) dependem de `assento_sessao` bater com a sala atual da sessão. Como a trava já garante que nenhum assento está `VENDIDO` nem existe reserva confirmada nesse ponto, apagar e recriar o mapa de assentos pra sala nova é seguro — não existe estado de venda pra perder.

---

## Sem teste de concorrência edição-vs-venda dedicado (Story 2.2)

- **Decisão**: `SessaoService.editar` replica o mesmo par lock+checagem (`findByIdForUpdate` + `existeConflitanteExcluindo`) que `criar` usa pra conflito de horário — ação obrigatória registrada no deferred-work do code review da Story 2.1 — mas não ganhou um teste de concorrência Testcontainers dedicado pra provar a trava pós-venda contra uma confirmação de ingresso disparada em paralelo.
- **Por quê**: não existe ainda código de confirmação de pagamento/emissão de ingresso (Epic 4) rodando em paralelo pra esse teste correr contra de verdade — fabricar um teste hoje só provaria a checagem isolada de `existeIngressoConfirmado` em memória, não uma garantia real de concorrência. Revisitar quando a Epic 4 existir: nesse ponto, editar uma sessão e confirmar um pagamento pra ela ao mesmo tempo passam a ser um cenário real de corrida, e aí sim vale um teste Testcontainers nos moldes de `SessaoConcorrenciaConflitoTest`.

---

## Nova direção visual via handoff do Claude Design — substitui os tokens da Story 1.1

- **Decisão**: adotar a direção visual do protótipo `Rolo 35.dc.html` (bundle `design-experimental-handoff.zip`, gerado no Claude Design em 2026-08-11) como identidade oficial do projeto, substituindo os tokens sépia/âmbar/veludo fixados na decisão "Design tokens do tema cinema 35mm definidos na Story 1.1". Tema: TV de tubo/videolocadora anos 80/90, fundo escuro roxo-preto, gradiente vermelho→dourado + azul ciano de contraste, tipografia Bungee/Archivo/VT323, cartões com borda preta 3px e sombra deslocada. Instruções do projeto atualizadas com a nova paleta/tipografia.
- **Por quê**: o protótipo já cobre a maior parte das telas do fluxo ponta a ponta (login, cadastro de cliente, vitrine, detalhe de filme, mapa de assentos, ticket com QR, painel do organizador, portaria, meus ingressos, sobre, salas) de forma consistente e mais trabalhada visualmente que os tokens hardcoded direto na Story 1.1 sem sessão de UX dedicada. Reaproveitar um design já pronto e testado visualmente custa menos que continuar evoluindo tokens improvisados tela a tela.
- **Impacto**: `web/src/index.css` (tokens Tailwind `@theme` da Story 1.1) e as telas já implementadas (login, busca de filmes, painel do organizador, edição de sessão) precisam de retrofit pra nova paleta/tipografia — trabalho ainda não feito, registrado aqui como pendência, não deferred-work (não é achado de review, é mudança de direção deliberada).

---

## Escopo novo: autocadastro de cliente (fora do sprint plan original)

- **Decisão**: adicionar autocadastro (`isCadastro` no protótipo — nome/e-mail/senha/termos) como fluxo real, restrito ao papel `CLIENTE`. Organizador e portaria continuam provisionados só via seed/gestão manual, sem tela de cadastro própria — os botões CLIENTE/ORGANIZADOR/PORTARIA no header do protótipo são um alternador de preview de papel, não um seletor de papel num formulário de cadastro real.
- **Por quê**: a Story 1.1 ("Fundação e Login com Papel Fixo") assumia usuários pré-existentes via seed; o design trazido introduz um fluxo de autoatendimento que não estava nos epics originais. Restringir a CLIENTE mantém a superfície de ataque pequena — criar conta com papel `ORGANIZADOR`/`PORTARIA` livre seria escalação de privilégio via cadastro público.

---

## Cadastro de salas: adiado até existir design

- **Decisão**: não implementar tela de criar/editar sala do organizador agora. O bundle de design não cobre essa tela (só existe uma página somente-leitura "SALAS"); o organizador segue sem CRUD de sala pela UI, dependendo do seed/SQL direto, até chegar um handoff específico.
- **Por quê**: construir essa tela "no escuro" arriscaria retrabalho quando o design chegar. `GET /api/salas` já existe (decisão prévia, Story 2.1) como infraestrutura mínima — falta só a tela de escrita.

---

## Sessão seed com dado real do TMDb, buscado uma vez e congelado no SQL (correção pós-Epic 2)

- **Decisão**: `V2__seed.sql` foi editado no lugar (não uma nova migration) pra: (1) trocar `poster_url`/`sinopse` da sessão seed, antes fake/placeholder, pelos valores reais retornados pelo TMDb (`GET /search/movie?query=Clube da Luta&language=pt-BR`, o mesmo endpoint que `TmdbClient.buscarPorTitulo` usa em produção) — a consulta foi feita uma única vez, fora da aplicação, com o token real do projeto, e os valores retornados (`tmdb_id=550`, poster, sinopse, `data_estreia=1999-10-15`) ficaram gravados como literais no `INSERT`; (2) aumentar a Sala 1 de 40 pra 80 assentos e criar mais 2 salas (Sala 2, 30 assentos; Sala 3, 140 assentos), com a geração de `assentos` generalizada numa única query orientada por `linhas`/`colunas` de cada sala.
- **Por quê**: o comentário antigo do seed ("integração real com TMDb chega na Story 1.2") ficou desatualizado assim que a Story 1.2 foi implementada, e o dado do filme era inventado. Considerei mover a criação dessa sessão pra um `ApplicationRunner` que chamasse o TMDb de verdade a cada boot — descartado por complexidade desnecessária pra um dado estático que nunca muda: exigiria property nova, ajuste no `pom.xml` dos testes pra não chamar o TMDb real durante `mvn test`, e tratamento de falha de boot se o `TMDB_API_TOKEN` não estivesse configurado. Buscar o dado uma vez e congelar no SQL resolve o problema de fundo (não usar dado inventado) sem esse custo. Editar `V2` no lugar em vez de criar uma `V4` invalida o checksum de qualquer volume Postgres local já existente (`docker compose down -v` resolve — validado nesta sessão, sem CI nem deploy no Render ainda rodando essa migration, então o único ambiente afetado era esta máquina; não documentado no README porque não afeta quem sobe o projeto pela primeira vez). Salas 2 e 3 não recebem sessão seed (decisão explícita, escopo desta correção) — existem pra o organizador criar sessões manualmente com capacidades diferentes ao testar a Epic 3, não pra o seed já demonstrar um mapa de assentos de tamanho variado sozinho.

---

## Hero da home usa o pôster como imagem de fundo, não um backdrop largo

- **Decisão**: a seção de hero da home (`ListagemSessoesPage`) usa `posterUrl` (formato retrato, já persistido em `sessoes`) como imagem de fundo da moldura de TV de tubo, no lugar de uma imagem de backdrop widescreen dedicada.
- **Por quê**: o protótipo de design assume um campo de backdrop largo (`image-slot`) que não existe no modelo de dados real — `sessoes` só grava `poster_url` (o campo que a busca por TMDb já retorna e que a Story 2.1 já persiste). Adicionar um segundo campo de imagem só pra essa seção exigiria nova chamada ao TMDb (`/movie/{id}/images` ou similar) e schema novo, fora do escopo desta correção visual. Usar o pôster com `object-cover` numa moldura larga é a adaptação mais barata que não inventa dado nem exige integração nova.

---

## Cor de acento por filme derivada de hash do `tmdbId`, não campo de dado

- **Decisão**: a tarja colorida de 6px na base de cada pôster do grid da home usa uma cor escolhida deterministicamente de uma paleta fixa de 8 tons (`PALETA_ACENTO` em `ListagemSessoesPage.tsx`) via `tmdbId % paleta.length` — não é um campo vindo do back-end.
- **Por quê**: no protótipo essa cor é dado estático de demonstração (`FILMES[i].cor`, hardcoded no array de exemplo da ferramenta de design), sem equivalente real no nosso modelo (`sessoes` não tem — e não tem por que ter — uma "cor do filme"). Derivar de forma determinística do `tmdbId` mantém o efeito visual (variedade de cor entre pôsteres) sem inventar uma coluna nova nem exigir curadoria manual por filme.

---

## Mapa de assentos calcula TTL lazy só na leitura, sem corrigir o banco (Story 3.1)

- **Decisão**: `SessaoService.mapaAssentos()` calcula o status efetivo de cada assento (hold vencido → `LIVRE`) só em memória, a partir de `expires_at`, sem nunca escrever de volta na linha `assento_sessao` — mesmo quando detecta um hold expirado.
- **Por quê**: AD-4 é explícito que TTL de reserva é lazy e sem job agendado, mas o cálculo acontece em todo lugar que **lê ou escreve** o estado — esta story cobre só leitura. Corrigir a linha no banco durante uma consulta pública e sem lock criaria uma race condition (dois visitantes consultando o mapa ao mesmo tempo poderiam ambos tentar "liberar" o mesmo assento vencido, sem coordenação) e antecipar lógica que a Story 3.2 já vai centralizar sob `SELECT ... FOR UPDATE` (AD-3) na hora de reivindicar o assento de verdade. Manter o mapa 100% leitura evita esse acoplamento prematuro.

---

## `permitAll()` do mapa de assentos usa matcher específico, não amplia `/api/sessoes/**` (Story 3.1)

- **Decisão**: `SecurityConfig` libera `GET /api/sessoes/*/mapa-assentos` como uma entrada `permitAll()` própria, em vez de ampliar o matcher exato já existente para `GET /api/sessoes` cobrir qualquer sub-rota.
- **Por quê**: `GET /api/sessoes/{id}` (sem sufixo) é a rota de gestão do organizador, autenticada, e `GET /api/sessoes/minhas` também exige login — um matcher `/api/sessoes/**` tornaria as duas públicas sem querer, regressão de segurança grave. O padrão com wildcard `/*/mapa-assentos` casa só o segmento exato do `{id}` seguido do sufixo literal, preservando as demais rotas atrás de `.anyRequest().authenticated()`. Mesmo cuidado que já motivou os dois grupos de `permitAll()` separados na Story 2.3.

---

## `buscarMapaPorSessao()` usa JPQL com `JOIN ... ON`, não `nativeQuery = true` (Story 3.1)

- **Decisão**: `AssentoSessaoRepository.buscarMapaPorSessao()` é uma query JPQL tipada (`@Query` sem `nativeQuery = true`), com `JOIN Assento a ON a.id = asx.id.assentoId` explícito entre duas entidades sem `@ManyToOne` mapeado.
- **Por quê**: `SessaoRepository.listarPublicadas()` (Story 2.3) usa SQL nativo porque precisa de `COUNT(DISTINCT ...)` + `CASE WHEN` em agregação, que não é natural em JPQL — mas essa query é um join simples sem agregação nenhuma. JPQL com `JOIN ... ON` (suportado desde JPA 2.1) resolve o join sem exigir associação mapeada entre as entidades, mantendo a query validada pelo Hibernate contra o metamodelo em tempo de build (SQL nativo só falha em runtime se um nome de coluna estiver errado) e portável entre dialetos de banco. Não copiar o padrão `nativeQuery = true` por reflexo — cada query usa a ferramenta que o caso pede.

---

## `travarParaReserva`/`reivindicar` usam `@Modifying @Query` em vez de `save()` de entidade recarregada (Story 3.2)

- **Decisão**: `AssentoSessaoRepository.reivindicar()` é um `UPDATE` em JPQL via `@Modifying @Query` (com `clearAutomatically = true`), não um `save()` de uma instância de `AssentoSessao` reconstruída em memória com o mesmo id.
- **Por quê**: `AssentoSessao` implementa `Persistable<AssentoSessaoId>` com a flag `novo` controlada só por `@PostPersist`/`@PostLoad` (Story 2.1) — ela não tem setters. Uma instância nova construída via `new AssentoSessao(id, ...)` sempre nasce com `novo=true` (`isNew()=true`), então um `save()` dessa instância forçaria o Spring Data a tentar um `INSERT` sobre uma PK composta que já existe, violando a constraint. `@Modifying @Query` evita esse caminho inteiro: escreve direto via SQL gerado pelo Hibernate a partir do JPQL, sem passar pela máquina de dirty-checking/`Persistable` da entidade. `clearAutomatically = true` evita que a sessão JPA devolva entidades stale (do cache de identidade) depois do UPDATE em massa — sem isso, `ReservaAssentoLockRepositoryTest` falhava com `TransactionRequiredException`/dado desatualizado ao reler as linhas na mesma transação de teste.

---

## `StatusAssento` fica em `sessoes/`, não em `reservas/`, mesmo sendo usado por `ReservaService` (Story 3.2)

- **Decisão**: o enum `StatusAssento` (`LIVRE`/`RESERVADO`/`VENDIDO`) foi criado em `br.com.rolo35.api.sessoes`, e não em `br.com.rolo35.api.reservas`, apesar de `ReservaService.statusEfetivoLivre()` (pacote `reservas`) ser o principal consumidor da regra de TTL lazy que usa esses valores.
- **Por quê**: AD-1 fixa a direção de dependência entre os pacotes de domínio como `reservas → sessoes`, nunca o inverso — `SessaoService` (que também compara contra os mesmos três valores, hoje como `String`) não pode importar um tipo do pacote `reservas` sem inverter essa direção. Colocar o enum em `sessoes/` deixa os dois lados (leitura em `SessaoService`, escrita em `ReservaService`) importarem de um único lugar compatível com AD-1. Pelo mesmo motivo, `HoldAtivoException` (Task 5) também foi criada em `sessoes/`, e não em `reservas/` como um rascunho anterior do artefato da story sugeria — `SessaoService.editar()` é quem lança essa exceção, e ela não pode depender de `reservas/`.

---

## Correção de `SessaoService.editar()` (hold ativo) entrou na Story 3.2, não ficou só em `deferred-work.md` (Story 3.2)

- **Decisão**: a checagem de hold ativo antes de `editar()` apagar `assento_sessao` numa troca de sala (Task 5 desta story) foi implementada aqui, e não deixada como item solto em `deferred-work.md` esperando uma story futura dedicada.
- **Por quê**: o review da Story 2.2 já tinha marcado esse gap como "ação obrigatória pra Epic 3", mas na época era um cenário inalcançável — nenhum código criava hold real ainda. A partir do momento em que `ReservaService.reservar()` (Task 3 desta mesma story) passa a criar holds de verdade, o gap deixa de ser teórico: um cliente em checkout perderia o assento silenciosamente se um organizador trocasse a sala da sessão no meio da janela de 10 minutos, deixando a `reserva` órfã. Adiar essa correção pra depois arriscaria um intervalo real (entre esta story e a próxima) em que o bug estaria ativo em produção.

---

## `editar()` trava `assento_sessao` (`travarPorSessao`) antes de checar hold ativo — correção do próprio code review da Story 3.2

- **Decisão**: a checagem de hold ativo de `editar()` (Task 5, ver decisão acima) foi corrigida de novo, na mesma story, depois do code review adversarial acusar que a implementação original ainda tinha uma corrida: `findByIdSessaoId(id)` era uma leitura **sem lock**, então um `ReservaService.reservar()` concorrente podia confirmar um hold novo entre essa leitura e o `deleteAll` seguinte — reabrindo o mesmo bug que a Task 5 devia fechar, só com janela menor. A correção troca essa leitura por `AssentoSessaoRepository.travarPorSessao(sessaoId)`, um novo método `@Lock(PESSIMISTIC_WRITE)` ordenado por `assento_id` (mesmo mecanismo de AD-3 que `travarParaReserva` já usa), e prova o fechamento da corrida com um teste de concorrência real (`ReservaEditarConcorrenciaTest`, duas conexões reais disputando o mesmo assento).
- **Por quê**: a severidade foi avaliada como média (janela de corrida estreita, exige timing quase exato entre uma edição de organizador e uma reserva de cliente na mesma sessão) mas o fix era barato e o non-negotiable de segurança das instruções do projeto é explícito ("resolvida com constraint/lock no banco, não só checagem na aplicação") — decisão de corrigir na hora em vez de adiar pra depois que o custo do bug (uma vez que a Epic 4/pagamento existir e passar a confiar em holds) ficasse maior. Trade-off aceito: `editar()` numa troca de sala agora bloqueia temporariamente qualquer `reservar()` concorrente pra essa sessão (e vice-versa) — aceitável porque trocar sala de sessão publicada é ação rara do organizador, não caminho quente do sistema.

---

## Timeout de lock em `reservar()` vira `AssentoEmDisputaException` (409), não reaproveita `AssentoIndisponivelException` nem `SALA_OCUPADA` — correção do code review da Story 3.2

- **Decisão**: quando `travarParaReserva()` estoura o `lock_timeout` de 3s, o service agora lança uma exceção nova e dedicada (`AssentoEmDisputaException`, código `ASSENTO_EM_DISPUTA`, HTTP 409), em vez de deixar a `PessimisticLockingFailureException` propagar pro handler genérico `SALA_OCUPADA` (503, mensagem fala de criação de sessão) ou de relançá-la como `AssentoIndisponivelException` (409, mesma que já é usada quando a checagem de status *conclui* que o assento não está livre).
- **Por quê**: um timeout de lock não é a mesma coisa que "assento confirmado indisponível" — é só a impossibilidade de confirmar o status a tempo, porque outra transação segurava a linha; o assento pode estar livre de novo no instante seguinte. Misturar os dois casos na mesma exceção/código enganaria o front-end, que trataria "tente de novo, pode funcionar" e "reselecione, está confirmado indisponível" da mesma forma. Optou-se por 409 (não 503 como `SALA_OCUPADA`) porque o recurso em disputa é identificável (os assentos da própria requisição) e a mensagem já orienta o cliente a tentar de novo, sem precisar de um código de "serviço indisponível" mais genérico.

---

## Login com hash dummy pra igualar tempo de resposta (Story 1.1)

- **Decisão**: `AuthService.login` sempre roda uma comparação BCrypt, mesmo quando o e-mail não existe — usando um hash dummy fixo (`DUMMY_HASH`) como alvo da comparação nesse caso, em vez de recusar direto sem rodar BCrypt.
- **Por quê**: sem isso, "e-mail não encontrado" retornaria quase instantâneo (sem custo de BCrypt) enquanto "senha errada" levaria o tempo real do hash — a diferença de latência entre os dois caminhos de erro vaza, por side-channel de tempo, quais e-mails estão cadastrados na base, mesmo a resposta HTTP sendo idêntica nos dois casos. Rodar BCrypt sempre, contra um hash real (ainda que não pertencente a ninguém), equaliza os dois tempos.

---

## ~~Ownership checado antes da validação de corpo na edição de sessão (Story 2.2)~~ — revogada pelo CAP-1

> **Revogada.** O CAP-1 removeu o ownership de sessão inteiro, e com ele a ordem que esta decisão
> estabelecia. `SessaoNaoPertenceAoOrganizadorException` não existe mais. Fica registrada porque o
> raciocínio sobre vazamento por diferença de status continua valendo para outras rotas — ver
> "Sessão é recurso do cinema, não do organizador (CAP-1)" abaixo.

- **Decisão**: em `SessaoService.editar`, a checagem de que o organizador autenticado é dono da sessão (`SessaoNaoPertenceAoOrganizadorException`) roda antes de qualquer validação do corpo da requisição (`DataHoraNoPassadoException`, conflito de horário, etc.) — nessa ordem, mesmo que o corpo esteja malformado.
- **Por quê**: se a validação de corpo rodasse primeiro, um organizador tentando editar sessão de outro (ID certo, mas sem ser o dono) só descobriria isso depois de passar por um 400 de corpo malformado — ou, pior, um 400 nunca apareceria e a diferença de status entre "corpo ruim" e "não é seu" vazaria, por inferência, se aquele ID de sessão existe e pertence a outra pessoa. Checar dono primeiro garante 403 sempre que o recurso não é do chamador, independente do que vier no corpo — mesma classe de cuidado que já rege a mitigação de timing attack no login.

---

## `Reserva.confirmar()`/`.recusar()` são mutadores estreitos direto na entidade (Story 4.1)

- **Decisão**: `Reserva` (Story 3.2) ganhou dois métodos, `confirmar()` e `recusar()`, que mudam `this.status` em memória — não um setter genérico, não `toBuilder()`. `PagamentoService.confirmar()` chama um dos dois depois de travar a linha via `ReservaRepository.findByIdForUpdate()` (novo, mesmo padrão `@Lock(PESSIMISTIC_WRITE)` de `SalaRepository`), e o `save()` seguinte se apoia no dirty-checking do Hibernate pra gerar o `UPDATE` no commit.
- **Por quê**: a Story 3.2, como implementada de fato, criou `Reserva` com `@Getter @NoArgsConstructor` e só o construtor completo — sem builder (diferente de `Sessao`) e sem setters (mesmo padrão de `AssentoSessao`). A spec da 4.1 previa as duas alternativas possíveis; a real implementação da 3.2 não tinha builder, então mutadores estreitos foi o caminho. É seguro porque `Reserva` (ao contrário de `AssentoSessao`) não implementa `Persistable` nem tem PK composta — é carregada dentro da mesma transação já como entidade gerenciada, então mutar o campo é rastreado normalmente pelo dirty-checking.

---

## `NaoAutorizadoException`/`ReservaExpiradaException` ficam em `pagamentos/`, reaproveitando `ClienteNaoEncontradoException` de `reservas/` (Story 4.1)

- **Decisão**: `pagamentos.NaoAutorizadoException` (403, mesmo código `NAO_AUTORIZADO` de `SessaoNaoPertenceAoOrganizadorException`) e `pagamentos.ReservaExpiradaException` (409 `RESERVA_EXPIRADA`) são exceções novas no pacote `pagamentos`, cada uma com seu próprio `@ExceptionHandler` em `GlobalExceptionHandler` — mas `PagamentoService` reaproveita `reservas.ClienteNaoEncontradoException` (já mapeada pra 401 `NAO_AUTENTICADO`) em vez de criar uma cópia em `pagamentos/`.
- **Por quê**: reserva de outro cliente e reserva inexistente precisam colapsar na mesma resposta (AC3, FR-12 — não revelar se o `reservaId` existe ou de quem é), e isso é um conceito específico do domínio `pagamentos`, não uma cópia do padrão de posse de sessão do organizador (que usa `404` primeiro, depois `403` — o oposto, por design). `ClienteNaoEncontradoException` já é sobre "o usuário do token não existe mais", conceito idêntico independente de qual service está confirmando isso — duplicar essa exceção só pra ficar "dentro do pacote certo" violaria AD-1 sem necessidade (a direção de dependência `pagamentos → reservas` já é a esperada).

---

## `@Modifying` bulk update com `clearAutomatically = true` sem `flushAutomatically = true` descarta mutação de entidade pendente em silêncio (Story 4.1)

- **Decisão**: `AssentoSessaoRepository.reivindicarVendido()`/`.liberar()` (novos, Story 4.1) usam `@Modifying(clearAutomatically = true, flushAutomatically = true)` — com os dois atributos, não só `clearAutomatically` como `reivindicar()` (Story 3.2) já usava.
- **Por quê**: achado real durante a Task 5 (teste de concorrência), não previsto na spec. `PagamentoService.confirmar()` muta `Reserva.status` em memória (`confirmar()`/`recusar()`) e chama `reservaRepository.save(reserva)` alguns comandos *antes* de chamar `reivindicarVendido()`/`liberar()`. Sem `flushAutomatically = true`, o `@Modifying` bulk update roda direto via JDBC sem antes sincronizar o persistence context — e como `clearAutomatically = true` chama `entityManager.clear()` **logo depois**, a mutação pendente de `Reserva` (ainda não flushada) era descartada em silêncio, sem exceção nenhuma. Resultado observado: `PagamentoConcorrenciaConflitanteTest` falhava de forma não-determinística — a reserva nunca era persistida como `CONFIRMADA`/`RECUSADA` de verdade, permanecia `ATIVA` no banco, e duas chamadas concorrentes processavam cada uma seu próprio `resultadoSimulado` independentemente (a segunda nunca detectava que a reserva "já tinha sido decidida"). `flushAutomatically = true` força o flush do `UPDATE` de `Reserva` antes do bulk update, fechando a corrida. Relevante pra qualquer código futuro (Epic 5, validação de portaria) que misture mutação de entidade + `@Modifying @Query` bulk update na mesma transação — o par `clearAutomatically`/`flushAutomatically` precisa ser avaliado junto, não só copiado do padrão anterior por reflexo.

---

## Código de ingresso é longo demais pra digitação manual — achado adiado pra Story 5.2 (Story 4.1)

- **Decisão**: não alterar o formato do código de ingresso (AD-8: `uuid + "." + base64url(HMAC-SHA256)`, ~80 caracteres) nem escopo das Stories 4.1/4.2 por causa disso. Registrar aqui como nota pra quando a Story 5.2 (validação de portaria) for desenhada — não implementar nada agora.
- **Por quê**: FR-18/Story 5.2 exigem que leitura por câmera (QR) e digitação manual do mesmo código produzam o mesmo resultado — ou seja, é literalmente o mesmo código nos dois caminhos, não um código curto dedicado à digitação. O formato de AD-8 funciona bem como QR (QR comporta muito mais que 80 caracteres sem ficar denso), mas é inviável de digitar à mão numa fila de portaria sob pressão de tempo — mistura maiúsculas/minúsculas e caracteres especiais de base64url. Como a validação de portaria (câmera+manual) ainda não existe em código, não há necessidade de resolver isso agora; a Story 5.2, quando desenhada, deveria considerar um código curto alfanumérico adicional, gerado/persistido especificamente para o caminho de digitação manual, sem substituir o código HMAC do QR.

---

## Ordem dos `requestMatchers` em `SecurityConfig` decide se `/api/ingressos/minhas` vaza como pública (Story 4.2)

- **Decisão**: `SecurityConfig` declara `.requestMatchers(HttpMethod.GET, "/api/ingressos/minhas").authenticated()` **antes** de `.requestMatchers(HttpMethod.GET, "/api/ingressos/*").permitAll()` — nessa ordem exata, não a reversa.
- **Por quê**: `/api/ingressos/minhas` e `/api/ingressos/{codigo}` têm a mesma forma de path — um segmento só depois do prefixo comum — então um `permitAll()` em `/api/ingressos/*` bate nos dois igualmente. A Story 3.1 (`/api/sessoes/{id}/mapa-assentos`) não teve esse problema porque o path público tinha um segmento a mais, não colidindo com `/api/sessoes/{id}` puro. Aqui não tem esse luxo. Spring Security avalia `requestMatchers` na ordem declarada e para no primeiro que casar — declarar o matcher específico e autenticado antes do genérico público garante que `/minhas` nunca cai no `permitAll()` mais amplo. Coberto por teste explícito (`IngressoSecurityTest`, `minhas` sem token → `401`) porque é o tipo de erro fácil de cometer por acidente na ordem errada e só perceber em produção.

---

## `IngressoService.buscarPublico()` valida a assinatura HMAC antes de qualquer consulta ao banco (Story 4.2)

- **Decisão**: `buscarPublico()` chama `CodigoIngressoService.extrairId()` + `.validar()` primeiro; só chama `ingressoRepository.findById()` depois de a assinatura bater. Código com assinatura inválida nunca gera uma consulta ao banco.
- **Por quê**: continuação direta de AD-8 (Story 4.1) do lado da leitura pública — a validação de assinatura é puramente computacional (HMAC + comparação em tempo constante), então checar antes do banco evita que a rota funcione como oráculo de timing (uma consulta ao banco que sempre acontece daria pistas por tempo de resposta sobre se o UUID existe, mesmo com assinatura errada) e evita gastar uma consulta com um código adulterado. `IngressoServiceTest` prova isso explicitamente: assinatura inválida → `IngressoNaoEncontradoException` sem nenhuma chamada a `findById()`.

---

## Notação de rota do link público: `/api/ingressos/{codigo}`, não `/ingressos/{codigo}` (Story 4.2)

- **Decisão**: a implementação usa `GET /api/ingressos/{codigo}`, com o prefixo `/api` — o PRD usa `/ingressos/{codigo}` como abreviação nos exemplos.
- **Por quê**: toda a API já usa `/api` como prefixo consistente (`/api/sessoes`, `/api/reservas`, `/api/pagamentos`); criar uma exceção só pra esta rota pública quebraria essa consistência sem ganho nenhum. O front-end monta a URL de compartilhamento como `/ingressos/{codigo}` (rota do React Router, sem `/api`) — a distinção é: `/ingressos/{codigo}` é a página do SPA que o cliente vê e compartilha, `/api/ingressos/{codigo}` é o endpoint que essa página chama por baixo.

---

## QR do ingresso é gerado no front-end, não por um endpoint da API (Story 4.2, retrofit visual)

- **Decisão**: o QR do canhoto (`CanhotoIngresso`, `web/src/components`) é renderizado no navegador com `qrcode.react`, a partir do código assinado que a própria resposta da API já traz. Não existe rota do tipo `GET /api/ingressos/{codigo}/qr` devolvendo PNG/SVG.
- **Por quê**: o QR é função pura do texto que ele carrega, e esse texto (`urlPublicaDoIngresso(codigo)`, montado sobre o código `uuid.assinatura` de AD-8) já chega no cliente em `GET /api/ingressos/minhas` e `GET /api/ingressos/{codigo}`. A parte que exige o servidor — assinar o código com o `TICKET_HMAC_SECRET` — já aconteceu antes; o QR não acrescenta segredo nenhum. Gerar no back custaria um round-trip por ingresso (a carteira lista N), mais cache/CORS pra imagem, sem ganho de segurança nem de correção. O cenário que inverteria a decisão é o ingresso virar PDF ou e-mail, onde não há navegador pra renderizar — não é o caso hoje.
- **Nota pra Story 5.2**: o handoff desenha um QR decorativo de 21x21 módulos; a implementação real precisa de zona de silêncio própria dentro do SVG (`marginSize` em módulos, não o padding em pixels da borda amarela do desenho), senão o leitor de portaria falha em parte dos aparelhos.

---

## `GET /api/reservas/{id}` existe pra retomar o checkout, e é a única leitura de reserva sem lock (Story 4.3)

- **Decisão**: a tela de pagamento se reconstrói inteira a partir de `GET /api/reservas/{id}`, e esse método usa `findById()` — não `findByIdForUpdate()`, como todo o resto do domínio `reservas`/`pagamentos`.
- **Por quê**: sem a rota, a tela de pagamento só existiria enquanto a navegação que a criou estivesse viva — um F5, um "voltar" do navegador ou um link colado descartariam um checkout cuja reserva ainda vale, com o hold de 10 minutos correndo. Sobre o lock: o `PESSIMISTIC_WRITE` do resto do domínio existe porque aqueles caminhos estão prestes a escrever na `Reserva`; este não escreve nada. Travar a linha a cada abertura da tela (e a cada refresh) criaria fila justamente contra o `POST /api/pagamentos/confirmar` do mesmo cliente, que é o gargalo do fluxo — o AD-4 protege escrita concorrente, e não há escrita aqui pra proteger. `ReservaServiceTest` prova por `verify(never())` que nem `findByIdForUpdate` nem `save` são chamados.

---

## O contador de hold é informativo; quem decide se a reserva expirou é o servidor (Story 4.3)

- **Decisão**: a tela de pagamento mostra uma contagem regressiva baseada no `expiresAt` que o servidor devolve, mas o tratamento do `409 RESERVA_EXPIRADA` continua obrigatório e é ele que manda; o contador zerar apenas desabilita a ação e leva ao estado de expirada.
- **Por quê**: a contagem roda contra o relógio do navegador, que pode estar adiantado ou atrasado em relação ao da API. Isso é aceitável pro que o contador faz — dar noção de urgência e parar de oferecer uma ação que o servidor vai recusar —, mas não como decisão de negócio: quem decide se o hold venceu é a checagem dentro do lock, no back. O caminho inverso (contador ainda positivo e servidor recusando) precisa funcionar igual, e por isso os dois estados são testados separadamente — um com `409`, outro só com o avanço do relógio, sem nenhuma requisição.

---

## `ApiRequestError` carrega o `codigo` do envelope, não só o status (Story 4.3)

- **Decisão**: `ApiRequestError` ganhou um terceiro parâmetro opcional `codigo`, preenchido a partir do `codigo` do `ApiError` quando ele existe.
- **Por quê**: o fluxo de pagamento tem dois erros distintos no mesmo `409` — `RESERVA_EXPIRADA` é terminal (os assentos já foram liberados, é preciso refazer a seleção) e `RESERVA_EM_DISPUTA` é transitório (o `lock_timeout` de 3s estourou; a mesma ação tende a funcionar na sequência). Só com o status não dá pra separar os dois, e tratá-los igual manda o cliente refazer uma seleção que nunca precisou ser refeita, liberando um hold que ainda era dele. Opcional e em terceira posição pra que nenhum call site existente precisasse mudar. A mesma colisão existe latente em `MapaAssentosPage` (`ASSENTO_INDISPONIVEL` vs `ASSENTO_EM_DISPUTA`) e está registrada em `deferred-work.md`.

---

## `NaoAutorizadoException` subiu pra `common`; `SessaoNaoPertenceAoOrganizadorException` ficou onde estava (Story 4.3)

> **Parcialmente revogada pelo CAP-1.** A parte sobre `NaoAutorizadoException` em `common` continua
> valendo. A segunda metade não: `SessaoNaoPertenceAoOrganizadorException` foi apagada junto com o
> ownership de sessão, então não há mais o que manter onde estava.

- **Decisão**: `pagamentos.NaoAutorizadoException` virou `common.NaoAutorizadoException`, passando a atender também `reservas`. `sessoes.SessaoNaoPertenceAoOrganizadorException` **não** entrou no movimento.
- **Por quê**: já existiam quatro origens do mesmo par `403 NAO_AUTORIZADO`, e uma classe nova em `reservas` seria a segunda cópia de uma exceção que nasceu com nome genérico; a alternativa — `reservas` importar de `pagamentos` — inverteria a direção de dependência registrada pra Story 4.1. `common` é onde `GlobalExceptionHandler` e `ApiError` já moram, então nada se inverte. A exceção de sessão ficou porque o nome carrega significado no throw site e nos testes (é ownership de sessão, não papel errado): colapsá-la numa genérica perderia informação. O objetivo era parar de multiplicar cópias de uma exceção sem significado próprio, não uniformizar tudo.

---

## A seleção de assentos sobrevive ao login pelo `state` de navegação, e ainda passa pelo filtro do mapa recarregado (Story 4.3, AC8)

- **Decisão**: quando a API recusa a reserva por falta de autenticação (`401`/`403`), o mapa manda pro login levando no `state` de navegação a sessão de origem e os assentos escolhidos; o login devolve a pessoa ao mapa com esse mesmo `state`, e o mapa só reseleciona os assentos que voltaram `LIVRE` na carga seguinte. Nada disso passa por `localStorage`/`sessionStorage`.
- **Por quê**: sem isso o visitante batia num aviso pedindo login sem caminho até ele e, se entrasse por conta própria, voltava com a escolha perdida — a compra morria antes do checkout que esta story existe pra entregar. O `state` de navegação é o lugar certo porque a seleção é dado de uma compra em andamento, não preferência que deva sobreviver à aba ou vazar pra outra sessão do mesmo navegador. E ela não pode ser tratada como reserva: durante o login outra pessoa pode ter reservado o mesmo assento, então a autoridade é o mapa que o servidor devolve na volta — o `state` só propõe, o servidor dispõe. O login honra a retomada apenas pra papel `CLIENTE`: entrar como organizador ou portaria não continua compra nenhuma, e mandar esse usuário pro mapa só adiaria a mesma negação pro clique seguinte.

---

## Os 4 resultados de validação voltam `200`, não como erro HTTP (Story 5.2)

- **Decisão**: `VALIDO`/`INVALIDO`/`JA_UTILIZADO`/`EVENTO_ERRADO` são todos `200 OK` com um campo `resultado` no corpo — nunca `404`/`409`/`422`.
- **Por quê**: mesmo racional de `PagamentoDto` (Story 4.1, AD-6) — são desfechos de negócio esperados que a portaria precisa tratar visualmente, não falhas da requisição em si. As exceções reais desta story (`SessaoAtivaNaoSelecionadaException` → 409, `IngressoEmDisputaException` → 409) são sobre a operação não poder ser tentada/completada agora, categoria diferente de "o ingresso é inválido". Tratar os 4 resultados como erro HTTP obrigaria o front a diferenciar "erro de rede" de "ingresso já usado" pelo mesmo mecanismo, o que não faz sentido pra uma tela de portaria que precisa de resposta visual imediata.

---

## `INVALIDO` não diferencia motivo (Story 5.2)

- **Decisão**: código malformado, assinatura HMAC adulterada e UUID inexistente caem todos no mesmo resultado `INVALIDO` — a resposta não revela qual dos três aconteceu.
- **Por quê**: mesma decisão de `IngressoNaoEncontradoException` na Story 4.2 (AD-8), reaplicada aqui. Diferenciar os motivos transformaria o endpoint de validação num oráculo pra descobrir por tentativa e erro se um UUID é válido — a assinatura já é checada antes de qualquer consulta ao banco, então nem um código forjado chega a segurar uma linha da tabela `ingressos`.

---

## `qr-scanner` como dependência nova pra leitura de QR (Story 5.2)

- **Decisão**: adicionado `qr-scanner` (npm) como única dependência nova do front nesta story, pra leitura de ingresso por câmera.
- **Por quê**: wrapper leve sobre `getUserMedia` com API mínima (`start()`/`stop()`/callback `onDecode`), sem exigir infraestrutura própria de decodificação. Ativado só por clique explícito ("ligar câmera"), nunca automático no mount — evita pedir permissão de câmera sem contexto e mantém o teste do componente livre de mockar `getUserMedia` globalmente.

---

## O QR do ingresso carrega o código assinado, não o link público — emenda à decisão da Story 4.2 (code review do Epic 5)

- **Decisão**: `CanhotoIngresso` recebe `codigo` e grava `uuid.assinatura` no QR. O link público (`urlPublicaDoIngresso()`) continua existindo, mas serve só o botão de compartilhar. Emenda explícita à decisão "QR do ingresso é gerado no front-end" (Story 4.2), que passou a gravar a URL no QR sem que isso fosse decidido separadamente.
- **Por quê**: o QR existe pra ser lido na porta. Com a URL como payload, `CodigoIngressoService.extrairId()` fazia `split(".", 2)` e tentava `UUID.fromString("https://rolo35")` (ou `"http://localhost:5173/ingressos/<uuid>"` em dev) — os dois falham, e **toda leitura por câmera devolvia `INVALIDO`**. O PRD (linha 20, UJ-3, FR-18) trata QR e link de compartilhamento como coisas separadas, e o compartilhamento já tinha botão próprio, que nunca dependeu do QR. Custo da mudança: escanear o canhoto com a câmera nativa do celular não abre mais a página do ingresso — conveniência de compartilhamento, não a função do QR.
- **Como não regride**: `web/src/pages/ContratoQrPortaria.test.tsx` cobre a *travessia*, não cada lado — renderiza o canhoto real, extrai o payload do QR e alimenta o `onDecode` da tela de portaria, exigindo que a string chegue intacta em `validarIngresso()` e que seu primeiro segmento seja um UUID (réplica fiel da regra do back-end). Antes existiam testes dos dois lados, e ambos passavam: o do canhoto afirmava que o QR *devia* apontar pro link público, e o da portaria nunca acionava o `onDecode`. Cada lado passava sozinho e o contrato entre eles não era de ninguém.

---

## Story 1.3 vira "Cadastro de Usuário" com papel selecionável, não só autocadastro de cliente

- **Decisão**: a Story 1.3 (Epic 1, `epics.md`) muda de "Autocadastro de Cliente" — endpoint que só cria conta `CLIENTE`, rejeitando qualquer outro papel enviado — pra "Cadastro de Usuário", que aceita `papel` explícito no corpo da requisição, validado contra `ORGANIZADOR`, `CLIENTE` ou `PORTARIA`. Introduz `enum Papel` no back-end (hoje `papel` é `String` livre em `Usuario.java`); sem mudança de schema, já que a coluna `usuarios.papel` sempre foi genérica pros três papéis (`ARCHITECTURE-SPINE.md`). A AC anterior ("nunca cria ORGANIZADOR/PORTARIA por essa via") é revogada e substituída por validação de enum.
- **Por quê**: restringir o cadastro a `CLIENTE` obrigava usar contas de seed fixas pra testar/avaliar os fluxos de organizador e portaria — atrito desnecessário pra avaliação e testabilidade do sistema, sem ganho de segurança real (o PRD já trata os três papéis como igualmente "de conta", FR-1). Passou por `bmad-correct-course` porque a story já existia formalmente no sprint plan (ainda em `backlog`, nada implementado em `main`), então virou registro rastreável em vez de edição solta.

---

## Sessão é recurso do cinema, não do organizador que a criou (CAP-1)

- **Decisão**: qualquer usuário com papel `ORGANIZADOR` lista, abre e edita qualquer sessão. `SessaoNaoPertenceAoOrganizadorException` foi removida, junto do seu handler `403/NAO_AUTORIZADO`; `GET /api/sessoes/minhas` virou `GET /api/sessoes/gestao` e a query de gestão perdeu o `WHERE organizador_id = ?`. A coluna `sessoes.organizador_id` continua existindo e continua sendo preenchida na criação — ela registra autoria, não posse, e é a autoria (não quem editou) que volta no `SessaoResponse` de `PUT /api/sessoes/{id}`.
- **Por quê**: o isolamento multi-tenant entre organizadores nunca foi pedido. O PDF oficial do desafio especifica um organizador seedado e nenhuma noção de vários organizadores independentes disputando o mesmo cinema; a decisão "Escopo de um único cinema, não plataforma multi-local" já tinha registrado que salas são pool compartilhado "sem conceito de posse", e sessão ter dono contradizia isso — o mesmo cinema, com a mesma sala e a mesma portaria, mas com uma agenda invisível pra metade da equipe. Na operação real de um cinema de bairro, quem cobre o turno da noite precisa corrigir a sessão que o turno da tarde cadastrou errado. Manter o isolamento significava manter uma dimensão de autorização inteira (e sua superfície de bug) pra sustentar uma regra que ninguém pediu.
- **Consequência assumida**: não há trilha de quem editou o quê — `organizador_id` só diz quem criou. Auditoria de edição seria uma tabela nova, fora do escopo do desafio; a alternativa barata (sobrescrever `organizador_id` com quem editou por último) foi rejeitada por destruir a única informação de autoria que existe hoje.
- **Efeito no requisito**: a leitura estrita de "organizador só gerencia sessão própria" (FR-2) deixa de valer; a leitura que fica é "só quem tem papel `ORGANIZADOR` gerencia sessões", que continua sendo garantida pelo `@PreAuthorize` de cada rota de gestão.
- **Ressalva que faltava nesta entrada** (levantada em code review depois do commit): o ownership também era, por acidente, o que limitava o raio do cadastro público. `POST /api/auth/cadastro` é `permitAll` e aceita `papel` no corpo (Story 1.3), então qualquer visitante cria uma conta `ORGANIZADOR`; antes do CAP-1 essa conta só mexia nas sessões que ela própria tivesse criado, e agora mexe em todas. Nenhuma das duas decisões está errada isolada — juntas é que somam. Mantido assim de propósito, porque é o que torna as três telas avaliáveis sem seed manual, e declarado no README §17 em vez de escondido. Num produto real, o cadastro público criaria só `CLIENTE` e staff viria por convite.

---

## O front entra no `docker compose`, servido por nginx (CAP-5)

- **Decisão**: `docker-compose.yml` ganha um serviço `web` — build multi-stage (`node:22-alpine` compila o bundle, `nginx:1.27-alpine` serve) publicado em `localhost:5173`, a mesma porta do `vite dev`. `docker compose up` passa a subir a aplicação inteira: banco, API e front.
- **Por quê**: antes, executar o projeto exigia dois comandos em dois lugares (`docker compose up` na raiz, `npm install && npm run dev` em `web/`) e, portanto, ter Node instalado. Isso existia porque o front ia pra Vercel e o back pro Render — uma decisão de deploy vazando pro caminho de execução local de quem só quer ver o sistema rodar. Um comando só é o que um avaliador espera de um projeto que já tem Docker no stack.
- **Detalhes que a escolha obriga**: `VITE_API_URL` é `ARG` de build, não `ENV` de runtime — o Vite inlina `import.meta.env` no bundle, e quem lê essa URL é o navegador do usuário, que está fora da rede do compose (por isso o default é `http://localhost:8080`, e não `http://api:8080`). O nginx precisa de `try_files ... /index.html`, senão dar F5 em `/organizador` devolve 404 dele em vez da aplicação. E a porta 5173 é a mesma do Vite de propósito: o endereço do front não muda conforme o modo de execução, então `CORS_ALLOWED_ORIGINS` continua valendo sem ajuste.
- **O que não muda**: o Vite continua sendo o caminho de desenvolvimento. O serviço `web` serve bundle estático, sem hot reload — quem for editar o front derruba ele (`docker compose stop web`) e roda `npm run dev` na mesma porta.

---

## Deploy inteiro no Render por blueprint, em vez de API no Render + front na Vercel (CAP-6)

- **Decisão**: `render.yaml` na raiz sobe os três serviços numa conta só — Static Site pro front, Web Service Docker pra API, Postgres gerenciado. A Vercel sai do plano de deploy.
- **Por quê**: o arranjo anterior espalhava um projeto pequeno por duas contas e dois pipelines, e criava um acoplamento chato de manter: cada lado precisa da URL do outro (CORS de um lado, `VITE_API_URL` do outro), então qualquer redeploy que mude domínio quebra o par. Um blueprint único deixa o deploy inteiro versionado no repositório e reproduzível por quem clonar — que é o mesmo argumento do Docker Compose, aplicado à nuvem. Também melhora a limitação mais visível do plano free: Static Site é CDN e **não dorme**, então a aplicação abre na hora; só a primeira chamada de API paga o cold start de ~1min.
- **Detalhe que o Render obriga**: a `connectionString` do banco gerenciado vem no formato `postgres://...`, que o driver JDBC não aceita. Em vez de gambiarra de conversão, `application.properties` passa a montar a URL a partir de `DB_HOST`/`DB_PORT`/`DB_NAME` como *fallback* — `SPRING_DATASOURCE_URL` continua sendo o caminho normal do compose e do dev local, sem mudança de comportamento.
- **O que ficou manual, e por quê**: `TMDB_API_TOKEN` (segredo) e o par `CORS_ALLOWED_ORIGINS`/`VITE_API_URL` ficam como `sync: false`. As URLs são previsíveis (`https://<nome>.onrender.com`), mas o Render sufixa o nome quando ele já está em uso — chutar no arquivo daria um blueprint que aplica e não funciona, o que é pior do que dois campos preenchidos no apply.

---

## As duas gerações de Jackson são inevitáveis, e `@JsonProperty` já está no pacote certo (CAP-9)

- **Decisão**: nada muda no código. O `import com.fasterxml.jackson.annotation.JsonProperty` de `TmdbClient` **não** é resquício do Jackson 2 — é o pacote correto também no Jackson 3. O POM do `tools.jackson.core:jackson-databind:3.x` declara textualmente `<!-- Annotations remain at Jackson 2.x group id -->` e depende de `com.fasterxml.jackson.core:jackson-annotations`. Só `jackson-core` e `jackson-databind` migraram pra `tools.jackson.*`.
- **Por quê o item foi levantado**: a árvore de dependências mostra as duas gerações lado a lado (`tools.jackson.core:*:3.1.4` e `com.fasterxml.jackson.core:*:2.21`), o que parece descuido. Não é: o Jackson 2 entra como dependência transitiva de `jjwt-jackson`, que é o serializador JSON do JJWT 0.13 e não tem versão pro Jackson 3. As alternativas do próprio JJWT (`jjwt-gson`, `jjwt-orgjson`) trocariam uma biblioteca por outra sem eliminar a duplicação de propósito.
- **Consequência**: convivência declarada, não acidental. O `ObjectMapper` que a aplicação usa é o do Spring Boot 4 (`tools.jackson.databind.ObjectMapper`); o Jackson 2 vive só dentro do JJWT, assinando e lendo token.

---

## Código curto de digitação manual, ao lado do código assinado — não no lugar dele (CAP-11)

- **Decisão**: `ingressos` ganha a coluna `codigo_curto` (`VARCHAR(8)`, `NOT NULL`, índice único), gerada na emissão por `SecureRandom` em Base32 Crockford. `POST /api/portaria/validacoes` aceita os dois formatos: se o texto tem a forma `uuid.assinatura`, segue exatamente o caminho de antes (confere HMAC, busca por id); qualquer outra coisa é normalizada como código curto e resolvida por `findByCodigoCurtoForUpdate`. Daí em diante o fluxo é o mesmo — sessão ativa, estado do ingresso, transição `VALIDO → UTILIZADO` sob o mesmo lock. QR, link público e leitura por câmera continuam usando exclusivamente o código assinado.
- **Por quê**: o fallback da câmera era digitar `uuid.assinatura` — 36 caracteres mais uma assinatura Base64. Ninguém faz isso na frente de uma fila, então na prática a portaria não tinha plano B para tela riscada, celular sem bateria ou luz ruim. O painel do turno já reconhecia a necessidade: ele exibia um prefixo do UUID pra conferência visual, um código curto improvisado que não servia pra nada além de olhar. Agora ele mostra o código real, o mesmo que está no canhoto.
- **Base32 Crockford, e não hexadecimal ou Base64**: o alfabeto exclui `I`, `L`, `O` e `U` — exatamente os caracteres que se confundem com `1`, `0` e entre si quando alguém dita por cima do balcão. A normalização aceita minúscula, hífen e as trocas confundíveis, então quem digita o que está escrito acerta.
- **Sobre a segurança, explicitamente**: 8 caracteres Base32 são 40 bits, e não há assinatura — é mais fraco que o código HMAC, por construção. O que sustenta a decisão é onde ele vale: só em `POST /api/portaria/validacoes`, que exige token de papel `PORTARIA`. Força bruta contra esse endpoint pressupõe uma conta de operador válida, o que é uma categoria de ameaça diferente de "qualquer um na internet". O caminho principal (câmera + HMAC) não foi enfraquecido em nada, e o endpoint público de ingresso (`GET /api/ingressos/{codigo}`) **não** aceita código curto.
- **Colisão**: 40 bits dão ~1,1 × 10¹² combinações; o índice único é o backstop. Numa colisão a emissão falha alto (erro de integridade) em vez de emitir dois ingressos com o mesmo código — o que é o comportamento certo, ainda que ríspido. Retentativa automática não foi implementada: a probabilidade nesse volume não justifica o código.

---

## Precedência da validação: "evento errado" vem antes de "já utilizado" (CAP-10)

- **Decisão**: `PortariaService.validar()` checa a sessão **antes** do status. Um ingresso `UTILIZADO` de outra sessão devolve `EVENTO_ERRADO`, não `JA_UTILIZADO`. A ordem já era essa no código desde a Story 5.2, mas nunca tinha sido registrada como decisão — era uma escolha invisível de ordem de `if`.
- **Por quê**: a pergunta que a portaria precisa responder na porta é "essa pessoa entra aqui?", e a resposta mais acionável pra um ingresso de outra sessão é mandá-la pra sala certa. `JA_UTILIZADO` sugeriria que a pessoa já entrou *nesta* sessão, que é falso e manda o operador procurar um problema que não existe. A informação de que aquele ingresso já foi usado em outro lugar não muda nada pra este operador — ele não valida a outra sessão.
- **Consequência**: não existe resultado composto ("de outro evento e já usado"). Os quatro resultados continuam mutuamente exclusivos, que é o que a tela da portaria sabe desenhar.

---

## Sem pull request: merge direto na branch de trabalho (CAP-12)

- **Decisão**: o projeto não usa pull requests. Cada capability vira um commit próprio direto na branch de trabalho, com mensagem no formato Conventional Commits explicando o porquê, e a integração é merge direto.
- **Por quê**: PR existe pra pedir revisão de outra pessoa e pra gatear merge por CI. Aqui não há outra pessoa — é trabalho solo, com prazo de 7 dias — e o gate de qualidade que um PR daria já roda antes de cada commit: teste primeiro (RED → GREEN), suíte inteira verde antes de commitar. Abrir PR pra si mesmo adicionaria cerimônia sem adicionar nenhuma checagem que já não aconteça.
- **O que substitui a revisão**: os ciclos de code review registrados em `_bmad-output/implementation-artifacts/` — feitos por agente, com achados aplicados ou explicitamente recusados — e este próprio arquivo, que é onde as decisões ficam auditáveis depois do fato.
- **Emenda, no fechamento**: as integrações finais na `main` foram feitas por pull request (#1, a Story 1.3; #2, a branch de acabamento), e a regra acima continua valendo pro que ela descreve. São situações diferentes, não a mesma situação com resposta diferente. Durante o sprint, cada capability era um commit direto e um PR por commit seria cerimônia sem revisor e sem CI. Na integração final entram 47 commits, 139 arquivos e sete migrations de uma vez, e aí o PR paga por dois motivos que independem de haver outra pessoa: um diff revisável antes de tocar a branch principal, e um resumo escrito do que mudou e por quê, que fica anexado ao merge em vez de espalhado por 47 mensagens. O merge é commit de merge, não squash — achatar os 47 commits apagaria o rastro de ciclo RED → GREEN → REFACTOR que o README §16 aponta como verificável.

---

## Swagger UI entra; o envelope de erro fica documentado num lugar só (CAP-15)

- **Decisão**: `springdoc-openapi-starter-webmvc-ui` 2.8.6 adicionado, com `/swagger-ui.html` e `/v3/api-docs` públicos e um `OpenApiConfig` mínimo (título, descrição e esquema `bearer-jwt`, pro botão *Authorize* funcionar). O envelope de erro `{codigo, mensagem}` **não** é anotado endpoint a endpoint com `@ApiResponse`.
- **Por quê o springdoc, mesmo sendo Grupo C**: o custo real foi uma dependência e um `@Configuration` de 40 linhas, e o ganho é quem avalia conseguir exercitar a API sem montar `curl` na mão. A documentação é pública de propósito — ela descreve o contrato, não expõe dado, e gatear atrás de login obrigaria a conseguir um token antes de saber quais rotas existem.
- **Por quê não anotar o envelope**: seriam mais de vinte `@ApiResponse` repetindo a mesma estrutura em cima de controllers que hoje se leem em dez segundos, e a informação útil — quais códigos existem, com que status, e quando cada um acontece — já está numa tabela única no README §6. Vinte cópias parciais de uma tabela completa é pior do que a tabela.
- **Risco assumido, com alarme**: springdoc 2.8.6 é publicado pro Spring Boot 3.x e este projeto roda no 4.1 com Jackson 3. A combinação funciona hoje (verificado, não presumido), mas é o tipo de coisa que quebra em silêncio numa atualização. `OpenApiDocsTest` sobe o contexto inteiro e exige `200` nos dois endpoints, com rotas conhecidas presentes no JSON — se a compatibilidade cair, a suíte cai junto.
---

## `POST /api/auth/cadastro` ganha teto por endereço — emenda parcial ao "sem rate limiting" do projeto (Story 1.3, pós code review)

- **Decisão**: a rota de cadastro passa a ter teto de tentativas por endereço de origem (`LimitadorDeCadastro`: janela fixa de 60 minutos, 5 tentativas, tudo em memória do processo), respondendo `429 LIMITE_DE_CADASTRO_EXCEDIDO` no envelope da API. Os dois valores são configuráveis por `CADASTRO_LIMITE_TENTATIVAS` e `CADASTRO_LIMITE_JANELA_MINUTOS`, com default no código. É emenda **parcial** a duas decisões anteriores: "rate limiting em endpoints públicos fica fora do V1" (`ARCHITECTURE-SPINE.md`, ecoada em `epics.md` e na linha de simplificações assumidas deste arquivo) e "auto-registro é aberto por decisão deliberada" (entrada anterior). Nenhuma das duas é revogada: as demais rotas públicas seguem sem teto, e o cadastro segue sem gate de autorização — quem quiser criar conta `PORTARIA` continua podendo, só não milhares delas.
- **Por quê**: a decisão de arquitetura foi tomada quando "rota pública" significava leitura — busca de sessões, mapa de assentos, link de ingresso, que são exatamente os exemplos que ela cita. Abusar dessas custa banda. A Story 1.3 criou a primeira rota pública que **escreve**, e escreve conta com o papel que o corpo pedir, inclusive `PORTARIA`, que valida ingresso na entrada do cinema. O premissa da decisão original não cobre esse caso, então ela não decide esse caso. O code review da story registrou a lacuna como deferida; o teto entrou depois, a pedido, porque mineração de conta privilegiada custando zero é um degrau diferente de banda desperdiçada.
- **O que este teto não é**: fronteira de segurança. O endereço sai do primeiro elemento de `X-Forwarded-For` — necessário porque atrás do proxy do Render `getRemoteAddr()` devolveria o proxy e limitaria o mundo inteiro como um cliente só, mas falsificável por quem alcançar a API direto. Quem dispõe de muitos endereços passa por cima. A contagem vive na memória de um processo: reiniciar a API zera, e duas instâncias contam separado. O que ele entrega é encarecer o abuso casual, que antes custava zero. Conter abuso de verdade pede convite, verificação de e-mail ou contador compartilhado, e isso segue em `deferred-work.md`.
- **Como não regride**: `LimitadorDeCadastroTest` cobre a mecânica com relógio injetado (teto, insistência dentro da janela, virada da janela, independência por endereço, e o descarte de janelas vencidas — sem ele o mapa cresceria sob endereços forjados e o próprio limite viraria vetor de negação de serviço). `CadastroLimiteControllerTest` cobre o contrato HTTP com o limitador real e teto baixo: o 429 no envelope, a tentativa bloqueada não chegando ao serviço, endereços que não dividem teto, a leitura do primeiro elemento da cadeia de proxies, e corpo inválido não gastando cota. `AuthControllerTest` e `AuthSecurityTest` substituem o limitador por mock de propósito — lá o teto real reprovaria testes que nada têm a ver com limite.

---

## O canhoto imprime só o código curto, e é ele que o botão copiar entrega

- **Decisão**: nenhum dos três canhotos (emissão, carteira, página pública) imprime mais o código assinado `uuid.assinatura`, e o prefixo `ASSINADO ·` sai junto com ele. Em tela fica um código só, o curto de 8 caracteres, já no painel escuro ao lado do QR. O botão `⧉ COPIAR CÓDIGO` passa a entregar o curto em vez do assinado. `IngressoPublicoDto` ganha `codigoCurto` — sem isso a página pública seria a única das três sem código nenhum pra ditar. **Nada do back-end de validação muda**: o QR continua carregando o assinado, e `POST /api/portaria/validacoes` continua aceitando os dois formatos.
- **Por quê**: é o motivo pelo qual o código curto foi criado, levado até a interface. A entrada anterior (CAP-11) já registrava que digitar 36 caracteres mais uma assinatura Base64 na frente de uma fila não é algo que alguém faça; o canhoto continuava imprimindo exatamente isso, ocupando duas linhas do cartão com `break-all` pra não estourar no mobile. Era o mesmo ingresso em três formas ao mesmo tempo — QR, assinado e curto. Copiar seguia a mesma lógica invertida: entregava ao clipboard justamente o código que ninguém consegue usar à mão.
- **O assinado não desaparece**: ele continua dentro do QR, continua sendo o identificador de `GET /api/ingressos/{codigo}` e continua sendo conferido antes de qualquer consulta ao banco naquela rota (AD-8 intacto). O que ele deixa de ser é texto impresso.

### A fraqueza do código curto, aceita conscientemente

Isto não é ressalva de rodapé: é uma redução de segurança conhecida, escolhida de propósito para que a regra de negócio exista de fato. O que se aceita, explicitamente:

- São **40 bits de `SecureRandom` sem assinatura**, contra os ~256 bits inforjáveis da HMAC. Um código válido não pode ser derivado de nada — só sorteado —, mas é um segredo curto, não uma prova criptográfica.
- `POST /api/portaria/validacoes` **não tem rate limit**: quem tem token de operador tenta à vontade. O que segura é a razão de acerto, não o número de tentativas — só serve código da sessão do turno, e numa sala de 200 lugares isso é da ordem de 1 em 5,5 bilhões por chute.
- A barreira real passa a ser a autorização `@PreAuthorize("hasRole('PORTARIA')")`, e nesse caminho ela é **camada única**: a HMAC não está lá pra cobrir um erro de ordenação de matcher no `SecurityConfig` — classe de bug que este projeto já teve uma vez, documentada no comentário de `SecurityConfig` sobre `/api/ingressos/minhas`. `PortariaSecurityTest` fixa os quatro casos (sem token, `CLIENTE`, `ORGANIZADOR`, `PORTARIA`) justamente porque agora é essa checagem que sustenta o resto.
- Esta mudança **amplia onde ele circula**: passa a ser o que o botão copiar entrega e passa a aparecer no corpo da resposta pública, que não exige autenticação.

A troca é direta. Sem código curto, a portaria não tem plano B quando a câmera falha — tela riscada, celular sem bateria, luz ruim de saguão — e o requisito de validação manual vira letra morta. Com ele, o caminho principal (câmera + HMAC) segue intacto e a fraqueza fica contida num endpoint autenticado. **Mitigação pendente**, registrada em `deferred-work.md`: rate limit em `/validacoes`, reusando o padrão que `LimitadorDeCadastro` já estabeleceu no projeto.

### O que foi descartado junto

Unificar as duas credenciais — código curto virando o que o QR carrega e a única coisa que a portaria aceita — chegou a ser especificado e planejado em 9 tasks. A primeira delas foi implementada e revertida, porque sozinha fazia a portaria recusar todo QR já emitido: o canhoto continuava gravando o assinado. O plano inteiro foi então descartado e seus artefatos removidos do repositório.

O motivo de não retomar não foi o custo de execução, foi o que ele custava em desenho: a assinatura no portão é camada redundante barata, e removê-la deixaria a autorização como ponto único de falha em **todos** os caminhos de validação, não só no manual. O ganho de performance que a especificação alegava — uma HMAC por linha da carteira — já não existia: a paginação limita a resposta a 50 linhas (`Paginacao.TAMANHO_MAXIMO`), então o custo não cresce com o histórico do cliente. Sobrava simplificar `PortariaService.localizar()` de dois formatos para um, o que não paga o preço.

---

## A API sai do plano free do Render e vai pro `starter`

- **Decisão**: `rolo35-api` passa a rodar no plano `starter` (0.5 vCPU, US$ 7/mês) em vez do `free`. O Postgres e o Static Site do front continuam no free.
- **Por quê**: não foi preferência, foi medição. Rodando a imagem de produção num container com as restrições exatas do plano free — `--cpus=0.1 --memory=512m` —, o Spring Boot levou **179s** pra subir. O trabalho de startup é quase todo CPU-bound e single-thread (carga de ~10 mil classes em modo interpretado, metamodel do Hibernate, springdoc varrendo os controllers), então a 10% de um core cada etapa custa dezenas de vezes o normal; da linha do tempo do log, 83s vão até o Flyway terminar e outros 96s no que vem depois. Como o serviço free ainda dorme após 15 min sem tráfego, o efeito prático era uma falha certa: o `REQUEST_TIMEOUT_MS` de 90s do cliente HTTP do front aborta antes dos 179s, então **a primeira interação depois de qualquer pausa quebrava sozinha**, com a API subindo normalmente. Quem abrisse a aplicação pra avaliar veria erro de rede na primeira tentativa.
- **Por que não resolver de graça**: as alternativas foram consideradas e nenhuma paga melhor. Ping externo de keep-warm mantém o serviço acordado mas é infraestrutura fora do repositório, invisível pra quem clona e silenciosamente quebrável. `spring.main.lazy-initialization=true` e CDS na imagem encurtam o boot (~30% cada) sem eliminar a soneca — continuaria sendo uma corrida contra o timeout, só com margem melhor. Trocar de plataforma resolveria de verdade: o Cloud Run dá 1 vCPU no free, dez vezes o Render, com *startup CPU boost*. Mas custaria migrar o deploy inteiro, tirar o Postgres do Render e reescrever a documentação de execução a três dias do prazo — risco alto pra um ganho que US$ 7 compram sem tocar em nada.
- **O que muda no repositório**: uma linha em `render.yaml`. A RAM continua 512 MB, que já era folgada — o teste estabilizou em 318 MB, sem OOM.

---

## O mapa de assentos distingue o hold do próprio cliente, e reservar de novo cancela o anterior

- **Decisão**: `GET /api/sessoes/{id}/mapa-assentos` continua público, mas passa a aproveitar o token quando ele vem: assento segurado por quem fez a requisição volta com status `MEU_HOLD` em vez de `RESERVADO`, e a tela o entrega clicável e já selecionado. Junto disso, `ReservaService.reservar()` cancela a reserva `ATIVA` anterior do mesmo cliente naquela sessão e devolve os assentos dela, antes de travar os novos. `StatusReserva` ganha `CANCELADA` (migration `V14`).
- **Por quê**: o caminho mais banal do fluxo estava quebrado — escolher assentos, ir pro checkout e voltar pra trocar. O mapa não sabia quem perguntava, então os próprios assentos voltavam como `RESERVADO` e sem clique; o cliente ficava trancado fora do que ele mesmo segurava até o TTL de 10 minutos vencer, e não havia rota de liberar. Pior que o incômodo era o efeito no estoque: escolhendo assentos diferentes, o hold antigo seguia de pé, e os lugares abandonados ficavam bloqueados pra todo mundo por 10 minutos. Numa sessão cheia isso é venda perdida.
- **`MEU_HOLD` não é estado de banco**: a coluna `assento_sessao.status` continua com o `CHECK` de `LIVRE`/`RESERVADO`/`VENDIDO`. É status de leitura, calculado por requisição — depende de quem pergunta, então não faria sentido guardado. A projeção do mapa ganhou um `LEFT JOIN` em `reservas` pra saber o dono do hold; `LEFT` e não `INNER` porque assento livre tem `reserva_id` nulo e precisa continuar na lista.
- **A ordem do cancelamento é o que faz a troca funcionar**: liberar o hold anterior roda **antes** do lock dos assentos novos. Depois do lock, a checagem de disponibilidade ainda enxergaria o próprio hold do cliente e recusaria com `ASSENTO_INDISPONIVEL` — que é exatamente o sintoma original. E roda **depois** da validação de forma (AD-5): um clique com seleção inválida não pode destruir o hold que o cliente já tinha.
- **`CANCELADA` e não `RECUSADA`**: `RECUSADA` é desfecho de pagamento simulado, houve tentativa e resposta. Reaproveitar aquele valor faria o histórico do cliente registrar uma recusa que nunca existiu.
- **A busca do hold anterior devolve lista, não `Optional`**: antes deste fix o mesmo cliente acumulava várias reservas ativas na mesma sessão — era o próprio bug. Num banco com dados anteriores, `Optional` estouraria em vez de recolher a sujeira que existe.
- **Como não regride**: `SessaoServiceTest` cobre os cinco casos do status de leitura (hold próprio, hold de terceiro, visitante deslogado, hold próprio já vencido — que vira `LIVRE`, não `MEU_HOLD` — e assento vendido). `ReservaServiceTest` fixa o cancelamento, a ordem contra o lock e a seleção inválida não destruindo hold. `ReservaAssentoLockRepositoryTest` prova contra Postgres real que `liberarPorReserva` solta só os assentos daquela reserva e nunca um `VENDIDO`, que a busca ignora outro cliente e status não-`ATIVA`, e que o mapa traz o dono do hold sem perder os assentos livres. No front, `MapaAssentosPage.test.tsx` cobre o retorno com os assentos próprios selecionados e clicáveis, com o hold de terceiro seguindo bloqueado.

---

## A janela do turno da portaria vira configuração de ambiente, com o default sendo a regra real

- **Decisão**: os dois limites da janela em que a portaria pode ativar uma sessão como turno passam a vir de `portaria.turno.janela-antes-minutos` e `portaria.turno.janela-depois-horas`, com default `30` e `2` — exatamente os valores que o CAP-8 decidiu. O `docker-compose.yml` e o `.env.example` sobem o ambiente local com `PORTARIA_JANELA_ANTES_MINUTOS=20160` (14 dias). Produção não define a variável e fica no default.
- **Por quê**: com a janela estrita, a tela da portaria era inalcançável sem esperar o relógio. Todo o seed nasce com data futura — a V2 semeia a sete dias, a V10 e a V13 de dez a treze dias à frente —, então nenhuma sessão semeada cai dentro de 30min antes/2h depois de agora. O épico inteiro da portaria ficava sem caminho de teste manual: não dava pra selecionar turno, e sem turno não dá pra validar ingresso.
- **Por que configuração e não relaxar a regra**: a janela existe por segurança operacional, não por capricho — ativar a sessão errada faz a fila inteira ser recusada com ingresso legítimo na mão, e o CAP-8 registrou isso. Baixar o default resolveria o teste às custas do que vai pro ar. É o mesmo formato já usado pelo teto de cadastro (`CADASTRO_LIMITE_*`): o valor de operação mora no código, o ambiente ajusta quando precisa.
- **Por que não semear uma sessão perto de agora**: seria a alternativa óbvia, e ela decai. O seed roda uma vez, no primeiro boot; uma sessão ancorada em `now()` deixa de ser reservável assim que o horário passa (FR-10) e some da vitrine, virando lixo no catálogo dias depois. A variável não decai e não inventa dado.
- **Como não regride**: `PortariaServiceTest` fixa os dois lados — uma janela alargada por configuração aceita uma sessão a sete dias, que o default recusaria, e uma janela configurada continua recusando o que está fora dela. Os testes da regra real seguem construindo o service com `30` e `2` explícitos, então continuam aferindo operação, não conveniência.
