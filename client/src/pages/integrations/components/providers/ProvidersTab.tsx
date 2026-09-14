import { useState } from "react";
import { Tooltip } from "antd";
import { Plus } from "lucide-react";
import { DELIVERY_PROVIDERS } from "./registry";

/**
 * YETKAZUVCHILAR tabi — provayder tanlovi + o'sha provayderning paneli.
 *
 * Bitta kabina, ko'p yetkazuvchi. LDG o'z panelida qanday bo'lsa shundayligicha
 * qoladi (unga tegilmadi) — Elchi esa ikkinchi variant bo'lib qo'shildi.
 */
export const ProvidersTab = () => {
  const [active, setActive] = useState(DELIVERY_PROVIDERS[0]?.slug ?? "");
  const current =
    DELIVERY_PROVIDERS.find((p) => p.slug === active) ?? DELIVERY_PROVIDERS[0];

  return (
    <div className="space-y-4">
      {/* Provayder tanlovi */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {DELIVERY_PROVIDERS.map((p) => {
          const on = p.slug === active;
          return (
            <button
              key={p.slug}
              onClick={() => setActive(p.slug)}
              className={`flex shrink-0 items-center gap-2.5 rounded-xl border-2 px-4 py-2.5 text-left transition-all cursor-pointer ${
                on
                  ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/25 shadow-sm"
                  : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50 hover:border-indigo-300"
              }`}
            >
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                  on
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300"
                }`}
              >
                {p.icon}
              </span>
              <span>
                <span
                  className={`block text-sm font-bold leading-tight ${
                    on
                      ? "text-indigo-700 dark:text-indigo-300"
                      : "text-gray-700 dark:text-gray-200"
                  }`}
                >
                  {p.label}
                </span>
                <span className="block text-[11px] text-gray-400 dark:text-gray-500 leading-tight">
                  {p.desc}
                </span>
              </span>
            </button>
          );
        })}

        {/*
          "+" tugmasi ATAYLAB o'chirilgan holatda: yangi yetkazuvchi qo'shish
          hozir server tomonda kod talab qiladi. Uni "ishlaydi" qilib
          ko'rsatish operatorni chalg'itardi — tushuntirish bilan turgani
          halolroq.
        */}
        <Tooltip title="Yangi yetkazuvchi qo'shish hozircha kod talab qiladi. Kelajakda yangi cargolar Elchi platformasiga ulanadi.">
          <button
            disabled
            className="flex shrink-0 items-center gap-2 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 px-4 py-2.5 text-gray-400 cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm font-medium">Yangi</span>
          </button>
        </Tooltip>
      </div>

      {/* Tanlangan provayder paneli */}
      <div>{current?.panel}</div>
    </div>
  );
};

export default ProvidersTab;
