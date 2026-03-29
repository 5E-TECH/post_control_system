import { memo, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useRegion } from "../../../../shared/api/hooks/useRegion/useRegion";
import { useUser } from "../../../../shared/api/hooks/useRegister";
import { useApiNotification } from "../../../../shared/hooks/useApiNotification";
import {
  ArrowLeft,
  HeadphonesIcon,
  MapPin,
  Check,
  X,
  UserPlus,
  Phone,
  Loader2,
  CheckCheck,
} from "lucide-react";

const LogistAssignment = () => {
  const { t } = useTranslation(["regions"]);
  const navigate = useNavigate();
  const { getRegionsWithLogist, bulkAssignLogist, assignLogist } = useRegion();
  const { getLogists } = useUser();
  const { handleApiError, handleSuccess } = useApiNotification();

  const { data: regionsData, isLoading: regionsLoading } = getRegionsWithLogist();
  const { data: logistsData, isLoading: logistsLoading } = getLogists();

  const [selectedLogist, setSelectedLogist] = useState<string | null>(null);
  const [selectedRegions, setSelectedRegions] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  const regions = regionsData?.data || [];
  const logists = logistsData?.data || [];

  const currentLogistRegions = useMemo(() => {
    if (!selectedLogist) return new Set<string>();
    return new Set(
      regions
        .filter((r: any) => r.logist_id === selectedLogist)
        .map((r: any) => r.id)
    );
  }, [selectedLogist, regions]);

  const handleSelectLogist = (logistId: string) => {
    setSelectedLogist(logistId);
    const logistRegions = regions
      .filter((r: any) => r.logist_id === logistId)
      .map((r: any) => r.id);
    setSelectedRegions(new Set(logistRegions));
  };

  const toggleRegion = (regionId: string) => {
    setSelectedRegions((prev) => {
      const next = new Set(prev);
      if (next.has(regionId)) {
        next.delete(regionId);
      } else {
        next.add(regionId);
      }
      return next;
    });
  };

  const selectAllRegions = () => {
    setSelectedRegions(new Set(regions.map((r: any) => r.id)));
  };

  const deselectAllRegions = () => {
    setSelectedRegions(new Set());
  };

  const handleSave = () => {
    if (!selectedLogist) return;
    setIsSaving(true);

    bulkAssignLogist.mutate(
      {
        logist_id: selectedLogist,
        region_ids: Array.from(selectedRegions),
      },
      {
        onSuccess: () => {
          handleSuccess(t("logistSuccess"));
          setIsSaving(false);
        },
        onError: (err: any) => {
          handleApiError(err, t("logistError"));
          setIsSaving(false);
        },
      }
    );
  };

  const handleRemoveLogist = (regionId: string) => {
    assignLogist.mutate(
      { regionId, logist_id: null },
      {
        onSuccess: () => {
          handleSuccess(t("logistRemoved"));
        },
        onError: (err: any) => {
          handleApiError(err, t("errorOccurred"));
        },
      }
    );
  };

  const hasChanges = useMemo(() => {
    if (!selectedLogist) return false;
    const current = currentLogistRegions;
    if (current.size !== selectedRegions.size) return true;
    for (const id of selectedRegions) {
      if (!current.has(id)) return true;
    }
    return false;
  }, [selectedLogist, currentLogistRegions, selectedRegions]);

  const formatPhone = (phone: string) => {
    const cleaned = phone?.replace(/\D/g, "") || "";
    if (cleaned.startsWith("998") && cleaned.length === 12) {
      return `+998 (${cleaned.slice(3, 5)}) ${cleaned.slice(5, 8)}-${cleaned.slice(8, 10)}-${cleaned.slice(10, 12)}`;
    }
    return phone;
  };

  if (regionsLoading || logistsLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-xl bg-white dark:bg-[#2A263D] border border-gray-200 dark:border-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#352F4A] transition-all cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center shadow-lg">
            <HeadphonesIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-800 dark:text-white">
              {t("logistTitle")}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t("logistSubtitle")}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Logistlar ro'yxati */}
          <div className="bg-white dark:bg-[#2A263D] rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/50 p-4">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
              <HeadphonesIcon className="w-4 h-4" />
              {t("logistsHeader")} ({logists.length})
            </h2>

            {logists.length === 0 ? (
              <div className="text-center py-8">
                <HeadphonesIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
                  {t("noLogists")}
                </p>
                <button
                  onClick={() => navigate("/all-users/create-user/logist")}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-teal-600 bg-teal-50 dark:bg-teal-900/30 dark:text-teal-400 rounded-xl hover:bg-teal-100 dark:hover:bg-teal-900/50 transition-colors"
                >
                  <UserPlus className="w-4 h-4" />
                  {t("createLogist")}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {logists.map((logist: any) => (
                  <button
                    key={logist.id}
                    onClick={() => handleSelectLogist(logist.id)}
                    className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                      selectedLogist === logist.id
                        ? "border-teal-500 bg-teal-50 dark:bg-teal-900/20 dark:border-teal-500"
                        : "border-gray-100 dark:border-gray-700 hover:border-teal-300 dark:hover:border-teal-600"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                          selectedLogist === logist.id
                            ? "bg-teal-500 text-white"
                            : "bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400"
                        }`}
                      >
                        <HeadphonesIcon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-800 dark:text-white truncate">
                          {logist.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {formatPhone(logist.phone_number)}
                        </p>
                      </div>
                      {logist.regions?.length > 0 && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 font-medium">
                          {t("regionCount", { count: logist.regions.length })}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Viloyatlar tanlash */}
          <div className="lg:col-span-2 bg-white dark:bg-[#2A263D] rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700/50 p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                {t("regionsHeader")} ({regions.length})
              </h2>

              {selectedLogist && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={selectAllRegions}
                    className="text-xs px-3 py-1 rounded-lg bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 hover:bg-teal-100 dark:hover:bg-teal-900/50 transition-colors"
                  >
                    <CheckCheck className="w-3 h-3 inline mr-1" />
                    {t("selectAll")}
                  </button>
                  <button
                    onClick={deselectAllRegions}
                    className="text-xs px-3 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    {t("clear")}
                  </button>
                </div>
              )}
            </div>

            {!selectedLogist ? (
              <div className="text-center py-12">
                <HeadphonesIcon className="w-16 h-16 text-gray-200 dark:text-gray-600 mx-auto mb-3" />
                <p className="text-gray-500 dark:text-gray-400">
                  {t("selectLogistFirst")}
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4 max-h-[500px] overflow-y-auto pr-1">
                  {regions.map((region: any) => {
                    const isSelected = selectedRegions.has(region.id);
                    const hasOtherLogist =
                      region.logist_id &&
                      region.logist_id !== selectedLogist;

                    return (
                      <div
                        key={region.id}
                        onClick={() => toggleRegion(region.id)}
                        className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
                          isSelected
                            ? "border-teal-500 bg-teal-50 dark:bg-teal-900/20"
                            : "border-gray-100 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-500"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <div
                              className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                                isSelected
                                  ? "border-teal-500 bg-teal-500"
                                  : "border-gray-300 dark:border-gray-600"
                              }`}
                            >
                              {isSelected && (
                                <Check className="w-3 h-3 text-white" />
                              )}
                            </div>
                            <span className="text-sm font-medium text-gray-800 dark:text-white truncate">
                              {region.name}
                            </span>
                          </div>

                          {region.logist && (
                            <div className="flex items-center gap-1 ml-2">
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                  hasOtherLogist
                                    ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                                    : "bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300"
                                }`}
                              >
                                {region.logist.name}
                              </span>
                              {!selectedLogist && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveLogist(region.id);
                                  }}
                                  className="w-5 h-5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-500 flex items-center justify-center hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {hasChanges && (
                  <div className="sticky bottom-0 pt-3 border-t border-gray-100 dark:border-gray-700">
                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      className="w-full h-11 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-600 text-white font-medium flex items-center justify-center gap-2 shadow-lg shadow-teal-500/25 hover:shadow-xl transition-all disabled:opacity-50 cursor-pointer"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          {t("saving")}
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          {t("save")} ({selectedRegions.size} {t("regionsHeader").toLowerCase()})
                        </>
                      )}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default memo(LogistAssignment);
