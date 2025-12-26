import React from "react";
import UzbekistanMap from "./components/map";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import type { RootState } from "../../app/store";
import RegionMap from "./components/regionMap";
import { buildAdminPath } from "../../shared/const";

const Regions = () => {
  const navigate = useNavigate();
  const { role, region } = useSelector((state: RootState) => state.roleSlice);

  const { pathname } = useLocation();
  if (pathname.startsWith(buildAdminPath("regions/"))) {
    return <Outlet />;
  }
  return (
    <div className="relative">
      {role === "courier" ? (
        <RegionMap regionName={region} />
        
      ) : (
        <UzbekistanMap />
      )}
      

      <button
        onClick={() => navigate("districts")}
        className="absolute top-5 right-5 border py-2 px-3 text-[#834BFF] border-[#834BFF] rounded-md cursor-pointer hover:shadow-xl"
      >
        Tumanlarni tartiblash
      </button>
    </div>
  );
};

export default React.memo(Regions);
