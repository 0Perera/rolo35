import { BrowserRouter, Routes, Route } from 'react-router';
import { LoginPage } from './pages/LoginPage';
import { PapelPlaceholderPage } from './pages/PapelPlaceholderPage';
import { BuscaFilmesPage } from './pages/BuscaFilmesPage';
import { CriarSessaoPage } from './pages/CriarSessaoPage';
import { ListagemSessoesPage } from './pages/ListagemSessoesPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/organizador" element={<BuscaFilmesPage />} />
        <Route path="/organizador/sessoes/nova" element={<CriarSessaoPage />} />
        <Route path="/cliente" element={<ListagemSessoesPage />} />
        <Route path="/portaria" element={<PapelPlaceholderPage titulo="Área da Portaria" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
