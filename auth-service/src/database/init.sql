CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    role VARCHAR(50) DEFAULT 'member',
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

-- Insertar usuario administrador por defecto (password: 'admin123')
INSERT INTO users (email, password, name, role) 
VALUES (
    'admin@smartgym.com', 
    'admin1234', 
    'Administrador SmartGym', 
    'admin'
) ON CONFLICT (email) DO NOTHING;

-- Insertar usuario miembro de prueba (password: 'user123')
INSERT INTO users (email, password, name, role) 
VALUES (
    'usuario@smartgym.com', 
    'usuario1234', 
    'Usuario Demo', 
    'member'
) ON CONFLICT (email) DO NOTHING;

-- Insertar entrenador de prueba (password: 'trainer123')
INSERT INTO users (email, password, name, role) 
VALUES (
    'entrenador@smartgym.com', 
    'entrenador1234', 
    'Entrenador Profesional', 
    'trainer'
) ON CONFLICT (email) DO NOTHING;

-- Verificar datos insertados
SELECT 'Base de datos inicializada correctamente' as status;