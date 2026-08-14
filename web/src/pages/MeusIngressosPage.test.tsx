import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MeusIngressosPage } from './MeusIngressosPage';
import * as ingressosApi from '../api/ingressos';
import type { IngressoResumo } from '../api/ingressos';
import { SessaoExpiradaError } from '../api/client';

const ingresso: IngressoResumo = {
  id: 'abc-123',
  status: 'VALIDO',
  assentoFileira: 'A',
  assentoNumero: 1,
  sessaoTitulo: 'Clube da Luta',
  sessaoPosterUrl: null,
  salaNome: 'Sala 1',
  dataHora: '2030-01-01T20:00:00',
  codigo: 'abc-123.assinatura',
};

function renderDeslogado() {
  return render(
    <MemoryRouter initialEntries={['/meus-ingressos']}>
      <MeusIngressosPage />
    </MemoryRouter>,
  );
}

/** A carteira é do cliente logado: sem token a página nem chega a chamar a API. */
function renderPage() {
  localStorage.setItem('rolo35.token', 'token-abc');
  localStorage.setItem('rolo35.papel', 'CLIENTE');
  return renderDeslogado();
}

describe('MeusIngressosPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('shows a loading state while ingressos are being fetched', () => {
    vi.spyOn(ingressosApi, 'listarMeusIngressos').mockReturnValue(new Promise(() => {}));

    renderPage();

    expect(screen.getByText(/carregando/i)).toBeInTheDocument();
  });

  it('shows an empty state with a link to the sessões when the client has no ingressos', async () => {
    vi.spyOn(ingressosApi, 'listarMeusIngressos').mockResolvedValue([]);

    renderPage();

    expect(await screen.findByText(/ainda não tem ingressos/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ver sessões/i })).toHaveAttribute('href', '/');
  });

  it('shows a generic error message on failure', async () => {
    vi.spyOn(ingressosApi, 'listarMeusIngressos').mockRejectedValue(new Error('falha de rede'));

    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível carregar/i);
  });

  // Sessão vencida devolve 401 em toda tentativa: oferecer "tentar novamente" só repetiria a
  // recusa. A saída é o login, e a carteira é pra onde se volta depois dele.
  it('asks for a new login instead of a retry when the session has expired', async () => {
    vi.spyOn(ingressosApi, 'listarMeusIngressos').mockRejectedValue(
      new SessaoExpiradaError('Não autenticado', 401),
    );

    renderPage();

    expect(await screen.findByRole('alert')).toHaveTextContent(/sessão expirou/i);
    expect(screen.getByRole('link', { name: /entrar de novo/i })).toHaveAttribute('href', '/login');
    expect(screen.queryByRole('button', { name: /tentar novamente/i })).not.toBeInTheDocument();
  });

  // Quem nunca entrou não tem sessão "expirada" pra recuperar: o 401 chega como erro comum, e a
  // carteira anunciava falha de servidor pra quem só precisava fazer login. Sem token não há o que
  // buscar — o convite não espera resposta de API nenhuma.
  it('invites a visitor with no session to log in instead of reporting a failure', async () => {
    const listar = vi.spyOn(ingressosApi, 'listarMeusIngressos');

    renderDeslogado();

    expect(await screen.findByRole('alert')).toHaveTextContent(/entre na sua conta/i);
    expect(screen.getByRole('link', { name: /entrar/i })).toHaveAttribute('href', '/login');
    expect(screen.queryByText(/não foi possível carregar/i)).not.toBeInTheDocument();
    expect(listar).not.toHaveBeenCalled();
  });

  it('renders each ingresso with session title, sala and assento', async () => {
    vi.spyOn(ingressosApi, 'listarMeusIngressos').mockResolvedValue([ingresso]);

    renderPage();

    expect(await screen.findByText('Clube da Luta')).toBeInTheDocument();
    expect(screen.getByText(/SALA 1/)).toBeInTheDocument();
    expect(screen.getByText(/ASSENTO A1/)).toBeInTheDocument();
    expect(screen.getByText('VALIDO')).toBeInTheDocument();
  });

  it('opens the canhoto with the signed code and its QR', async () => {
    vi.spyOn(ingressosApi, 'listarMeusIngressos').mockResolvedValue([ingresso]);

    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: /ver ingresso de clube da luta/i }));

    expect(screen.getByText(/CÓDIGO abc-123\.assinatura/)).toBeInTheDocument();
    // O QR carrega o código assinado, não o link público — o payload em si é coberto por
    // `ContratoQrPortaria.test.tsx`, que fecha a travessia até a chamada da portaria.
    expect(screen.getByTitle(/QR code do ingresso/)).toBeInTheDocument();
    expect(screen.getByText(/escaneie na portaria/i)).toBeInTheDocument();
  });

  it('goes back to the list from the canhoto', async () => {
    vi.spyOn(ingressosApi, 'listarMeusIngressos').mockResolvedValue([ingresso]);

    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: /ver ingresso de clube da luta/i }));
    await userEvent.click(screen.getByRole('button', { name: /voltar pra lista/i }));

    expect(screen.getByRole('button', { name: /ver ingresso de clube da luta/i })).toBeInTheDocument();
    expect(screen.queryByText(/escaneie na portaria/i)).not.toBeInTheDocument();
  });

  it('copies the public link when sharing', async () => {
    vi.spyOn(ingressosApi, 'listarMeusIngressos').mockResolvedValue([ingresso]);
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });

    renderPage();

    const linha = (await screen.findByText('Clube da Luta')).closest('li');
    await userEvent.click(within(linha as HTMLElement).getByRole('button', { name: /compartilhar/i }));

    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/ingressos/abc-123.assinatura`);
    // Pelo `role`, não pelo texto: o mesmo "Link copiado" também é anunciado num `aria-live`
    // invisível, e buscar só pelo texto acha os dois.
    expect(await screen.findByRole('button', { name: /link copiado/i })).toBeInTheDocument();

    vi.unstubAllGlobals();
  });

  // O código é `uuid.assinatura`: uma palavra só, longa, quebrada em várias linhas. Selecionar com
  // o dedo é inviável, e é no celular que o cliente abre o ingresso — o botão é a única forma
  // prática de levar o código pra digitação manual na portaria.
  it('copies the signed code itself, not the public link', async () => {
    vi.spyOn(ingressosApi, 'listarMeusIngressos').mockResolvedValue([ingresso]);
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });

    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /ver ingresso de clube da luta/i }));
    await userEvent.click(screen.getByRole('button', { name: /copiar código/i }));

    expect(writeText).toHaveBeenCalledWith('abc-123.assinatura');
    expect(await screen.findByRole('button', { name: /código copiado/i })).toBeInTheDocument();

    vi.unstubAllGlobals();
  });

  // Sem contexto seguro não existe `navigator.clipboard`, e o `execCommand` do fallback não é
  // implementado pelo jsdom. O que não pode acontecer é o clique não dizer nada: antes o erro era
  // engolido e o usuário ficava sem saber se copiou.
  it('says out loud when copying is not possible instead of failing silently', async () => {
    vi.spyOn(ingressosApi, 'listarMeusIngressos').mockResolvedValue([ingresso]);
    vi.stubGlobal('navigator', { ...navigator, clipboard: undefined });

    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: /ver ingresso de clube da luta/i }));
    await userEvent.click(screen.getByRole('button', { name: /copiar código/i }));

    expect(await screen.findByRole('button', { name: /não foi possível copiar/i })).toBeInTheDocument();

    vi.unstubAllGlobals();
  });
});
