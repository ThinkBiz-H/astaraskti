import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { productsApi } from '@/api/endpoints/catalog';
import { StarRating } from '@/components/common/Elements';
import { useSelector } from 'react-redux';
import { selectIsAuthenticated } from '@/features/auth/authSlice';
import toast from 'react-hot-toast';
import { getErrorMessage } from '@/api/axiosClient';
import { format } from 'date-fns';

export function ReviewsSection({ productId }) {
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const queryClient = useQueryClient();
  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm({ defaultValues: { rating: 5 } });

  const { data } = useQuery({
    queryKey: ['reviews', productId],
    queryFn: () => productsApi.getReviews(productId),
  });
  const { data: distribution } = useQuery({
    queryKey: ['rating-distribution', productId],
    queryFn: () => productsApi.getRatingDistribution(productId),
  });

  const addReview = useMutation({
    mutationFn: (payload) => productsApi.addReview(productId, payload),
    onSuccess: () => {
      toast.success('Review submitted');
      reset();
      queryClient.invalidateQueries({ queryKey: ['reviews', productId] });
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const reviews = data?.reviews || [];
  const rating = watch('rating');

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_1.3fr]">
      <div>
        <h3 className="mb-4 font-display text-2xl">Customer Reviews</h3>
        {distribution?.distribution?.map((row) => (
          <div key={row.star} className="mb-1.5 flex items-center gap-2 text-xs">
            <span className="w-10">{row.star} star</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-night-900/10">
              <div className="h-full bg-gold-400" style={{ width: `${row.percentage}%` }} />
            </div>
            <span className="w-8 text-right text-night-900/50">{row.count}</span>
          </div>
        ))}

        {isAuthenticated ? (
          <form onSubmit={handleSubmit((vals) => addReview.mutate(vals))} className="mt-6 space-y-3">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button type="button" key={n} onClick={() => setValue('rating', n)}>
                  <StarRating rating={n <= rating ? 5 : 0} size={20} />
                </button>
              ))}
            </div>
            <textarea
              {...register('comment', { required: 'Please share your experience' })}
              rows={3}
              placeholder="Write your review..."
              className="input-field"
            />
            {errors.comment && <p className="field-error">{errors.comment.message}</p>}
            <button type="submit" disabled={addReview.isPending} className="btn-primary">
              {addReview.isPending ? 'Submitting...' : 'Submit Review'}
            </button>
            <p className="text-xs text-night-900/50">
              Only verified buyers who have received this product can leave a review.
            </p>
          </form>
        ) : (
          <p className="mt-6 text-sm text-night-900/60">Please log in to write a review.</p>
        )}
      </div>

      <div className="space-y-6">
        {reviews.length === 0 && <p className="text-sm text-night-900/50">No reviews yet — be the first!</p>}
        {reviews.map((r) => (
          <div key={r._id} className="border-b border-night-900/10 pb-5">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-sm font-medium">{r.user?.name || 'Anonymous'}</span>
              <span className="text-xs text-night-900/40">{format(new Date(r.createdAt), 'dd MMM yyyy')}</span>
            </div>
            <StarRating rating={r.rating} size={13} />
            {r.isVerifiedPurchase && (
              <span className="ml-2 text-[10px] font-medium uppercase tracking-wide text-gold-600">Verified Purchase</span>
            )}
            <p className="mt-2 text-sm text-night-900/75">{r.comment}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
