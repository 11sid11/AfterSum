Below is the implementation spec I would give a coding agent as the **single `/goal` for the entire application**.

The scope is intentionally practical: **no SQLite, no bank-account ledger, no SSR/backend server, no automatic cross-mode reconciliation, and no AI/OCR/bank integrations.**

For this app I would use **Vite + React + TypeScript + TanStack Router/Form**, rather than TanStack Start. Router already provides the client-first typed routing model we need, while TanStack Form gives strongly typed form state. Dexie remains the reactive IndexedDB layer, and `vite-plugin-pwa` handles the application-shell/service-worker side of offline use. ([TanStack][1])

---

# `/goal`: Build the complete offline-first finance utility PWA

## 0. Product objective

Build a mobile-first installable finance utility PWA with four primary sections:

```text
Overview
Track
Split
Lend
```

plus Settings.

The three financial modules must be **financially independent**.

```text
TRACK
Personal monthly spending

SPLIT
Trip/group shared expenses

LEND
Direct person-to-person lending/borrowing
```

They may share:

```text
People
basic settings
currency utilities
date utilities
UI components
```

But **financial balances must never automatically move between modules**.

Example:

```text
Rahul

Lend
Rahul owes me ₹5,000

Goa Trip
Rahul owes me ₹1,200

Delhi Trip
I owe Rahul ₹600
```

These remain three separate obligations.

Overview may show:

```text
Net exposure with Rahul
+₹5,600
```

but that is informational only.

It must never rewrite the underlying ledgers.

---

# 1. Non-negotiable architecture rules

Implement these rules throughout the codebase.

### Rule A — local first

Every financial action must complete against Dexie/IndexedDB first.

```text
User action
   ↓
Validate
   ↓
Dexie transaction
   ↓
UI updates
   ↓
queue cloud synchronization
```

Google APIs must never be required to add, edit, delete, split, lend, repay, or view data.

Dexie provides the IndexedDB abstraction and reactive `useLiveQuery()` integration needed for this client-first model. ([Dexie][2])

### Rule B — no SQLite

Do not add:

```text
SQLite
sql.js
wa-sqlite
OPFS SQLite
PGlite
```

Persistence is:

```text
Dexie
  ↓
IndexedDB
```

### Rule C — modules cannot modify each other

`track/` must not call repositories from `split/` or `lend/`.

`split/` must not modify Track or Lend.

`lend/` must not modify Track or Split.

Only `overview/` may **read** across modules.

### Rule D — shared Person has no financial balance

Never add:

```ts
person.balance
person.amountOwed
person.netBalance
```

A Person represents identity only.

Balances are calculated within financial contexts.

### Rule E — derived values are not financial truth

Do not persist things like:

```text
Rahul overall balance
Goa calculated outstanding
monthly expense total
net exposure
```

Calculate those from underlying records.

### Rule F — Overview is read-only

Overview contains projections/adapters/query functions only.

No financial mutations originate from Overview except redirecting the user into the correct module-specific action.

### Rule G — money is integer minor units internally

₹1,250.50:

```ts
amountMinor = 125050
currency = "INR"
```

Never use floating-point decimals as canonical monetary state.

### Rule H — Google Sheets is a cloud replica

Dexie remains operational storage.

Google Sheets is for:

```text
cloud copy
recovery
portability
human inspection
```

Do not turn Sheets into the database queried by React on every screen.

---

# 2. Tech stack

Use:

```text
React
TypeScript
Vite

@tanstack/react-router
@tanstack/react-form

Dexie
dexie-react-hooks

Zod

Tailwind CSS
shadcn/ui
Lucide

vite-plugin-pwa

fflate
or JSZip

Vitest
React Testing Library
Playwright
```

Do **not** add Redux.

Do **not** add Zustand for financial/domain state.

Do **not** add TanStack Query unless an actual conventional remote-data requirement appears.

Use Dexie reactive queries instead.

TanStack Router supports typed routes/navigation/search parameters, which is appropriate for filterable screens such as monthly Track views and group views. ([TanStack][3])

---

# 3. Initial project setup

Create the project:

```text
Vite
React
TypeScript
```

Configure:

```text
ESLint
Prettier
strict TypeScript
path aliases
Vitest
Playwright
Tailwind
PWA
```

Use strict TypeScript.

Avoid:

```ts
any
```

unless integrating an unavoidable third-party API boundary.

Suggested alias:

```text
@/app
@/db
@/shared
@/modules
@/overview
@/sync
@/export
@/components
```

---

# 4. Target directory structure

