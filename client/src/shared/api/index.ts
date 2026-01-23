import axios from "axios";
import { BASE_URL } from "../const";

export const api = axios.create({
    baseURL: BASE_URL,
    paramsSerializer: {
        indexes: null  // Creates ?status=paid&status=sold instead of status[0]=paid
    }
})


api.interceptors.request.use((config) =>{
    const token = localStorage.getItem("x-auth-token")
    
    if(token){
        config.headers.Authorization = `Bearer ${token}`
    }
    return config
})

api.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error.response?.status;

        if (status === 401) {
            localStorage.removeItem("x-auth-token");
            window.location.href = "/login";
        }
        //  else if (status === 403) {
        //     window.location.href = "/403";
        // } else if (status === 404) {
        //     window.location.href = "/404";
        // } else if (status === 500) {
        //     window.location.href = "/500";
        // }

        return Promise.reject(error);
    }
);