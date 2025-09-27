import { createSlice } from "@reduxjs/toolkit";

const userFilterSlice = createSlice({
  name: "userFilter",
  initialState: {
    triggerDownload: false,
  },
  reducers: {
    requestDownload(state) {
      state.triggerDownload = true;
    },
    resetDownload(state) {
      state.triggerDownload = false;
    },
  },
});

export const { requestDownload, resetDownload } = userFilterSlice.actions;
export default userFilterSlice.reducer;
