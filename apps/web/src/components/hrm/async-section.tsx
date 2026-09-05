import { ErrorState } from "@/components/hrm/error-state";

interface AsyncSectionProps {
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
  loadingFallback: React.ReactNode;
  errorTitle?: string;
  children: React.ReactNode;
}

/**
 * The one loading/error switch every data-driven section should use, so
 * "every screen has loading + error states" is structural rather than
 * something each page has to remember to implement. Empty states are
 * handled per-page with <EmptyState> since what counts as "empty" and what
 * action to offer differs per screen.
 */
export function AsyncSection({
  loading,
  error,
  onRetry,
  loadingFallback,
  errorTitle,
  children,
}: AsyncSectionProps) {
  if (loading) return <>{loadingFallback}</>;
  if (error) {
    return (
      <ErrorState
        title={errorTitle}
        description={error.message || "We couldn't load this data. Please try again."}
        onRetry={onRetry}
      />
    );
  }
  return <>{children}</>;
}
