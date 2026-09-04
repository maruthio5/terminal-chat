import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import {
  Bell,
  Check,
  Clock,
  Eye,
  FileText,
  ImagePlus,
  Lock,
  MessageCircle,
  Mic,
  Moon,
  Radio,
  Reply,
  ShieldCheck,
  Smartphone,
  Smile,
  Users,
  Zap,
} from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router";

const FEATURES = [
  {
    icon: Zap,
    title: "Real-time everything",
    body: "Messages, typing dots, presence, and receipts stream in live — no refresh, ever.",
  },
  {
    icon: Clock,
    title: "Disappearing messages",
    body: "Set conversations to self-destruct after an hour, a day, or a week. Timers are enforced server-side.",
  },
  {
    icon: Eye,
    title: "24-hour stories",
    body: "Share moments with gradients or photos. See exactly who viewed and reply straight into DMs.",
  },
  {
    icon: Smile,
    title: "Reactions & replies",
    body: "React with emoji, quote any message, edit your typos, and clean up with delete-for-everyone.",
  },
  {
    icon: Mic,
    title: "Voice, images, files",
    body: "Hold the mic to record. Share photos and documents up to 10 MB with instant previews.",
  },
  {
    icon: ShieldCheck,
    title: "Privacy you control",
    body: "Last seen, read receipts, typing indicators, story audience, and friend-request rules — all yours.",
  },
  {
    icon: Smartphone,
    title: "Local-first sync",
    body: "Drafts and state live on your device too. EchoLine stays fast and resumes cleanly when you're offline.",
  },
  {
    icon: Moon,
    title: "Dark, light, accessible",
    body: "A theme for every hour, keyboard-friendly navigation, and contrast tuned for real-world screens.",
  },
];

const STEPS = [
  {
    icon: Users,
    title: "Find your people",
    body: "Search by name or username, send friend requests, and build your circle.",
  },
  {
    icon: MessageCircle,
    title: "Talk in 1:1 or groups",
    body: "Direct messages, group chats with roles, muting, and per-chat disappearing timers.",
  },
  {
    icon: Radio,
    title: "Share the moment",
    body: "Stories for the day-to-day, messages for the conversation. Everything syncs across devices.",
  },
];

