-- Job ID and request-level Referral Category are not RefAI product fields.
-- Remove them safely from projects that applied an earlier compatibility draft.

alter table public.referral_requests
  drop column if exists job_id,
  drop column if exists referral_category;
