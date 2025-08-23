import { memo } from 'react';
import Sidebar from './components/Sidebar';
import { Outlet } from 'react-router-dom';

const DashboardLayout = () => {
  return (
    <div className="flex">
        <Sidebar/>
        <main>
            <Outlet/>
        </main>
    </div>
  );
};

export default memo(DashboardLayout);