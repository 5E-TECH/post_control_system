// Beepost - Client Routes v3
import { lazy, memo } from "react";
import { Navigate, useRoutes } from "react-router-dom";
import RequireRole from "../shared/components/require-role";

const ScanAndOrder = lazy(
  () =>
    import("../pages/orders/pages/superadmin/order-details/scan/scanAndOrder")
);
const ScanPage = lazy(
  () => import("../pages/orders/pages/superadmin/order-details/scan/scanPage")
);
const WaitingOrders = lazy(
  () => import("../pages/orders/components/courier/waiting-orders")
);
const AllOrders = lazy(
  () => import("../pages/orders/components/courier/all-orders")
);
const CancelledOrders = lazy(
  () => import("../pages/orders/components/courier/cancelled-orders")
);
const TelegramBot = lazy(() => import("../pages/telegram-bot"));
const CreateOrderBot = lazy(() => import("../pages/telegram-bot/order-created-bot"));
const AuthTelegram = lazy(() => import("../pages/telegram-bot/auth"));
const Login = lazy(() => import("../pages/login"));
const Auth = lazy(() => import("../pages/auth"));
const DashboardLayout = lazy(() => import("../layout/DashboardLayout"));
const Dashboards = lazy(() => import("../pages/dashboards"));
const Orders = lazy(() => import("../pages/orders"));
const CourierOrder = lazy(() => import("../pages/orders/pages/courier"));
const Regions = lazy(() => import("../pages/regions"));
const Districts = lazy(() => import("../pages/regions/pages/districts"));
const SatoManagement = lazy(() => import("../pages/regions/pages/sato-management"));
const LogistAssignment = lazy(() => import("../pages/regions/pages/logist-assignment"));
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
const CreateLogist = lazy(
  () => import("../pages/users/pages/create-logist")
);
const CreateOrder = lazy(
  () => import("../pages/orders/pages/superadmin/create-order")
);
const AiCreateOrder = lazy(
  () => import("../pages/orders/pages/superadmin/ai-create-order")
);
const MarketAiBalance = lazy(() => import("../pages/ai-balance"));
const OrderDetail = lazy(
  () => import("../pages/orders/pages/superadmin/orderDetail")
);
const CashDetail = lazy(() => import("../pages/payments/pages/cashDetail"));
const CardDetail = lazy(() => import("../pages/payments/pages/cardDetail"));
const CashDetailMarketCourier = lazy(
  () => import("../pages/payments/pages/courier-market-cashDetail")
);
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
const CustomerDetailPage = lazy(
  () => import("../pages/orders/pages/superadmin/customer-detail")
);
const TodayOrders = lazy(() => import("../pages/today-orders"));
const TodayMails = lazy(
  () => import("../pages/mails/components/superadmin/today-mails")
);
const Orderview = lazy(() => import("../pages/today-orders/pages/orderview"));
const ReturnRequests = lazy(
  () => import("../pages/mails/components/superadmin/return-requests")
);
const ReplacementReturns = lazy(
  () => import("../pages/orders/pages/superadmin/replacement-returns")
);
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
const FinancialHistory = lazy(() => import("../pages/payments/pages/financial-history"));
const UserProfile = lazy(() => import("../pages/profile/pages/user-profile"));
const Integrations = lazy(
  () => import("../pages/integrations/IntegrationsRoot"),
);
const Settings = lazy(() => import("../pages/settings"));
const MarketOperators = lazy(() => import("../pages/market-operators"));
const OperatorStats = lazy(
  () => import("../pages/market-operators/pages/operator-stats")
);
const OperatorEarnings = lazy(() => import("../pages/operator-earnings"));
const OperatorOrders = lazy(() => import("../pages/operator-orders"));
const CourierBulk = lazy(() => import("../pages/courier-bulk"));
const MyRegion = lazy(() => import("../pages/my-region"));
const Investor = lazy(() => import("../pages/investor"));
const InvestorOverview = lazy(() => import("../pages/investor/overview"));
const InvestorFinancials = lazy(() => import("../pages/investor/financials"));
const InvestorOperations = lazy(() => import("../pages/investor/operations"));

