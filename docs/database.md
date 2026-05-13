# Database

Postgres (with pgvector) is used for conversations, messages, and RAG formula docs. Schema is managed by **Drizzle migrations** only.

## Reset database (e.g. after inconsistency, never in prod)

**Docker Compose:**

1. Stop and remove the volume (deletes all data):
   ```bash
   docker compose down -v
   ```
2. Start Postgres again:
   ```bash
   docker compose up -d
   ```
3. Run migrations:
   ```bash
   npm run db:migrate
   ```
4. If using RAG (`FORMULA_SOURCE=rag`), seed formula docs once:
   ```bash
   npm run db:seed-formula-docs
   ```

**Without Docker (local Postgres):**

1. Drop and recreate the database (e.g. `psql -U postgres -c "DROP DATABASE formel_assistent;" -c "CREATE DATABASE formel_assistent;"`).
2. Run `npm run db:migrate`.
3. Optionally `npm run db:seed-formula-docs` for RAG.
