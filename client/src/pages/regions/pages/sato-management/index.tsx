import { memo, useState, useEffect } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "../../../../app/store";
import {
  Button,
  Card,
  Table,
  Tag,
  Modal,
  Input,
  Tabs,
  Alert,
  Statistic,
  message,
  Tooltip
} from "antd";
import {
  CheckCircle,
  AlertTriangle,
  Copy,
  Search,
  RefreshCw,
  Download,
  Edit3,
  Zap,
  Pencil,
  Plus,
  Merge,
  Check,
  X,
  ChevronRight,
  ChevronLeft,
  Clipboard,
} from "lucide-react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { useRegion } from "../../../../shared/api/hooks/useRegion/useRegion";
import { useDistrict } from "../../../../shared/api/hooks/useDistrict";

interface MatchedItem {
  dbId: string;
  dbName: string;
  satoCode: string;
  satoName: string;
}

interface UnmatchedItem {
  dbId: string;
  dbName: string;
  regionName?: string;
}

interface DuplicateItem {
  name: string;
  entries: { id: string; regionName?: string }[];
}

interface MissingSatoItem {
  satoCode: string;
  satoName: string;
  regionName?: string;
}

interface MatchResult {
  matched: MatchedItem[];
  unmatched: UnmatchedItem[];
  duplicates: DuplicateItem[];
  missingSatoEntries: MissingSatoItem[];
  stats: {
    totalDb: number;
    totalSato: number;
    matchedCount: number;
    unmatchedCount: number;
    duplicatesCount: number;
    missingCount: number;
  };
}

interface DistrictType {
  id: string;
  name: string;
  region_id: string;
}

interface RegionType {
  id: string;
  name: string;
  assignedDistricts: DistrictType[];
}

