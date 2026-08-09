import AgentLocationShareClient from "./AgentLocationShareClient";

export const dynamic = "force-dynamic";

export default async function AgentLocationSharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <AgentLocationShareClient token={token} />;
}
