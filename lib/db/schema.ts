import { pgTable, serial, text, integer, timestamp, numeric, boolean, uuid } from "drizzle-orm/pg-core";

// Table to store submissions from the main Contact / Lead Form
export const contactSubmissions = pgTable("contact_submissions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  company: text("company").notNull(),
  role: text("role"),
  phone: text("phone"),
  email: text("email").notNull(),
  city: text("city"),
  message: text("message").notNull(),
  interest: text("interest").default("all"),
  protocolId: text("protocol_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Table to store estimations from the instant SDAI Cost Simulator
export const simulatorSubmissions = pgTable("simulator_submissions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  company: text("company").notNull(),
  role: text("role"),
  phone: text("phone"),
  email: text("email").notNull(),
  additionalNotes: text("additional_notes"),
  area: integer("area"),
  buildingType: text("building_type"),
  estimatedValue: text("estimated_value"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Tabela de persistência do Estoque (produtos do almoxarifado)
export const inventoryItems = pgTable("inventory_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code"),
  serialBP: text("serial_bp"),
  name: text("name").notNull(),
  category: text("category"),
  quantity: integer("quantity").default(0),
  minQuantity: integer("min_quantity").default(0),
  unitPrice: numeric("unit_price").default("0"),
  supplier: text("supplier"),
  location: text("location"),
  imageUrl: text("image_url"),
  unit: text("unit"),
  salePrice: numeric("sale_price"),
  costPrice: numeric("cost_price"),
  profitMargin: numeric("profit_margin"),
  markup: numeric("markup"),
  stockManaged: boolean("stock_managed").default(true),
  idealQuantity: integer("ideal_quantity"),
  reservedQuantity: integer("reserved_quantity"),
  brand: text("brand"),
  model: text("model"),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Histórico de movimentações de estoque (entradas e saídas)
export const stockMovements = pgTable("stock_movements", {
  id: uuid("id").primaryKey().defaultRandom(),
  itemId: uuid("item_id"),
  itemCode: text("item_code"),
  itemName: text("item_name"),
  type: text("type").notNull(),
  quantity: integer("quantity").notNull(),
  resultingBalance: integer("resulting_balance"),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Table to store diagnostics from the Smart Quiz ("Diagnóstico Inteligente SDAI")
export const sdaiDiagnostics = pgTable("sdai_diagnostics", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  company: text("company").notNull(),
  phone: text("phone").notNull(),
  profileTitle: text("profile_title"),
  recommendation: text("recommendation"),
  answers: text("answers"), // Will store quiz selections mapped or as serialized JSON string
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
