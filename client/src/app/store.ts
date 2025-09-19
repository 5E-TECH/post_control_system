import { configureStore } from "@reduxjs/toolkit";
import authSlice from "../shared/lib/features/login/authSlice";
import signInSlice from "../shared/lib/features/login/signInSlice";
import roleSlice from "../shared/lib/features/roleSlice";
import profileEditSlice from "../shared/lib/features/profile/profileEditSlice";
import setCustomerData from "../shared/lib/features/customer_and_market-id";
import resetOrderItems from "../shared/lib/features/customer_and_market-id";
import setOrderItems from "../shared/lib/features/customer_and_market-id";
import setProductInfo from "../shared/lib/features/customer_and_market-id";
import togglePermission from "../shared/lib/features/add-order-permission";

export const store = configureStore({
  reducer: {
    authSlice,
    signInSlice,
    roleSlice,
    profileEditSlice,
    setCustomerData,
    setOrderItems,
    resetOrderItems,
    setProductInfo,
    togglePermission,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
