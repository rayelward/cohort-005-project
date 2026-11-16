import { useState } from "react";
import { useFetcher } from "react-router";
import { Lock, NotebookPen } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { LessonSection } from "~/components/lesson-section";
import { describeNoteDraft } from "~/modules/lesson-note";
import { cn, formatRelativeTime } from "~/lib/utils";

const privacyNote = (
  <span className="inline-flex items-center gap-1">
    <Lock className="size-3.5" />
    Private to you. Jot things down while you watch.
  </span>
);

export function LessonNote({
  note,
}: {
  note: { body: string; updatedAt: string } | null;
}) {
  const fetcher = useFetcher<{ ok: boolean; error?: string }>();
  const [body, setBody] = useState(note?.body ?? "");
  const isSaving = fetcher.state !== "idle";
  const error = fetcher.data?.error;
  const draft = describeNoteDraft(body, note?.body ?? "");

  return (
    <LessonSection
      icon={NotebookPen}
      title="Your notes"
      description={privacyNote}
    >
      <fetcher.Form method="post" className="space-y-2">
        <input type="hidden" name="intent" value="save-note" />
        <Textarea
          name="body"
          rows={5}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="What do you want to remember from this lesson?"
          aria-label="Your notes"
          className="resize-y"
        />

        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" disabled={isSaving || !draft.canSave}>
            {isSaving ? "Saving..." : "Save note"}
          </Button>
          <NoteStatus
            error={error}
            unsaved={draft.unsaved}
            updatedAt={note?.updatedAt}
          />
          <span
            className={cn(
              "ml-auto text-xs",
              draft.overLimit ? "text-destructive" : "text-muted-foreground"
            )}
          >
            {draft.length} / {draft.max}
          </span>
        </div>
      </fetcher.Form>
    </LessonSection>
  );
}

function NoteStatus({
  error,
  unsaved,
  updatedAt,
}: {
  error: string | undefined;
  unsaved: boolean;
  updatedAt: string | undefined;
}) {
  if (error) return <span className="text-xs text-destructive">{error}</span>;
  if (unsaved) {
    return (
      <span className="text-xs text-muted-foreground">Unsaved changes</span>
    );
  }
  if (!updatedAt) return null;
  return (
    <span suppressHydrationWarning className="text-xs text-muted-foreground">
      Saved {formatRelativeTime(updatedAt)}
    </span>
  );
}
