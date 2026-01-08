import twilio from "twilio";
import type { Twilio } from "twilio";

// Lazy-loaded Twilio client (only created when actually needed)
let _client: Twilio | null = null;

function getTwilioClient(): Twilio | null {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    return null;
  }
  if (!_client) {
    _client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
  }
  return _client;
}

const fromNumber = process.env.TWILIO_PHONE_NUMBER;

// Helper to send SMS with graceful fallback when Twilio not configured
async function sendSMS(
  to: string,
  body: string
): Promise<{ success: boolean; error?: string }> {
  const client = getTwilioClient();
  if (!client) {
    console.log(`[DEV] SMS to ${to}: ${body.slice(0, 50)}...`);
    return { success: true };
  }

  try {
    await client.messages.create({
      body,
      from: fromNumber,
      to,
    });
    return { success: true };
  } catch (error) {
    console.error("Failed to send SMS:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send SMS",
    };
  }
}

// Base URL for links in SMS (should be set in env for production)
const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://book.elegantlashesbykatie.com";

// Generate a 6-digit verification code
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send verification code via SMS
export async function sendVerificationCode(
  phone: string,
  code: string
): Promise<{ success: boolean; error?: string }> {
  const formattedPhone = formatPhoneE164(phone);

  // Dev mode: log code prominently so user can test
  if (!getTwilioClient()) {
    console.log("\n========================================");
    console.log(`DEV MODE - Verification code for ${formattedPhone}: ${code}`);
    console.log("========================================\n");
    return { success: true };
  }

  return sendSMS(
    formattedPhone,
    `Your Elegant Lashes verification code is: ${code}. This code expires in 10 minutes.`
  );
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
  const formattedPhone = formatPhoneE164(phone);
  const formattedDate = formatDateTime(dateTime);

  const message = `Hi ${clientName}! Your appointment at Elegant Lashes is booked for ${formattedDate}.

Manage your bookings: ${baseUrl}/profile

Need to reschedule? Call us anytime.`;

  return sendSMS(formattedPhone, message);
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
  const formattedPhone = formatPhoneE164(phone);
  const formattedDate = formatDateTime(dateTime);

  const message = `Hi ${clientName}! Reminder: You have an appointment tomorrow on ${formattedDate}.

Please reply C to confirm, or call us to reschedule.`;

  return sendSMS(formattedPhone, message);
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
  const formattedPhone = formatPhoneE164(phone);
  const time = formatTime(dateTime);

  const message = `Hi ${clientName}! Your ${serviceName} appointment is in 2 hours at ${time}.

${locationName}
${locationAddress}

See you soon!`;

  return sendSMS(formattedPhone, message);
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
  const formattedPhone = formatPhoneE164(phone);
  const oldFormatted = formatDateTime(oldDateTime);
  const newFormatted = formatDateTime(newDateTime);

  const message = `Hi ${clientName}! Your ${serviceName} appointment has been rescheduled.

Old: ${oldFormatted}
New: ${newFormatted}

with ${technicianName}
${locationName}

Questions? Reply to this message or call us.`;

  return sendSMS(formattedPhone, message);
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
  const formattedPhone = formatPhoneE164(phone);
  const formattedDate = formatDateTime(dateTime);

  let message = `Hi ${clientName}, your ${serviceName} appointment on ${formattedDate} has been cancelled.`;

  if (refundAmount && refundAmount > 0) {
    message += ` A refund of $${refundAmount} will be processed within 5-10 business days.`;
  }

  message += `\n\nWant to rebook? Visit book.elegantlashesbykatie.com`;

  return sendSMS(formattedPhone, message);
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
  const formattedPhone = formatPhoneE164(phone);
  const formattedDate = formatDateTime(dateTime);

  const message = `Hi ${clientName}! Reminder: You have an upcoming appointment at Elegant Lashes on ${formattedDate}.

Please reply C to confirm your appointment, or call us to reschedule.`;

  return sendSMS(formattedPhone, message);
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
  const formattedPhone = formatPhoneE164(phone);
  const time = formatTime(dateTime);

  const message = `Hi ${clientName}! Your appointment is in 12 hours at ${time}.

Haven't confirmed yet? Reply C to confirm now, or call us to reschedule.`;

  return sendSMS(formattedPhone, message);
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
  const formattedPhone = formatPhoneE164(phone);
  const time = formatTime(dateTime);

  const message = `FINAL REMINDER: Hi ${clientName}, your appointment is in 6 hours at ${time}.

We haven't received your confirmation. Please reply C to confirm NOW or your spot may be given to the waitlist.

Questions? Call us directly.`;

  return sendSMS(formattedPhone, message);
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
  const formattedPhone = formatPhoneE164(phone);
  const formattedDate = formatDateTime(dateTime);

  const message = `Thanks ${clientName}! Your appointment on ${formattedDate} is confirmed. See you then!

Manage your bookings: ${baseUrl}/profile`;

  return sendSMS(formattedPhone, message);
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
