const stripeFactory = require("stripe");
const pool = require("../database/db");

const STRIPE_SECRET_KEY = (process.env.STRIPE_SECRET_KEY || "").trim();
const STRIPE_WEBHOOK_SECRET = (process.env.STRIPE_WEBHOOK_SECRET || "").trim();
const FRONTEND_URL = (process.env.FRONTEND_URL || "http://localhost:8080").trim();

const PLAN_CONFIG = {
  basic: (process.env.STRIPE_PRICE_BASIC || "").trim(),
  premium: (process.env.STRIPE_PRICE_PREMIUM || "").trim(),
};

let stripeClient = null;

function getStripeClient() {
  if (!STRIPE_SECRET_KEY) {
    return null;
  }
  if (!stripeClient) {
    stripeClient = stripeFactory(STRIPE_SECRET_KEY);
  }
  return stripeClient;
}

const isPriceId = (value = "") => String(value).startsWith("price_");
const isProductId = (value = "") => String(value).startsWith("prod_");
const isValidPlan = (value = "") => ["basic", "premium"].includes(String(value));

function getFrontendBaseUrl() {
  return (FRONTEND_URL || "http://localhost:8080").replace(/\/+$/, "");
}

function getStripeRedirectUrls() {
  const frontendBase = getFrontendBaseUrl();
  return {
    // session_id en query real (location.search), no en hash, para asegurar sustitucion de Stripe.
    successUrl: `${frontendBase}/?success=true&session_id={CHECKOUT_SESSION_ID}#/suscripcion`,
    cancelUrl: `${frontendBase}/#/suscripcion?cancelled=true`,
  };
}

