import type { Response } from "express";
import { z } from "zod";

export function sendValidationError(res: Response, error: z.ZodError) {
  res.status(400).json({ error: "invalid input", details: z.flattenError(error) });
}

export function isUuid(value: string): boolean {
  return z.uuid().safeParse(value).success;
}