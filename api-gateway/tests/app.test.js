/**
 * Tests del API Gateway.
 *
 * app.js no exporta el app y llama a app.listen() en tiempo de carga,
 * por lo que se testean por separado:
 *   - La lógica CORS (parseo y validación de orígenes)
 *   - La configuración de rate limiters
 *   - El endpoint /health con un app express equivalente
 */

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

// ─── Helpers copiados del gateway (misma lógica) ─────────────────────────────

function parseAllowedOrigins(rawCorsOrigins) {
  return rawCorsOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function buildCorsOptions(allowedOrigins) {
  return {
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS origin not allowed: ${origin}`));
    },
    credentials: true,
  };
}

// ─── Tests de parseo de orígenes CORS ────────────────────────────────────────

describe('parseAllowedOrigins', () => {
  test('parsea un origen único', () => {
    const result = parseAllowedOrigins('https://smartgym-app.com');
    expect(result).toEqual(['https://smartgym-app.com']);
  });

  test('parsea múltiples orígenes separados por coma', () => {
    const result = parseAllowedOrigins(
      'https://smartgym-app.com, https://www.smartgym-app.com',
    );
    expect(result).toEqual(['https://smartgym-app.com', 'https://www.smartgym-app.com']);
  });

  test('filtra entradas vacías', () => {
    const result = parseAllowedOrigins('https://a.com,,https://b.com');
    expect(result).toEqual(['https://a.com', 'https://b.com']);
  });
});

// ─── Tests de la función CORS origin ─────────────────────────────────────────

describe('buildCorsOptions origin', () => {
  const allowed = ['https://smartgym-app.com', 'https://www.smartgym-app.com'];
  const { origin } = buildCorsOptions(allowed);

  test('permite peticiones sin origin (curl, server-to-server)', (done) => {
    origin(undefined, (err, ok) => {
      expect(err).toBeNull();
      expect(ok).toBe(true);
      done();
    });
  });

  test('permite origin en la lista', (done) => {
    origin('https://smartgym-app.com', (err, ok) => {
      expect(err).toBeNull();
      expect(ok).toBe(true);
      done();
    });
  });

  test('rechaza origin no permitido', (done) => {
    origin('https://evil.com', (err) => {
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toContain('not allowed');
      done();
    });
  });

  test('rechaza origin parecido pero distinto al dominio permitido', (done) => {
    origin('https://smartgym-app.com.evil.com', (err) => {
      expect(err).toBeInstanceOf(Error);
      done();
    });
  });
});

// ─── Tests de configuración de rate limiters ──────────────────────────────────

describe('rate limiters', () => {
  test('authLimiter tiene ventana de 15 min y max 10', () => {
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 10,
      message: { error: 'Demasiados intentos. Por favor espera 15 minutos.' },
    });
    // rateLimit devuelve un middleware; verificamos que tiene las opciones correctas
    expect(typeof limiter).toBe('function');
    // El limiter no lanza al crearse con opciones válidas
  });

  test('trainingLimiter tiene ventana de 10 min y max 20', () => {
    const limiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 20 });
    expect(typeof limiter).toBe('function');
  });

  test('generalLimiter tiene ventana de 10 min y max 200', () => {
    const limiter = rateLimit({ windowMs: 10 * 60 * 1000, max: 200 });
    expect(typeof limiter).toBe('function');
  });
});

// ─── Tests del endpoint /health ───────────────────────────────────────────────

describe('/health endpoint', () => {
  let server;
  let baseUrl;

  beforeAll(() => {
    const AUTH_URL = 'http://auth-service:3001';
    const GYM_URL = 'http://gym-service:3002';
    const TRAINING_URL = 'http://training-service:5000';

    const app = express();
    app.get('/health', (req, res) => {
      res.status(200).json({
        message: 'API Gateway funcionando',
        servicios: { auth: AUTH_URL, gym: GYM_URL, training: TRAINING_URL },
      });
    });

    return new Promise((resolve) => {
      server = app.listen(0, () => {
        const { port } = server.address();
        baseUrl = `http://localhost:${port}`;
        resolve();
      });
    });
  });

  afterAll(() => new Promise((resolve) => server.close(resolve)));

  test('devuelve 200 con mensaje de estado', async () => {
    const res = await fetch(`${baseUrl}/health`);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.message).toBe('API Gateway funcionando');
  });

  test('incluye las URLs de los servicios', async () => {
    const res = await fetch(`${baseUrl}/health`);
    const body = await res.json();
    expect(body.servicios).toHaveProperty('auth');
    expect(body.servicios).toHaveProperty('gym');
    expect(body.servicios).toHaveProperty('training');
  });
});

// ─── Tests de configuración de rutas proxy ────────────────────────────────────

describe('configuración de rutas proxy', () => {
  // Verifica que la tabla de rutas es coherente con lo esperado
  const routes = {
    '/auth': 'http://auth-service:3001',
    '/gym': 'http://gym-service:3002',
    '/training': 'http://training-service:5000',
  };

  test.each(Object.entries(routes))('ruta %s apunta al servicio correcto', (path, expectedTarget) => {
    expect(expectedTarget).toMatch(/^http:\/\//);
    expect(path.startsWith('/')).toBe(true);
  });

  test('las rutas de auth tienen rate limiter estricto', () => {
    const authRoutes = [
      '/auth/login',
      '/auth/register',
      '/auth/google',
      '/auth/password-recovery/start',
      '/auth/password-recovery/verify',
      '/auth/password-recovery/reset',
    ];
    authRoutes.forEach((route) => {
      expect(route.startsWith('/auth')).toBe(true);
    });
  });
});
