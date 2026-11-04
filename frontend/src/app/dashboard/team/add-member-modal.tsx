"use client";

import * as React from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { apiFetch, ApiError } from "@/lib/api-client";
import { MEMBER_ROLES } from "@/lib/roles";

export function AddMemberModal({
  open,
  onClose,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: () => void;
}) {
  const { toast } = useToast();
  const [role, setRole] = React.useState(MEMBER_ROLES[2].value);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const fullName = String(form.get("fullName") ?? "").trim();
    const email = String(form.get("email") ?? "").trim().toLowerCase();

    if (fullName.length < 2) return setError("Enter the person's name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError("Enter a valid email address.");

    setError(null);
    setSaving(true);
    try {
      await apiFetch("/api/v1/merchant/team", {
        method: "POST",
        body: { fullName, email, role },
      });
      toast({
        title: "Member added",
        description: "They can set a password with Forgot password on the sign-in page.",
        tone: "success",
      });
      onAdded();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The member could not be added.");
    } finally {
      setSaving(false);
    }
  }

  const selected = MEMBER_ROLES.find((entry) => entry.value === role);

  return (
    <Modal open={open} onClose={onClose} title="Add team member" size="sm">
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <div>
          <Label htmlFor="member-name" required>Full name</Label>
          <Input id="member-name" name="fullName" autoComplete="off" />
        </div>
        <div>
          <Label htmlFor="member-email" required>Email</Label>
          <Input id="member-email" name="email" type="email" autoComplete="off" />
        </div>
        <div>
          <Label htmlFor="member-role">Role</Label>
          <Select
            id="member-role"
            value={role}
            onChange={(event) => setRole(event.target.value as typeof role)}
          >
            {MEMBER_ROLES.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </Select>
          {selected ? (
            <p className="mt-1.5 text-[12px] text-ink-muted">{selected.description}</p>
          ) : null}
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Close
          </Button>
          <Button type="submit" loading={saving}>
            Add member
          </Button>
        </div>
      </form>
    </Modal>
  );
}
