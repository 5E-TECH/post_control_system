import axios from "axios";
import { BASE_URL } from "../const";

export const api = axios.create({
    baseURL: BASE_URL
})


api.interceptors.request.use((config) =>{
    const token = "eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiJlM2U0Y2M0YzA2YzcwN2I0ODcyMWVlY2ZjMjE5MGVmYyIsIm5iZiI6MTcyODg3NzQyNi4yLCJzdWIiOiI2NzBjOTM3MmIxNWQ5N2IxYTkzY2UwZjIiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.zZR_akio6SBvGWR4ThRbmrrWDuHZukkom4xo091rw8U"
    if(token){
        config.headers.Authorization = `Bearer ${token}`
    }
    return config
})