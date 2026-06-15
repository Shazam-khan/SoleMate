-- ============================================================================
-- SoleMate — PostgreSQL schema
-- ----------------------------------------------------------------------------
-- Reconstructed from the application's queries. Identifier casing is chosen to
-- match the existing queries exactly:
--   * "Users", "Order", "P_Images", "P_Size"  -> created quoted (case-sensitive)
--   * product, category, payment, order_details -> created unquoted (lowercase)
-- This lets the current SQL run unchanged against a fresh database (local
-- Postgres in dev, Amazon RDS in production).
--
-- Run:  psql "$DATABASE_URL" -f backend/DB/schema.sql
-- ============================================================================

BEGIN;

-- Enable gen_random_uuid() (the app generates UUIDs in Node, but this is handy
-- for manual inserts and future server-side defaults).
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- Users
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Users" (
    u_id          UUID PRIMARY KEY,
    is_admin      CHAR(1)      NOT NULL DEFAULT 'N' CHECK (is_admin IN ('Y', 'N')),
    first_name    VARCHAR(100) NOT NULL,
    last_name     VARCHAR(100) NOT NULL,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password      VARCHAR(255) NOT NULL,           -- stores a bcrypt hash, never plaintext
    phone_number  VARCHAR(20)  NOT NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- Product
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product (
    p_id     UUID PRIMARY KEY,
    p_name   VARCHAR(255)   NOT NULL,
    brand    VARCHAR(255)   NOT NULL,
    price    NUMERIC(10, 2) NOT NULL CHECK (price >= 0)
);

-- ----------------------------------------------------------------------------
-- Category (belongs to a product)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS category (
    c_id            UUID PRIMARY KEY,
    user_preference VARCHAR(255),
    c_name          VARCHAR(255) NOT NULL,
    description     TEXT,
    product_p_id    UUID NOT NULL REFERENCES product (p_id) ON DELETE CASCADE
);

-- ----------------------------------------------------------------------------
-- Product images
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "P_Images" (
    id          UUID PRIMARY KEY,
    image_url   TEXT NOT NULL,
    product_id  UUID NOT NULL REFERENCES product (p_id) ON DELETE CASCADE
);

-- ----------------------------------------------------------------------------
-- Product sizes / stock
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "P_Size" (
    id          UUID PRIMARY KEY,
    size        VARCHAR(20) NOT NULL,
    stock       INTEGER     NOT NULL DEFAULT 0 CHECK (stock >= 0),
    product_id  UUID NOT NULL REFERENCES product (p_id) ON DELETE CASCADE,
    UNIQUE (product_id, size)
);

-- ----------------------------------------------------------------------------
-- Orders
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "Order" (
    o_id          UUID PRIMARY KEY,
    order_date    TIMESTAMPTZ    NOT NULL DEFAULT now(),
    promised_date TIMESTAMPTZ,
    address       TEXT           NOT NULL,
    total_amount  NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (total_amount >= 0),
    user_u_id     UUID           NOT NULL REFERENCES "Users" (u_id) ON DELETE CASCADE,
    is_complete   BOOLEAN        NOT NULL DEFAULT FALSE
);

-- ----------------------------------------------------------------------------
-- Order line items
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_details (
    od_id        UUID PRIMARY KEY,
    quantity     INTEGER        NOT NULL CHECK (quantity > 0),
    od_price     NUMERIC(10, 2) NOT NULL CHECK (od_price >= 0),
    product_p_id UUID           NOT NULL REFERENCES product (p_id) ON DELETE CASCADE,
    order_o_id   UUID           NOT NULL REFERENCES "Order" (o_id) ON DELETE CASCADE,
    size         VARCHAR(20)    NOT NULL,
    user_id      UUID           NOT NULL REFERENCES "Users" (u_id) ON DELETE CASCADE
);

-- ----------------------------------------------------------------------------
-- Payments
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment (
    payment_id     UUID PRIMARY KEY,
    payment_amount NUMERIC(10, 2) NOT NULL CHECK (payment_amount >= 0),
    payment_date   TIMESTAMPTZ    NOT NULL DEFAULT now(),
    payment_method VARCHAR(50)    NOT NULL,
    order_o_id     UUID           NOT NULL REFERENCES "Order" (o_id) ON DELETE CASCADE,
    status         VARCHAR(20)    NOT NULL DEFAULT 'PENDING'
                     CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED'))
);

-- ----------------------------------------------------------------------------
-- Indexes for the foreign keys the app filters on most
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_category_product   ON category (product_p_id);
CREATE INDEX IF NOT EXISTS idx_pimages_product    ON "P_Images" (product_id);
CREATE INDEX IF NOT EXISTS idx_psize_product      ON "P_Size" (product_id);
CREATE INDEX IF NOT EXISTS idx_order_user         ON "Order" (user_u_id);
CREATE INDEX IF NOT EXISTS idx_orderdetails_order ON order_details (order_o_id);
CREATE INDEX IF NOT EXISTS idx_orderdetails_user  ON order_details (user_id);
CREATE INDEX IF NOT EXISTS idx_payment_order      ON payment (order_o_id);

COMMIT;
