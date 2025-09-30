import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface EditProductState {
  item: any | null;
}

// localStorage’dan o‘qib olish
const savedItem = localStorage.getItem("editItem");

const initialState: EditProductState = {
  item: savedItem ? JSON.parse(savedItem) : null,
};

const productEditSlice = createSlice({
  name: "productEdit",
  initialState,
  reducers: {
    setEditItem: (state, action: PayloadAction<any>) => {
      state.item = action.payload;
      localStorage.setItem("editItem", JSON.stringify(action.payload)); // localStorage’ga yozish
    },
    clearEditItem: (state) => {
      state.item = null;
      localStorage.removeItem("editItem"); // localStorage’dan o‘chirish
    },
  },
});

export const { setEditItem, clearEditItem } = productEditSlice.actions;
export default productEditSlice.reducer;
