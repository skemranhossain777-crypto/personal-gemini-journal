import React, { useState } from 'react';
import {
  ArrowLeft,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  HelpCircle,
  PenLine,
  Plus,
  Search,
  Sparkles,
  Star,
  User,
} from 'lucide-react';
import {
  Avatar,
  Badge,
  BottomNavigation,
  Button,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  Dialog,
  EmptyState,
  FullPageError,
  InlineError,
  Input,
  Kbd,
  LoadingState,
  NavItem,
  Select,
  Sheet,
  Skeleton,
  SkeletonCard,
  SkeletonText,
  Spinner,
  Stack,
  Switch,
  TabList,
  TabPanel,
  Tabs,
  TabTrigger,
  Text,
  Textarea,
  Tooltip,
} from '../components/ui';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { toast } from '../services/toast';

interface DesignSystemProps {
  onExit: () => void;
}

function Section({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={sectionId(title)} className="space-y-4">
      <div>
        <p className="text-eyebrow">{eyebrow}</p>
        <h2 id={sectionId(title)} className="text-display-sm">
          {title}
        </h2>
      </div>
      <Card variant="elevated">
        <CardBody>{children}</CardBody>
      </Card>
    </section>
  );
}

function sectionId(title: string): string {
  return `ds-${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
}

const SWATCHES: Array<{ token: string; value: string; className: string; text: string }> = [
  { token: 'page', value: '#070B16', className: 'bg-page', text: 'text-ink-faint' },
  { token: 'surface-1', value: '#0B1226', className: 'bg-surface-1', text: 'text-ink-faint' },
  { token: 'surface-2', value: '#0E1730', className: 'bg-surface-2', text: 'text-ink-faint' },
  { token: 'surface-4', value: '#17254F', className: 'bg-surface-4', text: 'text-ink-hi' },
  { token: 'line', value: '#223056', className: 'bg-line', text: 'text-ink-hi' },
  { token: 'ink-hi', value: '#EEF4FF', className: 'bg-ink-hi', text: 'text-page' },
  { token: 'ink-low', value: '#9FB0D4', className: 'bg-ink-low', text: 'text-page' },
  { token: 'accent', value: '#38BDF8', className: 'bg-accent', text: 'text-page' },
  { token: 'accent-deep', value: '#0284C7', className: 'bg-accent-deep', text: 'text-white' },
  { token: 'success', value: '#34D399', className: 'bg-success', text: 'text-page' },
  { token: 'danger', value: '#F87171', className: 'bg-danger', text: 'text-page' },
  { token: 'warning', value: '#FBBF24', className: 'bg-warning', text: 'text-page' },
];

export const DesignSystem: React.FC<DesignSystemProps> = ({ onExit }) => {
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');
  const [mood, setMood] = useState('appreciative');
  const [notify, setNotify] = useState(true);
  const [tab, setTab] = useState('write');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <div className="min-h-screen bg-page text-ink-mid">
      <header className="sticky top-0 z-40 border-b border-line bg-page/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" icon={<ArrowLeft className="h-4 w-4" />} onClick={onExit}>
              Back to app
            </Button>
            <span className="h-4 w-px bg-line" aria-hidden="true" />
            <div>
              <p className="text-eyebrow">JOURNAL∞ · Design System</p>
              <p className="hidden text-xs text-ink-low sm:block">
                Premium · calm · editorial · human · warm · spacious · modern
              </p>
            </div>
          </div>
          <Kbd>⌘K</Kbd>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-12 px-4 py-10 md:px-6">
        <Section eyebrow="01 · Tokens" title="Colour">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {SWATCHES.map((s) => (
              <div key={s.token} className={`rounded-xl border border-line p-2 ${s.className}`}>
                <div className={`h-14 rounded-lg ${s.text} flex items-end p-1.5 font-mono text-[10px]`}>
                  {s.value}
                </div>
                <p className="mt-2 font-mono text-[10px] text-ink-low">{s.token}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section eyebrow="02 · Type" title="Typography">
          <div className="space-y-6">
            <Text variant="eyebrow">Eyebrow — micro-label over a display</Text>
            <Text as="h1" variant="display">
              A calm place to write your life.
            </Text>
            <Text variant="displaySm">Morning, from a quiet train window.</Text>
            <Text variant="title">Today felt slower — in the good way.</Text>
            <Text variant="body">
              UI body: system sans throughout the interface, hushed and legible at 14px on deep
              navy.
            </Text>
            <Text variant="prose">
              Editorial prose: the journal voice. Relaxed leading, slightly muted ink, room to
              breathe between lines and thoughts.
            </Text>
            <Text variant="caption">12px caption — saved just now · 193 words</Text>
            <Text variant="monoLabel">gemini-3.7-flash · 1.2s · 412 tokens</Text>
          </div>
        </Section>

        <Section eyebrow="03 · Spacing" title="Rhythm">
          <div className="space-y-1.5">
            {([2, 4, 6, 8] as const).map((g) => (
              <Stack key={g} direction="row" gap={g} align="center">
                <span className="w-10 font-mono text-[10px] text-ink-faint">{g * 4}px</span>
                <span className="h-3 rounded-full bg-accent" style={{ width: g * 14 }} aria-hidden="true" />
                <Skeleton className="h-3 w-24" />
              </Stack>
            ))}
          </div>
        </Section>

        <Section eyebrow="04 · Actions" title="Buttons">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              {(['primary', 'secondary', 'subtle', 'outline', 'ghost', 'danger'] as const).map((v) => (
                <Button key={v} variant={v}>
                  {v}
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {(['sm', 'md', 'lg'] as const).map((s) => (
                <Button key={s} size={s} icon={<Plus className="h-4 w-4" />}>
                  New entry
                </Button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button loading>Working…</Button>
              <Button iconOnly icon={<Bell className="h-4 w-4" />} aria-label="Notifications" />
              <Button disabled>Disabled</Button>
              <Button fullWidth className="max-w-56">
                Full width
              </Button>
            </div>
          </div>
        </Section>

        <Section eyebrow="05 · Inputs" title="Fields, switches & selects">
          <div className="grid gap-6 md:grid-cols-2">
            <Stack gap={6}>
              <Input
                label="Title"
                placeholder="What's this entry about?"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Input
                label="Email"
                placeholder="you@example.com"
                labelRight={<span className="text-[10px] text-ink-faint">Google sign-in</span>}
              />
              <Input
                label="Tag"
                placeholder="Add a tag…"
                hint="Comma-separated; max 40 chars each."
                defaultValue=""
              />
              <Input
                label="Energy"
                placeholder="1 – 5"
                error="Energy must be a whole number between 1 and 5."
                defaultValue=""
              />
            </Stack>
            <Stack gap={6}>
              <Textarea
                label="Journal body"
                placeholder="Write freely. No form, no pressure…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={4}
              />
              <Select label="How are you feeling?" value={mood} onChange={(e) => setMood(e.target.value)}>
                <option value="calm">Calm</option>
                <option value="appreciative">Appreciative</option>
                <option value="curious">Curious</option>
                <option value="tired">Tired</option>
              </Select>
              <Switch checked={notify} onCheckedChange={setNotify} label="Save an AI summary with my entry" />
            </Stack>
          </div>
        </Section>

        <Section eyebrow="06 · Surfaces" title="Cards">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card variant="flat">
              <CardHeader>Flat</CardHeader>
              <CardBody>
                <Text variant="prose">Resting surface for lists and static content.</Text>
              </CardBody>
            </Card>
            <Card variant="elevated">
              <CardHeader>Elevated</CardHeader>
              <CardBody>
                <Text variant="prose">Hero panels and feature blocks float slightly above the page.</Text>
              </CardBody>
              <CardFooter>
                <Button size="sm" variant="secondary">
                  Read reflection
                </Button>
              </CardFooter>
            </Card>
            <Card variant="inset">
              <CardHeader>Inset</CardHeader>
              <CardBody>
                <Text variant="prose">Sunk-in surfaces for code, metadata, dense controls.</Text>
              </CardBody>
            </Card>
            <Card variant="flat" interactive>
              <CardBody>
                <div className="flex items-center justify-between">
                  <div>
                    <Text variant="title">Selectable card</Text>
                    <Text variant="caption">Whole card is a button — keyboard accessible.</Text>
                  </div>
                  <Star className="h-4 w-4 text-warning" aria-hidden="true" />
                </div>
              </CardBody>
            </Card>
          </div>
        </Section>

        <Section eyebrow="07 · Overlays" title="Dialog & Sheet">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => setDialogOpen(true)}>
              Open dialog
            </Button>
            <Button variant="secondary" onClick={() => setSheetOpen(true)}>
              Open sheet
            </Button>
            <Button variant="danger" onClick={() => setConfirmOpen(true)}>
              Delete confirmation
            </Button>
          </div>
          <Text variant="caption" className="mt-3">
            Dialog and sheet trap focus, close on Escape / backdrop, and restore focus on exit.
          </Text>
        </Section>

        <Section eyebrow="08 · Status" title="Badges & Avatars">
          <div className="flex flex-wrap items-center gap-2">
            {(['neutral', 'accent', 'success', 'warning', 'danger', 'ink'] as const).map((tone) => (
              <Badge key={tone} tone={tone}>
                {tone}
              </Badge>
            ))}
            <Badge tone="accent" dot>
              Live
            </Badge>
            <Badge tone="success" icon={<Check className="h-3 w-3" />}>
              Saved
            </Badge>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Avatar name="Maya Lindqvist" size="sm" />
            <Avatar name="Maya Lindqvist" size="md" online />
            <Avatar name="Maya Lindqvist" size="lg" ring />
            <Avatar name="Maya Lindqvist" size="xl" src={undefined} />
            <Avatar size="md" />
          </div>
        </Section>

        <Section eyebrow="09 · Hints" title="Tooltips">
          <div className="flex flex-wrap items-center gap-6">
            <Tooltip content="Save this entry" side="top">
              <Button variant="subtle" size="sm" icon={<Check className="h-3.5 w-3.5" />}>
                Save
              </Button>
            </Tooltip>
            <Tooltip content="Open command palette">
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                icon={<Search className="h-3.5 w-3.5" />}
                aria-label="Open command palette"
              />
            </Tooltip>
          </div>
        </Section>

        <Section eyebrow="10 · Loading" title="Spinners & Skeletons">
          <div className="flex flex-wrap items-center gap-4">
            <Spinner size="sm" />
            <Spinner size="md" />
            <Spinner size="lg" />
            <LoadingState inline label="Thinking with Gemini…" />
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <SkeletonCard />
            <div className="space-y-3 rounded-2xl border border-line bg-surface-1 p-5">
              <Skeleton className="h-3 w-1/4" />
              <SkeletonText lines={2} />
            </div>
          </div>
        </Section>

        <Section eyebrow="11 · Empty & error" title="Shared states">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <EmptyState
                compact
                icon={<PenLine className="h-6 w-6" />}
                title="Nothing written yet."
                description="The day starts with a single line. Journal when you're ready — it's yours."
                actions={
                  <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />}>
                    Write your first entry
                  </Button>
                }
              />
            </Card>
            <Stack gap={4}>
              <InlineError message="We couldn't reach Gemini. Your draft is still safe here — try again in a moment." onRetry={() => {}} />
              <Card>
                <FullPageError
                  title="This page ran into a snag"
                  message="Nothing is lost. Head back and we'll try again."
                  onRetry={() => {}}
                />
              </Card>
            </Stack>
          </div>
        </Section>

        <Section eyebrow="12 · Navigation" title="Navigation & tabs">
          <div className="grid gap-6 lg:grid-cols-2">
            <Stack gap={2}>
              <NavItem icon={<PenLine className="h-4 w-4" />} label="Journal" active />
              <NavItem icon={<Sparkles className="h-4 w-4" />} label="Memories" />
              <NavItem icon={<CalendarDays className="h-4 w-4" />} label="Timeline" />
              <NavItem icon={<HelpCircle className="h-4 w-4" />} label="Ask my life" />
            </Stack>

            <Tabs value={tab} onValueChange={setTab}>
              <TabList aria-label="Journal view">
                <TabTrigger value="write" icon={<PenLine className="h-3.5 w-3.5" />}>
                  Free write
                </TabTrigger>
                <TabTrigger value="review" icon={<Star className="h-3.5 w-3.5" />}>
                  Reflection
                </TabTrigger>
                <TabTrigger value="read" icon={<BookOpen className="h-3.5 w-3.5" />}>
                  Reading
                </TabTrigger>
              </TabList>
              <TabPanel value="write" className="pt-4">
                <Text variant="prose">
                  Free-write placeholder. Use arrow keys to move between tabs.
                </Text>
              </TabPanel>
              <TabPanel value="review" className="pt-4">
                <Text variant="prose">Weekly reflection placeholder.</Text>
              </TabPanel>
              <TabPanel value="read" className="pt-4">
                <Text variant="prose">Reading list placeholder.</Text>
              </TabPanel>
            </Tabs>
          </div>

          <div className="mt-8">
            <Text variant="caption" className="mb-2">
              Bottom navigation (mobile). Shown here in a phone frame:
            </Text>
            <div className="mx-auto w-80 overflow-hidden rounded-[2.2rem] border-2 border-line bg-page shadow-pop">
              <div className="relative flex h-[420px] flex-col">
                <div className="flex flex-1 items-center justify-center rounded-t-[2rem] border-b border-dashed border-line bg-surface-2/40 p-6 text-center">
                  <EmptyState
                    compact
                    icon={<Search className="h-5 w-5" />}
                    title="Today"
                    description="A calm home screen for the journal."
                  />
                </div>
                <BottomNavigation
                  embedded
                  items={[
                    { id: 'journal', label: 'Journal', icon: <PenLine className="h-5 w-5" />, active: true },
                    { id: 'memories', label: 'Memories', icon: <Star className="h-5 w-5" /> },
                    { id: 'timeline', label: 'Timeline', icon: <CalendarDays className="h-5 w-5" /> },
                    { id: 'ask', label: 'Ask', icon: <HelpCircle className="h-5 w-5" /> },
                    { id: 'profile', label: 'Profile', icon: <User className="h-5 w-5" /> },
                  ]}
                />
              </div>
            </div>
          </div>
        </Section>

        <Section eyebrow="13 · Notifications" title="Toasts">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => toast.success('Entry saved.')}>
              Success
            </Button>
            <Button variant="secondary" onClick={() => toast.error('Could not save. Draft is safe locally.')}>
              Error
            </Button>
            <Button variant="secondary" onClick={() => toast.info('Offline — changes sync when you reconnect.')}>
              Info
            </Button>
          </div>
        </Section>

        <Card variant="inset">
          <CardBody>
            <Stack gap={3}>
              <Text variant="eyebrow">Verification notes</Text>
              <Text variant="prose">
                Keyboard: Tab visits every control; arrows move through tabs; dialogs trap and
                restore focus; tooltips reveal on focus.
              </Text>
              <Text variant="prose">
                Reduced motion: the OS preference disables all animation (CSS guard) and motion
                respects MotionConfig reducedMotion="user".
              </Text>
              <Text variant="prose">
                Responsive: grids collapse to 1 column, sheets become bottom sheets, and the bottom
                nav appears only under the md breakpoint.
              </Text>
            </Stack>
          </CardBody>
        </Card>
      </main>

      <Dialog
        isOpen={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Evening reflection"
        description="A short prompt to close the day"
        icon={<Sparkles className="h-5 w-5" />}
        footer={
          <>
            <Button variant="subtle" onClick={() => setDialogOpen(false)}>
              Later
            </Button>
            <Button onClick={() => setDialogOpen(false)}>Begin</Button>
          </>
        }
      >
        <div className="p-6">
          <Text variant="prose">
            What was one moment today you'd want to remember in a year? Focused dialogs like this
            keep the space calm.
          </Text>
        </div>
      </Dialog>

      <Sheet
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title="Entry details"
        description="Metadata & privacy"
        footer={
          <Button size="sm" variant="secondary" onClick={() => setSheetOpen(false)}>
            Close
          </Button>
        }
      >
        <div className="space-y-3 p-5">
          <Stack gap={3}>
            <Switch checked={notify} onCheckedChange={setNotify} label="Private mode" />
            <Text variant="caption">
              Private entries are excluded from AI memory and Ask My Life unless you opt in.
            </Text>
          </Stack>
        </div>
      </Sheet>

      <ConfirmDialog
        isOpen={confirmOpen}
        title="Delete reflection?"
        message="This permanently removes the entry and its conversation from your private partition. This cannot be undone."
        confirmLabel="Delete entry"
        cancelLabel="Cancel"
        onConfirm={() => {
          setConfirmOpen(false);
          toast.info('Demo only — nothing was deleted.');
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
};

function BookOpenIcon() {
  return <span className="text-[11px] font-semibold">RB</span>;
}

export default DesignSystem;
