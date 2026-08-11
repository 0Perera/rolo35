import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { listarMinhasSessoes, type SessaoGestao } from '../api/sessoes';
import { buttonClass } from '../components/Button';
import { PageShell } from '../components/PageShell';

type Estado = 'loading' | 'vazio' | 'erro' | 'pronto';

export function GerenciarSessoesPage() {
  const [sessoes, setSessoes] = useState<SessaoGestao[]>([]);
  const [estado, setEstado] = useState<Estado>('loading');
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let ativo = true;
    setEstado('loading');
    listarMinhasSessoes()
      .then((resultado) => {
        if (!ativo) {
          return;
        }
        setSessoes(resultado);
        setEstado(resultado.length === 0 ? 'vazio' : 'pronto');
      })
      .catch(() => {
        if (ativo) {
          setEstado('erro');
        }
      });
    return () => {
      ativo = false;
    };
  }, [tentativa]);

  return (
    <PageShell>
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <h1 className="font-display text-3xl text-flame-600 [text-shadow:3px_3px_0_var(--color-flame-400)]">
          MINHAS SESSÕES
        </h1>

        {estado === 'loading' && <p className="font-mono text-lg text-ink-950/60">Carregando sessões…</p>}
        {estado === 'vazio' && (
          <p className="font-mono text-lg text-ink-950/60">Você ainda não criou nenhuma sessão.</p>
        )}
        {estado === 'erro' && (
          <p role="alert" className="font-mono text-lg text-flame-600">
            Não foi possível carregar suas sessões agora.
          </p>
        )}

        {(estado === 'erro' || estado === 'vazio') && (
          <button type="button" onClick={() => setTentativa((atual) => atual + 1)} className={buttonClass('secondary')}>
            TENTAR NOVAMENTE
          </button>
        )}

        {estado === 'pronto' && (
          <ul className="flex flex-col gap-4">
            {sessoes.map((sessao) => (
              <li
                key={sessao.id}
                className="flex items-center gap-4 border-[3px] border-ink-950 bg-paper-50 p-4 shadow-[6px_6px_0_var(--color-ink-950)]"
              >
                <div className="flex flex-1 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-xl">{sessao.titulo}</h2>
                    {!sessao.editavel && (
                      <span className="border-2 border-flame-600 px-2 py-0.5 text-xs tracking-wide text-flame-600">
                        Travada
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-base text-ink-950/60">{sessao.salaNome}</span>
                  <span className="font-mono text-base text-ink-950/60">
                    {new Date(sessao.dataHora).toLocaleString('pt-BR')}
                  </span>
                  <span className="text-sm font-semibold">R$ {sessao.preco.toFixed(2).replace('.', ',')}</span>
                </div>
                {sessao.editavel && (
                  <Link to={`/organizador/sessoes/${sessao.id}/editar`} className={buttonClass('secondary', 'px-4 py-2')}>
                    EDITAR
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageShell>
  );
}
