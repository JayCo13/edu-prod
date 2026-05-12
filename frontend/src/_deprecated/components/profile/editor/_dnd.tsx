"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import type {
  DraggableAttributes,
  DraggableSyntheticListeners,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

interface DragHandleCtx {
  attributes: DraggableAttributes | null;
  listeners: DraggableSyntheticListeners | null;
  isDragging: boolean;
}

const DragHandleContext = createContext<DragHandleCtx>({
  attributes: null,
  listeners: null,
  isDragging: false,
});

export function useDragHandle(): DragHandleCtx {
  return useContext(DragHandleContext);
}

interface SortableModuleProps {
  id: string;
  children: ReactNode;
}

export function SortableModule({ id, children }: SortableModuleProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
    zIndex: isDragging ? 10 : "auto",
  };

  return (
    <div ref={setNodeRef} style={style}>
      <DragHandleContext.Provider
        value={{ attributes, listeners: listeners ?? null, isDragging }}
      >
        {children}
      </DragHandleContext.Provider>
    </div>
  );
}

interface DragHandleProps {
  className?: string;
  ariaLabel?: string;
}

/**
 * The actual drag activator — attaches listeners + attributes from the
 * surrounding SortableModule. If used outside a SortableModule, renders as a
 * plain (decorative) button so existing callers don't crash.
 */
export function DragHandle({
  className = "grid h-7 w-7 cursor-grab place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700",
  ariaLabel = "Kéo để sắp xếp",
}: DragHandleProps) {
  const { attributes, listeners } = useDragHandle();
  return (
    <button
      type="button"
      className={className}
      aria-label={ariaLabel}
      onClick={(e) => e.stopPropagation()}
      {...(attributes ?? {})}
      {...(listeners ?? {})}
    >
      <GripVertical className="h-4 w-4" />
    </button>
  );
}
