export type TwoFactorPendingTokenPayload = {
  purpose: 'admin-2fa';
  sub: string;
  email: string;
  tenantId: string;
  roles: string[];
};
