import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface IDateFilter {
  from: string;
  to: string;
}

const initialState: IDateFilter = {
  from: "",
  to: "",
};

const dateFilterSlice = createSlice({
  name: "dateFilter",
  initialState,
  reducers: {
    setDateRange: (state, action: PayloadAction<{ from: string; to: string }>) => {
      state.from = action.payload.from;
      state.to = action.payload.to;
    },
    clearDateRange: (state) => {
      state.from = "";
      state.to = "";
    },
  },
});

export const { setDateRange, clearDateRange } = dateFilterSlice.actions;
export default dateFilterSlice.reducer;
