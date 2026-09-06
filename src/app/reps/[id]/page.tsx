import { RepDetail } from '@/components/views/RepDetail';
import { salesReps } from '@/lib/data';

/** Thirty reps, known at build time — prerender every one. */
export function generateStaticParams() {
  return salesReps.map((rep) => ({ id: rep.id }));
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RepDetail repId={id} />;
}
