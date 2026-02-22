export type TenantAddress = {
  country?: string;
  city?: string;
  region?: string;
  street?: string;
  phone?: string;
  website?: string;
};

export type TenantCreatorSnapshot = {
  userId: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  createdAt?: string;
};

export type TenantConfig = {
  type?: string;
  onboardingComplete?: boolean;
  createdByUserId?: string;
  createdBy?: TenantCreatorSnapshot;
  address?: TenantAddress;
  [key: string]: any;
};

export function asTenantConfig(config: unknown): TenantConfig {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return {};
  return config as TenantConfig;
}
