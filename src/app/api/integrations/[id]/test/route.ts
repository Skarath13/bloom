import { NextResponse } from "next/server";
import { getIntegration, getSecrets } from "@/lib/vault";
import Stripe from "stripe";
import twilio from "twilio";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/integrations/[id]/test - Test the integration connection
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const integration = await getIntegration(id);

    if (!integration) {
      return NextResponse.json(
        { error: "Integration not found" },
        { status: 404 }
      );
    }

    // Get secrets for this integration
    const secretNames = integration.secret_keys.map((sk) => sk.key);
    const secrets = await getSecrets(secretNames);

    // Test based on integration type
    switch (id) {
      case "stripe": {
        const secretKey = secrets["stripe_secret_key"];
        if (!secretKey) {
          return NextResponse.json({
            success: false,
            error: "Stripe secret key not configured",
          });
        }

        try {
          const stripe = new Stripe(secretKey);

          // Test by fetching account info
          const account = await stripe.accounts.retrieve();

          return NextResponse.json({
            success: true,
            message: `Connected to Stripe account: ${account.settings?.dashboard?.display_name || account.id}`,
            details: {
              account_id: account.id,
              country: account.country,
              default_currency: account.default_currency,
            },
          });
        } catch (stripeError: unknown) {
          const error = stripeError as { message?: string };
          return NextResponse.json({
            success: false,
            error: `Stripe connection failed: ${error.message || "Unknown error"}`,
          });
        }
      }

      case "twilio": {
        const accountSid = secrets["twilio_account_sid"];
        const authToken = secrets["twilio_auth_token"];
        const phoneNumber = secrets["twilio_phone_number"];

        if (!accountSid || !authToken) {
          return NextResponse.json({
            success: false,
            error: "Twilio credentials not configured",
          });
        }

        try {
          const client = twilio(accountSid, authToken);

          // Test by fetching account info
          const account = await client.api.accounts(accountSid).fetch();

          // If phone number is configured, verify it exists
          let phoneVerified = false;
          if (phoneNumber) {
            try {
              const numbers = await client.incomingPhoneNumbers.list({
                phoneNumber: phoneNumber,
              });
              phoneVerified = numbers.length > 0;
            } catch {
              // Phone number verification failed, but account works
            }
          }

          return NextResponse.json({
            success: true,
            message: `Connected to Twilio account: ${account.friendlyName}`,
            details: {
              account_sid: account.sid,
              account_name: account.friendlyName,
              status: account.status,
              phone_verified: phoneVerified,
            },
          });
        } catch (twilioError: unknown) {
          const error = twilioError as { message?: string };
          return NextResponse.json({
            success: false,
            error: `Twilio connection failed: ${error.message || "Unknown error"}`,
          });
        }
      }

      default:
        return NextResponse.json({
          success: false,
          error: `Unknown integration: ${id}`,
        });
    }
  } catch (error) {
    console.error("Error testing integration:", error);
    return NextResponse.json(
      { error: "Failed to test integration" },
      { status: 500 }
    );
  }
}
