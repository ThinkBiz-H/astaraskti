import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { notificationsApi } from '@/api/endpoints/misc';
import { formatDate } from '@/utils/format';

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ['notifications', 'bell'],
    queryFn: () => notificationsApi.list({ limit: 8 }),
    refetchInterval: 10_000, // poll every 10s — no websocket/push channel exists in this app (see order tracking's matching pattern)
  });

  const markReadMutation = useMutation({
    mutationFn: notificationsApi.markRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const markAllReadMutation = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const notifications = data?.notifications || [];
  const unreadCount = data?.unreadCount || 0;

  const handleItemClick = (n) => {
    if (!n.isRead) markReadMutation.mutate(n._id);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((v) => !v)} className="relative" aria-label="Notifications">
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center rounded-full bg-gold-400 text-[10px] font-bold text-night-950">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-3 w-80 rounded-sm border border-night-900/10 bg-white text-night-900 shadow-lg">
          <div className="flex items-center justify-between border-b border-night-900/10 px-4 py-3">
            <p className="text-sm font-semibold">Notifications</p>
            {unreadCount > 0 && (
              <button onClick={() => markAllReadMutation.mutate()} className="text-xs text-gold-600">Mark all read</button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="p-6 text-center text-sm text-night-900/50">No notifications yet</p>
            ) : (
              notifications.map((n) => (
                <Link
                  key={n._id}
                  to={n.link || '/account/notifications'}
                  onClick={() => handleItemClick(n)}
                  className={`block border-b border-night-900/5 px-4 py-3 text-sm last:border-0 hover:bg-night-900/5 ${!n.isRead ? 'bg-gold-50/50' : ''}`}
                >
                  <div className="flex items-start gap-2">
                    {!n.isRead && <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-500" />}
                    <div className="flex-1">
                      <p className="font-medium">{n.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-night-900/60">{n.message}</p>
                      <p className="mt-1 text-[11px] text-night-900/40">{formatDate(n.createdAt)}</p>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>

          <Link to="/account/notifications" onClick={() => setOpen(false)} className="block border-t border-night-900/10 px-4 py-2.5 text-center text-xs font-medium text-gold-600 hover:bg-night-900/5">
            View all notifications
          </Link>
        </div>
      )}
    </div>
  );
}
