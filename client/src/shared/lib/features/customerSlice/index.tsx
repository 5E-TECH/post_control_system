// store/slices/customersSlice.ts
import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

interface Customer {
  phone_number: string;
  name: string;
}

interface CustomersState {
  list: Customer[];
}

const initialState: CustomersState = {
  list: [],
};

const customersSlice = createSlice({
  name: "customers",
  initialState,
  reducers: {
    setCustomers: (state, action: PayloadAction<Customer[]>) => {
      state.list = action.payload;
    },
  },
});

export const { setCustomers } = customersSlice.actions;
export default customersSlice.reducer;
