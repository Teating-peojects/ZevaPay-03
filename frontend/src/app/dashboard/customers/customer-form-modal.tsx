"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { ApiCustomer } from "@/types/api";

/** Creates a customer, or edits one when `customer` is given. */
export function CustomerFormModal({
  open,
  customer,
  onClose,
  onSaved,
}: {
  open: boolean;
  customer?: ApiCustomer;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | undefined>();

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = (key: string) => String(form.get(key) ?? "").trim() || null;
    const body = {
      name: value("name"),
      email: value("email"),
      phone: value("phone"),
      notes: value("notes"),
    };
    if (!body.name && !body.email && !body.phone) {
      setError("Enter a name, an email, or a phone number.");
      return;
    }
    setSaving(true);
    try {
      await apiFetch(
        customer ? `/api/v1/merchant/customers/${customer.id}` : "/api/v1/merchant/customers",
        { method: customer ? "PATCH" : "POST", body },
      );
      toast({ title: customer ? "Customer updated" : "Customer added", tone: "success" });
      onSaved();
    } catch (caught) {
      toast({
        title: "Could not save the customer",
        description: caught instanceof ApiError ? caught.message : undefined,
        tone: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={customer ? "Edit customer" : "Add customer"}
      size="md"
    >
      <form
        key={customer?.id ?? "new"}
        onSubmit={submit}
        onChange={() => setError(undefined)}
        className="flex flex-col gap-4"
        noValidate
      >
        <div>
          <Label htmlFor="customer-name">Name</Label>
          <Input id="customer-name" name="name" defaultValue={customer?.name ?? ""} error={error} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="customer-email">Email</Label>
            <Input id="customer-email" name="email" type="email" defaultValue={customer?.email ?? ""} />
          </div>
          <div>
            <Label htmlFor="customer-phone">Phone</Label>
            <Input id="customer-phone" name="phone" defaultValue={customer?.phone ?? ""} />
          </div>
        </div>
        <div>
          <Label htmlFor="customer-notes">Notes</Label>
          <Textarea id="customer-notes" name="notes" rows={3} maxLength={2000} defaultValue={customer?.notes ?? ""} />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Close
          </Button>
          <Button type="submit" loading={saving}>
            {customer ? "Save changes" : "Add customer"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
