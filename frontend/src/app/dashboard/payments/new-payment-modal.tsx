"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { apiFetch, ApiError } from "@/lib/api-client";

export function NewPaymentModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [amount, setAmount] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [error, setError] = React.useState<string | undefined>();
  const [saving, setSaving] = React.useState(false);

  function reset() {
    setAmount("");
    setDescription("");
    setError(undefined);
  }

  function close() {
    reset();
    onClose();
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = Number(amount.replace(/,/g, ""));
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/api/v1/merchant/payments", {
        method: "POST",
        body: {
          amountMinor: Math.round(value * 100),
          currency: "BDT",
          description: description.trim() || undefined,
        },
      });
      toast({ title: "Payment created", tone: "success" });
      reset();
      onCreated();
    } catch (caught) {
      toast({
        title: "Could not create the payment",
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
      onClose={close}
      title="New payment"
      description="Raise a payment to track what you expect to collect."
      size="sm"
    >
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <div>
          <Label htmlFor="payment-amount" required>
            Amount (BDT)
          </Label>
          <Input
            id="payment-amount"
            inputMode="decimal"
            placeholder="2,450"
            value={amount}
            error={error}
            onChange={(event) => {
              setAmount(event.target.value);
              setError(undefined);
            }}
          />
        </div>
        <div>
          <Label htmlFor="payment-description">Description</Label>
          <Textarea
            id="payment-description"
            rows={3}
            maxLength={500}
            placeholder="Order 1042"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={close} disabled={saving}>
            Close
          </Button>
          <Button type="submit" loading={saving}>
            Create payment
          </Button>
        </div>
      </form>
    </Modal>
  );
}
