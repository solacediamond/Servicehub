/* ========================================
   SERVICEHUB BACKEND CONFIGURATION
======================================== */

/*
   Legacy Node.js backend (optional).
   Put your deployed Node.js backend base URL here if you still use
   the /backend folder in this project. Leave empty if you don't.

   Example:
   window.SERVICEHUB_BACKEND_URL = "https://your-backend.example.com";
*/
window.SERVICEHUB_BACKEND_URL = "";


/*
   Supabase project (used for listings, the Naira payment flow,
   and live "approved" cards on the Explore page).

   Find these in Supabase -> Project Settings -> API.
   The anon key is safe to expose in frontend code.

   Example:
   window.SERVICEHUB_SUPABASE_URL = "https://xxxxxxxx.supabase.co";
   window.SERVICEHUB_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";
*/
window.SERVICEHUB_SUPABASE_URL = "https://qqnvnceoipxyxkqsubsv.supabase.co";
window.SERVICEHUB_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxbnZuY2VvaXB4eXhrcXN1YnN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk1ODg2NzMsImV4cCI6MjEwNTE2NDY3M30.a_6wsmD3fH2Dv_-Wd47DMQlfeTBRsP7XoDAOdXthUns";


/*
   Bank account shown on the Naira payment page.
   Edit these once and every page picks them up automatically.
*/
window.SERVICEHUB_BANK_DETAILS = {
    bankName: "Moniepoint",
    accountNumber: "5302022430",
    accountName: "SOLACE OGHENEKPAROBOR UNUOVO"
};
