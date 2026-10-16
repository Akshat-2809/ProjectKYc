import Link from "next/link";
import { BUSINESS_NAME } from "@/lib/brand";

export function TopBar({
  link,
  showHome = true,
}: {
  link?: { href: string; label: string };
  /** Outlined "Home" button back to the Agent / Admin chooser */
  showHome?: boolean;
}) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link href="/" className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-name">{BUSINESS_NAME}</span>
        </Link>
        {(link || showHome) && (
          <nav className="topnav">
            {link && (
              <Link href={link.href} className="toplink">
                {link.label}
              </Link>
            )}
            {showHome && (
              <Link href="/" className="btn btn-ghost btn-sm">
                Home
              </Link>
            )}
          </nav>
        )}
      </div>
    </header>
  );
}
