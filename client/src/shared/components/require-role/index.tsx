import type { ReactNode } from "react";
import { useSelector } from "react-redux";
import { Navigate } from "react-router-dom";
import type { RootState } from "../../../app/store";

/**
 * Sahifa kontentini rol bo'yicha himoyalaydi (URL orqali to'g'ridan-to'g'ri
 * kirishni ham bloklaydi — menyuda yashirish yetarli emas).
 *
 * Ruxsat yo'q bo'lsa: admin/superadmin bo'lsa Settings'ning ochiq bo'limiga,
 * aks holda dashboardга yo'naltiradi (redirect loop bo'lmasligi uchun).
 */
export default function RequireRole({
  roles,
  children,
}: {
  roles: string[];
  children: ReactNode;
}) {
  const role =
    useSelector((s: RootState) => s.roleSlice.role) ||
    localStorage.getItem("role") ||
    "";

  if (role && roles.includes(role)) return <>{children}</>;

  // Investor uchun /dashboardga emas, o'z bo'limiga yo'naltiramiz (redirect loop bo'lmasligi uchun).
  if (role === "investor")
    return <Navigate to="/investor/overview" replace />;

  const settingsAllowed = role === "admin" || role === "superadmin";
  return <Navigate to={settingsAllowed ? "/settings/integrations" : "/"} replace />;
}
