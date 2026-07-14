from supabase import create_client, Client

from app.core.config import settings

# Server-side client using the service role key — bypasses RLS,
# so only use this inside trusted backend logic.
supabase: Client = create_client(settings.supabase_url, settings.supabase_service_key)