```text
src/
│
├── app/
│   ├── router.tsx
│   ├── providers.tsx
│   ├── layout/
│   └── constants/
│
├── routes/
│   ├── __root.tsx
│   ├── index.tsx
│   │
│   ├── overview/
│   ├── track/
│   ├── split/
│   ├── lend/
│   └── settings/
│
├── db/
│   ├── database.ts
│   ├── schema.ts
│   ├── migrations/
│   └── transaction.ts
│
├── shared/
│   │
│   ├── people/
│   │   ├── domain/
│   │   ├── repository/
│   │   ├── queries/
│   │   └── components/
│   │
│   ├── money/
│   ├── dates/
│   ├── ids/
│   ├── validation/
│   └── settings/
│
├── modules/
│   │
│   ├── track/
│   │   ├── domain/
│   │   ├── repositories/
│   │   ├── queries/
│   │   ├── services/
│   │   ├── components/
│   │   └── forms/
│   │
│   ├── split/
│   │   ├── domain/
│   │   ├── repositories/
│   │   ├── queries/
│   │   ├── services/
│   │   ├── components/
│   │   └── forms/
│   │
│   └── lend/
│       ├── domain/
│       ├── repositories/
│       ├── queries/
│       ├── services/
│       ├── components/
│       └── forms/
│
├── overview/
│   ├── projections/
│   ├── queries/
│   ├── adapters/
│   └── components/
│
├── sync/
│   ├── google/
│   │   ├── auth/
│   │   ├── drive/
│   │   ├── sheets/
│   │   └── serializers/
│   ├── queue/
│   └── status/
│
├── export/
│   ├── csv/
│   ├── json/
│   ├── zip/
│   └── serializers/
│
├── pwa/
│
├── components/
│   └── ui/
│
└── tests/
```

---

# 5. Shared entity model

Implement a common entity shape.

```ts
interface BaseEntity {
  id: string

  createdAt: string
  updatedAt: string

  deletedAt?: string

  revision: number
}
```

Use client-generated IDs.

Prefer:

```text
UUID
```

or:

```text
ULID
```

Do not use Dexie auto-increment IDs for domain entities.

---

# 6. Money utilities

Create:

```text
shared/money/
```

Implement and test:

```ts
type CurrencyCode = string

interface Money {
  amountMinor: number
  currency: CurrencyCode
}
```

Functions:

```ts
parseMoney()
formatMoney()

decimalToMinor()
minorToDecimal()

addMoney()
subtractMoney()

allocateEqual()
allocateByPercentage()
allocateByShares()
```

Allocation must guarantee:

```text
sum(children) === original amount
```

For example:

```text
₹100 / 3

₹33.34
₹33.33
₹33.33
```

must equal exactly:

```text
₹100.00
```

---

# 7. Shared People model

Implement:

```ts
interface Person extends BaseEntity {
  name: string

  phone?: string
  email?: string
  note?: string

  isSelf?: boolean
}
```

There must be exactly one logical local user/"Me".

Use:

```ts
isSelf: true
```

rather than hardcoding names.

People can be reused by Split and Lend.

Track does not require People.

---

# 8. Settings

Keep settings small.

```ts
interface AppSettings {
  id: "app"

  defaultCurrency: string

  theme:
    | "system"
    | "light"
    | "dark"

  hideAmounts: boolean

  googleSyncEnabled: boolean

  googleSpreadsheetId?: string
  googleFolderId?: string
}
```

Initial currency:

```text
INR
```

but architecture must not hardcode INR.

---

# 9. Dexie database

Create one Dexie database containing separate tables.

```text
SHARED

people
settings

TRACK

trackTransactions
trackCategories
trackBudgets
trackRecurringRules

SPLIT

splitGroups
splitGroupMembers
splitExpenses
splitPayers
splitShares
splitSettlements

LEND

lendLedgers
lendEntries

SYSTEM

syncQueue
syncMetadata
```

Do not put Overview tables in IndexedDB.

Overview is derived.

---

# 10. Dexie schema versioning

Start with:

```ts
db.version(1)
```

All future schema changes must use explicit Dexie migrations.

Never delete and recreate the DB during normal upgrades.

Add migration tests.

---

# 11. Repository rule

React components must never contain:

```ts
db.table.add(...)
```

directly.

Use repositories.

Example:

```ts
trackTransactionRepository.create()
trackTransactionRepository.update()
trackTransactionRepository.softDelete()
```

Similarly:

```ts
lendEntryRepository
splitExpenseRepository
personRepository
```

Repository responsibilities:

```text
persistence
timestamps
revision increments
soft deletion
sync dirty marking
```

---

# 12. Soft deletion

Financial entities should use:

```ts
deletedAt
```

Deletion flow:

```text
delete
 ↓
set deletedAt
 ↓
hide from ordinary queries
 ↓
show Undo snackbar
```

Do not hard-delete immediately.

---

# 13. TRACK module objective

Track answers:

> Where did my money go this month?

It is **not** a bank-account manager.

Do not implement:

```text
HDFC
ICICI
credit-card balances
wallet balances
bank reconciliation
net worth
bank transfers
```

---

# 14. Track categories

Create simple default expense categories:

```text
Food
Travel
Shopping
Bills
Entertainment
Health
Education
Other
```

Income can simply be:

```text
Income
```

Allow custom categories.

Model:

```ts
interface TrackCategory extends BaseEntity {
  name: string

  type:
    | "expense"
    | "income"

  icon?: string

  archived: boolean
}
```

No nested categories in V1.

---

# 15. Track transaction

```ts
interface TrackTransaction extends BaseEntity {
  type:
    | "expense"
    | "income"

  title: string

  amountMinor: number
  currency: string

  categoryId?: string

  paymentMethod?:
    | "cash"
    | "upi"
    | "card"
    | "other"

  date: string

  note?: string
}
```

`paymentMethod` is only a label/filter.

Never calculate payment-method balances.

---

# 16. Track budget

