import twilio from "twilio";

if (!process.env.TWILIO_ACCOUNT_SID) {
  console.warn("TWILIO_ACCOUNT_SID is not set");
}

if (!process.env.TWILIO_AUTH_TOKEN) {
  console.warn("TWILIO_AUTH_TOKEN is not set");
}

if (!process.env.TWILIO_PHONE_NUMBER) {
  console.warn("TWILIO_PHONE_NUMBER is not set");
}

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const fromNumber = process.env.TWILIO_PHONE_NUMBER;

// Generate a 6-digit verification code
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send verification code via SMS
export async function sendVerificationCode(
  phone: string,
  code: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Format phone number to E.164 format
    const formattedPhone = formatPhoneE164(phone);

    await client.messages.create({
      body: `Your Elegant Lashes verification code is: ${code}. This code expires in 10 minutes.`,
      from: fromNumber,
      to: formattedPhone,
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to send verification SMS:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send SMS",
    };
  }
}

// Send appointment booking confirmation SMS (sent immediately when booked)
export async function sendBookingConfirmation({
  phone,
  clientName,
  dateTime,
}: {
  phone: string;
  clientName: string;
  dateTime: Date;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const formattedPhone = formatPhoneE164(phone);
    const formattedDate = formatDateTime(dateTime);

    const message = `Hi ${clientName}! Your appointment at Elegant Lashes is booked for ${formattedDate}.

Need to reschedule? Call us anytime.`;

    await client.messages.create({
      body: message,
      from: fromNumber,
      to: formattedPhone,
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to send booking confirmation SMS:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send SMS",
    };
  }
}

// Send 24-hour reminder SMS
export async function send24HourReminder({
  phone,
  clientName,
  dateTime,
}: {
  phone: string;
  clientName: string;
  dateTime: Date;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const formattedPhone = formatPhoneE164(phone);
    const formattedDate = formatDateTime(dateTime);

    const message = `Hi ${clientName}! Reminder: You have an appointment tomorrow on ${formattedDate}.

Please reply C to confirm, or call us to reschedule.`;

    await client.messages.create({
      body: message,
      from: fromNumber,
      to: formattedPhone,
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to send 24h reminder SMS:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send SMS",
    };
  }
}

// Send 2-hour reminder SMS
export async function send2HourReminder({
  phone,
  clientName,
  serviceName,
  locationName,
  locationAddress,
  dateTime,
}: {
  phone: string;
  clientName: string;
  serviceName: string;
  locationName: string;
  locationAddress: string;
  dateTime: Date;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const formattedPhone = formatPhoneE164(phone);
    const time = formatTime(dateTime);

    const message = `Hi ${clientName}! Your ${serviceName} appointment is in 2 hours at ${time}.

${locationName}
${locationAddress}

See you soon!`;

    await client.messages.create({
      body: message,
      from: fromNumber,
      to: formattedPhone,
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to send 2h reminder SMS:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send SMS",
    };
  }
}

// Send appointment moved/rescheduled notification SMS
export async function sendAppointmentMovedNotification({
  phone,
  clientName,
  serviceName,
  oldDateTime,
  newDateTime,
  technicianName,
  locationName,
}: {
  phone: string;
  clientName: string;
  serviceName: string;
  oldDateTime: Date;
  newDateTime: Date;
  technicianName: string;
  locationName: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const formattedPhone = formatPhoneE164(phone);
    const oldFormatted = formatDateTime(oldDateTime);
    const newFormatted = formatDateTime(newDateTime);

    const message = `Hi ${clientName}! Your ${serviceName} appointment has been rescheduled.

Old: ${oldFormatted}
New: ${newFormatted}

with ${technicianName}
${locationName}

Questions? Reply to this message or call us.`;

    await client.messages.create({
      body: message,
      from: fromNumber,
      to: formattedPhone,
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to send moved notification SMS:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send SMS",
    };
  }
}

// Send cancellation notification SMS
export async function sendCancellationNotification({
  phone,
  clientName,
  serviceName,
  dateTime,
  refundAmount,
}: {
  phone: string;
  clientName: string;
  serviceName: string;
  dateTime: Date;
  refundAmount?: number;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const formattedPhone = formatPhoneE164(phone);
    const formattedDate = formatDateTime(dateTime);

    let message = `Hi ${clientName}, your ${serviceName} appointment on ${formattedDate} has been cancelled.`;

    if (refundAmount && refundAmount > 0) {
      message += ` A refund of $${refundAmount} will be processed within 5-10 business days.`;
    }

    message += `\n\nWant to rebook? Visit book.elegantlashesbykatie.com`;

    await client.messages.create({
      body: message,
      from: fromNumber,
      to: formattedPhone,
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to send cancellation SMS:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send SMS",
    };
  }
}

// Helper: Format phone to E.164 (exported for webhook use)
export function formatPhoneE164(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, "");

  // If it's 10 digits (US number without country code), add +1
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  // If it's 11 digits starting with 1 (US number with country code), add +
  if (digits.length === 11 && digits.startsWith("1")) {
    return `+${digits}`;
  }

  // Otherwise, assume it already has country code and just add +
  return `+${digits}`;
}

// Helper: Format date/time for SMS
function formatDateTime(date: Date): string {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// Helper: Format time only
function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// ============================================
// SMS Confirmation System Functions
// ============================================

// Send 48-hour confirmation request (first reminder, sets PENDING)
export async function send48HourConfirmationRequest({
  phone,
  clientName,
  dateTime,
}: {
  phone: string;
  clientName: string;
  dateTime: Date;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const formattedPhone = formatPhoneE164(phone);
    const formattedDate = formatDateTime(dateTime);

    const message = `Hi ${clientName}! Reminder: You have an upcoming appointment at Elegant Lashes on ${formattedDate}.

Please reply C to confirm your appointment, or call us to reschedule.`;

    await client.messages.create({
      body: message,
      from: fromNumber,
      to: formattedPhone,
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to send 48h confirmation request SMS:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send SMS",
    };
  }
}

// Send 12-hour reminder (third reminder, if not confirmed)
export async function send12HourReminder({
  phone,
  clientName,
  dateTime,
}: {
  phone: string;
  clientName: string;
  dateTime: Date;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const formattedPhone = formatPhoneE164(phone);
    const time = formatTime(dateTime);

    const message = `Hi ${clientName}! Your appointment is in 12 hours at ${time}.

Haven't confirmed yet? Reply C to confirm now, or call us to reschedule.`;

    await client.messages.create({
      body: message,
      from: fromNumber,
      to: formattedPhone,
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to send 12h reminder SMS:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send SMS",
    };
  }
}

// Send 6-hour final warning (if not confirmed)
export async function send6HourFinalWarning({
  phone,
  clientName,
  dateTime,
}: {
  phone: string;
  clientName: string;
  dateTime: Date;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const formattedPhone = formatPhoneE164(phone);
    const time = formatTime(dateTime);

    const message = `FINAL REMINDER: Hi ${clientName}, your appointment is in 6 hours at ${time}.

We haven't received your confirmation. Please reply C to confirm NOW or your spot may be given to the waitlist.

Questions? Call us directly.`;

    await client.messages.create({
      body: message,
      from: fromNumber,
      to: formattedPhone,
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to send 6h final warning SMS:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send SMS",
    };
  }
}

// Send confirmation acknowledgment (when client replies to confirm)
export async function sendConfirmationAcknowledgment({
  phone,
  clientName,
  dateTime,
}: {
  phone: string;
  clientName: string;
  dateTime: Date;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const formattedPhone = formatPhoneE164(phone);
    const formattedDate = formatDateTime(dateTime);

    const message = `Thanks ${clientName}! Your appointment on ${formattedDate} is confirmed. See you then!`;

    await client.messages.create({
      body: message,
      from: fromNumber,
      to: formattedPhone,
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to send confirmation acknowledgment SMS:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send SMS",
    };
  }
}

// Parse confirmation intent from incoming SMS body
export function parseConfirmationIntent(
  body: string
): "confirm" | "unknown" {
  const normalized = body.trim().toLowerCase();
  const confirmPatterns = [
    "c",
    "y",
    "yes",
    "confirm",
    "confirmed",
    "ok",
    "okay",
    "yep",
    "yup",
    "sure",
    "yes!",
    "yea",
    "yeah",
  ];
  return confirmPatterns.includes(normalized) ? "confirm" : "unknown";
}

// Validate Twilio webhook signature
export function validateTwilioSignature(
  signature: string,
  url: string,
  params: Record<string, string>
): boolean {
  try {
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!authToken) {
      console.warn("TWILIO_AUTH_TOKEN not set for signature validation");
      return false;
    }
    return twilio.validateRequest(authToken, signature, url, params);
  } catch (error) {
    console.error("Error validating Twilio signature:", error);
    return false;
  }
}
