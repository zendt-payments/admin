import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Image as ImageIcon, ImagePlus, Plus, Trash2, X } from "lucide-react";
import type { ExperienceProjectApi } from "../../services/dataService";
import { dataService } from "../../services/dataService";
import { useAppToast } from "../../context/ToastContext";
import { MotionSheet } from "../motion";
import { dashboardDialogTitleClass } from "./DashboardTitles";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_IMAGES_PER_PROJECT = 10;

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

/** Plan pending file adds: size limit, slot limit, clear user-facing messages */
function planPendingFileAdds(prev: File[], incoming: File[]): { next: File[]; message: string | null } {
  const room = Math.max(0, MAX_IMAGES_PER_PROJECT - prev.length);
  const bad = incoming.filter((f) => f.size > MAX_IMAGE_BYTES);
  const valid = incoming.filter((f) => f.size <= MAX_IMAGE_BYTES);
  const toAdd = valid.slice(0, room);
  const validDropped = valid.length - toAdd.length;

  const parts: string[] = [];

  if (incoming.length > 0 && room === 0) {
    return {
      next: prev,
      message: `You already have ${MAX_IMAGES_PER_PROJECT} images. Remove one or more before adding new files.`,
    };
  }

  for (const f of bad) {
    parts.push(`“${f.name}” is ${formatFileSize(f.size)} — max 2 MB per image.`);
  }

  if (validDropped > 0) {
    parts.push(`${validDropped} image(s) not added — ${MAX_IMAGES_PER_PROJECT} images max per project.`);
  }

  if (incoming.length > 0 && toAdd.length === 0) {
    const headline =
      bad.length > 0 && valid.length === 0
        ? "No images were added — each file must be 2 MB or smaller (JPEG, PNG, or HEIC)."
        : "No images were added.";
    return {
      next: prev,
      message: parts.length > 0 ? `${headline} ${parts.join(" ")}` : headline,
    };
  }

  return {
    next: [...toAdd, ...prev],
    message: parts.length > 0 ? parts.join(" ") : null,
  };
}

function domainHref(domain: string) {
  const t = domain.trim();
  if (!t) return "";
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

function reorderArray<T>(arr: T[], fromIndex: number, toIndex: number): T[] {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= arr.length ||
    toIndex >= arr.length
  ) {
    return arr;
  }
  const next = [...arr];
  const [removed] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, removed);
  return next;
}

type NewProjectForm = {
  project_name: string;
  domain: string;
  description: string;
};

const emptyForm = (): NewProjectForm => ({
  project_name: "",
  domain: "",
  description: "",
});

type Props = {
  editable: boolean;
  projects: ExperienceProjectApi[];
  onRefresh: () => void | Promise<void>;
};

function validateFilesForSize(files: File[]): string | null {
  const bad = files.filter((f) => f.size > MAX_IMAGE_BYTES);
  if (bad.length === 0) return null;
  return bad.map((f) => `“${f.name}” is ${formatFileSize(f.size)} (max 2 MB)`).join("; ");
}

type EditImagesState = { keys: string[]; urls: string[] };

function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel,
  onClose,
  onConfirm,
  busy,
  danger,
}: {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onClose: () => void;
  onConfirm: () => void;
  busy: boolean;
  danger?: boolean;
}) {
  return (
    <MotionSheet
      open={isOpen}
      onClose={busy ? undefined : onClose}
      variant="center"
      dismissOnBackdrop={!busy}
    >
      <div className="p-6 space-y-5">
        <div className="space-y-2">
          <h3 className={dashboardDialogTitleClass}>{title}</h3>
          <p className="text-white/60 text-body">{message}</p>
        </div>
        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-[10px] border border-white/10 px-4 py-2 text-body text-white/70 hover:text-white hover:border-white/20 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={
              danger
                ? "rounded-[10px] bg-red-500/20 border border-red-500/30 px-4 py-2 text-body text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50"
                : "rounded-[10px] bg-white/15 px-4 py-2 text-body text-white hover:bg-white/25 disabled:opacity-50"
            }
          >
            {busy ? "Please wait…" : confirmLabel}
          </button>
        </div>
      </div>
    </MotionSheet>
  );
}