Start with a monthly overall budget.

```ts
interface TrackBudget extends BaseEntity {
  month: string

  amountMinor: number
  currency: string
}
```

Example:

```text
2026-08
₹30,000
```

Category budgets may be added after the global monthly budget works.

---

# 17. Recurring Track reminders

Model:

```ts
interface TrackRecurringRule extends BaseEntity {
  title: string

  amountMinor?: number
  currency: string

  categoryId?: string

  frequency:
    | "weekly"
    | "monthly"
    | "yearly"

  nextDate: string

  enabled: boolean
}
```

V1 behavior:

```text
reminder/template
```

Do not automatically insert financial transactions without confirmation.

---

# 18. Track routes

Implement:

```text
/track

/track/month/$year/$month

/track/add

/track/transaction/$transactionId

/track/categories

/track/budget

/track/recurring
```

---

# 19. Track dashboard

Mobile layout:

```text
AUGUST 2026

Spent
₹18,450

Budget
₹30,000

Remaining
₹11,550

────────────────

Food          ₹6,200
Travel        ₹3,400
Shopping      ₹4,100
Bills         ₹2,800
Other         ₹1,950

────────────────

Recent

₹450  Dinner
₹120  Auto
₹299  Recharge
₹850  Groceries
```

Include:

```text
previous month
next month
```

navigation.

---

# 20. Track filters/search

Support:

```text
text query
category
expense/income
date/month
payment method
```

Filters should be encoded in TanStack Router search params where appropriate.

---

# 21. LEND module objective

Lend answers:

> What money have I directly lent to or borrowed from someone?

It is independent from Split.

---

# 22. Lend ledger

Model:

```ts
interface LendLedger extends BaseEntity {
  personId: string

  currency: string

  label?: string

  archived: boolean
}
```

Initially create one default ledger per:

```text
person + currency
```

but allow the model to support multiple ledgers later.

---

# 23. Lend entry

```ts
interface LendEntry extends BaseEntity {
  ledgerId: string

  type:
    | "lent"
    | "borrowed"
    | "repayment_received"
    | "repayment_given"
    | "adjustment"

  amountMinor: number

  date: string

  dueDate?: string

  note?: string
}
```

---

# 24. Lend sign convention

Define once:

```text
positive
=
they owe me

negative
=
I owe them
```

Effects:

```text
lent                  +
borrowed              -
repayment_received    -
repayment_given       +
```

Example:

```text
Lent Rahul          +₹5,000
Rahul repaid        -₹1,000
Lent Rahul          +₹2,000
──────────────────────────
Rahul owes           ₹6,000
```

Implement this in a pure domain function.

---

# 25. Lend routes

```text
/lend

/lend/person/$personId

/lend/ledger/$ledgerId

/lend/add
```

---

# 26. Lend dashboard

```text
LEND

You'll receive
₹18,500

You owe
₹4,200

────────────────

Rahul
Owes you ₹5,000

Aman
You owe ₹1,500

Mom
Owes you ₹13,500
```

---

# 27. Person lending screen

```text
Rahul

Rahul owes you
₹5,000

────────────────

13 Aug
You lent Rahul
₹2,000

3 Aug
Rahul repaid
₹1,000

20 Jul
You lent Rahul
₹4,000

────────────────

+ Add entry
```

Do not show Goa balances here.

---

# 28. SPLIT module objective

Split handles:

```text
Trips
Groups
Shared purchases
Who paid
Who participated
Who owes whom
Settlements
```

Every Split group is its own financial context.

---

# 29. Split Group

```ts
interface SplitGroup extends BaseEntity {
  name: string

  description?: string

  currency: string

  archived: boolean
}
```

Examples:

```text
Goa Trip
Flat Expenses
Office Dinner
```

---

# 30. Split member

```ts
interface SplitGroupMember extends BaseEntity {
  groupId: string
  personId: string
}
```

Historical members must remain resolvable even after they are no longer active.

If member removal is required, prefer:

```text
active = false
```

rather than destroying their historic relationship.

---

# 31. Split expense

```ts
interface SplitExpense extends BaseEntity {
  groupId: string

  title: string

  amountMinor: number
  currency: string

  date: string

  splitMethod:
    | "equal"
    | "exact"
    | "percentage"
    | "shares"

  note?: string
}
```

---

# 32. Split payer

Do not store:

```ts
expense.paidBy
```

Use a separate table.

```ts
interface SplitPayer extends BaseEntity {
  expenseId: string

  personId: string

  amountMinor: number
}
```

This lets the schema support multiple payers later.

V1 UI may initially default to a single payer.

---

# 33. Split share

```ts
interface SplitShare extends BaseEntity {
  expenseId: string

  personId: string

  amountMinor: number
}
```

Persist final monetary shares.

For example, equal split of ₹100 among 3:

```text
₹33.34
₹33.33
₹33.33
```

Store those exact numbers.

Do not continuously recompute historical expense amounts from percentages.

---

# 34. Split settlement

```ts
interface SplitSettlement extends BaseEntity {
  groupId: string

  fromPersonId: string
  toPersonId: string

  amountMinor: number
  currency: string

  date: string

  note?: string
}
```

Settlements apply only to the selected group.

---

# 35. Split atomic writes

Creating an expense should use one Dexie transaction.

