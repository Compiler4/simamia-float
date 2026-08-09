# Inline integration

The Staff dashboard renders Live Locations in `PageContent`:

```tsx
case "Live Locations":
  return (
    <StaffLiveLocationsClient
      embedded
      onOpenServiceVisits={() => props.open("Service Visits")}
      user={{
        id: props.user.id,
        name: props.user.name,
        email: props.user.email,
        companyId: String(props.user.companyId || props.data.company?.id || ""),
      }}
    />
  );
```

Do not call `router.push("/staff/live-locations")` from the Staff sidebar. The sidebar should only change the local `page` state.
