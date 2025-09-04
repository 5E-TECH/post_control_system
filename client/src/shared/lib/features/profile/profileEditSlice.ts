import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

interface IUserProfile {
  phone_number: string;
}

interface IEditSlice {
  value: IUserProfile | null;
}

const initialState: IEditSlice = {
  value: {
    phone_number: '',
  },
};

export const profileEditSlice = createSlice({
  name: 'edit',
  initialState,
  reducers: {
    setEditing: (state, actions: PayloadAction<IUserProfile | null>) => {
      state.value = actions.payload;
    },
  },
});

export const { setEditing } = profileEditSlice.actions;
export default profileEditSlice.reducer;
