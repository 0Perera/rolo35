---
stepsCompleted: [1, 2, 3, 4, 5, 6]
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-rolo35-2026-08-09/prd.md
  - _bmad-output/planning-artifacts/architecture/architecture-rolo35-2026-08-10/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/epics.md
---

# Implementation Readiness Assessment Report

**Date:** 2026-08-10
**Project:** rolo35

## Document Discovery

**PRD:**
- Whole: `prds/prd-rolo35-2026-08-09/prd.md` (29.5 KB, modificado 2026-08-10)

**Architecture:**
- Whole: `architecture/architecture-rolo35-2026-08-10/ARCHITECTURE-SPINE.md` (20.4 KB, modificado 2026-08-10)

**Epics & Stories:**
- Whole: `epics.md` (32.3 KB, modificado 2026-08-10)

**UX Design:**
- Não encontrado. Confirmado no próprio `epics.md`: sem documento de UX Design separado neste projeto — identidade visual fixada como non-negotiable direto no PRD §6 e nas instruções do projeto.

## Issues Found

- Nenhum duplicado (whole + sharded) para nenhum tipo de documento.
- UX Design ausente — esperado e já justificado, não é falha de descoberta.

## PRD Analysis

### Functional Requirements

FR-1: Login e papel fixo por conta — usuário autentica via JWT e recebe um único papel fixo (`ORGANIZADOR`, `CLIENTE` ou `PORTARIA`) associado à conta; conta não acumula mais de um papel; token carrega o papel e toda rota valida no back-end.

FR-2: Autorização por dono do recurso — organizador só edita/gerencia sessões que ele mesmo criou, inclusive na própria listagem; edição/gestão de sessão de outro organizador é rejeitada mesmo com token válido de `ORGANIZADOR`.

FR-3: Exploração pública do catálogo sem cadastro — listagem de sessões (FR-8) e mapa de assentos (FR-9) respondem sem token; tentativa de reserva (FR-10) sem autenticação como `CLIENTE` é rejeitada.

FR-4: Busca de filmes via proxy TMDb — endpoint próprio do back-end faz proxy pro TMDb; chave TMDb nunca chega ao client nem aparece em resposta alguma; resposta expõe só título, pôster, sinopse, data de estreia.

FR-5: Criação de sessão — organizador vincula filme (catálogo TMDb), sala (mapa de assentos existente), data/hora futura e preço; data/hora no passado é rejeitada; capacidade é derivada do mapa da sala, não um número livre.

FR-6: Bloqueio de conflito de horário na sala — sistema rejeita criação de sessão cuja sala já tem outra sessão com sobreposição de horário; sob duas criações concorrentes pra mesma sala/horário (Testcontainers), exatamente uma é aceita, garantido por constraint/lock de banco — mesma classe de proteção da FR-11.

FR-7: Edição de sessão com trava pós-venda — assim que houver ≥1 ingresso confirmado, todos os campos (data, sala/capacidade, preço, título, sinopse) ficam bloqueados, sem exceção; antes do primeiro ingresso confirmado, todos os campos seguem editáveis.

FR-8: Listagem de sessões publicadas — sessão esgotada não some da listagem, aparece marcada como esgotada.

FR-9: Mapa de assentos da sessão — distingue três estados por assento (livre, reservado temporariamente, vendido/pago), visualmente distinguíveis; resposta não inclui identidade do cliente que reservou/comprou (endpoint público).

FR-10: Reserva de assento(s) — cliente seleciona 1 a 6 assentos livres; a seleção já cria um hold de 10 min sobre cada assento; reserva não confirmada em 10 min libera os assentos; reserva de múltiplos assentos é atômica (sem hold parcial se qualquer assento já está indisponível); seleção de assento já ocupado é rejeitada com erro claro, cliente permanece no mapa da mesma sessão, recarregado.

FR-11: Não venda duplicada de assento — garantida via constraint/lock de banco; sob duas requisições concorrentes pro mesmo assento/sessão (Testcontainers), exatamente uma é aceita e a outra falha de forma determinística.

FR-12: Pagamento simulado com parâmetro de teste — cliente confirma pagamento de reserva ativa e própria; parâmetro de teste decide aprovação/recusa; aprovação emite ingresso(s); recusa não emite ingresso e libera o(s) assento(s) imediatamente; confirmação de reserva de outro cliente é rejeitada; confirmação de reserva já expirada é rejeitada mesmo que o assento ainda não tenha sido re-reservado — sob a corrida testada com Testcontainers (expiração de reserva A concorrente com criação/confirmação de reserva B pro mesmo assento), no máximo um ingresso válido existe ao final.

