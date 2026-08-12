import { BrowserRouter, Navigate, Routes, Route } from 'react-router';
import { Layout } from './components/Layout';
import { RolarAoTrocarDeRota } from './components/RolarAoTrocarDeRota';
import { LoginPage } from './pages/LoginPage';
import { PapelPlaceholderPage } from './pages/PapelPlaceholderPage';
import { GerenciarSessoesPage } from './pages/GerenciarSessoesPage';
import { ListagemSessoesPage } from './pages/ListagemSessoesPage';
import { FilmeDetalhePage } from './pages/FilmeDetalhePage';
import { SobrePage } from './pages/SobrePage';

function App() {
  return (
    <BrowserRouter>
      <RolarAoTrocarDeRota />
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
          <Route
            path="/cadastro"
            element={
              <PapelPlaceholderPage
                titulo="Ficha nova"
                mensagem="O autocadastro de cliente chega na Story 1.3. Por enquanto, as contas vêm do seed."
              />
            }
          />
          <Route element={<Layout />}>
            <Route path="/" element={<ListagemSessoesPage />} />
            <Route path="/filmes/:tmdbId" element={<FilmeDetalhePage />} />
            <Route path="/sobre" element={<SobrePage />} />
            {/* O painel cria e edita sessão na própria tela; as rotas antigas de
                busca/criação/edição em telas separadas caíram junto com elas. */}
            <Route path="/organizador" element={<GerenciarSessoesPage />} />
            <Route path="/organizador/sessoes" element={<Navigate to="/organizador" replace />} />
            <Route path="/portaria" element={<PapelPlaceholderPage titulo="Área da Portaria" />} />
            <Route path="/em-construcao" element={<PapelPlaceholderPage />} />
          </Route>
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
