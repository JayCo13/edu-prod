"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  CreditCard,
  Grid3x3,
  Layout,
  Plus,
  Type,
} from "lucide-react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  ABOUT_CHAR_CAP,
  ACCENTS,
  MODULE_META,
  type AccentId,
  type ModuleId,
} from "../_constants";
import {
  ProfileLayoutSchema,
  type Module,
  type ProfileLayout,
} from "@/lib/profile-schema";
import { saveProfileDraft, publishProfile } from "@/_deprecated/actions/profile";
import {
  AboutExpanded,
  ContactExpanded,
  FeaturedExpanded,
  HeroExpanded,
} from "./ExpandedEditors";
import { ModuleRow } from "./ModuleRow";
import { PreviewPane } from "./PreviewPane";
import { ActionBar, type SaveState } from "./ActionBar";
import { AddModuleSheet } from "./AddModuleSheet";
import { Toast, type ToastKind } from "./Toast";
import { SortableModule } from "./_dnd";

const MOD_ICON: Record<ModuleId, React.ReactNode> = {
  hero: <Layout className="h-4 w-4" />,
  about: <Type className="h-4 w-4" />,
  featured: <Grid3x3 className="h-4 w-4" />,
  contact: <CreditCard className="h-4 w-4" />,
};

interface ProfileEditorProps {
  initialLayout: ProfileLayout;
  subdomain?: string;
}

function findIndexByType(layout: ProfileLayout, type: ModuleId): number {
  return layout.modules.findIndex((m) => m.type === type);
}

function defaultModuleFor(type: ModuleId): Module {
  switch (type) {
    case "hero":
      return {
        type: "hero",
        visible: true,
        variant: "split",
        content: {
          name: "Tên giáo viên",
          role: "Giáo viên",
          tagline: "",
          primaryCtaLabel: "Xem khóa học",
          primaryCtaHref: "#courses",
          secondaryCtaLabel: "Liên hệ",
          secondaryCtaHref: "#contact",
          experienceYears: "",
          location: "",
          achievement: "",
        },
      };
    case "about":
      return {
        type: "about",
        visible: true,
        content: { body: "", withQuote: false, quote: "" },
      };
    case "featured":
      return {
        type: "featured",
        visible: true,
        variant: "grid3",
        content: { courseIds: [] },
      };
    case "contact":
      return {
        type: "contact",
        visible: true,
        content: {
          email: "",
          socials: [
            { id: "fb", label: "Facebook", handle: "" },
            { id: "yt", label: "YouTube", handle: "" },
            { id: "tt", label: "TikTok", handle: "" },
          ],
          withCapture: true,
        },
      };
  }
}

