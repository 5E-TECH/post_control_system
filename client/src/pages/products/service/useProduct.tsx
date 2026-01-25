import {useQuery, useMutation, useQueryClient} from "@tanstack/react-query"
import axios from "axios"

const api = axios.create({
    baseURL: import.meta.env.VITE_BASE_URL || "/api/v1/"
})

export const product = "product"

export const useProduct = () => {
    const client = useQueryClient()

    const getProduct = () => useQuery({
        queryKey: [product],
        queryFn: () => api.get("product").then(res => res.data),
    }) 

    const createProduct = useMutation({
        mutationFn: (data: any) => api.post("student", data),
        onSuccess: ()=>{
            client.invalidateQueries({queryKey: [product]})
        }
    })

    const deleteProduct = useMutation({
        mutationFn: (id: number) => api.delete(`product/${id}`),
        onSuccess: ()=>{
            client.invalidateQueries({queryKey: [product]})
        }
    })

    const updateProduct = useMutation({
        mutationFn: ({id, data}:{id:any | undefined, data:any})=> api.put(`product/${id}`, data),
        onSuccess: () => {
            client.invalidateQueries({queryKey: [product]})
        }
    })

    return {getProduct, createProduct, deleteProduct, updateProduct}
}