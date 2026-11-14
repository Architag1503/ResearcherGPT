# Security and Privacy Assessment

## 1. Identified Risks & Phase 1 Mitigations

1. **Hardcoded API Key Literal Removed (`ai-service/services/formatex_service.py`)**:
   - **Baseline Defect:** `API_KEY` fell back to a live hardcoded `fex_...` credential literal in version-controlled source code.
   - **Remediation:** Replaced fallback literal with `os.getenv("FORMATEX_API_KEY", "")`. Requests fail cleanly with an explicit configuration message when `FORMATEX_API_KEY` is absent, verified by automated regression test `test_formatex_requires_env_key_without_hardcoded_secret`.
   - **Operational Action Recommended:** Rotate any previously exposed FormaTeX key on the provider dashboard if the upstream repository was public.
2. **Production Authentication Bypass Guarded (`server/src/middlewares/auth.middleware.ts`, `server/src/server.ts`)**:
   - **Baseline Defect:** Missing `Authorization` headers or `mock-token` attached a default researcher profile unconditionally regardless of `NODE_ENV`.
   - **Remediation:** Scoped developer mock authentication strictly to `NODE_ENV !== 'production'` (or explicit `ALLOW_DEV_MOCK_AUTH === 'true'`). Under `NODE_ENV=production`, missing or mock tokens return HTTP `401 Unauthorized`, verified by `server/src/tests/phase1Regressions.unit.ts`.
   - **Remaining Limitation:** Standard Bearer tokens still rely on a simulated Clerk decode stub inside `authMiddleware` unless full cryptographic JWKS signature verification against Clerk is enabled for internet-facing deployment.
3. **Destructive Qdrant Collection Drop Guarded (`ai-service/services/qdrant_service.py`)**:
   - **Baseline Defect:** `ensure_collection` deleted and recreated the entire `research_chunks` vector collection whenever runtime embedding dimension diverged.
   - **Remediation:** Now raises an explicit mismatch error unless `QDRANT_RECREATE_ON_MISMATCH=true`, protecting user embeddings from silent data loss.
4. **Secret Hygiene**: All `.env` files are excluded from version control and never printed in logs, docs, or benchmark artifacts.
