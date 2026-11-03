// Core data shapes for MY LEDGER. All money is stored as integer minor units ("fils").

export interface Person {
  id: string
  name: string
  phone?: string
  notes?: string
  createdAt: string // ISO timestamp
  updatedAt: string // ISO timestamp
  archivedAt?: string | null
  /** Soft delete marker so deletions sync across devices. */
  deletedAt?: string | null
}

/** given = I gave money (they owe me more). received = I got money (they owe me less). */
export type Direction = 'given' | 'received'
export type TransactionType = 'given' | 'received' | 'settlement'

export interface Transaction {
  id: string
  type: TransactionType
  /** Explicit money direction. For settlements it says which way the settling money moved. */
  direction: Direction
  personId: string
  amountInFils: number
  reason?: string
  notes?: string
  date: string // YYYY-MM-DD
  /** AED, PKR or USD. Older entries without one are AED. */
  currency?: string
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
}

export type ThemeSetting = 'system' | 'light' | 'dark'

export interface Settings {
  /** Default currency for new entries. */
  currency: string
  theme: ThemeSetting
  /** PIN protecting dangerous actions (salted SHA-256). Stays on this device only. */
  pinHash?: string | null
  pinSalt?: string | null
  /** Ask for Face ID / PIN when the app opens. */
  lockOnOpen?: boolean
  /** Face ID / Touch ID passkey created on this device (base64url id). */
  faceIdCredId?: string | null
  /** Personal branding — shown in the app and on statements. */
  ownerName?: string
  appTitle?: string
  accent?: string
  onboarded?: boolean
  /** When name/branding/currency last changed (used to sync them between phones). */
  profileUpdatedAt?: string | null
}

export interface SettingsRow extends Settings {
  key: 'app'
}

export const DEFAULT_SETTINGS: Settings = {
  currency: 'AED',
  theme: 'system',
  pinHash: null,
  pinSalt: null,
  lockOnOpen: false,
  faceIdCredId: null,
  ownerName: '',
  appTitle: 'MY LEDGER',
  accent: '#0f172a',
  onboarded: false,
}

export const ACCENTS = [
  { name: 'Midnight', value: '#0f172a' },
  { name: 'Blue', value: '#1d4ed8' },
  { name: 'Teal', value: '#0f766e' },
  { name: 'Purple', value: '#6d28d9' },
  { name: 'Maroon', value: '#9f1239' },
  { name: 'Gold', value: '#a16207' },
]

/** A local change waiting to be uploaded to cloud sync. */
export interface OutboxItem {
  key: string // `${table}:${id}`
  table: 'people' | 'transactions'
  id: string
  queuedAt: string
}

export const REASON_SUGGESTIONS = ['Loan', 'Cash', 'Rent', 'Food', 'Fuel', 'Shopping', 'Transport', 'Salary', 'Bill', 'Other']

export const CURRENCIES = ['AED', 'PKR', 'USD'] as const
export const DEFAULT_CURRENCY = 'AED'

/** Settings that follow the user to every phone through auto-sync. PIN / Face ID stay on each phone. */
export const PROFILE_KEYS = ['ownerName', 'appTitle', 'accent', 'currency'] as const
