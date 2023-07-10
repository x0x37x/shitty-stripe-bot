import dotenv from "dotenv";
dotenv.config();
import express, { Application, Request, Response } from "express";
import Stripe from "stripe";
import * as bot from "./bot";
import { createPaymentLink, verifyWebhook } from "./stripe";

bot.test();

const { STRIPE_API_KEY, BOT_TOKEN, STRIPE_WEBHOOK } = process.env;

if (!STRIPE_API_KEY || !BOT_TOKEN || !STRIPE_WEBHOOK) {
  console.error("MISSING ENV VARIABLES");
  process.exit(1);
}

const server: Application = express();

export type CheckoutComplete = {
  payment_status: string;
  metadata: Stripe.Metadata;
  id: string;
  livemode: boolean;
  customer_details: Record<string, unknown>;
};

interface IOutcome {
  network_status: string;
  reason: string;
}

export type ChargeFailed = {
  failure_code: string;
  livemode: boolean;
  outcome: IOutcome;
  metadata: Stripe.Metadata;
};

server.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  async (request: Request, response: Response) => {
    const signature = request.header("Stripe-Signature");
    if (!signature) return response.sendStatus(401);

    let event;

    try {
      event = verifyWebhook(request.body, signature);
    } catch (err) {
      response.sendStatus(400).send(`Webhook error ${err}`);
      return;
    }

    switch (event.type) {
      case "charge.failed": {
        const chargeFailed = event.data.object as ChargeFailed;
        console.log(chargeFailed);
        if (chargeFailed.failure_code === "card_declined") {
          if (chargeFailed.outcome.reason === "insufficient_funds") {
            // broke boi detected!
            bot.sendLogBroke(chargeFailed);
          }
        }
        break;
      }
      case "charge.succeeded": {
        const chargeSucceeded = event.data.object;
        console.log(chargeSucceeded);
        break;
      }
      case "charge.dispute.created": {
        const chargeDisputeCreated = event.data.object;
        console.log(chargeDisputeCreated);
        break;
      }
      case "checkout.session.completed": {
        const checkoutSessionCompleted = event.data.object as CheckoutComplete;
        console.log(checkoutSessionCompleted);
        if (checkoutSessionCompleted.payment_status === "paid") {
          const { discordId } = checkoutSessionCompleted.metadata;
          if (discordId) {
            bot.sendLogComplete(checkoutSessionCompleted);
          }
        }
        break;
      }
      case "payment_link.created": {
        const paymentLinkCreated = event.data.object;
        console.log(paymentLinkCreated);
        break;
      }
      default:
        console.log(`Unhanded event ${event.type}`);
    }

    response.send();
  }
);

server.listen(80);