const AppRouters = () => {
  return useRoutes([
    {
      path: "/login",
      element: <Login />,
    },
    {
      path: "bot",
      element: <TelegramBot />,
    },
    {
      path:"authtelegram",
      element:<AuthTelegram/>,
      children:[
        {
          index:true,
          element:<CreateOrderBot/>
        },
      ]
    },
    {
      path: "/",
      element: <Auth />,
      children: [


        {
          path: "scan",
          element: <ScanPage />,
        },
        {
          path: "scan/:token",
          element: <ScanAndOrder />,
        },
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
                { path: "ai-create", element: <AiCreateOrder /> },
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
                {
                  path: "customer/:id",
                  element: <CustomerDetailPage />,
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
            {
              path: "replacement-returns",
              element: (
                <RequireRole roles={["superadmin", "admin", "registrator"]}>
                  <ReplacementReturns />
                </RequireRole>
              ),
            },
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
                    { path: "logist", element: <CreateLogist /> },
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
                  path: "return-requests",
                  element: (
                    <RequireRole roles={["superadmin", "admin"]}>
                      <ReturnRequests />
                    </RequireRole>
                  ),
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
              path: "courier-bulk",
              element: <CourierBulk />,
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
            { path: "m-balance", element: <FinancialHistory /> },
            // Logs endi Settings ichida — eski URL redirect
            { path: "logs", element: <Navigate to="/settings/logs" replace /> },
            {
              path: "payments",
              element: <Payments />,
              children: [
                { path: `cash-detail/:id`, element: <CashDetail /> },
                { path: "main-cashbox", element: <MainDetail /> },
                { path: "card-detail/:id", element: <CardDetail /> },
              ],
            },
            { path: "cash-box", element: <CashDetailMarketCourier /> },
            { path: "ai-balance", element: <MarketAiBalance /> },
            { path: "my-region", element: <MyRegion /> },
            // Rollar endi Settings ichida — eski URL redirect
            {
              path: "roles-permissions",
              element: <Navigate to="/settings/roles-permissions" replace />,
            },
            {
              path: "profile",
              element: <Profile />,
              children: [{ index: true, element: <Overview /> }],
            },
            {
              path: "user-profile/:id",
              element: <UserProfile />,
            },
            {
              path: "regions",
              element: <Regions />,
              children: [
                // Config sub-sahifalar endi Settings ichida — eski URL redirect
                {
                  path: "districts",
                  element: <Navigate to="/settings/districts" replace />,
                },
                {
                  path: "sato-management",
                  element: <Navigate to="/settings/sato-management" replace />,
                },
                {
                  path: "logist-assignment",
                  element: (
                    <Navigate to="/settings/logist-assignment" replace />
                  ),
                },
              ],
            },
            {
              // Eski URL — yangi joyga redirect (eski bookmark/linklar ishlasin)
              path: "integrations",
              element: <Navigate to="/settings/integrations" replace />,
            },
            {
              path: "settings",
              element: <Settings />,
              children: [
                {
                  path: "integrations",
                  element: (
                    <RequireRole roles={["admin", "superadmin"]}>
                      <Integrations />
                    </RequireRole>
                  ),
                },
                {
                  path: "logist-assignment",
                  element: (
                    <RequireRole roles={["admin", "superadmin"]}>
                      <LogistAssignment />
                    </RequireRole>
                  ),
                },
                {
                  path: "districts",
                  element: (
                    <RequireRole roles={["superadmin"]}>
                      <Districts />
                    </RequireRole>
                  ),
                },
                {
                  path: "sato-management",
                  element: (
                    <RequireRole roles={["superadmin"]}>
                      <SatoManagement />
                    </RequireRole>
                  ),
                },
                {
                  path: "roles-permissions",
                  element: (
                    <RequireRole roles={["superadmin"]}>
                      <RolesPermissions />
                    </RequireRole>
                  ),
                },
                {
                  path: "logs",
                  element: (
                    <RequireRole roles={["admin", "superadmin"]}>
                      <LogsPage />
                    </RequireRole>
                  ),
                },
              ],
            },
            {
              path: "market-operators",
              element: <MarketOperators />,
            },
            {
              path: "market-operators/:id/stats",
              element: <OperatorStats />,
            },
            {
              path: "my-earnings",
              element: <OperatorEarnings />,
            },
            {
              path: "my-orders",
              element: <OperatorOrders />,
            },
            {
              path: "investor",
              element: (
                <RequireRole roles={["investor", "superadmin"]}>
                  <Investor />
                </RequireRole>
              ),
              children: [
                { index: true, element: <Navigate to="overview" replace /> },
                { path: "overview", element: <InvestorOverview /> },
                { path: "financials", element: <InvestorFinancials /> },
                { path: "operations", element: <InvestorOperations /> },
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
