import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../";

export const product = "product";

export const useProduct = () => {
  const client = useQueryClient();

  const createProduct = useMutation({
    mutationFn: (data: FormData) =>
      api.post("product", data, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: [product] }),
  });

  const getProducts = () =>
    useQuery({
      queryKey: [product],
      queryFn: () => api.get("product").then((res) => res.data),
      staleTime: 1000 * 60 * 60 * 24,
      refetchOnWindowFocus: false,
    });

  const getProductsByMarket = (id:string) =>
    useQuery({
      queryKey: [product, id],
      queryFn: () => api.get(`product/market/${id}`).then((res) => res.data),
      staleTime: 1000 * 60 * 60 * 24,
      refetchOnWindowFocus: false,
    });

  return {
    createProduct,
    getProducts,
    getProductsByMarket
  };
};