```text
create expense
+
create payer rows
+
create share rows
```

Either all succeed or none succeed.

---

# 36. Split calculations

Implement pure functions.

```ts
calculateEqualShares()
calculateExactShares()
calculatePercentageShares()
calculateShareWeightedShares()

calculateGroupBalances()

simplifyGroupDebts()
```

Group balance convention:

```text
positive
=
should receive

negative
=
owes
```

---

# 37. Split balance logic

Conceptually:

```text
balance
=
payments made
-
allocated shares
+
settlements sent
-
settlements received
```

Test this extensively.

---

# 38. Debt simplification

Debt simplification must return recommendations only.

Example:

```text
Sid       +₹4,000
Rahul     -₹2,000
Aman      -₹2,000
```

becomes:

```text
Rahul → Sid ₹2,000
Aman  → Sid ₹2,000
```

Do not mutate expenses.

---

# 39. Split routes

```text
/split

/split/group/$groupId

/split/group/$groupId/add

/split/group/$groupId/balances

/split/group/$groupId/activity

/split/group/$groupId/settle

/split/group/$groupId/settings
```

---

# 40. Split dashboard

```text
SPLIT

Active groups

Goa Trip
You're owed ₹2,300

Flat
You owe ₹850

Office Dinner
Settled
```

---

# 41. Split group screen

```text
GOA TRIP

Group spending
₹18,400

Your share
₹6,100

You paid
₹8,400

You're owed
₹2,300

────────────────

Balances

Rahul owes you ₹1,400
Aman owes you   ₹900

────────────────

Hotel      ₹6,000
Dinner     ₹2,400
Taxi         ₹800
Tickets    ₹4,000
```

---

# 42. Overview module

Overview must aggregate but not merge.

Implement projections:

```ts
getOverviewMonth()

getGlobalActivity()

getPersonExposure()

getSplitSummary()

getLendSummary()

getTrackSummary()
```

No Overview tables.

---

# 43. Person exposure projection

Return something like:

```ts
interface PersonExposure {
  personId: string
  personName: string

  contexts: Array<{
    module:
      | "split"
      | "lend"

    contextId: string
    contextName: string

    balanceMinor: number
    currency: string
  }>

  informationalNetMinor?: number
}
```

Only calculate informational net when all contexts use the same currency.

Never combine INR and USD.

---

# 44. Overview Rahul example

```text
Rahul

LEND

Personal lending
Rahul owes you        ₹5,000

SPLIT

Goa Trip
Rahul owes you        ₹1,200

Delhi Trip
You owe Rahul           ₹600

────────────────────

Net exposure
+₹5,600
```

Label the result:

```text
Net exposure
```

not:

```text
Rahul owes you ₹5,600
```

---

# 45. Main Overview screen

```text
OVERVIEW

August

Track
Spent ₹18,450

────────────────

Split

You're owed ₹4,200
You owe ₹1,100

────────────────

Lend

You're owed ₹8,000
You owe ₹2,000

────────────────

Recent activity

Dinner            Track
₹450

Hotel             Goa Trip
₹6,000

Lent Rahul        Lend
₹5,000
```

---

# 46. Global activity

Create a derived UI model:

```ts
interface ActivityItem {
  id: string

  module:
    | "track"
    | "split"
    | "lend"

  sourceEntityId: string

  title: string

  date: string

  amountMinor: number
  currency: string

  context?: string
}
```

Adapters:

```ts
trackToActivity()
splitToActivity()
lendToActivity()
```

Never persist ActivityItem.

---

# 47. Main navigation

Mobile bottom navigation:

```text
Overview
Track
Split
Lend
Settings
```

Use icons plus labels.

Desktop/tablet may convert this into sidebar navigation.

Mobile remains primary.

---

# 48. Quick Add

Each module gets a contextual FAB.

Track:

```text
Expense
Income
```

Split:

```text
Expense
Settlement
Member
```

Lend:

```text
Lent money
Borrowed money
Repayment
```

Overview may have a universal Add menu:

```text
Personal expense
Split expense
Lent money
Borrowed money
Income
```

Universal Add only routes into the correct module's form.

---

# 49. UI principles

Build this like a utility.

Prioritize:

```text
speed
clarity
large touch targets
few required inputs
good empty states
fast repeated entry
```

Avoid:

```text
heavy dashboards
decorative charts everywhere
complex financial terminology
nested menus
```

---

# 50. Reusable form controls

Create:

```text
MoneyInput
DateInput
PersonPicker
CategoryPicker
PaymentMethodPicker
NotesInput
CurrencyPicker
```

Split-specific:

```text
MemberSelector
PayerSelector
SplitMethodSelector
SplitAllocationEditor
```

Use TanStack Form for form state/validation; its current React tooling is designed for strongly typed form values and nested field structures. ([TanStack][4])

---

# 51. PWA configuration

Use `vite-plugin-pwa`.

Configure:

```text
manifest
icons
theme/background colors
standalone display
service worker
offline application-shell caching
update handling
```

`vite-plugin-pwa` uses Workbox-backed service-worker support and is designed to add offline behavior to Vite applications. ([Vite PWA][5])

Financial records must **not** be stored in service-worker caches.

Use:

