import "server-only";

/**
 * Reads a required environment variable and fails loudly if it's missing,
 * so a misconfigured deploy shows a clear error instead of odd behaviour.
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `Missing environment variable ${name}. Add it to .env.local (local) or Vercel → Settings → Environment Variables.`,
    );
  }
  return value.trim();
}

export const env = {
  get supabaseUrl() {
    return required("SUPABASE_URL");
  },
  get supabaseSecretKey() {
    return required("SUPABASE_SECRET_KEY");
  },
  get adminPhone() {
    return required("ADMIN_PHONE").replace(/\D/g, "").slice(-10);
  },
  get adminPasswordHash() {
    return required("ADMIN_PASSWORD_HASH");
  },
};

export const STORAGE_BUCKET = "kyc-documents";
export const MAX_PDF_BYTES = 4 * 1024 * 1024; // Vercel caps request bodies at 4.5 MB
