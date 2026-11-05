import * as React from "react";
import { AdminMerchantsList } from "./merchants-list";

export default function AdminMerchantsPage() {
  return (
    <React.Suspense fallback={null}>
      <AdminMerchantsList />
    </React.Suspense>
  );
}
