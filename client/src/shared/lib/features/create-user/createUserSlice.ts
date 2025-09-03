import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { FieldType } from "../../../../pages/users/components/create-user-form";

interface ICreateUser {
  value: FieldType | null;
}

const initialState: ICreateUser = {
  value: {
    first_name: "",
    last_name: "",
    password: "",
    phone_number: "",
    salary: "",
    payment_day: "",
  },
};

export const createUserSlice = createSlice({
  name: "create-user",
  initialState,
  reducers: {
    createUser: (state, actions: PayloadAction<FieldType | null>) => {
      state.value = actions.payload;
    },
  },
});

export const { createUser } = createUserSlice.actions;
export default createUserSlice.reducer;
