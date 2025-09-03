import { configureStore } from "@reduxjs/toolkit";
import authSlice from "../shared/lib/features/login/authSlice";
import signInSlice  from "../shared/lib/features/login/signInSlice";
import roleSlice from "../shared/lib/features/roleSlice";

export const store = configureStore({
  reducer: {
    authSlice,
    signInSlice,
    roleSlice
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
