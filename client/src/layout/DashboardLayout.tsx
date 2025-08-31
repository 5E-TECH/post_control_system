import { memo } from 'react';
import Sidebar from './components/Sidebar';
import { Outlet } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';

const DashboardLayout = () => {
  return (
    <div className="flex dark:bg-[#28243d] dark:text-[#E7E3FCE5]">
      <Sidebar />
      <div className='flex-1'>
        <Header />
        <main className='m-6 rounded-md'>
          <Outlet />
        </main>
        <Footer />
      </div>
    </div>
  );
};

export default memo(DashboardLayout);