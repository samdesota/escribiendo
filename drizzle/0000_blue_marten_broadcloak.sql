CREATE TYPE "public"."message_type" AS ENUM('user', 'assistant', 'suggestion');--> statement-breakpoint
CREATE TABLE "chats" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"title" varchar(500) NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"chat_id" varchar(255) NOT NULL,
	"type" "message_type" NOT NULL,
	"content" text NOT NULL,
	"timestamp" bigint NOT NULL,
	"is_complete" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE cascade ON UPDATE no action;