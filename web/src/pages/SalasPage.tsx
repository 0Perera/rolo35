import { Link, useLocation } from 'react-router';
import { PageShell } from '../components/PageShell';
import { SectionTitle } from '../components/SectionTitle';
import { identidadeDaSala, nomeExibidoDaSala } from '../lib/salas';

/**
 * A capacidade continua fixa aqui: é o número de lugares anunciado da casa, e não o `linhas ×
 * colunas` do cadastro — as duas coisas divergem de propósito nesta página institucional. Nome,
 * descrição e cor vêm de `lib/salas`, a mesma fonte que o filtro da vitrine consome.
 */
const SALAS = [
  { nomeCadastro: 'Sala 1', lugares: 120 },
  { nomeCadastro: 'Sala 2', lugares: 80 },
  { nomeCadastro: 'Sala 3', lugares: 60 },
];

export function SalasPage() {
  // Quem chegou pelo resumo do filme mandou junto de onde saiu. Sem origem — rodapé, URL colada,
  // aba nova — a vitrine é a saída: `navigate(-1)` daria botão morto justamente nesses casos, que
  // são os que não têm histórico.
  const { state } = useLocation() as { state: { retomarEm?: string } | null };
  const retomarEm = state?.retomarEm;

  return (
    <PageShell>
      <div className="mx-auto max-w-[900px] px-5 pt-[46px] pb-[90px] sm:px-8 xl:max-w-[1040px]">
        <Link
          to={retomarEm ?? '/'}
          className="font-mono text-lg tracking-wide text-ink-950/60 hover:text-flame-600"
        >
          ◀ {retomarEm ? 'VOLTAR PRAS SESSÕES' : 'VOLTAR PRA PRATELEIRA'}
        </Link>

        <div className="mt-6">
          <SectionTitle kicker="A CASA">SALAS</SectionTitle>
        </div>

        <ul className="mt-8 flex flex-col gap-[18px]">
          {SALAS.map((sala) => {
            const identidade = identidadeDaSala(sala.nomeCadastro);
            return (
              <li
                key={sala.nomeCadastro}
                className="flex flex-wrap items-center gap-4 border-[3px] border-ink-950 bg-paper-50 px-[22px] py-5 shadow-[6px_6px_0_var(--color-ink-950)]"
              >
                {/* A faixa de cor é o que separa as salas num relance; o nome logo ao lado diz a
                    mesma coisa pra quem não distingue as cores. */}
                <div aria-hidden="true" className={`w-2 self-stretch ${identidade?.cor ?? 'bg-ink-950'}`} />
                <div className="min-w-[180px] flex-1">
                  <h2 className="font-display text-lg">{nomeExibidoDaSala(sala.nomeCadastro)}</h2>
                  {identidade && (
                    <p className="mt-1.5 font-mono text-base text-[#6D655B]">{identidade.descricao}</p>
                  )}
                </div>
                <p className="font-mono text-lg tracking-wide text-navy-700">{sala.lugares} lugares</p>
              </li>
            );
          })}
        </ul>
      </div>
    </PageShell>
  );
}
