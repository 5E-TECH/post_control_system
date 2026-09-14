import type { ReactNode } from "react";
import { Truck, Send } from "lucide-react";
import { LdgCargoTab } from "../LdgCargoTab";
import { ElchiCargoTab } from "../elchi/ElchiCargoTab";

export interface DeliveryProvider {
  /** `users.external_provider` dagi qiymat bilan BIR XIL bo'lishi shart. */
  slug: string;
  label: string;
  icon: ReactNode;
  /** Tanlash tugmasi ostidagi bir qatorli tavsif. */
  desc: string;
  panel: ReactNode;
}

/**
 * Yetkazuvchilar registri.
 *
 * NEGA REGISTR. LDG paneli LDG'ga qattiq yozilgan edi; Elchi uchun ikkinchi
 * nusxa yasalsa, uchinchi cargo kelganda uchinchi nusxa kerak bo'lardi.
 * Bu yerda **kabina umumiy**, provayderning o'zi esa alohida modul:
 * yangi yetkazuvchi = shu massivga bitta yozuv.
 *
 * ⚠️ HALOL CHEGARA. Registr UI'ni birlashtiradi, backendni EMAS. PCS'da
 * dispatch hali config-driven emas — ya'ni yangi cargo baribir server tomonda
 * kod talab qiladi. Uzoq muddatli yechim: yangi cargolar Elchi'ga ulanadi
 * (`docs/integrations/06-platforma.md` qarori), chunki Elchi'da
 * `dispatch_config` allaqachon bor.
 */
export const DELIVERY_PROVIDERS: DeliveryProvider[] = [
  {
    slug: "ldg",
    label: "LDG Cargo",
    icon: <Truck className="w-4 h-4" />,
    desc: "Ishlab turgan yetkazuvchi",
    panel: <LdgCargoTab />,
  },
  {
    slug: "elchi",
    label: "Elchi Pochta",
    icon: <Send className="w-4 h-4" />,
    desc: "Pilot — hudud bo'yicha darvoza",
    panel: <ElchiCargoTab />,
  },
];
