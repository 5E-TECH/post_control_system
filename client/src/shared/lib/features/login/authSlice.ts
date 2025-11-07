import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface IState {
  token: string | null;
  user: any;
  default_tariff: string | null;
  marketData: any;
}

const initialState: IState = {
  token: localStorage.getItem("x-auth-token") || null,
  user: null,
  default_tariff: localStorage.getItem("default_tariff") || null,
  marketData: localStorage.getItem("marketData")
    ? JSON.parse(localStorage.getItem("marketData")!)
    : null,
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
      localStorage.removeItem("x-auth-token");
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
  },
});

export const { setToken, removeToken, setUser, setTarif, setUserData } =
  authSlice.actions;
export default authSlice.reducer;