FR-13: Confirmação de pagamento idempotente — duas confirmações concorrentes da mesma reserva não geram ingressos duplicados; sob parâmetros de teste conflitantes entre as duas chamadas concorrentes, resultado final é determinístico e consistente entre estado persistido e resposta dada a cada chamador — nunca existe estado em que ingresso é emitido E assento é liberado pra mesma reserva.

FR-14: Emissão de ingresso com QR assinado — código assinado (HMAC/JWT), não ID incrementável; assinatura é validada recomputando a partir do secret, não só existência de registro; UUID opaco sem assinatura verificável não satisfaz a FR; código com assinatura adulterada é rejeitado independente de existir linha no banco; N assentos confirmados geram N ingressos independentes.

FR-15: "Meus ingressos" — cliente autenticado lista só os ingressos vinculados à própria conta; não vê ingresso de outra conta.

FR-16: Link público do ingresso — somente leitura, sem login, sem expiração; expõe só filme/sessão/estado do próprio ingresso; usa o mesmo código assinado não-sequencial da FR-14 (não enumerável); não valida/consome o ingresso, sem bypass do fluxo de portaria.

FR-17: Seleção de sessão do turno — portaria seleciona a sessão ativa antes de validar; validação sem sessão selecionada não é permitida.

FR-18: Leitura de ingresso por câmera (via navegador, sem app nativo) ou digitação manual — ambos os caminhos produzem o mesmo resultado pro mesmo código.

FR-19: Retorno de validação inequívoco — exatamente um de: válido, inválido, já utilizado, evento errado (ingresso de outra sessão retorna "evento errado", não "inválido" genérico); requisição com papel `CLIENTE`/`ORGANIZADOR` é rejeitada independente de sessão/código; resposta não inclui dado do cliente além do necessário à decisão operacional (sem e-mail, telefone, dado de pagamento).

FR-20: Não validação duplicada de ingresso — garantida via constraint/lock de banco; sob duas validações concorrentes do mesmo ingresso (Testcontainers), exatamente uma retorna "válido" e a outra "já utilizado".

**Total FRs: 20**

### Non-Functional Requirements

NFR-1 (Interface): Toda tela que busca dado (listagem de sessões, mapa de assentos, "Meus ingressos", busca de filme) trata três estados explícitos: carregando, lista vazia, erro — nenhuma tela mostra vazio/quebrado por omissão.

NFR-2 (Segurança): Código do ingresso carrega assinatura (HMAC/JWT), nunca só um ID (FR-14).

NFR-3 (Segurança): Autorização checada em toda requisição no back-end, sem exceção pras rotas de portaria (§4.1, §4.8).

NFR-4 (Segurança): Toda resposta de API é serializada a partir de DTO explícito por endpoint, nunca da entidade JPA/registro de banco diretamente — nenhum campo chega ao cliente sem estar explicitamente listado no contrato do endpoint.

NFR-5 (Segurança): Segredos (chave TMDb, secret JWT, credenciais de banco) só em variável de ambiente — nunca commitados, nunca no bundle do client (FR-4).

NFR-6 (Concorrência/Integridade): Não-venda-duplicada de assento e não-validação-duplicada de ingresso resolvidas com constraint/lock de banco, não checagem de aplicação (FR-11, FR-20).

NFR-7 (Concorrência/Integridade): Confirmação de pagamento idempotente sob concorrência (FR-13).

NFR-8 (Dados/Performance): Índices nas colunas usadas em filtro/join das telas — busca de sessão por data/local, lookup de ingresso por hash do código.

NFR-9 (Dados/Performance): Sem N+1 nas listagens que juntam dado relacionado (ex.: sessões com filme e sala).

NFR-10 (Testes): Estratégia de teste por camada — unitário (regra de negócio pura, JUnit+Mockito sem contexto Spring), `@WebMvcTest` (endpoint/autorização, service mockado), Testcontainers restrito aos dois cenários de concorrência (FR-11, FR-20) + smoke tests de repository.

NFR-11 (Deploy): API + Postgres no Render free (dorme após 15min sem tráfego, ~1min pra acordar; Postgres expira — checar prazo no dashboard); front na Vercel; Docker Compose local (Postgres+API) como fallback garantido.

**Total NFRs: 11**

### Additional Requirements

