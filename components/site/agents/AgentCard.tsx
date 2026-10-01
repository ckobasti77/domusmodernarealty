import { getTranslations } from "next-intl/server";
import type { AgentPublic } from "@/convex/lib/dto";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { AgentPortrait } from "./AgentPortrait";
import { agentRole, areaList, languageList } from "./data";

/**
 * One agent on the team grid (PRD A9): photograph or monogram, name, role,
 * languages and areas. The name's link is stretched over the whole card, so
 * the card is a single tab stop for the profile. `teaser` is the compact form
 * the About page uses: portrait, name and role only.
 */
export async function AgentCard({
  agent,
  locale,
  variant = "grid",
  headingLevel = 2,
}: {
  agent: AgentPublic;
  locale: Locale;
  variant?: "grid" | "teaser";
  headingLevel?: 2 | 3;
}) {
  const t = await getTranslations({ locale, namespace: "agents" });
  const role = agentRole(agent, locale);
  const Heading = `h${headingLevel}` as "h2" | "h3";
  const grid = variant === "grid";

  return (
    <article
      {...(grid ? { "data-testid": "agent-card" } : {})}
      className="group/agent relative flex flex-col"
    >
      <AgentPortrait
        monogram={agent.monogram}
        {...(agent.photoUrl !== undefined ? { photoUrl: agent.photoUrl } : {})}
        sizes={grid ? "(min-width: 1024px) 23vw, (min-width: 640px) 45vw, 92vw" : "(min-width: 1024px) 23vw, 45vw"}
        className={grid ? "aspect-[3/2] sm:aspect-[4/5]" : "aspect-[4/5]"}
      />

      <Heading className={cn("mt-6 font-display font-normal", grid ? "text-h2" : "text-h3")}>
        <Link
          href={{ pathname: "/agents/[slug]", params: { slug: agent.slug } }}
          prefetch={false}
          className={cn(
            "transition-colors duration-200 ease-out pointer-fine:group-hover/agent:text-bronze-text",
            "after:absolute after:inset-0 after:content-['']",
            "focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-4 focus-visible:after:outline-bronze-text",
          )}
        >
          {agent.name}
        </Link>
      </Heading>
      <p lang={role.lang} className="mt-1 text-small text-stone-text">
        {role.text}
      </p>

      {grid && (agent.languages.length > 0 || agent.areas.length > 0) ? (
        <dl className="mt-5 border-t border-hairline-light text-small">
          {agent.languages.length > 0 ? (
            <div className="flex flex-col gap-1 border-b border-hairline-light py-3">
              <dt className="font-mono text-label uppercase text-stone-text">{t("languages")}</dt>
              <dd>{languageList(agent.languages, locale)}</dd>
            </div>
          ) : null}
          {agent.areas.length > 0 ? (
            <div className="flex flex-col gap-1 border-b border-hairline-light py-3">
              <dt className="font-mono text-label uppercase text-stone-text">{t("areas")}</dt>
              <dd>{areaList(agent.areas, locale)}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
    </article>
  );
}
