import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { ICustomer } from "../../../../pages/orders/components/customer-info";

interface ICustomerId {
  customerData?: ICustomer | null;
  marketId?: string | null;
  customerId?: string | null;
}

const initialState: ICustomerId = {
  marketId: null,
  customerId: null,
  customerData: {
    name: "",
    address: "",
    phone_number: "",
    district_id:""
  },
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
    setCustomerData: (state, actions: PayloadAction<ICustomer | null>) => {
      state.customerData = actions.payload;
    },
  },
});

export const { setCustomerMarketId, resetCustomerMarketId, setCustomerData } =
  customerIdSlice.actions;
export default customerIdSlice.reducer;