```text
Cache Storage
→ application assets

IndexedDB
→ user financial data
```

---

# 52. Offline acceptance requirements

The following must work with airplane mode enabled:

```text
launch app
reload app

view Track history
add expense
edit expense
delete/undo expense

create Split group
add Split expense
settle Split balance

add Lend entry
record repayment

view Overview

export JSON
export CSV
```

---

# 53. Persistent browser storage

On onboarding/settings, request persistent storage where supported using:

```ts
navigator.storage.persist()
```

Show status:

```text
Persistent storage
Enabled / Not guaranteed
```

Browser storage is normally best-effort and the Storage API allows a site to request persistence, although the browser decides whether to grant it. ([MDN Web Docs][6])

Do not tell users persistence is guaranteed merely because IndexedDB exists.

---

# 54. Local JSON backup

Implement before Google sync.

JSON is the exact restore format.

Example:

```json
{
  "format": "finance-utility-backup",
  "schemaVersion": 1,
  "exportedAt": "...",
  "shared": {
    "people": []
  },
  "track": {
    "transactions": [],
    "categories": [],
    "budgets": [],
    "recurringRules": []
  },
  "split": {
    "groups": [],
    "members": [],
    "expenses": [],
    "payers": [],
    "shares": [],
    "settlements": []
  },
  "lend": {
    "ledgers": [],
    "entries": []
  }
}
```

Implement:

```text
Export JSON backup
Validate JSON backup
Preview restore
Restore JSON backup
```

Restore should run inside an atomic DB operation where possible.

---

# 55. CSV export

Provide:

```text
Export current Track month
Export current Split group
Export full data package
```

Full export produces:

```text
finance-export-YYYY-MM-DD.zip
```

---

# 56. Full ZIP structure

```text
README.txt
manifest.json

shared/
    people.csv

track/
    transactions.csv
    categories.csv
    budgets.csv
    recurring.csv

split/
    groups.csv
    members.csv
    expenses.csv
    payers.csv
    shares.csv
    settlements.csv

lend/
    ledgers.csv
    entries.csv

overview/
    people-summary.csv
    monthly-summary.csv
```

---

# 57. Human-readable CSV rule

CSV must contain both machine identifiers and meaningful names when relevant.

Example:

```csv
expense_id,date,group_id,group_name,title,amount,currency
exp_123,2026-08-13,grp_1,Goa Trip,Hotel,6000.00,INR
```

Not:

```csv
exp_123,grp_1,600000
```

The export should be understandable outside the app.

---

# 58. CSV money representation

Internal:

```text
600000
```

Export:

```text
6000.00
```

Include currency separately.

Optionally include:

```text
amount_minor
```

after the human-readable amount, but don't require users to interpret it.

---

# 59. CSV dates

Use ISO-friendly data:

```text
2026-08-13
```

and timestamps:

```text
2026-08-13T03:41:10.000Z
```

Do not export locale-specific ambiguous dates such as:

```text
08/09/26
```

---

# 60. Export README

Include explanations of every file.

Explicitly state:

```text
Track, Split, and Lend are independent financial modules.

Overview files contain derived summaries.

Overview rows must not be imported as financial transactions.
```

---

# 61. Export manifest

```json
{
  "schemaVersion": 1,
  "exportedAt": "...",
  "appVersion": "...",
  "counts": {
    "trackTransactions": 0,
    "splitGroups": 0,
    "splitExpenses": 0,
    "lendEntries": 0,
    "people": 0
  }
}
```

---

# 62. Google integration objective

Google Drive/Sheets is an **optional cloud backup/replica**.

The app must work completely without connecting Google.

Flow:

```text
Dexie
 ↓
serialization
 ↓
Google Sheets
```

Use the same logical field names as CSV where practical.

---

# 63. Google authorization

Use current **Google Identity Services** browser authorization.

Google's browser token model allows a client-side app to obtain access tokens directly without storing refresh tokens on its own backend, but access tokens are short-lived and renewal may require a user-driven authorization request. ([Google for Developers][7])

Therefore:

### Do

```text
Connect Google Drive
Sync now
sync while app is open and authorized
restore from Google
```

### Do not promise

```text
24/7 invisible background sync
```

with the app closed.

---

# 64. Google permission scope

Prefer the narrowest Drive access compatible with managing app-created files, especially:

```text
drive.file
```

rather than broad access to every file in the user's Drive. Google documents `drive.file` as the narrower per-file access model for files the application uses/manages. ([Google for Developers][8])

---

# 65. Google Drive structure

Create:

```text
Finance Utility/
│
├── Finance Data
│   └── Google Spreadsheet
│
└── Backups/
```

Do not scatter many spreadsheets throughout Drive.

One workbook.

---

# 66. Google workbook tabs

Create:

```text
README
Overview

Track Transactions
Track Categories
Track Budgets
Track Recurring

Split Groups
Split Members
Split Expenses
Split Payers
Split Shares
Split Settlements

Lend Ledgers
Lend Entries

People

Metadata
```

---

# 67. Google README tab

Include:

```text
Finance Utility Data

Last synced
<timestamp>

Schema version
1

This spreadsheet is generated by the app.

Track, Split and Lend balances are independent.

Overview values are derived summaries.

Manual spreadsheet editing is not automatically interpreted
as financial actions inside the application.
```

