CREATE TABLE "book_annotations" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"book_id" varchar(255) NOT NULL,
	"start_location" varchar(1000) NOT NULL,
	"end_location" varchar(1000) NOT NULL,
	"selected_text" text NOT NULL,
	"annotation" text,
	"highlight_color" varchar(20) DEFAULT 'yellow' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bookmarks" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"book_id" varchar(255) NOT NULL,
	"location" varchar(1000) NOT NULL,
	"text" text,
	"note" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "books" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"title" varchar(500) NOT NULL,
	"author" varchar(300),
	"language" varchar(10) DEFAULT 'es' NOT NULL,
	"description" text,
	"cover_image_url" varchar(1000),
	"file_path" varchar(1000) NOT NULL,
	"file_size" bigint NOT NULL,
	"isbn" varchar(20),
	"publisher" varchar(300),
	"publish_date" timestamp,
	"page_count" integer,
	"word_count" integer,
	"metadata" json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reading_progress" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"book_id" varchar(255) NOT NULL,
	"current_location" varchar(1000) NOT NULL,
	"progress_percentage" integer DEFAULT 0 NOT NULL,
	"reading_time_ms" bigint DEFAULT 0 NOT NULL,
	"last_read_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "book_annotations" ADD CONSTRAINT "book_annotations_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookmarks" ADD CONSTRAINT "bookmarks_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_progress" ADD CONSTRAINT "reading_progress_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;