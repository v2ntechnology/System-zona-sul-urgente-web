// Liveness do processo Next, usado pelo healthcheck do Docker/Uptime Kuma.
export function GET() {
  return Response.json({ status: "UP" });
}
