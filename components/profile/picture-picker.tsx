"use client";

import * as React from "react";
import { Camera, Check, ImagePlus, Trash2, ZoomIn } from "lucide-react";
import { api } from "@/hooks/api";
import { useToast } from "@/components/ui/toast";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { AVATAR_MAX_DIM } from "@/lib/constants";

/**
 * PicturePicker — local profile-picture upload (no image URL required).
 *
 * Tap the avatar or "Change Photo" → native file/gallery picker → the chosen
 * image opens in a square crop sheet (zoom slider + drag to position) → the
 * crop is rendered to a <=512px canvas, compressed to WebP (JPEG fallback) and
 * uploaded as a small base64 payload to POST /api/profile/avatar. The server
 * stores the bytes in Neon (UserAvatar) and flips User.image to the internal
 * /api/avatar route, so the picture appears everywhere automatically.
 *
 * Users without a photo keep the generated initials avatar — the Avatar
 * component falls back to avatarFor(username) when src is null.
 */

interface PicturePickerProps {
  username: string;
  src?: string | null;
  size?: number;
  onChanged?: (image: string | null) => void;
}

/**
 * Crop geometry — everything stored relative to the image so saving needs no
 * knowledge of the preview's pixel size:
 *  - z     zoom factor (crop side = min(w,h) / z)
 *  - rx/ry pan as a ratio of the *full overhang* in that axis, in [-1, 1].
 *    rx = 0 → crop centered; rx = ±1 → crop flush against the image edge.
 */
interface CropSession {
  url: string; // object URL of the raw file
  w: number; // natural dimensions
  h: number;
  z: number;
  rx: number;
  ry: number;
}

