import { memo, useEffect, useState } from "react";
import { Button, Card, Modal, message, Popconfirm, Tooltip } from "antd";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { useRegion } from "../../../../shared/api/hooks/useRegion/useRegion";
import { useDistrict } from "../../../../shared/api/hooks/useDistrict";
import { Pencil, Plus, Merge, Trash2, Check, X } from "lucide-react";
import { useSelector } from "react-redux";
import type { RootState } from "../../../../app/store";

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

const Districts = () => {
  const user = useSelector((state: RootState) => state.roleSlice);
  const isSuperAdmin = user.role === "superadmin";

  const { getRegions, updateRegionName } = useRegion();
  const {
    updateDistrict,
    createDistrict,
    updateDistrictName,
    mergeDistricts,
    deleteDistrict,
  } = useDistrict();
  const { data: apiResponse, refetch, isLoading } = getRegions();
  const [openRegionId, setOpenRegionId] = useState<string | null>(null);
  const [newDistrict, setNewDistict] = useState<string>("");
  const [editRegionId, setEditRegionId] = useState<string | null>(null);
  const [editDistrictId, setEditDistrictId] = useState<string | null>(null);
  const [editDistrictName, setEditDistrictName] = useState<string>("");
  const [highlightedDistrict, setHighlightedDistrict] = useState<string | null>(
    null
  );

  // Region name editing
  const [editingRegionNameId, setEditingRegionNameId] = useState<string | null>(
    null
  );
  const [editingRegionName, setEditingRegionName] = useState<string>("");

  // Merge state
  const [mergeMode, setMergeMode] = useState(false);
  const [selectedForMerge, setSelectedForMerge] = useState<
    { id: string; name: string; regionId: string }[]
  >([]);
  const [mergeTargetId, setMergeTargetId] = useState<string | null>(null);
  const [mergeModalOpen, setMergeModalOpen] = useState(false);

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
        refetch();

        setTimeout(() => setHighlightedDistrict(null), 1000);
      },
    });

    setTimeout(() => {
      setOpenRegionId(null);
      setEditDistrictId(null);
      setNewDistict("");
    }, 5000);
  };

  const [regions, setRegions] = useState<RegionType[]>([]);

  useEffect(() => {
    if (apiResponse?.data) {
      setRegions(apiResponse.data);
    }
  }, [apiResponse]);

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

  const handleSubmit = () => {
    const id = editDistrictId;
    const data = {
      name: editDistrictName,
    };
    updateDistrictName.mutate(
      { id, data },
      {
        onSuccess: () => {
          refetch();
          setHighlightedDistrict(id);
          setTimeout(() => setHighlightedDistrict(null), 1000);
        },
      }
    );
    setEditDistrictId(null);
  };

  // Region name update
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
          refetch();
          setEditingRegionNameId(null);
          setEditingRegionName("");
        },
        onError: () => {
          message.error("Xatolik yuz berdi");
        },
      }
    );
  };

  // Merge functions
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
          refetch();
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

  const handleDeleteDistrict = (id: string) => {
    deleteDistrict.mutate(id, {
      onSuccess: () => {
        message.success("Tuman o'chirildi");
        refetch();
      },
      onError: (err: any) => {
        message.error(
          err?.response?.data?.message || "Xatolik yuz berdi"
        );
      },
    });
  };

  const cancelMergeMode = () => {
    setMergeMode(false);
    setSelectedForMerge([]);
    setMergeTargetId(null);
  };

  if (isLoading) return <div className="p-5">Loading...</div>;

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="p-5">
        {/* Merge toolbar - faqat superadmin uchun */}
        {isSuperAdmin && (
          <div className="mb-4 flex items-center gap-3">
            {!mergeMode ? (
              <Button
                icon={<Merge size={16} />}
                onClick={() => setMergeMode(true)}
              >
                Tumanlarni birlashtirish
              </Button>
            ) : (
              <>
                <span className="text-gray-600 dark:text-gray-300">
                  Birlashtirish uchun tumanlarni tanlang ({selectedForMerge.length}{" "}
                  ta tanlangan)
                </span>
                <Button
                  type="primary"
                  icon={<Check size={16} />}
                  onClick={handleMergeConfirm}
                  disabled={selectedForMerge.length < 2}
                >
                  Birlashtirish
                </Button>
                <Button icon={<X size={16} />} onClick={cancelMergeMode}>
                  Bekor qilish
                </Button>
              </>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-start gap-5">
          {regions.map((region) => (
            <Card
              key={region.id}
              title={
                <div className="flex justify-between items-center">
                  {editingRegionNameId === region.id ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleRegionNameSubmit(region.id);
                      }}
                      className="flex items-center gap-2"
                    >
                      <input
                        value={editingRegionName}
                        onChange={(e) => setEditingRegionName(e.target.value)}
                        className="border rounded px-2 py-1 text-sm w-32"
                        autoFocus
                      />
                      <Button
                        size="small"
                        type="primary"
                        htmlType="submit"
                        className="flex items-center justify-center w-6 h-6 p-0"
                      >
                        <Check size={12} />
                      </Button>
                      <Button
                        size="small"
                        onClick={() => {
                          setEditingRegionNameId(null);
                          setEditingRegionName("");
                        }}
                        className="flex items-center justify-center w-6 h-6 p-0"
                      >
                        <X size={12} />
                      </Button>
                    </form>
                  ) : (
                    <Tooltip title={region.name}>
                      <span
                        className="cursor-pointer hover:text-blue-600"
                        onClick={() => {
                          setEditingRegionNameId(region.id);
                          setEditingRegionName(region.name);
                        }}
                      >
                        {region.name.length > 15
                          ? region.name.split(" ")[0]
                          : region.name}
                      </span>
                    </Tooltip>
                  )}
                  <div className="flex gap-2">
                    <Button
                      size="small"
                      className="flex items-center justify-center w-8 h-8 p-0"
                      onClick={() => setOpenRegionId(region.id)}
                    >
                      <Plus size={15} />
                    </Button>
                    <Button
                      size="small"
                      className="flex items-center justify-center w-8 h-8 p-0"
                      onClick={() =>
                        setEditRegionId(
                          editRegionId === region.id ? null : region.id
                        )
                      }
                    >
                      <Pencil size={15} />
                    </Button>
                  </div>
                </div>
              }
              className="w-[300px] flex-shrink-0 shadow-md"
              style={{ height: "auto" }}
            >
              <Droppable droppableId={region.id}>
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="flex flex-wrap gap-2 p-2 min-h-[40px]"
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
                                if (mergeMode && isSuperAdmin) {
                                  toggleMergeSelection({
                                    id: district.id,
                                    name: district.name,
                                    regionId: region.id,
                                  });
                                }
                              }}
                              className={`px-3 py-1 text-sm rounded-lg cursor-pointer select-none transition-colors duration-300
                                ${
                                  mergeMode && isSelectedForMerge
                                    ? "bg-orange-500 text-white ring-2 ring-orange-600"
                                    : highlightedDistrict === district.id
                                    ? "bg-[#8B69FE] text-white"
                                    : mergeMode
                                    ? "bg-gray-100 hover:bg-orange-100"
                                    : "bg-blue-100 text-blue-800 hover:bg-blue-200"
                                }`}
                            >
                              <div className="relative flex items-center gap-1">
                                {editDistrictId &&
                                editDistrictId === district.id ? (
                                  <form
                                    onSubmit={(e) => {
                                      e.preventDefault();
                                      handleSubmit();
                                    }}
                                  >
                                    <input
                                      value={editDistrictName}
                                      onChange={(e) =>
                                        setEditDistrictName(e.target.value)
                                      }
                                      type="text"
                                      className="outline-none bg-transparent w-24"
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                  </form>
                                ) : (
                                  <span
                                    onClick={(e) => {
                                      if (!mergeMode && editRegionId) {
                                        e.stopPropagation();
                                        setEditDistrictId(district.id);
                                        setEditDistrictName(district.name);
                                      }
                                    }}
                                  >
                                    {district.name}
                                  </span>
                                )}

                                {editRegionId === region.id && !mergeMode && (
                                  <div className="flex gap-1 ml-1">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditDistrictId(district.id);
                                        setEditDistrictName(district.name);
                                      }}
                                      className="hover:text-blue-600"
                                    >
                                      <Pencil size={12} />
                                    </button>
                                    <Popconfirm
                                      title="Tumanni o'chirish"
                                      description="Bu tumanni o'chirishni xohlaysizmi?"
                                      onConfirm={(e) => {
                                        e?.stopPropagation();
                                        handleDeleteDistrict(district.id);
                                      }}
                                      onCancel={(e) => e?.stopPropagation()}
                                      okText="Ha"
                                      cancelText="Yo'q"
                                    >
                                      <button
                                        onClick={(e) => e.stopPropagation()}
                                        className="hover:text-red-600"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </Popconfirm>
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
          ))}
        </div>

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

        {/* Merge modal - faqat superadmin uchun */}
        {isSuperAdmin && (
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
              Qaysi tumanga birlashtirmoqchisiz? (Boshqa tumanlar o'chiriladi,
              barcha buyurtmalar shu tumanga ko'chiriladi)
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
                tumani saqlanadi. Boshqa{" "}
                {selectedForMerge.filter((d) => d.id !== mergeTargetId).length}{" "}
                ta tuman o'chiriladi.
              </p>
            )}
          </div>
          </Modal>
        )}
      </div>
    </DragDropContext>
  );
};

export default memo(Districts);
