"use client";

import { Button, Card, StatusMessage } from "../../components/ui/primitives";

export default function PageError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <Card className="space-y-4">
    <h1 className="text-2xl font-semibold">Page unavailable</h1>
    <StatusMessage tone="error">This page could not be loaded. Check your connection and try again.</StatusMessage>
    <Button type="button" onClick={retry}>Try again</Button>
  </Card>;
}
