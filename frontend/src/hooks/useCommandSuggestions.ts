import { useMemo } from 'react'

export interface SuggestionItem {
  text: string
  label: string
  description: string
}

export interface SuggestionState {
  suggestions: SuggestionItem[]
  loading: boolean
}

const COMMANDS: SuggestionItem[] = [
  { text: '/prompt',   label: '/prompt',   description: 'Create a new prompt — /prompt <text>' },
  { text: '/new',      label: '/new',      description: 'Create a new prompt (alias for /prompt)' },
  { text: '/snippet',  label: '/snippet',  description: 'Browse snippets or /snippet new <text>' },
  { text: '/model',    label: '/model',    description: 'Switch model' },
  { text: '/refine',   label: '/refine',   description: 'Refine the latest prompt' },
  { text: '/history',  label: '/history',  description: 'View project history' },
]

export function useCommandSuggestions(input: string): SuggestionState {
  const suggestions = useMemo(() => {
    const trimmed = input.trim().toLowerCase()
    if (!trimmed.startsWith('/')) return []
    return COMMANDS.filter(c => c.text.startsWith(trimmed))
  }, [input])

  return { suggestions, loading: false }
}
