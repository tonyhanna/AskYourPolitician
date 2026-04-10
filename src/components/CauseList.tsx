"use client";

import { useState, useEffect, useId, useRef } from "react";
import { editCause, deleteCause, reorderCauses } from "@/app/politiker/dashboard/actions";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPen, faTrash, faThumbsUp } from "@fortawesome/pro-duotone-svg-icons";
import { faGripDots } from "@fortawesome/pro-solid-svg-icons";
import { faChevronDown, faChevronUp } from "@fortawesome/free-solid-svg-icons";
import { generateSlug } from "@/lib/utils";
import { PointsEditor } from "@/components/PointsEditor";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DraggableAttributes,
} from "@dnd-kit/core";
import type { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Cause = {
  id: string;
  title: string;
  shortDescription: string;
  longDescription: string | null;
  videoUrl: string | null;
  points: string[];
  tagId: string;
  sortOrder: number;
  inUse: boolean;
};

export function CauseList({ causes: initialCauses }: { causes: Cause[] }) {
  const dndId = useId();
  const [causes, setCauses] = useState(initialCauses);
  const [reordering, setReordering] = useState(false);

  // Sync state when server re-renders with new props (e.g. after editing a cause)
  useEffect(() => {
    setCauses(initialCauses);
  }, [initialCauses]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = causes.findIndex((c) => c.id === active.id);
    const newIndex = causes.findIndex((c) => c.id === over.id);
    const newOrder = arrayMove(causes, oldIndex, newIndex);
    setCauses(newOrder);

    setReordering(true);
    try {
      await reorderCauses(newOrder.map((c) => c.id));
    } catch (e) {
      setCauses(initialCauses);
      alert(e instanceof Error ? e.message : "Kunne ikke gemme rækkefølge");
    } finally {
      setReordering(false);
    }
  }

  return (
    <DndContext id={dndId} sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={causes.map((c) => c.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-4">
          {reordering && (
            <p className="text-xs text-gray-500 animate-pulse">Gemmer rækkefølge...</p>
          )}
          {causes.map((cause, index) => (
            <SortableCauseItem key={cause.id} cause={cause} index={index} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableCauseItem({ cause, index }: { cause: Cause; index: number }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: cause.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <CauseItem cause={cause} index={index} dragAttributes={attributes} dragListeners={listeners} />
    </div>
  );
}

function CauseItem({
  cause,
  index,
  dragAttributes,
  dragListeners,
}: {
  cause: Cause;
  index: number;
  dragAttributes: DraggableAttributes;
  dragListeners: SyntheticListenerMap | undefined;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [deleteHover, setDeleteHover] = useState(false);
  const deleteTouchRef = useRef(false);
  const deleteBtnRef = useRef<HTMLButtonElement>(null);
  const deleteCanHover = useRef(false);
  const deleteFlippedRef = useRef(false);
  useEffect(() => { deleteCanHover.current = window.matchMedia("(hover: hover)").matches; }, []);
  useEffect(() => {
    if (!deleteArmed) return;
    const handler = (e: TouchEvent | MouseEvent) => {
      if (deleteBtnRef.current && !deleteBtnRef.current.contains(e.target as Node)) setDeleteArmed(false);
    };
    document.addEventListener("touchstart", handler, { capture: true });
    document.addEventListener("mousedown", handler, { capture: true });
    return () => {
      document.removeEventListener("touchstart", handler, { capture: true });
      document.removeEventListener("mousedown", handler, { capture: true });
    };
  }, [deleteArmed]);
  const [showPoints, setShowPoints] = useState(false);
  const [viewLongDesc, setViewLongDesc] = useState(false);
  const [showLongDesc, setShowLongDesc] = useState(!!cause.longDescription);
  const [tagIdValue, setTagIdValue] = useState(cause.tagId);
  const [points, setPoints] = useState<string[]>(cause.points);

  async function handleSave(formData: FormData) {
    setSaving(true);
    try {
      formData.set("causeId", cause.id);
      await editCause(formData);
      setEditing(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Der opstod en fejl");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteArmed(false);
    setDeleteHover(false);
    try {
      await deleteCause(cause.id);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Der opstod en fejl");
      setDeleting(false);
    }
  }

  if (editing) {
    return (
      <div className="rounded-lg p-4" style={{ backgroundColor: "var(--system-bg2, #FF0000)" }}>
        <form action={handleSave} className="space-y-3">
          <input
            type="hidden"
            name="points"
            value={points.length > 0 ? JSON.stringify(points) : ""}
          />

          <div>
            <label htmlFor={`title-${cause.id}`} className="block text-sm font-medium mb-1" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-text2, #FF0000)" }}>
              Overskrift
            </label>
            <input
              id={`title-${cause.id}`}
              name="title"
              type="text"
              maxLength={300}
              required
              defaultValue={cause.title}
              className="w-full rounded-lg px-3 py-2 text-sm" style={{ fontFamily: "var(--font-figtree)", backgroundColor: "var(--system-form-bg0, #FF0000)", color: "var(--system-form-text0, #FF0000)", border: "none", outline: "none" }}
            />
          </div>
          <div>
            <label htmlFor={`short-${cause.id}`} className="block text-sm font-medium mb-1" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-text2, #FF0000)" }}>
              Kort beskrivelse
            </label>
            <textarea
              id={`short-${cause.id}`}
              name="shortDescription"
              required
              rows={2}
              defaultValue={cause.shortDescription}
              className="w-full rounded-lg px-3 py-2 text-sm resize-none overflow-hidden"
              style={{ fontFamily: "var(--font-figtree)", backgroundColor: "var(--system-form-bg0, #FF0000)", color: "var(--system-form-text0, #FF0000)", border: "none", outline: "none" }}
              onInput={(e) => { const t = e.target as HTMLTextAreaElement; t.style.height = "auto"; t.style.height = t.scrollHeight + "px"; }}
              ref={(el) => { if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; } }}
            />
          </div>

          {showLongDesc ? (
            <div>
              <label htmlFor={`long-${cause.id}`} className="block text-sm font-medium mb-1" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-text2, #FF0000)" }}>
                Lang beskrivelse (valgfrit)
              </label>
              <textarea
                id={`long-${cause.id}`}
                name="longDescription"
                rows={3}
                defaultValue={cause.longDescription ?? ""}
                className="w-full rounded-lg px-3 py-2 text-sm resize-none overflow-hidden"
                style={{ fontFamily: "var(--font-figtree)", backgroundColor: "var(--system-form-bg0, #FF0000)", color: "var(--system-form-text0, #FF0000)", border: "none", outline: "none" }}
                onInput={(e) => { const t = e.target as HTMLTextAreaElement; t.style.height = "auto"; t.style.height = t.scrollHeight + "px"; }}
                ref={(el) => { if (el) { el.style.height = "auto"; el.style.height = el.scrollHeight + "px"; } }}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowLongDesc(true)}
              className="text-sm cursor-pointer hover:opacity-50 transition-opacity"
              style={{ fontFamily: "var(--font-figtree)", fontWeight: 500, color: "var(--system-success, #FF0000)" }}
            >
              + Tilføj lang beskrivelse
            </button>
          )}

          {/* Handlingspunkter */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-text2, #FF0000)" }}>Handlingspunkter</label>
            <PointsEditor points={cause.points} onChange={setPoints} />
          </div>
          <div>
            <label htmlFor={`video-${cause.id}`} className="block text-sm font-medium mb-1" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-text2, #FF0000)" }}>
              Video-URL (valgfrit)
            </label>
            <input
              id={`video-${cause.id}`}
              name="videoUrl"
              type="url"
              defaultValue={cause.videoUrl ?? ""}
              className="w-full rounded-lg px-3 py-2 text-sm" style={{ fontFamily: "var(--font-figtree)", backgroundColor: "var(--system-form-bg0, #FF0000)", color: "var(--system-form-text0, #FF0000)", border: "none", outline: "none" }}
            />
          </div>
          <div>
            <label htmlFor={`tag-${cause.id}`} className="block text-sm font-medium mb-1" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-text2, #FF0000)" }}>
              Tag titel
            </label>
            <input
              id={`tag-${cause.id}`}
              name="tagId"
              type="text"
              maxLength={100}
              required
              value={tagIdValue}
              onChange={(e) => setTagIdValue(e.target.value)}
              className="w-full rounded-lg px-3 py-2 text-sm" style={{ fontFamily: "var(--font-figtree)", backgroundColor: "var(--system-form-bg0, #FF0000)", color: "var(--system-form-text0, #FF0000)", border: "none", outline: "none" }}
            />
            <p className="text-xs mt-1" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-text2, #FF0000)" }}>
              URL-venlig version: {generateSlug(tagIdValue)}
            </p>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-sm cursor-pointer px-3 py-1.5 hover:opacity-50 transition-opacity"
              style={{ fontFamily: "var(--font-figtree)", fontWeight: 500, color: "var(--system-error, #FF0000)" }}
            >
              Annullér
            </button>
            <button
              type="submit"
              disabled={saving}
              className="group text-sm px-4 py-1.5 rounded-full disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
              style={{ fontFamily: "var(--font-figtree)", fontWeight: 500, backgroundColor: "var(--system-success, #FF0000)", color: "var(--system-success-contrast, #FF0000)" }}
            >
              <span className="group-hover:opacity-50 transition-opacity">{saving ? "Gemmer..." : "Gem ændringer"}</span>
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="rounded-lg p-4" style={{ backgroundColor: "var(--system-bg1, #FF0000)" }}>
      <div>
        <div className="flex items-center gap-2 mb-1">
          {/* Drag handle */}
          <button
            type="button"
            className="cursor-grab active:cursor-grabbing touch-none hover:opacity-50 transition-opacity"
            {...dragAttributes}
            {...dragListeners}
          >
            <FontAwesomeIcon icon={faGripDots} style={{ color: "var(--system-icon2, #FF0000)", fontSize: 16 }} />
          </button>
          <p className="font-semibold" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-text1, #FF0000)" }}>#{index + 1}</p>
        </div>
        <div className="flex-1" style={{ paddingLeft: 24 }}>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <p className="font-medium" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-text0, #FF0000)" }}>{cause.title}</p>
              <p className="text-sm mt-1" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-text1, #FF0000)" }}>
                {viewLongDesc && cause.longDescription ? cause.longDescription : cause.shortDescription}
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {cause.longDescription && (
                  <button
                    type="button"
                    onClick={() => setViewLongDesc(!viewLongDesc)}
                    className="text-xs px-2.5 py-1 rounded-full cursor-pointer hover:opacity-75 transition-opacity flex items-center gap-1.5"
                    style={{ fontFamily: "var(--font-figtree)", fontWeight: 500, backgroundColor: "var(--system-bg0, #FF0000)", color: "var(--system-text1, #FF0000)" }}
                  >
                    {viewLongDesc ? "- Kort beskrivelse" : "Lang beskrivelse +"}
                  </button>
                )}
                {cause.points.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowPoints(!showPoints)}
                    className="text-xs px-2.5 py-1 rounded-full cursor-pointer hover:opacity-75 transition-opacity flex items-center gap-1.5"
                    style={{ fontFamily: "var(--font-figtree)", fontWeight: 500, backgroundColor: "var(--system-bg0, #FF0000)", color: "var(--system-text1, #FF0000)" }}
                  >
                    <FontAwesomeIcon icon={showPoints ? faChevronUp : faChevronDown} style={{ color: "var(--system-icon1, #FF0000)", fontSize: 10 }} />
                    {showPoints ? `Hvad vi vil (${cause.points.length})` : `Hvad vi vil (${cause.points.length})`}
                  </button>
                )}
                {cause.videoUrl && (
                  <a
                    href={cause.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full hover:text-blue-800"
                  >
                    Se video
                  </a>
                )}
              </div>
              {showPoints && cause.points.length > 0 && (
                <ul className="mt-2 space-y-1 pl-4 list-disc" style={{ fontFamily: "var(--font-figtree)", color: "var(--system-text0, #FF0000)" }}>
                  {cause.points.map((point, i) => (
                    <li key={i} className="text-sm">{point}</li>
                  ))}
                </ul>
              )}
            </div>
            <span className="text-xs px-2.5 py-1 rounded-full whitespace-nowrap"
              style={{ backgroundColor: "var(--party-highlight-bg, #FF0000)", color: "var(--party-highlight-text, #FF0000)", fontFamily: "var(--font-figtree)", fontWeight: 500 }}>
              {cause.tagId}
            </span>
          </div>
          <div className="flex items-center justify-end" style={{ gap: 5, marginTop: 12 }}>
            <button
              onClick={() => setEditing(true)}
              className="group cursor-pointer rounded-full flex items-center justify-center flex-shrink-0"
              style={{ height: 40, width: 40, backgroundColor: "var(--system-bg0, #FF0000)" }}
              aria-label="Redigér"
            >
              <FontAwesomeIcon icon={faPen} className="group-hover:opacity-50 transition-opacity" style={{ color: "var(--system-icon0, #FF0000)", fontSize: 16 }} />
            </button>
            {!cause.inUse && (
              <div className="relative">
                <button
                  ref={deleteBtnRef}
                  onPointerDown={(e) => { deleteTouchRef.current = e.pointerType === "touch"; }}
                  onClick={() => {
                    if (deleteTouchRef.current && !deleteArmed) {
                      if (deleteBtnRef.current) deleteFlippedRef.current = deleteBtnRef.current.getBoundingClientRect().top < 200;
                      setDeleteArmed(true);
                      return;
                    }
                    if (deleteArmed || deleteHover) handleDelete();
                  }}
                  disabled={deleting}
                  onPointerEnter={() => {
                    if (!deleteCanHover.current) return;
                    if (deleteBtnRef.current) deleteFlippedRef.current = deleteBtnRef.current.getBoundingClientRect().top < 200;
                    setDeleteHover(true);
                  }}
                  onPointerLeave={() => { if (deleteCanHover.current) setDeleteHover(false); }}
                  className="cursor-pointer rounded-full flex items-center justify-center flex-shrink-0 disabled:opacity-50"
                  style={{
                    height: 40, width: 40,
                    backgroundColor: (deleteArmed || deleteHover) ? "var(--system-error, #FF0000)" : "var(--system-bg0, #FF0000)",
                  }}
                  aria-label={(deleteArmed || deleteHover) ? "Bekræft slet" : "Slet"}
                >
                  <FontAwesomeIcon
                    icon={(deleteArmed || deleteHover) ? faThumbsUp : faTrash}
                    swapOpacity={(deleteArmed || deleteHover)}
                    style={{
                      color: (deleteArmed || deleteHover) ? "var(--system-error-contrast, #FF0000)" : "var(--system-error, #FF0000)",
                      fontSize: 16,
                    }}
                  />
                </button>
                {(deleteArmed || deleteHover) && (
                  <div
                    className={`absolute right-0 rounded-xl px-4 py-3 ${deleteFlippedRef.current ? "" : "bottom-full mb-2"}`}
                    style={{
                      ...(deleteFlippedRef.current ? { top: "100%", marginTop: 8 } : {}),
                      backgroundColor: "color-mix(in srgb, var(--system-error, #FF0000) 75%, transparent)",
                      backdropFilter: "blur(12px)",
                      WebkitBackdropFilter: "blur(12px)",
                      fontFamily: "var(--font-figtree)",
                      fontWeight: 500,
                      fontSize: 14,
                      color: "var(--system-error-contrast, #FF0000)",
                      whiteSpace: "nowrap",
                      zIndex: 30,
                      pointerEvents: "none",
                    }}
                  >
                    Er du sikker?
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
