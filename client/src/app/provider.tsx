import { memo, Suspense, type ReactNode } from "react";
import { Provider } from "react-redux";
import { BrowserRouter } from "react-router-dom";
import { store } from "./store";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Suspensee from "../shared/ui/Suspensee";
import { NotificationProvider } from "../shared/components/notification-provider";

const client = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
    },
  },
});

const AppProvider = ({ children }: { children: ReactNode }) => {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Provider store={store}>
        <QueryClientProvider client={client}>
          <NotificationProvider>
            <Suspense fallback={<Suspensee />}>{children}</Suspense>
          </NotificationProvider>
        </QueryClientProvider>
      </Provider>
    </BrowserRouter>
  );
};

export default memo(AppProvider);
