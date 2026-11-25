// Public values: safe to ship in the app. Security comes from RLS in the database.
// NEVER put the service_role key here.
export const SUPABASE_URL = 'https://iubracicfdvdphvatbqg.supabase.co';
export const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml1YnJhY2ljZmR2ZHBodmF0YnFnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ3NzIwNzEsImV4cCI6MjExMDM0ODA3MX0.A2-UYJUK1UGksHnrxYmYHRxCRFwrQ-oYrkZ_CSDo1iA';
export const AUTH_STORAGE_KEY = 'sb-iubracicfdvdphvatbqg-auth-token';

// The ONLY account allowed to add / edit / delete stock and to approve issue requests.
// (Enforced in the database by is_stock_manager() in sql/step16.sql — this constant just hides the buttons.)
export const STOCK_MANAGER_EMAIL = 'andro@prosmart.app';

// Where the customer feedback page (opened from the QR code) is hosted. Inside the Android app the page origin is
// not public, so the web address is used there.
export const PUBLIC_APP_URL = 'https://dev-m-ibrahim.github.io/prosmart-field/';
