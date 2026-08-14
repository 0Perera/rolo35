### Task 9: Documentação

**Files:**
- Modify: `docs/decisions.md`
- Modify: `docs/regras-de-negocio.md:191-218,255,261-264`
- Modify: `README.md` (se houver ocorrências)

**Interfaces:**
- Consumes: tudo.
- Produces: nada.

- [ ] **Step 1: Entrada nova em `decisions.md`**

Acrescentar ao fim, no formato das outras (título com a decisão, bullets **Decisão** e **Por quê**):

```markdown
## O código curto é a credencial única do ingresso; a assinatura HMAC fica só no link público — emenda a AD-8

- **Decisão**: `POST /api/portaria/validacoes` passa a aceitar **exclusivamente** o código curto de 8
  caracteres. O QR do canhoto carrega esse mesmo código. O formato `uuid.assinatura` (AD-8) deixa de
  ser credencial de validação, deixa de aparecer em tela e sai dos DTOs de leitura — sobra como token
  de `GET /api/ingressos/{codigo}`, cunhado sob demanda por `GET /api/ingressos/{id}/link`. Supera a
  emenda "O QR do ingresso carrega o código assinado" (code review do Epic 5).
- **Por quê**: a assinatura protege contra forja de identificador. Isso vale numa rota **sem
  autenticação** — a página pública — onde a checagem antes de tocar o banco é o que impede a rota de
  virar oráculo de existência. Não vale na portaria, que exige token de papel `PORTARIA`: força bruta
  contra os 40 bits do código curto pressupõe conta de operador comprometida, cenário em que o
  operador já vê os ingressos que valida. Manter as duas credenciais custava um código de ~80
  caracteres impresso num canhoto de cinema e um caminho de resolução com dois formatos. Efeito
  colateral: `IngressoService.listarMinhas()` computava uma HMAC por linha da carteira, custo que
  crescia com o histórico do cliente e que desapareceu.
- **Escopo da quebra**: QRs emitidos antes desta mudança param de validar. Aceito sem fallback porque
  nada havia sido publicado — só dado de teste local.
```

- [ ] **Step 2: Corrigir `regras-de-negocio.md`**

Quatro afirmações ficaram falsas. Na seção `Ingressos` (`:191-218`):
- "Código do ingresso é `UUID` + assinatura HMAC-SHA256" → passa a descrever as duas coisas separadas: credencial de entrada é o código curto Base32 Crockford de 8 caracteres com 40 bits de `SecureRandom`; token do link público é `uuid.assinatura`.
- "QR é gerado no front a partir do código assinado" → a partir do código curto.
- "a URL que ele carrega é montada num único lugar" → o QR não carrega URL; a frase sobre `web/src/lib/ingressos.ts` passa a valer só para o botão de compartilhar.
- Acrescentar a regra da rota nova: token de link exige autenticação e dono, e não diferencia "não é seu" de "não existe".

Na seção da portaria (`:255`, `:261-264`):
- "Assinatura HMAC conferida antes de qualquer consulta ou lock" → a checagem antes do lock continua, mas é a normalização do código curto: código fora do formato não chega a segurar linha nenhuma.
- "O QR do ingresso carrega o código assinado" → carrega o código curto; `ContratoQrPortaria.test.tsx` continua sendo a cobertura da travessia.

Referências de linha citadas nesse arquivo (`CodigoIngressoService.gerar`, `:32-34` etc.) mudaram com o renome — conferir cada uma.

- [ ] **Step 3: Varrer o README**

Run: `grep -n -i 'assinatur\|hmac\|uuid\.' README.md`
Expected: se houver ocorrência descrevendo o código do ingresso, corrigir; se não houver, seguir.

- [ ] **Step 4: Commit**

```bash
git add docs README.md
git commit -m "docs: código curto vira credencial única do ingresso"
```

---

## Verificação final

```bash
./mvnw -f api/pom.xml test        # back-end inteiro
npm run lint --prefix web          # zero erro
npm run build --prefix web         # tsc -b sem erro de tipo
```

E, a partir de `web/`, `npx vitest run` — no Windows o script `npm test` falha na sintaxe `NODE_OPTIONS=` inline; exportar a variável antes e chamar o `vitest` direto.

**Conferência manual, com a aplicação de pé:**
1. Comprar um ingresso → o canhoto não mostra nenhum código longo, e mostra os 8 caracteres ao lado do QR.
2. `⧉ COPIAR CÓDIGO` → colar num editor devolve exatamente 8 caracteres.
3. `↗ COMPARTILHAR` → colar devolve `.../ingressos/<uuid>.<assinatura>`; abrir a URL renderiza o canhoto com QR.
4. Portaria, digitando os 8 caracteres → `VALIDO`; repetir → `JA_UTILIZADO`.
5. Portaria, colando a URL compartilhada → `INVALIDO`.
6. Portaria, colando o trecho `uuid.assinatura` da URL → `INVALIDO`. É a quebra intencional desta mudança.
