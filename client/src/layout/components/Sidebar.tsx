import { memo } from 'react';
import { NavLink } from 'react-router-dom';
import logo from '../../shared/assets/logo.svg'
import { Apple, CarFront, FileText, History, House, LockKeyhole, MailOpen, MessagesSquare, ShoppingBag, SquareDashedMousePointer, UserRound } from 'lucide-react';

const Sidebar = () => {
  return (
    <div className='bg-[var(--color-bg-py)] dark:bg-[var(--color-dark-bg-py)] dark:text-[#E7E3FCE5]'>
      <div className='h-16 flex justify-center items-center'>
        <NavLink to={'/'} className={'flex items-center gap-3'}>
          <div>
            <img src={logo} alt="" />
          </div>
          <span className='text-xl font-semibold'>Beepost</span>
        </NavLink>
      </div>
      <ul className='w-65 flex flex-col gap-1.5 mr-4'>
        <li>
          <NavLink to={'/'} end={true} className={({ isActive }) => `flex gap-2 pl-5.5 py-2 ${isActive ? 'bg-gradient-to-r from-[#ccb5ff] to-[#8247ff] rounded-r-[50px]' : ''}`}>
            <House />
            <span>Dashboard</span>
          </NavLink>
        </li>
        <li>
          <NavLink to={'/today-order'} className={({ isActive }) => `flex gap-2 pl-5.5 py-2 ${isActive ? 'bg-gradient-to-r from-[#ccb5ff] to-[#8247ff] rounded-r-[50px]' : ''}`}>
            <ShoppingBag />
            <span>Today Order</span>
          </NavLink>
        </li>
        <li>
          <NavLink to={'/orders'} className={({ isActive }) => `flex gap-2 pl-5.5 py-2 ${isActive ? 'bg-gradient-to-r from-[#ccb5ff] to-[#8247ff] rounded-r-[50px]' : ''}`}>
            <ShoppingBag />
            <span>Orders</span>
          </NavLink>
        </li>
        <li>
          <NavLink to={'/regions'} className={({ isActive }) => `flex gap-2 pl-5.5 py-2 ${isActive ? 'bg-gradient-to-r from-[#ccb5ff] to-[#8247ff] rounded-r-[50px]' : ''}`}>
            <CarFront />
            <span>Regions</span>
          </NavLink>
        </li>
        <li>
          <NavLink to={'/all-users'} className={({ isActive }) => `flex gap-2 pl-5.5 py-2 ${isActive ? 'bg-gradient-to-r from-[#ccb5ff] to-[#8247ff] rounded-r-[50px]' : ''}`}>
            <UserRound />
            <span>Users</span>
          </NavLink>
        </li>
        <li>
          <NavLink to={'/mails'} className={({ isActive }) => `flex gap-2 pl-5.5 py-2 ${isActive ? 'bg-gradient-to-r from-[#ccb5ff] to-[#8247ff] rounded-r-[50px]' : ''}`}>
            <MailOpen />
            <span>Mails</span>
          </NavLink>
        </li>
        <li>
          <NavLink to={'/products'} className={({ isActive }) => `flex gap-2 pl-5.5 py-2 ${isActive ? 'bg-gradient-to-r from-[#ccb5ff] to-[#8247ff] rounded-r-[50px]' : ''}`}>
            <Apple />
            <span>Products</span>
          </NavLink>
        </li>
        <li>
          <NavLink to={'/send-message'} className={({ isActive }) => `flex gap-2 pl-5.5 py-2 ${isActive ? 'bg-gradient-to-r from-[#ccb5ff] to-[#8247ff] rounded-r-[50px]' : ''}`}>
            <MessagesSquare />
            <span>Send message</span>
          </NavLink>
        </li>
        <li>
          <NavLink to={'/history'} className={({ isActive }) => `flex gap-2 pl-5.5 py-2 ${isActive ? 'bg-gradient-to-r from-[#ccb5ff] to-[#8247ff] rounded-r-[50px]' : ''}`}>
            <History />
            <span>History</span>
          </NavLink>
        </li>
        <li>
          <NavLink to={'/logs'} className={({ isActive }) => `flex gap-2 pl-5.5 py-2 ${isActive ? 'bg-gradient-to-r from-[#ccb5ff] to-[#8247ff] rounded-r-[50px]' : ''}`}>
            <SquareDashedMousePointer />
            <span>Logs</span>
          </NavLink>
        </li>
        <li>
          <NavLink to={'/payments'} className={({ isActive }) => `flex gap-2 pl-5.5 py-2 ${isActive ? 'bg-gradient-to-r from-[#ccb5ff] to-[#8247ff] rounded-r-[50px]' : ''}`}>
            <FileText />
            <span>Payments</span>
          </NavLink>
        </li>
        <li>
          <NavLink to={'/roles-permissions'} className={({ isActive }) => `flex gap-2 pl-5.5 py-2 ${isActive ? 'bg-gradient-to-r from-[#ccb5ff] to-[#8247ff] rounded-r-[50px]' : ''}`}>
            <LockKeyhole />
            <span>Roles & Permissions</span>
          </NavLink>
        </li>
      </ul>
    </div>
  );
};

export default memo(Sidebar);