export const errorHasMessage = (error: unknown): error is { message: string } =>
  error !== null &&
  typeof error === "object" &&
  "message" in error &&
  typeof (error as Record<string, unknown>).message === "string";
