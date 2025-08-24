import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

interface IState{
    phone: string
    password: string
}

const initialState: IState = {
    password: "",
    phone: ""
}

export const signInSlice = createSlice({
    name: "sign-in",
    initialState,
    reducers: {
        setSignInData:(state, action: PayloadAction<IState>) => {
            state.phone = action.payload.phone
            state.password = action.payload.password
        },
        clearSignInData :(state) => {
            state.phone = ""
            state.password = ""
        }
    }
})

export const {clearSignInData,setSignInData} = signInSlice.actions
export default signInSlice.reducer