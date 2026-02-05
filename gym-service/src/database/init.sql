-- Tipos de clases (Yoga, Spinning...)
CREATE TABLE IF NOT EXISTS class_types (
  id SERIAL PRIMARY KEY,
  name VARCHAR(80) NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sesiones concretas (una clase en un día/hora, con aforo)
CREATE TABLE IF NOT EXISTS classes (
  id SERIAL PRIMARY KEY,
  class_type_id INT NOT NULL REFERENCES class_types(id) ON DELETE RESTRICT,
  trainer_user_id INT NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  capacity INT NOT NULL CHECK (capacity > 0),
  instructor_name VARCHAR(120),
  location VARCHAR(120),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_classes_starts_at ON classes(starts_at);
CREATE INDEX IF NOT EXISTS idx_classes_type ON classes(class_type_id);

-- Reservas
CREATE TABLE IF NOT EXISTS class_reservations (
  id SERIAL PRIMARY KEY,
  class_id INT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  user_id INT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'booked', -- booked | cancelled
  created_at TIMESTAMPTZ DEFAULT NOW(),
  cancelled_at TIMESTAMPTZ,
  UNIQUE (class_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_reservations_class ON class_reservations(class_id);
CREATE INDEX IF NOT EXISTS idx_reservations_user ON class_reservations(user_id);

-- Migration-friendly: ensure description exists for clases ya creadas
ALTER TABLE classes
ADD COLUMN IF NOT EXISTS description TEXT;
