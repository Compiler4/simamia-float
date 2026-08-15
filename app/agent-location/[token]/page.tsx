import { notFound } from "next/navigation";

import AgentLocationShareClient from "./AgentLocationShareClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type AgentLocationSharePageProps = {
  params: Promise<{
    token: string;
  }>;
};

export default async function AgentLocationSharePage({
  params,
}: AgentLocationSharePageProps) {
  const { token } = await params;

  const cleanToken = decodeURIComponent(
    String(token ?? ""),
  ).trim();

  if (!cleanToken) {
    notFound();
  }

  return (
    <AgentLocationShareClient
      token={cleanToken}
    />
  );
}