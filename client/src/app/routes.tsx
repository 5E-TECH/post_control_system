import { lazy, memo } from 'react';
import { useRoutes } from 'react-router-dom';

const DashboardLayout = lazy(() => import("../layout/DashboardLayout"))
const Dashboards = lazy(() => import("../pages/dashboards"))
const Orders = lazy(() => import("../pages/orders"))
const Regions = lazy(() => import("../pages/regions"))
const Users = lazy(() => import("../pages/users"))
const Mails = lazy(() => import("../pages/mails"))
const SendMessage = lazy(() => import("../pages/send-message"))
const History = lazy(() => import("../pages/history"))
const Logs = lazy(() => import("../pages/logs"))
const Payments = lazy(() => import("../pages/payments"))
const RolesPermissions = lazy(() => import("../pages/roles-permissions"))
const Profile = lazy(() => import("../pages/profile"))

const AppRouters = () => {
  return useRoutes([
    {
      path: "/", element: <DashboardLayout />, children: [
        { index: true, element: <Dashboards /> },
        { path: "orders", element: <Orders /> },
        { path: "regions", element: <Regions /> },
        { path: "users", element: <Users /> },
        { path: "mails", element: <Mails /> },
        { path: "send-message", element: <SendMessage /> },
        { path: "history", element: <History /> },
        { path: "logs", element: <Logs /> },
        { path: "payments", element: <Payments /> },
        { path: "roles-permissions", element: <RolesPermissions /> },
        { path: "profile", element: <Profile /> },
      ]
    }
  ])
};

export default memo(AppRouters);