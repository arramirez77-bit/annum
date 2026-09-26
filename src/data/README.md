# src/data — storage and bank data (M5–M6)

SQLite schema and migrations (SQLCipher-encrypted), repositories, the Plaid client (through the Worker), CSV/OFX import, sync, export/import, and the widget snapshot writer.

Rules: all reads and writes go through repositories. Secrets only through `secure.ts` (Keychain). Never log balances, transactions or tokens.
