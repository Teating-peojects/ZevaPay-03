"use client";

import * as React from "react";
import { UserPlus, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiFetch, ApiError } from "@/lib/api-client";
import { formatDate, formatDateTime } from "@/lib/format";
import { ROLE_LABELS } from "@/lib/roles";
import type { ApiUser } from "@/types/api";
import { AddMemberModal } from "./add-member-modal";

export default function TeamPage() {
  const [members, setMembers] = React.useState<ApiUser[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [adding, setAdding] = React.useState(false);
  const [reload, setReload] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    apiFetch<{ users: ApiUser[] }>("/api/v1/merchant/team")
      .then((response) => {
        if (!cancelled) {
          setMembers(response.users);
          setError(null);
        }
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(caught instanceof ApiError ? caught.message : "The team could not be loaded.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const columns: Column<ApiUser>[] = [
    {
      key: "name",
      header: "Member",
      render: (member) => (
        <span className="block">
          <span className="block text-[13px] font-medium text-ink">{member.fullName}</span>
          <span className="block text-[12px] text-ink-muted">{member.email}</span>
        </span>
      ),
      sortValue: (member) => member.fullName,
    },
    {
      key: "role",
      header: "Role",
      render: (member) => <Badge tone="neutral">{ROLE_LABELS[member.role]}</Badge>,
      sortValue: (member) => member.role,
    },
    {
      key: "status",
      header: "Status",
      render: (member) => (
        <Badge tone={member.isActive ? "success" : "danger"} dot>
          {member.isActive ? "Active" : "Deactivated"}
        </Badge>
      ),
    },
    {
      key: "lastLogin",
      header: "Last sign-in",
      render: (member) => (
        <span className="text-[13px] text-ink-muted">
          {member.lastLoginAt ? formatDateTime(member.lastLoginAt) : "Never"}
        </span>
      ),
      sortValue: (member) => member.lastLoginAt ?? "",
    },
    {
      key: "joined",
      header: "Added",
      align: "right",
      render: (member) => (
        <span className="text-[13px] text-ink-muted">{formatDate(member.createdAt)}</span>
      ),
      sortValue: (member) => member.createdAt,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Team"
        description="The people who can sign in to your business."
        actions={
          <Button onClick={() => setAdding(true)}>
            <UserPlus className="size-4" aria-hidden="true" />
            Add member
          </Button>
        }
      />

      <DataTable
        columns={columns}
        rows={members}
        loading={loading}
        error={error ?? undefined}
        emptyTitle="No team members"
        emptyDescription="Add a member to give someone access to your business."
        emptyIcon={Users}
        hideExport
      />

      <AddMemberModal
        open={adding}
        onClose={() => setAdding(false)}
        onAdded={() => {
          setAdding(false);
          setReload((n) => n + 1);
        }}
      />
    </div>
  );
}