---

# 68. Google Overview tab

Keep this human friendly.

Example:

```text
Track

This month spent
₹18,450

Split

You're owed
₹4,200

You owe
₹1,100

Lend

You're owed
₹8,000

You owe
₹2,000
```

This is derived.

---

# 69. Cloud direction for V1

Support:

```text
App → Google Sheet
```

and:

```text
Google Sheet → explicit Restore
```

Do **not** implement arbitrary manual Sheet edit synchronization.

If the user changes row 12 manually, the app should not attempt to infer a financial event from that.

---

# 70. Google restore

Implement:

```text
Restore from Google
```

Flow:

```text
authorize
 ↓
locate app workbook
 ↓
validate Metadata/schemaVersion
 ↓
read canonical tabs
 ↓
validate rows
 ↓
show restore summary
 ↓
create safety JSON backup
 ↓
restore into Dexie
 ↓
recalculate projections
```

Do not restore Overview data.

---

# 71. Google synchronization strategy

Initially, use **full logical sheet synchronization**, not a distributed-database protocol.

For realistic data sizes in a personal utility:

```text
collect current canonical rows
 ↓
batch update relevant ranges
 ↓
update Metadata.lastSyncedAt
```

Use batched Sheets operations rather than one API call per record. Google Sheets supports batching multiple related requests, including atomic batch updates. ([Google for Developers][9])

---

# 72. Local sync state

Maintain:

```ts
interface SyncMetadata {
  id: "google"

  dirty: boolean

  lastLocalChangeAt?: string
  lastSuccessfulSyncAt?: string

  lastError?: string
}
```

V1 does not require a complex per-record distributed event log.

Any domain mutation:

```text
save local record
 ↓
set syncMetadata.dirty = true
```

---

# 73. Cloud sync triggers

Attempt sync when appropriate:

```text
user taps Sync now

after Google connect

when app is active and authorized

after several local changes with debounce

when coming back online
```

Never block local UI waiting for sync.

---

# 74. Sync status UI

Use statuses:

```text
Saved on device

Offline

Cloud backup pending

Syncing

Synced

Google authorization required

Sync failed
```

Never say:

```text
Data lost
```

merely because Google sync failed.

Dexie is primary.

---

# 75. Settings → Data & Backup

Build:

```text
DATA & BACKUP

On-device data
✓ Available

Persistent storage
✓ Enabled

────────────────

GOOGLE DRIVE

Connected as
example@gmail.com

Last sync
Today, 03:42

Cloud status
Synced

[ Sync now ]

[ Disconnect ]

────────────────

EXPORT

[ Export CSV package ]

[ Export JSON backup ]

[ Restore JSON backup ]

[ Restore from Google ]
```

---

# 76. Privacy mode

Add a global setting:

```text
Hide amounts
```

When active:

```text
₹18,450
```

becomes:

```text
••••••
```

Apply consistently across:

```text
Overview
Track
Split
Lend
```

---

# 77. Search

Implement global search after the modules work.

Search across:

```text
Track transaction titles
Split groups
Split expenses
People
Lend notes
Lend people
```

Results should preserve module context.

Example:

```text
Search: Rahul

PERSON
Rahul

LEND
Rahul owes you ₹5,000

SPLIT
Goa Trip · Rahul owes you ₹1,200

ACTIVITY
Rahul repayment · ₹500
```

---

# 78. Empty states

Design every empty state.

Track:

```text
No expenses yet

Add your first expense to start tracking this month.

[ Add expense ]
```

Split:

```text
No groups yet

Create a trip or group to split shared expenses.

[ Create group ]
```

Lend:

```text
No lending activity

Record money you've lent or borrowed.

[ Add entry ]
```

Overview:

```text
Your overview will appear as you use Track, Split and Lend.
```

---

# 79. Undo

Implement Undo for at least:

```text
Track delete
Split expense delete
Lend entry delete
```

Prefer toast/snackbar:

```text
Expense deleted            Undo
```

---

# 80. Form validation

Use Zod/domain validation.

Reject:

```text
zero amount
negative user-entered amount
blank required title
missing payer
empty participant list
split shares not equaling expense amount
percentage total != 100%
payer totals != expense total
settlement <= 0
```

Domain rules must also run outside the UI.

Do not depend solely on HTML form validation.

---

# 81. Accessibility

Support:

```text
keyboard navigation
visible focus
semantic buttons/forms
screen-reader labels
44px-ish mobile targets
sufficient contrast
```

Do not make color the only indication of debt/credit.

Use text:

```text
Owes you
You owe
```

---

# 82. Responsive behavior

Primary:

```text
mobile portrait
```

Then:

```text
tablet
desktop
```

Mobile:

```text
bottom nav
FAB
single-column forms
```

Desktop:

```text
sidebar optional
wider content
two-column summary where appropriate
```

---

# 83. Domain unit tests

Create comprehensive Vitest tests for:

```text
money formatting
minor-unit conversion

equal allocation
remainder allocation
percentage allocation
share allocation

Lend balance

Split payer totals
Split participant shares
Split group balances
Split settlements
debt simplification

Track monthly totals
Track category totals
budgets

Overview aggregation
```

---

# 84. Critical Lend tests

Example:

