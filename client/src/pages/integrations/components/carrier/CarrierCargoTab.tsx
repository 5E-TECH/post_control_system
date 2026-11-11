import { useMemo, useRef, useState, type ReactNode } from "react";
import { Alert, App, Button, Empty, Segmented, Spin } from "antd";
import {
  Activity,
  KeyRound,
  List,
  Plus,
  Settings as SettingsIcon,
} from "lucide-react";
import ProviderSubNav, { type SubNavItem } from "../providers/ProviderSubNav";
import {
  useCarrierAccountList,
  type CarrierAccount,
  type CarrierKeyResult,
} from "../../../../shared/api/hooks/useCarrierAccounts";
import { MESSAGE_CONFIG } from "../../../../shared/const";
import { CarrierAccountsTab } from "./CarrierAccountsTab";
import { CarrierSettingsTab } from "./CarrierSettingsTab";
import { CarrierKeyTab } from "./CarrierKeyTab";
import { CarrierActivityTab } from "./CarrierActivityTab";
import { CarrierCreateModal } from "./CarrierCreateModal";
import { CarrierEditModal } from "./CarrierEditModal";
import { CarrierKeyOnceModal } from "./CarrierKeyOnceModal";
import { useCarrierActions } from "./useCarrierActions";
import { CarrierCard } from "./CarrierParts";
import { errText } from "./carrierLib";

type Section = "accounts" | "settings" | "key" | "activity";

