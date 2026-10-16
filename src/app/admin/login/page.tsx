import Link from "next/link";
import { login } from "@/app/admin/actions";
import { LoginForm } from "@/components/shared/LoginForm";
import { ArrowLeftIcon } from "@/components/Icons";
import { TopBar } from "@/components/TopBar";

export const metadata = { title: "Admin sign in" };

export default function LoginPage() {
  return (
    <>
      <TopBar link={{ href: "/", label: "Home" }} showHome={false} />
      <main className="login">
        <Link href="/" className="back back-link enter">
          <ArrowLeftIcon size={16} /> Back to homepage
        </Link>
        <div className="login-card enter">
          <h1>Admin sign in</h1>
          <p className="hint" style={{ marginBottom: "1.5rem" }}>
            For the account owner only.
          </p>
          <LoginForm login={login} to="/admin" sub="Opening your review desk" />
        </div>
      </main>
    </>
  );
}
