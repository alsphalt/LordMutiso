-- Add the ISO 3166-1 alpha-2 country chosen at registration.
-- NOTE: this migration must be applied to Neon before the new registration
-- code is deployed. Run `npx prisma migrate deploy` (or the SQL below).
ALTER TABLE "User" ADD COLUMN "country" TEXT;
