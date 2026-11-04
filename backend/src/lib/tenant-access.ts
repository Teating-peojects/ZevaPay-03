const PLATFORM_ROLES = new Set(["SUPER_ADMIN", "ADMIN", "SUPPORT"]);

export function canAccessMerchant(role: string, sessionMerchantId: string | null, targetMerchantId: string): boolean {
  if (PLATFORM_ROLES.has(role)) return targetMerchantId.length > 0;
  return sessionMerchantId !== null && sessionMerchantId === targetMerchantId;
}
