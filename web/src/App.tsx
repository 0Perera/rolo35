import { BrowserRouter, Routes, Route } from 'react-router';
import { LoginPage } from './pages/LoginPage';
import { PapelPlaceholderPage } from './pages/PapelPlaceholderPage';
import { BuscaFilmesPage } from './pages/BuscaFilmesPage';
import { CriarSessaoPage } from './pages/CriarSessaoPage';
import { GerenciarSessoesPage } from './pages/GerenciarSessoesPage';
import { EditarSessaoPage } from './pages/EditarSessaoPage';
import { ListagemSessoesPage } from './pages/ListagemSessoesPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ListagemSessoesPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/organizador" element={<BuscaFilmesPage />} />
        <Route path="/organizador/sessoes/nova" element={<CriarSessaoPage />} />
        <Route path="/organizador/sessoes" element={<GerenciarSessoesPage />} />
        <Route path="/organizador/sessoes/:id/editar" element={<EditarSessaoPage />} />
        <Route path="/portaria" element={<PapelPlaceholderPage titulo="Área da Portaria" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
