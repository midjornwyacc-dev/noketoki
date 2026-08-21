import { clipKeyterms } from './keyterms'

export const SYNC_LANGUAGE_CODES = new Set([
  'en',
  'es',
  'de',
  'fr',
  'it',
  'pt',
  'tr',
  'nl',
  'sv',
  'no',
  'da',
  'fi',
  'hi',
  'vi',
  'ar',
  'he',
  'ja',
  'ur',
  'zh'
])

export const LANGUAGE_OPTIONS: { code: string; label: string }[] = [
  { code: 'ru', label: 'Русский' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'de', label: 'Deutsch' },
  { code: 'fr', label: 'Français' },
  { code: 'it', label: 'Italiano' },
  { code: 'pt', label: 'Português' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'nl', label: 'Nederlands' },
  { code: 'sv', label: 'Svenska' },
  { code: 'no', label: 'Norsk' },
  { code: 'da', label: 'Dansk' },
  { code: 'fi', label: 'Suomi' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'ar', label: 'العربية' },
  { code: 'he', label: 'עברית' },
  { code: 'ja', label: '日本語' },
  { code: 'ur', label: 'اردو' },
  { code: 'zh', label: '中文' }
]

const LANGUAGE_NAMES: Record<string, string> = {
  ru: 'Russian',
  en: 'English',
  es: 'Spanish',
  de: 'German',
  fr: 'French',
  it: 'Italian',
  pt: 'Portuguese',
  tr: 'Turkish',
  nl: 'Dutch',
  sv: 'Swedish',
  no: 'Norwegian',
  da: 'Danish',
  fi: 'Finnish',
  hi: 'Hindi',
  vi: 'Vietnamese',
  ar: 'Arabic',
  he: 'Hebrew',
  ja: 'Japanese',
  ur: 'Urdu',
  zh: 'Chinese'
}

export type SyncConfig = {
  language_code?: string
  prompt?: string
  keyterms_prompt?: string[]
}

export function buildSyncConfig(opts: { language: string; dictionary: string[] }): SyncConfig {
  const config: SyncConfig = {}
  const keyterms = clipKeyterms(opts.dictionary)
  if (keyterms.length > 0) config.keyterms_prompt = keyterms

  if (SYNC_LANGUAGE_CODES.has(opts.language)) {
    config.language_code = opts.language
  } else {
    const name = LANGUAGE_NAMES[opts.language] ?? opts.language
    config.prompt = `Spoken ${name} dictation into a text field.`
  }
  return config
}
