import { lazy, memo } from 'react';
import { useRoutes } from 'react-router-dom';
import Login from '../pages/login';
import Overview from '../pages/profile/overview/overview';
import Maosh from '../pages/profile/maosh/maosh';
import ProfilLogs from '../pages/profile/profil-logs/profil-logs';
import ProfileProduct from '../pages/profile/products/product';

const DashboardLayout = lazy(() => import('../layout/DashboardLayout'));
const Dashboards = lazy(() => import('../pages/dashboards'));
const Orders = lazy(() => import('../pages/orders'));
const Regions = lazy(() => import('../pages/regions'));
const Users = lazy(() => import('../pages/users'));
const Mails = lazy(() => import('../pages/mails'));
const Products = lazy(() => import('../pages/products'));
const SendMessage = lazy(() => import('../pages/send-message'));
const History = lazy(() => import('../pages/history'));
const LogsPage = lazy(() => import('../pages/logs-page'));
const Payments = lazy(() => import('../pages/payments'));
const RolesPermissions = lazy(() => import('../pages/roles-permissions'));
const Profile = lazy(() => import('../pages/profile'));
const ProfileOrders = lazy(() => import('../pages/profile/orders/orders'));

const AppRouters = () => {
  return useRoutes([
    {
      path: '/login',
      element: <Login />,
    },
    {
      path: '/',
      element: <DashboardLayout />,
      children: [
        { index: true, element: <Dashboards /> },
        { path: 'orders', element: <Orders /> },
        { path: 'regions', element: <Regions /> },
        { path: 'users', element: <Users /> },
        { path: 'mails', element: <Mails /> },
        { path: 'products', element: <Products /> },
        { path: 'send-message', element: <SendMessage /> },
        { path: 'history', element: <History /> },
        { path: 'logs', element: <LogsPage /> },
        { path: 'payments', element: <Payments /> },
        { path: 'roles-permissions', element: <RolesPermissions /> },
        {
          path: 'profile',
          element: <Profile />,
          children: [
            { index: true, element: <Overview /> },
            { path: 'profil-orders', element: <ProfileOrders /> },
            { path: 'profil-maosh', element: <Maosh /> },
            { path: 'profil-logs', element: <ProfilLogs /> },
            { path: 'profil-products', element: <ProfileProduct /> },
          ],
        },
      ],
    },
  ]);
};

export default memo(AppRouters);
