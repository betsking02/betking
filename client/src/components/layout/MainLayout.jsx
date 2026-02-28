import Header from './Header';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import './MainLayout.css';

export default function MainLayout({ children }) {
  return (
    <div className="app-layout">
      <Header />
      <Sidebar />
      <main className="main-content">
        {children}
      </main>
      <MobileNav />
    </div>
  );
}
