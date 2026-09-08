import { Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Original one-liners, not attributed quotes from real people - avoids any
 * copyright question around reproducing someone else's exact words, and
 * means there's no author name to get wrong.
 */
const THOUGHTS = [
  "Small, steady steps still get you to the finish line.",
  "A good question is worth more than a quick answer.",
  "Progress rarely looks impressive while it's happening.",
  "The best time to ask for help is before you're stuck.",
  "Consistency beats intensity over the long run.",
  "Every expert was once a beginner who kept showing up.",
  "Clarity comes from doing, not just thinking.",
  "A little kindness costs nothing and travels far.",
  "Done is better than perfect, most days.",
  "Your focus today shapes your options tomorrow.",
  "The team that shares credit, keeps winning.",
  "Rest is part of the work, not a break from it.",
  "Curiosity is the fastest way to get unstuck.",
  "What gets measured gets better, slowly.",
  "A calm mind makes better decisions than a rushed one.",
  "Feedback is a gift, even when it stings a little.",
  "Most breakthroughs follow a long stretch of ordinary effort.",
  "Say what you mean; it saves everyone time later.",
  "The smallest win today still counts as a win.",
  "Good habits are just decisions you don't have to make twice.",
  "Ask 'why' once more than feels necessary.",
  "Nobody remembers the meeting that started on time.",
  "Trust is built in small moments, not big speeches.",
  "You don't need a perfect plan, just the next right step.",
  "Slow down when it matters; speed up when it doesn't.",
  "A problem named clearly is already half solved.",
  "Show up for the boring parts too - that's most of the job.",
  "Celebrate the finish, however small the race.",
  "The best ideas usually sound a little unfinished at first.",
  "Take the win today; worry about tomorrow tomorrow.",
] as const;

function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / 86_400_000);
}

export function ThoughtOfTheDayCard({ className }: { className?: string } = {}) {
  const thought = THOUGHTS[dayOfYear(new Date()) % THOUGHTS.length];

  return (
    <Card className={className}>
      <CardContent className="flex items-start gap-3 pt-6">
        <Sparkles className="text-muted-foreground mt-0.5 size-4 shrink-0" />
        <div>
          <p className="text-muted-foreground text-xs font-medium">Thought of the day</p>
          <p className="mt-1 text-sm">{thought}</p>
        </div>
      </CardContent>
    </Card>
  );
}
