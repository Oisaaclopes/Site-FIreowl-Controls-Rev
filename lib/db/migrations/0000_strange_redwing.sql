CREATE TABLE "contact_submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"company" text NOT NULL,
	"role" text,
	"phone" text,
	"email" text NOT NULL,
	"city" text,
	"message" text NOT NULL,
	"interest" text DEFAULT 'all',
	"protocol_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sdai_diagnostics" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"company" text NOT NULL,
	"phone" text NOT NULL,
	"profile_title" text,
	"recommendation" text,
	"answers" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "simulator_submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"company" text NOT NULL,
	"role" text,
	"phone" text,
	"email" text NOT NULL,
	"additional_notes" text,
	"area" integer,
	"building_type" text,
	"estimated_value" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
