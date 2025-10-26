import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface RegionNameState {
  regionName: string | null;
  hideSend: boolean | null;
}

// 🔒 Xavfsiz JSON parse funksiyasi
const safeParse = <T,>(value: string | null): T | null => {
  if (!value || value === "undefined" || value === "null") return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const regionName = safeParse<string>(localStorage.getItem("regionName"));
const hideSend = safeParse<boolean>(localStorage.getItem("hideSend"));

console.log(regionName);

const initialState: RegionNameState = {
  regionName,
  hideSend,
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
