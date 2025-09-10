import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface ICustomerId {
  marketId?: string | null;
  customerId?: string | null;
}

const initialState: ICustomerId = {
  marketId: null,
  customerId: null,
};

export const customerIdSlice = createSlice({
  name: "customer-id",
  initialState,
  reducers: {
    setCustomerMarketId: (state, actions: PayloadAction<ICustomerId>) => {
      state.marketId = actions.payload.marketId;
      state.customerId = actions.payload.customerId;
    },
    resetCustomerMarketId: (state) => {
      state.marketId = null;
      state.customerId = null;
    },
  },
});

export const { setCustomerMarketId, resetCustomerMarketId } =
  customerIdSlice.actions;
export default customerIdSlice.reducer;
