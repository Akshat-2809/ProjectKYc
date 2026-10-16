import Link from "next/link";
import { agentLogin } from "@/app/agent/actions";
import { ArrowLeftIcon } from "@/components/Icons";
import { LoginForm } from "@/components/shared/LoginForm";
import { TopBar } from "@/components/TopBar";

export const metadata = { title: "Agent sign in" };

export default function AgentLoginPage() {
  return (
    <>
      <TopBar link={{ href: "/", label: "Home" }} showHome={false} />
      <main className="login">
        <Link href="/" className="back back-link enter">
          <ArrowLeftIcon size={16} /> Back to homepage
        </Link>
        <div className="login-card enter">
          <h1>Agent sign in</h1>
          <p className="hint" style={{ marginBottom: "1.5rem" }}>
            Use the phone number and password the admin gave you.
          </p>
          <LoginForm login={agentLogin} to="/agent" sub="Opening your KYC desk" />
        </div>
      </main>
    </>
  );
}
