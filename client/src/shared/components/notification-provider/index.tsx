import React, { createContext, useContext, useMemo } from "react";
import { notification } from "antd";

type NotificationContextType = {
  api: ReturnType<typeof notification.useNotification>[0];
};

const NotificationContext = createContext<NotificationContextType | null>(null);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [api, contextHolder] = notification.useNotification();

  const value = useMemo(() => ({ api }), [api]);

  return (
    <NotificationContext.Provider value={value}>
      {contextHolder}
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotificationApi = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      "useNotificationApi must be used within a NotificationProvider"
    );
  }
  return context.api;
};
