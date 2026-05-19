import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../..";

const LDG_CONFIG_KEY = "ldg-config";

export interface LdgConfigSafe {
  id: string;
  is_active: boolean;
  is_sandbox: boolean;
  api_base_url: string;
  tenant_domain: string | null;
  sender_name: string | null;
  sender_phone: string | null;
  sender_region_sato: number | null;
  sender_district_sato: number | null;
  sender_address: string | null;
  sender_branch_id: number | null;
  default_weight: number;
  default_length: number;
  default_width: number;
  default_height: number;
  default_seats: number;
  default_payer_type: string;
  enabled_district_sato_codes: number[];
  ldg_courier_user_id: string | null;
  // Sezgir maydonlar — qiymat o'rniga sozlanganlik flagi
  api_key_set: boolean;
  webhook_secret_set: boolean;
  webhook_secret_previous_set: boolean;
  created_at: number;
  updated_at: number;
}

export interface UpdateLdgConfigDto {
  is_active?: boolean;
  is_sandbox?: boolean;
  api_base_url?: string;
  api_key?: string;
  tenant_domain?: string;
  webhook_secret?: string;
  webhook_secret_previous?: string;
  sender_name?: string;
  sender_phone?: string;
  sender_region_sato?: number;
  sender_district_sato?: number;
  sender_address?: string;
  sender_branch_id?: number;
  default_weight?: number;
  default_length?: number;
  default_width?: number;
  default_height?: number;
  default_payer_type?: "receiver" | "sender" | "third_party";
  enabled_district_sato_codes?: number[];
  ldg_courier_user_id?: string;
}

export interface BindCourierDto {
  user_id: string;
}

export interface CreateLdgCourierDto {
  name: string;
  phone_number: string;
  tariff_home: number;
  tariff_center: number;
  region_id?: string;
}

export const useLdgConfig = () => {
  const client = useQueryClient();

  const getConfig = () =>
    useQuery<{ data: LdgConfigSafe } | LdgConfigSafe>({
      queryKey: [LDG_CONFIG_KEY],
      queryFn: () => api.get("ldg/config").then((res) => res.data),
    });

  const updateConfig = useMutation({
    mutationFn: (data: UpdateLdgConfigDto) =>
      api.patch("ldg/config", data).then((res) => res.data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [LDG_CONFIG_KEY] });
    },
  });

  /**
   * Mavjud kuryerni LDG vakili qilib biriktirish
   */
  const bindCourier = useMutation({
    mutationFn: (data: BindCourierDto) =>
      api.post("ldg/config/bind-courier", data).then((res) => res.data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [LDG_CONFIG_KEY] });
    },
  });

  /**
   * Yangi virtual LDG kuryer yaratish (form orqali to'liq ma'lumot bilan)
   */
  const createCourier = useMutation({
    mutationFn: (data: CreateLdgCourierDto) =>
      api.post("ldg/config/create-courier", data).then((res) => res.data),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: [LDG_CONFIG_KEY] });
    },
  });

  return { getConfig, updateConfig, bindCourier, createCourier };
};
