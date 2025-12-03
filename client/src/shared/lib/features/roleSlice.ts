import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface IState {
  id: string | null,
  role: string | null,
  region:string | null,
  name:string | null
}

const initialState: IState = {
  id: null,
  role: null,
  region:null,
  name: localStorage.getItem("name") || null
};

export const roleSlice = createSlice({
  name: "role",
  initialState,
  reducers: {
    setRole: (state, action: PayloadAction<string>) => {
      state.role = action.payload;
    },
    setName: (state, action: PayloadAction<string>) => {
      state.name = action.payload;
      localStorage.setItem("name", action.payload);
    },
    setRegion: (state, action: PayloadAction<string>) => {
      state.region = action.payload;
    },
    removeRole: (state) => {
      state.id = null;
      state.role = null;
    },
    setId: (state, action: PayloadAction<string>) => {
      state.id = action.payload;
    },
  },
});

export const { setRole, removeRole, setId, setRegion, setName} = roleSlice.actions;
export default roleSlice.reducer;
