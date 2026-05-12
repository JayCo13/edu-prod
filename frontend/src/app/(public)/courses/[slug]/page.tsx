import type { Metadata } from "next";

/* -------------------------------------------------------------------------- */
/*  Dynamic Metadata                                                          */
/* -------------------------------------------------------------------------- */
// TODO: Fetch course data from API to generate dynamic metadata.

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;

  // TODO: Replace with actual API call → GET /api/courses/:slug
  return {
    title: `Course — ${slug}`,
    description: `Enroll in ${slug} and start learning today on VLearning.`,
    openGraph: {
      title: `Course — ${slug}`,
      description: `Enroll in ${slug} and start learning today on VLearning.`,
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  Course Detail Page                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Course Detail
 * -------------
 * Public-facing course detail page. Displays course info, curriculum, and enrollment CTA.
 * TODO: Integrate with course API and add proper data fetching.
 */
export default async function CourseDetailPage({ params }: PageProps) {
  const { slug } = await params;

  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6 lg:px-8">
      {/* ── Course Header ──────────────────────────────────── */}
      <section>
        <h1 className="text-3xl font-bold text-foreground">{slug}</h1>
        <p className="mt-4 text-muted-foreground">
          TODO: Fetch course description from API.
        </p>

        {/* Enrollment CTA */}
        <div className="mt-8">
          <button
            type="button"
            className="rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg transition-all hover:opacity-90"
          >
            Enroll Now
          </button>
        </div>
      </section>

      {/* ── Curriculum ─────────────────────────────────────── */}
      <section className="mt-16">
        <h2 className="text-xl font-semibold text-foreground">Curriculum</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          TODO: Fetch and render course curriculum (sections & lessons).
        </p>
      </section>

      {/* ── Instructor ─────────────────────────────────────── */}
      <section className="mt-16">
        <h2 className="text-xl font-semibold text-foreground">Instructor</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          TODO: Display linked teacher profile.
        </p>
      </section>
    </div>
  );
}
