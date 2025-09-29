import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface PaginationState {
  page: number;
  limit: number;
}

const initialState: PaginationState = {
  page: Number(localStorage.getItem("page")) || 1,
  limit: Number(localStorage.getItem("limit")) || 10,
};

const paginationSlice = createSlice({
  name: "pagination",
  initialState,
  reducers: {
    setPage: (state, action: PayloadAction<number>) => {
      localStorage.setItem("page", String(action.payload));
      state.page = action.payload;
    },
    setLimit: (state, action: PayloadAction<number>) => {
      localStorage.setItem("limit", String(action.payload));
      state.limit = action.payload;
    },
  },
});

export const { setPage, setLimit } = paginationSlice.actions;
export default paginationSlice.reducer;
