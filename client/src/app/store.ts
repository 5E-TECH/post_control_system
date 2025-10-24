import { configureStore } from "@reduxjs/toolkit";
import authSlice from "../shared/lib/features/login/authSlice";
import signInSlice from "../shared/lib/features/login/signInSlice";
import roleSlice from "../shared/lib/features/roleSlice";
import profileEditSlice from "../shared/lib/features/profile/profileEditSlice";
import setCustomerData from "../shared/lib/features/customer_and_market-id";
import resetOrderItems from "../shared/lib/features/customer_and_market-id";
import setOrderItems from "../shared/lib/features/customer_and_market-id";
import setProductInfo from "../shared/lib/features/customer_and_market-id";
import togglePermission from "../shared/lib/features/add-order-permission";
import resetFilter from "../shared/lib/features/order-filters";
import setFilter from "../shared/lib/features/order-filters";
import setUserFilter from "../shared/lib/features/user-filters";
import resetUserFilter from "../shared/lib/features/user-filters";
import requestDownload from "../shared/lib/features/excel-download-func/excelDownloadFunc";
import resetDownload from "../shared/lib/features/excel-download-func/excelDownloadFunc";
import setPage from "../shared/lib/features/paginationProductSlice";
import setLimit from "../shared/lib/features/paginationProductSlice";
import paginationSlice from "../shared/lib/features/paginationProductSlice";
import clearEditItem from "../shared/lib/features/updateSlice";
import setEditItem from "../shared/lib/features/updateSlice";
import regionSlice from "../shared/lib/features/regionSlice";

export const store = configureStore({
  reducer: {
    authSlice,
    signInSlice,
    roleSlice,
    profileEditSlice,
    setCustomerData,
    setOrderItems,
    resetOrderItems,
    setProductInfo,
    togglePermission,
    setFilter,
    resetFilter,
    setUserFilter,
    resetUserFilter,
    requestDownload,
    resetDownload,
    setPage,
    setLimit,
    paginationSlice,
    setEditItem,
    clearEditItem,
    region: regionSlice,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
