CREATE TYPE "public"."conjugation_tense" AS ENUM('present', 'preterite', 'imperfect', 'future', 'conditional', 'present_subjunctive');--> statement-breakpoint
CREATE TYPE "public"."drill_status" AS ENUM('active', 'completed', 'skipped');--> statement-breakpoint
CREATE TABLE "conjugation_drills" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"sentence" text NOT NULL,
	"verb" varchar(100) NOT NULL,
	"pronoun" varchar(50) NOT NULL,
	"tense" "conjugation_tense" NOT NULL,
	"correct_answer" varchar(100) NOT NULL,
	"rule_id" varchar(255) NOT NULL,
	"difficulty" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drill_sessions" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"drill_ids" json NOT NULL,
	"status" "drill_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "user_drill_attempts" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"drill_id" varchar(255) NOT NULL,
	"user_answer" varchar(100) NOT NULL,
	"is_correct" boolean NOT NULL,
	"time_spent" integer,
	"status" "drill_status" DEFAULT 'completed' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_rule_progress" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"rule_id" varchar(255) NOT NULL,
	"correct_count" integer DEFAULT 0 NOT NULL,
	"total_attempts" integer DEFAULT 0 NOT NULL,
	"last_attempt_at" timestamp,
	"is_unlocked" boolean DEFAULT false NOT NULL,
	"unlocked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verb_rules" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"description" text NOT NULL,
	"category" varchar(100) NOT NULL,
	"tenses" json NOT NULL,
	"order" integer NOT NULL,
	"is_unlocked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conjugation_drills" ADD CONSTRAINT "conjugation_drills_rule_id_verb_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."verb_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_drill_attempts" ADD CONSTRAINT "user_drill_attempts_drill_id_conjugation_drills_id_fk" FOREIGN KEY ("drill_id") REFERENCES "public"."conjugation_drills"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_rule_progress" ADD CONSTRAINT "user_rule_progress_rule_id_verb_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."verb_rules"("id") ON DELETE no action ON UPDATE no action;