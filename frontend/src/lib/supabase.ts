import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
  },
})

if (import.meta.env.DEV) {
  void supabase.auth.getSession().then(async ({ data, error }) => {
    console.log('[RefAI auth debug]', {
      projectUrl: import.meta.env.VITE_SUPABASE_URL,
      hasSession: Boolean(data.session),
      hasAccessToken: Boolean(data.session?.access_token),
      expiresAt: data.session?.expires_at,
      userId: data.session?.user?.id,
      sessionError: error?.message,
    })

    if (data.session?.access_token) {
      const verified = await supabase.auth.getUser(
        data.session.access_token,
      )

      console.log('[RefAI verified user]', {
        userId: verified.data.user?.id,
        email: verified.data.user?.email,
        error: verified.error?.message,
      })
    }
  })
}
