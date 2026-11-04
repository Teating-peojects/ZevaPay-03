"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/form";
import {
  createMerchantSchema,
  type CreateMerchantValues,
} from "@/lib/schemas";

/**
 * The admin console's "register a merchant" form.
 *
 * It posts to the real endpoint, which creates the merchant and an owner
 * account in one go. The account is created without a password, because the
 * backend cannot send an invitation email yet — the page says so.
 */
export function MerchantForm({
  open,
  onClose,
  onSave,
  saving,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (values: CreateMerchantValues) => void;
  saving: boolean;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateMerchantValues>({
    resolver: zodResolver(createMerchantSchema),
    defaultValues: {
      businessName: "",
      ownerName: "",
      email: "",
      phone: "",
      status: "ACTIVE",
    },
  });

  function close() {
    reset();
    onClose();
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Register a merchant"
      description="Creates the merchant and an owner account on the platform."
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={close} type="button">
            Cancel
          </Button>
          <Button
            type="submit"
            form="create-merchant-form"
            loading={saving}
          >
            Create merchant
          </Button>
        </>
      }
    >
      <form
        id="create-merchant-form"
        onSubmit={handleSubmit(onSave)}
        noValidate
      >
        <div className="flex flex-col gap-4">
          <div>
            <Label htmlFor="merchant-business-name" required>
              Business name
            </Label>
            <Input
              id="merchant-business-name"
              error={errors.businessName?.message}
              {...register("businessName")}
            />
          </div>

          <div>
            <Label htmlFor="merchant-owner-name" required>
              Owner name
            </Label>
            <Input
              id="merchant-owner-name"
              error={errors.ownerName?.message}
              {...register("ownerName")}
            />
          </div>

          <div>
            <Label htmlFor="merchant-email" required>
              Email
            </Label>
            <Input
              id="merchant-email"
              type="email"
              error={errors.email?.message}
              {...register("email")}
            />
          </div>

          <div>
            <Label htmlFor="merchant-phone">Mobile number</Label>
            <Input
              id="merchant-phone"
              inputMode="numeric"
              placeholder="01712345678"
              error={errors.phone?.message}
              {...register("phone")}
            />
          </div>

          <div>
            <Label htmlFor="merchant-status" required>
              Account status
            </Label>
            <Select
              id="merchant-status"
              error={errors.status?.message}
              {...register("status")}
            >
              <option value="ACTIVE">Active — can use ZevaPay now</option>
              <option value="PENDING_REVIEW">In review — documents to check</option>
              <option value="SUSPENDED">Suspended — no dashboard access</option>
            </Select>
          </div>
        </div>
      </form>
    </Modal>
  );
}
