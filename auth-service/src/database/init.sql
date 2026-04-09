CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(50) DEFAULT 'member',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de perfiles de usuario (1-a-1 con users)
CREATE TABLE IF NOT EXISTS user_profiles (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(120) NOT NULL,
    phone VARCHAR(30),
    birth_date DATE,
    gender VARCHAR(30),
    height_cm INTEGER,
    weight_kg NUMERIC(5,2),
    experience_level VARCHAR(30) DEFAULT 'beginner',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- Tabla de sesiones (para logout y gestión de tokens)
CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(500) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Índices para mejor performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);

-- Insertar usuario administrador por defecto (password: 'admin123') pero hasheado
INSERT INTO users (email, password, name, role) 
VALUES (
    'admin@smartgym.com', 
    '$2b$10$UsaIu1IFS9A8oZ060BEaFuduljrzF.Of78NO4pfdh.zzP2zEMnx5W', 
    'Administrador SmartGym', 
    'admin'
) ON CONFLICT (email) DO NOTHING;

-- Insertar usuario miembro de prueba (password: 'user123') pero hasheado
INSERT INTO users (email, password, name, role) 
VALUES (
    'usuario@smartgym.com', 
    '$2a$10$mt2qPRZFpQi1SfiHzW90OuGTN41vAxgKLXTIHcmrCcQYK99nPvT9W', 
    'Usuario Demo', 
    'member'
) ON CONFLICT (email) DO NOTHING;

-- Insertar entrenador de prueba (password: 'trainer123') pero hasheado
INSERT INTO users (email, password, name, role) 
VALUES (
    'entrenador@smartgym.com', 
    '$2a$10$o9fPeromqVeBJ8Bf7J9WpO5.hk8My69qD8x/bF4wGaHvDpuKpP8Ie', 
    'Entrenador Profesional', 
    'trainer'
) ON CONFLICT (email) DO NOTHING;

-- Perfiles base para cuentas semilla (necesarios para recuperacion por telefono)
INSERT INTO user_profiles (user_id, first_name, last_name, phone, experience_level)
SELECT id, 'Admin', 'SmartGym', '+34 600111111', 'advanced'
FROM users
WHERE email = 'admin@smartgym.com'
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO user_profiles (user_id, first_name, last_name, phone, experience_level)
SELECT id, 'Usuario', 'Demo', '+34 600222222', 'beginner'
FROM users
WHERE email = 'usuario@smartgym.com'
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO user_profiles (user_id, first_name, last_name, phone, experience_level)
SELECT id, 'Entrenador', 'Profesional', '+34 600333333', 'advanced'
FROM users
WHERE email = 'entrenador@smartgym.com'
ON CONFLICT (user_id) DO NOTHING;

-- Tabla de suscripciones
CREATE TABLE IF NOT EXISTS subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    stripe_customer_id VARCHAR(100),
    stripe_subscription_id VARCHAR(100),
    plan VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'inactive',
    current_period_end TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_subscriptions_user_id ON subscriptions(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_subscriptions_stripe_subscription_id
    ON subscriptions(stripe_subscription_id)
    WHERE stripe_subscription_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);

-- Tabla de blacklist de tokens (para logout seguro y real invalidación de JWT)
CREATE TABLE IF NOT EXISTS token_blacklist (
    id SERIAL PRIMARY KEY,
    token VARCHAR(600) NOT NULL,
    invalidated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_token_blacklist_token ON token_blacklist(token);
CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires ON token_blacklist(expires_at);

-- Tabla para recuperacion de contraseÃ±a (codigo + cambio final)
CREATE TABLE IF NOT EXISTS password_recovery_requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash VARCHAR(255) NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 5,
    code_expires_at TIMESTAMP NOT NULL,
    verified_at TIMESTAMP,
    reset_token_hash VARCHAR(255),
    reset_expires_at TIMESTAMP,
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_pwd_recovery_user_id ON password_recovery_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_pwd_recovery_code_expires ON password_recovery_requests(code_expires_at);

-- Verificar datos insertados
SELECT 'Base de datos inicializada correctamente' as status;
