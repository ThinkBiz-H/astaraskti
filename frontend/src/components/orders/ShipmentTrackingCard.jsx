import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Truck, ExternalLink, RefreshCw } from 'lucide-react';
import { ordersApi } from '@/api/endpoints/orders';
import { formatDate } from '@/utils/format';
import { getDeliveryEstimate } from '@/utils/deliveryEstimate';

/**
 * Shows order.tracking/order.courier (always available) plus, when
 * Shiprocket is enabled and an AWB exists, live checkpoints from
 * GET /orders/:id/track (ordersApi.track) — an existing endpoint that was
 * defined client-side but never actually called anywhere before this.
 */
export function ShipmentTrackingCard({ order, enabled }) {
  const [manualRefresh, setManualRefresh] = useState(0);
  const hasShipment = Boolean(order.courier?.courierName || order.tracking?.number || order.shiprocket?.awbCode);

  const { data: liveData, isFetching, refetch } = useQuery({
    queryKey: ['order-track', order._id, manualRefresh],
    queryFn: () => ordersApi.track(order._id),
    enabled: enabled && hasShipment,
    staleTime: 30_000,
  });

  if (!hasShipment) return null;

  const checkpoints = liveData?.live?.checkpoints || [];
  const latestCheckpoint = checkpoints[checkpoints.length - 1];
  const currentLocation = latestCheckpoint?.location || latestCheckpoint?.[' location'] || null;
  const estimate = getDeliveryEstimate(order.tracking?.estimatedDeliveryDate, order.orderStatus);

  return (
    <div className="card space-y-4 p-6">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-night-900/60">
          <Truck size={15} /> Shipment
        </h2>
        <button
          onClick={() => { setManualRefresh((n) => n + 1); refetch(); }}
          disabled={isFetching}
          className="flex items-center gap-1 text-xs text-gold-600"
        >
          <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} /> Track Shipment
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-3">
        <div>
          <p className="text-xs text-night-900/50">Courier</p>
          <p className="font-medium">{order.courier?.courierName || order.courier?.partner || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-night-900/50">AWB / Tracking No.</p>
          <p className="font-medium">{order.shiprocket?.awbCode || order.tracking?.number || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-night-900/50">Status</p>
          <p className="font-medium">{liveData?.live?.currentStatus || order.tracking?.shipmentStatus || 'Not Shipped'}</p>
        </div>
        {currentLocation && (
          <div>
            <p className="text-xs text-night-900/50">Current Location</p>
            <p className="font-medium">{currentLocation}</p>
          </div>
        )}
        <div>
          <p className="text-xs text-night-900/50">Estimated Delivery</p>
          <p className="font-medium">
            {order.tracking?.estimatedDeliveryDate
              ? formatDate(order.tracking.estimatedDeliveryDate, { day: '2-digit', month: 'short', year: 'numeric' })
              : '—'}
          </p>
        </div>
        {estimate && (
          <div>
            <p className="text-xs text-night-900/50">Delivery</p>
            <p className={`font-medium ${estimate.delayed ? 'text-red-600' : 'text-green-700'}`}>{estimate.label}</p>
          </div>
        )}
      </div>

      {order.tracking?.url && (
        <a href={order.tracking.url} target="_blank" rel="noreferrer" className="btn-outline inline-flex items-center gap-1.5 text-sm">
          Track on Courier Site <ExternalLink size={13} />
        </a>
      )}

      {checkpoints.length > 0 && (
        <div className="border-t border-night-900/10 pt-3">
          <p className="mb-2 text-xs font-medium text-night-900/50">Courier Checkpoints</p>
          <div className="max-h-40 space-y-1.5 overflow-y-auto text-xs">
            {[...checkpoints].reverse().map((cp, i) => (
              <div key={i} className="flex justify-between gap-2 text-night-900/60">
                <span>{cp.activity || cp.status || '—'}{cp.location ? ` — ${cp.location}` : ''}</span>
                <span className="shrink-0 text-night-900/40">{cp.date || ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
