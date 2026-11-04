import * as React from "react";
import { TransactionsList } from "./transactions-list";

export default function TransactionsPage() {
  return (
    <React.Suspense fallback={null}>
      <TransactionsList />
    </React.Suspense>
  );
}
