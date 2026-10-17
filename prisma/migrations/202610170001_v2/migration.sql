-- Accepting a candidate response as the new baseline is recorded on the result.
ALTER TABLE "results" ADD COLUMN "accepted_at" TEXT;
ALTER TABLE "results" ADD COLUMN "accepted_by" TEXT;

-- Personal API tokens for CI. Only a SHA-256 hash of each token is stored.
CREATE TABLE "api_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "created_at" TEXT NOT NULL,
    "last_used_at" TEXT,

    CONSTRAINT "api_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "api_tokens_token_hash_key" ON "api_tokens"("token_hash");
CREATE INDEX "api_tokens_user_id_idx" ON "api_tokens"("user_id");
ALTER TABLE "api_tokens" ADD CONSTRAINT "api_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
