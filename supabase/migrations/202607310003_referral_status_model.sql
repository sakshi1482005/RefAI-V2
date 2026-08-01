-- Extend the existing enum without renaming or removing legacy values.
-- `pending` remains readable for old deployments; new requests use `submitted`.
alter type public.referral_status add value if not exists 'draft';
alter type public.referral_status add value if not exists 'submitted';
alter type public.referral_status add value if not exists 'withdrawn';
alter type public.referral_status add value if not exists 'expired';

