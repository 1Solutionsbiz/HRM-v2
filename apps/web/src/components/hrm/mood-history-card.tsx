"use client";

import { Smile } from "lucide-react";
import { useAsync } from "@/lib/use-async";
import { toDateOnlyString } from "@/lib/format";
import { getMyMoodCheckIns, MOOD_OPTIONS } from "@/lib/api/mood-checkins";
import { AsyncSection } from "@/components/hrm/async-section";
import { EmptyState } from "@/components/hrm/empty-state";
import { CardSkeleton } from "@/components/hrm/loading-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function moodOption(mood: string) {
  return MOOD_OPTIONS.find((m) => m.value === mood);
}

export function MoodHistoryCard({ className }: { className?: string } = {}) {
  const { data, loading, error, refetch } = useAsync(getMyMoodCheckIns);
  const today = toDateOnlyString(new Date());
  const entries = (data ?? []).filter((e) => e.date === today);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Your mood today</CardTitle>
      </CardHeader>
      <CardContent>
        <AsyncSection
          loading={loading}
          error={error}
          onRetry={refetch}
          loadingFallback={<CardSkeleton lines={3} />}
        >
          {entries.length === 0 ? (
            <EmptyState icon={Smile} title="No mood logged today" />
          ) : (
            entries.map((entry) => {
              const option = moodOption(entry.mood);
              return (
                <div key={entry.id} className="flex items-start gap-3">
                  <span className="text-2xl leading-none">{option?.emoji ?? "🙂"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{option?.label ?? entry.mood}</p>
                    {entry.tags.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {entry.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-[10px]">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                    {entry.comment && (
                      <p className="text-muted-foreground mt-1 truncate text-xs">{entry.comment}</p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </AsyncSection>
      </CardContent>
    </Card>
  );
}