export default function Landing() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      {/* nav */}
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-xl bg-brand text-base font-black text-brand-contrast shadow-sm">
              E
            </span>
            <span className="text-lg font-bold tracking-tight">EchoLine</span>
          </Link>
          <nav className="ml-6 hidden items-center gap-1 md:flex">
            <a href="#features" className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              Features
            </a>
            <a href="#how" className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              How it works
            </a>
            <Link to="/legal/privacy" className="rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
              Privacy
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            {!isLoading && isAuthenticated ? (
              <Button asChild>
                <Link to="/app">Open EchoLine</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" className="hidden sm:inline-flex">
                  <Link to="/auth">Sign in</Link>
                </Button>
                <Button asChild>
                  <Link to="/auth">Get started</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* hero */}
      <section className="relative overflow-hidden">
        <div className="hero-grid absolute inset-0" aria-hidden />
        <div
          className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[720px] -translate-x-1/2 rounded-full opacity-30 blur-3xl"
          style={{ background: "radial-gradient(closest-side, var(--brand), transparent)" }}
          aria-hidden
        />
        <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-16 sm:px-6 sm:pt-24">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="outline" className="mb-5 gap-1.5 rounded-full border-brand/40 bg-brand-soft/60 px-3 py-1 text-brand-strong">
              <Radio className="size-3" />
              Messaging that feels alive
            </Badge>
            <h1 className="text-balance text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-6xl">
              Say it once,{" "}
              <span className="brand-gradient-text">hear it echo</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
              EchoLine is a modern social messenger with real-time chats, stories,
              disappearing messages, and privacy settings that actually respect you.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="brand-glow h-12 px-7 text-base">
                <Link to="/auth">
                  Start chatting free
                  <MessageCircle className="ml-2 size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="h-12 px-7 text-base">
                <Link to="/legal/agreement">Read the docs</Link>
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Free · No ads in your chats · Your settings, your rules
            </p>
          </div>

          {/* hero mock */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.6, ease: "easeOut" }}
            className="mx-auto mt-14 max-w-2xl"
          >
            <div className="brand-glow overflow-hidden rounded-2xl border bg-card shadow-2xl">
              <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2.5">
                <span className="size-2.5 rounded-full bg-red-400/70" />
                <span className="size-2.5 rounded-full bg-yellow-400/70" />
                <span className="size-2.5 rounded-full bg-emerald-400/70" />
                <span className="ml-2 text-xs font-medium text-muted-foreground">
                  EchoLine — friends
                </span>
              </div>
              <div className="space-y-3 p-4 sm:p-6">
                <div className="flex items-center gap-2">
                  <span className="relative flex size-8 items-center justify-center rounded-full bg-brand-soft text-xs font-bold text-brand-strong">
                    MA
                    <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-emerald-500 ring-2 ring-card" />
                  </span>
                  <p className="text-xs text-muted-foreground">Maya · online</p>
                </div>
                <div className="max-w-[75%] rounded-2xl rounded-bl-md bg-muted px-3.5 py-2 text-sm">
                  the sunset from the ridge today 🌄
                </div>
                <div className="ml-auto max-w-[75%] rounded-2xl rounded-br-md bg-brand px-3.5 py-2 text-sm text-brand-contrast">
                  okay that's unreal. story it before it's gone
                </div>
                <div className="flex items-center gap-2 pl-1">
                  <Smile className="size-3.5 text-muted-foreground" />
                  <span className="rounded-full border bg-background px-1.5 py-0.5 text-xs shadow-sm">😍 2</span>
                  <span className="rounded-full border bg-background px-1.5 py-0.5 text-xs shadow-sm">🔥 1</span>
                  <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Check className="size-3 text-brand" /> Read
                  </span>
                </div>
                <div className="flex items-center gap-1.5 pt-1 text-xs text-muted-foreground">
                  <span className="typing-dot inline-block size-1.5 rounded-full bg-brand" />
                  <span className="typing-dot inline-block size-1.5 rounded-full bg-brand" />
                  <span className="typing-dot inline-block size-1.5 rounded-full bg-brand" />
                  Maya is typing…
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* stats strip */}
      <section className="border-y bg-muted/30">
        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-6 px-4 py-8 text-center sm:grid-cols-4 sm:px-6">
          {[
            ["<100ms", "message delivery"],
            ["24h", "story lifetime"],
            ["0", "ads in your chats"],
            ["∞", "group members*"],
          ].map(([big, small]) => (
            <div key={small}>
              <p className="text-2xl font-extrabold tracking-tight brand-gradient-text">{big}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{small}</p>
            </div>
          ))}
        </div>
      </section>

      {/* features */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Everything a modern chat needs
          </h2>
          <p className="mt-3 text-muted-foreground">
            Built for conversations that move fast — with the controls to keep them yours.
          </p>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, body }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ delay: (i % 4) * 0.06, duration: 0.45 }}
              className="group rounded-2xl border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-brand-soft text-brand-strong transition-colors group-hover:bg-brand group-hover:text-brand-contrast">
                <Icon className="size-5" />
              </span>
              <h3 className="mt-4 text-sm font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* how it works */}
      <section id="how" className="border-y bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Up and running in a minute</h2>
            <p className="mt-3 text-muted-foreground">Three steps between you and your circle.</p>
          </div>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {STEPS.map(({ icon: Icon, title, body }, i) => (
              <div key={title} className="relative">
                <div className="flex items-center gap-3">
                  <span className="flex size-11 items-center justify-center rounded-2xl bg-brand text-brand-contrast shadow-sm">
                    <Icon className="size-5" />
                  </span>
                  <span className="text-5xl font-black text-muted-foreground/15">{i + 1}</span>
                </div>
                <h3 className="mt-4 text-base font-semibold">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* privacy band */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl border bg-card p-8 sm:p-12">
          <div
            className="pointer-events-none absolute -right-24 -top-24 size-72 rounded-full opacity-25 blur-2xl"
            style={{ background: "radial-gradient(closest-side, var(--brand), transparent)" }}
            aria-hidden
          />
          <div className="relative grid items-center gap-8 md:grid-cols-2">
            <div>
              <Badge variant="outline" className="gap-1.5 rounded-full border-brand/40 bg-brand-soft/60 text-brand-strong">
                <Lock className="size-3" /> Privacy first
              </Badge>
              <h2 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
                Controls that mean it
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                Turn off read receipts. Hide your last seen. Limit who can add you or
                message you. Auto-delete media. Block and report in one tap. Everything
                is documented, in plain language.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {["Read receipts", "Last seen", "Typing", "Story audience", "Requests", "Auto-download"].map((t) => (
                  <span key={t} className="rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
                    {t}
                  </span>
                ))}
              </div>
              <Button asChild variant="outline" className="mt-6">
                <Link to="/legal/privacy">
                  <FileText className="mr-2 size-4" /> Privacy policy
                </Link>
              </Button>
            </div>
            <ul className="space-y-3">
              {([
                [
                  Bell,
                  "Disappearing timers enforced server-side — no screenshots of settings that don't work.",
                ],
                [ImagePlus, "Auto-download rules respect your data plan (always / Wi-Fi / never)."],
                [ShieldCheck, "Reports go to human review. Reporters stay anonymous."],
                [Reply, "Reply-to-story lands directly in your DMs with context attached."],
              ] as const).map(([Icon, text]) => (
                <li key={String(text)} className="flex items-start gap-3 rounded-xl border bg-background p-3.5">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand-strong">
                    <Icon className="size-4" />
                  </span>
                  <p className="text-sm text-muted-foreground">{text}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-brand px-6 py-14 text-center text-brand-contrast sm:px-12">
          <div className="hero-grid absolute inset-0 opacity-20 invert" aria-hidden />
          <div className="relative">
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              Your circle is waiting to hear from you
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-brand-contrast/80">
              Create a free account in seconds — email code or guest mode. No credit card, no noise.
            </p>
            <Button asChild size="lg" variant="secondary" className="mt-8 h-12 px-8 text-base">
              <Link to="/auth">Create your account</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* footer */}
      <footer className="border-t py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-4 sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-brand text-sm font-black text-brand-contrast">
              E
            </span>
            <span className="font-bold tracking-tight">EchoLine</span>
            <span className="ml-2 text-xs text-muted-foreground">*groups scale with your circle</span>
          </div>
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <Link to="/legal/agreement" className="hover:text-foreground">User Agreement</Link>
            <Link to="/legal/privacy" className="hover:text-foreground">Privacy Policy</Link>
            <Link to="/legal/storage" className="hover:text-foreground">Storage & Permissions</Link>
            <Link to="/legal/guidelines" className="hover:text-foreground">Community Guidelines</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
