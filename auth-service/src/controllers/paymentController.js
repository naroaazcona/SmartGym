const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const pool = require("../database/db");

const PLAN_CONFIG = {
  basic: process.env.STRIPE_PRICE_BASIC,
  premium: process.env.STRIPE_PRICE_PREMIUM,
};

const isPriceId = (value = "") => String(value).startsWith("price_");
const isProductId = (value = "") => String(value).startsWith("prod_");

async function resolveStripePriceId(plan) {
  const configuredValue = PLAN_CONFIG[plan];

  if (!configuredValue) {
    throw new Error('Plan no valido. Usa "basic" o "premium".');
  }

  if (isPriceId(configuredValue)) {
    return configuredValue;
  }

  if (!isProductId(configuredValue)) {
    throw new Error(
      `Configuracion Stripe invalida para "${plan}". Usa un id "price_" o "prod_".`
    );
  }

  // Permite configurar el producto (prod_) y resuelve automaticamente un precio recurrente.
  const product = await stripe.products.retrieve(configuredValue, {
    expand: ["default_price"],
  });

  const defaultPrice = product?.default_price;
  if (defaultPrice && typeof defaultPrice === "object") {
    const defaultPriceId = defaultPrice.id;
    const defaultIsRecurring = Boolean(defaultPrice.recurring);
    const defaultIsActive = defaultPrice.active !== false;

    if (defaultPriceId && isPriceId(defaultPriceId) && defaultIsRecurring && defaultIsActive) {
      return defaultPriceId;
    }
  }

  const prices = await stripe.prices.list({
    product: configuredValue,
    active: true,
    type: "recurring",
    limit: 10,
  });

  const recurringPrice = prices.data.find((price) => price.active && price.recurring);
  if (recurringPrice?.id) {
    return recurringPrice.id;
  }

  throw new Error(
    `No hay un price recurrente activo para el producto ${configuredValue} (plan "${plan}").`
  );
}

class PaymentController {
  // Crear sesion de pago en Stripe
  static async createCheckoutSession(req, res) {
    try {
      const { plan } = req.body;

      if (!PLAN_CONFIG[plan]) {
        return res.status(400).json({ error: 'Plan no valido. Usa "basic" o "premium".' });
      }

      const priceId = await resolveStripePriceId(plan);

      // Buscar si el usuario ya tiene un customer_id en Stripe
      const result = await pool.query(
        "SELECT stripe_customer_id FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
        [req.userId]
      );

      let customerId = result.rows[0]?.stripe_customer_id || null;

      // Si no tiene customer en Stripe, crearlo
      if (!customerId) {
        const userResult = await pool.query("SELECT email, name FROM users WHERE id = $1", [req.userId]);
        const user = userResult.rows[0];

        if (!user) {
          return res.status(404).json({ error: "Usuario no encontrado para crear checkout." });
        }

        const customer = await stripe.customers.create({
          email: user.email,
          name: user.name,
          metadata: { userId: String(req.userId) },
        });
        customerId = customer.id;
      }

      // Crear sesion de pago
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: "subscription",
        success_url: "http://localhost:8080/#/suscripcion?success=true",
        cancel_url: "http://localhost:8080/#/suscripcion?cancelled=true",
        metadata: { userId: String(req.userId), plan },
      });

      res.json({ url: session.url });
    } catch (error) {
      console.error("Error creando sesion de pago:", error);

      if (
        error?.message?.includes("Configuracion Stripe invalida") ||
        error?.message?.includes("No hay un price recurrente activo")
      ) {
        return res.status(500).json({ error: error.message });
      }

      if (error?.type === "StripeInvalidRequestError" && error?.param === "line_items[0][price]") {
        return res.status(500).json({
          error:
            "Configuracion Stripe invalida: revisa STRIPE_PRICE_BASIC y STRIPE_PRICE_PREMIUM (usa ids price_ o prod_ con precio recurrente activo).",
        });
      }

      res.status(500).json({ error: "Error al crear la sesion de pago" });
    }
  }

  // Obtener suscripcion activa del usuario
  static async getSubscription(req, res) {
    try {
      const result = await pool.query(
        "SELECT * FROM subscriptions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1",
        [req.userId]
      );

      if (!result.rows.length) {
        return res.json({ subscription: null });
      }

      res.json({ subscription: result.rows[0] });
    } catch (error) {
      console.error("Error obteniendo suscripcion:", error);
      res.status(500).json({ error: "Error al obtener la suscripcion" });
    }
  }

  // Webhook de Stripe (confirma el pago y actualiza la base de datos)
  static async webhook(req, res) {
    const sig = req.headers["stripe-signature"];
    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error("Webhook error:", err.message);
      return res.status(400).json({ error: `Webhook error: ${err.message}` });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const userId = session.metadata.userId;
      const plan = session.metadata.plan;

      // Obtener detalles de la suscripcion de Stripe
      const stripeSub = await stripe.subscriptions.retrieve(session.subscription);

      await pool.query(
        `INSERT INTO subscriptions (user_id, stripe_customer_id, stripe_subscription_id, plan, status, current_period_end)
         VALUES ($1, $2, $3, $4, $5, to_timestamp($6))
         ON CONFLICT (user_id) DO UPDATE SET
           stripe_customer_id = $2,
           stripe_subscription_id = $3,
           plan = $4,
           status = $5,
           current_period_end = to_timestamp($6),
           updated_at = CURRENT_TIMESTAMP`,
        [userId, session.customer, session.subscription, plan, "active", stripeSub.current_period_end]
      );
    }

    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object;
      await pool.query(
        `UPDATE subscriptions SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
         WHERE stripe_subscription_id = $1`,
        [sub.id]
      );
    }

    res.json({ received: true });
  }
}

module.exports = PaymentController;
