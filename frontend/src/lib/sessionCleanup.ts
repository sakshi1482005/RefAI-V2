import { clearAnalysisSession } from './analysisSession'

const LOCAL_STORAGE_KEYS = new Set(['refai_role'])
const LOCAL_STORAGE_PREFIXES = ['refai-decision:', 'refai-profile:']

/** Clear RefAI-owned caches without directly manipulating Supabase auth storage. */
export function clearTemporaryUserState() {
  clearAnalysisSession()
  sessionStorage.removeItem('refai_trust_card_celebration')

  for (let index = localStorage.length - 1; index >= 0; index -= 1) {
    const key = localStorage.key(index)
    if (key && (LOCAL_STORAGE_KEYS.has(key) || LOCAL_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix)))) {
      localStorage.removeItem(key)
    }
  }
}
