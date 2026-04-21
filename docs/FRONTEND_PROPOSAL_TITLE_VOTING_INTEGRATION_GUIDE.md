# Frontend Proposal Details + Feedback + Title Voting Integration Guide

This guide explains how to integrate proposal review UI that needs **proposal details**, a **feedback timeline**, and the optional **title voting** feature.

Endpoints covered (integrate these together on one screen if you want):

- `GET /api/v1/projects/proposals/{id}` — Get proposal details
- `POST /api/v1/projects/proposals/{id}/feedbacks` — Add feedback comment to a submitted proposal
- `GET /api/v1/projects/proposals/{id}/feedbacks` — List feedback comments for a proposal
- `POST /api/v1/projects/proposals/{id}/title-votes` — Vote for one of the three proposed titles on a submitted proposal
- `GET /api/v1/projects/proposals/{id}/title-votes` — Get title vote counts and voter details for a proposal

## Core Rules Enforced by the Backend

- Feedback comments can be added only when the proposal status is **`SUBMITTED`**.
- Title voting is allowed only when the proposal status is **`SUBMITTED`**.
- A proposal must have exactly **3 candidate titles** in `proposal.proposedTitles` for title voting.
- Voting is **upsert** behavior per user per proposal: one vote per proposal per voter.
- These features are **optional** and do **not** change the existing approval/reject flow.

## Authorization (Who Can Access)

All endpoints require a valid JWT.

### 1) Get proposal details (GET)

- Students: allowed only if they are the **submitter** OR a member of the same **approved project group**.
- Non-students: allowed only with **department access** to the proposal’s department.

### 2) Add feedback comment (POST)

Allowed roles:

- `ADVISOR`
- `COORDINATOR`
- `DEPARTMENT_HEAD`

Rules:

- Reviewer must have **department access** to the proposal.
- Proposal must be **`SUBMITTED`**.

Not allowed:

- `STUDENT`

### 3) List feedback comments (GET)

- Same access rules as proposal details.

### 4) Vote for a title (POST)

Allowed roles:

- `ADVISOR`
- `COORDINATOR`
- `DEPARTMENT_HEAD`

Rules:

- Reviewer must have **department access** to the proposal.
- Proposal must be **`SUBMITTED`**.
- Proposal must have exactly **3** candidate titles in `proposedTitles`.

Not allowed:

- `STUDENT`

### 5) View title vote breakdown (GET)

Allowed roles:

- `COORDINATOR`
- `DEPARTMENT_HEAD`

Not allowed:

- `ADVISOR` (can vote but cannot view everyone’s votes)
- `STUDENT`

## Base URL + Auth

- Base URL: `/api/v1`
- All endpoints require a valid JWT access token.

Header:

```http
Authorization: Bearer <access_token>
```

## Global Response Wrapper Note

This backend uses a global response wrapper in many environments. Your frontend may receive:

```json
{
  "success": true,
  "message": "Success",
  "data": { "...": "..." },
  "timestamp": "2026-04-21T10:00:00.000Z"
}
```

In this guide, sample payloads show the **inner payload** (the `data` value) for readability.

---

## Endpoint 1: Get Proposal Details

### Request

- Method: `GET`
- URL: `/api/v1/projects/proposals/{proposalId}`
- Auth: required

### Success Response

Status code:

- `200 OK`

Response payload (inner `data`) is a proposal object. It includes key nested data such as:

- `submitter` (basic profile)
- `advisor` (basic profile, if assigned)
- `projectGroup` (leader + members)
- `department` (id + name)
- `project` (if proposal already created a project)

Example (partial):

```json
{
  "id": "proposal_uuid",
  "status": "SUBMITTED",
  "title": "Primary title",
  "proposedTitles": ["Title A", "Title B", "Title C"],
  "description": "...",
  "submittedBy": "student_user_uuid",
  "submitter": {
    "id": "student_user_uuid",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com"
  },
  "advisor": {
    "id": "advisor_uuid",
    "firstName": "Helen",
    "lastName": "Smith",
    "email": "helen@example.com",
    "avatarUrl": null
  },
  "department": {
    "id": "department_uuid",
    "name": "Software Engineering"
  },
  "projectGroup": {
    "id": "group_uuid",
    "name": "Group Alpha",
    "leader": {
      "id": "leader_uuid",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "avatarUrl": null
    },
    "members": [
      {
        "user": {
          "id": "member_uuid",
          "firstName": "Sara",
          "lastName": "Ali",
          "email": "sara@example.com",
          "avatarUrl": null
        }
      }
    ]
  },
  "project": null
}
```

### Common Error Cases

- `401 Unauthorized`: missing/invalid token
- `403 Forbidden`: user does not have access (not submitter/not in group/no department access)
- `404 Not Found`: proposal not found

---

## Endpoint 2: Add Feedback Comment (Submitted Proposals Only)

### Request

- Method: `POST`
- URL: `/api/v1/projects/proposals/{proposalId}/feedbacks`
- Auth: required

Body:

```json
{
  "message": "Please clarify the scope and add more recent citations."
}
```