- **Constraint de processo (§7):** primeira story deve ser fatia vertical fina do fluxo completo (login → busca de filme → reserva → pagamento simulado → ingresso com QR → validação na portaria), cada etapa no mínimo viável — fatiar por funcionalidade/tela só depois dessa fatia rodar ponta a ponta.
- **Constraint de processo (§7):** non-negotiables de segurança das instruções do projeto como critério de aceite explícito por story que os toca, não implícito.
- **Constraint de processo (§7):** estratégia de teste por camada (tabela §5) replicada nos critérios de aceite de cada story.
- **Identidade visual (§6):** tema cinema clássico anos 80/90 (contagem regressiva como transição/loading, perfuração de película como moldura/divisor, paleta sépia/âmbar+vermelho veludo+dourado, tipografia estilo marquise) — non-negotiable, não polimento de fim de sprint.
- **Open question §11.1** (resolvida na Architecture): mecanismo de expiração da reserva (lazy vs. job agendado) — decidido lazy (AD-4).
- **Open question §11.2** (resolvida na Architecture): formato do parâmetro de teste do pagamento simulado — decidido campo `resultadoSimulado` no corpo do POST (AD-7).
- **Non-Goals explícitos (§8):** nota fiscal, revenda de ingresso, app nativo, recuperação de senha, envio de ingresso por e-mail, cancelamento de ingresso confirmado.
- **Out of Scope MVP (§9.2):** busca/filtro avançado de sessões, painel do organizador além do CRUD básico, mapa de assentos em tempo real (WebSocket).

### PRD Completeness Assessment

PRD é enxuto e denso — cada FR carrega "Consequences (testable)" que já funcionam como pré-AC, o que facilitou bastante a escrita das stories. Rastreabilidade interna é forte: FRs citam FRs relacionados (ex. FR-6 cita FR-11), Success Metrics (§10) apontam de volta pras FRs que validam, e a seção de Assumptions (§12) documenta o que foi inferido vs. confirmado. As duas Open Questions (§11) já vieram resolvidas na Architecture Spine (AD-4, AD-7), sem pendência aberta chegando neste ponto do processo. Nenhuma lacuna de completude encontrada nesta leitura.

## Epic Coverage Validation

### Epic FR Coverage Extracted

Do `## FR Coverage Map` de `epics.md`, todos os 20 FRs aparecem mapeados 1:1 a um épico, sem sobra nem buraco na tabela. Total de FRs referenciados em epics.md: 20.

### FR Coverage Analysis

| FR Number | PRD Requirement (resumo) | Epic Coverage | Status |
|---|---|---|---|
| FR-1 | Login com papel fixo via JWT | Epic 1 / Story 1.1 | ✓ Covered |
| FR-2 | Autorização por dono do recurso | Epic 2 / Story 2.1 (vínculo na criação) + Story 2.2 (listagem/edição restrita ao dono) | ✓ Covered |
| FR-3 | Exploração pública sem cadastro | Epic 2 / Story 2.3 (listagem sem token) + Epic 3 / Story 3.1 (mapa sem token) + Story 3.2 (reserva sem `CLIENTE` rejeitada) | ✓ Covered |
| FR-4 | Busca de filme via proxy TMDb | Epic 1 / Story 1.2 | ✓ Covered |
| FR-5 | Criação de sessão | Epic 2 / Story 2.1 | ✓ Covered |
| FR-6 | Bloqueio de conflito de horário na sala | Epic 2 / Story 2.1 | ✓ Covered |
| FR-7 | Trava de edição pós-venda | Epic 2 / Story 2.2 | ✓ Covered |
| FR-8 | Listagem de sessões publicadas (esgotada) | Epic 2 / Story 2.3 | ✓ Covered |
| FR-9 | Mapa de assentos com 3 estados | Epic 3 / Story 3.1 | ✓ Covered |
| FR-10 | Reserva de assento(s) com hold 10min | Epic 3 / Story 3.2 | ✓ Covered |
| FR-11 | Não venda duplicada de assento | Epic 3 / Story 3.2 | ✓ Covered |
| FR-12 | Pagamento simulado com parâmetro de teste | Epic 4 / Story 4.1 | ⚠️ Covered parcialmente — ver gap abaixo |
| FR-13 | Confirmação de pagamento idempotente | Epic 4 / Story 4.1 | ✓ Covered |
| FR-14 | Emissão de ingresso com QR assinado | Epic 4 / Story 4.1 | ✓ Covered |
| FR-15 | "Meus ingressos" | Epic 4 / Story 4.2 | ✓ Covered |
| FR-16 | Link público do ingresso | Epic 4 / Story 4.2 | ✓ Covered |
| FR-17 | Seleção de sessão do turno | Epic 5 / Story 5.1 | ✓ Covered |
| FR-18 | Leitura por câmera ou digitação | Epic 5 / Story 5.2 | ✓ Covered |
| FR-19 | Retorno de validação inequívoco | Epic 5 / Story 5.2 | ✓ Covered |
| FR-20 | Não validação duplicada de ingresso | Epic 5 / Story 5.2 | ✓ Covered |

