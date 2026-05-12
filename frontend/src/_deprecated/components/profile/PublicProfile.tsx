import { ModuleHero, type HeroStats } from "./ModuleHero";
import { ModuleAbout } from "./ModuleAbout";
import { ModuleFeatured } from "./ModuleFeatured";
import { ModuleContact } from "./ModuleContact";
import { ACCENTS } from "./_constants";
import type { ProfileLayout } from "@/lib/profile-schema";
import type { SampleCourse } from "./_sample";

interface PublicProfileProps {
  layout: ProfileLayout;
  initials?: string;
  authorByline?: string;
  courses?: SampleCourse[];
  /** Aggregated platform-verified stats. Omit any field you don't have yet. */
  stats?: HeroStats;
}

export function PublicProfile({
  layout,
  initials,
  authorByline,
  courses,
  stats,
}: PublicProfileProps) {
  const accent = ACCENTS[layout.accent];
  return (
    <div
      className="font-sans"
      style={
        {
          "--profile-accent": accent.hex,
          "--profile-accent-tint": accent.tint,
        } as React.CSSProperties
      }
    >
      {layout.modules.map((module, i) => {
        if (!module.visible) return null;
        switch (module.type) {
          case "hero":
            return (
              <ModuleHero
                key={`hero-${i}`}
                module={module}
                initials={initials}
                stats={stats}
              />
            );
          case "about":
            return (
              <ModuleAbout
                key={`about-${i}`}
                module={module}
                authorByline={authorByline}
              />
            );
          case "featured":
            return (
              <ModuleFeatured
                key={`featured-${i}`}
                module={module}
                courses={courses}
              />
            );
          case "contact":
            return <ModuleContact key={`contact-${i}`} module={module} />;
        }
      })}
    </div>
  );
}
