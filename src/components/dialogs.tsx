"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Loader2 } from "lucide-react";
import { createBookmark, previewLink, updateBookmark } from "@/app/actions/bookmarks";
import { createFolder, renameFolder } from "@/app/actions/folders";
import { folderOptions, type FolderLite } from "@/lib/folder-options";
import type { BookmarkView } from "@/lib/types";
import { Dialog, Field, inputClass } from "./ui/dialog";
import { Button } from "./ui/button";

const HOME = "__home__";

function FolderSelect({ value, onChange, folders, label }: { value: string; onChange: (v: string) => void; folders: FolderLite[]; label: string }) {
  const options = useMemo(() => folderOptions(folders), [folders]);
  return (
    <Field label={label}>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
        <option value={HOME}>Home (top level)</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </select>
    </Field>
  );
}

/* ------------------------------------------------------------------ */

export function NewFolderDialog({
  open,
  onOpenChange,
  folders,
  defaultParentId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  folders: FolderLite[];
  defaultParentId: string | null;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [parent, setParent] = useState(defaultParentId ?? HOME);
  const [project, setProject] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setName("");
      setParent(defaultParentId ?? HOME);
      setError(null);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const parentId = parent === HOME ? null : parent;
    const res = await createFolder({ name, parentId, isProject: !parentId && project });
    setSaving(false);
    if (!res.ok) return setError(res.error);
    onOpenChange(false);
    toast.success(`“${name.trim()}” created`, {
      action: { label: "Open", onClick: () => router.push(`/f/${res.id}`) },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="New folder">
      <form onSubmit={submit} className="space-y-5">
        <Field label="Name">
          <input autoFocus required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="e.g. BOOKREATOR" />
        </Field>
        <FolderSelect label="Inside" value={parent} onChange={setParent} folders={folders} />
        {parent === HOME && (
          <label className="flex items-center gap-3 text-sm">
            <input type="checkbox" checked={project} onChange={(e) => setProject(e.target.checked)} className="h-4.5 w-4.5 accent-[#ffb600]" />
            Show it under Projects (otherwise Library)
          </label>
        )}
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" type="submit" disabled={saving || !name.trim()}>
            {saving ? "Creating…" : "Create folder"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */

type Preview = Extract<Awaited<ReturnType<typeof previewLink>>, { ok: true }>;

export function AddBookmarkDialog({
  open,
  onOpenChange,
  folders,
  defaultFolderId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  folders: FolderLite[];
  defaultFolderId: string | null;
}) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [folderId, setFolderId] = useState(defaultFolderId ?? HOME);
  const [launch, setLaunch] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [looking, setLooking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastLooked = useRef("");

  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setUrl("");
      setTitle("");
      setDescription("");
      setFolderId(defaultFolderId ?? HOME);
      setLaunch(false);
      setPreview(null);
      setError(null);
    }
  }

  async function lookUp(value: string) {
    const v = value.trim();
    if (!v || v === lastLooked.current) return;
    lastLooked.current = v;
    setLooking(true);
    setError(null);
    const res = await previewLink(v);
    setLooking(false);
    if (lastLooked.current !== v) return;
    if (!res.ok) {
      setPreview(null);
      return setError(res.error);
    }
    setPreview(res);
  }

  // Look the link up shortly after typing/pasting stops.
  useEffect(() => {
    if (!open || !/\.[a-z]{2,}/i.test(url)) return;
    const t = setTimeout(() => lookUp(url), 600);
    return () => clearTimeout(t);
  }, [url, open]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const target = folderId === HOME ? null : folderId;
    const res = await createBookmark({
      url,
      title: title.trim() || preview?.title || "",
      description: description.trim() || preview?.description || "",
      folderId: target,
      launchOnStart: launch,
      favicon: preview?.favicon ?? null,
    });
    setSaving(false);
    if (!res.ok) return setError(res.error);
    onOpenChange(false);
    const where = target ? (folders.find((f) => f.id === target)?.name ?? "folder") : "Home";
    toast.success(`Saved to ${where}`, {
      action: { label: "Show", onClick: () => router.push(target ? `/f/${target}` : "/") },
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Add bookmark" description="Paste a link. The title and icon are filled in when the page allows it.">
      <form onSubmit={submit} className="space-y-5">
        <Field label="URL">
          <div className="relative">
            <input
              autoFocus
              required
              inputMode="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onBlur={() => lookUp(url)}
              className={inputClass}
              placeholder="https://"
            />
            {looking && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted" />}
          </div>
        </Field>

        {preview && (
          <div className="flex items-center gap-3 rounded-xl border border-line bg-bg px-3 py-2.5">
            {preview.favicon ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview.favicon} alt="" className="h-6 w-6 rounded" />
            ) : (
              <span className="grid h-6 w-6 place-items-center rounded bg-elevated text-xs font-bold">{preview.domain.charAt(0).toUpperCase()}</span>
            )}
            <div className="min-w-0">
              <p dir="auto" className="truncate text-left text-sm font-semibold">{preview.title ?? preview.domain}</p>
              <p className="truncate text-xs text-muted">{preview.domain}</p>
            </div>
          </div>
        )}
        {preview?.duplicateIn && (
          <p className="flex items-start gap-2 rounded-xl bg-accent/10 px-3 py-2.5 text-sm text-accent">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            You already saved this link in “{preview.duplicateIn}”. You can still add it again.
          </p>
        )}

        <Field label="Title">
          <input dir="auto" value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} placeholder={preview?.title ?? "Fetched from the page if left empty"} />
        </Field>
        <Field label="Description">
          <textarea dir="auto" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} placeholder={preview?.description ?? ""} />
        </Field>
        <FolderSelect label="Save in" value={folderId} onChange={setFolderId} folders={folders} />
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" checked={launch} onChange={(e) => setLaunch(e.target.checked)} className="h-4.5 w-4.5 accent-[#ffb600]" />
          Include in this folder&apos;s Launch Workspace
        </label>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" type="submit" disabled={saving || !url.trim()}>
            {saving ? "Saving…" : "Add bookmark"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */

export function EditBookmarkDialog({
  open,
  onOpenChange,
  bookmark,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  bookmark: BookmarkView;
}) {
  const [title, setTitle] = useState(bookmark.title);
  const [url, setUrl] = useState(bookmark.url);
  const [description, setDescription] = useState(bookmark.description ?? "");
  const [launch, setLaunch] = useState(bookmark.launchOnStart);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setTitle(bookmark.title);
      setUrl(bookmark.url);
      setDescription(bookmark.description ?? "");
      setLaunch(bookmark.launchOnStart);
      setError(null);
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await updateBookmark({ id: bookmark.id, title, url, description, launchOnStart: launch });
    setSaving(false);
    if (!res.ok) return setError(res.error);
    onOpenChange(false);
    toast.success("Saved");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Edit bookmark">
      <form onSubmit={submit} className="space-y-5">
        <Field label="Title">
          <input dir="auto" required value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
        </Field>
        <Field label="URL">
          <input required inputMode="url" value={url} onChange={(e) => setUrl(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Description">
          <textarea dir="auto" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
        </Field>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" checked={launch} onChange={(e) => setLaunch(e.target.checked)} className="h-4.5 w-4.5 accent-[#ffb600]" />
          Include in this folder&apos;s Launch Workspace
        </label>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" type="submit" disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </div>
      </form>
    </Dialog>
  );
}

export function RenameFolderDialog({
  open,
  onOpenChange,
  id,
  name: initial,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  id: string;
  name: string;
}) {
  const [name, setName] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setName(initial);
      setError(null);
    }
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await renameFolder(id, name);
    setSaving(false);
    if (!res.ok) return setError(res.error);
    onOpenChange(false);
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Rename folder">
      <form onSubmit={submit} className="space-y-5">
        <Field label="Name">
          <input dir="auto" autoFocus required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </Field>
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" type="submit" disabled={saving || !name.trim()}>{saving ? "Saving…" : "Rename"}</Button>
        </div>
      </form>
    </Dialog>
  );
}
