import type { Metadata, Viewport } from "next";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-sans/700.css";
import "@fontsource/ibm-plex-mono/500.css";
import "./globals.css";
import { BUSINESS_NAME } from "@/lib/brand";

export const metadata: Metadata = {
  title: `KYC verification · ${BUSINESS_NAME}`,
  description: "Submit your details and Aadhaar card to complete KYC.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0d6b5e",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-IN" suppressHydrationWarning>
      <head>
        {/* Show the opening splash only once per browser session */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var k='kyc-splash';if(sessionStorage.getItem(k)){document.documentElement.classList.add('splash-seen')}else{sessionStorage.setItem(k,'1')}}catch(e){}",
          }}
        />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