Rules:

- `message` is required, trimmed, max length `2000`
- Only allowed while proposal is `SUBMITTED`

### Success Response

Status code:

- `201 Created`

Response payload (inner `data`):

```json
{
  "id": "feedback_uuid",
  "proposalId": "proposal_uuid",
  "authorId": "reviewer_uuid",
  "authorRole": "ADVISOR",
  "message": "Please clarify the scope and add more recent citations.",
  "createdAt": "2026-04-21T10:00:00.000Z",
  "author": {
    "id": "reviewer_uuid",
    "firstName": "Helen",
    "lastName": "Smith",
    "email": "helen@example.com",
    "avatarUrl": null
  }
}
```

### Common Error Cases

- `401 Unauthorized`: missing/invalid token
- `403 Forbidden`: user is not an allowed reviewer role / no department access
- `404 Not Found`: proposal not found
- `409 Conflict`: proposal is not `SUBMITTED`
- `400 Bad Request`: invalid or empty `message`

---

## Endpoint 3: List Feedback Comments

### Request

- Method: `GET`
- URL: `/api/v1/projects/proposals/{proposalId}/feedbacks`
- Auth: required

### Success Response

Status code:

- `200 OK`

Response payload (inner `data`) is an array ordered by `createdAt` ascending:

```json
[
  {
    "id": "feedback_1",
    "proposalId": "proposal_uuid",
    "authorId": "reviewer_uuid",
    "authorRole": "COORDINATOR",
    "message": "Please add a clearer problem statement.",
    "createdAt": "2026-04-21T09:10:00.000Z",
    "author": {
      "id": "reviewer_uuid",
      "firstName": "Mary",
      "lastName": "Coordinator",
      "email": "mary@example.com",
      "avatarUrl": null
    }
  }
]
```

### Common Error Cases

- `401 Unauthorized`: missing/invalid token
- `403 Forbidden`: user does not have access (not submitter/not in group/no department access)
- `404 Not Found`: proposal not found

---

## Endpoint 4: Vote for a Proposal Title

### Request

- Method: `POST`
- URL: `/api/v1/projects/proposals/{proposalId}/title-votes`
- Auth: required

Body:

```json
{
  "titleIndex": 1
}
```

`titleIndex` rules:

- Must be an integer
- Must be between `0` and `2` (inclusive)
- It is the 0-based index for `proposal.proposedTitles`

### Success Response

Status code:

- `201 Created`

Response payload (inner `data`):

```json
{
  "id": "vote_uuid",
  "proposalId": "proposal_uuid",
  "voterId": "user_uuid",
  "voterRole": "ADVISOR",
  "titleIndex": 1,
  "createdAt": "2026-04-21T10:00:00.000Z",
  "updatedAt": "2026-04-21T10:00:00.000Z",
  "voter": {
    "id": "user_uuid",
    "firstName": "Helen",
    "lastName": "Smith",
    "email": "helen@example.com",
    "avatarUrl": null
  }
}
```

Notes:

- If the same voter votes again on the same proposal, the backend **updates** their existing vote.

### Common Error Cases

- `401 Unauthorized`: missing/invalid token
- `403 Forbidden`: user is not an allowed reviewer role
- `404 Not Found`: proposal not found
- `409 Conflict`: proposal is not `SUBMITTED` (voting is locked outside `SUBMITTED`)
- `400 Bad Request`:
  - proposal does not have exactly 3 titles
  - `titleIndex` is invalid

---

## Endpoint 5: Get Vote Counts + Vote Details

This endpoint is designed for coordinator/department head review.

### Request

- Method: `GET`
- URL: `/api/v1/projects/proposals/{proposalId}/title-votes`
- Auth: required

### Success Response

Status code:

- `200 OK`

Response payload (inner `data`):

```json
{
  "proposalId": "proposal_uuid",
  "counts": {
    "0": 1,
    "1": 2,
    "2": 0
  },
  "votes": [
    {
      "id": "vote_1",
      "proposalId": "proposal_uuid",
      "voterId": "user_1",
      "voterRole": "ADVISOR",
      "titleIndex": 0,
      "createdAt": "2026-04-21T09:50:00.000Z",
      "updatedAt": "2026-04-21T09:50:00.000Z",
      "voter": {
        "id": "user_1",
        "firstName": "A",
        "lastName": "Advisor",
        "email": "a@example.com",
        "avatarUrl": null
      }
    }
  ]
}
```

Meaning:

- `counts[0]` = number of votes for title index 0
- `counts[1]` = number of votes for title index 1
- `counts[2]` = number of votes for title index 2

### Common Error Cases

- `401 Unauthorized`: missing/invalid token
- `403 Forbidden`: user is not `COORDINATOR` or `DEPARTMENT_HEAD`
- `404 Not Found`: proposal not found

---

## Recommended Stepwise Frontend Flow

The simplest approach is a single Proposal Review page that branches by role.

### Step 1 — Load proposal details (all roles)

