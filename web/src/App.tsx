import { BrowserRouter, Routes, Route } from 'react-router';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { PapelPlaceholderPage } from './pages/PapelPlaceholderPage';
import { BuscaFilmesPage } from './pages/BuscaFilmesPage';
import { CriarSessaoPage } from './pages/CriarSessaoPage';
import { GerenciarSessoesPage } from './pages/GerenciarSessoesPage';
import { EditarSessaoPage } from './pages/EditarSessaoPage';
import { ListagemSessoesPage } from './pages/ListagemSessoesPage';
import { FilmeDetalhePage } from './pages/FilmeDetalhePage';

function App() {
  return (
    <BrowserRouter>
      <div className="relative" style={{ containerType: 'inline-size' }}>
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-[60] opacity-[0.13]"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg, rgba(23,18,25,0.35) 0px, rgba(23,18,25,0.35) 1px, transparent 1px, transparent 3px)',
          }}
        />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<Layout />}>
            <Route path="/" element={<ListagemSessoesPage />} />
            <Route path="/filmes/:tmdbId" element={<FilmeDetalhePage />} />
            <Route path="/organizador" element={<BuscaFilmesPage />} />
            <Route path="/organizador/sessoes/nova" element={<CriarSessaoPage />} />
            <Route path="/organizador/sessoes" element={<GerenciarSessoesPage />} />
            <Route path="/organizador/sessoes/:id/editar" element={<EditarSessaoPage />} />
            <Route path="/portaria" element={<PapelPlaceholderPage titulo="Área da Portaria" />} />
            <Route path="/em-construcao" element={<PapelPlaceholderPage />} />
          </Route>
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
