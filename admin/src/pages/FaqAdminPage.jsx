import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { faqsApi } from '@/api/endpoints/cms';
import { PageHeader, PageLoader, EmptyState } from '@/components/common/Elements';
import { getErrorMessage } from '@/api/axiosClient';
import { Plus, Pencil, Trash2 } from 'lucide-react';

export default function FaqAdminPage() {
  const [editing, setEditing] = useState(null);
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['admin-faqs'], queryFn: faqsApi.list });
  const { register, handleSubmit, reset } = useForm();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin-faqs'] });

  const createMutation = useMutation({
    mutationFn: faqsApi.create,
    onSuccess: () => { invalidate(); setEditing(null); toast.success('FAQ added'); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => faqsApi.update(id, payload),
    onSuccess: () => { invalidate(); setEditing(null); toast.success('FAQ updated'); },
    onError: (err) => toast.error(getErrorMessage(err)),
  });
  const deleteMutation = useMutation({
    mutationFn: faqsApi.remove,
    onSuccess: () => { invalidate(); toast.success('FAQ deleted'); },
  });

  const startEdit = (faq) => {
    setEditing(faq || 'new');
    reset(faq || { question: '', answer: '', category: '' });
  };

  const onSubmit = (vals) => {
    if (editing?._id) updateMutation.mutate({ id: editing._id, payload: vals });
    else createMutation.mutate(vals);
  };

  const faqs = data?.faqs || [];

  return (
    <div>
      <PageHeader title="FAQ" action={<button onClick={() => startEdit(null)} className="btn-primary"><Plus size={16} /> Add FAQ</button>} />

      {editing && (
        <form onSubmit={handleSubmit(onSubmit)} className="card mb-6 space-y-4 p-6">
          <input {...register('question', { required: true })} placeholder="Question" className="input-field" />
          <textarea {...register('answer', { required: true })} placeholder="Answer" rows={3} className="input-field" />
          <input {...register('category')} placeholder="Category (optional)" className="input-field" />
          <div className="flex gap-2">
            <button type="submit" className="btn-primary">Save</button>
            <button type="button" onClick={() => setEditing(null)} className="btn-outline">Cancel</button>
          </div>
        </form>
      )}

      <div className="card divide-y divide-night-900/5">
        {isLoading ? <PageLoader /> : faqs.length === 0 ? <EmptyState title="No FAQs yet" /> : (
          faqs.map((f) => (
            <div key={f._id} className="flex items-start justify-between gap-4 p-5">
              <div>
                <p className="font-medium">{f.question}</p>
                <p className="mt-1 text-sm text-night-900/60">{f.answer}</p>
              </div>
              <div className="flex shrink-0 gap-3">
                <button onClick={() => startEdit(f)} className="text-gold-600"><Pencil size={15} /></button>
                <button onClick={() => deleteMutation.mutate(f._id)} className="text-red-600"><Trash2 size={15} /></button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
