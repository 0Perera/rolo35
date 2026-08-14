### Task 8: Contrato do QR invertido e dica da portaria

**Files:**
- Modify: `web/src/pages/ContratoQrPortaria.test.tsx`
- Modify: `web/src/pages/ValidacaoPortariaPage.tsx:169-173`

**Interfaces:**
- Consumes: tudo das Tasks 1-7.
- Produces: nada.

- [ ] **Step 1: Reescrever o teste de contrato**

Preservar o javadoc de topo (`:11-22`) inteiro — a história de por que o arquivo existe continua verdadeira, e é o que impede alguém de apagá-lo por parecer redundante. Trocar as constantes, substituir o helper de parsing e reescrever os casos:

```tsx
const CODIGO_CURTO = 'SB68XVZG';
const TOKEN_DE_LINK = '3f2a1b4c-1111-2222-3333-444455556666.YWJjZGVmZ2hpamtsbW5vcHFy';

/**
 * Réplica fiel de `CodigoIngressoService.normalizarCodigoCurto()` (back-end): canoniza caixa,
 * hífen/espaço e as confusões do Crockford (I/L→1, O→0), depois exige 8 caracteres do alfabeto.
 * Se esta função devolve `null`, o servidor devolve INVALIDO — é a regra real, não uma aproximação.
 * Um QR com URL cai aqui, e um QR com `uuid.assinatura` também: os dois passam de 8 caracteres.
 */
function normalizarComoOBackendFaz(codigo: string): string | null {
  const canonico = codigo
    .trim()
    .toUpperCase()
    .replace(/[- ]/g, '')
    .replace(/[IL]/g, '1')
    .replace(/O/g, '0');
  return /^[0-9A-HJKMNP-TV-Z]{8}$/.test(canonico) ? canonico : null;
}
```

`payloadDoQrNoCanhoto()` passa a mockar a resposta pública com o campo novo e a navegar pelo token:

```tsx
  vi.spyOn(ingressosApi, 'buscarIngressoPublico').mockResolvedValue({
    sessaoTitulo: 'Clube da Luta',
    salaNome: 'Sala 1',
    dataHora: '2030-01-01T20:00:00',
    status: 'VALIDO',
    codigoCurto: CODIGO_CURTO,
  });
  render(
    <MemoryRouter initialEntries={[`/ingressos/${TOKEN_DE_LINK}`]}>
```

Os casos:

```tsx
  it('grava no QR o código curto, nunca o token assinado nem o link', async () => {
    const payload = await payloadDoQrNoCanhoto();

    expect(payload).toBe(CODIGO_CURTO);
    expect(payload).not.toMatch(/^https?:\/\//);
    expect(payload).not.toContain('.');
  });

  it('grava um payload que a normalização do back-end aceita', async () => {
    const payload = await payloadDoQrNoCanhoto();

    expect(normalizarComoOBackendFaz(payload)).toBe(CODIGO_CURTO);
  });

  it('rejeitaria um QR que voltasse a carregar o token assinado', () => {
    // A regressão nova que este arquivo passa a vigiar: o token assinado ainda existe no sistema,
    // como credencial do link público. Se ele voltar pro QR, a portaria recusa toda leitura.
    expect(normalizarComoOBackendFaz(TOKEN_DE_LINK)).toBeNull();
  });

  it('rejeitaria um QR que voltasse a carregar a URL pública', () => {
    // A regressão original, que de fato aconteceu uma vez. Continua valendo.
    expect(normalizarComoOBackendFaz(`https://rolo35.vercel.app/ingressos/${TOKEN_DE_LINK}`)).toBeNull();
  });
```

O caso `entrega à API de validação exatamente o payload que o QR carregava` (`:105-127`) fica, trocando a asserção final `extrairIdComoOBackendFaz(...)` por `expect(normalizarComoOBackendFaz(validar.mock.calls[0][0])).toBe(CODIGO_CURTO)`.

- [ ] **Step 2: Rodar**

Run (a partir de `web/`): `npx vitest run src/pages/ContratoQrPortaria.test.tsx`
Expected: PASS

- [ ] **Step 3: Atualizar a dica da portaria**

Em `ValidacaoPortariaPage.tsx:169-173`, o comentário trata o código curto como plano B e a dica oferece dois formatos:

```tsx
            {/* Um formato só, agora: o mesmo que o QR carrega. Dizer o número de caracteres é o que
                permite ao operador perceber erro de digitação antes de mandar. */}
            <p className="mt-1 font-mono text-base tracking-wide text-paper-100/50">
              OS 8 CARACTERES DO CANHOTO
            </p>
```

- [ ] **Step 4: Rodar a suíte do front inteira**

Run (a partir de `web/`): `npx vitest run`
Expected: PASS
Run: `npm run lint --prefix web`
Expected: zero erro

- [ ] **Step 5: Commit**

```bash
git add web/src/pages/ContratoQrPortaria.test.tsx web/src/pages/ValidacaoPortariaPage.tsx
git commit -m "test(web): contrato do QR passa a exigir o código curto"
```

---

