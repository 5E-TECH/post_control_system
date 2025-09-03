import { memo } from 'react';
import Sidebar from './components/Sidebar';
import { Outlet } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';

const DashboardLayout = () => {
  return (
    <div className="flex h-screen dark:bg-[var(--color-dark-bg-py)] dark:text-[#E7E3FCE5]">
      <Sidebar />
      <div className='flex-1 overflow-y-scroll scrollbar-hide'>
        <Header />
        <main className='rounded-md'>
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>
  );
};

export default memo(DashboardLayout);
