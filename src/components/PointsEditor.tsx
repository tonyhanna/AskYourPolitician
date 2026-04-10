"use client";

import { useState, useId } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTrash } from "@fortawesome/pro-duotone-svg-icons";
import { faGripDots } from "@fortawesome/pro-solid-svg-icons";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type PointItem = { id: string; text: string };

function makeId() {
  return Math.random().toString(36).slice(2, 9);
}

export function PointsEditor({
  points,
  onChange,
}: {
  points: string[];
  onChange: (points: string[]) => void;
}) {
  const dndId = useId();
  const [items, setItems] = useState<PointItem[]>(
    points.length > 0 ? points.map((t) => ({ id: makeId(), text: t })) : [{ id: makeId(), text: "" }]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function sync(updated: PointItem[]) {
    setItems(updated);
    onChange(updated.map((i) => i.text).filter((t) => t.trim()));
  }

  function updateText(id: string, text: string) {
    sync(items.map((i) => (i.id === id ? { ...i, text } : i)));
  }

  function removeItem(id: string) {
    if (items.length <= 1) {
      sync([{ id: makeId(), text: "" }]);
      return;
    }
    sync(items.filter((i) => i.id !== id));
  }

  function addItem() {
    const updated = [...items, { id: makeId(), text: "" }];
    setItems(updated);
    onChange(updated.map((i) => i.text).filter((t) => t.trim()));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    sync(arrayMove(items, oldIndex, newIndex));
  }

  return (
    <div>
      <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {items.map((item) => (
              <SortablePoint
                key={item.id}
                item={item}
                onUpdate={updateText}
                onRemove={removeItem}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
      <button
        type="button"
        onClick={addItem}
        className="mt-2 text-sm cursor-pointer hover:opacity-50 transition-opacity"
        style={{ fontFamily: "var(--font-figtree)", fontWeight: 500, color: "var(--system-success, #FF0000)" }}
      >
        + Tilføj punkt
      </button>
    </div>
  );
}

function SortablePoint({
  item,
  onUpdate,
  onRemove,
}: {
  item: PointItem;
  onUpdate: (id: string, text: string) => void;
  onRemove: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2">
      <button
        type="button"
        className="cursor-grab active:cursor-grabbing touch-none hover:opacity-50 transition-opacity"
        {...attributes}
        {...listeners}
      >
        <FontAwesomeIcon icon={faGripDots} style={{ color: "var(--system-icon2, #FF0000)", fontSize: 12 }} />
      </button>
      <input
        type="text"
        value={item.text}
        onChange={(e) => onUpdate(item.id, e.target.value)}
        placeholder="Skriv et handlingspunkt..."
        className="flex-1 rounded-lg px-3 py-1.5 text-sm"
        style={{ fontFamily: "var(--font-figtree)", backgroundColor: "var(--system-form-bg0, #FF0000)", color: "var(--system-form-text0, #FF0000)", border: "none", outline: "none" }}
      />
      <button
        type="button"
        onClick={() => onRemove(item.id)}
        className="cursor-pointer hover:opacity-50 transition-opacity px-1"
        title="Fjern punkt"
      >
        <FontAwesomeIcon icon={faTrash} style={{ color: "var(--system-error, #FF0000)", fontSize: 12 }} />
      </button>
    </div>
  );
}
