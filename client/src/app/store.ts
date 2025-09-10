import { configureStore } from "@reduxjs/toolkit";
import authSlice from "../shared/lib/features/login/authSlice";
import signInSlice from "../shared/lib/features/login/signInSlice";
import roleSlice from "../shared/lib/features/roleSlice";
import profileEditSlice from "../shared/lib/features/profile/profileEditSlice";
import setCustomerMarketId from "../shared/lib/features/customer_and_market-id";
import resetCustomerMarketId from "../shared/lib/features/customer_and_market-id";
import setCustomerData from "../shared/lib/features/customer_and_market-id";
export const store = configureStore({
  reducer: {
    authSlice,
    signInSlice,
    roleSlice,
    profileEditSlice,
    setCustomerMarketId,
    resetCustomerMarketId,
    setCustomerData,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
