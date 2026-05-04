import { Router, type IRouter } from "express";
import Stripe from "stripe";

const router: IRouter = Router();

function getStripe() {
  const key = process.env["STRIPE_SECRET_KEY"];
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key);
}

type CartItem = {
  name: string;
  price: string;
  quantity: number;
  imageUrl?: string | null;
  sellerName: string;
};

router.post("/checkout", async (req, res) => {
  const { items, origin } = req.body as {
    items: CartItem[];
    origin: string;
  };

  if (!Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: "No items provided" });
    return;
  }

  const pricedItems = items.filter((i) => {
    const p = parseFloat(i.price);
    return !isNaN(p) && p > 0;
  });

  if (pricedItems.length === 0) {
    res.status(400).json({ error: "None of the selected items have a price set" });
    return;
  }

  try {
    const stripe = getStripe();

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = pricedItems.map((item) => {
      const unitAmount = Math.round(parseFloat(item.price) * 100);
      const params: Stripe.Checkout.SessionCreateParams.LineItem = {
        quantity: item.quantity ?? 1,
        price_data: {
          currency: "usd",
          unit_amount: unitAmount,
          product_data: {
            name: item.name,
            description: `Sold by ${item.sellerName}`,
            ...(item.imageUrl ? { images: [item.imageUrl] } : {}),
          },
        },
      };
      return params;
    });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/listings`,
      metadata: {
        buyerDiscordId: (req.session as any)?.discordUser?.id ?? "",
        buyerUsername: (req.session as any)?.discordUser?.username ?? "Guest",
      },
    });

    res.json({ url: session.url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[checkout] Stripe error:", msg);
    res.status(500).json({ error: msg });
  }
});

router.get("/checkout/session/:id", async (req, res) => {
  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(req.params.id as string, {
      expand: ["line_items"],
    });
    res.json({
      status: session.payment_status,
      customerEmail: session.customer_details?.email ?? null,
      amountTotal: session.amount_total,
      lineItems: session.line_items?.data ?? [],
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});

export default router;
