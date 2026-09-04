import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router";

const DOCS: Record<
  string,
  { title: string; updated: string; sections: { h: string; p: string[] }[] }
> = {
  agreement: {
    title: "User Agreement",
    updated: "September 2026",
    sections: [
      {
        h: "1. Acceptance",
        p: [
          "By creating an EchoLine account you agree to this User Agreement, our Privacy Policy, and the Community Guidelines. If you use EchoLine on behalf of an organization, you represent that you have authority to bind it.",
        ],
      },
      {
        h: "2. Your account",
        p: [
          "You must provide accurate information and keep your credentials safe. You are responsible for activity on your account across all devices. You must be at least 13 years old (or older where required by local law).",
        ],
      },
      {
        h: "3. Acceptable use",
        p: [
          "You may not use EchoLine to harass, threaten, defraud, or spam others; to share illegal content; to infringe intellectual property; or to attempt to disrupt or reverse engineer the service.",
          "We may remove content, limit features, or suspend accounts that violate these rules or the law.",
        ],
      },
      {
        h: "4. Your content",
        p: [
          "You keep ownership of what you share. To operate the service you grant us a limited, worldwide, royalty-free license to host, store, reproduce, and display your content solely to deliver EchoLine features (for example, delivering a message to its recipients or showing your story for 24 hours).",
          "Disappearing messages and 24-hour stories are deleted from active storage after expiry, though copies may persist briefly in encrypted backups.",
        ],
      },
      {
        h: "5. Availability & changes",
        p: [
          "We aim for a reliable service but provide EchoLine “as is” without warranties. Features may change, and we may discontinue the service with reasonable notice. To the extent permitted by law, our liability is limited to the amount you paid us in the previous 12 months (typically zero, since EchoLine is free).",
        ],
      },
      {
        h: "6. Termination",
        p: [
          "You can stop using EchoLine at any time. We may suspend or terminate accounts for serious or repeated violations. On request we can remove your profile and personal data subject to legal retention duties.",
        ],
      },
      {
        h: "7. Disputes",
        p: [
          "This agreement is governed by the laws applicable at our principal place of business. Where local consumer law grants you stronger rights, those rights prevail. Contact us first — most issues can be resolved informally.",
        ],
      },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    updated: "September 2026",
    sections: [
      {
        h: "1. What we collect",
        p: [
          "Account data: email (for sign-in), chosen display name, username, bio, and profile photo.",
          "Content you create: messages (text, images, files, voice notes), stories, reactions, and drafts synced from your devices.",
          "Technical data: device identifiers, platform, last-seen timestamps, and sync state needed for multi-device support.",
        ],
      },
      {
        h: "2. How we use it",
        p: [
          "To deliver the service: routing messages, rendering stories, syncing history to your devices, and showing presence.",
          "To keep EchoLine safe: abuse reports, blocking, and enforcement of the Community Guidelines.",
          "We do not sell personal data, and we do not run third-party advertising trackers in your chats.",
        ],
      },
      {
        h: "3. Who can see what",
        p: [
          "Your messages are visible to members of the conversation they belong to. Stories are visible per your story-visibility setting. Last seen, profile photo, read receipts, and typing indicators follow your Privacy settings.",
          "Blocking someone prevents them from messaging you or adding you; existing conversations stop accepting new messages.",
        ],
      },
      {
        h: "4. Retention",
        p: [
          "Messages are kept until deleted (by you or automatically for disappearing messages). Stories and their view receipts are purged 24 hours after posting. Media retention follows your storage setting (7–365 days). Reports are retained for safety review.",
        ],
      },
      {
        h: "5. Your choices",
        p: [
          "Edit or remove your profile information in Settings. Delete any message or story you authored. Unfriend or block anyone. Contact us to export or erase your account data; we respond within statutory timeframes.",
        ],
      },
      {
        h: "6. Security",
        p: [
          "Traffic is encrypted in transit. Access to production data is restricted and audited. No system is perfect — if you find a vulnerability, please report it responsibly.",
        ],
      },
    ],
  },
  storage: {
    title: "Device Storage & Permissions",
    updated: "September 2026",
    sections: [
      {
        h: "1. What EchoLine stores on your device",
        p: [
          "Local-first data: your composer drafts, the current conversation selection, theme preference, and a random device ID used for multi-device sync. This lives in your browser's local storage and never leaves your device except as part of sync.",
          "Offline behavior: if you lose connectivity, you can keep reading loaded chats and drafting; sending resumes automatically when you're back online.",
        ],
      },
      {
        h: "2. Permissions we may request",
        p: [
          "Camera/photos: to attach images to messages or stories. Only used when you tap attach.",
          "Microphone: to record voice messages. Recording starts only when you press the mic button and stops when you send or discard.",
          "Notifications: to alert you about new messages and friend requests (in-app today; system notifications where supported).",
          "You can revoke any permission at any time in your browser or OS settings — EchoLine keeps working with reduced features.",
        ],
      },
      {
        h: "3. Storage settings",
        p: [
          "Choose whether media auto-downloads on any network, Wi-Fi only, or never. Choose how long shared media is kept (7–365 days). Disappearing messages and stories are always purged from servers after expiry regardless of these settings.",
        ],
      },
      {
        h: "4. Clearing local data",
        p: [
          "Clearing your browser's site data removes drafts, theme, and the device ID from that device. Your messages and media remain safely in your account and re-sync on next sign-in.",
        ],
      },
    ],
  },
  guidelines: {
    title: "Community Guidelines",
    updated: "September 2026",
    sections: [
      {
        h: "1. Be respectful",
        p: [
          "Treat people the way they'd want to be treated. No harassment, hate speech, threats, or targeted abuse. If someone asks you to stop a conversation, respect that.",
        ],
      },
      {
        h: "2. Keep it honest & safe",
        p: [
          "No impersonation, scams, phishing, or misinformation designed to cause harm. Don't share sexual content involving minors, non-consensual imagery, or content that incites violence — this gets the fastest and strongest enforcement.",
        ],
      },
      {
        h: "3. No spam",
        p: [
          "Don't send bulk unsolicited messages, repetitive junk, or chain content. Don't use EchoLine to promote pyramid schemes or fake giveaways.",
        ],
      },
      {
        h: "4. Enforcement",
        p: [
          "Anyone can report a user, message, conversation, or story. Reports are reviewed by humans. Outcomes range from a warning to content removal to account suspension. We may contact you about your report; the reported person is never told who reported them.",
        ],
      },
      {
        h: "5. Appeals",
        p: [
          "If your content was removed or your account limited and you believe that was a mistake, contact support with the details. We review every appeal.",
        ],
      },
    ],
  },
};

export default function LegalPage() {
  const { doc } = useParams();
  const key = doc ?? "agreement";
  const content = DOCS[key];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-3 px-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/" aria-label="Back to home">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>
          <span className="text-base font-bold tracking-tight">EchoLine</span>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-8">
        <nav className="mb-8 flex flex-wrap gap-2" aria-label="Legal documents">
          {Object.entries(DOCS).map(([k, d]) => (
            <Link
              key={k}
              to={`/legal/${k}`}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted",
                k === key ? "border-brand bg-brand-soft text-brand-strong" : "text-muted-foreground",
              )}
            >
              {d.title}
            </Link>
          ))}
        </nav>

        {content ? (
          <article>
            <h1 className="text-2xl font-bold tracking-tight">{content.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">Last updated {content.updated}</p>
            <Separator className="my-6" />
            <div className="space-y-6">
              {content.sections.map((s) => (
                <section key={s.h}>
                  <h2 className="text-base font-semibold">{s.h}</h2>
                  {s.p.map((p, i) => (
                    <p key={i} className="mt-2 text-sm leading-relaxed text-muted-foreground">
                      {p}
                    </p>
                  ))}
                </section>
              ))}
            </div>
          </article>
        ) : (
          <div className="rounded-xl border border-dashed p-10 text-center">
            <p className="font-medium">Document not found</p>
            <p className="mt-1 text-sm text-muted-foreground">Pick one of the documents above.</p>
          </div>
        )}
      </div>
    </div>
  );
}