```text
lend ₹5,000
repayment ₹2,000
lend ₹1,000

result
they owe ₹4,000
```

And:

```text
borrow ₹5,000
repay ₹2,000

result
I owe ₹3,000
```

---

# 85. Critical isolation test

Seed:

```text
Rahul Lend
+₹5,000

Rahul Goa
+₹1,200

Rahul Delhi
-₹600
```

Verify:

```text
Lend remains +₹5,000

Goa remains +₹1,200

Delhi remains -₹600
```

Overview may show:

```text
+₹5,600
```

Then perform a Goa settlement.

Assert that Lend remains:

```text
+₹5,000
```

This should be a permanent regression test.

---

# 86. Critical Split tests

Test:

```text
₹100 / 3
```

exactly totals ₹100.

Test:

```text
payer is not participant
multiple participants
single participant
partial settlement
full settlement
multiple payers
historic inactive member
deleted expense
```

---

# 87. Database tests

Test:

```text
create
edit
soft delete
undo

atomic split expense creation

migration v1 → future schemas

backup restore
```

---

# 88. PWA end-to-end tests

With Playwright:

```text
open app online

seed data

reload

go offline

reload offline

add Track expense

create Split expense

record Lend repayment

reload again while offline

verify everything remains
```

This is a release blocker.

---

# 89. Backup E2E test

```text
create sample data
 ↓
export JSON
 ↓
wipe DB
 ↓
restore JSON
 ↓
verify exact records
 ↓
verify calculated balances
```

---

# 90. CSV export test

Seed special characters:

```text
Dinner, drinks
Rahul's "birthday"
line breaks
₹
unicode names
```

Ensure generated CSV remains valid.

---

# 91. Google failure cases

Handle:

```text
popup blocked

user denies authorization

token expires

network drops

spreadsheet deleted

Drive folder deleted

sheet renamed

worksheet missing

API rate/error response

invalid remote schemaVersion
```

Local app must continue functioning.

---

# 92. Seed/demo data

During development only, provide a fixture generator.

Example:

```text
People
Me
Rahul
Aman
Priya

Track
Coffee
Uber
Groceries

Split
Goa Trip

Lend
Rahul owes ₹5,000
```

Do not include demo data in new production profiles.

---

# 93. Onboarding

Keep onboarding short.

Screen 1:

```text
Track expenses.
Split trips.
Remember lending.

Works offline.
```

Screen 2:

```text
Default currency
INR
```

Screen 3:

```text
Your name
Sid
```

Screen 4:

```text
Keep data safer on this device

[ Enable persistent storage ]
```

Optional later:

```text
Connect Google Drive
```

Do not force Google connection.

---

# 94. First-launch initialization

On first launch:

```text
create settings

create self Person

create default Track categories

request persistent storage only
through an explicit onboarding action

mark onboarding complete
```

---

# 95. Performance

Target normal personal datasets comfortably.

Rough expected scale:

```text
thousands of Track transactions
hundreds of Split expenses
dozens/hundreds of people
hundreds of Lend entries
```

Do not prematurely optimize for millions of records.

Index Dexie fields used frequently:

```text
date
categoryId
personId
groupId
ledgerId
expenseId
deletedAt where useful
```

---

# 96. Do not add these features during this goal

Explicit non-goals:

```text
SQLite

bank connections
bank balances
bank reconciliation

OCR
receipt scanning

AI categorization

investment tracking

net worth

crypto

tax reporting

interest calculations

EMIs

automatic cross-mode settlement

automatic Sheet edit → app sync

realtime multi-user collaboration

shared authenticated trips

push notification server

traditional backend

Postgres
Supabase
Firebase

Redux
```

If implementation encounters a design question, prefer the simpler local-first solution.

---

# 97. Build order

The agent should implement in this order and keep the application working after each stage.

## Phase 1 — Foundation

```text
Vite
React
TypeScript
TanStack Router
Tailwind
PWA shell
Dexie
BaseEntity
money utilities
date utilities
```

Exit criteria:

```text
installable PWA
opens offline
Dexie persists test data
```

---

## Phase 2 — Shared People/settings

```text
People CRUD
self Person
settings
default currency
privacy mode
```

Exit criteria:

```text
People persist offline
```

---

## Phase 3 — Track

```text
categories
expense/income transactions
monthly dashboard
budget
filters
payment-method labels
recurring reminders
undo
```

Exit criteria:

```text
usable standalone expense tracker
```

---

## Phase 4 — Lend

```text
ledgers
entries
lent
borrowed
repayments
balance engine
person screens
due date
notes
```

Exit criteria:

```text
usable standalone lending ledger
```

---

## Phase 5 — Split

```text
groups
members
expenses
payers
shares
equal split
exact split
percentage split
shares split
balances
settlements
debt simplification
```

Exit criteria:

```text
usable standalone trip expense splitter
```

---

## Phase 6 — Overview

```text
module summaries
recent activity
person exposure
net exposure
```

Exit criteria:

```text
all modules visible together
without modifying each other
```

---

## Phase 7 — Search and polish

```text
global search
empty states
undo
responsive layout
privacy
accessibility
```

---

## Phase 8 — Portable exports

```text
CSV serializers
ZIP exporter
README
manifest
JSON backup
JSON restore
```

