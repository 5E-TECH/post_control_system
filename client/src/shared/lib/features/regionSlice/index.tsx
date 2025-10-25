import { createSlice, type PayloadAction } from "@reduxjs/toolkit";


interface RegionNameState {
  regionName: string | null;
  hideSend: boolean | null;
}

const regionName = localStorage.getItem("regionName");
const hideSend = localStorage.getItem("hideSend");


const initialState: RegionNameState = {
  regionName: regionName ? JSON.parse(regionName) :  null,
  hideSend: hideSend ? JSON.parse(hideSend) : null,
};

const regionSlice = createSlice({
  name: "region",
  initialState,
  reducers: {
    setRegionName: (state, action: PayloadAction<any>) => {
      state.regionName = action.payload;
      localStorage.setItem("regionName", JSON.stringify(action.payload));
    },
    setHideSend: (state, action: PayloadAction<any>) => {
      state.hideSend = action.payload;
      localStorage.setItem("hideSend", JSON.stringify(action.payload));
    },
    clearRegionData: (state) => {
      state.regionName = "";
      state.hideSend = false;
      localStorage.removeItem("regionName");
      localStorage.removeItem("hideSend");
    },
  },
});

export const { setRegionName, setHideSend, clearRegionData } =
  regionSlice.actions;
export default regionSlice.reducer;
