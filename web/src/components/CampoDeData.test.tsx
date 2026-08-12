import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { CampoDeData } from './CampoDeData';

function CampoControlado({ inicial = '' }: { inicial?: string }) {
  const [valor, setValor] = useState(inicial);
  return <CampoDeData id="data" label="DATA" valor={valor} onChange={setValor} />;
}

describe('CampoDeData', () => {
  it('masks what the user types', async () => {
    const user = userEvent.setup();
    render(<CampoControlado />);

    await user.type(screen.getByLabelText('DATA'), '16082026');

    expect(screen.getByLabelText('DATA')).toHaveValue('16/08/2026');
  });

  it('fills the field from the calendar, showing the month of the current value', async () => {
    const user = userEvent.setup();
    render(<CampoControlado inicial="16/08/2026" />);

    await user.click(screen.getByRole('button', { name: /abrir calendário/i }));

    expect(screen.getByRole('dialog')).toHaveTextContent(/agosto de 2026/i);
    await user.click(screen.getByRole('button', { name: '20' }));

    expect(screen.getByLabelText('DATA')).toHaveValue('20/08/2026');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('walks to the previous and next month', async () => {
    const user = userEvent.setup();
    render(<CampoControlado inicial="16/08/2026" />);

    await user.click(screen.getByRole('button', { name: /abrir calendário/i }));
    await user.click(screen.getByRole('button', { name: /mês anterior/i }));
    expect(screen.getByRole('dialog')).toHaveTextContent(/julho de 2026/i);

    await user.click(screen.getByRole('button', { name: /próximo mês/i }));
    await user.click(screen.getByRole('button', { name: /próximo mês/i }));
    expect(screen.getByRole('dialog')).toHaveTextContent(/setembro de 2026/i);
  });
});
