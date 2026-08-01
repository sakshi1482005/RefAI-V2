param(
  [Parameter(Mandatory=$true)][string]$ProjectRef,
  [Parameter(Mandatory=$true)][string]$DatabaseUrl
)
$ErrorActionPreference = 'Stop'
if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) { throw 'Supabase CLI is required.' }
if (-not (Get-Command psql -ErrorAction SilentlyContinue)) { throw 'PostgreSQL psql is required.' }
supabase link --project-ref $ProjectRef
supabase db push --include-all
psql $DatabaseUrl -v ON_ERROR_STOP=1 -f (Join-Path $PSScriptRoot 'verify_fresh_deployment.sql')
Write-Host 'Schema, RLS, policy, trigger, and private bucket verification passed.'
Write-Host 'Complete the documented two-role Auth and signed-resume smoke test; it intentionally requires disposable test accounts.'
