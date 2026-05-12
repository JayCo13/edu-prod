"use client";

import { useState, useTransition, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Bold,
  Italic,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Undo,
  Redo,
  Link as LinkIcon,
  Unlink,
  Loader2,
  Save,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Minus,
} from "lucide-react";

import type { LessonRow } from "@/types/database";
import { updateLessonContent } from "@/app/actions/curriculum";

/**
 * TextEditor
 * ==========
 * Rich-text editor powered by TipTap for "text" type lessons.
 * Features: Bold, Italic, Strike, Headings, Lists, Blockquote, Links, Code.
 * Auto-saves content as HTML via updateLessonContent server action.
 */

interface TextEditorProps {
  lesson: LessonRow;
  courseId: string;
  onSaved?: (lesson: LessonRow) => void;
}

export default function TextEditor({
  lesson,
  courseId,
  onSaved,
}: TextEditorProps) {
  const [isSaving, startSaveTransition] = useTransition();

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-indigo-600 underline underline-offset-2 cursor-pointer",
        },
      }),
      Placeholder.configure({
        placeholder: "Bắt đầu viết nội dung bài học...",
      }),
    ],
    content: lesson.content || "",
    editorProps: {
      attributes: {
        class:
          "prose prose-sm sm:prose-base max-w-none focus:outline-none min-h-[300px] px-5 py-4 text-slate-900",
      },
    },
  });

  // ── Save Handler ────────────────────────────────────────────
  const handleSave = useCallback(() => {
    if (!editor) return;
    const html = editor.getHTML();

    startSaveTransition(async () => {
      const result = await updateLessonContent(lesson.id, courseId, {
        content: html,
      });
      if (result.success && result.data) {
        toast.success("Đã lưu nội dung bài học.");
        onSaved?.(result.data);
      } else {
        toast.error(result.error || "Không thể lưu nội dung.");
      }
    });
  }, [editor, lesson.id, courseId, onSaved]);

  // ── Link Handler ────────────────────────────────────────────
  const setLink = useCallback(() => {
    if (!editor) return;

    const previousUrl = editor.getAttributes("link").href;
    const url = window.prompt("Nhập URL:", previousUrl || "https://");

    if (url === null) return; // Cancelled
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }

    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url })
      .run();
  }, [editor]);

  if (!editor) return null;

  return (
    <div className="space-y-4">
      {/* ── Toolbar ──────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-0.5 rounded-xl border border-slate-200 bg-slate-50/50 p-1.5">
        {/* Text Formatting */}
        <ToolbarGroup>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBold().run()}
            isActive={editor.isActive("bold")}
            tooltip="In đậm"
          >
            <Bold className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleItalic().run()}
            isActive={editor.isActive("italic")}
            tooltip="In nghiêng"
          >
            <Italic className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleStrike().run()}
            isActive={editor.isActive("strike")}
            tooltip="Gạch ngang"
          >
            <Strikethrough className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleCode().run()}
            isActive={editor.isActive("code")}
            tooltip="Code"
          >
            <Code className="h-4 w-4" />
          </ToolbarButton>
        </ToolbarGroup>

        <ToolbarDivider />

        {/* Headings */}
        <ToolbarGroup>
          <ToolbarButton
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 1 }).run()
            }
            isActive={editor.isActive("heading", { level: 1 })}
            tooltip="Heading 1"
          >
            <Heading1 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 2 }).run()
            }
            isActive={editor.isActive("heading", { level: 2 })}
            tooltip="Heading 2"
          >
            <Heading2 className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() =>
              editor.chain().focus().toggleHeading({ level: 3 }).run()
            }
            isActive={editor.isActive("heading", { level: 3 })}
            tooltip="Heading 3"
          >
            <Heading3 className="h-4 w-4" />
          </ToolbarButton>
        </ToolbarGroup>

        <ToolbarDivider />

        {/* Lists & Quote */}
        <ToolbarGroup>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            isActive={editor.isActive("bulletList")}
            tooltip="Danh sách"
          >
            <List className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            isActive={editor.isActive("orderedList")}
            tooltip="Đánh số"
          >
            <ListOrdered className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            isActive={editor.isActive("blockquote")}
            tooltip="Trích dẫn"
          >
            <Quote className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            tooltip="Đường kẻ"
          >
            <Minus className="h-4 w-4" />
          </ToolbarButton>
        </ToolbarGroup>

        <ToolbarDivider />

        {/* Links */}
        <ToolbarGroup>
          <ToolbarButton
            onClick={setLink}
            isActive={editor.isActive("link")}
            tooltip="Chèn link"
          >
            <LinkIcon className="h-4 w-4" />
          </ToolbarButton>
          {editor.isActive("link") && (
            <ToolbarButton
              onClick={() => editor.chain().focus().unsetLink().run()}
              tooltip="Bỏ link"
            >
              <Unlink className="h-4 w-4" />
            </ToolbarButton>
          )}
        </ToolbarGroup>

        <ToolbarDivider />

        {/* Undo/Redo */}
        <ToolbarGroup>
          <ToolbarButton
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            tooltip="Hoàn tác"
          >
            <Undo className="h-4 w-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            tooltip="Làm lại"
          >
            <Redo className="h-4 w-4" />
          </ToolbarButton>
        </ToolbarGroup>
      </div>

      {/* ── Editor Area ─────────────────────────────────── */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm transition-all focus-within:border-indigo-300 focus-within:ring-2 focus-within:ring-indigo-100">
        <EditorContent editor={editor} />
      </div>

      {/* ── Save Button ─────────────────────────────────── */}
      <div className="flex justify-end">
        <motion.button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          whileTap={isSaving ? {} : { scale: 0.97 }}
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Đang lưu...
            </>
          ) : (
            <>
              <Save className="h-4 w-4" />
              Lưu nội dung
            </>
          )}
        </motion.button>
      </div>
    </div>
  );
}

// ── Toolbar Sub-Components ─────────────────────────────────────────────────

function ToolbarGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-0.5">{children}</div>;
}

function ToolbarDivider() {
  return <div className="mx-1 h-6 w-px bg-slate-200" />;
}

function ToolbarButton({
  children,
  onClick,
  isActive,
  disabled,
  tooltip,
}: {
  children: React.ReactNode;
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  tooltip?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={tooltip}
      className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm transition-colors
        ${isActive
          ? "bg-slate-900 text-white"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        }
        ${disabled ? "cursor-not-allowed opacity-40" : ""}
      `}
    >
      {children}
    </button>
  );
}
