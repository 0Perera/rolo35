# Pseudo-story CAP-11: Código curto de portaria pra digitação manual

Status: ready-for-dev
Origem: `_bmad-output/specs/spec-backlog-hardening/SPEC.md` (CAP-11, Grupo B) — decisão já resolvida.

## Story

As usuário PORTARIA,
I want digitar um código curto quando a câmera não é uma opção,
so that a digitação manual deixa de ser inviável na prática.

## Decisão já tomada

Coluna nova indexada no ingresso, código curto gerado por `SecureRandom` (Base32 Crockford, ~8
caracteres, sem `0`/`O`/`1`/`I`) na emissão. O QR **continua** carregando o código HMAC completo,
sem nenhuma mudança — o código curto existe só pro caminho de digitação manual. Não rebaixa a
segurança do caminho principal (câmera).

## Acceptance Criteria

1. **Given** um ingresso emitido **When** `PagamentoService.confirmar()` cria a linha em
   `ingressos` **Then** também gera e persiste um código curto único (coluna nova).
2. **Given** dois ingressos diferentes **When** ambos são emitidos **Then** nunca colidem no
   código curto (constraint `UNIQUE` na coluna nova).
3. **Given** a portaria digita um código curto válido **When** `POST /api/portaria/validacoes` é
   chamado **Then** encontra o ingresso pelo código curto e segue o mesmo fluxo de validação já
   existente (4 resultados: válido, inválido, já utilizado, evento errado).
4. **Given** a portaria digita um código curto inexistente **When** validado **Then** retorna
   `INVALIDO`, mesma resposta genérica dos outros casos de não-encontrado (não diferenciar motivo,
   mesmo critério já usado no projeto pra não virar oráculo de força bruta).
5. **Given** o QR do ingresso **When** gerado/lido **Then** continua carregando o código HMAC
   completo — nenhuma mudança nesse caminho.

## Tasks / Subtasks

- [ ] **Task 1 — Coluna e geração do código curto**
  - [ ] **[RED]** Teste em `IngressoTest`/`PagamentoServiceTest`: emitir ingresso gera um código
    curto não-nulo, formato esperado (8 chars, alfabeto Base32 Crockford). Rodar e confirmar falha
    (campo não existe).
  - [ ] **[GREEN]** Migration nova: `ALTER TABLE ingressos ADD COLUMN codigo_curto VARCHAR(8) NOT
    NULL; CREATE UNIQUE INDEX uq_ingressos_codigo_curto ON ingressos (codigo_curto);`. Criar
    gerador (`CodigoCurtoGenerator` ou método em `CodigoIngressoService`) usando `SecureRandom` +
    alfabeto Crockford Base32. Chamar na emissão, dentro de `PagamentoService.confirmar()` (ou
    onde `Ingresso` é construído).
  - [ ] Tratar colisão: se `SecureRandom` gerar um código já existente (extremamente raro, mas
    possível), regenerar até achar um livre, ou deixar a `UNIQUE` estourar e capturar/retry —
    decidir a estratégia ao implementar.
  - [ ] Commit: `feat(ingressos): gera código curto pra digitação manual na emissão`

- [ ] **Task 2 — Lookup por código curto na validação**
  - [ ] **[RED]** Teste em `PortariaServiceValidacaoTest`: validar por código curto segue o mesmo
    fluxo (4 resultados) que validar por código completo. Rodar e confirmar falha.
  - [ ] **[GREEN]** Em `IngressoRepository`, adicionar `findByCodigoCurtoForUpdate(String)` (mesmo
    padrão de lock pessimista do `findByIdForUpdate`). Em `PortariaService.validar()`, detectar se
    o input é código curto (formato/tamanho) ou código completo (contém `.`, assinatura) e rotear
    pro lookup certo — mantendo os dois caminhos convergindo pro mesmo resultado final.
  - [ ] Commit: `feat(portaria): valida ingresso por código curto digitado manualmente`

- [ ] **Task 3 — Front: campo de digitação usa o código curto**
  - [ ] Ajustar a UI de digitação manual (tela de portaria) pra indicar que o código esperado é
    curto (placeholder, máscara de 8 chars) em vez do formato longo atual.
  - [ ] Commit: `feat(web): campo de digitação manual da portaria reflete o código curto`

## Dev Notes

- Não expor o código curto no QR nem no link público de compartilhamento — ele é exclusivo do
  fluxo de digitação manual da portaria.
- Ver a troca registrada no `.memlog.md` de `spec-backlog-hardening` pra justificativa completa de
  por que não unificar num único código curto pros dois caminhos (rebaixaria a segurança do
  caminho principal sem necessidade).
