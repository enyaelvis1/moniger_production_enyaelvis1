# Customer and vendor spreadsheet format

Spreadsheet tools are available only to active Growth and Business workspaces. Files use CSV format so they can be opened in Excel or Google Sheets.

## Customers

Required column:

- `name`

Optional columns:

- `email`
- `phone` — use exactly 11 Nigerian local digits such as `0801 234 5678`, or the equivalent `+234 801 234 5678` format.
- `business_name`
- `street_address`
- `city_state`
- `notes`

## Vendors

Required column:

- `business_name`

Optional columns:

- `contact_name`
- `email`
- `phone` — exactly 11 Nigerian local digits, or the equivalent `+234` international format.
- `bank_name`
- `account_name`
- `account_number` — 10–12 digits when provided.

The **Download template** action provides one example row with the exact headers. The **Download records** action exports the current directory. Uploads show a preview and validation errors before any records are inserted.
