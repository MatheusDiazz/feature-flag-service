import pg from "pg";

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL});

export function isUniqueViolation(err: unknown): boolean {
  return err instanceof Error && "code" in err && err.code === "23505";
}