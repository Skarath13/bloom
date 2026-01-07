import { NextResponse } from "next/server";
import {
  getIntegration,
  updateIntegrationConfig,
  upsertSecret,
  getSecrets,
  checkSecretsExist,
  maskSecret,
  deleteSecret,
} from "@/lib/vault";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/integrations/[id] - Get integration details with masked secrets
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const integration = await getIntegration(id);

    if (!integration) {
      return NextResponse.json(
        { error: "Integration not found" },
        { status: 404 }
      );
    }

    // Get all secret values for this integration
    const secretNames = integration.secret_keys.map((sk) => sk.key);
    const secrets = await getSecrets(secretNames);

    // Prepare masked versions of secrets
    const maskedSecrets: Record<string, { exists: boolean; masked: string }> = {};
    for (const secretKey of integration.secret_keys) {
      const value = secrets[secretKey.key];
      if (value) {
        maskedSecrets[secretKey.key] = {
          exists: true,
          masked: secretKey.masked ? maskSecret(value) : value,
        };
      } else {
        maskedSecrets[secretKey.key] = {
          exists: false,
          masked: "",
        };
      }
    }

    return NextResponse.json({
      integration,
      secrets: maskedSecrets,
    });
  } catch (error) {
    console.error("Error fetching integration:", error);
    return NextResponse.json(
      { error: "Failed to fetch integration" },
      { status: 500 }
    );
  }
}

// PUT /api/integrations/[id] - Update integration config and secrets
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { secrets, config, is_enabled } = body;

    const integration = await getIntegration(id);
    if (!integration) {
      return NextResponse.json(
        { error: "Integration not found" },
        { status: 404 }
      );
    }

    // Update secrets (only if value is provided and not empty)
    if (secrets && typeof secrets === "object") {
      for (const [key, value] of Object.entries(secrets)) {
        if (typeof value === "string" && value.trim() !== "") {
          // Find the secret key config
          const secretKeyConfig = integration.secret_keys.find(
            (sk) => sk.key === key
          );
          await upsertSecret(
            key,
            value,
            secretKeyConfig?.description || `Secret for ${key}`
          );
        } else if (value === null) {
          // null means delete the secret
          await deleteSecret(key);
        }
      }
    }

    // Update config and enabled state
    const updatedIntegration = await updateIntegrationConfig(
      id,
      config || integration.config,
      is_enabled !== undefined ? is_enabled : integration.is_enabled
    );

    // Get updated secret status
    const secretNames = integration.secret_keys.map((sk) => sk.key);
    const secretsExist = await checkSecretsExist(secretNames);
    const updatedSecrets = await getSecrets(secretNames);

    const maskedSecrets: Record<string, { exists: boolean; masked: string }> = {};
    for (const secretKey of integration.secret_keys) {
      const value = updatedSecrets[secretKey.key];
      if (value) {
        maskedSecrets[secretKey.key] = {
          exists: true,
          masked: secretKey.masked ? maskSecret(value) : value,
        };
      } else {
        maskedSecrets[secretKey.key] = {
          exists: false,
          masked: "",
        };
      }
    }

    return NextResponse.json({
      integration: updatedIntegration,
      secrets: maskedSecrets,
    });
  } catch (error) {
    console.error("Error updating integration:", error);
    return NextResponse.json(
      { error: "Failed to update integration" },
      { status: 500 }
    );
  }
}
