import { lazy, memo } from "react";
import { useRoutes } from "react-router-dom";
import CreateAdmin from "../pages/users/pages/create-admin";
import CreateCourier from "../pages/users/pages/create-courier";
import CreateMarket from "../pages/users/pages/create-market";

const DashboardLayout = lazy(() => import("../layout/DashboardLayout"));
const Dashboards = lazy(() => import("../pages/dashboards"));
const Orders = lazy(() => import("../pages/orders"));
const Regions = lazy(() => import("../pages/regions"));
const Users = lazy(() => import("../pages/users"));
const Mails = lazy(() => import("../pages/mails"));
const SendMessage = lazy(() => import("../pages/send-message"));
const History = lazy(() => import("../pages/history"));
const LogsPage = lazy(() => import("../pages/logs-page"));
const Payments = lazy(() => import("../pages/payments"));
const RolesPermissions = lazy(() => import("../pages/roles-permissions"));
const Profile = lazy(() => import("../pages/profile"));
const CreateUser = lazy(() => import("../pages/users/create-user"));

const AppRouters = () => {
  return useRoutes([
    {
      path: "/",
      element: <DashboardLayout />,
      children: [
        { index: true, element: <Dashboards /> },
        { path: "orders", element: <Orders /> },
        { path: "regions", element: <Regions /> },
        {
          path: "users",
          element: <Users />,
        },
        {
          path: "create-user",
          element: <CreateUser />,
          children: [
            {
              index: true,
              element: <CreateAdmin />,
            },
            {
              path: "courier",
              element: <CreateCourier />,
            },
            {
              path: "market",
              element: <CreateMarket />,
            },
          ],
        },
        { path: "mails", element: <Mails /> },
        { path: "send-message", element: <SendMessage /> },
        { path: "history", element: <History /> },
        { path: "logs", element: <LogsPage /> },
        { path: "payments", element: <Payments /> },
        { path: "roles-permissions", element: <RolesPermissions /> },
        { path: "profile", element: <Profile /> },
      ],
    },
  ]);
};

export default memo(AppRouters);
