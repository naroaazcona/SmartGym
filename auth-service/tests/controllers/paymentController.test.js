// Env vars deben estar antes de require del módulo (se leen en tiempo de carga)
process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
process.env.STRIPE_PRICE_BASIC = 'price_basic123';
process.env.STRIPE_PRICE_PREMIUM = 'price_premium123';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_fake';
process.env.FRONTEND_URL = 'https://smartgym-app.com';
process.env.CORS_ORIGIN = 'https://smartgym-app.com';

const mockStripe = {
  checkout: {
    sessions: {
      create: jest.fn(),
      retrieve: jest.fn(),
    },
  },
  customers: { create: jest.fn() },
  subscriptions: {
    retrieve: jest.fn(),
    list: jest.fn(),
    update: jest.fn(),
  },
  prices: { list: jest.fn() },
  products: { retrieve: jest.fn() },
  webhooks: { constructEvent: jest.fn() },
};

jest.mock('stripe', () => jest.fn(() => mockStripe));
jest.mock('../../src/database/db', () => ({ query: jest.fn() }));

const pool = require('../../src/database/db');
const PaymentController = require('../../src/controllers/paymentController');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('PaymentController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  // ─── getSubscription ────────────────────────────────────────────────────────

  describe('getSubscription', () => {
    test('devuelve null si el usuario no tiene suscripción', async () => {
      pool.query.mockResolvedValue({ rows: [] });
      const req = { userId: 1 };
      const res = mockRes();

      await PaymentController.getSubscription(req, res);

      expect(res.json).toHaveBeenCalledWith({ subscription: null });
    });

    test('devuelve la suscripción cuando existe', async () => {
      const sub = { id: 1, plan: 'basic', status: 'active' };
      pool.query.mockResolvedValue({ rows: [sub] });
      const req = { userId: 1 };
      const res = mockRes();

      await PaymentController.getSubscription(req, res);

      expect(res.json).toHaveBeenCalledWith({ subscription: sub });
    });

    test('devuelve 500 en error de base de datos', async () => {
      pool.query.mockRejectedValue(new Error('DB fail'));
      const req = { userId: 1 };
      const res = mockRes();

      await PaymentController.getSubscription(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ─── createCheckoutSession ──────────────────────────────────────────────────

  describe('createCheckoutSession', () => {
    test('devuelve 400 si el plan no es válido', async () => {
      const req = { body: { plan: 'gold' }, userId: 1 };
      const res = mockRes();

      await PaymentController.createCheckoutSession(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining('basic') }),
      );
    });

    test('crea sesión de pago para usuario sin customer_id previo', async () => {
      // Primera query: buscar suscripción existente → vacía
      pool.query
        .mockResolvedValueOnce({ rows: [] })
        // Segunda: buscar usuario para crear customer
        .mockResolvedValueOnce({ rows: [{ email: 'a@test.com', name: 'Ana' }] })
        // Tercera: upsert suscripción pendiente
        .mockResolvedValueOnce({ rows: [{}] });

      mockStripe.customers.create.mockResolvedValue({ id: 'cus_new123' });
      mockStripe.checkout.sessions.create.mockResolvedValue({ url: 'https://stripe.com/pay' });

      const req = {
        body: { plan: 'basic' },
        userId: 42,
        headers: { origin: 'https://smartgym-app.com' },
      };
      const res = mockRes();

      await PaymentController.createCheckoutSession(req, res);

      expect(mockStripe.customers.create).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'a@test.com', metadata: { userId: '42' } }),
      );
      expect(res.json).toHaveBeenCalledWith({ url: 'https://stripe.com/pay' });
    });

    test('reutiliza el customer_id existente', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ stripe_customer_id: 'cus_existente', status: 'pending', stripe_subscription_id: null }] })
        .mockResolvedValueOnce({ rows: [{}] });

      mockStripe.checkout.sessions.create.mockResolvedValue({ url: 'https://stripe.com/pay2' });

      const req = {
        body: { plan: 'premium' },
        userId: 7,
        headers: {},
      };
      const res = mockRes();

      await PaymentController.createCheckoutSession(req, res);

      expect(mockStripe.customers.create).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ url: 'https://stripe.com/pay2' });
    });

    test('devuelve 404 si el usuario no existe en BD', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] }); // usuario no encontrado

      const req = { body: { plan: 'basic' }, userId: 999, headers: {} };
      const res = mockRes();

      await PaymentController.createCheckoutSession(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('devuelve 500 si Stripe lanza StripeInvalidRequestError en line_items', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ email: 'x@test.com', name: 'X' }] });

      mockStripe.customers.create.mockResolvedValue({ id: 'cus_x' });

      const stripeError = new Error('Invalid price');
      stripeError.type = 'StripeInvalidRequestError';
      stripeError.param = 'line_items[0][price]';
      mockStripe.checkout.sessions.create.mockRejectedValue(stripeError);

      const req = { body: { plan: 'basic' }, userId: 1, headers: {} };
      const res = mockRes();

      await PaymentController.createCheckoutSession(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json.mock.calls[0][0].error).toContain('Configuracion Stripe invalida');
    });
  });

  // ─── confirmCheckoutSession ─────────────────────────────────────────────────

  describe('confirmCheckoutSession', () => {
    test('devuelve 400 si el sessionId no empieza por cs_', async () => {
      const req = { body: { sessionId: 'invalid_id' }, userId: 1 };
      const res = mockRes();

      await PaymentController.confirmCheckoutSession(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'sessionId invalido' });
    });

    test('confirma sesión válida correctamente', async () => {
      const session = {
        mode: 'subscription',
        status: 'complete',
        metadata: { userId: '5', plan: 'basic' },
        subscription: 'sub_abc123',
        customer: 'cus_abc',
      };
      mockStripe.checkout.sessions.retrieve.mockResolvedValue(session);
      mockStripe.subscriptions.retrieve.mockResolvedValue({ current_period_end: 1800000000 });

      const sub = { id: 1, plan: 'basic', status: 'active' };
      pool.query.mockResolvedValue({ rows: [sub] });

      const req = { body: { sessionId: 'cs_test_valid' }, userId: 5 };
      const res = mockRes();

      await PaymentController.confirmCheckoutSession(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Suscripcion confirmada correctamente.' }),
      );
    });

    test('devuelve 403 si el sessionId pertenece a otro usuario', async () => {
      mockStripe.checkout.sessions.retrieve.mockResolvedValue({
        mode: 'subscription',
        status: 'complete',
        metadata: { userId: '99', plan: 'basic' },
        subscription: 'sub_xyz',
        customer: 'cus_xyz',
      });

      const req = { body: { sessionId: 'cs_test_other' }, userId: 1 };
      const res = mockRes();

      await PaymentController.confirmCheckoutSession(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
    });

    test('devuelve 409 si la sesión no está completa', async () => {
      mockStripe.checkout.sessions.retrieve.mockResolvedValue({
        mode: 'subscription',
        status: 'open',
        metadata: { userId: '1', plan: 'basic' },
        subscription: 'sub_x',
        customer: 'cus_x',
      });

      const req = { body: { sessionId: 'cs_open' }, userId: 1 };
      const res = mockRes();

      await PaymentController.confirmCheckoutSession(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
    });

    test('fallback: usa stripe_customer_id cuando no hay sessionId', async () => {
      pool.query.mockResolvedValueOnce({
        rows: [{ stripe_customer_id: 'cus_fall', plan: 'premium' }],
      });

      const latestSub = {
        id: 'sub_latest',
        status: 'active',
        current_period_end: 1900000000,
        items: { data: [{ price: { id: 'price_premium123' } }] },
      };
      mockStripe.subscriptions.list.mockResolvedValue({ data: [latestSub] });
      // resolveStripePriceId usa PLAN_CONFIG que ya son price_ ids → los devuelve directamente
      pool.query.mockResolvedValueOnce({ rows: [{}] }); // upsert

      const req = { body: {}, userId: 3 };
      const res = mockRes();

      await PaymentController.confirmCheckoutSession(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining('fallback') }),
      );
    });
  });

  // ─── cancelSubscription ─────────────────────────────────────────────────────

  describe('cancelSubscription', () => {
    test('devuelve 404 si no hay suscripción activa', async () => {
      pool.query.mockResolvedValue({ rows: [] });
      const req = { userId: 1 };
      const res = mockRes();

      await PaymentController.cancelSubscription(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'No tienes una suscripción activa.' });
    });

    test('cancela en Stripe y en BD cuando hay sub_id real', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ stripe_subscription_id: 'sub_real123' }] })
        .mockResolvedValueOnce({ rows: [] });

      mockStripe.subscriptions.update.mockResolvedValue({});

      const req = { userId: 2 };
      const res = mockRes();

      await PaymentController.cancelSubscription(req, res);

      expect(mockStripe.subscriptions.update).toHaveBeenCalledWith('sub_real123', {
        cancel_at_period_end: true,
      });
      expect(res.json).toHaveBeenCalledWith({ message: 'Suscripción cancelada correctamente.' });
    });

    test('cancela solo en BD cuando stripe_subscription_id no empieza por sub_', async () => {
      pool.query
        .mockResolvedValueOnce({ rows: [{ stripe_subscription_id: 'manual_id' }] })
        .mockResolvedValueOnce({ rows: [] });

      const req = { userId: 3 };
      const res = mockRes();

      await PaymentController.cancelSubscription(req, res);

      expect(mockStripe.subscriptions.update).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ message: 'Suscripción cancelada correctamente.' });
    });

    test('devuelve 500 en error de base de datos', async () => {
      pool.query.mockRejectedValue(new Error('DB fail'));
      const req = { userId: 1 };
      const res = mockRes();

      await PaymentController.cancelSubscription(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  // ─── webhook ────────────────────────────────────────────────────────────────

  describe('webhook', () => {
    test('devuelve 400 si la firma es inválida', async () => {
      mockStripe.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('Signature invalid');
      });

      const req = { headers: { 'stripe-signature': 'bad' }, body: Buffer.from('{}') };
      const res = mockRes();

      await PaymentController.webhook(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('procesa checkout.session.completed correctamente', async () => {
      const event = {
        type: 'checkout.session.completed',
        data: {
          object: {
            metadata: { userId: '10', plan: 'premium' },
            subscription: 'sub_wh123',
            customer: 'cus_wh123',
          },
        },
      };
      mockStripe.webhooks.constructEvent.mockReturnValue(event);
      mockStripe.subscriptions.retrieve.mockResolvedValue({ current_period_end: 1800000000 });
      pool.query.mockResolvedValue({ rows: [{}] });

      const req = { headers: { 'stripe-signature': 'valid' }, body: Buffer.from('{}') };
      const res = mockRes();

      await PaymentController.webhook(req, res);

      expect(pool.query).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ received: true });
    });

    test('devuelve 400 si checkout.session.completed tiene metadata inválida', async () => {
      const event = {
        type: 'checkout.session.completed',
        data: {
          object: { metadata: { userId: 'NaN', plan: 'gold' }, subscription: 'sub_x', customer: 'cus_x' },
        },
      };
      mockStripe.webhooks.constructEvent.mockReturnValue(event);

      const req = { headers: { 'stripe-signature': 'valid' }, body: Buffer.from('{}') };
      const res = mockRes();

      await PaymentController.webhook(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('procesa customer.subscription.deleted correctamente', async () => {
      const event = {
        type: 'customer.subscription.deleted',
        data: { object: { id: 'sub_del123' } },
      };
      mockStripe.webhooks.constructEvent.mockReturnValue(event);
      pool.query.mockResolvedValue({ rows: [] });

      const req = { headers: { 'stripe-signature': 'valid' }, body: Buffer.from('{}') };
      const res = mockRes();

      await PaymentController.webhook(req, res);

      const sql = pool.query.mock.calls[0][0];
      expect(sql).toContain("status = 'cancelled'");
      expect(res.json).toHaveBeenCalledWith({ received: true });
    });
  });
});
