"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Globe, ImageUp, Loader2, Trash2 } from "lucide-react";
import { findFavicons } from "@/app/actions/icons";
import { squareImage } from "@/lib/resize-image";
import { Dialog, inputClass } from "./ui/dialog";
import { Button, cn } from "./ui/button";

type Candidate = { dataUrl: string; label: string };

/** Pick an icon: a website's favicon or an uploaded image, cropped to a square. Used for folders and top-bar items. */
export function IconDialog({
  open,
  onOpenChange,
  name,
  hasIcon,
  initialSite,
  loadSuggestions,
  save: saveIcon,
  remove,
  onPreview,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  name: string;
  hasIcon: boolean;
  initialSite?: string;
  loadSuggestions?: () => Promise<string[]>;
  save: (form: FormData) => Promise<{ ok: boolean; error?: string }>;
  remove?: () => Promise<unknown>;
  onPreview?: (url: string | null) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [site, setSite] = useState(initialSite ?? "");
  const [domains, setDomains] = useState<string[]>([]);
  const [found, setFound] = useState<{ site: string; candidates: Candidate[] } | null>(null);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !loadSuggestions) return;
    let alive = true;
    loadSuggestions().then((d) => alive && setDomains(d));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function search(value: string) {
    setSite(value);
    setError(null);
    setFound(null);
    setSearching(true);
    const res = await findFavicons(value);
    setSearching(false);
    if (!res.ok) return setError(res.error);
    setFound({ site: res.site, candidates: res.candidates });
  }

  async function save(src: Blob | string) {
    setSaving(true);
    setError(null);
    try {
      const { blob, size } = await squareImage(src);
      const local = URL.createObjectURL(blob);
      const form = new FormData();
      form.set("file", blob, "icon");
      form.set("size", String(size));
      const res = await saveIcon(form);
      if (!res.ok) throw new Error(res.error ?? "Couldn't save the icon.");
      onPreview?.(local);
      toast.success("Icon updated");
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the icon.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={`Icon for “${name}”`} description="Use a website's icon, or upload an image. It's cropped to a square.">
      <div className="space-y-6">
        <section>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold"><Globe className="h-4 w-4 text-muted" /> From a website</h3>
          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              if (site.trim()) search(site.trim());
            }}
            className="flex gap-2"
          >
            <input value={site} onChange={(e) => setSite(e.target.value)} placeholder="e.g. chatgpt.com" className={inputClass} aria-label="Website" />
            <Button type="submit" disabled={searching || !site.trim()}>
              {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Find"}
            </Button>
          </form>
          {domains.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {domains.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => search(d)}
                  className="rounded-full border border-line px-2.5 py-1 text-xs text-muted hover:border-accent hover:text-text"
                >
                  {d}
                </button>
              ))}
            </div>
          )}
          {found && (
            <div className="mt-4">
              <p className="mb-2 text-xs text-muted">Pick one from {found.site}:</p>
              <div className="flex flex-wrap gap-2">
                {found.candidates.map((c) => (
                  <button
                    key={c.dataUrl.slice(-40)}
                    type="button"
                    disabled={saving}
                    onClick={() => save(c.dataUrl)}
                    className="flex w-20 flex-col items-center gap-1.5 rounded-xl border border-line bg-bg p-2 hover:border-accent disabled:opacity-50"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={c.dataUrl} alt="" className="h-12 w-12 rounded-lg object-contain" />
                    <span className="text-[10px] text-muted">{c.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        <section>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold"><ImageUp className="h-4 w-4 text-muted" /> Upload an image</h3>
          <Button onClick={() => fileRef.current?.click()} disabled={saving}>Choose image…</Button>
          <p className="mt-1.5 text-xs text-muted">Cropped to a square from the center.</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) save(f);
            }}
          />
        </section>

        {error && <p role="alert" className="text-sm text-danger">{error}</p>}

        <div className={cn("flex items-center gap-2 border-t border-line pt-4", hasIcon && remove ? "justify-between" : "justify-end")}>
          {hasIcon && remove && (
            <Button
              variant="ghost"
              disabled={saving}
              onClick={async () => {
                await remove();
                onPreview?.(null);
                toast("Icon removed");
                onOpenChange(false);
              }}
            >
              <Trash2 className="h-4 w-4" /> Remove icon
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
        </div>
      </div>
    </Dialog>
  );
}
