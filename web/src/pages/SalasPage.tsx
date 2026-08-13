import { PageShell } from '../components/PageShell';
import { SectionTitle } from '../components/SectionTitle';

/**
 * Conteúdo institucional, fixo no código de propósito: descrição e identidade visual de cada sala
 * não existem no cadastro (`salas` guarda nome, linhas e colunas), e não há tela de gestão que as
 * produza. Enquanto for assim, buscar da API renderia três nomes secos e nenhuma das informações
 * que fazem esta página existir.
 */
const SALAS = [
  {
    nome: 'SALA 1 — CENTRO',
    descricao: 'A sala clássica, telão grande e poltronas de veludo vermelho.',
    lugares: 120,
    cor: 'bg-flame-600',
  },
  {
    nome: 'SALA 2 — DRIVE-IN',
    descricao: 'Sessões ao ar livre, som pelo rádio do carro.',
    lugares: 80,
    cor: 'bg-cyan-400',
  },
  {
    nome: 'SALA 3 — VHS CLUB',
    descricao: 'Sessões cult com curadoria de fitas raras.',
    lugares: 60,
    cor: 'bg-flame-400',
  },
];

export function SalasPage() {
  return (
    <PageShell>
      <div className="mx-auto max-w-[900px] px-5 pt-[46px] pb-[90px] sm:px-8 xl:max-w-[1040px]">
        <SectionTitle kicker="A CASA">SALAS</SectionTitle>

        <ul className="mt-8 flex flex-col gap-[18px]">
          {SALAS.map((sala) => (
            <li
              key={sala.nome}
              className="flex flex-wrap items-center gap-4 border-[3px] border-ink-950 bg-paper-50 px-[22px] py-5 shadow-[6px_6px_0_var(--color-ink-950)]"
            >
              {/* A faixa de cor é o que separa as salas num relance; o nome logo ao lado diz a
                  mesma coisa pra quem não distingue as cores. */}
              <div aria-hidden="true" className={`w-2 self-stretch ${sala.cor}`} />
              <div className="min-w-[180px] flex-1">
                <h2 className="font-display text-lg">{sala.nome}</h2>
                <p className="mt-1.5 font-mono text-base text-[#6D655B]">{sala.descricao}</p>
              </div>
              <p className="font-mono text-lg tracking-wide text-navy-700">{sala.lugares} lugares</p>
            </li>
          ))}
        </ul>
      </div>
    </PageShell>
  );
}