Exit criteria:

```text
entire database can be backed up and restored
CSV package is human understandable
```

---

## Phase 9 — Google Drive/Sheets

```text
Google Identity Services

Connect Google

create Drive structure

create workbook

create tabs

full sync

restore from Google

sync status

error handling
```

Exit criteria:

```text
local app remains usable without Google

connected user can push a cloud copy

fresh install can explicitly restore from cloud
```

---

## Phase 10 — Hardening

```text
unit tests
database tests
offline E2E
migration tests
backup tests
Google failure tests
responsive QA
accessibility QA
```

---

# 98. Definition of Done

The `/goal` is complete only when all of the following are true:

* [ ] Application can be installed as a PWA.
* [ ] Application launches and reloads without network.
* [ ] No SQLite dependency exists.
* [ ] Dexie/IndexedDB is the canonical operational datastore.
* [ ] Track works independently.
* [ ] Split works independently.
* [ ] Lend works independently.
* [ ] Shared People work across Split and Lend.
* [ ] Person records contain no global financial balance.
* [ ] Split balances never alter Lend.
* [ ] Lend balances never alter Split.
* [ ] Neither Split nor Lend automatically alters Track.
* [ ] Overview aggregates without mutating source modules.
* [ ] Money calculations use integer minor units.
* [ ] Split rounding always balances exactly.
* [ ] Undo works for financial deletions.
* [ ] Monthly Track budget works.
* [ ] Equal and exact splits work.
* [ ] Percentage and share splitting work.
* [ ] Split settlements work.
* [ ] Lend partial repayments work.
* [ ] CSV full export works offline.
* [ ] Export ZIP has understandable folder/file names.
* [ ] CSV includes human-readable names where IDs are present.
* [ ] JSON backup works offline.
* [ ] JSON restore reconstructs the local database.
* [ ] Google connection is optional.
* [ ] Google workbook mirrors the modular structure.
* [ ] Google failure never prevents local usage.
* [ ] Explicit Restore from Google works.
* [ ] Manual Google Sheet edits are not silently interpreted as app actions.
* [ ] Offline Playwright tests pass.
* [ ] Cross-module isolation regression tests pass.
* [ ] Strict TypeScript build passes.
* [ ] Production build completes without warnings/errors that indicate broken functionality.

---

# 99. Code-level architecture comment

Add this near the domain root:

```ts
/**
 * FINANCIAL MODULE ISOLATION
 *
 * Track, Split, and Lend are independent financial ledgers.
 *
 * Shared Person records represent identity only and never contain
 * global financial balances.
 *
 * A balance belonging to one Split group must not alter another
 * Split group, a Lend ledger, or Track.
 *
 * Lend transactions must never implicitly alter Split or Track.
 *
 * Track transactions must never implicitly alter Split or Lend.
 *
 * The Overview layer may aggregate and calculate informational
 * projections across modules, but must remain read-only.
 *
 * Cross-module reconciliation may only be introduced as an
 * explicit user-confirmed feature.
 */
```

---

# 100. Final product shape

The completed application should feel roughly like:

```text
                 FINANCE UTILITY

┌─────────────────────────────────────┐
│                                     │
│              OVERVIEW               │
│                                     │
│ Track                               │
│ ₹18,450 spent this month            │
│                                     │
│ Split                               │
│ You're owed ₹4,200                  │
│ You owe ₹1,100                      │
│                                     │
│ Lend                                │
│ You're owed ₹8,000                  │
│ You owe ₹2,000                      │
│                                     │
│ Recent activity                     │
│ ...                                 │
│                                     │
├─────────────────────────────────────┤
│ Overview  Track  Split  Lend   ⚙   │
└─────────────────────────────────────┘
```

The guiding product principle should be:

> **Track my spending, split shared expenses, remember personal lending, and let me understand everything together without silently mixing unrelated money.**

That is the spec I would use as the canonical `/goal`. It is broad enough for an agent to implement the app end-to-end, but the module boundaries and non-goals are tight enough to stop it from drifting into a full banking/accounting system.

[1]: https://tanstack.com/router/latest/docs/overview?utm_source=chatgpt.com "Overview | TanStack Router Docs"
[2]: https://dexie.org/docs/dexie-react-hooks/useLiveQuery%28%29?utm_source=chatgpt.com "useLiveQuery() | Dexie.js Documentation"
[3]: https://tanstack.com/router/latest?utm_source=chatgpt.com "TanStack Router"
[4]: https://tanstack.com/form/latest?utm_source=chatgpt.com "TanStack Form"
[5]: https://vite-pwa-org.netlify.app/guide/?utm_source=chatgpt.com "Getting Started | Guide - Vite PWA - Netlify"
[6]: https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist?utm_source=chatgpt.com "StorageManager: persist() method - Web APIs | MDN"
[7]: https://developers.google.com/identity/oauth2/web/guides/use-token-model?utm_source=chatgpt.com "Use the token model | Web guides"
[8]: https://developers.google.com/identity/oauth2/web/guides/choose-authorization-model?utm_source=chatgpt.com "Choose a user authorization model | Web guides"
[9]: https://developers.google.com/workspace/sheets/api/guides/batch?utm_source=chatgpt.com "Batch requests | Google Sheets"

