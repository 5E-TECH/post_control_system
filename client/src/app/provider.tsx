import { memo, Suspense, useEffect, useState, type ReactNode } from "react";
import { Provider } from "react-redux";
import { BrowserRouter } from "react-router-dom";
import { ConfigProvider, theme as antdTheme } from "antd";
import { store } from "./store";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Suspensee from "../shared/ui/Suspensee";
import { NotificationProvider } from "../shared/components/notification-provider";

const client = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 2, // 2 daqiqa - shu vaqt ichida qayta so'rov yuborilmaydi
      gcTime: 1000 * 60 * 10, // 10 daqiqa - cache da saqlanadi
      refetchOnWindowFocus: false, // Tab ga qaytganda qayta yuklamaydi
    },
  },
});

/**
 * <html> element'idagi `dark` klassi o'zgarishini kuzatib, dark mode flagini
 * Antd ConfigProvider ga reactive ravishda uzatadi. Header komponenti
 * `document.documentElement.classList.add("dark")` orqali bu klassni boshqaradi.
 */
const useHtmlDarkClass = (): boolean => {
  const [isDark, setIsDark] = useState<boolean>(() =>
    typeof document !== "undefined"
      ? document.documentElement.classList.contains("dark")
      : false,
  );

  useEffect(() => {
    const target = document.documentElement;
    const update = () => setIsDark(target.classList.contains("dark"));
    update();
    const observer = new MutationObserver(update);
    observer.observe(target, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  return isDark;
};

const ThemedShell = ({ children }: { children: ReactNode }) => {
  const isDark = useHtmlDarkClass();
  return (
    <ConfigProvider
      theme={{
        algorithm: isDark
          ? antdTheme.darkAlgorithm
          : antdTheme.defaultAlgorithm,
        token: {
          // Loyihaning brand rangiga moslashtirish — purple/indigo
          colorPrimary: "#7C3AED",
        },
      }}
    >
      {children}
    </ConfigProvider>
  );
};

const AppProvider = ({ children }: { children: ReactNode }) => {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Provider store={store}>
        <QueryClientProvider client={client}>
          <ThemedShell>
            <NotificationProvider>
              <Suspense fallback={<Suspensee />}>{children}</Suspense>
            </NotificationProvider>
          </ThemedShell>
        </QueryClientProvider>
      </Provider>
    </BrowserRouter>
  );
};

export default memo(AppProvider);
