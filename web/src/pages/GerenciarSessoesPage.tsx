import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { listarMinhasSessoes, type SessaoGestao } from '../api/sessoes';

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
    <main className="min-h-screen bg-sepia-950 px-4 py-10 font-body text-cream-100">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <h1 className="font-display text-3xl tracking-wide text-amber-300">Minhas sessões</h1>

        {estado === 'loading' && <p className="text-sm text-cream-300">Carregando sessões…</p>}
        {estado === 'vazio' && <p className="text-sm text-cream-300">Você ainda não criou nenhuma sessão.</p>}
        {estado === 'erro' && (
          <p role="alert" className="text-sm text-velvet-600">
            Não foi possível carregar suas sessões agora.
          </p>
        )}

        {(estado === 'erro' || estado === 'vazio') && (
          <button
            type="button"
            onClick={() => setTentativa((atual) => atual + 1)}
            className="self-start rounded border border-gold-500/60 px-4 py-2 font-display tracking-wide text-amber-300 transition hover:bg-sepia-900"
          >
            Tentar novamente
          </button>
        )}

        {estado === 'pronto' && (
          <ul className="flex flex-col gap-4">
            {sessoes.map((sessao) => (
              <li
                key={sessao.id}
                className="flex items-center gap-4 rounded border border-gold-500/40 bg-sepia-900 p-4"
              >
                <div className="flex flex-1 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-display text-xl tracking-wide text-amber-300">{sessao.titulo}</h2>
                    {!sessao.editavel && (
                      <span className="rounded border border-velvet-600 px-2 py-0.5 text-xs tracking-wide text-velvet-600">
                        Travada
                      </span>
                    )}
                  </div>
                  <span className="text-sm text-cream-300">{sessao.salaNome}</span>
                  <span className="text-sm text-cream-300">{new Date(sessao.dataHora).toLocaleString('pt-BR')}</span>
                  <span className="text-sm text-cream-100">
                    R$ {sessao.preco.toFixed(2).replace('.', ',')}
                  </span>
                </div>
                {sessao.editavel && (
                  <Link
                    to={`/organizador/sessoes/${sessao.id}/editar`}
                    className="rounded border border-gold-500/60 px-4 py-2 font-display tracking-wide text-amber-300 transition hover:bg-sepia-950"
                  >
                    Editar
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
