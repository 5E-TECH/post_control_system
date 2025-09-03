import { lazy, memo } from "react";
import { useRoutes } from "react-router-dom";
import SelectRole from "../pages/select-role";
import AuthRole from "../pages/auth/authRole";

const Login = lazy(() => import("../pages/login"));
const Auth = lazy(() => import("../pages/auth"));
const DashboardLayout = lazy(() => import("../layout/DashboardLayout"));
const Dashboards = lazy(() => import("../pages/dashboards"));
const Orders = lazy(() => import("../pages/orders"));
const Regions = lazy(() => import("../pages/regions"));
const Users = lazy(() => import("../pages/users"));
const Mails = lazy(() => import("../pages/mails"));
const Products = lazy(() => import("../pages/products"));
const SendMessage = lazy(() => import("../pages/send-message"));
const History = lazy(() => import("../pages/history"));
const LogsPage = lazy(() => import("../pages/logs-page"));
const Payments = lazy(() => import("../pages/payments"));
const RolesPermissions = lazy(() => import("../pages/roles-permissions"));
const Profile = lazy(() => import("../pages/profile"));
const CreateUser = lazy(() => import("../pages/users/create-user"));
const CreateAdmin = lazy(() => import("../pages/users/pages/create-admin"));
const CreateCourier = lazy(() => import("../pages/users/pages/create-courier"));
const CreateMarket = lazy(() => import("../pages/users/pages/create-market"));

const AppRouters = () => {
  return useRoutes([
    {
      path: "/select-role",
      element: <SelectRole />,
    },
    {
      path: "/login",
      element: <AuthRole />,
      children:[
        {
          index:true,
          element:<Login/>
        }
      ]
    },
    {
      path: "/",
      element: <Auth />,
      children: [
        {
          path: "/",
          element: <DashboardLayout />,
          children: [
            { index: true, element: <Dashboards /> },
            { path: "orders", element: <Orders /> },
            { path: "regions", element: <Regions /> },
            { path: "users", element: <Users /> },
            {
              path: "create-user",
              element: <CreateUser />,
              children: [
                { index: true, element: <CreateAdmin /> },
                { path: "courier", element: <CreateCourier /> },
                { path: "market", element: <CreateMarket /> },
              ],
            },
            { path: "mails", element: <Mails /> },
            { path: "products", element: <Products /> },
            { path: "send-message", element: <SendMessage /> },
            { path: "history", element: <History /> },
            { path: "logs", element: <LogsPage /> },
            { path: "payments", element: <Payments /> },
            { path: "roles-permissions", element: <RolesPermissions /> },
            { path: "profile", element: <Profile /> },
          ],
        },
      ],
    },
  ]);
};

export default memo(AppRouters);
