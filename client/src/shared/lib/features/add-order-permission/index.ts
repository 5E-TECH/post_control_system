import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface IAddOrderPermission {
  value: boolean;
}

const initialState: IAddOrderPermission = {
  value: false,
};

export const OrderPermission = createSlice({
  name: "order-permission",
  initialState,
  reducers: {
    togglePermission: (state, actions: PayloadAction<boolean>) => {
      state.value = actions.payload;
    },
  },
});

export const { togglePermission } = OrderPermission.actions;
export default OrderPermission.reducer;
