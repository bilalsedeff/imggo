import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-24">
      <main className="text-center">
        <h1 className="text-6xl font-bold mb-6">ImgGo</h1>
        <p className="text-xl text-muted-foreground mb-8 max-w-2xl">
          Turn images into strictly schema-conformant manifests.
          <br />
          JSON, YAML, XML, CSV, or plain text - always consistent.
        </p>

        <div className="flex gap-4 justify-center">
          <Link
            href="/dashboard"
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition"
          >
            Get Started
          </Link>
          <Link
            href="/docs"
            className="px-6 py-3 border border-border rounded-lg hover:bg-accent transition"
          >
            Documentation
          </Link>
        </div>

        <div className="mt-16 grid grid-cols-3 gap-8 max-w-4xl">
          <div className="p-6 border border-border rounded-lg">
            <h3 className="font-semibold mb-2">Predictable</h3>
            <p className="text-sm text-muted-foreground">
              Define your schema once, get consistent output every time
            </p>
          </div>
          <div className="p-6 border border-border rounded-lg">
            <h3 className="font-semibold mb-2">Scalable</h3>
            <p className="text-sm text-muted-foreground">
              Process thousands of images per minute with queue-based workers
            </p>
          </div>
          <div className="p-6 border border-border rounded-lg">
            <h3 className="font-semibold mb-2">Flexible</h3>
            <p className="text-sm text-muted-foreground">
              Output in JSON, YAML, XML, CSV, or plain text format
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
