import { useRef, useState } from 'react'
import { Contact } from 'lucide-react'
import { canPickContacts, parseVCards, pickContacts, type PickedContact } from '../lib/contacts'
import { useApp } from './AppContext'
import { Button, Sheet } from './ui'

/**
 * Picks people from the phone's contacts.
 * Uses the system contact picker when the phone allows it; otherwise explains how to switch it on
 * (iPhone) and offers importing a contact card (.vcf) instead.
 */
export function ContactsButton({ onPicked, label = 'Contacts', multiple = false, className }: { onPicked: (list: PickedContact[]) => void; label?: string; multiple?: boolean; className?: string }) {
  const { toast } = useApp()
  const fileInput = useRef<HTMLInputElement>(null)
  const [help, setHelp] = useState(false)

  const deliver = (list: PickedContact[]) => {
    if (!list.length) return toast('No contact found', 'error')
    onPicked(multiple ? list : list.slice(0, 1))
  }

  async function open() {
    if (canPickContacts()) {
      try {
        deliver(await pickContacts(multiple))
      } catch {
        /* cancelled */
      }
      return
    }
    setHelp(true)
  }

  return (
    <>
      <Button variant="secondary" className={className} onClick={open}>
        <Contact size={17} /> {label}
      </Button>
      <input
        ref={fileInput}
        type="file"
        accept=".vcf,text/vcard,text/x-vcard"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f) deliver(parseVCards(await f.text()))
        }}
      />
      <Sheet open={help} onClose={() => setHelp(false)} title="Use your iPhone contacts">
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
            <li>Close and reopen My Ledger, then tap “{label}” again</li>
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
                setHelp(false)
                fileInput.current?.click()
              }}
            >
              Choose contact card file
            </Button>
          </div>
        </div>
      </Sheet>
    </>
  )
}
