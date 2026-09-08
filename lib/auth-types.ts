/** Client-safe authenticated user shape (no server imports in this file). */
export interface AuthUser {
  id: string;
  username: string;
  email: string;
  image: string | null;
  country?: string | null; // ISO 3166-1 alpha-2, e.g. "KE"
  createdAt: string;
}
