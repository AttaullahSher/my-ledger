import { useSyncExternalStore } from 'react'
import { getSyncState, subscribeSync } from '../lib/sync'

export const useSync = () => useSyncExternalStore(subscribeSync, getSyncState)
