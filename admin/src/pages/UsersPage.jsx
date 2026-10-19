import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { adminUsersApi } from '@/api/endpoints/cms';
import { PageHeader, PageLoader, Pagination, Badge, EmptyState } from '@/components/common/Elements';
import { formatDate } from '@/utils/format';
import { getErrorMessage } from '@/api/axiosClient';
import { Trash2, ShieldOff, ShieldCheck } from 'lucide-react';

export default function UsersPage() {
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', page, keyword],
    queryFn: () => adminUsersApi.list({ page, limit: 15, keyword: keyword || undefined }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-users'] });

  const statusMutation = useMutation({
    mutationFn: ({ id, isActive }) => adminUsersApi.updateStatus(id, isActive),
    onSuccess: () => { invalidate(); toast.success('User updated'); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const deleteMutation = useMutation({
    mutationFn: adminUsersApi.remove,
    onSuccess: () => { invalidate(); toast.success('User deleted'); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const users = data?.users || [];
  const totalPages = Math.max(1, Math.ceil((data?.pagination?.total || 0) / 15));

  return (
    <div>
      <PageHeader title="Users" description={`${data?.pagination?.total || 0} customers`} />
      <input
        value={keyword}
        onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
        placeholder="Search by name or email..."
        className="input-field mb-4 max-w-xs"
      />
      <div className="card overflow-hidden">
        {isLoading ? <PageLoader /> : users.length === 0 ? <EmptyState title="No users found" /> : (
          <table className="w-full">
            <thead><tr className="table-head">
              <th className="px-4 py-3">Name</th><th className="px-4 py-3">Mobile</th><th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Joined</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Actions</th>
            </tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u._id} className="table-row">
                  <td className="px-4 py-3 font-medium">{u.name || '—'}</td>
                  <td className="px-4 py-3">{u.mobile}</td>
                  <td className="px-4 py-3 text-night-900/50">{u.email || '—'}</td>
                  <td className="px-4 py-3 text-night-900/50">{formatDate(u.createdAt)}</td>
                  <td className="px-4 py-3"><Badge tone={u.isActive ? 'success' : 'danger'}>{u.isActive ? 'Active' : 'Blocked'}</Badge></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-3">
                      <button
                        onClick={() => statusMutation.mutate({ id: u._id, isActive: !u.isActive })}
                        className={u.isActive ? 'text-yellow-600' : 'text-green-600'}
                        title={u.isActive ? 'Block user' : 'Unblock user'}
                      >
                        {u.isActive ? <ShieldOff size={15} /> : <ShieldCheck size={15} />}
                      </button>
                      <button onClick={() => deleteMutation.mutate(u._id)} className="text-red-600"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </div>
    </div>
  );
}
