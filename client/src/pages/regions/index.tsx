import React from "react";
import UzbekistanMap from "./components/map";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import type { RootState } from "../../app/store";
import RegionMap from "./components/regionMap";
import { Settings, MapPin } from "lucide-react";

const Regions = () => {
  const navigate = useNavigate();
  const { role, region } = useSelector((state: RootState) => state.roleSlice);

  const { pathname } = useLocation();

  // Check if we're on a child route (districts or sato-management)
  const isChildRoute = pathname.includes("/regions/districts") ||
                       pathname.includes("/regions/sato-management");

  if (isChildRoute) {
    return <Outlet />;
  }

  return (
    <div className="relative">
      {role === "courier" ? (
        <RegionMap regionName={region} />
      ) : (
        <UzbekistanMap />
      )}

      <div className="absolute top-5 right-5 flex gap-3">
        <button
          onClick={() => navigate("districts")}
          className="flex items-center gap-2 border py-2 px-4 text-[#834BFF] border-[#834BFF] rounded-md cursor-pointer hover:shadow-xl hover:bg-[#834BFF] hover:text-white transition-all"
        >
          <MapPin size={18} />
          Tumanlarni tartiblash
        </button>
        {(role === "superadmin" || role === "admin") && (
          <button
            onClick={() => navigate("sato-management")}
            className="flex items-center gap-2 border py-2 px-4 text-[#10b981] border-[#10b981] rounded-md cursor-pointer hover:shadow-xl hover:bg-[#10b981] hover:text-white transition-all"
          >
            <Settings size={18} />
            SATO kodlarini boshqarish
          </button>
        )}
      </div>
    </div>
  );
};

export default React.memo(Regions);
