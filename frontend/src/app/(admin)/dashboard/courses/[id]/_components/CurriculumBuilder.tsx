"use client";

import { useState, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Plus, Layers, BookOpen, GripVertical } from "lucide-react";

import type {
  ModuleWithLessons,
  LessonRow,
  ModuleRow,
  ReorderPayload,
} from "@/types/database";
import { reorderCurriculum } from "@/app/actions/curriculum";

import ModuleItem from "./ModuleItem";
import CreateModuleDialog from "./CreateModuleDialog";

/**
 * CurriculumBuilder
 * =================
 * Main orchestrator component for the drag-and-drop curriculum editor.
 *
 * Architecture:
 *   - Local state `modules` holds the full nested tree
 *   - DndContext at top level handles module reordering
 *   - Each ModuleItem has its own SortableContext for lesson reordering
 *   - Optimistic updates: state changes immediately, then persisted via server action
 *
 * Drag Strategy:
 *   - Modules: sortable at the top level
 *   - Lessons: sortable within their parent module (no cross-module drag for simplicity)
 */

interface CurriculumBuilderProps {
  courseId: string;
  initialModules: ModuleWithLessons[];
}

export default function CurriculumBuilder({
  courseId,
  initialModules,
}: CurriculumBuilderProps) {
  const [modules, setModules] = useState<ModuleWithLessons[]>(initialModules);
  const [createModuleOpen, setCreateModuleOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  // ── DnD Sensors ─────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px drag threshold to avoid accidental drags
      },
    }),
    useSensor(KeyboardSensor),
  );

  // ── Build ReorderPayload from current state ─────────────────
  const buildReorderPayload = useCallback(
    (newModules: ModuleWithLessons[]): ReorderPayload => {
      const moduleOrders = newModules.map((m, i) => ({
        id: m.id,
        order_index: i,
      }));

      const lessonOrders = newModules.flatMap((m) =>
        m.lessons.map((l, i) => ({
          id: l.id,
          module_id: m.id,
          order_index: i,
        })),
      );

      return { modules: moduleOrders, lessons: lessonOrders };
    },
    [],
  );

  // ── Persist reorder to DB ───────────────────────────────────
  const persistReorder = useCallback(
    async (newModules: ModuleWithLessons[]) => {
      const payload = buildReorderPayload(newModules);
      const result = await reorderCurriculum(courseId, payload);
      if (!result.success) {
        toast.error(result.error || "Không thể lưu thứ tự mới.");
      }
    },
    [courseId, buildReorderPayload],
  );

  // ── Drag Start ──────────────────────────────────────────────
  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  // ── Drag End (Module or Lesson) ─────────────────────────────
  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    // Check if this is a module drag
    const activeModuleIndex = modules.findIndex((m) => m.id === active.id);
    const overModuleIndex = modules.findIndex((m) => m.id === over.id);

    if (activeModuleIndex !== -1 && overModuleIndex !== -1) {
      // Module reorder
      const newModules = arrayMove(modules, activeModuleIndex, overModuleIndex);
      setModules(newModules); // Optimistic update
      persistReorder(newModules); // Persist to DB
      return;
    }

    // Check if this is a lesson drag (within the same module)
    for (let mi = 0; mi < modules.length; mi++) {
      const mod = modules[mi];
      const activeLessonIndex = mod.lessons.findIndex(
        (l) => l.id === active.id,
      );
      const overLessonIndex = mod.lessons.findIndex((l) => l.id === over.id);

      if (activeLessonIndex !== -1 && overLessonIndex !== -1) {
        // Lesson reorder within same module
        const newLessons = arrayMove(
          mod.lessons,
          activeLessonIndex,
          overLessonIndex,
        );
        const newModules = [...modules];
        newModules[mi] = { ...mod, lessons: newLessons };
        setModules(newModules); // Optimistic update
        persistReorder(newModules); // Persist to DB
        return;
      }
    }
  }

  // ── Module CRUD Callbacks ───────────────────────────────────

  const handleModuleCreated = useCallback((newModule: ModuleRow) => {
    setModules((prev) => [...prev, { ...newModule, lessons: [] }]);
  }, []);

  const handleDeleteModule = useCallback((moduleId: string) => {
    setModules((prev) => prev.filter((m) => m.id !== moduleId));
  }, []);

  const handleUpdateModule = useCallback((updated: ModuleWithLessons) => {
    setModules((prev) =>
      prev.map((m) => (m.id === updated.id ? updated : m)),
    );
  }, []);

  // ── Lesson CRUD Callbacks ───────────────────────────────────

  const handleLessonCreated = useCallback(
    (moduleId: string, lesson: LessonRow) => {
      setModules((prev) =>
        prev.map((m) =>
          m.id === moduleId
            ? { ...m, lessons: [...m.lessons, lesson] }
            : m,
        ),
      );
    },
    [],
  );

  const handleLessonDeleted = useCallback(
    (moduleId: string, lessonId: string) => {
      setModules((prev) =>
        prev.map((m) =>
          m.id === moduleId
            ? { ...m, lessons: m.lessons.filter((l) => l.id !== lessonId) }
            : m,
        ),
      );
    },
    [],
  );

  const handleLessonUpdated = useCallback(
    (moduleId: string, lesson: LessonRow) => {
      setModules((prev) =>
        prev.map((m) =>
          m.id === moduleId
            ? {
                ...m,
                lessons: m.lessons.map((l) =>
                  l.id === lesson.id ? lesson : l,
                ),
              }
            : m,
        ),
      );
    },
    [],
  );

  // ── Stats ───────────────────────────────────────────────────
  const totalLessons = modules.reduce((sum, m) => sum + m.lessons.length, 0);

  // ── Active drag overlay ─────────────────────────────────────
  const activeModule = modules.find((m) => m.id === activeId);

  return (
    <div>
      {/* ── Header ──────────────────────────────────────── */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Layers className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900">
              Khung chương trình
            </h2>
            <p className="text-sm text-slate-500">
              {modules.length} chương · {totalLessons} bài học
            </p>
          </div>
        </div>

        <motion.button
          type="button"
          onClick={() => setCreateModuleOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
        >
          <Plus className="h-4 w-4" />
          Thêm chương mới
        </motion.button>
      </div>

      {/* ── Module List (Drag & Drop) ───────────────────── */}
      {modules.length === 0 ? (
        <EmptyState onCreateClick={() => setCreateModuleOpen(true)} />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={modules.map((m) => m.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-4">
              {modules.map((module) => (
                <ModuleItem
                  key={module.id}
                  module={module}
                  courseId={courseId}
                  onDeleteModule={handleDeleteModule}
                  onUpdateModule={handleUpdateModule}
                  onLessonCreated={handleLessonCreated}
                  onLessonDeleted={handleLessonDeleted}
                  onLessonUpdated={handleLessonUpdated}
                />
              ))}
            </div>
          </SortableContext>

          {/* Drag Overlay — ghost preview of the module being dragged */}
          <DragOverlay>
            {activeModule ? (
              <div className="rounded-2xl border border-primary/20 bg-white/95 px-4 py-3 shadow-xl backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <GripVertical className="h-5 w-5 text-primary/50" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {activeModule.title}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {activeModule.lessons.length} bài học
                    </p>
                  </div>
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* ── Create Module Dialog ────────────────────────── */}
      <CreateModuleDialog
        open={createModuleOpen}
        onOpenChange={setCreateModuleOpen}
        courseId={courseId}
        onCreated={handleModuleCreated}
      />
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────

function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <motion.div
      className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-20"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" as const }}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
        <BookOpen className="h-6 w-6 text-slate-400" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-slate-900">
        Chưa có chương nào
      </h3>
      <p className="mt-1.5 max-w-sm text-center text-sm text-slate-500">
        Bắt đầu xây dựng khung chương trình bằng cách thêm chương đầu tiên. Sau
        đó, thêm bài học vào mỗi chương và kéo thả để sắp xếp.
      </p>
      <motion.button
        type="button"
        onClick={onCreateClick}
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
        whileTap={{ scale: 0.97 }}
      >
        <Plus className="h-4 w-4" />
        Thêm chương đầu tiên
      </motion.button>
    </motion.div>
  );
}
