import { lazy, memo } from "react";
import { useRoutes } from "react-router-dom";
const WaitingOrders = lazy(
  () => import("../pages/orders/components/courier/waiting-orders")
);
const AllOrders = lazy(
  () => import("../pages/orders/components/courier/all-orders")
);
const CancelledOrders = lazy(
  () => import("../pages/orders/components/courier/cancelled-orders")
);
const Login = lazy(() => import("../pages/login"));
const Auth = lazy(() => import("../pages/auth"));
const DashboardLayout = lazy(() => import("../layout/DashboardLayout"));
const Dashboards = lazy(() => import("../pages/dashboards"));
const Orders = lazy(() => import("../pages/orders"));
const CourierOrder = lazy(() => import("../pages/orders/pages/courier"));
const Regions = lazy(() => import("../pages/regions"));
const Districts = lazy(() => import("../pages/regions/pages/districts"));
const Users = lazy(() => import("../pages/users"));
const Mails = lazy(() => import("../pages/mails"));
const Products = lazy(() => import("../pages/products"));
const SendMessage = lazy(() => import("../pages/send-message"));
const LogsPage = lazy(() => import("../pages/logs-page"));
const Payments = lazy(() => import("../pages/payments"));
const RolesPermissions = lazy(() => import("../pages/roles-permissions"));
const Profile = lazy(() => import("../pages/profile"));
const CreateUser = lazy(() => import("../pages/users/create-user"));
const CreateAdmin = lazy(() => import("../pages/users/pages/create-admin"));
const CreateCourier = lazy(() => import("../pages/users/pages/create-courier"));
const CreateMarket = lazy(() => import("../pages/users/pages/create-market"));
const Overview = lazy(() => import("../pages/profile/overview/overview"));
const MainDetail = lazy(() => import("../pages/payments/pages/mainDetail"));
const RefusedMailDetail = lazy(
  () => import("../pages/mails/pages/superadmin/refused-mail-detail")
);

const CreateRegistrator = lazy(
  () => import("../pages/users/pages/create-registrator")
);
const CreateOrder = lazy(
  () => import("../pages/orders/pages/superadmin/create-order")
);
const OrderDetail = lazy(
  () => import("../pages/orders/pages/superadmin/orderDetail")
);
const CashDetail = lazy(() => import("../pages/payments/pages/cashDetail"));
const CashDetailMarketCourier = lazy(() => import("../pages/payments/pages/courier-market-cashDetail"))
const NotFound = lazy(() => import("../shared/ui/NotFound"));
const CustomerInfoOrder = lazy(
  () => import("../pages/orders/pages/superadmin/customer-info")
);
const AllUsersTable = lazy(
  () => import("../pages/users/components/users/all-users-table")
);
const AllMarketsTable = lazy(
  () => import("../pages/users/components/users/all-markets-table")
);
const UsersTable = lazy(
  () => import("../pages/users/components/users/users-table")
);

const ProductCreate = lazy(() => import("../pages/products/product-create"));
const ChooseMarket = lazy(
  () => import("../pages/orders/pages/superadmin/choose-market")
);
const OrderDetails = lazy(
  () => import("../pages/orders/pages/superadmin/order-details")
);
const TodayOrders = lazy(() => import("../pages/today-orders"));
const TodayMails = lazy(
  () => import("../pages/mails/components/superadmin/today-mails")
);
const Orderview = lazy(() => import("../pages/today-orders/pages/orderview"));
const RefusedMails = lazy(
  () => import("../pages/mails/components/superadmin/refused-mails")
);
const OldMails = lazy(
  () => import("../pages/mails/components/superadmin/old-mails")
);
const MailDetail = lazy(
  () => import("../pages/mails/pages/superadmin/mail-detail")
);
const CourierMailDetail = lazy(
  () => import("../pages/mails/pages/kuryer/mail-detail")
);
const CourierNewMails = lazy(
  () => import("../pages/mails/components/courier/new-mails")
);
const CourierRefusedMails = lazy(
  () => import("../pages/mails/components/courier/refused-mails")
);
const CourierOldMails = lazy(
  () => import("../pages/mails/components/courier/old-mails")
);
const BalanceDashboard = lazy(() => import("../pages/history"));
const UserProfile = lazy(() => import("../pages/profile/pages/user-profile"));

const AppRouters = () => {
  return useRoutes([
    {
      path: "/login",
      element: <Login />,
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
              path: "order/markets/new-orders",
              element: <TodayOrders />,
              children: [
                {
                  path: ":id",
                  element: <Orderview />,
                },
              ],
            },
            {
              path: "orders",
              element: <Orders />,
              children: [
                { path: "choose-market", element: <ChooseMarket /> },
                {
                  path: "customer-info",
                  element: <CustomerInfoOrder />,
                },
                { path: "confirm", element: <CreateOrder /> },
                {
                  path: "customer/detail",
                  element: <OrderDetail />,
                },
                {
                  path: "order-detail/:id",
                  element: <OrderDetails />,
                },
              ],
            },
            {
              path: "courier-orders",
              element: <Orders />,
              children: [
                {
                  index: true,
                  element: <CourierOrder />,
                },
                {
                  path: "orders",
                  element: <CourierOrder />,
                  children: [
                    { index: true, element: <WaitingOrders /> },
                    { path: "waiting", element: <WaitingOrders /> },
                    { path: "all", element: <AllOrders /> },
                    { path: "cancelled", element: <CancelledOrders /> },
                  ],
                },
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
            {
              path: "mails",
              element: <Mails />,
              children: [
                {
                  index: true,
                  element: <TodayMails />,
                },
                {
                  path: "refused",
                  element: <RefusedMails />,
                },
                {
                  path: "old",
                  element: <OldMails />,
                },
              ],
            },

            {
              path: "courier-mails",
              element: <Mails />,
              children: [
                { index: true, element: <CourierNewMails /> },
                { path: "refused", element: <CourierRefusedMails /> },
                { path: "old", element: <CourierOldMails /> },
              ],
            },
            {
              path: "mails/:id",
              element: <MailDetail />,
            },
            { path: "mails/refused/mails/:id", element: <RefusedMailDetail /> },

            {
              path: "courier-mails/:id",
              element: <CourierMailDetail />,
            },
            {
              path: "products",
              element: <Products />,
              children: [{ path: "create/:id", element: <ProductCreate /> }],
            },
            { path: "send-message", element: <SendMessage /> },
            { path: "m-balance", element: <BalanceDashboard /> },
            { path: "logs", element: <LogsPage /> },
            {
              path: "payments",
              element: <Payments />,
              children: [
                { path: `cash-detail/:id`, element: <CashDetail /> },
                { path: "main-cashbox", element: <MainDetail /> },
              ],
            },
            { path: "cash-box", element: <CashDetailMarketCourier/>},
            { path: "roles-permissions", element: <RolesPermissions /> },
            {
              path: "profile",
              element: <Profile />,
              children: [{ index: true, element: <Overview /> }],
            },
            {
              path:"user-profile/:id",
              element:<UserProfile/>
            },
            {
              path:"regions", element:<Regions/>,
              children: [{
                path:"districts", element:<Districts/>
              }]
            }
          ],
        },
      ],
    },
    { path: "*", element: <NotFound /> },
  ]);
};

export default memo(AppRouters);
