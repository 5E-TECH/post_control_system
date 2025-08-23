import { useQuery } from "@tanstack/react-query"
import { api } from "../../../shared/api"

export const movieDetailKey = "movieDetailKey"

export const useMovieDetail = ()=>{
    const getMovieById = (id: string) => useQuery({
        queryKey: [movieDetailKey, id],
        queryFn: () => api.get(`movie/${id}`,).then(res => res.data)
    })

    const getMovieItems = (id: string, path:string) => useQuery({
        queryKey: [movieDetailKey, id, path],
        queryFn: () => api.get(`movie/${id}/${path}`).then(res => res.data)
    })
    return { getMovieById, getMovieItems }
}