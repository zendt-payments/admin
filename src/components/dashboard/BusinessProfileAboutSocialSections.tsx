import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { LucideIcon } from "lucide-react";
import {
  Instagram,
  Linkedin,
  Facebook,
  Twitter,
  Youtube,
  Github,
  Twitch,
  Globe,
  MessageCircle,
  Send,
  Link2,
  Pencil,
  X,
  Trash2,
  ChevronDown,
} from "lucide-react";
export type SocialRow = { platform: string; url: string };

function normalizeUrl(u: string) {
  const t = u.trim();
  if (!t) return t;
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

function websiteHref(url: string) {
  const t = url.trim();
  if (!t) return "";
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

/** Curated list: label is stored in API; Icon shown in dropdown and view mode */
const SOCIAL_PLATFORM_OPTIONS: { label: string; Icon: LucideIcon }[] = [
  { label: "Instagram", Icon: Instagram },
  { label: "LinkedIn", Icon: Linkedin },
  { label: "Facebook", Icon: Facebook },
  { label: "X (Twitter)", Icon: Twitter },
  { label: "YouTube", Icon: Youtube },
  { label: "TikTok", Icon: Globe },
  { label: "Pinterest", Icon: Globe },
  { label: "Snapchat", Icon: Globe },
  { label: "Reddit", Icon: Globe },
  { label: "Discord", Icon: Globe },
  { label: "Twitch", Icon: Twitch },
  { label: "GitHub", Icon: Github },
  { label: "Behance", Icon: Globe },
  { label: "Dribbble", Icon: Globe },
  { label: "Fiverr", Icon: Globe },
  { label: "Upwork", Icon: Globe },
  { label: "Medium", Icon: Globe },
  { label: "Threads", Icon: Globe },
  { label: "WhatsApp", Icon: MessageCircle },
  { label: "Telegram", Icon: Send },
];

function getPlatformIconComponent(platform: string): LucideIcon {
  const t = platform.trim();
  if (!t) return Globe;
  const exact = SOCIAL_PLATFORM_OPTIONS.find((o) => o.label.toLowerCase() === t.toLowerCase());
  if (exact) return exact.Icon;
  const p = t.toLowerCase();
  if (p.includes("instagram")) return Instagram;
  if (p.includes("linkedin")) return Linkedin;
  if (p.includes("facebook")) return Facebook;
  if (p.includes("twitter") || p === "x") return Twitter;
  if (p.includes("youtube")) return Youtube;
  if (p.includes("github")) return Github;
  if (p.includes("twitch")) return Twitch;
  if (p.includes("whatsapp")) return MessageCircle;
  if (p.includes("telegram")) return Send;
  if (p.includes("fiverr") || p.includes("behance") || p.includes("dribbble")) return Globe;
  return Link2;
}

function SocialPlatformIcon({ platform }: { platform: string }) {
  const Icon = getPlatformIconComponent(platform);
  return <Icon className="w-6 h-6 text-white/80" aria-hidden />;
}

const editIconButtonClass =
  "inline-flex h-8 w-8 items-center justify-center text-white/60 hover:text-white transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30 rounded-lg";

export function AboutBusinessSection({
  initialText,
  onSave,
}: {
  initialText: string;
  onSave: (text: string) => void | Promise<void>;
}) {
  const [text, setText] = useState(initialText);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [readModalOpen, setReadModalOpen] = useState(false);

  useEffect(() => {
    setText(initialText);
  }, [initialText]);

  useEffect(() => {
    if (!readModalOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setReadModalOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [readModalOpen]);

  const toggleEdit = () => {
    if (editing) setText(initialText);
    setEditing(!editing);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(text);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const showReadHint = text.trim().length > 200;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-title font-light tracking-wide">About business</h3>
        {editing ? (
          <button type="button" onClick={toggleEdit} className={editIconButtonClass} aria-label="Cancel">
            <X size={16} strokeWidth={2} />
          </button>
        ) : (
          <button type="button" onClick={toggleEdit} className={editIconButtonClass} aria-label="Edit">
            <Pencil size={16} strokeWidth={2} />
          </button>
        )}
      </div>
      <div
        className={`zendt-dashboard-cairo relative space-y-4 rounded-[20px] bg-[#1E1E1E] border border-white/5 p-8 overflow-hidden min-h-[100px] ${
          !editing && text.trim()
            ? "cursor-pointer transition-colors hover:bg-[#222] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25"
            : ""
        }`}
        role={!editing && text.trim() ? "button" : undefined}
        tabIndex={!editing && text.trim() ? 0 : undefined}
        aria-label={!editing && text.trim() ? "Open full about business text" : undefined}
        onClick={
          !editing && text.trim()
            ? () => {
                setReadModalOpen(true);
              }
            : undefined
        }
        onKeyDown={(e) => {
          if (!editing && text.trim() && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            setReadModalOpen(true);
          }
        }}
      >
        {editing ? (
          <div className="relative z-10 space-y-4">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              placeholder="Describe your business…"
              className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-body text-white/90 placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-white/20 resize-y min-h-[120px]"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-[10px] bg-white/10 px-5 py-2 text-body text-white hover:bg-white/20 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        ) : text.trim() ? (
          <div className="relative z-10">
            <p className="text-body text-white/80 leading-relaxed whitespace-pre-wrap line-clamp-6">
              {text}
            </p>
            {showReadHint ? (
              <p className="mt-3 text-caption text-white/45">Tap to read full description</p>
            ) : null}
          </div>
        ) : (
          <p className="text-body text-white/40 relative z-10">
            No description yet. Tap the pencil to add.
          </p>
        )}
      </div>

      {readModalOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/55 backdrop-blur-[2px]"
            role="presentation"
            onClick={() => setReadModalOpen(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="about-business-modal-title"
              className="flex max-h-[min(85vh,640px)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#1E1E1E] shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
                <h4 id="about-business-modal-title" className="text-callout font-medium text-white/95">
                  About business
                </h4>
                <button
                  type="button"
                  onClick={() => setReadModalOpen(false)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white"
                  aria-label="Close"
                >
                  <X size={18} strokeWidth={2} />
                </button>
              </div>
              <div className="zendt-dashboard-cairo min-h-0 flex-1 overflow-y-auto px-4 py-4">
                <p className="text-body text-white/85 leading-relaxed whitespace-pre-wrap">{text}</p>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}

export function SocialProfilesSection({
  initialRows,
  onSave,
}: {
  initialRows: SocialRow[];
  onSave: (rows: SocialRow[]) => void | Promise<void>;
}) {
  const [rows, setRows] = useState<SocialRow[]>(initialRows);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  const toggleEdit = () => {
    if (editing) setRows(initialRows);
    setEditing(!editing);
  };

  const addRow = () => setRows([...rows, { platform: "", url: "" }]);
  const removeRow = (i: number) => setRows(rows.filter((_, j) => j !== i));
  const updateRow = (i: number, field: keyof SocialRow, v: string) => {
    const next = [...rows];
    next[i] = { ...next[i], [field]: v };
    setRows(next);
  };

  const handleSave = async () => {
    const cleaned = rows
      .map((r) => ({ platform: r.platform.trim(), url: normalizeUrl(r.url.trim()) }))
      .filter((r) => r.platform && r.url);
    setSaving(true);
    try {
      await onSave(cleaned);
      setRows(cleaned);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-title font-light tracking-wide">Social profiles</h3>
        {editing ? (
          <button type="button" onClick={toggleEdit} className={editIconButtonClass} aria-label="Cancel">
            <X size={16} strokeWidth={2} />
          </button>
        ) : (
          <button type="button" onClick={toggleEdit} className={editIconButtonClass} aria-label="Edit">
            <Pencil size={16} strokeWidth={2} />
          </button>
        )}
      </div>
      <div className="space-y-4 rounded-[20px] bg-[#1E1E1E] border border-white/5 p-6 relative overflow-hidden">
        {!editing && rows.length > 0 && (
          <div className="space-y-3 relative z-10">
            {rows.map((social, idx) => (
              <a
                key={`${social.platform}-${idx}`}
                href={websiteHref(social.url)}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center justify-between rounded-2xl bg-white/5 border border-white/5 px-4 py-4 text-body transition-all duration-300 hover:bg-white/10 hover:scale-[1.02] hover:border-white/10 hover:shadow-lg hover:shadow-black/20"
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 flex items-center justify-center p-2 shrink-0 group-hover:bg-white/10 transition-colors">
                    <SocialPlatformIcon platform={social.platform} />
                  </div>
                  <span className="font-medium text-white/90 truncate">{social.platform}</span>
                </div>
                <span className="text-white/50 font-mono text-caption tracking-wide group-hover:text-white/70 transition-colors truncate max-w-[45%] text-right">
                  {social.url.replace(/^https?:\/\//i, "")}
                </span>
              </a>
            ))}
          </div>
        )}

        {!editing && rows.length === 0 && (
          <p className="text-body text-white/40 relative z-10 py-2">
            No social links yet. Tap the pencil to add.
          </p>
        )}

        {editing && (
          <div className="space-y-3 relative z-10">
            <p className="text-caption text-white/60">Choose a platform and paste your profile URL.</p>
            {rows.length === 0 && (
              <p className="text-body text-white/50">No profiles yet. Add one below.</p>
            )}
            {rows.map((row, i) => {
              const PlatformIcon = getPlatformIconComponent(row.platform);
              return (
                <div
                  key={`social-edit-${i}`}
                  className="flex flex-col gap-2 rounded-2xl bg-white/5 border border-white/5 p-3 min-w-0 sm:flex-row sm:items-stretch sm:gap-3"
                >
                  <div className="relative flex min-h-[42px] w-full min-w-0 sm:max-w-[220px] sm:shrink-0">
                    <div className="pointer-events-none absolute left-3 top-1/2 z-[1] -translate-y-1/2 flex h-7 w-7 items-center justify-center text-white/80">
                      <PlatformIcon className="h-5 w-5 shrink-0" aria-hidden />
                    </div>
                    <select
                      value={row.platform}
                      onChange={(e) => updateRow(i, "platform", e.target.value)}
                      className="w-full appearance-none rounded-xl bg-white/5 border border-white/10 py-3 pl-11 pr-9 text-body text-white/90 focus:outline-none focus:ring-1 focus:ring-white/20 cursor-pointer truncate"
                    >
                      <option value="">Select platform</option>
                      {SOCIAL_PLATFORM_OPTIONS.map((o) => (
                        <option key={o.label} value={o.label}>
                          {o.label}
                        </option>
                      ))}
                      {row.platform.trim() &&
                        !SOCIAL_PLATFORM_OPTIONS.some(
                          (o) => o.label.toLowerCase() === row.platform.trim().toLowerCase()
                        ) && <option value={row.platform}>{row.platform}</option>}
                    </select>
                    <ChevronDown
                      className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40"
                      aria-hidden
                    />
                  </div>
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <input
                      type="text"
                      value={row.url}
                      onChange={(e) => updateRow(i, "url", e.target.value)}
                      placeholder="https://..."
                      className="min-w-0 flex-1 rounded-xl bg-white/5 border border-white/10 px-3 py-3 text-body text-white/90 placeholder:text-white/30 focus:outline-none focus:ring-1 focus:ring-white/20"
                    />
                    <button
                      type="button"
                      onClick={() => removeRow(i)}
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white/45 hover:text-red-400 hover:bg-white/5 transition-colors"
                      aria-label="Delete profile"
                    >
                      <Trash2 size={18} strokeWidth={2} />
                    </button>
                  </div>
                </div>
              );
            })}
            <button
              type="button"
              onClick={addRow}
              className="w-full rounded-xl border border-dashed border-white/20 py-2 text-body text-white/70 hover:bg-white/5"
            >
              Add profile
            </button>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-[10px] bg-white/10 px-5 py-2 text-body text-white hover:bg-white/20 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
