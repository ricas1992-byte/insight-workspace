import { Skeleton } from './ui/skeleton';

export function DashboardLayoutSkeleton() {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Main content skeleton */}
      <div className="flex-1 p-6 space-y-5">
        <Skeleton className="h-10 w-48 rounded-xl" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-36 rounded-xl" />
          <Skeleton className="h-36 rounded-xl" />
          <Skeleton className="h-36 rounded-xl" />
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>

      {/* Sidebar skeleton */}
      <div className="w-[260px] border-r border-border bg-background p-4 space-y-6">
        <div className="flex items-center gap-3 px-2">
          <Skeleton className="h-8 w-8 rounded-xl" />
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="space-y-2 px-2">
          <Skeleton className="h-11 w-full rounded-xl" />
          <Skeleton className="h-11 w-full rounded-xl" />
          <Skeleton className="h-11 w-full rounded-xl" />
          <Skeleton className="h-11 w-full rounded-xl" />
        </div>
        <div className="absolute bottom-4 left-4 right-4">
          <div className="flex items-center gap-3 px-1">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-2 w-32" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
