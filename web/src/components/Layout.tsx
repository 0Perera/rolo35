import { Outlet } from 'react-router';
import { Header } from './Header';
import { Footer } from './Footer';

export function Layout() {
  return (
    <div className="min-h-screen bg-paper-100 font-body text-ink-950">
      <Header />
      <Outlet />
      <Footer />
    </div>
  );
}