- Call: `GET /api/v1/projects/proposals/{proposalId}`
- Use this for:
  - proposal status gating (`SUBMITTED` is required for feedback + voting)
  - rendering `proposedTitles` (3 options)
  - rendering group/submitter context

### Step 2 — Load feedback timeline (all allowed roles)

- Call: `GET /api/v1/projects/proposals/{proposalId}/feedbacks`
- Render as a timeline (sorted by `createdAt` ascending from API).

### Step 3 — Allow reviewers to add feedback (reviewer roles only)

- Show a comment box only for: `ADVISOR`, `COORDINATOR`, `DEPARTMENT_HEAD`.
- On submit, call: `POST /api/v1/projects/proposals/{proposalId}/feedbacks`.
- After success, append the returned item to your timeline.

### Step 4 — Allow reviewers to vote title (reviewer roles only)

- Show title vote UI only for: `ADVISOR`, `COORDINATOR`, `DEPARTMENT_HEAD`.
- Call: `POST /api/v1/projects/proposals/{proposalId}/title-votes`.
- If proposal is not `SUBMITTED`, disable the vote UI.

### Step 5 — Show vote breakdown (coordinator/department head only)

- Only for: `COORDINATOR`, `DEPARTMENT_HEAD`.
- Call: `GET /api/v1/projects/proposals/{proposalId}/title-votes`.
- Show:
  - totals per title (counts)
  - optional voter list (votes)

### Step 6 — Coordinator final decision flow (unchanged)

- Keep your existing approve/reject UI unchanged.
- Title voting and feedback are informational inputs.

---

## Minimal Frontend Types (TypeScript)

```ts
export type ProposalTitleIndex = 0 | 1 | 2;

export interface VoteProposalTitleRequest {
  titleIndex: ProposalTitleIndex;
}

export interface CreateProposalFeedbackRequest {
  message: string;
}

export interface ProposalFeedbackAuthor {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl: string | null;
}

export interface ProposalFeedback {
  id: string;
  proposalId: string;
  authorId: string;
  authorRole: 'ADVISOR' | 'COORDINATOR' | 'DEPARTMENT_HEAD';
  message: string;
  createdAt: string;
  author: ProposalFeedbackAuthor;
}

export interface ProposalTitleVoteVoter {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatarUrl: string | null;
}

export interface ProposalTitleVote {
  id: string;
  proposalId: string;
  voterId: string;
  voterRole: 'ADVISOR' | 'COORDINATOR' | 'DEPARTMENT_HEAD';
  titleIndex: ProposalTitleIndex;
  createdAt: string;
  updatedAt: string;
  voter: ProposalTitleVoteVoter;
}

export interface GetProposalTitleVotesResponse {
  proposalId: string;
  counts: Record<'0' | '1' | '2', number>;
  votes: ProposalTitleVote[];
}
```

---

## Minimal Frontend API Examples (fetch)

```ts
export async function getProposalDetails(proposalId: string, token: string) {
  const response = await fetch(`/api/v1/projects/proposals/${proposalId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw await response.json();
  }

  return response.json();
}

export async function listProposalFeedbacks(proposalId: string, token: string) {
  const response = await fetch(`/api/v1/projects/proposals/${proposalId}/feedbacks`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw await response.json();
  }

  return response.json();
}

export async function addProposalFeedback(
  proposalId: string,
  token: string,
  body: { message: string }
) {
  const response = await fetch(`/api/v1/projects/proposals/${proposalId}/feedbacks`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw await response.json();
  }

  return response.json();
}

export async function voteProposalTitle(
  proposalId: string,
  token: string,
  body: { titleIndex: 0 | 1 | 2 }
) {
  const response = await fetch(`/api/v1/projects/proposals/${proposalId}/title-votes`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw await response.json();
  }

  return response.json();
}

export async function getProposalTitleVotes(proposalId: string, token: string) {
  const response = await fetch(`/api/v1/projects/proposals/${proposalId}/title-votes`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw await response.json();
  }

  return response.json();
}
```

---

## UI Handling Tips

- If `GET /proposals/{id}` returns `403`, show a safe “No access” state.
- If `GET /feedbacks` returns `403`, hide the timeline (or show “No access”).
- If `POST /feedbacks` returns `409 Conflict`, show: “Feedback is only available while the proposal is submitted.”
- If `POST /feedbacks` returns `400 Bad Request`, show a field error (message is required / too long).
- If voting returns `409 Conflict`, show: “Voting is only available while the proposal is submitted.”
- If voting returns `400 Bad Request` (missing titles), show a safe fallback: “This proposal is missing candidate titles.”
- If viewing votes returns `403`, hide the vote breakdown UI (role mismatch).

---

## Quick Checklist

- [ ] GET proposal details (and enforce access UX)
- [ ] GET feedback timeline and render it
- [ ] For reviewer roles: POST feedback comment while `SUBMITTED`
- [ ] Show exactly 3 title options from `proposal.proposedTitles`
- [ ] POST vote with `titleIndex` 0..2
- [ ] For coordinator/department head only: GET vote counts + voter list
- [ ] Keep proposal approval/reject UI unchanged
