@{
    # =====================================================================
    #  Mihajlo Estate - night run configuration (edit freely, ASCII only)
    # =====================================================================
    #  Model   : opus (alias; Opus 5.5 needs Claude Code >= 2.1.280 - the preflight runs `claude update`)
    #            | sonnet | fable | full model IDs such as claude-opus-5-5
    #  Effort  : low | medium | high | xhigh | max | ultracode (xhigh + automatic multi-agent workflows)
    #  Session : new      = fresh context, reads docs + PROGRESS.md (default: cleaner, no context rot)
    #            continue = resumes the previous step's session (keeps its full context)
    #  Mode    : plan = read-only plan mode, runner saves the answer to docs/IMPLEMENTATION-PLAN.md
    #            goal = /goal loop + permission mode below; keeps working until the Definition of done
    #                   is demonstrated (evaluated after every turn), then the runner's verify gate runs
    #            auto = single prompt in the permission mode below (no goal loop)
    # =====================================================================

    PermissionMode    = 'auto'        # auto (classifier-reviewed, recommended) | bypassPermissions
    FallbackToBypass  = $true         # if auto mode is unavailable for this account, use bypassPermissions
    ModelLadder       = @('opus', 'sonnet')   # fallback order on unavailable model / long limit
    MaxUsageWaitHours = 6             # wait for a usage-limit reset up to this long, else step down the ladder
    MaxFixAttempts    = 2             # extra resumes when the verify gate fails after a step
    MaxErrorRetries   = 3             # resumes after crashes / API errors per step
    DefaultTimeoutMin = 150           # wall-clock cap per attempt (process is killed and resumed)
    GoalTurnCap       = 30            # "or stop after N turns" clause inside each /goal
    GateCommand       = 'npm run verify'

    Steps = @(
        @{ Id = '01';  Title = 'Implementation plan';          File = '01-plan.md';               Model = 'opus'; Effort = 'max';       Session = 'new';      Mode = 'plan'; TimeoutMin = 45;  Gate = 'none'   }
        @{ Id = '02';  Title = 'Foundation';                   File = '02-foundation.md';         Model = 'opus'; Effort = 'xhigh';     Session = 'new';      Mode = 'goal'; TimeoutMin = 150; Gate = 'verify' }
        @{ Id = '03';  Title = 'Convex backend, auth, seed';   File = '03-backend.md';            Model = 'opus'; Effort = 'xhigh';     Session = 'new';      Mode = 'goal'; TimeoutMin = 180; Gate = 'verify' }
        @{ Id = '04';  Title = 'Design system and shell';      File = '04-design-system.md';      Model = 'opus'; Effort = 'max';       Session = 'new';      Mode = 'goal'; TimeoutMin = 150; Gate = 'verify' }
        @{ Id = '05';  Title = 'Animated landing page';        File = '05-landing.md';            Model = 'opus'; Effort = 'max';       Session = 'new';      Mode = 'goal'; TimeoutMin = 180; Gate = 'verify' }
        @{ Id = '05b'; Title = 'Landing critique and polish';  File = '05b-landing-critique.md';  Model = 'opus'; Effort = 'max';       Session = 'continue'; Mode = 'goal'; TimeoutMin = 90;  Gate = 'verify' }
        @{ Id = '06';  Title = 'Search, filters, map';         File = '06-search-map.md';         Model = 'opus'; Effort = 'xhigh';     Session = 'new';      Mode = 'goal'; TimeoutMin = 150; Gate = 'verify' }
        @{ Id = '07';  Title = 'Listing detail page';          File = '07-listing-detail.md';     Model = 'opus'; Effort = 'xhigh';     Session = 'new';      Mode = 'goal'; TimeoutMin = 150; Gate = 'verify' }
        @{ Id = '08';  Title = 'Admin shell and listings';     File = '08-admin-listings.md';     Model = 'opus'; Effort = 'xhigh';     Session = 'new';      Mode = 'goal'; TimeoutMin = 180; Gate = 'verify' }
        @{ Id = '09';  Title = 'Admin CRM and content';        File = '09-admin-crm-content.md';  Model = 'opus'; Effort = 'xhigh';     Session = 'new';      Mode = 'goal'; TimeoutMin = 180; Gate = 'verify' }
        @{ Id = '10';  Title = 'Remaining public pages';       File = '10-public-pages.md';       Model = 'opus'; Effort = 'xhigh';     Session = 'new';      Mode = 'goal'; TimeoutMin = 150; Gate = 'verify' }
        @{ Id = '11';  Title = '360 tours and 3D walkthrough'; File = '11-tours-3d.md';           Model = 'opus'; Effort = 'xhigh';     Session = 'new';      Mode = 'goal'; TimeoutMin = 150; Gate = 'verify' }
        @{ Id = '12';  Title = 'SEO, i18n, performance';       File = '12-seo-i18n-perf.md';      Model = 'opus'; Effort = 'xhigh';     Session = 'new';      Mode = 'goal'; TimeoutMin = 150; Gate = 'verify' }
        @{ Id = '13';  Title = 'Full QA sweep (workflow)';     File = '13-qa-sweep.md';           Model = 'opus'; Effort = 'ultracode'; Session = 'new';      Mode = 'goal'; TimeoutMin = 210; Gate = 'verify' }
        @{ Id = '14';  Title = 'Independent code review';      File = '14-cross-review.md';       Model = 'opus'; Effort = 'max';       Session = 'new';      Mode = 'goal'; TimeoutMin = 150; Gate = 'verify' }
        @{ Id = '15';  Title = 'Final polish and handoff';     File = '15-handoff.md';            Model = 'opus'; Effort = 'max';       Session = 'new';      Mode = 'goal'; TimeoutMin = 120; Gate = 'verify' }
    )
}
