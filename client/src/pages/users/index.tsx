import React, { useState, useRef, useEffect } from "react";
import UsersStatistics from "./components/users-statistics";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useDispatch, useSelector } from "react-redux";
import {
  resetUserFilter,
  setUserFilter,
  type IUserFilter,
} from "../../shared/lib/features/user-filters";
import type { RootState } from "../../app/store";
import {
  Users as UsersIcon,
  Search,
  Filter,
  Plus,
  RotateCcw,
  ChevronDown,
} from "lucide-react";
import { buildAdminPath } from "../../shared/const";
import { useParamsHook } from "../../shared/hooks/useParams";

const Users = () => {
  const { t } = useTranslation("users");
  const { pathname } = useLocation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const form = useSelector((state: RootState) => state.setUserFilter);

  const { getParam, setParam, removeParam } = useParamsHook();
  const [searchValue, setSearchValue] = useState(getParam("search") || "");

  // Dropdown states
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const roleDropdownRef = useRef<HTMLDivElement>(null);
  const statusDropdownRef = useRef<HTMLDivElement>(null);

  // Click outside handler
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        roleDropdownRef.current &&
        !roleDropdownRef.current.contains(event.target as Node)
      ) {
        setRoleDropdownOpen(false);
      }
      if (
        statusDropdownRef.current &&
        !statusDropdownRef.current.contains(event.target as Node)
      ) {
        setStatusDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isChecked = pathname.startsWith(
    buildAdminPath("all-users/create-user")
  );

  if (isChecked) return <Outlet />;

  const roles = ["superadmin", "admin", "registrator", "market", "courier"];
  const status = ["active", "inactive"];

  const handleFilterChange = (name: keyof IUserFilter, value: string) => {
    dispatch(setUserFilter({ name, value }));
  };

  const handleClear = () => {
    dispatch(resetUserFilter());
    setSearchValue("");
    removeParam("search");
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchValue(value);
    if (value) {
      setParam("search", value);
    } else {
      removeParam("search");
    }
  };

  const hasFilters = form.role || form.status || searchValue;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-purple-50/30 to-gray-50 dark:from-[#1E1B2E] dark:via-[#251F3D] dark:to-[#1E1B2E]">
      <div className="max-w-screen-2xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4 sm:mb-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg flex-shrink-0">
              <UsersIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800 dark:text-white">
                {t("title")}
              </h1>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 hidden sm:block">
                Foydalanuvchilarni boshqarish
              </p>
            </div>
          </div>

          <button
            onClick={() => navigate(buildAdminPath("all-users/create-user"))}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-sm sm:text-base font-medium shadow-lg shadow-purple-500/25 hover:shadow-xl transition-all active:scale-[0.98] cursor-pointer"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden xs:inline">{t("addNewUser")}</span>
            <span className="xs:hidden">Qo'shish</span>
          </button>
        </div>

        {/* Statistics */}
        <UsersStatistics />

        {/* Filters Card */}
        <div className="bg-white dark:bg-[#2A263D] rounded-xl sm:rounded-2xl shadow-sm p-3 sm:p-4 md:p-5 mt-4 sm:mt-6 border border-gray-100 dark:border-gray-700/50">
          {/* Filter Header */}
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <Filter className="w-4 h-4 text-purple-500" />
            <span className="text-sm sm:text-base font-semibold text-gray-700 dark:text-gray-200">
              {t("filters")}
            </span>
          </div>

          {/* Filter Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Role Filter */}
            <div className="relative" ref={roleDropdownRef}>
              <button
                onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
                className="w-full h-10 sm:h-11 px-3 sm:px-4 text-sm sm:text-base rounded-lg sm:rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#312D4B] text-gray-800 dark:text-white flex items-center justify-between cursor-pointer hover:border-purple-300 dark:hover:border-purple-600 transition-colors"
              >
                <span className={form.role ? "" : "text-gray-400"}>
                  {form.role ? t(form.role) : t("selectRole")}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-gray-400 transition-transform ${roleDropdownOpen ? "rotate-180" : ""}`}
                />
              </button>
              {roleDropdownOpen && (
                <div className="absolute z-20 w-full mt-1 bg-white dark:bg-[#312D4B] rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden">
                  <div
                    onClick={() => {
                      handleFilterChange("role", "");
                      setRoleDropdownOpen(false);
                    }}
                    className="px-4 py-2.5 text-sm hover:bg-purple-50 dark:hover:bg-purple-900/20 cursor-pointer text-gray-500 dark:text-gray-400"
                  >
                    {t("selectRole")}
                  </div>
                  {roles.map((role) => (
                    <div
                      key={role}
                      onClick={() => {
                        handleFilterChange("role", role);
                        setRoleDropdownOpen(false);
                      }}
                      className={`px-4 py-2.5 text-sm cursor-pointer transition-colors ${
                        form.role === role
                          ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                          : "hover:bg-purple-50 dark:hover:bg-purple-900/20 text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {t(role)}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Status Filter */}
            <div className="relative" ref={statusDropdownRef}>
              <button
                onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
                className="w-full h-10 sm:h-11 px-3 sm:px-4 text-sm sm:text-base rounded-lg sm:rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#312D4B] text-gray-800 dark:text-white flex items-center justify-between cursor-pointer hover:border-purple-300 dark:hover:border-purple-600 transition-colors"
              >
                <span className={form.status ? "" : "text-gray-400"}>
                  {form.status ? t(form.status) : t("selectStatus")}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-gray-400 transition-transform ${statusDropdownOpen ? "rotate-180" : ""}`}
                />
              </button>
              {statusDropdownOpen && (
                <div className="absolute z-20 w-full mt-1 bg-white dark:bg-[#312D4B] rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg overflow-hidden">
                  <div
                    onClick={() => {
                      handleFilterChange("status", "");
                      setStatusDropdownOpen(false);
                    }}
                    className="px-4 py-2.5 text-sm hover:bg-purple-50 dark:hover:bg-purple-900/20 cursor-pointer text-gray-500 dark:text-gray-400"
                  >
                    {t("selectStatus")}
                  </div>
                  {status.map((s) => (
                    <div
                      key={s}
                      onClick={() => {
                        handleFilterChange("status", s);
                        setStatusDropdownOpen(false);
                      }}
                      className={`px-4 py-2.5 text-sm cursor-pointer transition-colors ${
                        form.status === s
                          ? "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                          : "hover:bg-purple-50 dark:hover:bg-purple-900/20 text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      {t(s)}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                value={searchValue}
                onChange={handleSearchChange}
                className="w-full h-10 sm:h-11 pl-9 sm:pl-10 pr-3 sm:pr-4 text-sm sm:text-base rounded-lg sm:rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#312D4B] text-gray-800 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                type="text"
                placeholder={`${t("searchUser")}...`}
              />
            </div>

            {/* Clear Button */}
            <button
              onClick={handleClear}
              disabled={!hasFilters}
              className={`h-10 sm:h-11 px-4 rounded-lg sm:rounded-xl border text-sm sm:text-base font-medium flex items-center justify-center gap-2 transition-colors ${
                hasFilters
                  ? "border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                  : "border-gray-100 dark:border-gray-800 text-gray-300 dark:text-gray-600 cursor-not-allowed"
              }`}
            >
              <RotateCcw className="w-4 h-4" />
              {t("clear")}
            </button>
          </div>
        </div>

        {/* Users Table Container */}
        <div className="bg-white dark:bg-[#2A263D] rounded-xl sm:rounded-2xl shadow-sm overflow-hidden border border-gray-100 dark:border-gray-700/50 mt-4 sm:mt-6">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default React.memo(Users);
