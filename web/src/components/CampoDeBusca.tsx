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

  // Ressincroniza quando o termo muda por fora (voltar do navegador, link colado, limpar filtro).
  useEffect(() => {
    setTexto(valor);
  }, [valor]);

  useEffect(() => {
    if (texto === valor) {
      return;
    }
    const timer = setTimeout(() => onBuscar(texto), ESPERA_MS);
    return () => clearTimeout(timer);
    // `onBuscar` fica fora das dependências de propósito: se o pai recriar a função a cada render,
    // incluí-la reinicia o timer sem parar e a busca nunca dispara.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [texto, valor]);

  return (
    <div className={className}>
      <label className="sr-only" htmlFor="campo-de-busca">
        {label}
      </label>
      <input
        id="campo-de-busca"
        type="search"
        value={texto}
        onChange={(evento) => setTexto(evento.target.value)}
        placeholder={placeholder ?? label}
        aria-label={label}
        className={`w-full border-[3px] px-[14px] py-2.5 font-body text-sm font-bold ${tones[tone]}`}
      />
    </div>
  );
}
