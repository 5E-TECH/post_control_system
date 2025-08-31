import { memo } from 'react';
import { NavLink } from 'react-router-dom';
import logo from '../../shared/assets/logo.svg'
import dashboards from '../../shared/assets/sidebar/dashboards.svg'
import order from '../../shared/assets/sidebar/order.svg'
import regions from '../../shared/assets/sidebar/regions.svg'
import users from '../../shared/assets/sidebar/users.svg'
import mails from '../../shared/assets/sidebar/mails.svg'
import sendMessage from '../../shared/assets/sidebar/send-message.svg'
import history from '../../shared/assets/sidebar/history.svg'
import logs from '../../shared/assets/sidebar/logs.svg'
import payments from '../../shared/assets/sidebar/payments.svg'
import rolesPermissions from '../../shared/assets/sidebar/roles-permissions.svg'

const Sidebar = () => {
  return (
    <div className='dark:bg-[#28243d] dark:text-[#E7E3FCE5]'>
      <div className='h-16 flex justify-center items-center'>
        <NavLink to={'/'} className={'flex items-center gap-3'}>
          <div>
            <img src={logo} alt="" />
          </div>
          <span className='text-xl font-semibold'>Beepost</span>
        </NavLink>
      </div>
      <ul className='w-65 h-screen flex flex-col gap-1.5 mr-4'>
        <li>
          <NavLink to={'/'} end={true} className={({ isActive }) => `flex gap-2 pl-5.5 py-2 ${isActive ? 'bg-gradient-to-r from-[#ccb5ff] to-[#8247ff] rounded-r-[50px]' : ''}`}>
            <div>
              <img src={dashboards} alt="" />
            </div>
            <span>Dashboards</span>
          </NavLink>
        </li>
        <li>
          <NavLink to={'/orders'} className={({ isActive }) => `flex gap-2 pl-5.5 py-2 ${isActive ? 'bg-gradient-to-r from-[#ccb5ff] to-[#8247ff] rounded-r-[50px]' : ''}`}>
            <div>
              <img src={order} alt="" />
            </div>
            <span>Orders</span>
          </NavLink>
        </li>
        <li>
          <NavLink to={'/regions'} className={({ isActive }) => `flex gap-2 pl-5.5 py-2 ${isActive ? 'bg-gradient-to-r from-[#ccb5ff] to-[#8247ff] rounded-r-[50px]' : ''}`}>
            <div>
              <img src={regions} alt="" />
            </div>
            <span>Regions</span>
          </NavLink>
        </li>
        <li>
          <NavLink to={'/users'} className={({ isActive }) => `flex gap-2 pl-5.5 py-2 ${isActive ? 'bg-gradient-to-r from-[#ccb5ff] to-[#8247ff] rounded-r-[50px]' : ''}`}>
            <div>
              <img src={users} alt="" />
            </div>
            <span>Users</span>
          </NavLink>
        </li>
        <li>
          <NavLink to={'/mails'} className={({ isActive }) => `flex gap-2 pl-5.5 py-2 ${isActive ? 'bg-gradient-to-r from-[#ccb5ff] to-[#8247ff] rounded-r-[50px]' : ''}`}>
            <div>
              <img src={mails} alt="" />
            </div>
            <span>Mails</span>
          </NavLink>
        </li>
        <li>
          <NavLink to={'/send-message'} className={({ isActive }) => `flex gap-2 pl-5.5 py-2 ${isActive ? 'bg-gradient-to-r from-[#ccb5ff] to-[#8247ff] rounded-r-[50px]' : ''}`}>
            <div>
              <img src={sendMessage} alt="" />
            </div>
            <span>Send message</span>
          </NavLink>
        </li>
        <li>
          <NavLink to={'/history'} className={({ isActive }) => `flex gap-2 pl-5.5 py-2 ${isActive ? 'bg-gradient-to-r from-[#ccb5ff] to-[#8247ff] rounded-r-[50px]' : ''}`}>
            <div>
              <img src={history} alt="" />
            </div>
            <span>History</span>
          </NavLink>
        </li>
        <li>
          <NavLink to={'/logs'} className={({ isActive }) => `flex gap-2 pl-5.5 py-2 ${isActive ? 'bg-gradient-to-r from-[#ccb5ff] to-[#8247ff] rounded-r-[50px]' : ''}`}>
            <div>
              <img src={logs} alt="" />
            </div>
            <span>Logs</span>
          </NavLink>
        </li>
        <li>
          <NavLink to={'/payments'} className={({ isActive }) => `flex gap-2 pl-5.5 py-2 ${isActive ? 'bg-gradient-to-r from-[#ccb5ff] to-[#8247ff] rounded-r-[50px]' : ''}`}>
            <div>
              <img src={payments} alt="" />
            </div>
            <span>Payments</span>
          </NavLink>
        </li>
        <li>
          <NavLink to={'/roles-permissions'} className={({ isActive }) => `flex gap-2 pl-5.5 py-2 ${isActive ? 'bg-gradient-to-r from-[#ccb5ff] to-[#8247ff] rounded-r-[50px]' : ''}`}>
            <div>
              <img src={rolesPermissions} alt="" />
            </div>
            <span>Roles & Permissions</span>
          </NavLink>
        </li>
      </ul>
    </div>
  );
};

export default memo(Sidebar);