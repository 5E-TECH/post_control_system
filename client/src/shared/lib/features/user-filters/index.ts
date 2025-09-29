import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export interface IUserFilter {
  role: string | null;
  status: string | null;
  search: string | null;
  page: number | null;
  limit: number | null;
}

const initialState: IUserFilter = {
  role: null,
  status: null,
  search: null,
  page: null,
  limit: null,
};

const userFilterSlice = createSlice({
  name: "userFilter",
  initialState,
  reducers: {
    setUserFilter(
      state,
      action: PayloadAction<{
        name: keyof IUserFilter;
        value: string | number | null;
      }>
    ) {
      state[action.payload.name] = action.payload.value as any;
    },
    resetUserFilter() {
      return initialState;
    },
  },
});

export const { setUserFilter, resetUserFilter } = userFilterSlice.actions;
export default userFilterSlice.reducer;
