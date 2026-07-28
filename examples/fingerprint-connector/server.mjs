import http from "node:http";

const port = Number(process.env.CONNECTOR_PORT || 8787);
const baseUrl = String(process.env.SIMAMIA_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
const deviceSecret = String(process.env.SIMAMIA_DEVICE_SECRET || "");
const serialNumber = String(process.env.SIMAMIA_DEVICE_SERIAL || "");

if (!deviceSecret || !serialNumber) {
  console.error("Set SIMAMIA_DEVICE_SECRET and SIMAMIA_DEVICE_SERIAL.");
  process.exit(1);
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

async function relayPunch(payload) {
  const response = await fetch(`${baseUrl}/api/attendance/device-punch`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-device-key": deviceSecret,
    },
    body: JSON.stringify({
      serialNumber,
      externalUserCode: String(payload.externalUserCode || payload.userCode || ""),
      occurredAt: payload.occurredAt || new Date().toISOString(),
      session: payload.session || undefined,
      vendorEventId: payload.vendorEventId || null,
    }),
  });

  const raw = await response.text();
  const result = raw ? JSON.parse(raw) : {};
  if (!response.ok) throw new Error(result.message || `Simamia returned ${response.status}`);
  return result;
}

const server = http.createServer(async (request, response) => {
  response.setHeader("Content-Type", "application/json; charset=utf-8");

  if (request.method === "GET" && request.url === "/health") {
    response.end(JSON.stringify({ ok: true, serialNumber, baseUrl }));
    return;
  }

  if (request.method !== "POST" || request.url !== "/punch") {
    response.statusCode = 404;
    response.end(JSON.stringify({ ok: false, message: "Use POST /punch" }));
    return;
  }

  try {
    const payload = await readJson(request);
    const result = await relayPunch(payload);
    response.statusCode = 200;
    response.end(JSON.stringify({ ok: true, result }));
  } catch (error) {
    console.error("[FINGERPRINT_CONNECTOR]", error);
    response.statusCode = 502;
    response.end(JSON.stringify({
      ok: false,
      message: error instanceof Error ? error.message : "Punch relay failed.",
    }));
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Fingerprint connector listening on http://0.0.0.0:${port}`);
  console.log(`Health check: http://localhost:${port}/health`);
});
