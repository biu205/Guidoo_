// A small typed error so route handlers can `throw` and one catch block at
// the bottom of each route turns it into the right HTTP status + JSON body.
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

export function errorResponseBody(err: unknown): { status: number; body: { error: string } } {
  if (err instanceof ApiError) {
    return { status: err.status, body: { error: err.message } };
  }
  // Don't leak internals (DB connection strings, stack traces) to the client.
  console.error(err);
  return { status: 500, body: { error: "Internal server error" } };
}
