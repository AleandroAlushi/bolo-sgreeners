import type { Metadata } from "next";
import { Suspense } from "react";
import { FeedbackForm } from "@/components/feedback-form";
import { IconMessage } from "@/components/icons";

export const metadata: Metadata = {
  title: "Feedback",
  description: "Idee e segnalazioni per il sito e l'app dei Bolo Sgreeners.",
  robots: { index: false },
};

export default function FeedbackPage() {
  return (
    <div className="mx-auto max-w-xl py-4">
      <p className="eyebrow flex items-center gap-1.5 text-secondary">
        <IconMessage size={14} /> Feedback
      </p>
      <h1 className="display mt-1 text-5xl leading-none">Dicci la tua</h1>
      <p className="mt-3 text-muted">
        Un&apos;idea per il sito o per l&apos;app, un dato sbagliato, qualcosa che non funziona: scrivilo qui. Il messaggio lo legge solo
        l&apos;admin.
      </p>
      <div className="card mt-6 p-4 sm:p-6">
        <Suspense fallback={null}>
          <FeedbackForm />
        </Suspense>
      </div>
    </div>
  );
}