const CarrierPanel = () => {
  const list = useCarrierAccountList();
  const accounts = useMemo(() => list.data ?? [], [list.data]);

  const [active, setActive] = useState<Section>("accounts");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  /** Tahrirlash: `editing` oyna yopilish animatsiyasi tugaguncha saqlanadi. */
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<CarrierAccount | null>(null);
  /**
   * ⚠️ OCHIQ KALIT — faqat shu holatda (xotirada) yashaydi. Oyna yopilganda
   * `null` qilinadi; react-query keshiga ham, localStorage'ga ham tushmaydi.
   */
  const [issued, setIssued] = useState<CarrierKeyResult | null>(null);

  /**
   * Kalit oynasi yopilgach fokus qaytadigan joy — amal boshlangan tugma
   * («Kalitni yangilash», «Yangi akkaunt»). rc-dialog'ning o'zi eslab
   * qoladigan element bu yerda yaroqsiz (`CarrierKeyOnceModal.afterClose`):
   * fokus <body> ga tushib, klaviatura va ekran o'quvchi foydalanuvchisi
   * sahifa boshiga otilardi. jsdom'da animatsiya yo'q — buni faqat
   * `CarrierMotion.test.tsx` ko'radi.
   */
  const keyTrigger = useRef<HTMLElement | null>(null);
  const subNavRef = useRef<HTMLDivElement>(null);
  const rememberKeyTrigger = () => {
    const el = document.activeElement;
    keyTrigger.current = el instanceof HTMLElement && el !== document.body ? el : null;
  };

  /** Tanlangan akkaunt o'chirilsa yoki hali tanlanmagan bo'lsa — birinchisi. */
  const selected =
    accounts.find((a) => a.id === selectedId) ?? accounts[0] ?? null;

  const actions = useCarrierActions({
    onKeyIssued: setIssued,
    onDeleted: () => {
      setSelectedId(null);
      setActive("accounts");
    },
  });

  const openAccount = (account: CarrierAccount) => {
    setSelectedId(account.id);
    setActive("settings");
  };

  const openCreate = () => {
    rememberKeyTrigger();
    setCreateOpen(true);
  };

  const rotate = (account: CarrierAccount) => {
    rememberKeyTrigger();
    actions.confirmRotate(account);
  };

  const openEdit = (account: CarrierAccount) => {
    setEditing(account);
    setEditOpen(true);
  };

  const retry = (
    <Button size="small" loading={list.isFetching} onClick={() => list.refetch()}>
      Qayta urinish
    </Button>
  );

  const noAccount = (
    <CarrierCard>
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="Carrier akkauntlari hali yo'q"
      >
        <Button
          type="primary"
          icon={<Plus className="h-4 w-4" />}
          onClick={openCreate}
        >
          Akkaunt yaratish
        </Button>
      </Empty>
    </CarrierCard>
  );

  const items: SubNavItem[] = [
    {
      key: "accounts",
      label: "Akkauntlar",
      icon: <List className="w-4 h-4" />,
      desc: "Kompaniyalar ro'yxati",
      content: (
        <CarrierAccountsTab
          accounts={accounts}
          onCreate={openCreate}
          onOpen={openAccount}
        />
      ),
    },
    {
      key: "settings",
      label: "Sozlamalar",
      icon: <SettingsIcon className="w-4 h-4" />,
      desc: "Holat, kuryer, IP",
      content: selected ? (
        <CarrierSettingsTab
          account={selected}
          statusPending={actions.statusPending}
          onToggle={actions.confirmStatus}
          onEdit={openEdit}
          onDelete={actions.confirmDelete}
        />
      ) : (
        noAccount
      ),
    },
    {
      key: "key",
      label: "Kalit",
      icon: <KeyRound className="w-4 h-4" />,
      desc: "API kalit va hujjat",
      content: selected ? (
        <CarrierKeyTab
          account={selected}
          rotatePending={actions.rotatePending}
          onRotate={rotate}
        />
      ) : (
        noAccount
      ),
    },
    {
      key: "activity",
      label: "Faollik",
      icon: <Activity className="w-4 h-4" />,
      desc: "Oxirgi so'rov va tarix",
      content: selected ? <CarrierActivityTab account={selected} /> : noAccount,
    },
  ];

  const activeItem = items.find((i) => i.key === active) ?? items[0];

  /**
   * Tugma hali joyida bo'lsa — o'sha; yo'qolgan bo'lsa (bo'sh holatdagi
   * «Akkaunt yaratish» akkaunt paydo bo'lishi bilan yo'qoladi) — joriy
   * bo'limning sub-nav tugmasi.
   */
  const restoreKeyTrigger = () => {
    const el = keyTrigger.current;
    keyTrigger.current = null;
    if (el?.isConnected) {
      el.focus({ preventScroll: true });
      if (document.activeElement === el) return;
    }
    const tabs = subNavRef.current?.querySelectorAll<HTMLButtonElement>("button");
    tabs?.[items.indexOf(activeItem)]?.focus({ preventScroll: true });
  };

  /**
   * Faqat MA'LUMOT YO'Q paytda kontent o'rnida yuklanish yoki xato. Kesh
   * bor-u, fon so'rovi (invalidatsiya, 60 s so'rov) yiqilsa — ekran
   * almashtirilmaydi, tepada kichik ogohlantirish chiqadi. Sub-nav va
   * oynalar har holatda joyida (bir martalik kalit oynasi yopilmaydi).
   */
  let content: ReactNode;
  if (list.data === undefined) {
    content = list.isError ? (
      <Alert
        type="error"
        showIcon
        message="Carrier akkauntlarini yuklab bo'lmadi"
        description={errText(list.error, "Server javob bermadi")}
        action={retry}
      />
    ) : (
      <div className="flex justify-center py-16">
        <Spin size="large" />
      </div>
    );
  } else {
    content = activeItem.content;
  }

  return (
    <div className="flex flex-col gap-4">
      {list.isError && list.data !== undefined && (
        <Alert
          type="warning"
          showIcon
          message="Ro'yxatni yangilab bo'lmadi — ko'rsatilgan ma'lumot eskirgan bo'lishi mumkin"
          description={errText(list.error, "Server javob bermadi")}
          action={retry}
          className="flex-wrap gap-y-2 [&_.ant-alert-action]:!ms-auto [&_.ant-alert-content]:!basis-40"
        />
      )}

      {/*
        Akkaunt tanlagich — Sozlamalar / Kalit / Faollik uchun. Akkauntlar
        bo'limida yo'q: u yerda jadvalning o'zi ro'yxat.
      */}
      {active !== "accounts" && selected && (
        <div className="max-w-full overflow-x-auto">
          <Segmented
            aria-label="Carrier akkaunt"
            value={selected.id}
            onChange={(v) => setSelectedId(String(v))}
            options={accounts.map((a) => ({ label: a.name, value: a.id }))}
          />
        </div>
      )}

      <div ref={subNavRef}>
        <ProviderSubNav
          items={items}
          active={active}
          onChange={(key) => setActive(key as Section)}
        />
      </div>

      <div>{content}</div>

      <CarrierCreateModal
        open={createOpen}
        accounts={accounts}
        onClose={() => setCreateOpen(false)}
        onCreated={(result) => {
          setCreateOpen(false);
          setSelectedId(result.account.id);
          setIssued(result);
        }}
      />
      <CarrierEditModal
        open={editOpen}
        account={editing}
        onClose={() => setEditOpen(false)}
        afterClose={() => setEditing(null)}
      />
      <CarrierKeyOnceModal
        issued={issued}
        onClose={() => setIssued(null)}
        afterClose={restoreKeyTrigger}
      />
    </div>
  );
};

/**
 * CARRIER API — tashqi yetkazuvchi kompaniya BeePost'da bitta kuryer
 * bo'lib ishlaydi va `/api/v1/carrier/*` ga `X-Api-Key` bilan kiradi.
 * 4 bo'lim: Akkauntlar · Sozlamalar · Kalit · Faollik.
 *
 * `<App component={false}>` — ichkaridagi tasdiq oynalari va toast'lar
 * `App.useApp()` orqali `ConfigProvider` mavzusini (qorong'i rejim) oladi.
 * Toast joyi statik `message` bilan bir xil (`MESSAGE_CONFIG`, top 70).
 */
export const CarrierCargoTab = () => (
  <App component={false} message={MESSAGE_CONFIG}>
    <CarrierPanel />
  </App>
);

export default CarrierCargoTab;
