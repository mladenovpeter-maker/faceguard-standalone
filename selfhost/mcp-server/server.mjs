import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";
import { execSync } from "child_process";
import { z } from "zod";

const server = new McpServer({ name: "faceguard-shell", version: "1.0.0" });

server.tool(
  "bash",
  "Run a shell command on the FaceGuard home server. Default cwd is /workspace (the repo root).",
  { command: z.string(), cwd: z.string().optional() },
  async ({ command, cwd }) => {
    try {
      const output = execSync(command, {
        cwd: cwd ?? "/workspace",
        timeout: 120_000,
        encoding: "utf8",
        env: { ...process.env, DOCKER_HOST: "unix:///var/run/docker.sock" },
      });
      return { content: [{ type: "text", text: output || "(no output)" }] };
    } catch (err) {
      const msg = [err.stdout, err.stderr].filter(Boolean).join("\n") || err.message;
      return { content: [{ type: "text", text: msg }] };
    }
  }
);

const app = express();
const transports = {};

app.get("/sse", async (req, res) => {
  const transport = new SSEServerTransport("/messages", res);
  transports[transport.sessionId] = transport;
  res.on("close", () => delete transports[transport.sessionId]);
  await server.connect(transport);
});

app.post("/messages", express.json(), async (req, res) => {
  const sessionId = req.query.sessionId;
  const transport = transports[sessionId];
  if (!transport) { res.status(404).send("Session not found"); return; }
  await transport.handlePostMessage(req, res);
});

app.get("/health", (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT ?? 9100;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`MCP shell server listening on :${PORT}`);
});
