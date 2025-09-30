import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface FilterState {
  marketId: string | null;
  regionId: string | null;
  status: string | null;
  startDate: string;
  endDate: string;
  search: string;
}

const initialState: FilterState = {
  marketId: null,
  regionId: null,
  status: null,
  startDate: "",
  endDate: "",
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
