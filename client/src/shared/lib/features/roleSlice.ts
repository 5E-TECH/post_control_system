import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface IState {
  role: string | null
}

const initialState: IState = {
  role: null
};

export const roleSlice = createSlice({
  name: "role",
  initialState,
  reducers: {
    setRole: (state, action: PayloadAction<string>) => {
      state.role = action.payload;
    },
    removeRole: (state) => {
      state.role = null;
    },
  },
});

export const { setRole, removeRole} = roleSlice.actions;
export default roleSlice.reducer;
