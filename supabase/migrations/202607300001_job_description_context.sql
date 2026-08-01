-- Preserve real opportunity metadata and deterministic JD classification on
-- the existing persisted resume analysis.

alter table public.resume_analyses
  add column if not exists used_general_role_expectations boolean not null default false,
  add column if not exists job_description_classification jsonb not null default '{
    "requiredSkills": [],
    "preferredSkills": [],
    "responsibilities": [],
    "experienceExpectations": [],
    "educationOrCertificationExpectations": []
  }'::jsonb;

alter table public.resume_analyses
  drop constraint if exists resume_analyses_job_metadata_valid;

alter table public.resume_analyses
  drop constraint if exists resume_analyses_job_description_classification_valid;

alter table public.resume_analyses
  add constraint resume_analyses_job_description_classification_valid
  check (
    job_description_classification is null
    or jsonb_typeof(job_description_classification) = 'object'
  );
