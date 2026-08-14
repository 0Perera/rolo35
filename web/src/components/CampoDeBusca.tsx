import { useEffect, useState } from 'react';

type Tone = 'papel' | 'terminal';

interface CampoDeBuscaProps {
  /** Termo já aplicado (vem da URL). O campo parte dele e volta a ele quando muda por fora. */
  valor: string;
  onBuscar: (termo: string) => void;
  label: string;
  placeholder?: string;
  tone?: Tone;
  className?: string;
}

const tones: Record<Tone, string> = {
  // A sombra dura é a mesma do seletor ao lado — sem ela os dois filtros da barra parecem
  // controles de sistemas diferentes colados um do lado do outro. No foco a borda vira vermelha:
  // o anel do `focus-visible` global é ciano e some sobre o papel claro.
  papel:
    'border-ink-950 bg-paper-50 text-ink-950 placeholder:text-ink-950/40 shadow-[4px_4px_0_var(--color-ink-950)] focus:border-flame-600',
  terminal: 'border-cyan-400 bg-ink-800 text-paper-100 placeholder:text-paper-100/40',
};

/** Tempo entre a última tecla e a requisição. */
const ESPERA_MS = 350;

/**
 * Busca com debounce. Sem ele, cada tecla vira uma requisição paginada e as respostas chegam fora
 * de ordem — a lista pisca com o resultado de um termo que o operador já terminou de digitar.
 */
export function CampoDeBusca({
  valor,
  onBuscar,
  label,
  placeholder,
  tone = 'papel',
  className = '',
}: CampoDeBuscaProps) {
  const [texto, setTexto] = useState(valor);

  // Quem aplica o termo o normaliza antes de guardá-lo na URL, então comparar cru dizia "diferente"
  // pra coisas que já estão aplicadas. Comparar pelo texto normalizado é o que responde a pergunta
  // que os dois efeitos abaixo realmente fazem: "o que está escrito já é o filtro que está no ar?"
  const jaAplicado = texto.trim() === valor;

  // Ressincroniza quando o termo muda por fora (voltar do navegador, link colado, limpar filtro) —
  // mas não quando a única diferença é o `trim`, senão o espaço recém-digitado sumia do campo no
  // meio da digitação e o cursor pulava junto.
  useEffect(() => {
    setTexto((atual) => (atual.trim() === valor ? atual : valor));
  }, [valor]);

  useEffect(() => {
    if (jaAplicado) {
      return;
    }
    const timer = setTimeout(() => onBuscar(texto), ESPERA_MS);
    return () => clearTimeout(timer);
    // `onBuscar` fica fora das dependências de propósito: se o pai recriar a função a cada render,
    // incluí-la reinicia o timer sem parar e a busca nunca dispara.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto, jaAplicado]);

  // Enter é como se pede uma busca — esperar o debounce depois disso é esperar por nada. Não há
  // requisição em dobro: aplicar o termo muda `valor`, o efeito acima roda de novo e a limpeza dele
  // cancela o timer que estava pendente.
  function aoTeclar(evento: React.KeyboardEvent<HTMLInputElement>) {
    if (evento.key === 'Enter' && !jaAplicado) {
      onBuscar(texto);
    }
  }

  return (
    <div className={className}>
      {/* `aria-label` no campo é o rótulo que os leitores de tela anunciam; um `<label>` escondido
          ao lado só repetiria a mesma informação e obrigaria um `id` — que, sendo constante do
          módulo, se repetia quando dois campos dividiam a mesma tela. */}
      <input
        type="search"
        value={texto}
        onChange={(evento) => setTexto(evento.target.value)}
        onKeyDown={aoTeclar}
        placeholder={placeholder ?? label}
        aria-label={label}
        className={`w-full border-[3px] px-[14px] py-2.5 font-body text-sm font-bold ${tones[tone]}`}
      />
    </div>
  );
}
