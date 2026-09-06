import type { ReflectionMode } from '../data';

/**
 * Reusable Journal Mode & Prompt Definitions.
 *
 * Modes provide optional guidance and inspiration without forcing users into
 * rigid forms or structured fields. Free writing is always accessible and default.
 */

export interface PromptItem {
  id: string;
  question: string;
  starter?: string;
}

export interface JournalModeDefinition {
  id: ReflectionMode;
  name: string;
  shortName: string;
  description: string;
  placeholder: string;
  suggestedTags: string[];
  prompts: PromptItem[];
  iconName: string;
}

export const JOURNAL_MODE_DEFINITIONS: Record<ReflectionMode, JournalModeDefinition> = {
  'free-write': {
    id: 'free-write',
    name: 'Free Write',
    shortName: 'Free Write',
    description: 'Unstructured space to write whatever is on your mind without limits or judgment.',
    placeholder: 'Start writing freely... every word is saved automatically.',
    suggestedTags: ['free-write', 'thoughts'],
    iconName: 'PenTool',
    prompts: [
      {
        id: 'free-write-1',
        question: 'What is currently occupying your mind right now?',
        starter: 'Right now, I am thinking about...',
      },
      {
        id: 'free-write-2',
        question: 'Stream of consciousness: write whatever comes to mind first.',
        starter: 'My mind feels focused on...',
      },
      {
        id: 'free-write-3',
        question: 'How are you feeling in this exact moment?',
        starter: 'In this moment, I feel...',
      },
    ],
  },
  morning: {
    id: 'morning',
    name: 'Morning Reflection',
    shortName: 'Morning',
    description: 'Set intentions, ground your focus, and plan how you want to show up today.',
    placeholder: 'Good morning! What intentions and priorities are guiding your day?...',
    suggestedTags: ['morning', 'intentions', 'planning'],
    iconName: 'Sun',
    prompts: [
      {
        id: 'morning-1',
        question: 'What is your main intention or top priority for today?',
        starter: 'My top priority today is...',
      },
      {
        id: 'morning-2',
        question: 'What is one thing you are looking forward to today?',
        starter: 'I am looking forward to...',
      },
      {
        id: 'morning-3',
        question: 'How do you want to show up for yourself and others today?',
        starter: 'Today I want to embody...',
      },
      {
        id: 'morning-4',
        question: 'What potential challenge might arise, and how will you handle it thoughtfully?',
        starter: 'If a challenge arises today, I will...',
      },
    ],
  },
  evening: {
    id: 'evening',
    name: 'Evening Reflection',
    shortName: 'Evening',
    description: 'Unwind, reflect on your wins, process lessons, and close out the day with peace.',
    placeholder: 'Good evening! How did your day unfold and what did you experience?...',
    suggestedTags: ['evening', 'reflection', 'daily-review'],
    iconName: 'Moon',
    prompts: [
      {
        id: 'evening-1',
        question: 'What went well today, and what made it meaningful?',
        starter: 'Something that went well today was...',
      },
      {
        id: 'evening-2',
        question: 'What challenged you today, and what did you learn from it?',
        starter: 'A challenge I faced today taught me...',
      },
      {
        id: 'evening-3',
        question: 'What is one lesson or insight you will carry into tomorrow?',
        starter: 'Tomorrow, I want to remember...',
      },
      {
        id: 'evening-4',
        question: 'What can you let go of or forgive as you rest tonight?',
        starter: 'As I close today, I am letting go of...',
      },
    ],
  },
  deep: {
    id: 'deep',
    name: 'Deep Reflection',
    shortName: 'Deep',
    description: 'Explore core values, life patterns, self-discovery, and introspective questions.',
    placeholder: 'Dive deep into your inner thoughts and introspective questions...',
    suggestedTags: ['deep-work', 'introspection', 'growth'],
    iconName: 'Compass',
    prompts: [
      {
        id: 'deep-1',
        question: 'What recurring patterns or themes have you noticed in your life recently?',
        starter: 'A recurring pattern I notice lately is...',
      },
      {
        id: 'deep-2',
        question: 'What core value is most important to you right now, and why?',
        starter: 'Right now, the value I care most about is...',
      },
      {
        id: 'deep-3',
        question: 'Where in your life do you feel most aligned, and where do you feel out of sync?',
        starter: 'I feel aligned when... but out of sync when...',
      },
      {
        id: 'deep-4',
        question: 'What fear or hesitation is currently holding you back from growth?',
        starter: 'The hesitation holding me back is...',
      },
    ],
  },
  gratitude: {
    id: 'gratitude',
    name: 'Gratitude',
    shortName: 'Gratitude',
    description: 'Focus on appreciation, warmth, and recognizing the good in your life.',
    placeholder: 'What or who are you thankful for today?...',
    suggestedTags: ['gratitude', 'appreciation', 'positivity'],
    iconName: 'Heart',
    prompts: [
      {
        id: 'gratitude-1',
        question: 'What are 3 things—big or small—that brought you comfort or joy today?',
        starter: 'Today I am grateful for: 1. ..., 2. ..., 3. ...',
      },
      {
        id: 'gratitude-2',
        question: 'Who is someone you appreciate in your life, and why are you thankful for them?',
        starter: 'I am thankful for [Person] because...',
      },
      {
        id: 'gratitude-3',
        question: 'What is an unexpected blessing or pleasant surprise from recently?',
        starter: 'A pleasant surprise recently was...',
      },
      {
        id: 'gratitude-4',
        question: 'What is a simple everyday privilege or capability you often take for granted?',
        starter: 'Something simple I appreciate is...',
      },
    ],
  },
  idea: {
    id: 'idea',
    name: 'Idea Capture',
    shortName: 'Idea',
    description: 'Capture raw concepts, creative sparks, visions, and new possibilities.',
    placeholder: 'Describe your concept, vision, or spark of creativity...',
    suggestedTags: ['idea', 'brainstorm', 'innovation'],
    iconName: 'Lightbulb',
    prompts: [
      {
        id: 'idea-1',
        question: 'What is the core concept or idea in one simple sentence?',
        starter: 'The core idea is...',
      },
      {
        id: 'idea-2',
        question: 'What problem does this idea solve or what possibility does it create?',
        starter: 'This idea solves the problem of...',
      },
      {
        id: 'idea-3',
        question: 'What are the key elements, features, or components of this concept?',
        starter: 'Key components include...',
      },
      {
        id: 'idea-4',
        question: 'What is the smallest experiment or next step to test this idea?',
        starter: 'The next step to test this is...',
      },
    ],
  },
  goal: {
    id: 'goal',
    name: 'Goal Reflection',
    shortName: 'Goal',
    description: 'Track progress, refine milestones, remove friction, and stay accountable.',
    placeholder: 'Reflect on your current goals, progress, and next milestones...',
    suggestedTags: ['goals', 'progress', 'milestones'],
    iconName: 'Target',
    prompts: [
      {
        id: 'goal-1',
        question: 'Which goal are you reflecting on today, and what progress have you made?',
        starter: 'Target Goal: ...\nProgress update: ...',
      },
      {
        id: 'goal-2',
        question: 'What recent win or milestone can you celebrate?',
        starter: 'A milestone reached recently is...',
      },
      {
        id: 'goal-3',
        question: 'What obstacle or bottleneck is slowing down your momentum?',
        starter: 'The bottleneck I need to address is...',
      },
      {
        id: 'goal-4',
        question: 'What single high-impact action will you take next?',
        starter: 'My next high-impact action is...',
      },
    ],
  },
  work: {
    id: 'work',
    name: 'Work Journal',
    shortName: 'Work',
    description: 'Log project updates, key decisions, professional accomplishments, and blockers.',
    placeholder: 'Log work updates, key decisions, project notes, or meeting takeaways...',
    suggestedTags: ['work', 'projects', 'log'],
    iconName: 'Briefcase',
    prompts: [
      {
        id: 'work-1',
        question: 'What key tasks or projects did you work on today?',
        starter: 'Projects worked on today:\n- ',
      },
      {
        id: 'work-2',
        question: 'What important decisions were made, and what was the rationale?',
        starter: 'Key decision: ...\nRationale: ...',
      },
      {
        id: 'work-3',
        question: 'What blockers or challenges require follow-up or collaboration?',
        starter: 'Blockers / Follow-ups needed:\n- ',
      },
      {
        id: 'work-4',
        question: 'What key accomplishment or milestone was achieved today?',
        starter: 'Today\'s major win was...',
      },
    ],
  },
  learning: {
    id: 'learning',
    name: 'Learning Journal',
    shortName: 'Learning',
    description: 'Synthesize new knowledge, distill insights, and track skill growth.',
    placeholder: 'What new concept, skill, book, or lesson did you learn today?...',
    suggestedTags: ['learning', 'study', 'notes'],
    iconName: 'BookOpen',
    prompts: [
      {
        id: 'learning-1',
        question: 'What key concept or skill did you learn today?',
        starter: 'Today I learned about...',
      },
      {
        id: 'learning-2',
        question: 'How would you explain this concept simply in your own words?',
        starter: 'In simple terms, this works by...',
      },
      {
        id: 'learning-3',
        question: 'How can you apply this new insight in your real projects or daily life?',
        starter: 'I can apply this concept by...',
      },
      {
        id: 'learning-4',
        question: 'What follow-up questions or areas do you want to study next?',
        starter: 'Next, I want to explore...',
      },
    ],
  },
  travel: {
    id: 'travel',
    name: 'Travel Journal',
    shortName: 'Travel',
    description: 'Document journeys, places visited, sensory memories, and cultural moments.',
    placeholder: 'Capture your travel observations, places, sights, and experiences...',
    suggestedTags: ['travel', 'journey', 'memories'],
    iconName: 'MapPin',
    prompts: [
      {
        id: 'travel-1',
        question: 'Where are you currently, and what does the atmosphere feel like?',
        starter: 'Location / Atmosphere: ...',
      },
      {
        id: 'travel-2',
        question: 'What was the highlight or most memorable moment of your journey today?',
        starter: 'The highlight today was...',
      },
      {
        id: 'travel-3',
        question: 'What unique local flavors, sights, sounds, or cultural details did you experience?',
        starter: 'Sensory observations & details:\n- ',
      },
      {
        id: 'travel-4',
        question: 'How is this journey or environment shaping your perspective?',
        starter: 'This experience makes me reflect on...',
      },
    ],
  },
};

/** All available journal mode definitions as an array for lists / menus. */
export const ALL_JOURNAL_MODES: JournalModeDefinition[] = Object.values(JOURNAL_MODE_DEFINITIONS);

/** Gets a journal mode definition by mode ID, falling back to Free Write if invalid. */
export function getJournalMode(mode?: ReflectionMode | null): JournalModeDefinition {
  if (!mode || !(mode in JOURNAL_MODE_DEFINITIONS)) {
    return JOURNAL_MODE_DEFINITIONS['free-write'];
  }
  return JOURNAL_MODE_DEFINITIONS[mode];
}

/** Returns the prompt list for a given mode. */
export function getModePrompts(mode: ReflectionMode): PromptItem[] {
  return getJournalMode(mode).prompts;
}

/** Returns the suggested placeholder for a given mode. */
export function getModePlaceholder(mode: ReflectionMode): string {
  return getJournalMode(mode).placeholder;
}
