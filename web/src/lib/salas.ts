/**
 * Identidade das salas — apelido, descrição e cor.
 *
 * <p>Fixo no código de propósito: `salas` guarda só `nome`, `linhas` e `colunas`, e não existe tela
 * de gestão que produza o resto. Enquanto for assim, a alternativa é a interface mostrar "Sala 1",
 * "Sala 2", "Sala 3" — três nomes secos que não distinguem uma sala da outra pra quem escolhe.
 *
 * <p>Chaveado pelo `nome` do cadastro, que é o único identificador estável que o back-end expõe.
 * Sala nova sem entrada aqui degrada pro próprio nome, em vez de sumir ou quebrar a tela.
 */
interface IdentidadeDaSala {
  apelido: string;
  descricao: string;
  cor: string;
}

const IDENTIDADES: Record<string, IdentidadeDaSala> = {
  'Sala 1': {
    apelido: 'CENTRO',
    descricao: 'A sala clássica, telão grande e poltronas de veludo vermelho.',
    cor: 'bg-flame-600',
  },
  'Sala 2': {
    apelido: 'DRIVE-IN',
    descricao: 'Sessões ao ar livre, som pelo rádio do carro.',
    cor: 'bg-cyan-400',
  },
  'Sala 3': {
    apelido: 'VHS CLUB',
    descricao: 'Sessões cult com curadoria de fitas raras.',
    cor: 'bg-flame-400',
  },
};

/** "Sala 1" → "SALA 1 — CENTRO". Sem apelido cadastrado, devolve o nome em caixa alta. */
export function nomeExibidoDaSala(nome: string): string {
  const identidade = IDENTIDADES[nome.trim()];
  const emCaixaAlta = nome.trim().toUpperCase();
  return identidade ? `${emCaixaAlta} — ${identidade.apelido}` : emCaixaAlta;
}

export function identidadeDaSala(nome: string): IdentidadeDaSala | null {
  return IDENTIDADES[nome.trim()] ?? null;
}
