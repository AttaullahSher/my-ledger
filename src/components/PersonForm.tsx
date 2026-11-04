import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { PickedContact } from '../lib/contacts'
import { ContactsButton } from './ContactsButton'
import { formatPhone } from '../lib/phone'
import * as repo from '../lib/repo'
import type { Person } from '../lib/types'
import { useApp } from './AppContext'
import { useDangerGuard } from './PinGuard'
import { Button, Field, Sheet, inputCls } from './ui'

export function PersonForm({
  open,
  onClose,
  person,
  onSaved,
  onDeleted,
}: {
  open: boolean
  onClose: () => void
  person?: Person
  onSaved?: (id: string) => void
  onDeleted?: () => void
}) {
  const { toast } = useApp()
  const guard = useDangerGuard()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setName(person?.name ?? '')
      setPhone(formatPhone(person?.phone))
      setNotes(person?.notes ?? '')
      setError('')
      setSaving(false)
    }
  }, [open, person])

  async function save() {
    setSaving(true)
    try {
      if (person) {
        await repo.updatePerson(person.id, { name, phone, notes })
        toast('Profile updated')
        onClose()
      } else {
        const p = await repo.addPerson({ name, phone, notes })
        toast(`${p.name} added`)
        onClose()
        onSaved?.(p.id)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.')
      setSaving(false)
    }
  }

  async function useContacts([c]: PickedContact[]) {
    setName(c.name)
    setPhone(c.phone ?? '')
    if (!c.phone) return setError('This contact has no mobile number — please type it.')
    if (person) return setError('') // editing: just fill in, user presses Save
    try {
      const { person: p, existed } = await repo.findOrAddPerson({ name: c.name, phone: c.phone })
      toast(existed ? `${p.name} is already in your list` : `${p.name} added`)
      onClose()
      onSaved?.(p.id)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  async function del() {
    if (!person) return
    const ok = await guard({
      title: `Delete ${person.name}?`,
      message: (
        <>
          This permanently deletes <b>{person.name}</b> and <b>all their entries</b> on every synced device. If you only want to hide them, use Archive instead.
        </>
      ),
      confirmText: 'Delete',
      typeWord: 'DELETE',
    })
    if (!ok) return
    await repo.deletePerson(person.id)
    toast(`${person.name} deleted`)
    onClose()
    onDeleted?.()
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={person ? 'Edit profile' : 'Add person'}
      footer={
        <Button className="w-full" disabled={saving} onClick={save}>
          {person ? 'Save changes' : 'Add person'}
        </Button>
      }
    >
      <div className="space-y-4">
        <ContactsButton className="w-full" label={person ? 'Fill from contacts' : 'Pick from contacts'} onPicked={useContacts} />
        <Field label="Name">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ahmed" autoCapitalize="words" onKeyDown={(e) => e.key === 'Enter' && save()} />
        </Field>
        <Field label="Mobile number" hint="Any format: 050 123 4567, 0300 1234567, +1 212 555 1234…">
          <input className={inputCls} type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+971 50 123 4567" onKeyDown={(e) => e.key === 'Enter' && save()} />
        </Field>
        {error && <div className="text-sm text-red-600">{error}</div>}
        {person && (
          <button type="button" onClick={del} className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-red-600 active:bg-red-50 dark:active:bg-red-950">
            <Trash2 size={16} /> Delete person permanently
          </button>
        )}
      </div>
    </Sheet>
  )
}
