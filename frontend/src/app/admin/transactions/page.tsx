import * as React from "react";
import { AdminTransactionsList } from "./transactions-list";

export default function AdminTransactionsPage() {
  return (
    <React.Suspense fallback={null}>
      <AdminTransactionsList />
    </React.Suspense>
  );
}
