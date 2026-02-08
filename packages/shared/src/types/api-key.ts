export type ApiKeyOwnerType = "agent" | "employee";

export interface ApiKey {
  id: string;
  ownerType: ApiKeyOwnerType;
  ownerId: string;
  keyPrefix: string;
  scopes: string[];
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  isRevoked: boolean;
  createdAt: Date;
}

export interface ApiKeyOwner {
  type: ApiKeyOwnerType;
  id: string;
  scopes: string[];
}

export interface GeneratedApiKey {
  key: string;
  prefix: string;
}
