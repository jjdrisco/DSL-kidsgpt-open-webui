---
name: consent
description: Agent for working on consent form behavior, the ConsentModal component, consent audit records, and admin consent form CRUD endpoints.
tools: Read, Grep, Glob
model: sonnet
---

## Key Files

### Backend
- `backend/open_webui/models/consent_form.py` — ConsentForm SQLAlchemy model. Columns: id, slug, study_ids (JSON array), version, title, pi_name, irb_number, body_html, is_active, effective_date, created_at, updated_at. Table class `ConsentForms` with methods: get_by_study_id, get_all, get_by_id, create, update, deactivate.
- `backend/open_webui/models/consent_audit.py` — ConsentAudit model. Logs every consent action. FK consent_form_id links to the exact form record consented to. Also stores consent_version, prolific_pid, study_id, session_id, ui_version, user_agent.
- `backend/open_webui/routers/prolific.py` — All consent endpoints: GET /api/v1/prolific/consent-text, POST /api/v1/prolific/consent, and admin CRUD at /api/v1/prolific/consent-forms.
- `backend/open_webui/migrations/versions/dd55ee66ff77_add_consent_form_table.py` — Creates consent_form table with seed data.
- `backend/open_webui/migrations/versions/ee66ff77gg88_add_consent_form_id_to_audit.py` — Adds consent_form_id FK to consent_audit.

### Frontend
- `src/lib/components/common/ConsentModal.svelte` — Blocking modal (z-[99999], focus-trapped, escape prevented). Fetches body_html via GET /consent-text, renders with `{@html}`. Study ID resolved from URL params → localStorage → user.study_id.
- `src/lib/apis/consent-forms/index.ts` — TypeScript API functions: getConsentForms, createConsentForm, updateConsentForm, deleteConsentForm.
- `src/lib/components/admin/Settings/ConsentForms.svelte` — Admin tab: list view, inline create/edit form, HTML preview toggle, activate/deactivate controls.
- `src/lib/components/admin/Settings.svelte` — Registers "Consent Forms" tab in admin settings navigation.
- `src/routes/+layout.svelte` — Triggers ConsentModal when user.consent_given is false/null and user has prolific_pid.

## How It Works

1. Prolific participant hits /auth → POST /prolific/auth creates user with consent_given=false.
2. +layout.svelte detects consent_given=false and prolific_pid → sets showConsentModal=true.
3. ConsentModal fetches GET /prolific/consent-text?study_id=X → DB lookup via get_by_study_id → returns body_html, version, title.
4. "I Consent" button → POST /prolific/consent → sets consent_given=true, creates ConsentAudit row with consent_form_id.
5. "I Do Not Consent" → redirect to Prolific completion URL.
6. Admin manages forms via ConsentForms.svelte tab backed by the four CRUD endpoints in prolific.py.

## Important Rules

- Consent forms are NEVER hard-deleted — only soft-deactivated via is_active=false. consent_audit rows reference consent_form_id and must remain valid.
- study_ids on consent_form is a JSON array — one form can serve multiple Prolific study IDs.
- The ConsentModal is the sole enforcement gate for consent; the workflow state endpoint does NOT check consent_given.
- consent_audit.consent_form_id creates an unambiguous audit link to the exact HTML the participant saw; always populate it when recording consent.
- Version strings on consent_form must be mirrored to consent_audit.consent_version for a complete audit trail.
