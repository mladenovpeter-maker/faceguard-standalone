CREATE TYPE "public"."visitor_type" AS ENUM('supplier', 'carrier', 'client', 'guest', 'other');
--> statement-breakpoint
CREATE TABLE "visitors" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"company" text,
	"type" "visitor_type" DEFAULT 'guest' NOT NULL,
	"phone" text,
	"email" text,
	"photo_url" text,
	"card_number" text,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "visitor_visits" (
	"id" serial PRIMARY KEY NOT NULL,
	"visitor_id" integer NOT NULL,
	"purpose" text,
	"host_name" text,
	"check_in" timestamp with time zone DEFAULT now() NOT NULL,
	"check_out" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "visitor_visits_visitor_id_visitors_id_fk" FOREIGN KEY ("visitor_id") REFERENCES "visitors"("id") ON DELETE cascade
);