function ImagePreviewBody({ url }: { url: string }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    setBroken(false);
  }, [url]);
  if (broken) {
    return (
      <div className="flex max-h-[min(70vh,560px)] w-full flex-col items-center justify-center gap-3 rounded-lg border border-white/10 bg-white/5 px-6 py-10 text-center">
        <ImageIcon className="h-12 w-12 text-white/30" aria-hidden />
        <p className="text-body text-white/70">
          This browser can’t preview this format (e.g. some HEIC files).
        </p>
        <p className="text-caption text-white/45">
          The file is still saved if upload succeeded — open it on a device that supports the format.
        </p>
      </div>
    );
  }
  return (
    <img
      src={url}
      alt=""
      draggable={false}
      className="max-h-[min(70vh,560px)] w-full object-contain rounded-lg"
      onError={() => setBroken(true)}
    />
  );
}

function useObjectUrl(file: File | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return url;
}

/** One pending file column — blob URL created here (avoids fragile global revoke timing) */
function PendingImageColumn({
  file,
  index,
  n,
  busy,
  onPreview,
  onRemove,
  onMove,
}: {
  file: File;
  index: number;
  n: number;
  busy: boolean;
  onPreview: (url: string) => void;
  onRemove: () => void;
  onMove: (i: number, dir: -1 | 1) => void;
}) {
  const url = useObjectUrl(file);
  return (
    <div className="flex w-[96px] shrink-0 flex-col gap-1">
      <div className="relative h-[88px] w-full overflow-hidden rounded-lg bg-white/5 ring-1 ring-white/10">
        {url ? (
          <ExperienceThumb url={url} fileName={file.name} onOpen={() => onPreview(url)} />
        ) : (
          <div className="h-full w-full animate-pulse rounded-lg bg-white/10" aria-hidden />
        )}
        <button
          type="button"
          onClick={onRemove}
          disabled={busy}
          className="absolute top-1 right-1 z-[2] p-1 rounded bg-black/60 text-white"
          aria-label="Remove image"
        >
          <Trash2 size={12} />
        </button>
      </div>
      <div className="flex items-center justify-center gap-0.5">
        <button
          type="button"
          disabled={busy || index === 0}
          onClick={() => onMove(index, -1)}
          className="rounded p-0.5 text-white/50 hover:bg-white/10 hover:text-white disabled:opacity-25"
          aria-label="Move earlier"
        >
          <ChevronLeft size={16} strokeWidth={2} />
        </button>
        <button
          type="button"
          disabled={busy || index >= n - 1}
          onClick={() => onMove(index, 1)}
          className="rounded p-0.5 text-white/50 hover:bg-white/10 hover:text-white disabled:opacity-25"
          aria-label="Move later"
        >
          <ChevronRight size={16} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}

/** Local blob / server URL thumbnail — HEIC often fails to decode in Chrome */
function ExperienceThumb({ url, fileName, onOpen }: { url: string; fileName: string; onOpen: () => void }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    setBroken(false);
  }, [url]);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="block h-full w-full text-left"
      aria-label="Preview image"
    >
      {broken ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-white/5 px-1 py-2 text-center">
          <ImageIcon className="h-7 w-7 shrink-0 text-white/30" aria-hidden />
          <span className="line-clamp-2 w-full break-words text-caption leading-tight text-white/50">
            {fileName}
          </span>
          <span className="text-caption text-white/35">Preview unavailable</span>
        </div>
      ) : (
        <img
          src={url}
          alt=""
          draggable={false}
          className="h-full w-full object-cover"
          onError={() => setBroken(true)}
        />
      )}
    </button>
  );
}

/** Same shell as About business “read full description” modal */
function ImagePreviewModal({ url, onClose }: { url: string | null; onClose: () => void }) {
  useEffect(() => {
    if (!url) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [url, onClose]);

  if (!url) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="experience-image-preview-title"
        className="flex max-h-[min(85vh,640px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#1E1E1E] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
          <h4 id="experience-image-preview-title" className="text-callout font-medium text-white/95">
            Image preview
          </h4>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 flex items-center justify-center bg-black/10">
          <ImagePreviewBody key={url} url={url} />
        </div>
      </div>
    </div>,
    document.body
  );
}

const headerActionButtonClass =
  "inline-flex h-8 w-8 items-center justify-center text-white/60 hover:text-white transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30 rounded-lg disabled:opacity-40";

const addExperienceButtonClass =
  "inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-white/10 bg-white/10 px-3 text-caption text-white hover:bg-white/20 disabled:opacity-40 box-border shrink-0 whitespace-nowrap";