export function PicturePicker({ username, src, size = 120, onChanged }: PicturePickerProps) {
  const { push } = useToast();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [crop, setCrop] = React.useState<CropSession | null>(null);
  const [uploading, setUploading] = React.useState(false);

  const pickFile = async (file: File | undefined | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      push({ title: "Unsupported file", message: "Please choose a JPG, PNG or WebP image", tone: "error" });
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      push({ title: "Image too large", message: "Choose an image under 12MB", tone: "error" });
      return;
    }
    const url = URL.createObjectURL(file);
    try {
      const { width, height } = await loadDims(url);
      setCrop({ url, w: width, h: height, z: 1, rx: 0, ry: 0 });
    } catch {
      URL.revokeObjectURL(url);
      push({ title: "Could not read image", message: "That file could not be opened as an image", tone: "error" });
    }
  };

  const closeCrop = () => {
    setCrop((c) => {
      if (c) URL.revokeObjectURL(c.url);
      return null;
    });
  };

  const saveCrop = async () => {
    if (!crop) return;
    setUploading(true);
    try {
      const dataUrl = await renderCrop(crop);
      const res = await api<{
        user: { id: string; username: string; email: string; image: string | null; createdAt: string };
      }>("/api/profile/avatar", {
        method: "POST",
        body: JSON.stringify({ dataUrl }),
      });
      onChanged?.(res.user.image);
      push({ title: "Photo updated", message: "Your profile picture is live everywhere", tone: "success" });
      closeCrop();
    } catch (err: any) {
      push({ title: "Upload failed", message: err.message || "Please try again", tone: "error" });
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = async () => {
    if (!src) return;
    try {
      await api("/api/profile", { method: "PATCH", body: JSON.stringify({ image: "" }) });
      onChanged?.(null);
      push({ title: "Photo removed", message: "Your initials avatar is back", tone: "success" });
    } catch (err: any) {
      push({ title: "Failed", message: err.message || "Please try again", tone: "error" });
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        aria-label="Change profile picture"
        className="group relative rounded-full outline-none transition-transform active:scale-95"
      >
        <Avatar
          username={username}
          src={src}
          size={size}
          className="ring-2 ring-white/10 transition-shadow group-hover:ring-violet-400/70 group-focus-visible:ring-violet-400/70"
        />
        <span className="pointer-events-none absolute inset-0 grid place-items-center rounded-full bg-black/55 opacity-0 transition-opacity group-hover:opacity-100">
          <Camera className="text-white" size={Math.round(size * 0.22)} />
        </span>
      </button>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          className="gap-1.5 text-[10px] font-black uppercase tracking-widest"
        >
          <ImagePlus size={13} /> Change Photo
        </Button>
        {src && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void removePhoto()}
            className="gap-1.5 text-[10px] font-black uppercase tracking-widest text-rose-300/80 hover:text-rose-300"
          >
            <Trash2 size={13} /> Remove
          </Button>
        )}
      </div>
      <p className="max-w-[240px] text-center text-[10px] leading-relaxed text-slate-600">
        Pick an image from your device — it is compressed on your phone and stored securely with your profile.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          void pickFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />

      {crop && (
        <CropSheet
          session={crop}
          uploading={uploading}
          onChange={(next) => setCrop(next)}
          onCancel={closeCrop}
          onSave={() => void saveCrop()}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Crop sheet                                                          */
/* ------------------------------------------------------------------ */

function CropSheet({
  session,
  uploading,
  onChange,
  onCancel,
  onSave,
}: {
  session: CropSession;
  uploading: boolean;
  onChange: (next: CropSession) => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const frameRef = React.useRef<HTMLDivElement>(null);
  const dragRef = React.useRef<{ px: number; py: number; rx: number; ry: number } | null>(null);
  const [, setTick] = React.useState(0);

  // Re-measure the frame after first layout / resize so the transform maths
  // (which depends on the frame width) is always correct.
  React.useEffect(() => {
    const raf = requestAnimationFrame(() => setTick((t) => t + 1));
    const onResize = () => setTick((t) => t + 1);
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  const frameSize = (): number => frameRef.current?.getBoundingClientRect().width ?? 320;
  const scaleBase = (C: number) => C / Math.min(session.w, session.h);

  /** Visual overhang (px) beyond the square frame on one side of an axis. */
  const overhang = (C: number) => {
    const F = Math.min(session.w, session.h);
    const axis = session.w >= session.h ? session.w : session.h;
    // Overhang along the axis that overflows: (axis * scaleBase * z - C) / 2
    const imgAxisPx = axis * scaleBase(C) * session.z;
    return Math.max(0, (imgAxisPx - C) / 2);
  };
  const overhangX = (C: number) => (session.w >= session.h ? overhang(C) : 0);
  const overhangY = (C: number) => (session.h > session.w ? overhang(C) : 0);

  const clampRatio = (v: number) => Math.max(-1, Math.min(1, v));

  const handleZoom = (z: number) => {
    const zz = Math.max(1, Math.min(4, z));
    // rx/ry are ratios of the overhang — zooming changes the overhang size but
    // the ratio stays in range, so no pan re-clamp is needed.
    onChange({ ...session, z: zz });
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-arena-950/85 backdrop-blur-sm" onClick={uploading ? undefined : onCancel} />
      <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/10 bg-[#120a24] shadow-[0_20px_70px_rgba(0,0,0,0.7),0_0_40px_-10px_rgba(139,92,246,0.35)]">
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <div>
            <h3 className="text-sm font-black uppercase tracking-[0.18em] text-white">Position Photo</h3>
            <p className="mt-0.5 text-[10px] text-slate-500">Drag to frame · zoom to fit</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={uploading}
            className="grid h-8 w-8 place-items-center rounded-full border border-white/10 text-slate-300 hover:bg-white/10"
            aria-label="Cancel"
          >
            ✕
          </button>
        </div>

        <div className="px-5 pb-5">
          <div
            ref={frameRef}
            className="relative mx-auto aspect-square w-full touch-none select-none overflow-hidden rounded-2xl border border-white/10 bg-[#07030f]"
          >
            <img
              src={session.url}
              alt="Crop preview"
              draggable={false}
              onPointerDown={(e) => {
                if (uploading) return;
                e.currentTarget.setPointerCapture(e.pointerId);
                dragRef.current = { px: e.clientX, py: e.clientY, rx: session.rx, ry: session.ry };
              }}
              onPointerMove={(e) => {
                const d = dragRef.current;
                if (!d || uploading) return;
                const C = frameSize();
                const ox = overhangX(C);
                const oy = overhangY(C);
                const rx = ox > 0 ? d.rx + (e.clientX - d.px) / ox : 0;
                const ry = oy > 0 ? d.ry + (e.clientY - d.py) / oy : 0;
                onChange({ ...session, rx: clampRatio(rx), ry: clampRatio(ry) });
              }}
              onPointerUp={() => {
                dragRef.current = null;
              }}
              onPointerCancel={() => {
                dragRef.current = null;
              }}
              className="pointer-events-none absolute left-1/2 top-1/2 max-w-none"
              style={{
                width: session.w * scaleBase(frameSize()),
                height: session.h * scaleBase(frameSize()),
                transform:
                  `translate(-50%, -50%) ` +
                  `translate(${session.rx * overhangX(frameSize())}px, ${session.ry * overhangY(frameSize())}px) ` +
                  `scale(${session.z})`,
                willChange: "transform",
              }}
            />
            {/* Circular mask + dim outside the circle */}
            <div className="pointer-events-none absolute inset-0 rounded-full shadow-[0_0_0_200vmax_rgba(7,3,15,0.5)]" />
          </div>

          <div className="mt-4 flex items-center gap-3">
            <ZoomIn size={16} className="shrink-0 text-slate-500" />
            <input
              type="range"
              min={1}
              max={4}
              step={0.05}
              value={session.z}
              disabled={uploading}
              onChange={(e) => handleZoom(parseFloat(e.target.value))}
              className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-white/10 accent-violet-500"
              aria-label="Zoom"
            />
            <span className="w-9 shrink-0 text-right font-mono text-[10px] text-slate-500 tabular-nums">
              {session.z.toFixed(1)}×
            </span>
          </div>

          <Button onClick={onSave} loading={uploading} className="mt-4 w-full gap-2 font-black uppercase italic tracking-widest">
            <Check size={16} /> Save Photo
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function loadDims(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("load failed"));
    img.src = url;
  });
}

/**
 * Renders the zoom/pan crop (see CropSession) into a square <=512px canvas and
 * returns a compressed WebP data URL (JPEG fallback where WebP is unavailable).
 */
async function renderCrop(s: CropSession): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("Image decode failed"));
    el.src = s.url;
  });

  const F = Math.min(s.w, s.h);
  const side = F / s.z; // source px visible in the crop
  // Crop centre shifts away from the image centre by rx/ry × half the overhang.
  const cx = s.w / 2 - s.rx * ((s.w - side) / 2);
  const cy = s.h / 2 - s.ry * ((s.h - side) / 2);
  const sx = Math.max(0, Math.min(s.w - side, cx - side / 2));
  const sy = Math.max(0, Math.min(s.h - side, cy - side / 2));

  const canvas = document.createElement("canvas");
  canvas.width = AVATAR_MAX_DIM;
  canvas.height = AVATAR_MAX_DIM;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, side, side, 0, 0, AVATAR_MAX_DIM, AVATAR_MAX_DIM);

  let out = canvas.toDataURL("image/webp", 0.86);
  if (!out.startsWith("data:image/webp")) {
    out = canvas.toDataURL("image/jpeg", 0.86); // older browsers
  }
  return out;
}
