import { BranchDetail } from '@/components/views/BranchDetail';
import { branches } from '@/lib/data';

/** Five branches, known at build time — prerender every one. */
export function generateStaticParams() {
  return branches.map((branch) => ({ id: branch.id }));
}

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <BranchDetail branchId={id} />;
}
