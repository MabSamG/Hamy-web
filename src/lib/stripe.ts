import Stripe from "stripe";

// Server-only: STRIPE_SECRET_KEY has no PUBLIC_ prefix, so it never reaches
// the client bundle. Only import this from src/pages/api/*.ts routes.
export function getStripe(): Stripe {
  const secretKey = import.meta.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("Falta STRIPE_SECRET_KEY en tu .env. Ver README para configurar Stripe.");
  }
  return new Stripe(secretKey);
}
