import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface IState {
  token: string | null;
  user: any;
}

const initialState: IState = {
  token: localStorage.getItem("x-auth-token") || null,
  user: null,
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
  },
});

export const { setToken, removeToken, setUser } = authSlice.actions;
export default authSlice.reducer;
