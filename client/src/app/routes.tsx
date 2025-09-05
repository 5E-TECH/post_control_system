import { lazy, memo } from "react";
import { useRoutes } from "react-router-dom";
import ProductCreate from "../pages/products/product-create";
import UsersTable from "../pages/users/components/users/users-table";
import AllMarketsTable from "../pages/users/components/users/all-markets-table";
import AllUsersTable from "../pages/users/components/users/all-users-table";
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
const ProfileOrders = lazy(() => import("../pages/profile/orders/orders"));
const Overview = lazy(() => import("../pages/profile/overview/overview"));
const Maosh = lazy(() => import("../pages/profile/maosh/maosh"));
const ProfilLogs = lazy(
  () => import("../pages/profile/profil-logs/profil-logs")
);
const CreateRegistrator = lazy(
  () => import("../pages/users/pages/create-registrator")
);
const SelectRole = lazy(() => import("../pages/select-role"));
const AuthRole = lazy(() => import("../pages/auth/authRole"));
const CreateOrder = lazy(() => import("../pages/orders/pages/create-order"));
const NotFound = lazy(() => import("../shared/ui/NotFound"));
const CustomerInfoOrder = lazy(
  () => import("../pages/orders/pages/customer-info")
);

const AppRouters = () => {
  return useRoutes([
    {
      path: "/select-role",
      element: <SelectRole />,
    },
    {
      path: "/login",
      element: <AuthRole />,
      children: [
        {
          index: true,
          element: <Login />,
        },
      ],
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
            {
              path: "orders",
              element: <Orders />,
              children: [
                {
                  path: "customer-info",
                  element: <CustomerInfoOrder />,
                },
                { path: "confirm", element: <CreateOrder /> },
              ],
            },
            { path: "regions", element: <Regions /> },
            {
              path: "all-users",
              element: <Users />,
              children: [
                { index: true, element: <AllUsersTable /> },
                { path: "markets", element: <AllMarketsTable /> },
                { path: "users", element: <UsersTable /> },
                {
                  path: "create-user",
                  element: <CreateUser />,
                  children: [
                    { index: true, element: <CreateAdmin /> },
                    { path: "registrator", element: <CreateRegistrator /> },
                    { path: "courier", element: <CreateCourier /> },
                    { path: "market", element: <CreateMarket /> },
                  ],
                },
              ],
            },
            { path: "mails", element: <Mails /> },
            {
              path: "products",
              element: <Products />,
              children: [{ path: "create", element: <ProductCreate /> }],
            },
            { path: "send-message", element: <SendMessage /> },
            { path: "history", element: <History /> },
            { path: "logs", element: <LogsPage /> },
            { path: "payments", element: <Payments /> },
            { path: "roles-permissions", element: <RolesPermissions /> },
            {
              path: "profile",
              element: <Profile />,
              children: [
                { index: true, element: <Overview /> },
                { path: "profil-orders", element: <ProfileOrders /> },
                { path: "profil-maosh", element: <Maosh /> },
                { path: "profil-logs", element: <ProfilLogs /> },
              ],
            },
          ],
        },
      ],
    },
    { path: "*", element: <NotFound /> },
  ]);
};

export default memo(AppRouters);
