import Link from "next/link";
import Image from "next/image";

export default function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border bg-background">
        <div className="container flex h-16 items-center justify-between px-8">
          <Link href="/" className="flex items-center -ml-6">
            <Image 
              src="/logo.svg" 
              alt="ImgGo" 
              width={280} 
              height={140}
              className="h-16 w-auto"
            />
          </Link>
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground transition"
          >
            ← Back to home
          </Link>
        </div>
      </header>

      <main className="flex-1 container px-8 py-12 max-w-4xl">
        <h1 className="text-4xl font-bold mb-6">Terms of Service</h1>
        <p className="text-muted-foreground mb-8">Last updated: {new Date().toLocaleDateString()}</p>

        <div className="space-y-6 text-muted-foreground">
          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing and using ImgGo, you agree to be bound by these Terms of Service and all applicable laws and regulations.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">2. Use License</h2>
            <p>
              Permission is granted to use ImgGo for personal and commercial purposes, subject to the restrictions outlined in these terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">3. User Responsibilities</h2>
            <p>
              You are responsible for maintaining the confidentiality of your account and for all activities that occur under your account.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">4. Service Modifications</h2>
            <p>
              ImgGo reserves the right to modify or discontinue the service at any time without prior notice.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
