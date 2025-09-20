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

  const getMyProducts = () =>
    useQuery({
      queryKey: [product],
      queryFn: () => api.get("product/my-products").then((res) => res.data),
      staleTime: 1000 * 60 * 60 * 24,
      refetchOnWindowFocus: false,
    });

  const getProductsByMarket = (marketId: string | undefined) =>
    useQuery({
      queryKey: [product, marketId],
      queryFn: () =>
        api.get(`product/market/${marketId}`).then((res) => res.data),
      staleTime: 1000 * 60 * 60 * 24,
      refetchOnWindowFocus: false,
    });

  const deleteProduct = useMutation({
    mutationFn: (id: string | undefined) => api.delete(`product/${id}`),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [product] });
    },
  });

  return {
    createProduct,
    getProducts,
    getProductsByMarket,
    deleteProduct,
    getMyProducts
  };
};