Nenhum FR presente em epics.md que não exista no PRD (sem "scope creep" de requisito inventado).

### Missing Requirements

Nenhum FR está sem cobertura de épico/story. Um gap de granularidade de AC (não de cobertura de FR) foi encontrado:

**FR-12 — cenário de corrida específico não coberto na AC da Story 4.1**

O texto do PRD (FR-12, consequence 4) exige um cenário de concorrência mais específico do que o testado hoje: *"confirmação de pagamento de uma reserva cujo TTL já expirou é rejeitada, mesmo que o assento ainda não tenha sido formalmente liberado/re-reservado por outro cliente [...] sob essa corrida testada com Testcontainers (expiração de reserva A concorrente com criação e confirmação de nova reserva B pro mesmo assento), no máximo um ingresso válido existe pro assento/sessão ao final."*

A Story 4.1 hoje cobre: (a) reserva expirada isolada é rejeitada, e (b) duas confirmações concorrentes da *mesma* reserva são idempotentes (isso é FR-13). O que falta é o cenário cruzado: reserva A expirando *enquanto* uma reserva B nova é criada e confirmada pro *mesmo assento* — garantir que no máximo um ingresso válido sobra pro assento, mesmo com a confirmação atrasada de A chegando depois de B já ter sido confirmada.

- **Impact:** este é exatamente o tipo de corrida que os non-negotiables de segurança das instruções do projeto miram (não-venda-duplicada de assento) — é uma variação do FR-11 cruzada com o fluxo de pagamento, não coberta pelo teste de concorrência já desenhado em Story 3.2 (que testa reserva vs. reserva, não confirmação-atrasada vs. nova-reserva).
- **Recommendation:** adicionar uma AC (e cenário Testcontainers) à Story 4.1 cobrindo especificamente: reserva A com TTL expirado + reserva B nova criada e confirmada pro mesmo assento, concorrentes → no máximo um ingresso válido existe ao final para aquele assento/sessão.

### Coverage Statistics

- Total PRD FRs: 20
- FRs cobertos em epics.md: 20/20 (100%)
- FRs com cobertura completa de AC: 19/20 — FR-12 com gap de granularidade documentado acima
- Épicos/stories inventando requisito fora do PRD: nenhum

## UX Alignment Assessment

### UX Document Status

Não encontrado — busca por `*ux*.md` e `*ux*/index.md` em `{planning_artifacts}` não retorna nada. Confirma o que `epics.md` já registrou na extração de requisitos: projeto optou deliberadamente por não ter UX Design Spec separado, com a identidade visual fixada direto no PRD §6 (tema cinema clássico anos 80/90, contagem regressiva, perfuração de película, paleta sépia/âmbar+vermelho veludo+dourado, tipografia marquise) e nas instruções do projeto.

### Alignment Issues

Sem documento de UX, não há um par PRD↔UX pra checar por si só — mas a UI está claramente implicada (SPA com múltiplas telas: login, busca de filme, mapa de assentos, checkout simulado, "Meus ingressos", painel de portaria com câmera). Verificando PRD ↔ Architecture nos pontos que normalmente um doc de UX cobriria:

- **Coberto pela Architecture:** estrutura da SPA (`web/src/`), camada `api/` por domínio (AD-2), autenticação Bearer+`localStorage` (AD-10), timeout de `fetch` tolerante ao cold start do Render — decisões técnicas de front-end que sustentam os NFRs de interface (NFR-1: carregando/vazio/erro).
- **Gap real encontrado — leitura de QR por câmera (FR-18):** nem o PRD, nem a Architecture Spine, nem a AC da Story 5.2 registram *como* a leitura de QR via câmera do navegador será implementada (biblioteca de decodificação — ex. `jsQR`, `zxing-js`, ou a `BarcodeDetector` API nativa com suporte limitado de browser —, tratamento de permissão de câmera negada/indisponível, fallback pra digitação manual nesse caso). A Architecture Spine (AD-8/AD-9) cobre bem o back-end da validação, mas nenhum AD trata a implementação client-side da leitura. Não é um requisito de domínio (não vira invariante), mas é uma decisão técnica não-trivial deixada em aberto — risco de ser descoberta tarde, no meio da Story 5.2.

