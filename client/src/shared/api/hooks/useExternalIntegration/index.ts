import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../..";

const INTEGRATION_KEY = "external-integration";

// Types
export interface FieldMapping {
  id_field: string;
  qr_code_field: string;
  customer_name_field: string;
  phone_field: string;
  extra_phone_field: string;
  region_code_field: string;
  district_code_field: string;
  address_field: string;
  comment_field: string;
  total_price_field: string;
  delivery_price_field: string;
  total_count_field: string;
  items_field: string;
  created_at_field: string;
}

export type AuthType = 'api_key' | 'login';

// Status mapping - bizning statuslarni tashqi tizim statuslariga moslashtirish
export interface StatusMapping {
  sold: string;
  canceled: string;
  paid: string;
  rollback: string;
  waiting: string;
}

// Status sync configuration
export interface StatusSyncConfig {
  enabled: boolean;
  endpoint: string;
  method: 'PUT' | 'PATCH' | 'POST';
  status_field: string;
  use_auth: boolean;
  include_order_id_in_body: boolean;
  order_id_field: string;
}

export interface ExternalIntegration {
  id: string;
  name: string;
  slug: string;
  api_url: string;
  api_key?: string;
  api_secret?: string;
  auth_type: AuthType;
  auth_url?: string;
  username?: string;
  password?: string;
  market_id: string;
  is_active: boolean;
  field_mapping: FieldMapping;
  status_mapping: StatusMapping;
  status_sync_config: StatusSyncConfig;
  last_sync_at: number | null;
  total_synced_orders: number;
  created_at: number;
  updated_at: number;
  market?: {
    id: string;
    name: string;
  };
}

export interface CreateIntegrationDto {
  name: string;
  slug: string;
  api_url: string;
  api_key?: string;
  api_secret?: string;
  auth_type?: AuthType;
  auth_url?: string;
  username?: string;
  password?: string;
  market_id: string;
  is_active?: boolean;
  field_mapping?: Partial<FieldMapping>;
  status_mapping?: Partial<StatusMapping>;
  status_sync_config?: Partial<StatusSyncConfig>;
}

export interface UpdateIntegrationDto {
  name?: string;
  slug?: string;
  api_url?: string;
  api_key?: string;
  api_secret?: string;
  auth_type?: AuthType;
  auth_url?: string;
  username?: string;
  password?: string;
  market_id?: string;
  is_active?: boolean;
  field_mapping?: Partial<FieldMapping>;
  status_mapping?: Partial<StatusMapping>;
  status_sync_config?: Partial<StatusSyncConfig>;
}

export const useExternalIntegration = () => {
  const client = useQueryClient();

  // Barcha integratsiyalarni olish
  const getIntegrations = (enabled: boolean = true) =>
    useQuery({
      queryKey: [INTEGRATION_KEY],
      queryFn: () =>
        api.get("external-integration").then((res) => res.data),
      enabled,
      staleTime: 1000 * 60 * 5, // 5 minut
      refetchOnWindowFocus: false,
    });

  // Faqat faol integratsiyalarni olish
  const getActiveIntegrations = (enabled: boolean = true) =>
    useQuery({
      queryKey: [INTEGRATION_KEY, "active"],
      queryFn: () =>
        api.get("external-integration/active").then((res) => res.data),
      enabled,
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
    });

  // ID bo'yicha olish
  const getIntegrationById = (id: string, enabled: boolean = true) =>
    useQuery({
      queryKey: [INTEGRATION_KEY, id],
      queryFn: () =>
        api.get(`external-integration/${id}`).then((res) => res.data),
      enabled: enabled && !!id,
      staleTime: 1000 * 60 * 5,
    });

  // Slug bo'yicha olish
  const getIntegrationBySlug = (slug: string, enabled: boolean = true) =>
    useQuery({
      queryKey: [INTEGRATION_KEY, "slug", slug],
      queryFn: () =>
        api.get(`external-integration/slug/${slug}`).then((res) => res.data),
      enabled: enabled && !!slug,
      staleTime: 1000 * 60 * 5,
    });

  // Yangi integratsiya yaratish
  const createIntegration = useMutation({
    mutationFn: (data: CreateIntegrationDto) =>
      api.post("external-integration", data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [INTEGRATION_KEY] });
    },
  });

  // Integratsiyani yangilash
  const updateIntegration = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateIntegrationDto }) =>
      api.patch(`external-integration/${id}`, data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [INTEGRATION_KEY] });
    },
  });

  // Integratsiyani o'chirish
  const deleteIntegration = useMutation({
    mutationFn: (id: string) => api.delete(`external-integration/${id}`),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [INTEGRATION_KEY] });
    },
  });

  // Ulanishni tekshirish
  const testConnection = useMutation({
    mutationFn: (id: string) =>
      api.post(`external-integration/${id}/test`).then((res) => res.data),
  });

  // Sinxronlangan buyurtmalar sonini 0 ga tushirish
  const resetSyncedOrders = useMutation({
    mutationFn: (id: string) =>
      api.post(`external-integration/${id}/reset-synced`).then((res) => res.data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [INTEGRATION_KEY] });
    },
  });

  return {
    getIntegrations,
    getActiveIntegrations,
    getIntegrationById,
    getIntegrationBySlug,
    createIntegration,
    updateIntegration,
    deleteIntegration,
    testConnection,
    resetSyncedOrders,
  };
};
