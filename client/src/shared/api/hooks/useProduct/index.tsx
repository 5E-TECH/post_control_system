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

  const getProducts = (params?: any) =>
    useQuery({
      queryKey: [product, params],
      queryFn: () => api.get("product", { params }).then((res) => res.data),
      staleTime: 1000 * 60 * 60 * 24,
      refetchOnWindowFocus: false,
    });

  const getProductById = (id:string, enabled:boolean = true, params?: any) =>
    useQuery({
      queryKey: [product, params, id],
      queryFn: () => api.get(`product${id}`, { params }).then((res) => res.data),
      enabled,
      staleTime: 1000 * 60 * 60 * 24,
      refetchOnWindowFocus: false,
    });

  const getMyProducts = (params?: any) =>
    useQuery({
      queryKey: [product, params],
      queryFn: () =>
        api.get("product/my-products", { params }).then((res) => res.data),
      staleTime: 1000 * 60 * 60 * 24,
      refetchOnWindowFocus: false,
    });

  const getProductsByMarket = (
    marketId: string | undefined,
    enabled = true,
    params?: any
  ) =>
    useQuery({
      queryKey: [product, marketId, params],
      queryFn: () =>
        api
          .get(`product/market/${marketId}`, { params })
          .then((res) => res.data),
      enabled: !!marketId && enabled,
      staleTime: 1000 * 60 * 60 * 24,
      refetchOnWindowFocus: false,
    });

  const getProductsById = (id: string | undefined) =>
    useQuery({
      queryKey: [product, id],
      queryFn: () => api.get(`product/${id}`).then((res) => res.data),
      enabled: !!id,
      staleTime: 1000 * 60 * 60 * 24,
      refetchOnWindowFocus: false,
    });

  const deleteProduct = useMutation({
    mutationFn: (id: string | undefined) => api.delete(`product/${id}`),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [product] });
    },
  });

  const updateProduct = useMutation({
  mutationFn: ({ id, data, isMarket }: { id: string; data: any; isMarket?: boolean }) => {
    if (isMarket) {
      return api.patch(`/product/my/${id}`, data); // market uchun
    } else {
      return api.patch(`/product/${id}`, data); // admin/registrator uchun
    }
  },
  onSuccess: () => {
    client.invalidateQueries({ queryKey: ["product"] });
  },
});


  return {
    createProduct,
    getProducts,
    getProductsByMarket,
    getMyProducts,
    getProductsById,
    getProductById,
    deleteProduct,
    updateProduct
  };
};
