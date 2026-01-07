import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

const SETTINGS_TABLE = "bloom_settings";

// GET /api/settings - Fetch all settings
export async function GET() {
  try {
    const { data, error } = await supabase
      .from(SETTINGS_TABLE)
      .select("*")
      .eq("id", "default")
      .single();

    if (error) {
      // If no settings exist, return defaults
      if (error.code === "PGRST116") {
        return NextResponse.json({
          settings: getDefaultSettings(),
        });
      }
      throw error;
    }

    // Transform snake_case DB columns to camelCase for frontend
    const settings = transformToFrontend(data);

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("Error fetching settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

// PUT /api/settings - Update settings
export async function PUT(request: Request) {
  try {
    const body = await request.json();

    // Transform camelCase frontend data to snake_case for DB
    const dbData = transformToDatabase(body);
    dbData.updatedAt = new Date().toISOString();

    const { data, error } = await supabase
      .from(SETTINGS_TABLE)
      .update(dbData)
      .eq("id", "default")
      .select()
      .single();

    if (error) throw error;

    const settings = transformToFrontend(data);

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("Error updating settings:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}

function getDefaultSettings() {
  return {
    // Business
    businessName: "My Business",
    email: "",
    phone: "",
    website: "",
    timezone: "America/Los_Angeles",
    // Booking
    defaultDepositAmount: 25,
    cancellationWindowHours: 24,
    noShowFeeEnabled: true,
    noShowFeeAmount: 50,
    requireCardOnFile: true,
    allowSameDayBooking: true,
    minAdvanceBookingHours: 2,
    maxAdvanceBookingDays: 60,
    defaultBufferMinutes: 15,
    // Notifications
    smsRemindersEnabled: true,
    reminder48hEnabled: true,
    reminder48hMessage:
      "Hi {firstName}! Just a heads up - you have an appointment at {locationName} in 2 days on {date} at {time} for {serviceName}. Reply C to confirm.",
    reminder24hEnabled: true,
    reminder24hMessage:
      "Hi {firstName}! Reminder: Your {serviceName} appointment with {technicianName} is tomorrow at {time}. Reply C to confirm or call us to reschedule.",
    reminder12hEnabled: false,
    reminder12hMessage:
      "Hi {firstName}! Your appointment at {locationName} is coming up today at {time}. See you soon! Reply C to confirm.",
    reminder6hEnabled: false,
    reminder6hMessage:
      "Hi {firstName}! Quick reminder - your {serviceName} appointment is in about 6 hours at {time}. Looking forward to seeing you!",
    reminder2hEnabled: true,
    reminder2hMessage:
      "Hi {firstName}! Your appointment at {locationName} is in 2 hours at {time}. Please arrive 5 minutes early. See you soon!",
    confirmationSmsEnabled: true,
    cancellationSmsEnabled: true,
    noShowSmsEnabled: false,
    // Payments
    acceptCard: true,
    acceptCash: true,
    acceptApplePay: true,
    acceptGooglePay: true,
  };
}

// Transform database snake_case to frontend camelCase
function transformToFrontend(data: Record<string, unknown>) {
  return {
    // Business
    businessName: data.business_name,
    email: data.business_email || "",
    phone: data.business_phone || "",
    website: data.business_website || "",
    timezone: data.timezone,
    // Booking
    defaultDepositAmount: Number(data.default_deposit_amount),
    cancellationWindowHours: data.cancellation_window_hours,
    noShowFeeEnabled: data.no_show_fee_enabled,
    noShowFeeAmount: Number(data.no_show_fee_amount),
    requireCardOnFile: data.require_card_on_file,
    allowSameDayBooking: data.allow_same_day_booking,
    minAdvanceBookingHours: data.min_advance_booking_hours,
    maxAdvanceBookingDays: data.max_advance_booking_days,
    defaultBufferMinutes: data.default_buffer_minutes,
    // Notifications
    smsRemindersEnabled: data.sms_reminders_enabled,
    reminder48hEnabled: data.reminder_48h_enabled,
    reminder48hMessage: data.reminder_48h_message,
    reminder24hEnabled: data.reminder_24h_enabled,
    reminder24hMessage: data.reminder_24h_message,
    reminder12hEnabled: data.reminder_12h_enabled,
    reminder12hMessage: data.reminder_12h_message,
    reminder6hEnabled: data.reminder_6h_enabled,
    reminder6hMessage: data.reminder_6h_message,
    reminder2hEnabled: data.reminder_2h_enabled,
    reminder2hMessage: data.reminder_2h_message,
    confirmationSmsEnabled: data.confirmation_sms_enabled,
    cancellationSmsEnabled: data.cancellation_sms_enabled,
    noShowSmsEnabled: data.no_show_sms_enabled,
    // Payments
    acceptCard: data.accept_card,
    acceptCash: data.accept_cash,
    acceptApplePay: data.accept_apple_pay,
    acceptGooglePay: data.accept_google_pay,
  };
}

// Transform frontend camelCase to database snake_case
function transformToDatabase(data: Record<string, unknown>) {
  const result: Record<string, unknown> = {};

  // Business
  if (data.businessName !== undefined) result.business_name = data.businessName;
  if (data.email !== undefined) result.business_email = data.email;
  if (data.phone !== undefined) result.business_phone = data.phone;
  if (data.website !== undefined) result.business_website = data.website;
  if (data.timezone !== undefined) result.timezone = data.timezone;

  // Booking
  if (data.defaultDepositAmount !== undefined)
    result.default_deposit_amount = data.defaultDepositAmount;
  if (data.cancellationWindowHours !== undefined)
    result.cancellation_window_hours = data.cancellationWindowHours;
  if (data.noShowFeeEnabled !== undefined)
    result.no_show_fee_enabled = data.noShowFeeEnabled;
  if (data.noShowFeeAmount !== undefined)
    result.no_show_fee_amount = data.noShowFeeAmount;
  if (data.requireCardOnFile !== undefined)
    result.require_card_on_file = data.requireCardOnFile;
  if (data.allowSameDayBooking !== undefined)
    result.allow_same_day_booking = data.allowSameDayBooking;
  if (data.minAdvanceBookingHours !== undefined)
    result.min_advance_booking_hours = data.minAdvanceBookingHours;
  if (data.maxAdvanceBookingDays !== undefined)
    result.max_advance_booking_days = data.maxAdvanceBookingDays;
  if (data.defaultBufferMinutes !== undefined)
    result.default_buffer_minutes = data.defaultBufferMinutes;

  // Notifications
  if (data.smsRemindersEnabled !== undefined)
    result.sms_reminders_enabled = data.smsRemindersEnabled;
  if (data.reminder48hEnabled !== undefined)
    result.reminder_48h_enabled = data.reminder48hEnabled;
  if (data.reminder48hMessage !== undefined)
    result.reminder_48h_message = data.reminder48hMessage;
  if (data.reminder24hEnabled !== undefined)
    result.reminder_24h_enabled = data.reminder24hEnabled;
  if (data.reminder24hMessage !== undefined)
    result.reminder_24h_message = data.reminder24hMessage;
  if (data.reminder12hEnabled !== undefined)
    result.reminder_12h_enabled = data.reminder12hEnabled;
  if (data.reminder12hMessage !== undefined)
    result.reminder_12h_message = data.reminder12hMessage;
  if (data.reminder6hEnabled !== undefined)
    result.reminder_6h_enabled = data.reminder6hEnabled;
  if (data.reminder6hMessage !== undefined)
    result.reminder_6h_message = data.reminder6hMessage;
  if (data.reminder2hEnabled !== undefined)
    result.reminder_2h_enabled = data.reminder2hEnabled;
  if (data.reminder2hMessage !== undefined)
    result.reminder_2h_message = data.reminder2hMessage;
  if (data.confirmationSmsEnabled !== undefined)
    result.confirmation_sms_enabled = data.confirmationSmsEnabled;
  if (data.cancellationSmsEnabled !== undefined)
    result.cancellation_sms_enabled = data.cancellationSmsEnabled;
  if (data.noShowSmsEnabled !== undefined)
    result.no_show_sms_enabled = data.noShowSmsEnabled;

  // Payments
  if (data.acceptCard !== undefined) result.accept_card = data.acceptCard;
  if (data.acceptCash !== undefined) result.accept_cash = data.acceptCash;
  if (data.acceptApplePay !== undefined) result.accept_apple_pay = data.acceptApplePay;
  if (data.acceptGooglePay !== undefined) result.accept_google_pay = data.acceptGooglePay;

  return result;
}
