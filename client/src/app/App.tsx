import { memo } from "react";
import AppProvider from "./provider";
import AppRouters from "./routes";

const App = () => {
  return (
    <AppProvider>
      <AppRouters />
    </AppProvider>
  );
};

export default memo(App);
