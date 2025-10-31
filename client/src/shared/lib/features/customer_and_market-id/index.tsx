import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { ICustomer } from "../../../../pages/orders/components/customer-info";
import type { IOrderItems } from "../../../../pages/orders/components/order-items";
import type { IProductInfo } from "../../../../pages/orders/components/product-info";

interface ICustomerId {
  customerData?: ICustomer | null;
  orderItems?: IOrderItems[] | null;
  productInfo?: IProductInfo | null;
}

const initialState: ICustomerId = {
  customerData: {
    name: "",
    address: "",
    phone_number: "+998 ",
    district_id: null,
    extra_number:""
  },
  orderItems: null,
  productInfo: {
    total_price: "",
    where_deliver: "",
    comment: "",
  },
};

export const customerIdSlice = createSlice({
  name: "customer-id",
  initialState,
  reducers: {
    setCustomerData: (state, actions: PayloadAction<ICustomer | null>) => {
      state.customerData = actions.payload;
    },
    setOrderItems: (state, actions: PayloadAction<IOrderItems[]>) => {
      state.orderItems = actions.payload;
    },
    resetOrderItems: (state) => {
      state.orderItems = null;
    },
    setProductInfo: (state, actions: PayloadAction<IProductInfo | null>) => {
      state.productInfo = actions.payload;
    },
  },
});

export const {
  setCustomerData,
  setOrderItems,
  setProductInfo,
  resetOrderItems,
} = customerIdSlice.actions;
export default customerIdSlice.reducer;
