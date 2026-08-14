---
title: 'Código curto como credencial única do ingresso'
type: 'refactor'
created: '2026-08-14'
status: 'draft'
review_loop_iteration: 0
context: ['_bmad-output/implementation-artifacts/backlog-hardening/cap-11-codigo-curto-portaria.md']
baseline_commit: 'f2847d4887e618556cb7879828eb6877358cf6e2'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** O canhoto mostra o mesmo ingresso em três formas ao mesmo tempo — QR, o código assinado
`uuid.assinatura` em texto corrido, e o código curto de 8 caracteres. Redundância visível: o texto
longo ocupa duas linhas do cartão e ninguém digita aquilo. Por trás dela há uma redundância de
modelo: existem **duas** credenciais de validação aceitas em `POST /api/portaria/validacoes`, o
assinado e o curto, quando uma basta.

**Approach:** O código curto passa a ser a credencial única — é o que o QR carrega, o que a portaria
aceita e o que o botão copiar entrega. O código assinado por HMAC não desaparece: ele deixa de ser
credencial e vira exclusivamente o **token do link público**, que é a única superfície sem
autenticação do sistema e a única que ainda precisa de assinatura. Ele nunca mais é exibido em tela
nem trafega nos DTOs de lista.

**Why not simply drop the HMAC:** `GET /api/ingressos/{codigo}` é público, sem login. Se o
identificador dele virasse o código curto, a página pública ficaria enumerável por qualquer um —
8 caracteres, 40 bits, sem nenhum token de operador barrando a tentativa. A checagem de assinatura
antes de qualquer consulta ao banco (AD-8, `decisions.md` §"buscarPublico() valida a assinatura HMAC
antes de qualquer consulta") é justamente o que impede a rota de virar oráculo de existência. Essa
propriedade fica intacta.

**Why the short code is enough at the gate:** `POST /api/portaria/validacoes` exige token de papel
`PORTARIA`. Força bruta contra os 40 bits de `SecureRandom` ali pressupõe uma conta de operador
comprometida — cenário em que a HMAC não estaria protegendo nada de qualquer forma, porque o
operador vê os ingressos que valida. O raciocínio já estava escrito em
`CodigoIngressoService.gerarCodigoCurto()` (`:49-53`); esta mudança apenas leva ele até a conclusão.

**Bônus não-planejado:** `IngressoService.listarMinhas()` hoje computa uma HMAC **por linha** da
carteira — o próprio javadoc (`:43-47`) registra isso como custo que cresce com o histórico do
cliente. Tirando `codigo` do DTO de lista, esse custo some.

## Boundaries & Constraints

**Always:**
- `GET /api/ingressos/{codigo}` continua recebendo o código **assinado** e continua validando a
  assinatura antes de tocar o repositório. AD-8 preservado nesta rota, sem exceção.
- `GET /api/ingressos/{id}/link` exige autenticação **e** confere que o ingresso pertence a quem
  pede. Sem a checagem de dono, qualquer cliente logado cunharia link público de ingresso alheio.
- Ingresso não encontrado e ingresso de outro dono devolvem a **mesma** resposta em
  `/{id}/link` — mesma regra anti-oráculo já aplicada em `buscarPublico()` e em `INVALIDO`.
- A URL pública continua sendo montada num lugar só (`web/src/lib/ingressos.ts`), como hoje.
- O botão `⧉ COPIAR CÓDIGO` permanece na interface (pedido explícito), agora copiando o código curto.
- Handoff visual inalterado: VT323 (`font-mono`), bordas `#171219`, tracejado `#C7B694`.

**Ask First:** mudar o tamanho ou o alfabeto do código curto; remover o botão de copiar; tornar o
link público não-assinado.

**Never:** aceitar código assinado em `POST /api/portaria/validacoes`; exibir o código assinado em
qualquer tela; incluir o código assinado em DTO de listagem; editar `V11__codigo_curto_ingresso.sql`
já aplicada (quebraria o checksum do Flyway em banco local existente).

## Decisão sobre compatibilidade

Nada foi publicado: só existe dado de teste local. Portanto:

- **QRs já emitidos param de valer, e tudo bem.** Não há fallback depreciado, não há janela de
  transição, não há ramo de código aceitando assinado na portaria. "Só o curto é válido" é literal.
- **O backfill da V11 (`:9-15`) é irrelevante.** Ele derivava o código curto dos 8 primeiros hex do
  UUID — 32 bits, alfabeto de 16 — para ingressos preexistentes. Como `V2__seed.sql` não semeia
  `ingressos`, num banco novo a tabela está vazia quando a V11 roda e o `UPDATE` não afeta linha
  nenhuma. Nenhuma migration corretiva é necessária. Banco local que já tenha ingressos criados à mão
  antes da V11 se resolve recriando o banco.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Câmera lê o QR | QR do canhoto novo | Payload é o código curto canônico; portaria responde `VALIDO` | — |
| Câmera lê QR antigo | Payload `uuid.assinatura` | `INVALIDO` — o ramo do assinado não existe mais | Mesmo `INVALIDO` de sempre, sem motivo diferenciado |
| Digitação com tolerância | `sb68-xvzg`, `SB68 XVZG`, `S868XVZG` | `normalizarCodigoCurto()` canoniza (caixa, hífen, espaço, I/L→1, O→0) e valida | — |
| Digitação de tamanho errado | 7 ou 9 caracteres | `INVALIDO` sem consulta ao banco | — |
| Link público aberto | `/ingressos/<uuid>.<assinatura>` | Página renderiza dados da sessão **e** o canhoto com QR do código curto | Assinatura inválida → 404 `INGRESSO_NAO_ENCONTRADO`, sem tocar o banco |
| Link público adulterado | Assinatura trocada | 404, indistinguível de "não existe" | — |
| Compartilhar da carteira | Cliente dono clica | Link já resolvido no clipboard, sem `await` no handler | Falha de fetch → botão fica desabilitado com rótulo de erro |
| Pedir link de ingresso alheio | Cliente logado, `id` de outro | 404 `INGRESSO_NAO_ENCONTRADO` | Mesma resposta de id inexistente |
| Copiar código | Qualquer canhoto | Clipboard recebe os 8 caracteres, nunca `uuid.assinatura` | Rótulo `NÃO FOI POSSÍVEL COPIAR` |
| Carteira paginada | 12 ingressos na página | Resposta sem campo `codigo`; zero HMAC computada | — |

</frozen-after-approval>

## Code Map

**Back-end**

- `api/src/main/java/br/com/rolo35/api/ingressos/service/CodigoIngressoService.java` — `gerar()`
  (`:40-42`) vira `gerarTokenDeLink()`; javadoc de `gerarCodigoCurto()` (`:44-54`) precisa perder a
  frase "vale só em `POST /api/portaria/validacoes`... O QR, o link público e a leitura por câmera
  continuam usando exclusivamente o código assinado", que passa a ser falsa. `validar()` (`:88-101`)
  e `extrairId()` (`:106-116`) ficam como estão — servem só o link público agora.
- `api/src/main/java/br/com/rolo35/api/ingressos/service/PortariaService.java` — `localizar()`
  (`:134-166`) perde o ramo do assinado e a `Optional` dupla; sobra normalizar → 
  `findByCodigoCurtoForUpdate()`. O javadoc inteiro (`:134-146`) descreve a lógica de dois formatos e
  precisa ser reescrito. `SET LOCAL lock_timeout` e o `catch` de `PessimisticLockingFailureException`
  permanecem.
- `api/src/main/java/br/com/rolo35/api/ingressos/service/IngressoService.java` — `listarMinhas()`
  (`:43-58`) para de chamar `codigoIngressoService.gerar()`; javadoc (`:43-47`) reescrito, porque o
  custo que ele explicava deixa de existir. `buscarPublico()` (`:60-72`) passa a devolver também o
  código curto. Método novo `linkPublico(clienteEmail, ingressoId)` com checagem de dono.
- `api/src/main/java/br/com/rolo35/api/ingressos/dto/IngressoResumoDto.java` (`:16`) — remove
  `codigo`.
- `api/src/main/java/br/com/rolo35/api/ingressos/dto/IngressoPublicoDto.java` — **ganha**
  `codigoCurto`. Quem recebeu o link compartilhado é quem vai entrar na sala; sem o campo a página
  pública não tem o que colocar no QR. Não é vazamento novo: hoje o link já contém a credencial de
  validação na própria URL.
- `api/src/main/java/br/com/rolo35/api/ingressos/controller/IngressoController.java` (`:40-43`) —
  rota nova `GET /{id}/link` com `@PreAuthorize("hasRole('CLIENTE')")`, devolvendo o **token**
  (`{ "codigo": "<uuid>.<assinatura>" }`), não a URL montada — quem monta a URL continua sendo
  `web/src/lib/ingressos.ts`, num lugar só.
  Sobre `SecurityConfig` (`:77-87`): o `permitAll` público é
  `.requestMatchers(HttpMethod.GET, "/api/ingressos/*")`, e `*` casa **um** segmento. `/{id}/link`
  tem dois, então não casa o wildcard e cai no `.anyRequest().authenticated()` — seguro por padrão,
  sem mudança obrigatória. Ainda assim vale um matcher explícito, porque a proteção estar vindo de um
  fallback é frágil demais para uma rota que cunha credencial. E vale um teste em
  `PortariaSecurityTest` (ou irmão) fixando isso, pelo mesmo motivo da Story 4.2.
- `api/src/main/java/br/com/rolo35/api/pagamentos/dto/IngressoDto.java` (`:11`) — remove `codigo`;
  javadoc (`:5-10`) reescrito.
- `api/src/main/java/br/com/rolo35/api/pagamentos/service/PagamentoService.java` — `paraDto()`
  (`:135-141`) para de assinar. A emissão em `:106-110` já grava `gerarCodigoCurto()`, sem mudança.

**Front-end**

- `web/src/components/CanhotoIngresso.tsx` — prop `codigo` (`:4-17`) vira `codigoCurto` obrigatório;
  `QRCodeSVG value` (`:42-49`) passa a receber o curto. O `codigoCurto` deixa de ser opcional porque
  a página pública agora também o recebe (`:11-15` some). Payload de ~80 para 8 caracteres derruba a
  versão do QR — reavaliar se `size={196}` ainda é o valor certo com muito menos módulos.
- `web/src/components/AcoesDoIngresso.tsx` (`:34-64`) — props passam a ser `codigoCurto` +
  `linkPublico`. Copiar entrega o curto; compartilhar usa o link já resolvido pelo chamador. Javadoc
  (`:22-33`) reescrito: a justificativa atual ("selecionar `uuid.assinatura` com o dedo é inviável")
  morre com o código longo, e o botão sobrevive por outro motivo — evitar erro de transcrição ao
  colar num aplicativo de mensagem.
- `web/src/components/CanhotoEmitido.tsx` (`:50`) — remove a linha `CÓDIGO {ingresso.codigo}`; a
  linha seguinte (`:51-53`) perde o prefixo `ASSINADO ·`, que descrevia o código removido.
- `web/src/pages/MeusIngressosPage.tsx` (`:119-126`) — mesma remoção; `DetalheIngresso` (`:93-132`)
  resolve o link antes de renderizar `AcoesDoIngresso`.
- `web/src/pages/IngressoPublicoPage.tsx` (`:93-99`) — mesma remoção; o link compartilhável aqui é a
  própria URL da página, sem chamada nova.
- `web/src/api/ingressos.ts` (`:4-16`, `:18-23`) — `IngressoResumo` perde `codigo`,
  `IngressoPublico` ganha `codigoCurto`, função nova para `GET /api/ingressos/{id}/link`.
- `web/src/lib/ingressos.ts` (`:1-8`) — `urlPublicaDoIngresso()` inalterada, mas o comentário
  "é o que o botão de compartilhar copia **e o que o QR carrega**" fica falso: o QR não carrega mais
  URL nenhuma.
- `web/src/pages/ValidacaoPortariaPage.tsx` (`:169-173`) — dica vira só os 8 caracteres; o comentário
  acima dela, que trata o curto como plano B, precisa dizer que agora é o único caminho.

**Testes**

- `web/src/pages/ContratoQrPortaria.test.tsx` — o contrato **inverte**. `extrairIdComoOBackendFaz()`
  (`:49-62`) deixa de ser a regra do servidor e sai. O arquivo passa a provar: o QR carrega os 8
  caracteres, não carrega URL, não carrega `uuid.assinatura`, e a portaria envia exatamente o que foi
  lido. O teste `:129-135` (guarda contra o QR virar URL) continua valendo e ganha um irmão contra o
  QR voltar a ser o assinado. Preservar o javadoc de topo (`:11-22`): a história de por que o arquivo
  existe continua verdadeira.
- `api/.../ingressos/service/PortariaServiceValidacaoTest.java` e
  `api/.../ingressos/service/PortariaServiceTest.java` — casos que validam por código assinado passam
  a esperar `INVALIDO`.
- `api/.../ingressos/PortariaValidacaoConcorrenciaTest.java` — as duas threads passam a disputar por
  código curto. É o teste que prova o invariante de não-validação-dupla contra Postgres real; o lock
  agora é adquirido via `findByCodigoCurtoForUpdate()`, caminho que antes só era exercitado pela
  digitação manual.
- `api/.../ingressos/PortariaSecurityTest.java` — ganha o caso da rota nova sem token.
- `api/.../IngressoServiceTest`, `PagamentoServiceTest`, `PagamentoControllerTest` — DTOs sem
  `codigo`; testes novos para `linkPublico()`: dono, não-dono, id inexistente.
- `web/src/pages/PagamentoPage.test.tsx` (`:107-110`), `MeusIngressosPage.test.tsx` (`:157`),
  `IngressoPublicoPage.test.tsx` (`:77`) — hoje afirmam a presença do texto longo; passam a afirmar a
  ausência dele e a presença do curto.

**Documentação**

- `docs/decisions.md` — entrada nova emendando AD-8: a assinatura sai da validação e fica só no link
  público. Referenciar a decisão da Story 4.2 e a emenda do code review do Epic 5 (`:549`), que fica
  superada.
- `docs/regras-de-negocio.md` (`:191-218`, `:255`, `:261-264`) — quatro afirmações ficam falsas: "o
  código do ingresso é UUID + assinatura", "assinatura conferida antes de qualquer lock", "QR é
  gerado a partir do código assinado", "a URL que ele carrega é montada num único lugar".
- `README.md` — `grep` por `assinatura`/`HMAC`/`código` antes de fechar.

## Tasks & Acceptance

**Execution (ordem sugerida — back antes de front, contrato antes de tela):**
- [ ] `CodigoIngressoService` — renomear `gerar()` → `gerarTokenDeLink()`; corrigir os dois javadocs.
- [ ] `PortariaService.localizar()` — remover o ramo do assinado; reescrever javadoc. Teste RED→GREEN
      provando que código assinado agora devolve `INVALIDO`.
- [ ] `IngressoResumoDto` / `IngressoDto` — remover `codigo`; ajustar `listarMinhas()` e `paraDto()`.
- [ ] `IngressoPublicoDto` — adicionar `codigoCurto`; ajustar `buscarPublico()`.
- [ ] `IngressoService.linkPublico()` + `GET /api/ingressos/{id}/link` — com checagem de dono e a
      mesma resposta para não-dono e inexistente. Conferir a ordem em `SecurityConfig`.
- [ ] `web/src/api/ingressos.ts` — tipos e função nova.
- [ ] `CanhotoIngresso` — QR passa a carregar o curto; `codigoCurto` obrigatório; reavaliar `size`.
- [ ] `AcoesDoIngresso` — props `codigoCurto` + `linkPublico`; copiar entrega o curto; javadoc novo.
- [ ] Três canhotos — remover a linha do código longo e o prefixo `ASSINADO ·`.
- [ ] `MeusIngressosPage` / `PagamentoPage` — resolver o link antes de renderizar as ações.
- [ ] `ValidacaoPortariaPage` — dica e comentário.
- [ ] `ContratoQrPortaria.test.tsx` — inverter o contrato, preservando o javadoc de topo.
- [ ] Suítes de back e front citadas no Code Map.
- [ ] `docs/decisions.md`, `docs/regras-de-negocio.md`, `README.md`.

**Acceptance Criteria:**
- Given um ingresso emitido, when a câmera da portaria lê o QR, then a validação responde `VALIDO` e
  o payload lido tem 8 caracteres.
- Given um código `uuid.assinatura`, when enviado a `POST /api/portaria/validacoes`, then a resposta é
  `INVALIDO` — não `VALIDO`, não erro de formato distinguível.
- Given a carteira paginada, when a resposta é inspecionada, then não existe campo `codigo` e nenhuma
  HMAC foi computada.
- Given um cliente autenticado, when pede o link de um ingresso que não é dele, then recebe a mesma
  resposta que receberia para um id inexistente.
- Given um código com assinatura adulterada, when aberto em `/ingressos/{codigo}`, then 404 sem que a
  consulta chegue ao repositório — AD-8 intacto.
- Given qualquer um dos três canhotos, when renderizado, then `uuid.assinatura` não aparece em lugar
  nenhum do DOM.
- Given o botão copiar, when clicado, then o clipboard recebe exatamente os 8 caracteres.

## Design Notes

**A armadilha do clipboard no Safari.** O handler de compartilhar não pode virar
`async () => { const l = await buscarLink(id); copiar(l) }`. WebKit exige que a escrita no clipboard
aconteça na mesma tarefa do gesto do usuário; depois de um `await`, a permissão implícita já foi
embora e a cópia falha silenciosamente. Por isso o link é resolvido **antes** — quando o canhoto
monta — e o handler continua síncrono:

```tsx
// AcoesDoIngresso recebe o link já pronto; quem monta o canhoto é que busca.
<AcoesDoIngresso codigoCurto={ingresso.codigoCurto} linkPublico={link} />
```

Na página pública não há busca nenhuma: o link é a própria URL. Na carteira e na tela de pagamento é
uma chamada por canhoto renderizado em detalhe — não por linha de lista, que é o que importa.

**Por que um endpoint em vez de deixar o assinado no DTO.** Deixar `codigo` no DTO e apenas não
renderizar (a opção C descartada) manteria a credencial de link trafegando em toda listagem, e
manteria a HMAC por linha que o javadoc de `listarMinhas()` já apontava como custo. O endpoint troca
isso por uma chamada sob demanda, no único momento em que o valor é realmente usado.

**O QR encolhe.** `uuid.assinatura` são ~80 caracteres; o código curto são 8. O QR cai de uma versão
alta para uma bem baixa — muito menos módulos, cada um muito maior no mesmo `size={196}`. Isso é
ganho de leitura em tela riscada ou com brilho baixo, que é exatamente o cenário que motivou o código
curto existir. Manter `marginSize={4}`: a zona de silêncio continua obrigatória dentro do próprio SVG
(nota da Story 4.2 em `decisions.md:489`).

**O que sobra da AD-8.** Ela não é revogada, é reduzida ao seu núcleo defensável: assinatura existe
para proteger a superfície **não autenticada**. Onde há token de operador, a assinatura era proteção
duplicada — e o custo dela era um código de 80 caracteres impresso num canhoto de cinema, que foi o
sintoma que abriu esta mudança.

## Verification

**Commands:**
- `./mvnw -f api/pom.xml test` — expected: suíte verde, incluindo o RED→GREEN da portaria
- `npx vitest run` (a partir de `web/`, com `NODE_OPTIONS` exportada antes — o script `npm test`
  usa sintaxe de atribuição inline que falha no PowerShell)
- `npm run lint --prefix web` — expected: zero erro
- `npm run build --prefix web` — expected: `tsc -b` sem erro de tipo; a remoção de `codigo` dos tipos
  deve fazer o compilador apontar todos os usos remanescentes
