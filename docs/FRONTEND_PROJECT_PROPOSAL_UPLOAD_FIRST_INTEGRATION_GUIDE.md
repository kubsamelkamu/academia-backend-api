# Frontend Proposal Upload-First Integration Guide (Option B)

This guide describes the **upload-first** proposal flow (Option B): the student group leader starts by uploading the proposal PDF, and the backend creates the proposal draft in the same request.

## Base

- Base URL: `/api/v1`
- Auth header: `Authorization: Bearer <token>`
- Swagger tag: `Project Management`

## Who can use this flow

- **Student (approved Group Leader)** only.
- If the student is not an approved group leader, the API returns `403`.

## High-level flow (step-by-step)

1. **Create draft + upload PDF** (single call)
2. **Submit proposal** for review
3. Coordinator / Department Head **approve or reject**
4. Coordinator / Department Head / Advisor **creates project from approved proposal**

The key contract is:

- A proposal cannot be submitted unless it has exactly one uploaded PDF stored as `proposal.documents[]` with `key = "proposal.pdf"`.

---

## Step 1 — Create draft + upload proposal PDF (ONE request)

### Endpoint

- `POST /projects/proposals/with-proposal-pdf`
- Content type: `multipart/form-data`

### Form fields

Required fields:

- `titles` — exactly 3 values
- `proposalPdf` — file (`application/pdf`), max size **5MB**

Optional fields:

- `description` — string

### Recommended request format (repeat the `titles` field 3 times)

Most frontend libraries (and servers) handle repeated multipart fields reliably.

```ts
const form = new FormData();
form.append('titles', title1);
form.append('titles', title2);
form.append('titles', title3);
if (description) form.append('description', description);
form.append('proposalPdf', file); // must be PDF, <= 5MB

const res = await fetch('/api/v1/projects/proposals/with-proposal-pdf', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
  },
  body: form,
});

if (!res.ok) {
  const err = await res.json().catch(() => null);
  throw new Error(err?.message ?? `Request failed (${res.status})`);
}

const proposal = await res.json();
// proposal.status should be "DRAFT"
// proposal.documents should include key "proposal.pdf"
```

### Alternate request format (single `titles` field as JSON array string)

Use this only if your UI layer cannot repeat fields:

- `titles = ["Title one","Title two","Title three"]`

### Backend behavior

- Creates the proposal in `DRAFT`.
- Uploads the PDF to Cloudinary (raw).
- Stores the uploaded file metadata into `proposal.documents` like:
  - `key: "proposal.pdf"`
  - `url`, `publicId`, `resourceType`, `mimeType`, `sizeBytes`, `uploadedAt`
- If the upload fails, backend **rolls back** and deletes the created proposal draft.

### Expected responses

- `201` → Proposal created in `DRAFT` with `documents[0].key === "proposal.pdf"`

Common errors:

- `400` → invalid titles, missing description, missing PDF, non-PDF, file too large
- `403` → not an approved group leader / not a student

---

## Step 2 — Submit proposal for review

### Endpoint

- `POST /projects/proposals/:id/submit`

### Behavior

- Allowed from `DRAFT` or `REJECTED`.
- Moves proposal status to `SUBMITTED`.
- Requires that `proposal.pdf` exists in `proposal.documents`.
- Only one proposal per project group can be in `SUBMITTED` at a time (otherwise `409`).

### Expected responses

- `200` → status becomes `SUBMITTED`

Common errors:

- `400` → missing `proposal.pdf`, invalid transition
- `409` → already submitted (cannot submit twice unless `REJECTED`), or already approved
- `403` → trying to submit someone else’s proposal

---

## Step 3 — Reviewer decision (Coordinator / Department Head)

### Endpoint

- `PUT /projects/proposals/:id/status`

Approve payload:

```json
{
  "status": "APPROVED",
  "advisorId": "advisor-user-id",
  "approvedTitleIndex": 1
}
```

Reject payload:

```json
{
  "status": "REJECTED",
  "feedback": "Refine scope and references."
}
```

---

## Step 4 — Create project from approved proposal

### Endpoint

- `POST /projects`

```json
{
  "proposalId": "proposal-id"
}
```

---

## Frontend UI checklist (recommended)

### Upload-first screen

- Inputs:
  - 3 title fields (required, unique)
  - description (optional)
  - PDF picker (required, max 5MB)
- Action button:
  - “Upload Proposal” calls `POST /projects/proposals/with-proposal-pdf`

After success:

- Store `proposal.id` and show “Draft created” state.
- Enable “Submit for Review” button.

### Submit screen (or same page)

- Button: “Submit for review” calls `POST /projects/proposals/:id/submit`
- On success: show `SUBMITTED` state.

### Error handling tips

- If upload fails: show a blocking error and allow retry (backend rolls back the draft).
- If submit fails with missing PDF: treat as a client-state bug; refresh proposal details or force re-upload.

---

## Swagger testing tips

Swagger UI sometimes has limitations with repeating multipart fields.

If Swagger does not let you provide 3 `titles` inputs:

- Provide `titles` as a JSON array string:
  - `[
    "Title 1",
    "Title 2",
    "Title 3"
    ]`

---

## Minimal state machine

- `DRAFT` → `SUBMITTED` → (`APPROVED` or `REJECTED`)
- `REJECTED` → `SUBMITTED` (resubmission allowed)

---

## What to store in frontend state

- `proposalId`

If you need the whole group to see proposal history, use:

- `GET /projects/proposals/group`
- `status`
- `documents[]` (check presence of `key === "proposal.pdf"`)
- `proposedTitles[]`, `selectedTitleIndex` (after approval)
