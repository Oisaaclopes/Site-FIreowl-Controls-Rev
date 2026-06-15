import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

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
