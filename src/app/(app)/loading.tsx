import { CardGridSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <>
      <Skeleton className="h-10 w-64" />
      <Skeleton className="mt-3 h-4 w-32" />
      <div className="mt-8">
        <CardGridSkeleton />
      </div>
    </>
  );
}
