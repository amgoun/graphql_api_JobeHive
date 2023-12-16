import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const createSubscription = async (customerId, priceId) => {
  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
  });

  return subscription;
};

export const cancelSubscription = async (subscriptionId) => {
  const subscription = await stripe.subscriptions.del(subscriptionId);

  return subscription;
};
