import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from ".."
import type { IData } from "../../types"

export const user = 'user'

export const useUser = () => {
    const client = useQueryClient()

    const Login = useMutation({
        mutationFn: (data: IData) => api.post('/user/signin', data),
        onSuccess: () => {
            client.invalidateQueries({ queryKey: [user] })
        }
    })

    const getProfile = () => {
        const token = localStorage.getItem('token')

        return useQuery({
            queryKey: [user],
            queryFn: () => api.get(`/user/profile`, { headers: { Authorization: `Bearer ${token}` } }).then(res => res.data),
            enabled: !!token
        })
    }

    return { Login, getProfile }
}