import { CARRIER_PROVIDER } from "../../api/hooks/useCarrierAccounts";

/**
 * «CARRIER API» belgisi — kuryer tashqi yetkazuvchi kompaniyaning API
 * kuryeri (`users.external_provider === 'carrier'`). Xodimlar ro'yxatlarida
 * ELCHI belgisi naqshida (to'ldirilgan pill, indigo-600).
 * Boshqa kuryerda hech narsa ko'rsatmaydi.
 */
const CarrierApiChip = ({ provider }: { provider?: string | null }) =>
  provider === CARRIER_PROVIDER ? (
    <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-600 text-white shrink-0">
      CARRIER API
    </span>
  ) : null;

export default CarrierApiChip;
