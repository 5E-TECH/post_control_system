import { memo, useEffect, useState } from "react";
import SearchInput from "../../../users/components/search-input";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ClipboardList, Clock, XCircle } from "lucide-react";
import dayjs from "dayjs";
import CustomCalendar from "../../../../shared/components/customDate";
import { DatePicker } from "antd";
import { useDispatch } from "react-redux";
import { setDateRange } from "../../../../shared/lib/features/datafilterSlice";
import { buildAdminPath } from "../../../../shared/const";

const { RangePicker } = DatePicker;

const CourierOrders = () => {
  const { t } = useTranslation("orderList");
  const [isMobile, setIsMobile] = useState(false);
  const dispatch = useDispatch();
  const location = useLocation();

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  const [form, setForm] = useState({
    from: "",
    to: "",
  });

  useEffect(() => {
    setForm({ from: "", to: "" });
  }, [location.pathname]);

  dispatch(setDateRange({ from: form.from, to: form.to }));

  return (
    <div className="w-full bg-white py-5 dark:bg-[#312d4b]">
      <h1 className="font-medium text-[20px] text-[#2E263DE5] dark:text-[#D4D0E9] px-5">
        {t("title")}
      </h1>

      <div className="flex justify-between px-5 pt-5 pb-7 max-[650px]:pb-0  items-center max-[650px]:flex-col">
        <div className="min-[650px]:hidden transition-all mb-5 w-full">
          <SearchInput
            className="w-full"
            placeholder={t("placeholder.searchOrder")}
          />
        </div>
        <div className="flex gap-5 max-[650px]:w-[100%] max-[650px]:mb-5">
          <div className="w-full flex justify-between">
            <div className="flex gap-5 max-[640px]:gap-0  w-full">
              {isMobile ? (
                // Mobile uchun custom date inputs (faqat text input + popup)
                <div className="flex flex-col gap-2 w-full">
                  <CustomCalendar
                    from={form.from ? dayjs(form.from) : null}
                    to={form.to ? dayjs(form.to) : null}
                    setFrom={(date: any) =>
                      setForm((prev) => ({
                        ...prev,
                        from: date.format("YYYY-MM-DD"),
                      }))
                    }
                    setTo={(date: any) =>
                      setForm((prev) => ({
                        ...prev,
                        to: date.format("YYYY-MM-DD"),
                      }))
                    }
                  />
                </div>
              ) : (
                // Desktop uchun Antd RangePicker
                <RangePicker
                  value={[
                    form.from ? dayjs(form.from) : null,
                    form.to ? dayjs(form.to) : null,
                  ]}
                  onChange={(dates: any) => {
                    setForm((prev) => ({
                      ...prev,
                      from: dates?.[0] ? dates[0].format("YYYY-MM-DD") : "",
                      to: dates?.[1] ? dates[1].format("YYYY-MM-DD") : "",
                    }));
                  }}
                  placeholder={[`${t("start")}`, `${t("end")}`]}
                  format="YYYY-MM-DD"
                  size="large"
                  className="w-[340px] max-md:w-[100%] border border-[#E5E7EB] rounded-lg px-3 py-[6px] outline-none"
                />
              )}
            </div>
          </div>
        </div>

        <div
          className="
    flex gap-6 max-md:mb-5
    max-[440px]:flex-col
    max-[440px]:gap-3
    max-[440px]:w-full
  "
        >
          {/* 1️⃣ KUTILAYOTGAN BUYURTMALAR */}
          <NavLink
            end
            to={buildAdminPath("courier-orders/orders")}
            className={({ isActive }) =>
              `
      text-md font-medium transition duration-200 pb-1
      ${
        isActive
          ? "text-[#5A48FA] border-b-2 border-[#5A48FA]"
          : "text-[#2E263DB2] hover:text-[#5A48FA] dark:text-[#CAD0E9]"
      }

      /* telefon uchun */
      max-[440px]:flex
      max-[440px]:items-center
      max-[440px]:justify-center
      max-[440px]:gap-2
      max-[440px]:rounded-lg
      max-[440px]:py-2
      max-[440px]:px-3
      max-[440px]:w-full
      ${
        isActive
          ? "max-[440px]:bg-yellow-500  max-[440px]:border-b-5 max-[440px]:border-b-yellow-700"
          : "max-[440px]:bg-yellow-400"
      }
      max-[440px]:text-white
      max-[440px]:shadow-sm
      `
            }
          >
            <Clock className="max-[440px]:w-5 max-[440px]:h-5 hidden max-[440px]:inline" />
            {t("kutilayotganBuyurtmalar")}
          </NavLink>

          {/* 2️⃣ HAMMA BUYURTMALAR */}
          <NavLink
            to={buildAdminPath("courier-orders/orders/all")}
            className={({ isActive }) =>
              `
      text-md font-medium transition duration-200 pb-1
      ${
        isActive
          ? "text-[#5A48FA] border-b-2 border-[#5A48FA]"
          : "text-[#2E263DB2] hover:text-[#5A48FA] dark:text-[#CAD0E9]"
      }

      /* telefon uchun */
      max-[440px]:flex
      max-[440px]:items-center
      max-[440px]:justify-center
      max-[440px]:gap-2
      max-[440px]:rounded-lg
      max-[440px]:py-2
      max-[440px]:px-3
      max-[440px]:w-full
      ${
        isActive
          ? "max-[440px]:bg-[#4a3adf]  max-[440px]:border-b-5 max-[440px]:border-b-[#170c72]"
          : "max-[440px]:bg-[#5A48FA]"
      }
      max-[440px]:text-white
      max-[440px]:shadow-sm
      `
            }
          >
            <ClipboardList className="max-[440px]:w-5 max-[440px]:h-5 hidden max-[440px]:inline" />
            {t("hammaBuyurtmalar")}
          </NavLink>

          {/* 3️⃣ BEKOR QILINGAN BUYURTMALAR */}
          <NavLink
            to={buildAdminPath("courier-orders/orders/cancelled")}
            className={({ isActive }) =>
              `
      text-md font-medium transition duration-200 pb-1
      ${
        isActive
          ? "text-[#5A48FA] border-b-2 border-[#5A48FA]"
          : "text-[#2E263DB2] hover:text-[#5A48FA] dark:text-[#CAD0E9]"
      }

      /* telefon uchun */
      max-[440px]:flex
      max-[440px]:items-center
      max-[440px]:justify-center
      max-[440px]:gap-2
      max-[440px]:rounded-lg
      max-[440px]:py-2
      max-[440px]:px-3
      max-[440px]:w-full
      ${
        isActive
          ? "max-[440px]:bg-red-600  max-[440px]:border-b-5 max-[440px]:border-b-red-800"
          : "max-[440px]:bg-red-600"
      }
      max-[440px]:text-white
      max-[440px]:shadow-sm
      `
            }
          >
            <XCircle className="max-[440px]:w-5 max-[440px]:h-5 hidden max-[440px]:inline" />
            {t("bekorBuyurtmalar")}
          </NavLink>
        </div>

        <div className="max-[650px]:hidden transition-all">
          <SearchInput placeholder={t("placeholder.searchOrder")} />
        </div>
      </div>

      <Outlet />
    </div>
  );
};

export default memo(CourierOrders);