export default function ExperienceProjectsSection({ editable, projects, onRefresh }: Props) {
  const { showError } = useAppToast();
  const [showNewForm, setShowNewForm] = useState(false);
  const [newForm, setNewForm] = useState<NewProjectForm>(emptyForm);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  /** File-picker validation for new project (size / slot limits) — shown in a callout */
  const [pendingFileMessage, setPendingFileMessage] = useState<string | null>(null);
  const newFileRef = useRef<HTMLInputElement>(null);
  const editFileRef = useRef<HTMLInputElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ project_name: "", domain: "", description: "" });
  const [editImages, setEditImages] = useState<EditImagesState | null>(null);
  const [saveProgress, setSaveProgress] = useState<{ step: number; total: number } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [deleteProjectModal, setDeleteProjectModal] = useState<{ id: string } | null>(null);
  const [removeImageModal, setRemoveImageModal] = useState<{ projectId: string; key: string } | null>(null);

  const refresh = useCallback(async () => {
    await onRefresh();
  }, [onRefresh]);

  const resetNewForm = () => {
    setNewForm(emptyForm());
    setPendingFiles([]);
    setShowNewForm(false);
    setPendingFileMessage(null);
    setSaveProgress(null);
  };

  const startAdd = () => {
    setPendingFileMessage(null);
    setNewForm(emptyForm());
    setPendingFiles([]);
    setShowNewForm(true);
  };

  const onNewFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const list = input.files;
    if (!list?.length) {
      input.value = "";
      return;
    }
    const incoming = Array.from(list);
    let message: string | null = null;
    setPendingFiles((prev) => {
      const r = planPendingFileAdds(prev, incoming);
      message = r.message;
      return r.next;
    });
    setPendingFileMessage(message);

    requestAnimationFrame(() => {
      input.value = "";
    });
  };

  const removePendingAt = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
    setPendingFileMessage(null);
  };

  const movePending = (index: number, direction: -1 | 1) => {
    const to = index + direction;
    if (to < 0 || to >= pendingFiles.length) return;
    setPendingFiles((prev) => reorderArray(prev, index, to));
  };

  const moveEditImage = (index: number, direction: -1 | 1) => {
    setEditImages((prev) => {
      if (!prev) return prev;
      const to = index + direction;
      if (to < 0 || to >= prev.keys.length) return prev;
      return {
        keys: reorderArray(prev.keys, index, to),
        urls: reorderArray(prev.urls, index, to),
      };
    });
  };

  const saveNewProject = async () => {
    const project_name = newForm.project_name.trim();
    const domain = newForm.domain.trim();
    const description = newForm.description.trim();
    if (!project_name || !domain || !description) {
      showError("Project name, domain, and description are required.");
      return;
    }
    if (pendingFiles.length < 1) {
      showError("Add at least one image (max 10, each up to 2 MB).");
      return;
    }
    if (pendingFiles.length > MAX_IMAGES_PER_PROJECT) {
      showError(`Maximum ${MAX_IMAGES_PER_PROJECT} images per project.`);
      return;
    }
    const sizeErr = validateFilesForSize(pendingFiles);
    if (sizeErr) {
      showError(sizeErr);
      return;
    }

    const totalSteps = 1 + pendingFiles.length;
    setPendingFileMessage(null);
    setBusy(true);
    setSaveProgress({ step: 0, total: totalSteps });

    try {
      const res = await dataService.createExperienceProject({ project_name, domain, description });
      const projectId = res.project.id;
      setSaveProgress({ step: 1, total: totalSteps });

      for (let i = 0; i < pendingFiles.length; i++) {
        await dataService.uploadExperienceProjectImage(projectId, pendingFiles[i]);
        setSaveProgress({ step: 2 + i, total: totalSteps });
      }

      resetNewForm();
      await refresh();
    } catch (e) {
      showError(e instanceof Error ? e.message : "Could not save project");
    } finally {
      setBusy(false);
      setSaveProgress(null);
    }
  };

  const runDeleteProject = async () => {
    if (!deleteProjectModal) return;
    const id = deleteProjectModal.id;
    setBusy(true);
    try {
      await dataService.deleteExperienceProject(id);
      setDeleteProjectModal(null);
      if (editingId === id) {
        setEditingId(null);
        setEditImages(null);
      }
      await refresh();
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  const runRemoveImage = async () => {
    if (!removeImageModal) return;
    const { projectId, key } = removeImageModal;
    setBusy(true);
    try {
      await dataService.deleteExperienceProjectImage(projectId, key);
      setRemoveImageModal(null);
      setEditImages((prev) => {
        if (!prev) return prev;
        const idx = prev.keys.indexOf(key);
        if (idx < 0) return prev;
        const nextKeys = prev.keys.filter((k) => k !== key);
        const nextUrls = prev.urls.filter((_, i) => i !== idx);
        return { keys: nextKeys, urls: nextUrls };
      });
      await refresh();
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  const keys = (p: ExperienceProjectApi) => p.image_keys || [];

  const startEdit = (p: ExperienceProjectApi) => {
    setEditingId(p.id);
    setEditForm({
      project_name: p.project_name,
      domain: p.domain,
      description: p.description,
    });
    setEditImages({
      keys: [...keys(p)],
      urls: [...(p.images || [])],
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditImages(null);
  };

  const saveEdit = async (projectId: string) => {
    const project_name = editForm.project_name.trim();
    const domain = editForm.domain.trim();
    const description = editForm.description.trim();
    if (!project_name || !domain || !description) {
      showError("All fields are required.");
      return;
    }
    if (!editImages || editImages.keys.length === 0) {
      showError("At least one image is required.");
      return;
    }
    setBusy(true);
    try {
      await dataService.updateExperienceProject(projectId, {
        project_name,
        domain,
        description,
        image_keys: editImages.keys,
      });
      cancelEdit();
      await refresh();
    } catch (e) {
      showError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  };

  const onEditFilesChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const list = input.files;
    if (!list?.length) {
      input.value = "";
      return;
    }
    /** Copy before clearing — `FileList` is live; clearing the input empties it */
    const incoming = Array.from(list);
    requestAnimationFrame(() => {
      input.value = "";
    });

    if (!editingId || !editImages) return;

    const room = Math.max(0, MAX_IMAGES_PER_PROJECT - editImages.keys.length);
    if (room === 0) {
      showError(
        `You already have ${MAX_IMAGES_PER_PROJECT} images. Remove some before adding more, or select fewer files.`
      );
      return;
    }

    const bad = incoming.filter((f) => f.size > MAX_IMAGE_BYTES);
    const valid = incoming.filter((f) => f.size <= MAX_IMAGE_BYTES);
    const toUpload = valid.slice(0, room);
    const validDropped = valid.length - toUpload.length;

    const parts: string[] = [];
    for (const f of bad) {
      parts.push(`“${f.name}” is ${formatFileSize(f.size)} — max 2 MB per image.`);
    }
    if (validDropped > 0) {
      parts.push(
        `${validDropped} image(s) not uploaded — ${MAX_IMAGES_PER_PROJECT} images max per project.`
      );
    }

    if (toUpload.length === 0) {
      showError(
        parts.length > 0
          ? parts.join(" ")
          : "No images to upload — each file must be 2 MB or smaller (JPEG, PNG, or HEIC)."
      );
      return;
    }

    setBusy(true);
    if (parts.length > 0) showError(parts.join(" "));
    try {
      const newKeys: string[] = [];
      const newUrls: string[] = [];
      for (const file of toUpload) {
        const res = await dataService.uploadExperienceProjectImage(editingId, file);
        newKeys.push(res.key);
        newUrls.push(res.image);
      }
      setEditImages((prev) => {
        if (!prev) return prev;
        return {
          keys: [...newKeys, ...prev.keys],
          urls: [...newUrls, ...prev.urls],
        };
      });
    } catch (err) {
      showError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const progressPercent =
    saveProgress && saveProgress.total > 0 ? Math.round((saveProgress.step / saveProgress.total) * 100) : 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex min-h-8 items-center justify-between gap-4">
        <h3 className="text-title font-light tracking-wide">Portfolio</h3>
        {editable &&
          (showNewForm ? (
            <button
              type="button"
              onClick={resetNewForm}
              disabled={busy}
              className={headerActionButtonClass}
              aria-label="Cancel"
            >
              <X size={16} strokeWidth={2} />
            </button>
          ) : (
            <button type="button" onClick={startAdd} disabled={busy} className={addExperienceButtonClass}>
              <Plus size={14} strokeWidth={2} />
              Add experience
            </button>
          ))}
      </div>

      <section className="space-y-4 rounded-[20px] bg-[#1E1E1E] border border-white/5 p-6 relative text-white">
        <ConfirmModal
          isOpen={!!deleteProjectModal}
          title="Delete project?"
          message="This removes the project and all of its images from your profile. This cannot be undone."
          confirmLabel="Delete project"
          danger
          busy={busy}
          onClose={() => !busy && setDeleteProjectModal(null)}
          onConfirm={runDeleteProject}
        />
        <ConfirmModal
          isOpen={!!removeImageModal}
          title="Remove this image?"
          message="The image will be permanently removed from this project."
          confirmLabel="Remove image"
          danger
          busy={busy}
          onClose={() => !busy && setRemoveImageModal(null)}
          onConfirm={runRemoveImage}
        />
        <ImagePreviewModal url={previewUrl} onClose={() => setPreviewUrl(null)} />

        {saveProgress && (
          <div className="space-y-1">
            <div className="flex justify-between text-caption text-white/60">
              <span>Saving…</span>
              <span>
                {saveProgress.step}/{saveProgress.total}
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500/90 transition-[width] duration-200"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-caption text-white/40">
              Progress counts creating the project plus each image upload.
            </p>
          </div>
        )}

        {editable && showNewForm && (
          <div className="rounded-[16px] border border-dashed border-white/20 bg-[#141414]/80 p-4 space-y-3">
            <p className="text-caption text-white/60 font-medium">New project</p>
            <input
              placeholder="Project name *"
              value={newForm.project_name}
              onChange={(e) => setNewForm((f) => ({ ...f, project_name: e.target.value }))}
              className="zendt-input-surface-card"
            />
            <input
              placeholder="Domain * (e.g. example.com)"
              value={newForm.domain}
              onChange={(e) => setNewForm((f) => ({ ...f, domain: e.target.value }))}
              className="zendt-input-surface-card"
            />
            <textarea
              placeholder="Description *"
              value={newForm.description}
              onChange={(e) => setNewForm((f) => ({ ...f, description: e.target.value }))}
              rows={4}
              className="zendt-input-surface-card resize-none"
            />

            <div className="space-y-2">
              <p className="text-caption text-white/45">
                Images * — 1 to 10 files, 2 MB max each · use arrows to reorder · tap to preview
              </p>
              {pendingFileMessage ? (
                <div
                  role="alert"
                  className={`rounded-xl border px-3 py-2.5 text-caption leading-snug ${
                    pendingFileMessage.startsWith("No images were added")
                      ? "border-red-500/35 bg-red-500/10 text-red-100/95"
                      : "border-amber-500/35 bg-amber-500/10 text-amber-50/95"
                  }`}
                >
                  {pendingFileMessage}
                </div>
              ) : null}
              <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                {pendingFiles.length < MAX_IMAGES_PER_PROJECT && (
                  <div className="relative h-[88px] w-[88px] shrink-0">
                    <input
                      ref={newFileRef}
                      type="file"
                      accept="image/jpeg,image/png,image/heic,image/webp,image/*"
                      multiple
                      className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                      aria-label="Add images"
                      onChange={onNewFilesChange}
                    />
                    <div className="pointer-events-none flex h-full w-full flex-col items-center justify-center gap-1 rounded-lg border border-white/15 text-white/40">
                      <ImagePlus size={22} />
                      <span className="text-caption">Add</span>
                    </div>
                  </div>
                )}
                {pendingFiles.map((file, i) => (
                  <PendingImageColumn
                    key={`${file.name}-${file.size}-${file.lastModified}-${i}`}
                    file={file}
                    index={i}
                    n={pendingFiles.length}
                    busy={!!busy}
                    onPreview={setPreviewUrl}
                    onRemove={() => removePendingAt(i)}
                    onMove={movePending}
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                disabled={busy}
                onClick={saveNewProject}
                className="rounded-[10px] bg-white/15 px-4 py-2 text-caption hover:bg-white/25 disabled:opacity-50"
              >
                Save
              </button>
              <button
                type="button"
                onClick={resetNewForm}
                disabled={busy}
                className="rounded-[10px] px-4 py-2 text-caption text-white/50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {projects.map((p) => {
            const href = domainHref(p.domain);
            const isEditing = editingId === p.id;
            const imgs = p.images || [];
            const k = keys(p);
            const imgCount = imgs.length;

            return (
              <div key={p.id} className="rounded-[16px] border border-white/10 bg-[#141414] p-4 space-y-3">
                {editable && isEditing ? (
                  <>
                    <div className="space-y-2">
                      <label className="block text-caption text-white/50">Project name</label>
                      <input
                        value={editForm.project_name}
                        onChange={(e) => setEditForm((f) => ({ ...f, project_name: e.target.value }))}
                        className="zendt-input-surface-card"
                      />
                      <label className="block text-caption text-white/50">Domain</label>
                      <input
                        value={editForm.domain}
                        onChange={(e) => setEditForm((f) => ({ ...f, domain: e.target.value }))}
                        className="zendt-input-surface-card"
                      />
                      <label className="block text-caption text-white/50">Description</label>
                      <textarea
                        value={editForm.description}
                        onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                        rows={3}
                        className="zendt-input-surface-card resize-none"
                      />
                    </div>

                    {editImages && (
                      <div className="space-y-2">
                        <p className="text-caption text-white/45">
                          Images — up to {MAX_IMAGES_PER_PROJECT}, 2 MB max each · use arrows to reorder ·
                          tap to preview
                        </p>
                        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                          {editImages.keys.length < MAX_IMAGES_PER_PROJECT && (
                            <div className="relative h-[88px] w-[88px] shrink-0">
                              <input
                                ref={editFileRef}
                                type="file"
                                accept="image/jpeg,image/png,image/heic,image/webp,image/*"
                                multiple
                                className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                                aria-label="Add images"
                                onChange={onEditFilesChange}
                              />
                              <div className="pointer-events-none flex h-full w-full flex-col items-center justify-center gap-1 rounded-lg border border-white/15 text-white/40">
                                <ImagePlus size={22} />
                                <span className="text-caption">Add</span>
                              </div>
                            </div>
                          )}
                          {editImages.urls.map((url, i) => {
                            const n = editImages.keys.length;
                            return (
                              <div
                                key={editImages.keys[i] ?? `e-${i}`}
                                className="flex w-[96px] shrink-0 flex-col gap-1"
                              >
                                <div className="relative h-[88px] w-full overflow-hidden rounded-lg bg-white/5 ring-1 ring-white/10">
                                  <ExperienceThumb
                                    url={url}
                                    fileName={`Image ${i + 1}`}
                                    onOpen={() => setPreviewUrl(url)}
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setRemoveImageModal({ projectId: p.id, key: editImages.keys[i] })
                                    }
                                    disabled={busy}
                                    className="absolute top-1 right-1 z-[2] p-1 rounded bg-black/60 text-white/90 hover:bg-red-600/80"
                                    aria-label="Remove image"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                                <div className="flex items-center justify-center gap-0.5">
                                  <button
                                    type="button"
                                    disabled={busy || i === 0}
                                    onClick={() => moveEditImage(i, -1)}
                                    className="rounded p-0.5 text-white/50 hover:bg-white/10 hover:text-white disabled:opacity-25"
                                    aria-label="Move earlier"
                                  >
                                    <ChevronLeft size={16} strokeWidth={2} />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={busy || i >= n - 1}
                                    onClick={() => moveEditImage(i, 1)}
                                    className="rounded p-0.5 text-white/50 hover:bg-white/10 hover:text-white disabled:opacity-25"
                                    aria-label="Move later"
                                  >
                                    <ChevronRight size={16} strokeWidth={2} />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 pt-1">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => saveEdit(p.id)}
                        className="rounded-[10px] bg-white/15 px-4 py-2 text-caption hover:bg-white/25 disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        disabled={busy}
                        className="rounded-[10px] px-4 py-2 text-caption text-white/60"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between items-start gap-2">
                      <div>
                        <h4 className="text-body font-medium text-white">{p.project_name}</h4>
                        {href ? (
                          <a
                            href={href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-caption text-white/60 hover:text-white/90 underline-offset-2 break-all"
                          >
                            {p.domain}
                          </a>
                        ) : (
                          <p className="text-caption text-white/50">{p.domain}</p>
                        )}
                      </div>
                      {editable && (
                        <div className="flex gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => startEdit(p)}
                            className="text-caption text-white/50 hover:text-white px-2 py-1"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteProjectModal({ id: p.id })}
                            disabled={busy}
                            className="p-1.5 text-white/40 hover:text-red-400"
                            aria-label="Delete project"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                    <p className="text-caption text-white/75 leading-relaxed whitespace-pre-wrap">
                      {p.description}
                    </p>

                    {imgCount > 0 && (
                      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                        {imgs.map((url, i) => (
                          <div
                            key={k[i] || `${p.id}-${i}`}
                            className="relative shrink-0 w-[88px] h-[88px] rounded-lg overflow-hidden bg-white/5 ring-1 ring-white/10"
                          >
                            {url ? (
                              <ExperienceThumb
                                url={url}
                                fileName={`Image ${i + 1}`}
                                onOpen={() => setPreviewUrl(url)}
                              />
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        {editable && !showNewForm && projects.length === 0 && (
          <p className="text-caption text-white/40 text-center py-4">
            No projects yet. Tap Add experience to create one.
          </p>
        )}
      </section>
    </div>
  );
}
