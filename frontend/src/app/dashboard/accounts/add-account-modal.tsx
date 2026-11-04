"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { Alert } from "@/components/ui/alert";
import { useToast } from "@/components/ui/toast";
import { PROVIDER_LIST } from "@/data/providers";
import { accountSchema, type AccountValues } from "@/lib/schemas";
import { apiFetch, ApiError } from "@/lib/api-client";
import type { ApiPaymentAccount } from "@/types/api";

/**
 * Add-account modal. Records a payment account against the merchant — no
 * provider API is contacted and no PIN or OTP is ever requested. ZevaPay only
 * needs the number so it can attribute incoming notifications.
 */
export function AddAccountModal({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (account: ApiPaymentAccount) => void;
}) {
  const { toast } = useToast();
  const [formError, setFormError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AccountValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      provider: undefined,
      accountNumber: "",
      accountType: undefined,
      label: "",
    } as unknown as AccountValues,
  });

  function handleClose() {
    reset();
    setFormError(null);
    onClose();
  }

  async function onSubmit(values: AccountValues) {
    setFormError(null);

    try {
      const response = await apiFetch<{ account: ApiPaymentAccount }>(
        "/api/v1/merchant/accounts",
        {
          method: "POST",
          body: {
            provider: values.provider,
            accountNumber: values.accountNumber.trim(),
            accountType: values.accountType,
            label: values.label.trim(),
          },
        },
      );

      onSave(response.account);
      toast({
        title: "Account saved",
        description: `${response.account.label} was added to this merchant.`,
        tone: "success",
      });
      handleClose();
    } catch (error) {
      if (error instanceof ApiError) {
        const fields = error.fieldErrors;
        if (fields.provider) setError("provider", { message: fields.provider });
        if (fields.accountNumber) {
          setError("accountNumber", { message: fields.accountNumber });
        }
        if (fields.accountType) {
          setError("accountType", { message: fields.accountType });
        }
        if (fields.label) setError("label", { message: fields.label });
        setFormError(error.message);
        return;
      }
      setFormError("We could not reach the server. Please try again.");
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Add payment account"
      description="Connect a mobile financial services account to this merchant."
      footer={
        <>
          <Button variant="outline" onClick={handleClose} type="button">
            Cancel
          </Button>
          <Button type="submit" form="add-account-form" loading={isSubmitting}>
            Save account
          </Button>
        </>
      }
    >
      <form
        id="add-account-form"
        onSubmit={handleSubmit(onSubmit)}
        noValidate
      >
        <Alert tone="info" className="mb-5">
          ZevaPay only needs the account number so it can attribute incoming
          notifications to this account. We never ask for a PIN or an OTP, and
          we never connect to the provider.
        </Alert>

        {formError ? (
          <Alert tone="danger" className="mb-5">
            {formError}
          </Alert>
        ) : null}

        <div className="flex flex-col gap-4">
          <div>
            <Label htmlFor="account-provider" required>
              Payment provider
            </Label>
            <Select
              id="account-provider"
              error={errors.provider?.message}
              defaultValue=""
              {...register("provider")}
            >
              <option value="">Select a provider</option>
              {PROVIDER_LIST.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <Label htmlFor="account-number" required>
              Account number
            </Label>
            <Input
              id="account-number"
              inputMode="numeric"
              placeholder="01712345678"
              error={errors.accountNumber?.message}
              hint="The mobile number registered with the provider."
              {...register("accountNumber")}
            />
          </div>

          <div>
            <Label htmlFor="account-type" required>
              Account type
            </Label>
            <Select
              id="account-type"
              error={errors.accountType?.message}
              defaultValue=""
              {...register("accountType")}
            >
              <option value="">Select an account type</option>
              <option value="PERSONAL">Personal</option>
              <option value="MERCHANT">Merchant</option>
              <option value="AGENT">Agent</option>
              <option value="BUSINESS">Business</option>
            </Select>
          </div>

          <div>
            <Label htmlFor="account-label" required>
              Account label
            </Label>
            <Input
              id="account-label"
              placeholder="e.g. Main Counter Wallet"
              error={errors.label?.message}
              {...register("label")}
            />
          </div>
        </div>
      </form>
    </Modal>
  );
}