async function resolveStripePriceId(stripe, plan) {
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

async function inferPlanFromStripeSubscription(stripe, stripeSubscription, fallbackPlan = null) {
  const itemPrices = Array.isArray(stripeSubscription?.items?.data)
    ? stripeSubscription.items.data.map((item) => item?.price?.id).filter(Boolean)
    : [];

  if (itemPrices.length) {
    const basicPriceId = await resolveStripePriceId(stripe, "basic");
    const premiumPriceId = await resolveStripePriceId(stripe, "premium");

    if (itemPrices.includes(premiumPriceId)) return "premium";
    if (itemPrices.includes(basicPriceId)) return "basic";
  }

  return isValidPlan(fallbackPlan) ? fallbackPlan : null;
}

async function findLatestActiveStripeSubscription(stripe, stripeCustomerId) {
  if (!stripeCustomerId) return null;

  const subscriptions = await stripe.subscriptions.list({
    customer: stripeCustomerId,
    status: "all",
    limit: 20,
    expand: ["data.items.data.price"],
  });

  const eligible = (subscriptions?.data || [])
    .filter((sub) => ["active", "trialing", "past_due", "unpaid"].includes(sub?.status))
    .sort((a, b) => (b?.created || 0) - (a?.created || 0));

  return eligible[0] || null;
}

async function upsertSubscription({
  userId,
  stripeCustomerId,
  stripeSubscriptionId,
  plan,
  status = "active",
  currentPeriodEnd = null,
}) {
  const result = await pool.query(
    `INSERT INTO subscriptions (user_id, stripe_customer_id, stripe_subscription_id, plan, status, current_period_end)
     VALUES ($1, $2, $3, $4, $5, to_timestamp($6))
     ON CONFLICT (user_id) DO UPDATE SET
       stripe_customer_id = EXCLUDED.stripe_customer_id,
       stripe_subscription_id = EXCLUDED.stripe_subscription_id,
       plan = EXCLUDED.plan,
       status = EXCLUDED.status,
       current_period_end = EXCLUDED.current_period_end,
       updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [userId, stripeCustomerId || null, stripeSubscriptionId || null, plan, status, currentPeriodEnd]
  );

  return result.rows[0] || null;
}

class PaymentController {
  // Crear sesion de pago en Stripe
  static async createCheckoutSession(req, res) {
    try {
      const { plan } = req.body;
      const stripe = getStripeClient();

      if (!stripe || !PLAN_CONFIG.basic || !PLAN_CONFIG.premium) {
        return res.status(503).json({
          error: "Pagos Stripe no configurados en este entorno.",
        });
      }

      if (!PLAN_CONFIG[plan]) {
        return res.status(400).json({ error: 'Plan no valido. Usa "basic" o "premium".' });
      }

      const priceId = await resolveStripePriceId(stripe, plan);

      // Buscar si el usuario ya tiene un customer_id en Stripe
      const result = await pool.query(
        `SELECT stripe_customer_id, status, stripe_subscription_id
         FROM subscriptions
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [req.userId]
      );

      const existingSubscription = result.rows[0] || null;
      let customerId = existingSubscription?.stripe_customer_id || null;

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
      const { successUrl, cancelUrl } = getStripeRedirectUrls();
      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        mode: "subscription",
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: { userId: String(req.userId), plan },
      });

      // Persistimos estado pendiente para no perder el customer id si el webhook no llega.
      // Si ya hay una suscripcion activa, no degradamos su estado a pending.
      const hasActiveSubscription =
        existingSubscription?.status === "active" && Boolean(existingSubscription?.stripe_subscription_id);

      if (hasActiveSubscription) {
        await pool.query(
          `UPDATE subscriptions
           SET stripe_customer_id = $2, updated_at = CURRENT_TIMESTAMP
           WHERE user_id = $1`,
          [req.userId, customerId]
        );
      } else {
        await upsertSubscription({
          userId: req.userId,
          stripeCustomerId: customerId,
          stripeSubscriptionId: null,
          plan,
          status: "pending",
          currentPeriodEnd: null,
        });
      }

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

  // Confirmar checkout al volver de Stripe (fallback robusto cuando el webhook no llega)
  static async confirmCheckoutSession(req, res) {
    try {
      const stripe = getStripeClient();
      if (!stripe || !PLAN_CONFIG.basic || !PLAN_CONFIG.premium) {
        return res.status(503).json({
          error: "Pagos Stripe no configurados en este entorno.",
        });
      }

      const sessionId = String(req.body?.sessionId || req.query?.session_id || "").trim();
      const hasValidSessionId = sessionId && sessionId.startsWith("cs_");
      const isTemplateSessionId = sessionId.includes("CHECKOUT_SESSION_ID");

      if (sessionId && !hasValidSessionId && !isTemplateSessionId) {
        return res.status(400).json({ error: "sessionId invalido" });
      }

      // Flujo principal: confirmacion con sessionId real.
      if (hasValidSessionId) {
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        if (!session || session.mode !== "subscription") {
          return res.status(400).json({ error: "La sesion no corresponde a una suscripcion." });
        }

        const metadataUserId = Number(session?.metadata?.userId);
        const plan = session?.metadata?.plan;

        if (!Number.isInteger(metadataUserId) || !isValidPlan(plan)) {
          return res.status(400).json({ error: "Metadata de sesion invalida." });
        }

        if (metadataUserId !== Number(req.userId)) {
          return res.status(403).json({ error: "No puedes confirmar una sesion de otro usuario." });
        }

        if (!session.subscription) {
          return res.status(400).json({ error: "La sesion no tiene subscription asociada." });
        }

        // Para modo suscripcion, "complete" indica checkout finalizado.
        if (session.status !== "complete") {
          return res.status(409).json({ error: "El pago aun no se ha completado." });
        }

        const stripeSub = await stripe.subscriptions.retrieve(session.subscription);
        const subscription = await upsertSubscription({
          userId: metadataUserId,
          stripeCustomerId: session.customer,
          stripeSubscriptionId: session.subscription,
          plan,
          status: "active",
          currentPeriodEnd: stripeSub?.current_period_end || null,
        });

        return res.json({
          message: "Suscripcion confirmada correctamente.",
          subscription,
        });
      }

      // Fallback robusto: si no llega sessionId (o llega plantilla), buscamos por customer.
      const existing = await pool.query(
        `SELECT stripe_customer_id, plan
         FROM subscriptions
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [req.userId]
      );

      const stripeCustomerId = existing.rows[0]?.stripe_customer_id || null;
      const fallbackPlan = existing.rows[0]?.plan || null;

      if (!stripeCustomerId) {
        return res.status(400).json({
          error: "No se pudo confirmar la suscripcion: falta sessionId valido y customer asociado.",
        });
      }

      const latestStripeSub = await findLatestActiveStripeSubscription(stripe, stripeCustomerId);
      if (!latestStripeSub) {
        return res.status(404).json({
          error: "No se encontro una suscripcion activa en Stripe para este usuario.",
        });
      }

      const inferredPlan = await inferPlanFromStripeSubscription(stripe, latestStripeSub, fallbackPlan);
      if (!isValidPlan(inferredPlan)) {
        return res.status(409).json({
          error: "No se pudo inferir el plan contratado desde Stripe.",
        });
      }

      const subscription = await upsertSubscription({
        userId: req.userId,
        stripeCustomerId: stripeCustomerId,
        stripeSubscriptionId: latestStripeSub.id,
        plan: inferredPlan,
        status: "active",
        currentPeriodEnd: latestStripeSub?.current_period_end || null,
      });

      return res.json({
        message: "Suscripcion confirmada correctamente (fallback).",
        subscription,
      });
    } catch (error) {
      console.error("Error confirmando sesion de checkout:", error);
      return res.status(500).json({ error: "No se pudo confirmar la suscripcion." });
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
    const stripe = getStripeClient();
    if (!stripe || !STRIPE_WEBHOOK_SECRET) {
      return res.status(503).json({
        error: "Webhook de Stripe no configurado en este entorno.",
      });
    }

    const sig = req.headers["stripe-signature"];
    let event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error("Webhook error:", err.message);
      return res.status(400).json({ error: `Webhook error: ${err.message}` });
    }

    try {
      if (event.type === "checkout.session.completed") {
        const session = event.data.object || {};
        const userId = Number(session?.metadata?.userId);
        const plan = session?.metadata?.plan;

        if (!Number.isInteger(userId) || !["basic", "premium"].includes(plan)) {
          return res.status(400).json({ error: "Metadata de suscripción inválida en webhook." });
        }

        if (!session.subscription) {
          return res.status(400).json({ error: "checkout.session.completed sin subscription id." });
        }

        // Obtener detalles de la suscripcion de Stripe
        const stripeSub = await stripe.subscriptions.retrieve(session.subscription);
        await upsertSubscription({
          userId,
          stripeCustomerId: session.customer,
          stripeSubscriptionId: session.subscription,
          plan,
          status: "active",
          currentPeriodEnd: stripeSub.current_period_end,
        });
      } else if (event.type === "customer.subscription.deleted") {
        const sub = event.data.object || {};
        if (sub.id) {
          await pool.query(
            `UPDATE subscriptions SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
             WHERE stripe_subscription_id = $1`,
            [sub.id]
          );
        }
      }
    } catch (error) {
      console.error("Error procesando webhook Stripe:", error);
      return res.status(500).json({ error: "Error procesando webhook de Stripe" });
    }

    res.json({ received: true });
  }

  // Cancelar suscripción activa del usuario
  static async cancelSubscription(req, res) {
    try {
      const stripe = getStripeClient();

      // Buscar suscripción activa del usuario
      const result = await pool.query(
        `SELECT stripe_subscription_id FROM subscriptions
         WHERE user_id = $1 AND status = 'active'
         ORDER BY created_at DESC LIMIT 1`,
        [req.userId]
      );

      if (!result.rows.length || !result.rows[0].stripe_subscription_id) {
        return res.status(404).json({ error: "No tienes una suscripción activa." });
      }

      const stripeSubscriptionId = result.rows[0].stripe_subscription_id;

      // Si Stripe está configurado, cancelar también en Stripe al final del periodo
      if (stripe && stripeSubscriptionId.startsWith("sub_")) {
        await stripe.subscriptions.update(stripeSubscriptionId, {
          cancel_at_period_end: true,
        });
      }

      // Marcar como cancelada en nuestra BD
      await pool.query(
        `UPDATE subscriptions SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
         WHERE user_id = $1 AND status = 'active'`,
        [req.userId]
      );

      res.json({ message: "Suscripción cancelada correctamente." });
    } catch (error) {
      console.error("Error cancelando suscripción:", error);
      res.status(500).json({ error: "Error al cancelar la suscripción." });
    }
  }
}

module.exports = PaymentController;