### Warnings

- ⚠️ Ausência de documento de UX é esperada e já justificada no projeto (prazo de 7 dias, identidade visual fixada direto no PRD/instruções do projeto) — **não é recomendação de bloqueio**.
- ⚠️ **Recomendação:** antes de iniciar a Story 5.2 (Epic 5), decidir e registrar em `docs/decisions.md` a abordagem técnica de leitura de QR via câmera no navegador (biblioteca + fallback de permissão negada) — não precisa virar um AD formal na Architecture Spine, mas precisa de uma decisão registrada antes de codar, não descoberta ad-hoc no meio da story.

## Epic Quality Review

Revisão rigorosa dos 5 épicos e 12 stories contra os padrões de `bmad-create-epics-and-stories` — valor de usuário, independência, dependências, e tamanho de story.

### Epic Structure Validation

| Épico | Foco em valor de usuário | Independência |
|---|---|---|
| Epic 1 | ✓ — título e goal centrados em capacidade do usuário (logar, buscar filme) | ✓ Standalone completo |
| Epic 2 | ✓ | ✓ Usa só saída do Epic 1 |
| Epic 3 | ✓ | ✓ Usa só saída dos Epics 1–2 |
| Epic 4 | ✓ | ✓ Usa só saída dos Epics 1–3 |
| Epic 5 | ✓ | ✓ Usa só saída dos Epics 1–4 |

Nenhum épico é milestone técnico disfarçado (ex.: "Setup de Banco", "Desenvolvimento de API") — todos nomeados e descritos pela capacidade que o usuário ganha.

### Story Quality Assessment

- **Tamanho e independência:** todas as 12 stories são completáveis numa sessão de dev, sem dependência de story futura. Cadeia de dependência dentro de cada épico é estritamente sequencial (N.1 → N.2 → N.3).
- **AC em Given/When/Then:** presente em todas as 12 stories, critérios específicos (status HTTP, nomes de campo, estados de entidade) — não encontrei critério vago do tipo "usuário consegue logar" sem condição associada.
- **Cobertura de erro:** presente na maioria — rejeição de papel errado, dado inválido, recurso de outro dono, etc. Exceção documentada: FR-12/Story 4.1 tem o gap de cenário de corrida já registrado na Epic Coverage Validation acima.

### Dependency Analysis

**Dependências dentro de cada épico:** nenhuma violação — nenhuma story referencia funcionalidade de story futura. Verificado story a story:
- Epic 1: 1.1 standalone → 1.2 usa só 1.1 (auth)
- Epic 2: 2.1 usa 1.1+1.2 → 2.2 usa 2.1 → 2.3 usa 2.1
- Epic 3: 3.1 usa 2.1 (sessão existe) → 3.2 usa 3.1
- Epic 4: 4.1 usa 3.2 (reserva existe) → 4.2 usa 4.1
- Epic 5: 5.1 usa 2.1 (sessão existe) → 5.2 usa 5.1 + 4.1 (ingresso existe)

**Dependências entre épicos:** cadeia estritamente sequencial 1→2→3→4→5, cada um usa só saída de épico anterior. Nenhum épico exige um posterior pra funcionar.

#### 🟠 Major Issue — Criação de schema completo na Story 1.1

A regra padrão deste checklist é clara: "❌ Epic 1 Story 1 cria todas as tabelas de uma vez; ✅ cada story cria só a tabela que precisa." A Story 1.1 viola essa regra à risca — cria o schema completo das 7 entidades (`V1__schema.sql`) de uma vez, não incremental por story.

**Isto já é uma exceção conscientemente registrada, não um descuido:** decisão explícita da Architecture Spine (AD-3), debatida em sessão de party mode com o time (Winston/Amelia/Mary), motivada por FKs cruzadas entre domínios (`assento_sessao` → `reservas` → `pagamentos`/`ingressos`) e pela necessidade dos testes de concorrência via Testcontainers (FR-6, FR-11, FR-20) de terem o schema completo disponível cedo. Tem, inclusive, um benefício colateral verificado nesta mesma revisão: é o que permite a Story 2.2 testar a trava pós-venda (FR-7) inserindo uma linha `ingresso CONFIRMADO` via fixture, sem depender do Epic 4 estar implementado — o que preserva a independência entre épicos que este checklist também exige.

