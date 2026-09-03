/** Client-safe authenticated user shape (no server imports in this file). */
export interface AuthUser {
  id: string;
  username: string;
  email: string;
  image: string | null;
  createdAt: string;
}
