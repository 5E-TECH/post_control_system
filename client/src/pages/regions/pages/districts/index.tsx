import { memo, useEffect, useState } from "react";
import { Button, Card, Modal } from "antd";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { useRegion } from "../../../../shared/api/hooks/useRegion/useRegion";
import { useDistrict } from "../../../../shared/api/hooks/useDistrict";
import { Pencil, Plus } from "lucide-react";

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
  const { getRegions } = useRegion();
  const { updateDistrict, createDistrict, updateDistrictName } = useDistrict();
  const { data: apiResponse, refetch, isLoading } = getRegions();
  const [openRegionId, setOpenRegionId] = useState<string | null>(null);
  const [newDistrict, setNewDistict] = useState<string>("");
  const [editRegionId, setEditRegionId] = useState<string | null>(null);
  const [editDistrictId, setEditDistrictId] = useState<string | null>(null);
  const [editDistrictName, setEditDistrictName] = useState<string>("");

  const handleAddDistrict = () => {
    const data = {
      region_id: openRegionId,
      name: newDistrict,
    };
    createDistrict.mutate(data, {
      onSuccess: () => {
        refetch();
      },
    });

    setOpenRegionId(null);
    setNewDistict("");
  };

  const [regions, setRegions] = useState<RegionType[]>([]);

  // 🔹 API dan data kelganda state ni yangilash
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
          onSuccess: (data) => console.log("✅ Update success:", data),
          onError: (err) => console.error("❌ Update error:", err),
        }
      );

      return updated;
    });
  };

  const handleSubmit = () => {
    const id = editDistrictId
    const data = {
      name: editDistrictName
    }
    updateDistrictName.mutate({id, data}, {
      onSuccess:() => {
        refetch()
      }
    })
    console.log(editDistrictName);
    setEditDistrictId(null)

  };

  if (isLoading) return <div className="p-5">Loading...</div>;

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex flex-wrap  items-start gap-5 p-5 ">
        {regions.map((region) => (
          <Card
            key={region.id}
            title={
              <div className="flex justify-between items-center">
                <span>{region.name}</span>
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
                    <Pencil />
                  </Button>
                </div>
              </div>
            }
            className="w-[300px]  flex-shrink-0 shadow-md"
            style={{ height: "auto" }}
          >
            <Droppable droppableId={region.id}>
              {(provided) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className="flex flex-wrap gap-2 p-2 min-h-[40px]"
                >
                  {region.assignedDistricts.map((district, index) => (
                    <Draggable
                      key={district.id}
                      draggableId={district.id}
                      index={index}
                    >
                      {(dragProvided) => (
                        <div
                          ref={dragProvided.innerRef}
                          {...dragProvided.draggableProps}
                          {...dragProvided.dragHandleProps}
                          style={dragProvided.draggableProps.style}
                          className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-lg cursor-pointer select-none hover:bg-blue-200 active:cursor-grabbing transition"
                        >
                          {
                            <div
                              onClick={() => {
                                if (editRegionId) {
                                  setEditDistrictId(district.id);
                                  setEditDistrictName(district.name);
                                }
                              }}
                              className="relative"
                            >
                              {editDistrictId &&
                              editDistrictId === district.id ? (
                                <form
                                  onSubmit={(e) => {
                                    e.preventDefault(); // sahifa yangilanmasligi uchun
                                    handleSubmit(); // bu yerda o‘zingizning funksiyangiz chaqiriladi
                                  }}
                                >
                                  <input
                                    value={editDistrictName}
                                    onChange={(e) =>
                                      setEditDistrictName(e.target.value)
                                    }
                                    type="text"
                                    className="outline-none"
                                  />
                                </form>
                              ) : (
                                district.name
                              )}
                              {editRegionId && editRegionId === region.id && (
                                <button
                                  onClick={() => {
                                    setEditDistrictId(district.id),
                                      setEditDistrictName(district.name);
                                  }}
                                  className="absolute top-[-10px] right-[-18px] rotate-270 cursor-pointer"
                                >
                                  <Pencil size={15} />
                                </button>
                              )}
                            </div>
                          }
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </Card>
        ))}
        <Modal
          title={`${regions.find((r) => r.id === openRegionId)?.name}`}
          open={!!openRegionId}
          onCancel={() => setOpenRegionId(null)}
          onOk={() => handleAddDistrict()}
          okText="Add"
          centered
        >
          <input
            value={newDistrict}
            onChange={(e) => setNewDistict(e.target.value)}
            type="text"
            placeholder="Tuman nomini kiriting"
            className="border rounded-md px-2 py-2"
          />
        </Modal>
      </div>
    </DragDropContext>
  );
};

export default memo(Districts);
