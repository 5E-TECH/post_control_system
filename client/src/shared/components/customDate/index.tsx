import React, { memo, useState } from "react";
import dayjs, { Dayjs } from "dayjs";
import { useTranslation } from "react-i18next";

type CalendarProps = {
  from: Dayjs | null;
  to: Dayjs | null;
  setFrom: (date: Dayjs) => void;
  setTo: (date: Dayjs) => void;
};

const CustomCalendar: React.FC<CalendarProps> = memo(
  ({ from, to, setFrom, setTo }) => {
    const { t } = useTranslation("payment");

    const [isFromOpen, setIsFromOpen] = useState(false);
    const [isToOpen, setIsToOpen] = useState(false);

    const [currentMonth, setCurrentMonth] = useState(dayjs());
    const [currentMonthTo, setCurrentMonthTo] = useState(dayjs());

    const toggleFrom = () => {
      setIsFromOpen(!isFromOpen), setIsToOpen(false);
    };
    const toggleTo = () => {
      setIsToOpen(!isToOpen), setIsFromOpen(false);
    };

    const handlePrevMonth = (isFrom: boolean) => {
      if (isFrom) setCurrentMonth(currentMonth.subtract(1, "month"));
      else setCurrentMonthTo(currentMonthTo.subtract(1, "month"));
    };

    const handleNextMonth = (isFrom: boolean) => {
      if (isFrom) setCurrentMonth(currentMonth.add(1, "month"));
      else setCurrentMonthTo(currentMonthTo.add(1, "month"));
    };

    const startOfMonth = (month: Dayjs) => month.startOf("month").day();
    const daysInMonth = (month: Dayjs) => month.daysInMonth();

    const generateCalendarDays = (month: Dayjs) => {
      const days: (Dayjs | null)[] = [];
      const startDay = startOfMonth(month);
      const totalDays = daysInMonth(month);

      for (let i = 0; i < startDay; i++) days.push(null);
      for (let i = 1; i <= totalDays; i++) days.push(dayjs(month).date(i));

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
      <div className=" flex justify-center w-full">
        <div className="w-[400px] max-sm:w-full">
          {/* <h2 className="text-xl font-semibold mb-3">Sana oralig‘ini tanlang</h2> */}
          <div className="flex flex-row sm:flex-row gap-3  w-full">
            {/* From Input */}
            <div className="relative flex-1 w-full">
              <input
                type="text"
                readOnly
                onClick={toggleFrom}
                value={from ? from.format("YYYY-MM-DD") : ""}
                placeholder={`${t("start")}`}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none hover:border-blue-500 focus:border-blue-500 transition cursor-pointer"
              />
              {isFromOpen && (
                <div className="absolute top-full left-0 bg-white border border-gray-300 mt-1 rounded-lg shadow-lg z-50 p-3 w-[200%] dark:bg-[#28243D]">
                  <div className="flex justify-between items-center mb-2">
                    <button
                      onClick={() => handlePrevMonth(true)}
                      className="px-2 py-1 hover:bg-gray-100 rounded"
                    >
                      {"<"}
                    </button>
                    <span className="font-semibold">
                      {currentMonth.format("MMMM YYYY")}
                    </span>
                    <button
                      onClick={() => handleNextMonth(true)}
                      className="px-2 py-1 hover:bg-gray-100 rounded"
                    >
                      {">"}
                    </button>
                  </div>
                  <div className="grid grid-cols-7 gap-1 text-center text-sm mb-1">
                    {weekDays.map((d) => (
                      <div key={d} className="font-medium">
                        {d}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1 text-center">
                    {generateCalendarDays(currentMonth).map((day, idx) => {
                      const isSelected = day && from && day.isSame(from, "day");
                      return (
                        <button
                          key={idx}
                          disabled={!day}
                          onClick={() => day && handleDayClick(day, true)}
                          className={`w-8 h-8 rounded-full ${
                            isSelected
                              ? "bg-blue-500 text-white"
                              : "hover:bg-blue-100 dark:hover:bg-blue-500"
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
                className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none hover:border-blue-500 focus:border-blue-500 transition cursor-pointer"
              />
              {isToOpen && (
                <div className="absolute top-full right-0 bg-white border border-gray-300 mt-1 rounded-lg shadow-lg z-50 p-3 w-[200%] dark:bg-[#28243D]">
                  <div className="flex justify-between items-center mb-2">
                    <button
                      onClick={() => handlePrevMonth(false)}
                      className="px-2 py-1 hover:bg-gray-100 rounded"
                    >
                      {"<"}
                    </button>
                    <span className="font-semibold">
                      {currentMonthTo.format("MMMM YYYY")}
                    </span>
                    <button
                      onClick={() => handleNextMonth(false)}
                      className="px-2 py-1 hover:bg-gray-100 rounded"
                    >
                      {">"}
                    </button>
                  </div>
                  <div className="grid grid-cols-7 gap-1 text-center text-sm mb-1">
                    {weekDays.map((d) => (
                      <div key={d} className="font-medium">
                        {d}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1 text-center">
                    {generateCalendarDays(currentMonthTo).map((day, idx) => {
                      const isSelected = day && to && day.isSame(to, "day");
                      const isBeforeFrom =
                        day && from ? day.isBefore(from, "day") : false;
                      return (
                        <button
                          key={idx}
                          disabled={!day || isBeforeFrom}
                          onClick={() => day && handleDayClick(day, false)}
                          className={`w-8 h-8 rounded-full ${
                            isSelected
                              ? "bg-blue-500 text-white"
                              : "hover:bg-blue-100 dark:hover:bg-blue-500"
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
      // </div>
    );
  }
);

export default CustomCalendar;
