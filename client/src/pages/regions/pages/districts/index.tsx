import { memo, useState } from "react";
import { Table, Card } from "antd";
import {
  DragDropContext,
  Droppable,
  Draggable,
  type
  DropResult,
} from "@hello-pangea/dnd";
import { useRegion } from "../../../../shared/api/hooks/useRegion/useRegion";

interface RowType {
  id: string;
  name: string;
  age: number;
}
const Districts = () => {

  const {getRegions} = useRegion()
  const {data} = getRegions()
  console.log(data);
  
  const [leftData, setLeftData] = useState<RowType[]>([
    { id: "1", name: "Ali", age: 22 },
    { id: "2", name: "Vali", age: 25 },
    { id: "3", name: "Sami", age: 30 },
  ]);

  const [rightData, setRightData] = useState<RowType[]>([
    { id: "4", name: "Nodir", age: 28 },
  ]);

  const columns = [
    { title: "Name", dataIndex: "name" },
    { title: "Age", dataIndex: "age" },
  ];

  // drag tugaganda
  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId) return;

    let draggedItem: RowType | undefined;

    // Source table
    if (source.droppableId === "left") {
      draggedItem = leftData.find((row) => row.id === draggableId);
      setLeftData((prev) => prev.filter((row) => row.id !== draggableId));
    } else {
      draggedItem = rightData.find((row) => row.id === draggableId);
      setRightData((prev) => prev.filter((row) => row.id !== draggableId));
    }

    if (!draggedItem) return;

    // Destination table
    if (destination.droppableId === "left") {
      setLeftData((prev) => [...prev, draggedItem!]);
    } else {
      setRightData((prev) => [...prev, draggedItem!]);
    }
  };

  // Reusable table droppable
  const RenderTable = ({
    droppableId,
    data,
  }: {
    droppableId: string;
    data: RowType[];
  }) => (
    <Droppable droppableId={droppableId}>
      {(provided) => (
        <div ref={provided.innerRef} {...provided.droppableProps}>
          <Table
            dataSource={data}
            columns={columns}
            pagination={false}
            rowKey="id"
            components={{
              body: {
                row: ({ children, ...restProps }: any) => {
                  const id = restProps["data-row-key"];
                  const rowIndex = data.findIndex((d) => d.id === id);
                  return (
                    <Draggable
                      draggableId={data[rowIndex].id}
                      index={rowIndex}
                      key={data[rowIndex].id}
                    >
                      {(dragProvided) => (
                        <tr
                          ref={dragProvided.innerRef}
                          {...dragProvided.draggableProps}
                          {...dragProvided.dragHandleProps}
                        >
                          {children}
                        </tr>
                      )}
                    </Draggable>
                  );
                },
              },
            }}
          />
          {provided.placeholder}
        </div>
      )}
    </Droppable>
  );

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="flex gap-5 justify-evenly px-5 pt-5">
        <Card title="Table A" style={{ flex: 1 }}>
          <RenderTable droppableId="left" data={leftData} />
        </Card>
        <Card title="Table B" style={{ flex: 1 }}>
          <RenderTable droppableId="right" data={rightData} />
        </Card>
      </div>
    </DragDropContext>
  );
};

export default memo(Districts);