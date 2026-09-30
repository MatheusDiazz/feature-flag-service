import { execSync } from "node:child_process";

export default function setup() {
  execSync("tsx src/migrate.ts", { stdio: "inherit" });
}