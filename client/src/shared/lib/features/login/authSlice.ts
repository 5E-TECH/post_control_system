import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface IState {
  token: string | null;
  user: any;
  default_tariff: string | null;
  marketData: any;
  isTelegramSession: boolean;
}

const initialState: IState = {
  token: localStorage.getItem("x-auth-token") || null,
  user: null,
  default_tariff: localStorage.getItem("default_tariff") || null,
  marketData: localStorage.getItem("marketData")
    ? JSON.parse(localStorage.getItem("marketData")!)
    : null,
  isTelegramSession: localStorage.getItem("is-telegram-session") === "true",
};

export const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setToken: (state, action: PayloadAction<any | null>) => {
      state.token = action.payload?.access_token;

      if (action.payload) {
        localStorage.setItem("x-auth-token", action.payload?.access_token);
      } else {
        localStorage.removeItem("x-auth-token");
      }
    },
    removeToken: (state) => {
      state.token = null;
      state.isTelegramSession = false;
      localStorage.removeItem("x-auth-token");
      localStorage.removeItem("refresh_token_expires_at");
      localStorage.removeItem("is-telegram-session");
    },
    setUser: (state, action: PayloadAction<any>) => {
      state.user = action.payload;
    },
    setTarif: (state, action: PayloadAction<any>) => {
      localStorage.setItem("default_tariff", action.payload);
      state.default_tariff = action.payload;
    },
    setUserData: (state, action: PayloadAction<any>) => {
      localStorage.setItem("marketData", JSON.stringify(action.payload));
      state.marketData = action.payload;
    },
    setTelegramSession: (state, action: PayloadAction<boolean>) => {
      state.isTelegramSession = action.payload;
      if (action.payload) {
        localStorage.setItem("is-telegram-session", "true");
      } else {
        localStorage.removeItem("is-telegram-session");
      }
    },
  },
});

export const {
  setToken,
  removeToken,
  setUser,
  setTarif,
  setUserData,
  setTelegramSession,
} = authSlice.actions;
export default authSlice.reducer;
