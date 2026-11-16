import type { ReactNode } from "react";
import { Card, Tag, type CardProps } from "antd";
import { CheckCircle2, Info, XCircle } from "lucide-react";
import type { CarrierAccount } from "../../../../shared/api/hooks/useCarrierAccounts";
import { accountState, isCourierBlocked } from "./carrierLib";

/**
 * Carrier panelining kichik bo'laklari — bir nechta tabda takrorlanadi.
 */

/**
 * antd `Card`, sarlavhasi tor ekranda qatorlanadigan: telefon kengligida
 * sarlavha qisqartirilib («Bog'langan ku…») qolmaydi — `extra` (tugma)
 * keyingi qatorga tushadi. Kenglikda ko'rinish oddiy Card bilan bir xil.
 */
const CARD_HEAD_WRAP =
  "[&_.ant-card-head]:!py-2 [&_.ant-card-head-wrapper]:flex-wrap [&_.ant-card-head-wrapper]:gap-x-4 [&_.ant-card-head-wrapper]:gap-y-2 [&_.ant-card-head-title]:!flex-[1_1_auto] [&_.ant-card-head-title]:!whitespace-normal [&_.ant-card-extra]:!ms-auto";

export const CarrierCard = ({ className, ...props }: CardProps) => (
  <Card {...props} className={className ? `${CARD_HEAD_WRAP} ${className}` : CARD_HEAD_WRAP} />
);

/** Inline kod: yo'l, sarlavha, niqoblangan kalit. */
export const Code = ({ children }: { children: ReactNode }) => (
  <code className="whitespace-nowrap rounded bg-black/[.04] px-1.5 py-px font-mono text-xs text-gray-800 dark:bg-white/[.08] dark:text-gray-100">
    {children}
  </code>
);

/** Karta sarlavhasi: ikonka + matn (+ ixtiyoriy Tag) — boshqa tablar naqshi. */
export const CardTitle = ({
  icon,
  children,
  extra,
}: {
  icon: ReactNode;
  children: ReactNode;
  extra?: ReactNode;
}) => (
  <span className="flex flex-wrap items-center gap-2">
    {icon}
    <span>{children}</span>
    {extra}
  </span>
);

/** Raqamlangan qadamlar (ulanish tartibi, dasturchiga yuboriladiganlar). */
export const StepList = ({ items }: { items: ReactNode[] }) => (
  <ol className="flex flex-col gap-3">
    {items.map((item, i) => (
      <li
        key={i}
        className="flex gap-3 text-sm leading-[22px] text-gray-800 dark:text-gray-100"
      >
        <span
          aria-hidden="true"
          className="mt-[-1px] flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-violet-50 text-xs font-bold text-violet-700 dark:bg-violet-900/25 dark:text-violet-300"
        >
          {i + 1}
        </span>
        <span>{item}</span>
      </li>
    ))}
  </ol>
);

/** Tasdiq oynalaridagi ro'yxat. */
export const Bullets = ({ items }: { items: ReactNode[] }) => (
  <ul className="list-disc space-y-1 pl-5">
    {items.map((item, i) => (
      <li key={i}>{item}</li>
    ))}
  </ul>
);

/** Kichik izoh: ikonka + matn (`text-xs text-gray-500`). */
export const Note = ({ children }: { children: ReactNode }) => (
  <p className="flex items-start gap-1.5 text-xs text-gray-500 dark:text-gray-400">
    <Info className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
    <span>{children}</span>
  </p>
);

/** Ro'yxat va sozlamalardagi holat belgisi. */
export const StatusTag = ({ account }: { account: CarrierAccount }) => {
  const state = accountState(account);
  if (state === "stopped") return <Tag>To'xtatilgan</Tag>;
  if (state === "courier_blocked") return <Tag color="orange">Kuryer bloklangan</Tag>;
  return <Tag color="green">Faol</Tag>;
};

/** Tayyorlik qatori — Marketplace checklisti naqshi. */
export const CheckRow = ({ ok, label }: { ok: boolean; label: ReactNode }) => (
  <div className="flex items-center gap-2 text-sm">
    {ok ? (
      <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" aria-hidden="true" />
    ) : (
      <XCircle className="h-4 w-4 shrink-0 text-red-500" aria-hidden="true" />
    )}
    <span className={ok ? "text-gray-500 dark:text-gray-400" : "font-medium"}>
      {label}
    </span>
  </div>
);

/**
 * Bog'langan kuryer: `Tag purple` + qalin ism + kulrang telefon — Elchi
 * sozlamalaridagi vakil-kuryer qatori naqshi.
 */
export const CourierRow = ({ account }: { account: CarrierAccount }) =>
  account.courier ? (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <Tag color="purple" className="!me-0">
        CARRIER API
      </Tag>
      <span className="font-semibold">{account.courier.name}</span>
      <span className="text-gray-500 dark:text-gray-400">
        {account.courier.phone_number || "telefon yo'q"}
      </span>
      {isCourierBlocked(account) && (
        <Tag color="red" className="!me-0">
          bloklangan
        </Tag>
      )}
    </div>
  ) : (
    <span className="text-gray-500 dark:text-gray-400">
      Kuryer ma'lumoti topilmadi
    </span>
  );
