# Registro de decisões — Rolo 35

Log leve de decisões não-triviais tomadas durante a implementação. Alimenta as
seções de Uso de IA e Decisões técnicas do README final.

---

## [exemplo] Nome curto da decisão

- **Decisão**: o que foi decidido.
- **Por quê**: motivo ou trade-off considerado.

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

## Deploy Render + Vercel, aceitando limitação de free tier

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

- **Decisão**: pacotes Java organizados por domínio primeiro (`sessoes`, `reservas`, `pagamentos`, `ingressos`, `auth`), cada um contendo suas próprias camadas `controller/service/repository` — não um pacote `controller`/`service`/`repository` único guardando classes de todos os domínios. Camadas dentro de cada pacote de domínio seguem o non-negotiable já fixado no CLAUDE.md (controller → service → repository, sem regra de negócio no controller). Direção de dependência entre pacotes: `{pagamentos, ingressos} → reservas → sessoes → auth` (`A → B` = "A depende de B") — `auth` não depende de nenhum outro domínio, `pagamentos` depende de `reservas` (precisa travar/ler `Reserva` na confirmação de pagamento), `ingressos` depende de `reservas` e `pagamentos` — nunca o inverso.
- **Por quê**: com 6+ entidades caindo em ~5 áreas de domínio bem distintas e a prática de fatia vertical por feature (XP/TDD do projeto), empacotar por domínio mantém uma feature inteira dentro de um diretório — commits ficam localizados, revisão fica mais fácil, e reduz o risco de uma mudança de feature espalhar por três pacotes técnicos dispersos. A direção de dependência fixada evita que dois pacotes de domínio construídos em momentos diferentes acabem se importando um ao outro em ciclo.

---

## Camada `api/` dedicada no front, sem fetch direto em componente

- **Decisão**: SPA React acessa o back-end só através de uma camada `api/` própria — um módulo por domínio (`api/sessoes.ts`, `api/reservas.ts`, `api/pagamentos.ts`, `api/ingressos.ts`, `api/auth.ts`) exportando funções tipadas que encapsulam o `fetch`. Componente nunca chama `fetch` direto.
- **Por quê**: TypeScript estrito é non-negotiable do CLAUDE.md — fetch espalhado por componente arrisca cada tela inventar sua própria forma de tipar a resposta. Além disso, a camada central é o lugar natural pra anexar o JWT condicionalmente (rotas públicas vs autenticadas) e parsear o envelope de erro do back-end uma vez só, reaproveitado por toda tela — o que sustenta o NFR de loading/vazio/erro tratados em toda tela que busca dado. Espelha, um nível acima, a regra já fixada de que o back-end é fronteira exclusiva pro TMDb.

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
- **Por quê**: HMAC gera um QR mais curto e simples que JWT, importante pra leitura confiável numa fila real de portaria — e como a validação sempre precisa ir ao banco pra checar o status mutável ("já utilizado"), duplicar `sessao_id` como claim de JWT não compraria nada, já que esse dado vem de graça na mesma consulta. Separar a rota de leitura pública da rota de validação é o que impede o link de compartilhamento virar bypass da portaria — non-negotiable explícito do CLAUDE.md.

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
- **Por quê**: o `epics.md` já tinha decidido não ter story de UX dedicada, tratando a identidade visual como requisito transversal de cada story de UI — reabrir isso com uma sessão de UX completa consumiria tempo do prazo de 7 dias sem ganho proporcional, já que o CLAUDE.md já descreve a direção qualitativa da paleta e tipografia. Definir os tokens concretos agora, no exato momento em que o Tailwind é configurado pela primeira vez, evita que cada tela futura hardcode cor solta e precise de retrabalho de retrofit quando o tema for aplicado depois. Fontes self-hosted (`@fontsource`) em vez de CDN do Google Fonts pra manter o build da SPA autocontido, sem round-trip de rede externa no boot.

---

## `RestClient` injetado via `spring-boot-starter-restclient`, não construído na mão

- **Decisão**: `TmdbClient` (proxy TMDb da Story 1.2) recebe `RestClient.Builder` por injeção de dependência padrão do Spring — construtor único, `TmdbClient(RestClient.Builder builder, @Value("${tmdb.api.token}") String apiToken)`. Isso exigiu adicionar a dependência `spring-boot-starter-restclient` ao `pom.xml`. Timeout de conexão/leitura configurado via propriedade padrão do Boot (`spring.http.clients.connect-timeout`/`spring.http.clients.read-timeout` em `application.properties`), não em código. Revisa uma primeira tentativa (dentro da mesma story, antes do commit) em que `TmdbClient` construía o próprio `RestClient` na mão, com dois construtores — um de produção, um package-private só pra permitir teste com `MockRestServiceServer` — justamente pra evitar essa dependência nova.
- **Por quê**: `spring-boot-starter-webmvc` traz a *classe* `RestClient` (via `spring-web`), mas não autoconfigura o *bean* `RestClient.Builder` — isso só vem do módulo `spring-boot-restclient`. A primeira tentativa evitou essa dependência, mas o custo disso foi maior que o benefício: código não-idiomático (dois construtores, um deles existindo só pra contornar teste), timeout hard-coded em vez de configurável por ambiente, e — o motivo decisivo — esse padrão de "construir `RestClient` na mão" teria que ser **reaprendido e reaplicado** em qualquer story futura que precise falar com uma segunda API externa, herdando a mesma gambiarra em vez de reusar um caminho padrão já resolvido pelo framework. `spring-boot-starter-restclient` é um módulo oficial do próprio Spring Boot (não uma lib terceira) — o custo real de adicioná-lo (uma linha no `pom.xml`, baixo risco de CVE/manutenção) é pequeno perto do ganho.

---
