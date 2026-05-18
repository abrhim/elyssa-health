import { TOOLS } from "./tools.ts";
import { handleToolCall } from "./handlers.ts";

const SERVER_INFO = {
  name: "elyssa-health",
  version: "1.0.0",
};

const CAPABILITIES = {
  tools: {},
};

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

function rpcResult(id: string | number, result: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id, result };
}

function rpcError(id: string | number, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

async function handleRpc(req: JsonRpcRequest): Promise<JsonRpcResponse | null> {
  const { method, params, id } = req;

  // Notifications (no id) don't get responses
  if (id === undefined || id === null) return null;

  switch (method) {
    case "initialize":
      return rpcResult(id, {
        protocolVersion: "2025-03-26",
        serverInfo: SERVER_INFO,
        capabilities: CAPABILITIES,
      });

    case "ping":
      return rpcResult(id, {});

    case "tools/list":
      return rpcResult(id, { tools: TOOLS });

    case "tools/call": {
      const name = params?.name as string;
      const args = (params?.arguments ?? {}) as Record<string, unknown>;
      if (!name) return rpcError(id, -32602, "Missing tool name");
      const tool = TOOLS.find((t) => t.name === name);
      if (!tool) return rpcError(id, -32602, `Unknown tool: ${name}`);

      try {
        const content = await handleToolCall(name, args);
        return rpcResult(id, { content });
      } catch (e: unknown) {
        return rpcResult(id, {
          content: [{ type: "text", text: `Tool error: ${(e as Error).message}` }],
          isError: true,
        });
      }
    }

    default:
      return rpcError(id, -32601, `Method not found: ${method}`);
  }
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id",
  "Access-Control-Expose-Headers": "Mcp-Session-Id",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // GET — SSE endpoint (not implemented for stateless mode)
  if (req.method === "GET") {
    return new Response(
      JSON.stringify({ name: SERVER_INFO.name, version: SERVER_INFO.version, status: "ok" }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: CORS_HEADERS });
  }

  try {
    const body = await req.json();

    // Handle batch requests
    if (Array.isArray(body)) {
      const responses = (
        await Promise.all(body.map((r: JsonRpcRequest) => handleRpc(r)))
      ).filter(Boolean);
      return new Response(JSON.stringify(responses), {
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // Single request
    const response = await handleRpc(body as JsonRpcRequest);
    if (!response) {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }
    return new Response(JSON.stringify(response), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = (e as Error).message;
    console.error(`[elyssa-mcp] Error: ${msg}`);
    return new Response(
      JSON.stringify(rpcError(0, -32700, `Parse error: ${msg}`)),
      { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});