export function ProfileEditor({
  initialLayout,
  subdomain = "cohuong",
}: ProfileEditorProps) {
  const [layout, setLayout] = useState<ProfileLayout>(initialLayout);
  const [expandedId, setExpandedId] = useState<ModuleId | null>("hero");
  const [showSheet, setShowSheet] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [errorText, setErrorText] = useState<string | undefined>(undefined);
  const [savedAt, setSavedAt] = useState<string | undefined>(undefined);
  const [toast, setToast] = useState<ToastKind | null>(null);
  const [draggingId, setDraggingId] = useState<ModuleId | null>(null);
  const [_, startTransition] = useTransition();

  // Drag activation distance keeps clicks (expand) distinct from drags (reorder).
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragStart = (event: DragStartEvent) => {
    setDraggingId(event.active.id as ModuleId);
    // Collapse any expanded editor so the drag ghost is a clean small row.
    setExpandedId(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggingId(null);
    if (!over || active.id === over.id) return;
    setLayout((l) => {
      const oldIdx = l.modules.findIndex((m) => m.type === active.id);
      const newIdx = l.modules.findIndex((m) => m.type === over.id);
      if (oldIdx < 0 || newIdx < 0) return l;
      return { ...l, modules: arrayMove(l.modules, oldIdx, newIdx) };
    });
    setSaveState("dirty");
  };

  // Apply CSS variables for the chosen accent so previews + chrome share it.
  useEffect(() => {
    const a = ACCENTS[layout.accent];
    document.documentElement.style.setProperty("--profile-accent", a.hex);
    document.documentElement.style.setProperty("--profile-accent-tint", a.tint);
  }, [layout.accent]);

  // Validation: walk modules, return human-readable error.
  const validation = useMemo(() => {
    const parse = ProfileLayoutSchema.safeParse(layout);
    if (parse.success) {
      const about = layout.modules.find((m) => m.type === "about");
      if (about && about.type === "about" && about.content.body.length > ABOUT_CHAR_CAP) {
        return `About vượt ${(about.content.body.length - ABOUT_CHAR_CAP).toLocaleString("vi-VN")} ký tự — rút gọn để tiếp tục lưu.`;
      }
      return null;
    }
    return parse.error.issues[0]?.message ?? "Layout không hợp lệ.";
  }, [layout]);

  useEffect(() => {
    if (validation) {
      setSaveState("error");
      setErrorText(validation);
    } else if (saveState === "error") {
      setSaveState("dirty");
      setErrorText(undefined);
    }
  }, [validation, saveState]);

  const updateModule = (idx: number, next: Module) => {
    setLayout((l) => {
      const modules = l.modules.map((m, i) => (i === idx ? next : m));
      return { ...l, modules };
    });
    if (saveState === "idle" || saveState === "saved") setSaveState("dirty");
  };

  const toggleHidden = (idx: number) => {
    setLayout((l) => {
      const modules = l.modules.map((m, i) =>
        i === idx ? { ...m, visible: !m.visible } : m,
      );
      return { ...l, modules };
    });
    setSaveState("dirty");
  };

  const removeModule = (idx: number) => {
    const m = layout.modules[idx];
    if (m.type === "hero") return; // required
    setLayout((l) => ({ ...l, modules: l.modules.filter((_, i) => i !== idx) }));
    setSaveState("dirty");
    if (expandedId && findIndexByType(layout, expandedId) === idx) setExpandedId(null);
  };

  const addModule = (id: ModuleId) => {
    if (findIndexByType(layout, id) >= 0) return;
    setLayout((l) => ({ ...l, modules: [...l.modules, defaultModuleFor(id)] }));
    setSaveState("dirty");
    setShowSheet(false);
    setExpandedId(id);
  };

  const setAccent = (accent: AccentId) => {
    setLayout((l) => ({ ...l, accent }));
    setSaveState("dirty");
  };

  const runSave = (kind: "draft" | "publish") => {
    if (validation) {
      setToast("error");
      window.setTimeout(() => setToast(null), 3500);
      return;
    }
    setSaveState("saving");
    setToast("saving");
    startTransition(async () => {
      const result = await (kind === "draft"
        ? saveProfileDraft(layout)
        : publishProfile(layout));
      if (result.success) {
        const at = new Date().toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
        });
        setSaveState("saved");
        setSavedAt(at);
        setToast("saved");
      } else {
        setSaveState("error");
        setErrorText(result.error);
        setToast("error");
      }
      window.setTimeout(() => setToast(null), 3500);
    });
  };

  const alreadyAdded = layout.modules.map((m) => m.type) as ModuleId[];

  return (
    <div className="relative flex h-[calc(100vh-4rem)] w-full overflow-hidden bg-white">
      {/* Left pane */}
      <aside className="flex h-full w-[420px] flex-col border-r border-slate-200 bg-slate-50">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <div>
            <p className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">
              / DASHBOARD / PROFILE
            </p>
            <h1 className="font-display mt-0.5 text-[18px] font-bold text-slate-900">
              Trang cá nhân
            </h1>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 font-mono text-[10.5px] text-slate-600">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {subdomain}
            <span className="text-slate-400">.ticoclass.com</span>
          </div>
        </header>

        {/* Accent palette */}
        <div className="border-b border-slate-200 bg-white px-5 py-3">
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400">
            Tông màu
          </p>
          <div className="mt-2 flex items-center gap-2">
            {(Object.keys(ACCENTS) as AccentId[]).map((id) => {
              const on = layout.accent === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setAccent(id)}
                  className={`h-7 w-7 rounded-full ring-2 transition-all ${
                    on ? "ring-slate-900 ring-offset-2" : "ring-transparent"
                  }`}
                  style={{ background: ACCENTS[id].hex }}
                  aria-label={ACCENTS[id].label}
                  title={ACCENTS[id].label}
                />
              );
            })}
          </div>
        </div>

        {/* Module list */}
        <div className="flex-1 space-y-2.5 overflow-y-auto px-4 py-4">
          <p className="px-1 pb-1 font-mono text-[10px] font-medium uppercase tracking-[0.16em] text-slate-400">
            Khối — kéo để sắp xếp
          </p>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={() => setDraggingId(null)}
          >
            <SortableContext
              items={layout.modules.map((m) => m.type)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2.5">
                {layout.modules.map((m, i) => {
                  const meta = MODULE_META[m.type];
                  const isExpanded = expandedId === m.type;
                  return (
                    <SortableModule key={m.type} id={m.type}>
                      {isExpanded && m.type === "hero" && (
                        <HeroExpanded
                          module={m}
                          onChange={(next) => updateModule(i, next)}
                          onCollapse={() => setExpandedId(null)}
                        />
                      )}
                      {isExpanded && m.type === "about" && (
                        <AboutExpanded
                          module={m}
                          onChange={(next) => updateModule(i, next)}
                          onCollapse={() => setExpandedId(null)}
                        />
                      )}
                      {isExpanded && m.type === "featured" && (
                        <FeaturedExpanded
                          module={m}
                          onChange={(next) => updateModule(i, next)}
                          onCollapse={() => setExpandedId(null)}
                        />
                      )}
                      {isExpanded && m.type === "contact" && (
                        <ContactExpanded
                          module={m}
                          onChange={(next) => updateModule(i, next)}
                          onCollapse={() => setExpandedId(null)}
                        />
                      )}
                      {!isExpanded && (
                        <ModuleRow
                          index={i + 1}
                          icon={MOD_ICON[m.type]}
                          title={meta.title}
                          sub={meta.sub}
                          hidden={!m.visible}
                          required={meta.required}
                          onClick={() => setExpandedId(m.type)}
                          onToggleVisible={() => toggleHidden(i)}
                          onDelete={() => removeModule(i)}
                        />
                      )}
                    </SortableModule>
                  );
                })}
              </div>
            </SortableContext>
            <DragOverlay
              dropAnimation={{
                duration: 180,
                easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)",
              }}
            >
              {draggingId
                ? (() => {
                    const i = layout.modules.findIndex((m) => m.type === draggingId);
                    if (i < 0) return null;
                    const m = layout.modules[i];
                    const meta = MODULE_META[m.type];
                    return (
                      <div className="rotate-[-1deg] cursor-grabbing">
                        <ModuleRow
                          index={i + 1}
                          icon={MOD_ICON[m.type]}
                          title={meta.title}
                          sub={meta.sub}
                          hidden={!m.visible}
                          required={meta.required}
                        />
                      </div>
                    );
                  })()
                : null}
            </DragOverlay>
          </DndContext>
          {alreadyAdded.length < 4 && (
            <button
              type="button"
              onClick={() => setShowSheet(true)}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3 font-mono text-[11.5px] font-semibold uppercase tracking-[0.14em] text-slate-700 hover:border-slate-400 hover:bg-slate-50"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.5} /> Thêm khối
            </button>
          )}
        </div>
      </aside>

      {/* Right pane */}
      <div className="flex flex-1 flex-col">
        <div className="flex-1 overflow-hidden">
          <PreviewPane layout={layout} subdomain={subdomain} />
        </div>
        <ActionBar
          state={saveState}
          moduleCount={layout.modules.filter((m) => m.visible).length}
          errorText={errorText}
          savedAt={savedAt}
          onSave={() => runSave("draft")}
          onPublish={() => runSave("publish")}
        />
      </div>

      {showSheet && (
        <AddModuleSheet
          alreadyAdded={alreadyAdded}
          onAdd={addModule}
          onClose={() => setShowSheet(false)}
        />
      )}
      {toast && <Toast kind={toast} />}
    </div>
  );
}