- **Recommendation:** manter como está. Reverter pra criação incremental por story reintroduziria o problema de FK cruzada que a decisão original evitou, sem ganho real dado o tamanho pequeno do domínio (7 entidades). Nenhuma ação necessária — deviation aceita e justificada, registrada aqui pra constar na rastreabilidade da avaliação.

#### 🟡 Minor Concern — Nome da Story 1.1 lidera com termo técnico

"Fundação e Login com Papel Fixo" — o prefixo "Fundação" é o tipo de termo que este checklist trata como bandeira vermelha de possível milestone técnico (mesma categoria de "Setup" ou "Infrastructure"). Na prática a story entrega valor de usuário real (login funcional) e o termo é só o prefixo, não desvirtua o conteúdo.

- **Recommendation:** cosmético, não bloqueia. Se quiser, renomear pra algo como "Login com Papel Fixo (com Ambiente de Dados Pronto)" — mas dado o prazo de 7 dias, não vale o esforço de reabrir a story por isso.

### Best Practices Compliance Checklist

| Critério | Epic 1 | Epic 2 | Epic 3 | Epic 4 | Epic 5 |
|---|---|---|---|---|---|
| Entrega valor de usuário | ✓ | ✓ | ✓ | ✓ | ✓ |
| Funciona independentemente | ✓ | ✓ | ✓ | ✓ | ✓ |
| Stories bem dimensionadas | ✓ | ✓ | ✓ | ✓ | ✓ |
| Sem dependência futura | ✓ | ✓ | ✓ | ✓ | ✓ |
| Tabelas criadas quando necessário | 🟠 exceção justificada (AD-3) | — | — | — | — |
| AC claras | ✓ | ✓ | ✓ | ⚠️ gap FR-12 (ver acima) | ✓ |
| Rastreabilidade a FRs mantida | ✓ | ✓ | ✓ | ✓ | ✓ |

## Summary and Recommendations

### Overall Readiness Status

**READY** — PRD, Architecture Spine e Epics/Stories estão alinhados, com 20/20 FRs cobertos e cadeia de dependências entre épicos limpa (nenhuma referência a trabalho futuro). Nenhum achado bloqueia o início da implementação pelo Epic 1. Os dois achados acionáveis abaixo têm prazo próprio — não são pré-requisito pra começar hoje.

### Critical Issues Requiring Immediate Action

Nenhuma. Sem 🔴 Critical Violation encontrada em nenhum dos 6 passos desta avaliação.

### Action Items (não bloqueiam o início, mas têm prazo próprio)

1. **Antes de implementar a Story 4.1 (Epic 4):** adicionar AC + cenário Testcontainers pro FR-12 cobrindo a corrida cruzada entre reserva expirando e nova reserva concorrente pro mesmo assento (detalhe em Epic Coverage Validation acima).
2. **Antes de implementar a Story 5.2 (Epic 5):** decidir e registrar em `docs/decisions.md` a abordagem técnica de leitura de QR via câmera no navegador — biblioteca de decodificação e fallback de permissão negada (detalhe em UX Alignment Assessment acima).

### Non-Blocking Notes

- 🟠 Schema completo (7 entidades) criado de uma vez na Story 1.1 — desvio do padrão "criar tabela só quando a story precisa", mas exceção conscientemente justificada por decisão de arquitetura (AD-3) e debatida com o time. Nenhuma ação necessária.
- 🟡 Nome da Story 1.1 lidera com o termo técnico "Fundação" — cosmético, sem impacto funcional.

### Recommended Next Steps

1. Endereçar os dois Action Items acima nos respectivos momentos (não precisa ser agora).
2. Seguir pra `[SP] Sprint Planning` (`bmad-sprint-planning`) — próximo passo obrigatório da fase 4-implementation.
3. Manter este relatório como referência durante a implementação do Epic 4 e Epic 5, quando os action items entrarem em jogo.

### Final Note

Esta avaliação encontrou 2 issues acionáveis (não bloqueantes) e 2 notas não-bloqueantes, através de 6 passos de verificação (descoberta de documentos, análise de PRD, cobertura de épicos, alinhamento de UX, qualidade de épicos, avaliação final). Nenhuma issue crítica. Os achados podem ser usados pra refinar os artefatos nos momentos indicados, ou o projeto pode seguir como está — a decisão é de Felipe.

---

**Avaliador:** John (Product Manager) via `bmad-check-implementation-readiness`
**Data:** 2026-08-10
