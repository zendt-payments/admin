import { useState, useCallback } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import { motion } from "motion/react";
import { useReducedMotionCtx } from "../motion";

type CropModalProps = {
  imageSrc: string;
  onCancel: () => void;
  onCropDone: (croppedBlob: Blob) => void;
};

function getCroppedImg(imageSrc: string, crop: Area): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const size = Math.min(crop.width, crop.height);
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas not supported"));

      ctx.drawImage(img, crop.x, crop.y, crop.width, crop.height, 0, 0, size, size);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Crop failed"))),
        "image/jpeg",
        0.92
      );
    };
    img.onerror = () => reject(new Error("Image load failed"));
    img.src = imageSrc;
  });
}

export default function CropModal({ imageSrc, onCancel, onCropDone }: CropModalProps) {
  const reduced = useReducedMotionCtx();
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleSave = async () => {
    if (!croppedAreaPixels) return;
    try {
      setSaving(true);
      const blob = await getCroppedImg(imageSrc, croppedAreaPixels);
      onCropDone(blob);
    } catch (err) {
      console.error("Crop error:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        className="w-full max-w-sm mx-4 bg-[#1a1a1a] rounded-2xl overflow-hidden"
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.96 }}
        animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
        transition={
          reduced ? { duration: 0.15 } : { type: "spring", stiffness: 380, damping: 32, mass: 0.7 }
        }
      >
        <div className="relative w-full" style={{ height: 320 }}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>

        <div className="px-6 py-3">
          <label className="text-caption text-white/60 block mb-1">Zoom</label>
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full accent-white"
          />
        </div>

        <div className="flex gap-3 px-6 pb-5">
          <button
            onClick={onCancel}
            className="flex-1 py-2.5 rounded-full border border-white/20 text-body text-white/70 hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 rounded-full bg-white text-black text-body font-medium disabled:opacity-50"
          >
            {saving ? "Cropping..." : "Save"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
