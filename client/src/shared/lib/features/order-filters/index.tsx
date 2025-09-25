import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface FilterState {
  marketId: string;
  regionId: string;
  status: string;
  from: string;
  to: string;
  search: string;
}

const initialState: FilterState = {
  marketId: "",
  regionId: "",
  status: "",
  from: "",
  to: "",
  search: "",
};

const orderFilterSlice = createSlice({
  name: "orderFilter",
  initialState,
  reducers: {
    setFilter(state, action: PayloadAction<{ name: string; value: string }>) {
      const { name, value } = action.payload;
      (state as any)[name] = value;
    },
    resetFilter() {
      return initialState;
    },
  },
});

export const { setFilter, resetFilter } = orderFilterSlice.actions;
export default orderFilterSlice.reducer;
