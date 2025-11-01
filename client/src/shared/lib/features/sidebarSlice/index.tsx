// src/store/sidebarSlice.js
import { createSlice } from "@reduxjs/toolkit";

// localStorage'dan holatni o'qib olish
const storedSidebar = localStorage.getItem("sidebarIsOpen");

const initialState = {
  isOpen: storedSidebar ? JSON.parse(storedSidebar) : false,
};

const sidebarSlice = createSlice({
  name: "sidebar",
  initialState,
  reducers: {
    openSidebar(state) {
      state.isOpen = true;
      localStorage.setItem("sidebarIsOpen", JSON.stringify(true));
    },
    closeSidebar(state) {
      state.isOpen = false;
      localStorage.setItem("sidebarIsOpen", JSON.stringify(false));
    },
    toggleSidebar(state) {
      state.isOpen = !state.isOpen;
      localStorage.setItem("sidebarIsOpen", JSON.stringify(state.isOpen));
    },
    setSidebar(state, action) {
      const value = !!action.payload;
      state.isOpen = value;
      localStorage.setItem("sidebarIsOpen", JSON.stringify(value));
    },
  },
});

export const { openSidebar, closeSidebar, toggleSidebar, setSidebar } =
  sidebarSlice.actions;
export default sidebarSlice.reducer;
