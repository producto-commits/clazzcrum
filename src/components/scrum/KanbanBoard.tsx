"use client";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { useState } from "react";
import { STORY_COLUMNS, storyCompliance, COMPLIANCE_META, type Story, type StoryStatus } from "@/lib/scrumTypes";
import { PRIORITY_CLASSES, PRIORITY_LABELS } from "@/components/ui/Inputs";

const PRIORITY_RAIL: Record<string, string> = {
  LOW: "#8a8296",
  MEDIUM: "var(--info)",
  HIGH: "var(--warning)",
  CRITICAL: "var(--danger)",
};

function Card({ story, onClick }: { story: Story; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{ borderLeftColor: PRIORITY_RAIL[story.priority], borderLeftWidth: 3 }}
      className="rounded-lg border border-border bg-surface-2 p-2.5 shadow-[var(--shadow-sm)] transition hover:border-brand/40 hover:shadow-[var(--shadow-md)]"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <span className="text-sm font-medium leading-snug">{story.title}</span>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${PRIORITY_CLASSES[story.priority]}`}
        >
          {PRIORITY_LABELS[story.priority]}
        </span>
      </div>
      {story.epic && (
        <div className="mb-2 truncate text-[11px] text-muted">📦 {story.epic.title}</div>
      )}
      {story.tags.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {story.tags.map((tg) => (
            <span key={tg} className="rounded bg-brand/10 px-1.5 py-0.5 text-[10px] text-brand">
              {tg}
            </span>
          ))}
        </div>
      )}
      {(() => {
        const c = storyCompliance(story.status, story.estimatedEnd, story.actualEnd);
        if (c === "overdue" || c === "late" || c === "due_soon") {
          return (
            <div className="mb-2">
              <span className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium ${COMPLIANCE_META[c].cls}`}>
                {(c === "overdue" || c === "late") && "⚠ "}
                {COMPLIANCE_META[c].label}
              </span>
            </div>
          );
        }
        return null;
      })()}
      <div className="flex items-center gap-2 text-[11px] text-muted">
        {story.estimateHours != null && (
          <span className="rounded bg-surface px-1.5 py-0.5 font-medium">{story.estimateHours}h</span>
        )}
        {story._count.acceptanceCriteria > 0 && <span>✓ {story._count.acceptanceCriteria}</span>}
        {story._count.tasks > 0 && <span>☑ {story._count.tasks}</span>}
        {story._count.comments > 0 && <span>💬 {story._count.comments}</span>}
        <div className="ml-auto flex -space-x-1">
          {story.assignees.slice(0, 3).map((a) => (
            <span
              key={a.user.id}
              title={a.user.name}
              className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[9px] font-bold text-brand-fg ring-2 ring-background"
            >
              {a.user.name.charAt(0).toUpperCase()}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function DraggableCard({
  story,
  onClick,
  disabled,
}: {
  story: Story;
  onClick: () => void;
  disabled: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: story.id,
    disabled,
  });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`touch-none select-none ${disabled ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"} ${isDragging ? "opacity-40" : ""}`}
    >
      <Card story={story} onClick={onClick} />
    </div>
  );
}

function Column({
  status,
  label,
  stories,
  onCardClick,
  disabled,
}: {
  status: StoryStatus;
  label: string;
  stories: Story[];
  onCardClick: (s: Story) => void;
  disabled: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div className="flex w-60 shrink-0 flex-col">
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-[13px] font-semibold">{label}</span>
        <span className="rounded-full bg-surface px-1.5 py-0.5 text-[11px] text-muted">
          {stories.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex min-h-[100px] flex-1 flex-col gap-1.5 rounded-xl border p-1.5 transition ${
          isOver ? "border-brand bg-brand/5" : "border-border bg-surface/40"
        }`}
      >
        {stories.map((s) => (
          <DraggableCard key={s.id} story={s} onClick={() => onCardClick(s)} disabled={disabled} />
        ))}
        {stories.length === 0 && (
          <div className="py-6 text-center text-xs text-muted">— vacío —</div>
        )}
      </div>
    </div>
  );
}

export function KanbanBoard({
  stories,
  onMove,
  onCardClick,
  canEdit,
  visibleStatuses,
}: {
  stories: Story[];
  onMove: (storyId: string, status: StoryStatus) => void;
  onCardClick: (s: Story) => void;
  canEdit: boolean;
  visibleStatuses?: StoryStatus[];
}) {
  const columns = visibleStatuses && visibleStatuses.length
    ? STORY_COLUMNS.filter((c) => visibleStatuses.includes(c.key))
    : STORY_COLUMNS;
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const active = stories.find((s) => s.id === activeId) ?? null;

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }
  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const overId = e.over?.id as StoryStatus | undefined;
    if (!overId) return;
    const story = stories.find((s) => s.id === String(e.active.id));
    if (story && story.status !== overId) onMove(story.id, overId);
  }

  return (
    <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <div className={`flex gap-2.5 overflow-x-auto pb-4 ${activeId ? "select-none" : ""}`}>
        {columns.map((col) => (
          <Column
            key={col.key}
            status={col.key}
            label={col.label}
            stories={stories.filter((s) => s.status === col.key)}
            onCardClick={onCardClick}
            disabled={!canEdit}
          />
        ))}
      </div>
      <DragOverlay>{active ? <Card story={active} onClick={() => {}} /> : null}</DragOverlay>
    </DndContext>
  );
}