const SatoManagement = () => {
  // User role tekshirish
  const { role } = useSelector((state: RootState) => state.roleSlice);
  const isSuperadmin = role === "superadmin";

  const [activeTab, setActiveTab] = useState("districts");
  const [searchText, setSearchText] = useState("");
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<{
    id: string;
    name: string;
    type: "region" | "district";
  } | null>(null);
  const [newSatoCode, setNewSatoCode] = useState("");

  // Side panel state
  const [sidePanelOpen, setSidePanelOpen] = useState(true);

  // Region hooks
  const {
    getRegions,
    getSatoMatchPreview: getRegionSatoMatch,
    applySatoCodes: applyRegionSatoCodes,
    updateRegionSatoCode,
    updateRegionName,
  } = useRegion();

  // Name edit state
  const [nameModalOpen, setNameModalOpen] = useState(false);
  const [editingNameItem, setEditingNameItem] = useState<{
    id: string;
    name: string;
    type: "region" | "district";
  } | null>(null);
  const [newName, setNewName] = useState("");

  // District hooks
  const {
    getSatoMatchPreview: getDistrictSatoMatch,
    applySatoCodes: applyDistrictSatoCodes,
    updateDistrictSatoCode,
    updateDistrictName,
    updateDistrict,
    createDistrict,
    mergeDistricts,
  } = useDistrict();

  const { data: regionsData, refetch: refetchRegions, isLoading: regionsLoading } = getRegions();
  const {
    data: regionMatchData,
    isLoading: regionMatchLoading,
    refetch: refetchRegionMatch,
  } = getRegionSatoMatch();
  const {
    data: districtMatchData,
    isLoading: districtMatchLoading,
    refetch: refetchDistrictMatch,
  } = getDistrictSatoMatch();

  const regionMatch: MatchResult | null = regionMatchData?.data || null;
  const districtMatch: MatchResult | null = districtMatchData?.data || null;

  // Districts panel state
  const [regions, setRegions] = useState<RegionType[]>([]);
  const [openRegionId, setOpenRegionId] = useState<string | null>(null);
  const [newDistrict, setNewDistict] = useState<string>("");
  const [editRegionId, setEditRegionId] = useState<string | null>(null);
  const [editDistrictId, setEditDistrictId] = useState<string | null>(null);
  const [editDistrictName, setEditDistrictName] = useState<string>("");
  const [highlightedDistrict, setHighlightedDistrict] = useState<string | null>(null);
  const [editingRegionNameId, setEditingRegionNameId] = useState<string | null>(null);
  const [editingRegionName, setEditingRegionName] = useState<string>("");
  const [mergeMode, setMergeMode] = useState(false);
  const [selectedForMerge, setSelectedForMerge] = useState<
    { id: string; name: string; regionId: string }[]
  >([]);
  const [mergeTargetId, setMergeTargetId] = useState<string | null>(null);
  const [mergeModalOpen, setMergeModalOpen] = useState(false);

  useEffect(() => {
    if (regionsData?.data) {
      setRegions(regionsData.data);
    }
  }, [regionsData]);

  const handleApplyRegionSato = () => {
    applyRegionSatoCodes.mutate(undefined, {
      onSuccess: (res) => {
        message.success(res?.message || "Viloyatlarga SATO kodlari qo'shildi");
        refetchRegionMatch();
        refetchRegions();
      },
      onError: () => {
        message.error("Xatolik yuz berdi");
      },
    });
  };

  const handleApplyDistrictSato = () => {
    applyDistrictSatoCodes.mutate(undefined, {
      onSuccess: (res) => {
        message.success(res?.message || "Tumanlarga SATO kodlari qo'shildi");
        refetchDistrictMatch();
        refetchRegions();
      },
      onError: () => {
        message.error("Xatolik yuz berdi");
      },
    });
  };

  const handleEditSatoCode = (
    id: string,
    name: string,
    type: "region" | "district"
  ) => {
    setEditingItem({ id, name, type });
    setNewSatoCode("");
    setEditModalOpen(true);
  };

  const handleSaveSatoCode = () => {
    if (!editingItem || !newSatoCode) return;

    const mutation =
      editingItem.type === "region"
        ? updateRegionSatoCode
        : updateDistrictSatoCode;

    mutation.mutate(
      { id: editingItem.id, sato_code: newSatoCode },
      {
        onSuccess: () => {
          message.success("SATO code yangilandi");
          setEditModalOpen(false);
          setEditingItem(null);
          setNewSatoCode("");
          if (editingItem.type === "region") {
            refetchRegionMatch();
          } else {
            refetchDistrictMatch();
          }
          refetchRegions();
        },
        onError: (err: any) => {
          message.error(
            err?.response?.data?.message || "Xatolik yuz berdi"
          );
        },
      }
    );
  };

  // Name editing handlers
  const handleEditName = (
    id: string,
    name: string,
    type: "region" | "district"
  ) => {
    setEditingNameItem({ id, name, type });
    setNewName(name);
    setNameModalOpen(true);
  };

  const handleSaveName = () => {
    if (!editingNameItem || !newName.trim()) return;

    const mutation =
      editingNameItem.type === "region"
        ? updateRegionName
        : updateDistrictName;

    const payload = editingNameItem.type === "region"
      ? { id: editingNameItem.id, name: newName }
      : { id: editingNameItem.id, data: { name: newName } };

    mutation.mutate(payload as any, {
      onSuccess: () => {
        message.success("Nom yangilandi");
        setNameModalOpen(false);
        setEditingNameItem(null);
        setNewName("");
        refetchRegionMatch();
        refetchDistrictMatch();
        refetchRegions();
      },
      onError: (err: any) => {
        message.error(err?.response?.data?.message || "Xatolik yuz berdi");
      },
    });
  };

  // District panel functions
  const handleAddDistrict = () => {
    const data = {
      region_id: openRegionId,
      name: newDistrict,
    };
    createDistrict.mutate(data, {
      onSuccess: (res) => {
        const newDistrictId = res?.data?.data?.id;
        setHighlightedDistrict(newDistrictId);
        setOpenRegionId(null);
        refetchRegions();
        refetchDistrictMatch();
        setTimeout(() => setHighlightedDistrict(null), 1000);
      },
    });
    setTimeout(() => {
      setOpenRegionId(null);
      setEditDistrictId(null);
      setNewDistict("");
    }, 5000);
  };

  const handleDragEnd = (result: DropResult) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId) return;

    setRegions((prevRegions) => {
      const updated = [...prevRegions];
      const sourceRegion = updated.find((r) => r.id === source.droppableId);
      const destRegion = updated.find((r) => r.id === destination.droppableId);
      if (!sourceRegion || !destRegion) return prevRegions;

      const draggedDistrict = sourceRegion.assignedDistricts.find(
        (d) => d.id === draggableId
      );
      if (!draggedDistrict) return prevRegions;

      sourceRegion.assignedDistricts = sourceRegion.assignedDistricts.filter(
        (d) => d.id !== draggableId
      );

      destRegion.assignedDistricts.push({
        ...draggedDistrict,
        region_id: destRegion.id,
      });

      updateDistrict.mutate(
        { id: draggedDistrict.id, data: { assigned_region: destRegion.id } },
        {
          onSuccess: () => {
            setHighlightedDistrict(draggedDistrict.id);
            setTimeout(() => setHighlightedDistrict(null), 1000);
          },
          onError: (err) => console.error("Update error:", err),
        }
      );

      return updated;
    });
  };

  const handleDistrictSubmit = () => {
    const id = editDistrictId;
    const data = { name: editDistrictName };
    updateDistrictName.mutate(
      { id, data },
      {
        onSuccess: () => {
          refetchRegions();
          refetchDistrictMatch();
          setHighlightedDistrict(id);
          setTimeout(() => setHighlightedDistrict(null), 1000);
        },
      }
    );
    setEditDistrictId(null);
  };

  const handleRegionNameSubmit = (regionId: string) => {
    if (!editingRegionName.trim()) {
      message.error("Viloyat nomi bo'sh bo'lishi mumkin emas");
      return;
    }
    updateRegionName.mutate(
      { id: regionId, name: editingRegionName },
      {
        onSuccess: () => {
          message.success("Viloyat nomi yangilandi");
          refetchRegions();
          refetchRegionMatch();
          setEditingRegionNameId(null);
          setEditingRegionName("");
        },
        onError: () => {
          message.error("Xatolik yuz berdi");
        },
      }
    );
  };

  const toggleMergeSelection = (district: {
    id: string;
    name: string;
    regionId: string;
  }) => {
    setSelectedForMerge((prev) => {
      const exists = prev.find((d) => d.id === district.id);
      if (exists) {
        return prev.filter((d) => d.id !== district.id);
      }
      return [...prev, district];
    });
  };

  const handleMergeConfirm = () => {
    if (selectedForMerge.length < 2) {
      message.warning("Kamida 2 ta tuman tanlang");
      return;
    }
    setMergeModalOpen(true);
  };

  const executeMerge = () => {
    if (!mergeTargetId) {
      message.warning("Maqsadli tumanni tanlang");
      return;
    }

    const sourceIds = selectedForMerge
      .filter((d) => d.id !== mergeTargetId)
      .map((d) => d.id);

    mergeDistricts.mutate(
      {
        source_district_ids: sourceIds,
        target_district_id: mergeTargetId,
      },
      {
        onSuccess: (res) => {
          message.success(res?.message || "Tumanlar birlashtirildi");
          refetchRegions();
          refetchDistrictMatch();
          setMergeMode(false);
          setSelectedForMerge([]);
          setMergeTargetId(null);
          setMergeModalOpen(false);
        },
        onError: (err: any) => {
          message.error(
            err?.response?.data?.message || "Xatolik yuz berdi"
          );
        },
      }
    );
  };

  const cancelMergeMode = () => {
    setMergeMode(false);
    setSelectedForMerge([]);
    setMergeTargetId(null);
  };

  // Filter function
  const filterData = <T extends { dbName?: string; name?: string; satoName?: string }>(
    data: T[] | undefined
  ): T[] => {
    if (!data) return [];
    if (!searchText) return data;
    const search = searchText.toLowerCase();
    return data.filter(
      (item) =>
        item.dbName?.toLowerCase().includes(search) ||
        item.name?.toLowerCase().includes(search) ||
        item.satoName?.toLowerCase().includes(search)
    );
  };

  const renderStats = (stats: MatchResult["stats"] | undefined) => {
    if (!stats) return null;
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
        <Card size="small" className="!p-2">
          <Statistic
            title={<span className="text-xs">Jami (DB)</span>}
            value={stats.totalDb}
            valueStyle={{ color: "#1890ff", fontSize: 18 }}
          />
        </Card>
        <Card size="small" className="!p-2">
          <Statistic
            title={<span className="text-xs">Jami (SATO)</span>}
            value={stats.totalSato}
            valueStyle={{ color: "#1890ff", fontSize: 18 }}
          />
        </Card>
        <Card size="small" className="!p-2">
          <Statistic
            title={<span className="text-xs">Mos keldi</span>}
            value={stats.matchedCount}
            valueStyle={{ color: "#52c41a", fontSize: 18 }}
            prefix={<CheckCircle size={14} />}
          />
        </Card>
        <Card size="small" className="!p-2">
          <Statistic
            title={<span className="text-xs">Mos kelmadi</span>}
            value={stats.unmatchedCount}
            valueStyle={{ color: "#faad14", fontSize: 18 }}
            prefix={<AlertTriangle size={14} />}
          />
        </Card>
        <Card size="small" className="!p-2">
          <Statistic
            title={<span className="text-xs">Dublikatlar</span>}
            value={stats.duplicatesCount}
            valueStyle={{ color: "#ff4d4f", fontSize: 18 }}
            prefix={<Copy size={14} />}
          />
        </Card>
        <Card size="small" className="!p-2">
          <Statistic
            title={<span className="text-xs">DB da yo'q</span>}
            value={stats.missingCount}
            valueStyle={{ color: "#722ed1", fontSize: 18 }}
          />
        </Card>
      </div>
    );
  };

  const getMatchedColumns = (type: "region" | "district") => [
    {
      title: "DB nomi",
      dataIndex: "dbName",
      key: "dbName",
      render: (text: string, record: MatchedItem) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{text}</span>
          <Button
            type="link"
            size="small"
            icon={<Edit3 size={12} />}
            onClick={() => handleEditName(record.dbId, text.split(" (")[0], type)}
            className="text-gray-400 hover:text-blue-500 !p-0"
          />
        </div>
      ),
    },
    {
      title: "SATO nomi",
      dataIndex: "satoName",
      key: "satoName",
      render: (text: string) => (
        <span className="text-gray-500 text-sm">{text}</span>
      ),
    },
    {
      title: "SATO kod",
      dataIndex: "satoCode",
      key: "satoCode",
      render: (text: string) => (
        <Tag color="green" className="font-mono text-xs">
          {text}
        </Tag>
      ),
    },
    {
      title: "Holat",
      dataIndex: "satoName",
      key: "status",
      width: 100,
      render: (satoName: string) =>
        satoName === "(allaqachon mavjud)" ? (
          <Tag color="blue">Mavjud</Tag>
        ) : (
          <Tag color="orange">Qo'shiladi</Tag>
        ),
    },
  ];

  const unmatchedColumns = (type: "region" | "district") => [
    {
      title: "Nomi",
      dataIndex: "dbName",
      key: "dbName",
      render: (text: string) => <span className="font-medium text-sm">{text}</span>,
    },
    ...(type === "district"
      ? [
          {
            title: "Viloyat",
            dataIndex: "regionName",
            key: "regionName",
          },
        ]
      : []),
    {
      title: "Amal",
      key: "action",
      width: 130,
      render: (_: any, record: UnmatchedItem) => (
        <Button
          type="primary"
          size="small"
          icon={<Edit3 size={12} />}
          onClick={() => handleEditSatoCode(record.dbId, record.dbName, type)}
        >
          SATO
        </Button>
      ),
    },
  ];

  const duplicateColumns = [
    {
      title: "Nomi",
      dataIndex: "name",
      key: "name",
      render: (text: string) => (
        <span className="font-medium text-red-600 text-sm">{text}</span>
      ),
    },
    {
      title: "Soni",
      dataIndex: "entries",
      key: "count",
      width: 80,
      render: (entries: { id: string }[]) => (
        <Tag color="red">{entries.length} ta</Tag>
      ),
    },
    {
      title: "ID lar",
      dataIndex: "entries",
      key: "ids",
      render: (entries: { id: string }[]) => (
        <div className="flex flex-wrap gap-1">
          {entries.map((e, i) => (
            <Tooltip key={i} title={e.id}>
              <Tag className="font-mono text-xs">{e.id.slice(0, 6)}...</Tag>
            </Tooltip>
          ))}
        </div>
      ),
    },
  ];

  // Copy tugmasi uchun handler
  const handleCopyName = (name: string) => {
    navigator.clipboard.writeText(name).then(() => {
      message.success(`"${name}" nusxalandi`);
    }).catch(() => {
      message.error("Nusxalashda xatolik");
    });
  };

  const missingColumns = (type: "region" | "district") => [
    {
      title: "SATO nomi",
      dataIndex: "satoName",
      key: "satoName",
      render: (text: string) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{text}</span>
          <Tooltip title="Nusxalash">
            <Button
              type="text"
              size="small"
              icon={<Clipboard size={12} />}
              onClick={() => handleCopyName(text)}
              className="!p-0 !w-5 !h-5 !min-w-0 text-gray-400 hover:text-blue-500"
            />
          </Tooltip>
        </div>
      ),
    },
    ...(type === "district"
      ? [
          {
            title: "Viloyat",
            dataIndex: "regionName",
            key: "regionName",
          },
        ]
      : []),
    {
      title: "SATO kod",
      dataIndex: "satoCode",
      key: "satoCode",
      width: 100,
      render: (text: string) => (
        <Tag color="purple" className="font-mono text-xs">
          {text}
        </Tag>
      ),
    },
  ];

  const renderContent = (
    match: MatchResult | null,
    isLoading: boolean,
    type: "region" | "district",
    onApply: () => void,
    applyLoading: boolean
  ) => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="animate-spin mr-2" />
          Yuklanmoqda...
        </div>
      );
    }

    if (!match) {
      return (
        <Alert
          type="info"
          message="Ma'lumot topilmadi"
          description="SATO matching ma'lumotlari yuklanmadi"
        />
      );
    }

    const hasNewMatches = match.matched.some(
      (m) => m.satoName !== "(allaqachon mavjud)"
    );

    return (
      <div className="space-y-4">
        {renderStats(match.stats)}

        {/* Action buttons */}
        <div className="flex gap-2 flex-wrap">
          <Button
            type="primary"
            size="small"
            icon={<Zap size={14} />}
            onClick={onApply}
            loading={applyLoading}
            disabled={!hasNewMatches}
          >
            Avtomatik SATO ({match.matched.filter((m) => m.satoName !== "(allaqachon mavjud)").length})
          </Button>
          <Button
            size="small"
            icon={<RefreshCw size={14} />}
            onClick={() =>
              type === "region" ? refetchRegionMatch() : refetchDistrictMatch()
            }
          >
            Yangilash
          </Button>
        </div>

        {/* Matched table */}
        {match.matched.length > 0 && (
          <Card
            title={
              <span className="text-green-600 text-sm">
                <CheckCircle size={14} className="inline mr-1" />
                Mos kelganlar ({match.matched.length})
              </span>
            }
            size="small"
            className="!mb-3"
          >
            <Table
              dataSource={filterData(match.matched)}
              columns={getMatchedColumns(type)}
              rowKey="dbId"
              size="small"
              pagination={{ pageSize: 8, size: "small" }}
              scroll={{ x: true }}
            />
          </Card>
        )}

        {/* Unmatched table */}
        {match.unmatched.length > 0 && (
          <Card
            title={
              <span className="text-yellow-600 text-sm">
                <AlertTriangle size={14} className="inline mr-1" />
                Mos kelmadi ({match.unmatched.length})
              </span>
            }
            size="small"
            className="!mb-3"
          >
            <Table
              dataSource={filterData(match.unmatched)}
              columns={unmatchedColumns(type)}
              rowKey="dbId"
              size="small"
              pagination={{ pageSize: 8, size: "small" }}
              scroll={{ x: true }}
            />
          </Card>
        )}

        {/* Duplicates table */}
        {match.duplicates.length > 0 && (
          <Card
            title={
              <span className="text-red-600 text-sm">
                <Copy size={14} className="inline mr-1" />
                Dublikatlar ({match.duplicates.length})
              </span>
            }
            size="small"
            className="!mb-3"
          >
            <Table
              dataSource={match.duplicates}
              columns={duplicateColumns}
              rowKey="name"
              size="small"
              pagination={{ pageSize: 8, size: "small" }}
              scroll={{ x: true }}
            />
          </Card>
        )}

        {/* Missing in DB */}
        {match.missingSatoEntries.length > 0 && (
          <Card
            title={
              <span className="text-purple-600 text-sm">
                <Download size={14} className="inline mr-1" />
                SATO da bor, DB da yo'q ({match.missingSatoEntries.length})
              </span>
            }
            size="small"
          >
            <Table
              dataSource={match.missingSatoEntries}
              columns={missingColumns(type)}
              rowKey="satoCode"
              size="small"
              pagination={{ pageSize: 8, size: "small" }}
              scroll={{ x: true }}
            />
          </Card>
        )}
      </div>
    );
  };

  const tabItems = [
    {
      key: "districts",
      label: (
        <span className="text-sm">
          Tumanlar{" "}
          {districtMatch && (
            <Tag className="text-xs" color={districtMatch.stats.unmatchedCount > 0 ? "orange" : "green"}>
              {districtMatch.stats.matchedCount}/{districtMatch.stats.totalDb}
            </Tag>
          )}
        </span>
      ),
      children: renderContent(
        districtMatch,
        districtMatchLoading,
        "district",
        handleApplyDistrictSato,
        applyDistrictSatoCodes.isPending
      ),
    },
    {
      key: "regions",
      label: (
        <span className="text-sm">
          Viloyatlar{" "}
          {regionMatch && (
            <Tag className="text-xs" color={regionMatch.stats.unmatchedCount > 0 ? "orange" : "green"}>
              {regionMatch.stats.matchedCount}/{regionMatch.stats.totalDb}
            </Tag>
          )}
        </span>
      ),
      children: renderContent(
        regionMatch,
        regionMatchLoading,
        "region",
        handleApplyRegionSato,
        applyRegionSatoCodes.isPending
      ),
    },
  ];

  // Districts side panel
  const renderDistrictsPanel = () => (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="h-full overflow-auto">
        {/* Merge toolbar */}
        <div className="mb-3 flex items-center gap-2 flex-wrap sticky top-0 bg-white z-10 pb-2">
          {!mergeMode ? (
            <Button
              size="small"
              icon={<Merge size={14} />}
              onClick={() => setMergeMode(true)}
            >
              Birlashtirish
            </Button>
          ) : (
            <>
              <span className="text-xs text-gray-600">
                {selectedForMerge.length} ta tanlangan
              </span>
              <Button
                type="primary"
                size="small"
                icon={<Check size={14} />}
                onClick={handleMergeConfirm}
                disabled={selectedForMerge.length < 2}
              >
                OK
              </Button>
              <Button size="small" icon={<X size={14} />} onClick={cancelMergeMode}>
                Bekor
              </Button>
            </>
          )}
        </div>

        <div className="space-y-3">
          {regionsLoading ? (
            <div className="flex items-center justify-center h-32">
              <RefreshCw className="animate-spin" />
            </div>
          ) : (
            regions.map((region) => (
              <Card
                key={region.id}
                size="small"
                title={
                  <div className="flex justify-between items-center">
                    {editingRegionNameId === region.id ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          handleRegionNameSubmit(region.id);
                        }}
                        className="flex items-center gap-1"
                      >
                        <input
                          value={editingRegionName}
                          onChange={(e) => setEditingRegionName(e.target.value)}
                          className="border rounded px-1 py-0.5 text-xs w-24"
                          autoFocus
                        />
                        <Button
                          size="small"
                          type="primary"
                          htmlType="submit"
                          className="!w-5 !h-5 !p-0 !min-w-0"
                        >
                          <Check size={10} />
                        </Button>
                        <Button
                          size="small"
                          onClick={() => {
                            setEditingRegionNameId(null);
                            setEditingRegionName("");
                          }}
                          className="!w-5 !h-5 !p-0 !min-w-0"
                        >
                          <X size={10} />
                        </Button>
                      </form>
                    ) : (
                      <Tooltip title={region.name}>
                        <span
                          className={`text-sm font-medium ${isSuperadmin ? 'cursor-pointer hover:text-blue-600' : ''}`}
                          onClick={() => {
                            // Faqat superadmin edit qila oladi
                            if (isSuperadmin) {
                              setEditingRegionNameId(region.id);
                              setEditingRegionName(region.name);
                            }
                          }}
                        >
                          {region.name.length > 12
                            ? region.name.split(" ")[0]
                            : region.name}
                        </span>
                      </Tooltip>
                    )}
                    {/* Faqat superadmin uchun boshqarish tugmalari */}
                    {isSuperadmin && (
                    <div className="flex gap-1">
                      <Button
                        size="small"
                        className="!w-6 !h-6 !p-0 !min-w-0"
                        onClick={() => setOpenRegionId(region.id)}
                      >
                        <Plus size={12} />
                      </Button>
                      <Button
                        size="small"
                        className="!w-6 !h-6 !p-0 !min-w-0"
                        onClick={() =>
                          setEditRegionId(
                            editRegionId === region.id ? null : region.id
                          )
                        }
                      >
                        <Pencil size={12} />
                      </Button>
                    </div>
                    )}
                  </div>
                }
                className="shadow-sm"
              >
                <Droppable droppableId={region.id}>
                  {(provided) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className="flex flex-wrap gap-1 min-h-[30px]"
                    >
                      {region.assignedDistricts.map((district, index) => {
                        const isSelectedForMerge = selectedForMerge.some(
                          (d) => d.id === district.id
                        );

                        return (
                          <Draggable
                            key={district.id}
                            draggableId={district.id}
                            index={index}
                            isDragDisabled={mergeMode}
                          >
                            {(dragProvided) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...dragProvided.dragHandleProps}
                                style={dragProvided.draggableProps.style}
                                onClick={() => {
                                  if (mergeMode) {
                                    toggleMergeSelection({
                                      id: district.id,
                                      name: district.name,
                                      regionId: region.id,
                                    });
                                  } else if (isSuperadmin && editDistrictId !== district.id) {
                                    // Tuman ustiga bosganda avtomatik edit modega o'tish (faqat superadmin)
                                    setEditDistrictId(district.id);
                                    setEditDistrictName(district.name);
                                  }
                                }}
                                className={`px-2 py-0.5 text-xs rounded cursor-pointer select-none transition-colors
                                  ${
                                    mergeMode && isSelectedForMerge
                                      ? "bg-orange-500 text-white ring-1 ring-orange-600"
                                      : highlightedDistrict === district.id
                                      ? "bg-[#8B69FE] text-white"
                                      : mergeMode
                                      ? "bg-gray-100 hover:bg-orange-100"
                                      : "bg-blue-100 text-blue-800 hover:bg-blue-200"
                                  }`}
                              >
                                <div className="flex items-center gap-1">
                                  {editDistrictId === district.id ? (
                                    <form
                                      onSubmit={(e) => {
                                        e.preventDefault();
                                        handleDistrictSubmit();
                                      }}
                                    >
                                      <input
                                        value={editDistrictName}
                                        onChange={(e) =>
                                          setEditDistrictName(e.target.value)
                                        }
                                        type="text"
                                        className="outline-none bg-transparent w-16 text-xs"
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                    </form>
                                  ) : (
                                    <span
                                      onClick={(e) => {
                                        // Superadmin bo'lsa va editRegionId bo'lsa - edit modega o'tish
                                        if (!mergeMode && editRegionId && isSuperadmin) {
                                          e.stopPropagation();
                                          setEditDistrictId(district.id);
                                          setEditDistrictName(district.name);
                                        }
                                      }}
                                    >
                                      {district.name}
                                    </span>
                                  )}

                                  {/* Faqat superadmin uchun edit icon - delete olib tashlandi */}
                                  {editRegionId === region.id && !mergeMode && isSuperadmin && (
                                    <div className="flex gap-0.5 ml-1">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setEditDistrictId(district.id);
                                          setEditDistrictName(district.name);
                                        }}
                                        className="hover:text-blue-600"
                                      >
                                        <Pencil size={10} />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </Card>
            ))
          )}
        </div>
      </div>
    </DragDropContext>
  );

  return (
    <div className="flex h-[calc(100vh-120px)]">
      {/* Left panel - SATO management */}
      <div className={`flex-1 p-4 overflow-auto transition-all duration-300 ${sidePanelOpen ? 'mr-0' : ''}`}>
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-800 mb-1">
            SATO kodlarini boshqarish
          </h1>
          <p className="text-gray-500 text-sm">
            Viloyat va tumanlarning SATO kodlarini avtomatik yoki qo'lda qo'shish
          </p>
        </div>

        {/* Search */}
        <div className="mb-3">
          <Input
            prefix={<Search size={14} className="text-gray-400" />}
            placeholder="Qidirish..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="max-w-xs"
            allowClear
            size="small"
          />
        </div>

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          size="small"
        />
      </div>

      {/* Toggle button */}
      <button
        onClick={() => setSidePanelOpen(!sidePanelOpen)}
        className="w-6 bg-gray-100 hover:bg-gray-200 flex items-center justify-center border-l border-gray-200 transition-colors"
      >
        {sidePanelOpen ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      {/* Right panel - Districts management */}
      {sidePanelOpen && (
        <div className="w-[400px] border-l border-gray-200 p-4 bg-gray-50 overflow-hidden flex flex-col">
          <h2 className="text-lg font-bold text-gray-800 mb-3">
            Tumanlarni boshqarish
          </h2>
          <div className="flex-1 overflow-auto">
            {renderDistrictsPanel()}
          </div>
        </div>
      )}

      {/* Add district modal */}
      <Modal
        title={`${regions.find((r) => r.id === openRegionId)?.name}`}
        open={!!openRegionId}
        onCancel={() => setOpenRegionId(null)}
        onOk={() => handleAddDistrict()}
        okText="Qo'shish"
        cancelText="Bekor qilish"
        centered
      >
        <input
          value={newDistrict}
          onChange={(e) => setNewDistict(e.target.value)}
          type="text"
          placeholder="Tuman nomini kiriting"
          className="border rounded-md px-2 py-2 w-full"
        />
      </Modal>

      {/* Merge modal */}
      <Modal
        title="Tumanlarni birlashtirish"
        open={mergeModalOpen}
        onCancel={() => {
          setMergeModalOpen(false);
          setMergeTargetId(null);
        }}
        onOk={executeMerge}
        okText="Birlashtirish"
        cancelText="Bekor qilish"
        confirmLoading={mergeDistricts.isPending}
        centered
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Tanlangan tumanlar:{" "}
            <strong>{selectedForMerge.map((d) => d.name).join(", ")}</strong>
          </p>
          <p className="text-gray-600">
            Qaysi tumanga birlashtirmoqchisiz?
          </p>
          <div className="flex flex-wrap gap-2">
            {selectedForMerge.map((district) => (
              <button
                key={district.id}
                onClick={() => setMergeTargetId(district.id)}
                className={`px-4 py-2 rounded-lg border transition-colors ${
                  mergeTargetId === district.id
                    ? "bg-green-500 text-white border-green-600"
                    : "bg-gray-100 hover:bg-gray-200 border-gray-300"
                }`}
              >
                {district.name}
              </button>
            ))}
          </div>
          {mergeTargetId && (
            <p className="text-sm text-green-600">
              <strong>
                {selectedForMerge.find((d) => d.id === mergeTargetId)?.name}
              </strong>{" "}
              tumani saqlanadi.
            </p>
          )}
        </div>
      </Modal>

      {/* SATO Edit Modal */}
      <Modal
        title={`SATO kod qo'shish: ${editingItem?.name || ""}`}
        open={editModalOpen}
        onCancel={() => {
          setEditModalOpen(false);
          setEditingItem(null);
          setNewSatoCode("");
        }}
        onOk={handleSaveSatoCode}
        okText="Saqlash"
        cancelText="Bekor qilish"
        okButtonProps={{
          disabled: !newSatoCode || !/^\d+$/.test(newSatoCode),
          loading:
            updateRegionSatoCode.isPending || updateDistrictSatoCode.isPending,
        }}
      >
        <div className="py-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            SATO kod (faqat raqamlar)
          </label>
          <Input
            value={newSatoCode}
            onChange={(e) => setNewSatoCode(e.target.value)}
            placeholder="Masalan: 1726201"
            className="font-mono"
            maxLength={10}
          />
          {newSatoCode && !/^\d+$/.test(newSatoCode) && (
            <p className="text-red-500 text-sm mt-1">
              Faqat raqamlar kiriting
            </p>
          )}
        </div>
      </Modal>

      {/* Name Edit Modal */}
      <Modal
        title={`Nomni o'zgartirish: ${editingNameItem?.name || ""}`}
        open={nameModalOpen}
        onCancel={() => {
          setNameModalOpen(false);
          setEditingNameItem(null);
          setNewName("");
        }}
        onOk={handleSaveName}
        okText="Saqlash"
        cancelText="Bekor qilish"
        okButtonProps={{
          disabled: !newName.trim() || newName === editingNameItem?.name,
          loading: updateRegionName.isPending || updateDistrictName.isPending,
        }}
      >
        <div className="py-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {editingNameItem?.type === "region" ? "Viloyat" : "Tuman"} nomi
          </label>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Yangi nom kiriting"
          />
        </div>
      </Modal>
    </div>
  );
};

export default memo(SatoManagement);
