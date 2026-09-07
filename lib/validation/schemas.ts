import { z } from "zod";
import { CHAT_MAX_LENGTH, USERNAME_REGEX } from "@/lib/constants";

export const usernameSchema = z
  .string()
  .min(3, "Username must be 3–20 characters")
  .max(20, "Username must be 3–20 characters")
  .regex(USERNAME_REGEX, "Username may only contain letters, numbers and underscores");

export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password is too long");

export const emailSchema = z.string().email("Please enter a valid email address").max(120);

export const registerSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  identifier: z.string().trim().min(3, "Enter your email or username").max(120),
  password: z.string().min(1, "Password is required").max(72),
});

export const profileSchema = z
  .object({
    username: usernameSchema.optional(),
    image: z
      .union([z.literal(""), z.string().url("Profile picture must be a valid URL").max(500)])
      .optional(),
    currentPassword: z.string().max(72).optional(),
    newPassword: passwordSchema.optional(),
  })
  .superRefine((val, ctx) => {
    if (val.newPassword && !val.currentPassword) {
      ctx.addIssue({ code: "custom", path: ["currentPassword"], message: "Enter your current password to set a new one" });
    }
  });

export const chatMessageSchema = z
  .string()
  .trim()
  .min(1, "Message cannot be empty")
  .max(CHAT_MAX_LENGTH, `Message must be ${CHAT_MAX_LENGTH} characters or fewer`);

export const createRoomSchema = z.object({
  type: z.enum(["LUDO", "CHESS", "CHECKERS"]),
  mode: z.enum(["QUICK", "PRIVATE"]).optional(), // legacy clients omit mode -> PRIVATE (code room)
  name: z
    .string()
    .trim()
    .min(1, "Enter a room name")
    .max(40, "Room name must be 40 characters or fewer")
    .optional(),
});

export const joinRoomSchema = z.object({
  roomCode: z
    .string()
    .trim()
    .min(4, "Enter a valid room code")
    .max(10)
    .transform((s) => s.toUpperCase().replace(/[^A-Z0-9]/g, "")),
});

export const dicePoseSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    rotX: z.number().min(-1080).max(1080).optional(),
    rotY: z.number().min(-1080).max(1080).optional(),
    rotZ: z.number().min(-1080).max(1080).optional(),
    qx: z.number().min(-1.0001).max(1.0001).optional(),
    qy: z.number().min(-1.0001).max(1.0001).optional(),
    qz: z.number().min(-1.0001).max(1.0001).optional(),
    qw: z.number().min(-1.0001).max(1.0001).optional(),
  })
  .optional()
  .nullable();

export const gameActionSchema = z.object({
  action: z.enum(["start", "roll", "move", "resign", "rematch", "leave"]),
  // Ludo "move"
  token: z.number().int().min(0).max(7).optional(),
  // Ludo "roll": the die value comes from the physical cube's top face.
  // Absent (e.g. idle auto-roll) -> the server rolls instead.
  die: z.number().int().min(1).max(6).optional(),
  // Ludo "roll": where the physical die came to rest (board fractions + quat).
  dice: dicePoseSchema,
  // Chess / Checkers "move"
  from: z.number().int().min(0).max(63).optional(),
  to: z.number().int().min(0).max(63).optional(),
  promotion: z.enum(["q", "r", "b", "n"]).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
export type GameActionInput = z.infer<typeof gameActionSchema>;
