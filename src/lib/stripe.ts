import Stripe from "stripe";

// Delay initialization to runtime to avoid build-time errors
function getStripeClient() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2025-12-15.clover",
    typescript: true,
  });
}

// Lazy-initialized Stripe client
let _stripe: Stripe | null = null;
export const stripe = new Proxy({} as Stripe, {
  get(_, prop) {
    if (!_stripe) {
      _stripe = getStripeClient();
    }
    return (_stripe as unknown as Record<string, unknown>)[prop as string];
  },
});

export async function createCheckoutSession({
  appointmentId,
  serviceName,
  depositAmount,
  customerEmail,
  customerName,
  successUrl,
  cancelUrl,
}: {
  appointmentId: string;
  serviceName: string;
  depositAmount: number;
  customerEmail?: string;
  customerName: string;
  successUrl: string;
  cancelUrl: string;
}) {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `Deposit for ${serviceName}`,
            description: `Appointment deposit for ${customerName}`,
          },
          unit_amount: Math.round(depositAmount * 100), // Convert to cents
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url: successUrl,
    cancel_url: cancelUrl,
    customer_email: customerEmail,
    metadata: {
      appointmentId,
      type: "appointment_deposit",
    },
    payment_intent_data: {
      metadata: {
        appointmentId,
      },
    },
  });

  return session;
}

export async function createRefund(paymentIntentId: string, amount?: number) {
  const refund = await stripe.refunds.create({
    payment_intent: paymentIntentId,
    amount: amount ? Math.round(amount * 100) : undefined, // Full refund if no amount
  });

  return refund;
}

// ==================== CARD ON FILE / NO-SHOW PROTECTION ====================

/**
 * Create a Stripe customer or return existing one
 */
export async function getOrCreateStripeCustomer({
  clientId,
  email,
  name,
  phone,
  existingStripeCustomerId,
}: {
  clientId: string;
  email?: string;
  name: string;
  phone?: string;
  existingStripeCustomerId?: string | null;
}): Promise<Stripe.Customer> {
  // Return existing customer if we have one
  if (existingStripeCustomerId) {
    const existing = await stripe.customers.retrieve(existingStripeCustomerId);
    if (!existing.deleted) {
      return existing as Stripe.Customer;
    }
  }

  // Create new customer
  const customer = await stripe.customers.create({
    email: email || undefined,
    name,
    phone: phone || undefined,
    metadata: {
      clientId,
      source: "bloom_booking",
    },
  });

  return customer;
}

/**
 * Create a Setup Intent to save card without charging
 */
export async function createSetupIntent({
  customerId,
  clientId,
}: {
  customerId: string;
  clientId: string;
}): Promise<Stripe.SetupIntent> {
  const setupIntent = await stripe.setupIntents.create({
    customer: customerId,
    payment_method_types: ["card"],
    usage: "off_session", // For charging when customer is not present
    metadata: {
      clientId,
      type: "no_show_protection",
    },
  });

  return setupIntent;
}

/**
 * Get payment method details from Stripe
 */
export async function getPaymentMethodDetails(
  paymentMethodId: string
): Promise<{
  brand: string;
  last4: string;
  expiryMonth: number;
  expiryYear: number;
}> {
  const pm = await stripe.paymentMethods.retrieve(paymentMethodId);

  if (pm.type !== "card" || !pm.card) {
    throw new Error("Payment method is not a card");
  }

  return {
    brand: pm.card.brand,
    last4: pm.card.last4,
    expiryMonth: pm.card.exp_month,
    expiryYear: pm.card.exp_year,
  };
}

/**
 * List all payment methods for a customer
 */
export async function listCustomerPaymentMethods(
  customerId: string
): Promise<Stripe.PaymentMethod[]> {
  const paymentMethods = await stripe.paymentMethods.list({
    customer: customerId,
    type: "card",
  });

  return paymentMethods.data;
}

/**
 * Detach (remove) a payment method from customer
 */
export async function detachPaymentMethod(
  paymentMethodId: string
): Promise<Stripe.PaymentMethod> {
  const detached = await stripe.paymentMethods.detach(paymentMethodId);
  return detached;
}

/**
 * Charge a saved payment method (for no-show fees)
 */
export async function chargeNoShowFee({
  customerId,
  paymentMethodId,
  amount,
  appointmentId,
  description,
}: {
  customerId: string;
  paymentMethodId: string;
  amount: number; // In dollars
  appointmentId: string;
  description: string;
}): Promise<Stripe.PaymentIntent> {
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100), // Convert to cents
    currency: "usd",
    customer: customerId,
    payment_method: paymentMethodId,
    off_session: true,
    confirm: true,
    description,
    metadata: {
      appointmentId,
      type: "no_show_fee",
    },
  });

  return paymentIntent;
}

/**
 * Set a payment method as the default for a customer
 */
export async function setDefaultPaymentMethod(
  customerId: string,
  paymentMethodId: string
): Promise<Stripe.Customer> {
  const customer = await stripe.customers.update(customerId, {
    invoice_settings: {
      default_payment_method: paymentMethodId,
    },
  });

  return customer;
}
