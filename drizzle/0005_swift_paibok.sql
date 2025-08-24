CREATE TABLE "journal_corrections" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"entry_id" varchar(255) NOT NULL,
	"original_text" text NOT NULL,
	"corrected_text" text NOT NULL,
	"start_pos" integer NOT NULL,
	"end_pos" integer NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal_entries" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"title" varchar(500) DEFAULT 'Untitled' NOT NULL,
	"content" json NOT NULL,
	"plain_text" text DEFAULT '' NOT NULL,
	"word_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "journal_corrections" ADD CONSTRAINT "journal_corrections_entry_id_journal_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE cascade ON UPDATE no action;