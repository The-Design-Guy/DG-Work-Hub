"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Dialog, Field, inputClass } from "./ui/dialog";
import { Button } from "./ui/button";

const NOT_YET = "Saving is connected in the next step.";

export function NewFolderDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [name, setName] = useState("");
  function submit(e: FormEvent) {
    e.preventDefault();
    toast(NOT_YET);
    onOpenChange(false);
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="New folder">
      <form onSubmit={submit} className="space-y-5">
        <Field label="Name">
          <input
            autoFocus
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="e.g. BOOKREATOR"
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" type="submit">Create folder</Button>
        </div>
      </form>
    </Dialog>
  );
}

export function AddBookmarkDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  function submit(e: FormEvent) {
    e.preventDefault();
    toast(NOT_YET);
    onOpenChange(false);
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Add bookmark" description="Paste a link. Title and icon are fetched automatically when possible.">
      <form onSubmit={submit} className="space-y-5">
        <Field label="URL">
          <input autoFocus required type="url" inputMode="url" className={inputClass} placeholder="https://" />
        </Field>
        <Field label="Title" hint="Leave empty to fetch it from the page.">
          <input className={inputClass} />
        </Field>
        <Field label="Description">
          <textarea rows={2} className={inputClass} />
        </Field>
        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" className="h-4.5 w-4.5 accent-[#ffb600]" />
          Include in this folder&apos;s Launch Workspace
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" type="submit">Add bookmark</Button>
        </div>
      </form>
    </Dialog>
  );
}
