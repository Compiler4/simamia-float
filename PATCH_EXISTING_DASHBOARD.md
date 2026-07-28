# Add the new Control Centre to the existing Accountant dashboard

The upgrade does not delete or replace the current dashboard. Add one navigation link so every existing section remains available.

## Simple dashboard card/link

Import:

```tsx
import AccountantControlCentreLink from "../control-centre/AccountantControlCentreLink";
```

Render it in the existing dashboard header or Quick Actions area:

```tsx
<AccountantControlCentreLink />
```

## Sidebar option in the existing monolithic dashboard

Add this page key:

```ts
| "Control Centre"
```

Add this navigation row:

```ts
{ page: "Control Centre", glyph: "dashboard", group: "Operations" },
```

In `openPage`, route it instead of rendering a local component:

```ts
function openPage(page: PageKey) {
  if (page === "Control Centre") {
    router.push("/accountant/control-centre");
    return;
  }

  setActivePage(page);
  setMobileOpen(false);
  setNoticeOpen(false);
}
```

The Company Admin comparison page is:

```text
/company-admin/verification-centre
```
