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

-- Verificar datos insertados
SELECT 'Base de datos inicializada correctamente' as status;