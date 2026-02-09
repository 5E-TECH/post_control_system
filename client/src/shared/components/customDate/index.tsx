import React, { memo, useState } from "react";
import dayjs, { Dayjs } from "dayjs";
import { useTranslation } from "react-i18next";

type CalendarProps = {
  from: Dayjs | null;
  to: Dayjs | null;
  setFrom: (date: Dayjs | null) => void;
  setTo: (date: Dayjs | null) => void;
};

const CustomCalendar: React.FC<CalendarProps> = memo(
  ({ from, to, setFrom, setTo }) => {
    const { t } = useTranslation("payment");

    const [isFromOpen, setIsFromOpen] = useState(false);
    const [isToOpen, setIsToOpen] = useState(false);

    const [currentMonth, setCurrentMonth] = useState(dayjs());
    const [currentMonthTo, setCurrentMonthTo] = useState(dayjs());

    const toggleFrom = () => {
      setIsFromOpen(!isFromOpen);
      setIsToOpen(false);
    };
    const toggleTo = () => {
      setIsToOpen(!isToOpen);
      setIsFromOpen(false);
    };

    const closeAll = () => {
      setIsFromOpen(false);
      setIsToOpen(false);
    };

    const handlePrevMonth = (isFrom: boolean) => {
      if (isFrom) setCurrentMonth(currentMonth.subtract(1, "month"));
      else setCurrentMonthTo(currentMonthTo.subtract(1, "month"));
    };

    const handleNextMonth = (isFrom: boolean) => {
      if (isFrom) setCurrentMonth(currentMonth.add(1, "month"));
      else setCurrentMonthTo(currentMonthTo.add(1, "month"));
    };

    const daysInMonth = (month: Dayjs) => month.daysInMonth();

    // Oyning birinchi kunini olish (Dushanba = 0, Yakshanba = 6)
    const getStartDayOfWeek = (month: Dayjs) => {
      const day = month.startOf("month").day(); // 0 = Yakshanba, 1 = Dushanba, ...
      // Dushanbadan boshlanadigan formatga o'zgartirish
      return day === 0 ? 6 : day - 1;
    };

    const generateCalendarDays = (month: Dayjs) => {
      const days: (Dayjs | null)[] = [];
      const startDay = getStartDayOfWeek(month);
      const totalDays = daysInMonth(month);

      for (let i = 0; i < startDay; i++) days.push(null);
      for (let i = 1; i <= totalDays; i++) days.push(month.date(i));

      return days;
    };

    const handleDayClick = (day: Dayjs, isFrom: boolean) => {
      if (isFrom) {
        setFrom(day);
        if (to && day.isAfter(to)) setTo(day);
        setIsFromOpen(false);
        setIsToOpen(true);
        setCurrentMonthTo(day);
      } else {
        setTo(day);
        setIsToOpen(false);
      }
    };

    const weekDays = ["D", "S", "Ch", "P", "J", "Sh", "Y"];

    return (
      <div className="w-full relative">
        {/* Backdrop */}
        {(isFromOpen || isToOpen) && (
          <div
            className="fixed inset-0 z-40 bg-black/10"
            onClick={closeAll}
          />
        )}

        <div className="w-full">
          <div className="flex flex-row gap-2 w-full">
            {/* From Input */}
            <div className="relative flex-1">
              <input
                type="text"
                readOnly
                onClick={toggleFrom}
                value={from ? from.format("YYYY-MM-DD") : ""}
                placeholder={`${t("start")}`}
                className="w-full h-10 border border-gray-300 dark:border-gray-600 dark:bg-[#28243D] dark:text-white rounded-xl px-3 py-2 text-sm outline-none hover:border-blue-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition cursor-pointer"
              />
              {isFromOpen && (
                <div className="fixed left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 sm:absolute sm:left-0 sm:translate-x-0 sm:top-full sm:translate-y-0 bg-white border border-gray-200 mt-0 sm:mt-2 rounded-2xl shadow-2xl z-50 p-4 w-[calc(100vw-32px)] sm:w-[280px] max-w-[320px] dark:bg-[#28243D] dark:border-gray-700">
                  {/* Label */}
                  <div className="text-center mb-3 pb-2 border-b border-gray-100 dark:border-gray-700">
                    <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                      Qachondan
                    </span>
                  </div>
                  <div className="flex justify-between items-center mb-3">
                    <button
                      type="button"
                      onClick={() => handlePrevMonth(true)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                    >
                      {"<"}
                    </button>
                    <span className="font-semibold text-gray-800 dark:text-white">
                      {currentMonth.format("MMMM YYYY")}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleNextMonth(true)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                    >
                      {">"}
                    </button>
                  </div>
                  <div className="grid grid-cols-7 gap-1 text-center text-xs mb-2">
                    {weekDays.map((d) => (
                      <div key={d} className="font-medium text-gray-500 dark:text-gray-400 py-1">
                        {d}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1 text-center">
                    {generateCalendarDays(currentMonth).map((day, idx) => {
                      const isSelected = day && from && day.isSame(from, "day");
                      const isToday = day && day.isSame(dayjs(), "day");
                      return (
                        <button
                          type="button"
                          key={idx}
                          disabled={!day}
                          onClick={() => day && handleDayClick(day, true)}
                          className={`w-9 h-9 rounded-xl text-sm font-medium transition relative ${
                            isSelected
                              ? "bg-blue-500 text-white shadow-md"
                              : isToday
                              ? "bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 ring-2 ring-purple-400 dark:ring-purple-500"
                              : day ? "hover:bg-blue-100 dark:hover:bg-blue-900/30 text-gray-700 dark:text-gray-300" : ""
                          }`}
                        >
                          {day ? day.date() : ""}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* To Input */}
            <div className="relative flex-1">
              <input
                type="text"
                readOnly
                onClick={toggleTo}
                value={to ? to.format("YYYY-MM-DD") : ""}
                placeholder={`${t("end")}`}
                className="w-full h-10 border border-gray-300 dark:border-gray-600 dark:bg-[#28243D] dark:text-white rounded-xl px-3 py-2 text-sm outline-none hover:border-blue-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition cursor-pointer"
              />
              {isToOpen && (
                <div className="fixed left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 sm:absolute sm:right-0 sm:left-auto sm:translate-x-0 sm:top-full sm:translate-y-0 bg-white border border-gray-200 mt-0 sm:mt-2 rounded-2xl shadow-2xl z-50 p-4 w-[calc(100vw-32px)] sm:w-[280px] max-w-[320px] dark:bg-[#28243D] dark:border-gray-700">
                  {/* Label */}
                  <div className="text-center mb-3 pb-2 border-b border-gray-100 dark:border-gray-700">
                    <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                      Qachongacha
                    </span>
                  </div>
                  <div className="flex justify-between items-center mb-3">
                    <button
                      type="button"
                      onClick={() => handlePrevMonth(false)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                    >
                      {"<"}
                    </button>
                    <span className="font-semibold text-gray-800 dark:text-white">
                      {currentMonthTo.format("MMMM YYYY")}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleNextMonth(false)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                    >
                      {">"}
                    </button>
                  </div>
                  <div className="grid grid-cols-7 gap-1 text-center text-xs mb-2">
                    {weekDays.map((d) => (
                      <div key={d} className="font-medium text-gray-500 dark:text-gray-400 py-1">
                        {d}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1 text-center">
                    {generateCalendarDays(currentMonthTo).map((day, idx) => {
                      const isSelected = day && to && day.isSame(to, "day");
                      const isToday = day && day.isSame(dayjs(), "day");
                      const isBeforeFrom =
                        day && from ? day.isBefore(from, "day") : false;
                      return (
                        <button
                          type="button"
                          key={idx}
                          disabled={!day || isBeforeFrom}
                          onClick={() => day && handleDayClick(day, false)}
                          className={`w-9 h-9 rounded-xl text-sm font-medium transition ${
                            isSelected
                              ? "bg-blue-500 text-white shadow-md"
                              : isToday && !isBeforeFrom
                              ? "bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 ring-2 ring-purple-400 dark:ring-purple-500"
                              : day && !isBeforeFrom ? "hover:bg-blue-100 dark:hover:bg-blue-900/30 text-gray-700 dark:text-gray-300" : "text-gray-300 dark:text-gray-600"
                          }`}
                        >
                          {day ? day.date() : ""}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    );
  }
);

export default CustomCalendar;
