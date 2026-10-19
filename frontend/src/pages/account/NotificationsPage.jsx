import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '@/api/endpoints/misc';
import { PageLoader, EmptyState, Pagination, AppImage } from '@/components/common/Elements';
import { formatDate } from '@/utils/format';
import { Bell, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function NotificationsPage() {
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['notifications', 'history', page],
    queryFn: () => notificationsApi.list({ page, limit: 20 }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['notifications'] });

  const markAllReadMutation = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: invalidate,
  });
  const markReadMutation = useMutation({ mutationFn: notificationsApi.markRead, onSuccess: invalidate });
  const removeMutation = useMutation({
    mutationFn: notificationsApi.remove,
    onSuccess: () => { invalidate(); toast.success('Notification removed'); },
  });

  if (isLoading) return <PageLoader />;
  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount || 0;
  const totalPages = data?.pagination?.totalPages || 1;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl">Notifications</h1>
        {unreadCount > 0 && (
          <button onClick={() => markAllReadMutation.mutate()} className="btn-outline text-sm">Mark all read</button>
        )}
      </div>

      {notifications.length === 0 ? (
        <EmptyState icon={Bell} title="No notifications yet" description="Order updates, offers, and announcements will show up here." />
      ) : (
        <div className="card divide-y divide-night-900/5 overflow-hidden">
          {notifications.map((n) => (
            <div key={n._id} className={`flex items-start gap-3 p-4 ${!n.isRead ? 'bg-gold-50/40' : ''}`}>
              {n.image && <AppImage src={n.image} alt="" className="h-12 w-12 shrink-0 rounded-sm object-cover" />}
              <Link
                to={n.link || '#'}
                onClick={() => !n.isRead && markReadMutation.mutate(n._id)}
                className="flex-1"
              >
                <div className="flex items-center gap-2">
                  {!n.isRead && <span className="h-1.5 w-1.5 rounded-full bg-gold-500" />}
                  <p className="font-medium">{n.title}</p>
                </div>
                <p className="mt-1 text-sm text-night-900/60">{n.message}</p>
                <p className="mt-1 text-xs text-night-900/40">{formatDate(n.createdAt)}</p>
              </Link>
              <button onClick={() => removeMutation.mutate(n._id)} className="text-night-900/30 hover:text-maroon-700" aria-label="Remove">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} onChange={setPage} />
    </div>
  );
}
