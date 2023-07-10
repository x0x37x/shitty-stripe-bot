import { Snowflake } from "discord.js";
import Stripe from "stripe";

const { STRIPE_API_KEY, STRIPE_WEBHOOK } = process.env;

if (!STRIPE_API_KEY || !STRIPE_WEBHOOK) {
  process.exit(1);
}

const api = new Stripe(STRIPE_API_KEY, {
  apiVersion: "2022-11-15",
});

export const getBalance = async() => {
  return await api.balance.retrieve();
}

export const fetchProduct = async(productId: string): Promise<Stripe.Product | undefined> => {
  const product = await api.products.retrieve(productId);
  return product
}

export const fetchPrice = async(priceId: string): Promise<Stripe.Price | undefined> => {
  const price = await api.prices.retrieve(priceId);
  return price;
}

export const createPaymentLink = async (
  discordId: Snowflake,
  lineItems: Stripe.PaymentLinkCreateParams.LineItem[]
): Promise<Stripe.Checkout.Session | undefined> => {
  const params: Stripe.Checkout.SessionCreateParams = {
    line_items: lineItems,
    success_url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    metadata: { discordId },
    payment_intent_data: { metadata: { discordId } },
    mode: "payment",
  };

  try {
    const paymentLink: Stripe.Checkout.Session =
      await api.checkout.sessions.create(params);
    return paymentLink;
  } catch (err: unknown) {
    console.error(err);
  }
};

export const verifyWebhook = (
  data: Buffer | string,
  stripeWebhookSignature: string
) => {
  return api.webhooks.constructEvent(
    data,
    stripeWebhookSignature,
    STRIPE_WEBHOOK
  );
};
