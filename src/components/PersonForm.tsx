import { useEffect, useRef, useState } from 'react'
import { Contact, Trash2 } from 'lucide-react'
import { canPickContacts, parseVCards, pickContacts, type PickedContact } from '../lib/contacts'
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
  const vcfInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setName(person?.name ?? '')
      setPhone(person?.phone ?? '')
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

  async function useContacts(list: PickedContact[]) {
    if (!list.length) return toast('No contact found', 'error')
    if (list.length === 1 || person) {
      setName(list[0].name)
      if (list[0].phone) setPhone(list[0].phone)
      return
    }
    const added = await repo.addPeople(list)
    toast(`${added} people added from contacts`)
    onClose()
  }

  async function fromContacts() {
    setError('')
    if (canPickContacts()) {
      try {
        return await useContacts(await pickContacts())
      } catch {
        /* cancelled or blocked → fall back to a contact card */
      }
    }
    vcfInput.current?.click()
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
        <Button variant="secondary" className="w-full" onClick={fromContacts}>
          <Contact size={18} /> {person ? 'Fill from contacts' : 'Pick from contacts'}
        </Button>
        <input
          ref={vcfInput}
          type="file"
          accept=".vcf,text/vcard,text/x-vcard"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) await useContacts(parseVCards(await f.text()))
          }}
        />
        {!canPickContacts() && (
          <p className="-mt-2 text-xs text-slate-500">
            iPhone tip: in the Contacts app open a contact → <b>Share Contact</b> → <b>Save to Files</b>, then pick that file here. You can also share several contacts at once.
          </p>
        )}
        <Field label="Name">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ahmed" autoCapitalize="words" onKeyDown={(e) => e.key === 'Enter' && save()} />
        </Field>
        <Field label="Phone (optional)" hint="Used for Call and WhatsApp buttons.">
          <input className={inputCls} type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+971 50 123 4567" />
        </Field>
        <Field label="Notes (optional)">
          <textarea className={`${inputCls} resize-none`} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything to remember" />
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
