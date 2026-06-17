import { useEffect, useState } from "react";
import { dataService } from "../../services/dataService";
import { getKycToastFromError } from "../../lib/kycErrors";
import {
  FREELANCER_PROOF_INTRO,
  optionACopy,
  optionBCopy,
  uploadRulesCopy,
} from "../../content/freelancerProofRequirements";
import { openWhatsAppSupport, whatsappSupportCopy } from "../../utils/whatsappSupport";
import { dashboardDialogTitleClass } from "./DashboardTitles";

type ProofFile = { key: string; original_name: string };

type Props = {
  proofStatus: string;
  proofLocked: boolean;
  rejectionReason?: string;
  onSuccess: () => void;
  toast: (message: string, sub: string) => void;
};

export default function ProofSubmissionStep({
  proofStatus,
  proofLocked,
  rejectionReason,
  onSuccess,
  toast,
}: Props) {
  const [option, setOption] = useState<"A" | "B">("A");
  const [files, setFiles] = useState<ProofFile[]>([]);
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpTab, setHelpTab] = useState<"A" | "B">("A");
  const [infoConfirmed, setInfoConfirmed] = useState(false);

  useEffect(() => {
    if (helpOpen) setHelpTab(option);
  }, [option, helpOpen]);

  const readOnly =
    proofStatus === "approved" ||
    proofStatus === "submitted" ||
    (proofLocked === true && proofStatus !== "rejected");

  const minFiles = option === "A" ? 1 : 2;

  const handlePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setUploading(true);
    try {
      const r = await dataService.uploadProofFile(f);
      setFiles((prev) => [...prev, { key: r.key, original_name: r.original_name || f.name }]);
      toast("File uploaded", f.name);
    } catch (err: unknown) {
      const { title, sub } = getKycToastFromError(err);
      toast(title === "Error" ? "Upload failed" : title, sub);
    } finally {
      setUploading(false);
    }
  };

  const removeAt = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const doSubmit = async () => {
    if (!infoConfirmed) {
      toast(
        "Confirmation required",
        "Please confirm that your information is accurate and authorise Zendt to verify it."
      );
      return;
    }
    if (files.length < minFiles) {
      toast("Not enough files", `Option ${option} requires at least ${minFiles} document(s).`);
      return;
    }
    setSubmitting(true);
    try {
      await dataService.submitProof({
        option,
        files: files.map((f) => ({
          kind: "document",
          s3_key: f.key,
          original_name: f.original_name,
        })),
        notes: notes.trim() || undefined,
      });
      toast("Submitted", "Your documents are under review.");
      setConfirmOpen(false);
      onSuccess();
    } catch (err: unknown) {
      const { title, sub } = getKycToastFromError(err);
      toast(title === "Error" ? "Submit failed" : title, sub);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitClick = () => {
    if (!infoConfirmed) {
      toast(
        "Confirmation required",
        "Please confirm that your information is accurate and authorise Zendt to verify it."
      );
      return;
    }
    setConfirmOpen(true);
  };

  if (readOnly && proofStatus !== "rejected") {
    return null;
  }

  return (
    <div className="mt-4 space-y-3">
      {proofStatus === "rejected" && (
        <div className="rounded-xl bg-red-950/40 border border-red-500/30 px-3 py-2.5 text-caption text-red-200/90">
          <p>
            {rejectionReason ? rejectionReason : "Previous submission was not approved."}{" "}
            <button
              type="button"
              onClick={() =>
                openWhatsAppSupport(
                  rejectionReason
                    ? `${whatsappSupportCopy.kycStuck} (Reason on file: ${rejectionReason.slice(0, 200)})`
                    : whatsappSupportCopy.kycStuck
                )
              }
              className="text-emerald-400/90 hover:text-emerald-300"
            >
              Contact support
            </button>
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-body cursor-pointer">
            <input
              type="radio"
              name="proof-opt"
              checked={option === "A"}
              onChange={() => {
                setOption("A");
                setFiles([]);
              }}
              className="accent-emerald-500"
            />
            Option A · 1 file
          </label>
          <label className="flex items-center gap-2 text-body cursor-pointer">
            <input
              type="radio"
              name="proof-opt"
              checked={option === "B"}
              onChange={() => {
                setOption("B");
                setFiles([]);
              }}
              className="accent-emerald-500"
            />
            Option B · 2 files
          </label>
        </div>
        <button
          type="button"
          onClick={() => {
            setHelpTab(option);
            setHelpOpen(true);
          }}
          className="text-caption text-emerald-400/90 hover:text-emerald-300 shrink-0"
        >
          Document guide
        </button>
      </div>

      <div className="rounded-xl border border-white/8 bg-[#2A2A2A]/60 p-3 space-y-2">
        {files.length > 0 && (
          <ul className="space-y-1.5 text-caption text-white/80">
            {files.map((f, i) => (
              <li
                key={`${f.key}-${i}`}
                className="flex justify-between gap-2 items-center rounded-lg bg-[#1E1E1E] px-3 py-2"
              >
                <span className="truncate">{f.original_name}</span>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => removeAt(i)}
                    className="text-red-300 shrink-0 text-caption"
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        <label className="inline-flex">
          <input
            type="file"
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
            onChange={handlePick}
            disabled={uploading || readOnly}
          />
          <span className="rounded-[11px] bg-white/10 px-4 py-2 text-body text-white hover:bg-white/20 cursor-pointer disabled:opacity-40">
            {uploading ? "Uploading..." : "Add file"}
          </span>
        </label>
        <p className="text-caption text-white/40">PDF, JPG, PNG · max 10MB</p>
      </div>

      <label className="flex flex-col gap-1.5 text-caption text-white/70">
        Notes (optional)
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="zendt-input-surface-kyc text-body resize-y min-h-[4.5rem] placeholder:text-white/40"
          placeholder="Anything we should know about these documents?"
        />
      </label>

      <div className="flex items-start gap-3">
        <input
          id="proof-info-confirmation"
          type="checkbox"
          checked={infoConfirmed}
          onChange={(event) => setInfoConfirmed(event.target.checked)}
          disabled={readOnly}
          className="mt-0.5 size-4 shrink-0 rounded border-white/30 bg-transparent accent-emerald-500"
        />
        <label htmlFor="proof-info-confirmation" className="text-caption text-white/70 leading-relaxed">
          I confirm that the information I have provided is accurate and authorise Zendt to verify it with
          its regulated partners.
        </label>
      </div>

      <button
        type="button"
        onClick={handleSubmitClick}
        disabled={readOnly || files.length < minFiles || submitting}
        className="rounded-[11px] bg-emerald-600/80 px-5 py-2.5 text-body text-white hover:bg-emerald-600 disabled:opacity-40"
      >
        Submit proof
      </button>

      {helpOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-3 py-6 overflow-y-auto"
          onClick={() => setHelpOpen(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="proof-help-title"
            className="w-full max-w-md rounded-2xl bg-[#1E1E1E] border border-white/10 shadow-xl my-auto max-h-[min(90vh,720px)] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-white/10 shrink-0">
              <h2 id="proof-help-title" className={`${dashboardDialogTitleClass} pr-8`}>
                What to upload
              </h2>
              <p className="text-caption text-white/60 mt-2 leading-relaxed">{FREELANCER_PROOF_INTRO}</p>
              <div className="flex rounded-lg bg-[#2E2E2E] p-0.5 mt-3">
                <button
                  type="button"
                  onClick={() => setHelpTab("A")}
                  className={`flex-1 rounded-md py-2 text-caption font-medium transition ${
                    helpTab === "A" ? "bg-white/15 text-white" : "text-white/60 hover:text-white/90"
                  }`}
                >
                  Option A
                </button>
                <button
                  type="button"
                  onClick={() => setHelpTab("B")}
                  className={`flex-1 rounded-md py-2 text-caption font-medium transition ${
                    helpTab === "B" ? "bg-white/15 text-white" : "text-white/60 hover:text-white/90"
                  }`}
                >
                  Option B
                </button>
              </div>
            </div>

            <div className="px-4 py-3 overflow-y-auto flex-1 min-h-0 space-y-3 text-caption text-white/80 leading-relaxed">
              {helpTab === "A" ? (
                <>
                  <p className="text-body text-white font-medium">{optionACopy.title}</p>
                  <p className="text-white/70">{optionACopy.summary}</p>
                  <ul className="list-disc pl-4 space-y-2">
                    {optionACopy.bullets.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                </>
              ) : (
                <>
                  <p className="text-body text-white font-medium">{optionBCopy.title}</p>
                  <p className="text-white/70">{optionBCopy.intro}</p>
                  <p className="text-white/50 uppercase tracking-wide text-caption pt-1">
                    Approved documents (pick any two)
                  </p>
                  <ul className="space-y-3">
                    {optionBCopy.documents.map((d) => (
                      <li key={d.title} className="rounded-lg bg-[#2A2A2A] px-3 py-2 border border-white/5">
                        <span className="font-medium text-white/90">{d.title}</span>
                        <p className="mt-1 text-white/70">{d.description}</p>
                        <p className="mt-1 text-white/45">Formats: {d.formats}</p>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <div className="pt-2 border-t border-white/10 space-y-1 text-white/55">
                {uploadRulesCopy.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </div>

            <div className="p-4 border-t border-white/10 shrink-0 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setHelpOpen(false)}
                className="rounded-lg bg-white/10 px-4 py-2 text-body text-white hover:bg-white/20"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-sm rounded-2xl bg-[#1E1E1E] p-5 space-y-3 border border-white/10">
            <p className="text-body font-medium text-white">Submit for review?</p>
            <div className="flex gap-2 justify-end pt-1">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="px-3 py-1.5 text-body text-white/80"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={doSubmit}
                disabled={submitting}
                className="rounded-lg bg-emerald-600 px-3 py-1.5 text-body text-white"
              >
                {submitting ? "Submitting..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
