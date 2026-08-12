/**
 * Texto da página "Sobre o Rolo 35", transcrito do handoff (`Rolo 35.dc.html`).
 * Fica em arquivo, não no banco: é conteúdo editorial fixo, sem nenhuma tela de edição.
 */

export interface Trecho {
  texto: string;
  forte?: boolean;
}

export type Paragrafo = Trecho[];

export const PARAGRAFOS: Paragrafo[] = [
  [
    { texto: 'O Rolo 35 nasceu como resposta ao ' },
    { texto: 'Desafio Elite Dev', forte: true },
    { texto: ', o teste técnico do processo seletivo da ' },
    { texto: 'Verzel', forte: true },
    {
      texto:
        ' para contratar desenvolvedores júnior e trainees e transformá-los em grandes desenvolvedores. O enunciado pedia uma plataforma de eventos e ingressos: um organizador publica sessões, um cliente reserva assento e paga de forma simulada, e a portaria valida o ingresso pelo QR code na entrada.',
    },
  ],
  [
    {
      texto:
        'O fluxo é o que o desafio pediu. A estética de televisão de tubo, fita VHS e cinema de bairro dos anos 80/90 é escolha minha, porque um enunciado técnico não precisa virar interface genérica.',
    },
  ],
];

export interface Destaque {
  valor: string;
  descricao: string;
  cor: 'flame' | 'navy' | 'amarelo';
}

export const DESTAQUES: Destaque[] = [
  { valor: '3', descricao: 'Papéis: organizador, cliente, portaria', cor: 'flame' },
  { valor: '3', descricao: 'Salas de cinema', cor: 'navy' },
  { valor: 'Elite Dev', descricao: 'Desafio da Verzel que deu origem ao projeto', cor: 'amarelo' },
];
