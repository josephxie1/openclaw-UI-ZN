import fs from "node:fs";
import path from "node:path";
import { resolveAgentWorkspaceDir } from "../../agents/agent-scope.js";
import { loadConfig } from "../../config/config.js";
import { normalizeAgentId } from "../../routing/session-key.js";
import { resolveUserPath } from "../../utils.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

const AVATAR_MAX_BYTES = 512_000; // 512 KB
const SUPPORTED_MIME_TYPES: Record<string, string> = {
  "image/svg+xml": ".svg",
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
};

/**
 * Decode a data URI into raw bytes and detected extension.
 */
function decodeDataUri(dataUri: string): { buffer: Buffer; ext: string } | null {
  const match = dataUri.match(/^data:(image\/[a-z+]+);base64,(.+)$/i);
  if (!match) {
    return null;
  }
  const mimeType = match[1].toLowerCase();
  const ext = SUPPORTED_MIME_TYPES[mimeType];
  if (!ext) {
    return null;
  }
  try {
    const buffer = Buffer.from(match[2], "base64");
    return { buffer, ext };
  } catch {
    return null;
  }
}

export const agentAvatarHandlers: GatewayRequestHandlers = {
  "agent.avatar.save": ({ params, respond }) => {
    const p = params as { agentId?: string; dataUri?: string; workspace?: string } | undefined;
    const agentIdRaw = typeof p?.agentId === "string" ? p.agentId.trim() : "";
    const dataUri = typeof p?.dataUri === "string" ? p.dataUri : "";
    const workspaceRaw = typeof p?.workspace === "string" ? p.workspace.trim() : "";

    if (!agentIdRaw) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "agentId is required"));
      return;
    }
    if (!dataUri) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "dataUri is required"));
      return;
    }

    const decoded = decodeDataUri(dataUri);
    if (!decoded) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "invalid or unsupported data URI"),
      );
      return;
    }
    if (decoded.buffer.length > AVATAR_MAX_BYTES) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "avatar too large"));
      return;
    }

    const agentId = normalizeAgentId(agentIdRaw);
    const cfg = loadConfig();

    // Resolve workspace directory
    let workspaceDir: string;
    if (workspaceRaw) {
      workspaceDir = resolveUserPath(workspaceRaw);
    } else {
      workspaceDir = resolveAgentWorkspaceDir(cfg, agentId);
    }

    // Ensure workspace directory exists
    try {
      fs.mkdirSync(workspaceDir, { recursive: true });
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, `failed to create workspace: ${String(err)}`),
      );
      return;
    }

    // Save avatar file
    const fileName = `avatar${decoded.ext}`;
    const filePath = path.join(workspaceDir, fileName);
    try {
      fs.writeFileSync(filePath, decoded.buffer);
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, `failed to write avatar: ${String(err)}`),
      );
      return;
    }

    respond(true, { path: fileName, absolutePath: filePath });
  },
};
