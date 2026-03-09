/*
 * This helper function returns a flag stating the current environment.
 * If an environment variable is found with NODE_ENV set to true,
 * then it is a prod environment. Otherwise, dev.
 * Returns true if the application is running in production.
 */
import process from "process";
export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}
