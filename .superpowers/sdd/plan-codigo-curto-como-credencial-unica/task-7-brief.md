### Task 7: Os três canhotos perdem o código longo

**Files:**
- Modify: `web/src/components/CanhotoEmitido.tsx:14-16,48-56`
- Modify: `web/src/pages/MeusIngressosPage.tsx:93-132`
- Modify: `web/src/pages/IngressoPublicoPage.tsx:73-101`
- Test: `web/src/pages/PagamentoPage.test.tsx:107-110`, `web/src/pages/MeusIngressosPage.test.tsx:157`, `web/src/pages/IngressoPublicoPage.test.tsx:77`

**Interfaces:**
- Consumes: `CanhotoIngresso`/`AcoesDoIngresso` da Task 6, `useLinkDoIngresso` da Task 5.
- Produces: nada consumido por tasks seguintes.

- [ ] **Step 1: Inverter as asserções dos testes**

Nos três arquivos, os testes hoje afirmam a presença do texto longo. Substituir por (adaptando o código curto de cada fixture):

```tsx
    // O código assinado não pode aparecer em tela nenhuma: ele é token de link, não credencial de
    // entrada, e imprimir ~80 caracteres num canhoto foi o sintoma que abriu esta mudança.
    expect(screen.queryByText(/CÓDIGO abc-123\.assinatura/)).not.toBeInTheDocument();
    expect(screen.getByText('SB68XVZG')).toBeInTheDocument();
```

**Detalhe que quebra os três arquivos se for esquecido:** `CanhotoEmitido` e `DetalheIngresso` passam a chamar `useLinkDoIngresso`, que dispara `buscarLinkDoIngresso` na montagem. Sem mock, o teste bate no `apiFetch` real. Adicionar em cada suíte que renderiza um desses componentes:

```tsx
    vi.spyOn(ingressosApi, 'buscarLinkDoIngresso').mockResolvedValue({ codigo: 'abc-123.assinatura' });
```

`PagamentoPage.test.tsx` mocka a API de pagamentos, não a de ingressos — conferir se o `import * as ingressosApi from '../api/ingressos';` existe no arquivo e acrescentar se não existir.

`IngressoPublicoPage` **não** precisa disso: lá o link é a própria URL da página.

- [ ] **Step 2: Rodar e confirmar que falham**

Run (a partir de `web/`): `npx vitest run src/pages/PagamentoPage.test.tsx src/pages/MeusIngressosPage.test.tsx src/pages/IngressoPublicoPage.test.tsx`
Expected: FAIL — o texto longo ainda está na tela

- [ ] **Step 3: `CanhotoEmitido`**

```tsx
export function CanhotoEmitido({ ingresso, reserva, rotuloAssento }: CanhotoEmitidoProps) {
  const linkPublico = useLinkDoIngresso(ingresso.id);

  return (
    <CanhotoIngresso codigoCurto={ingresso.codigoCurto}>
```

Remover a linha `CÓDIGO {ingresso.codigo}` e seu comentário `break-all` (`:48-50`). A linha seguinte perde o prefixo `ASSINADO ·`, que descrevia o código removido:

```tsx
      <p className="mt-5 font-mono text-base tracking-wide text-[#9C9488]">
        APRESENTE NA PORTARIA ATÉ 15 MIN ANTES
      </p>
      <AcoesDoIngresso codigoCurto={ingresso.codigoCurto} linkPublico={linkPublico} className="mt-5" />
```

- [ ] **Step 4: `MeusIngressosPage`**

Em `DetalheIngresso` (`:93`), a mesma troca: `const linkPublico = useLinkDoIngresso(ingresso.id);`, `<CanhotoIngresso codigoCurto={ingresso.codigoCurto}>`, remoção do bloco `:119-123` (comentário `break-all` incluído), `ASSINADO ·` fora, e `<AcoesDoIngresso codigoCurto={ingresso.codigoCurto} linkPublico={linkPublico} className="mt-5" />`.

- [ ] **Step 5: `IngressoPublicoPage`**

Aqui não há hook: o link compartilhável é a própria URL. E o comentário de `:75-76` ("Nada de compartilhar aqui — quem abriu o link já está nele") contradiz o código desde antes desta mudança, já que `AcoesDoIngresso` sempre teve o botão de compartilhar. Resolver a favor do código e reescrever o comentário — repassar o link recebido é justamente o que quem abriu a página quer fazer:

```tsx
            {/* Página pública: só leitura. O link compartilhável aqui é a própria URL — nada a
                cunhar, e nada de ação de dono. */}
            <CanhotoIngresso codigoCurto={ingresso.codigoCurto}>
```

Remover `:93-95` e o prefixo `ASSINADO ·`; nas ações, `<AcoesDoIngresso codigoCurto={ingresso.codigoCurto} linkPublico={urlPublicaDoIngresso(codigo)} className="mt-5" />`.

- [ ] **Step 6: Rodar tudo**

Run (a partir de `web/`): `npx vitest run`
Expected: PASS
Run: `npm run build --prefix web`
Expected: `tsc -b` sem erro — zero referências remanescentes a `.codigo`

- [ ] **Step 7: Commit**

```bash
git add web/src
git commit -m "feat(web): canhoto para de imprimir o código assinado"
```

---

