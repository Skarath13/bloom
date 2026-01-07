import { NextResponse } from "next/server";
import {
  getIntegrations,
  checkSecretsExist,
  isVaultConfigured,
  type Integration,
} from "@/lib/vault";

export interface IntegrationWithStatus extends Integration {
  secrets_configured: Record<string, boolean>;
  all_required_configured: boolean;
}

// GET /api/integrations - List all integrations with their status
export async function GET() {
  try {
    const integrations = await getIntegrations();

    // Get all secret key names across all integrations
    const allSecretNames: string[] = [];
    for (const integration of integrations) {
      for (const secretKey of integration.secret_keys) {
        allSecretNames.push(secretKey.key);
      }
    }

    // Check which secrets exist
    const secretsExist = await checkSecretsExist(allSecretNames);

    // Enhance integrations with secret status
    const integrationsWithStatus: IntegrationWithStatus[] = integrations.map(
      (integration) => {
        const secretsConfigured: Record<string, boolean> = {};
        let allRequiredConfigured = true;

        for (const secretKey of integration.secret_keys) {
          const exists = secretsExist[secretKey.key] || false;
          secretsConfigured[secretKey.key] = exists;
          if (secretKey.required && !exists) {
            allRequiredConfigured = false;
          }
        }

        return {
          ...integration,
          secrets_configured: secretsConfigured,
          all_required_configured: allRequiredConfigured,
        };
      }
    );

    return NextResponse.json({
      integrations: integrationsWithStatus,
      vault_configured: isVaultConfigured(),
    });
  } catch (error) {
    console.error("Error fetching integrations:", error);
    return NextResponse.json(
      { error: "Failed to fetch integrations" },
      { status: 500 }
    );
  }
}
