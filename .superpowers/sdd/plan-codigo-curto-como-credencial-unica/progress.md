# SDD ledger — plan: _bmad-output/implementation-artifacts/plan-codigo-curto-como-credencial-unica.md

Spec: `_bmad-output/implementation-artifacts/spec-codigo-curto-como-credencial-unica.md` (read, binding authority)
Branch: `melhorias` (not main). Tree clean at start.
BASE (branch start for this plan): e696bc4b03d883db53520f2387a4152cf6d51b88

## Pre-flight conflict scan

Pair rows — tasks sharing a file or an interface:

| A | B | A produces | B consumes | Finding |
|---|---|---|---|---|
| 2 | 4 | `gerarTokenDeLink(UUID)` | same | agrees |
| 2 | 3 | `IngressoService` edits (`listarMinhas`) | `IngressoService` edits (`buscarPublico`) | same file, different methods — no collision |
| 2 | 5 | `IngressoDto` sem `codigo` | `IngressoEmitido` sem `codigo` | agrees |
| 3 | 5 | `IngressoPublicoDto` + `codigoCurto` | `IngressoPublico` + `codigoCurto` | agrees |
| 3 | 4 | `IngressoPublicoDto` 5 campos | `IngressoSecurityTest` fixture | Task 3 Step 4 fixes the 4-arg ctor; Task 4 adds a test to the same file — sequential, no collision |
| 4 | 5 | `GET /{id}/link` → `{codigo}` | `buscarLinkDoIngresso` → `{codigo}` | agrees |
| 5 | 6 | `useLinkDoIngresso(id): string \| null` | `AcoesDoIngresso linkPublico: string \| null` | agrees |
| 6 | 7 | `CanhotoIngresso({codigoCurto})`, `AcoesDoIngresso({codigoCurto, linkPublico})` | three canhotos call them | agrees; Task 6 alone does not compile (plan states this) |
| 1 | 8 | portaria aceita só curto | contrato do QR grava curto | agrees |
| 7 | 8 | `IngressoPublicoPage` render | `ContratoQrPortaria` renders that page | agrees — Task 8 needs Task 7's `codigoCurto` prop |

Self-consistency rows — each task's own text against itself:

| Task | Finding |
|---|---|
| 1 | tests specified match code specified; RED test verified genuinely red (fixed during plan self-review) |
| 2 | consistent; strict-stub removals enumerated by line |
| 3 | consistent; second ctor site (`IngressoSecurityTest:80`) covered by Step 4 |
| 4 | consistent; `stubCliente()` helper confirmed to exist |
| 5 | consistent |
| 6 | consistent; does not compile alone — by design, stated |
| 7 | consistent |
| 8 | consistent; Crockford regex `[0-9A-HJKMNP-TV-Z]` verified against the alphabet |
| 9 | consistent |

Scan result: no conflicts requiring a ruling.

## Rulings

Ruling: batch 9 tasks into 7 dispatches — Tasks 2+3 (same DTO surgery, same two files) and Tasks 6+7 (Task 6 does not compile without 7, per the plan's own text) each go as one dispatch — because the user asked for speed and these pairs share a review surface. Cost if wrong: two review packages are larger than ideal, making a finding slightly harder to attribute to one task.

## Progress
