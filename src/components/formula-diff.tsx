"use client";

import { useMemo } from "react";
import * as Diff from "diff";
import { cn } from "@/lib/utils";
import { formatFormula } from "@/lib/formula-formatter";

type FormulaDiffProps = {
  prior: string;
  after: string;
  className?: string;
};

/**
 * Character-wise diff: prior (red for removed) vs after (green for added).
 * Both sides are formatted for readability; Aktuell/Nachher stacked vertically for more space.
 */
export function FormulaDiff({ prior, after, className }: FormulaDiffProps) {
  const formattedPrior = useMemo(() => formatFormula(prior), [prior]);
  const formattedAfter = useMemo(() => formatFormula(after), [after]);

  const changes = useMemo(
    () => Diff.diffChars(formattedPrior, formattedAfter),
    [formattedPrior, formattedAfter]
  );

  const priorSpans = useMemo(
    () =>
      changes
        .filter((part) => !part.added)
        .map((part, i) => (
          <span
            key={i}
            className={cn(
              part.removed && "bg-red-500/30 text-red-800 dark:text-red-200"
            )}
          >
            {part.value}
          </span>
        )),
    [changes]
  );

  const afterSpans = useMemo(
    () =>
      changes
        .filter((part) => !part.removed)
        .map((part, i) => (
          <span
            key={i}
            className={cn(
              part.added && "bg-green-500/30 text-green-800 dark:text-green-200"
            )}
          >
            {part.value}
          </span>
        )),
    [changes]
  );

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-lg border bg-muted/30 p-3 font-mono text-sm",
        className
      )}
    >
      <div className="min-w-0">
        <div className="mb-1 text-xs font-medium text-muted-foreground">
          Aktuell
        </div>
        <div className="min-h-8 overflow-x-auto whitespace-pre break-words rounded border border-border/50 bg-background/50 px-2.5 py-2">
          {priorSpans}
        </div>
      </div>
      <div className="min-w-0">
        <div className="mb-1 text-xs font-medium text-muted-foreground">
          Nachher
        </div>
        <div className="min-h-8 overflow-x-auto whitespace-pre break-words rounded border border-border/50 bg-background/50 px-2.5 py-2">
          {afterSpans}
        </div>
      </div>
    </div>
  );
}
