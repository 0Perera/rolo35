import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CampoDeBusca } from './CampoDeBusca';

/** Um pouco além dos 350ms do debounce — o suficiente pra provar que ele não disparou. */
const ALEM_DO_DEBOUNCE_MS = 600;

function passarDoDebounce() {
  return new Promise((resolve) => setTimeout(resolve, ALEM_DO_DEBOUNCE_MS));
}

function campo() {
  return screen.getByRole('searchbox');
}

describe('CampoDeBusca', () => {
  it('debounces typing into a single search', async () => {
    const user = userEvent.setup();
    const onBuscar = vi.fn();
    render(<CampoDeBusca valor="" onBuscar={onBuscar} label="Buscar sessão" />);

    await user.type(campo(), 'matrix');
    expect(onBuscar).not.toHaveBeenCalled();

    await waitFor(() => expect(onBuscar).toHaveBeenCalledTimes(1));
    expect(onBuscar).toHaveBeenCalledWith('matrix');
  });

  // Quem aplica o termo o normaliza (`trim`) antes de guardá-lo na URL, então o valor que volta
  // quase nunca é byte a byte o que foi digitado. Ressincronizar por igualdade crua apagava o
  // espaço recém-digitado no meio da digitação — o texto mudava sob os dedos de quem escrevia.
  it('does not rewrite what is being typed when the applied term comes back trimmed', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<CampoDeBusca valor="" onBuscar={vi.fn()} label="Buscar sessão" />);

    await user.type(campo(), 'matrix ');
    rerender(<CampoDeBusca valor="matrix" onBuscar={vi.fn()} label="Buscar sessão" />);

    expect(campo()).toHaveValue('matrix ');
  });

  // Espaço sozinho vira termo vazio depois do `trim`, ou seja: exatamente o filtro que já está
  // aplicado. A requisição não muda nada e a comparação crua nunca voltava a bater, então cada
  // espaço a mais disparava outra.
  it('does not search when only whitespace was typed', async () => {
    const user = userEvent.setup();
    const onBuscar = vi.fn();
    render(<CampoDeBusca valor="" onBuscar={onBuscar} label="Buscar sessão" />);

    await user.type(campo(), '   ');
    await passarDoDebounce();

    expect(onBuscar).not.toHaveBeenCalled();
  });

  // Enter é como se pede uma busca; esperar o debounce depois disso é esperar por nada.
  it('searches right away when Enter is pressed', async () => {
    const user = userEvent.setup();
    const onBuscar = vi.fn();
    render(<CampoDeBusca valor="" onBuscar={onBuscar} label="Buscar sessão" />);

    await user.type(campo(), 'matrix{Enter}');

    expect(onBuscar).toHaveBeenCalledWith('matrix');
  });

  // O `id` era uma constante do módulo: dois campos na mesma tela produziam `id` repetido, e aí o
  // `label` do segundo apontava pro campo do primeiro — os dois rótulos rotulavam a mesma caixa.
  it('gives each field its own label when two search fields share a page', () => {
    render(
      <>
        <CampoDeBusca valor="" onBuscar={vi.fn()} label="Buscar sessão" />
        <CampoDeBusca valor="" onBuscar={vi.fn()} label="Buscar sala" />
      </>,
    );

    expect(screen.getByLabelText('Buscar sessão')).not.toBe(screen.getByLabelText('Buscar sala'));

    const ids = screen.getAllByRole('searchbox').map((entrada) => entrada.id).filter(Boolean);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
