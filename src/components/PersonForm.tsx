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
  const [contactHelp, setContactHelp] = useState(false)

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
        return // cancelled
      }
    }
    setContactHelp(true)
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
        <Field label="Name">
          <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ahmed" autoCapitalize="words" onKeyDown={(e) => e.key === 'Enter' && save()} />
        </Field>
        {error && <div className="text-sm text-red-600">{error}</div>}
        <Sheet open={contactHelp} onClose={() => setContactHelp(false)} title="Use your iPhone contacts">
          <div className="space-y-4 pb-3 text-[15px]">
            <p className="text-slate-600 dark:text-slate-300">iPhone keeps contacts closed to web apps until you allow it once:</p>
            <ol className="list-decimal space-y-1.5 rounded-2xl bg-slate-50 p-4 pl-8 dark:bg-slate-800">
              <li>
                Open the iPhone <b>Settings</b> app
              </li>
              <li>
                <b>Apps</b> → <b>Safari</b> → <b>Advanced</b> → <b>Feature Flags</b>
              </li>
              <li>
                Turn on <b>Contact Picker API</b>
              </li>
              <li>Close and reopen My Ledger, then tap “Pick from contacts” again</li>
            </ol>
            <p className="text-sm text-slate-500">Only the contacts you tap are shared with the app — never your whole address book.</p>
            <div className="border-t border-slate-100 pt-3 dark:border-slate-800">
              <p className="mb-2 text-sm text-slate-500">
                Or import a contact card: in Contacts open a person → <b>Share Contact</b> → <b>Save to Files</b>, then:
              </p>
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => {
                  setContactHelp(false)
                  vcfInput.current?.click()
                }}
              >
                Choose contact card file
              </Button>
            </div>
          </div>
        </Sheet>
        {person && (
          <button type="button" onClick={del} className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-red-600 active:bg-red-50 dark:active:bg-red-950">
            <Trash2 size={16} /> Delete person permanently
          </button>
        )}
      </div>
    </Sheet>
  )
}
