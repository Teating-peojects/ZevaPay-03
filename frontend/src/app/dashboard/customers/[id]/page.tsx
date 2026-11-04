import * as React from "react";
import { CustomerDetailScreen } from "./customer-detail-screen";

/**
 * The customer detail route. The `Suspense` boundary is required: with cache
 * components on, a client hook that reads a dynamic param suspends during
 * prerendering, and Next.js needs a boundary to render the shell around it.
 */
export default function CustomerDetailPage() {
  return (
    <React.Suspense fallback={null}>
      <CustomerDetailScreen />
    </React.Suspense>
  );
}
