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
  createdAt: string
  updatedAt: string
  deletedAt?: string | null
}

export type ThemeSetting = 'system' | 'light' | 'dark'
export type DateFormat = 'D MMM YYYY' | 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD'

export interface Settings {
  currency: string
  theme: ThemeSetting
  dateFormat: DateFormat
  /** Remind me to back up after this many days. 0 = never remind. */
  backupReminder: number
  lastBackupAt?: string | null
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
  dateFormat: 'D MMM YYYY',
  backupReminder: 7,
  lastBackupAt: null,
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

/** Automatic on-device safety copy of the whole ledger. */
export interface Snapshot {
  id: string
  createdAt: string
  reason: string
  counts: { people: number; transactions: number }
  json: string
}

/** A local change waiting to be uploaded to cloud sync. */
export interface OutboxItem {
  key: string // `${table}:${id}`
  table: 'people' | 'transactions'
  id: string
  queuedAt: string
}

export const REASON_SUGGESTIONS = ['Loan', 'Cash', 'Rent', 'Food', 'Fuel', 'Shopping', 'Transport', 'Salary', 'Bill', 'Other']

export const CURRENCIES = ['AED', 'SAR', 'QAR', 'KWD', 'OMR', 'BHD', 'PKR', 'INR', 'USD', 'EUR', 'GBP']

/** Settings that follow the user to every phone through auto-sync. PIN / Face ID stay on each phone. */
export const PROFILE_KEYS = ['ownerName', 'appTitle', 'accent', 'currency', 'dateFormat'] as const
