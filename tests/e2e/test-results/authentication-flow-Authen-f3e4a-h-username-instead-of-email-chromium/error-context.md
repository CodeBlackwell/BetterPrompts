# Page snapshot

```yaml
- button "Open Next.js Dev Tools":
  - img
- button "Open issues overlay": 1 Issue
- navigation:
  - button "previous" [disabled]:
    - img "previous"
  - text: 1/1
  - button "next" [disabled]:
    - img "next"
- img
- link "Next.js 15.4.1 (stale) Webpack":
  - /url: https://nextjs.org/docs/messages/version-staleness
  - img
  - text: Next.js 15.4.1 (stale) Webpack
- img
- dialog "Build Error":
  - text: Build Error
  - button "Copy Stack Trace":
    - img
  - button "No related documentation found" [disabled]:
    - img
  - link "Learn more about enabling Node.js inspector for server code with Chrome DevTools":
    - /url: https://nextjs.org/docs/app/building-your-application/configuring/debugging#server-side-code
    - img
  - paragraph: "x `ssr: false` is not allowed with `next/dynamic` in Server Components. Please move it into a Client Component."
  - img
  - text: ./src/app/layout.tsx
  - button "Open in editor":
    - img
  - text: "Error: x `ssr: false` is not allowed with `next/dynamic` in Server Components. Please move it into a Client Component. ,-[/app/src/app/layout.tsx:17:1] 14 | { ssr: true } 15 | ); 16 | 17 | ,-> const Toaster = dynamic( 18 | | () => import(\"@/components/ui/toaster\").then((mod) => ({ default: mod.Toaster })), 19 | | { ssr: false } 20 | `-> ); 21 | 22 | export const metadata: Metadata = { 23 | title: \"BetterPrompts - AI Prompt Engineering Made Simple\", `----"
- alert
```