import { configureStore } from "@reduxjs/toolkit";
import signInSlice from "./features/login/signInSlice";
import authSlice from "./features/login/authSlice";

export const store = configureStore({
  reducer: {
    signInSlice,
    authSlice,
  },
});

export default store;

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
