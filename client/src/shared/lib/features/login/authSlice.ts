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
    setToken: (state, action: PayloadAction<string>) => {
      state.token = action.payload;
      localStorage.setItem("x-auth-token", state.token);
    },
    removeToken: (state) => {
      state.token = null;
      localStorage.removeItem("x-auth-token");
    },
    setUser: (state, action: PayloadAction<string>) => {
      state.user = action.payload;
    }
  },
});

export const { setToken, removeToken , setUser} = authSlice.actions;
export default authSlice.reducer;
