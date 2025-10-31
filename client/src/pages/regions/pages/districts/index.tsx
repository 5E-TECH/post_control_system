import { memo, useEffect, useState } from "react";
import { Card } from "antd";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { useRegion } from "../../../../shared/api/hooks/useRegion/useRegion";
import { useDistrict } from "../../../../shared/api/hooks/useDistrict";

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
  const { updateDistrict } = useDistrict();
  const { data: apiResponse, isLoading } = getRegions();

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

  if (isLoading) return <div className="p-5">Loading...</div>;

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex flex-wrap  items-start gap-5 p-5 ">
        {regions.map((region) => (
          <Card
            key={region.id}
            title={region.name}
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
                          {district.name}
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
      </div>
    </DragDropContext>
  );
};

export default memo(Districts);
