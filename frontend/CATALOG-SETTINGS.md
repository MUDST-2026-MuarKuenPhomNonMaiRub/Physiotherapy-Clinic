# Configurable master data and payment methods

## Usage

- Settings → Payment Methods → **เพิ่มช่องทางชำระเงิน**. Enter a name, choose an icon and enable the method. Enabled methods are immediately available in checkout in the same session and are loaded from the server in other sessions.
- Use the pencil to rename a method or change its icon. Use the switch to hide it temporarily, or the trash button and confirmation to remove it from future use.
- Deleting a payment method preserves its ID and name for historical transactions and receipts. Deleted methods cannot be re-enabled or used for new payments.
- The built-in `CASH` code retains cash/change handling even if renamed. New methods record payments without cash/change handling. Selecting a bank, wallet or QR icon does not connect a payment gateway or generate a transfer QR.
- Settings → Master Data → **เพิ่มหมวดหมู่** creates an empty category card. Use its plus button to add values, the pencil to rename it, or the trash button to remove it and its values.
- The three built-in categories are retained because patient forms use their stable codes. Their individual values can be edited, disabled or deleted.
- New custom categories organize values only; adding a category does not automatically add fields to patient or checkout forms.

## Persistence and deployment

This feature includes backend changes. Deploy backend and frontend together. Flyway migration `V31__configurable_master_data_categories.sql` creates the category registry and adds soft-delete timestamps to payment methods and master-data values. Existing values are retained.

All create, update and delete endpoints require `settings.manage`. Checkout continues to validate that the selected method is active. There is no change to prices, totals or commission rules.

For the local Docker deployment, build both services and then update only those services:

```powershell
docker compose build backend frontend
docker compose up -d --no-deps backend frontend
```

## Verification

Frontend: `npm run lint`, `npx tsc --noEmit`, production build.

Backend unit/security checks: `./mvnw test`.

Database integration checks use a disposable PostgreSQL instance, never the clinic database:

```bash
cd backend
bash run-commission-tests.sh com.physiocare.clinic.catalog.CatalogConfigurationIT
```

The integration test verifies actual checkout with a newly added payment method, preservation of transaction history after deletion, disabled/deleted method rejection, stable cash codes, category/value persistence and deletion, duplicate validation and write permissions.
