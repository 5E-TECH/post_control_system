import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface FilterState {
  marketId: string | null;
  regionId: string | null;
  status: string[] | null;
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
    setFilter(state, action: PayloadAction<{ name: string; value: any }>) {
      const { name, value } = action.payload;
      if (name === "status") {
        // Convert to array or null
        state.status = Array.isArray(value)
          ? value.length > 0
            ? value
            : null
          : value
          ? [value]
          : null;
      } else {
        (state as any)[name] = value;
      }
    },
    resetFilter() {
      return initialState;
    },
  },
});

export const { setFilter, resetFilter } = orderFilterSlice.actions;
export default orderFilterSlice.reducer;
