import { MapPin, Pencil, Phone } from 'lucide-react';

export function ShippingAddressCard({ order }) {
  const addr = order.shippingAddress || {};
  return (
    <div className="card space-y-3 p-6">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-night-900/60">
          <MapPin size={15} /> Shipping Address
        </h2>
        {/* No post-order address-edit capability exists anywhere in this
            system — shown disabled rather than a working-looking icon. */}
        <span title="Address can't be edited after ordering" className="cursor-not-allowed text-night-900/20">
          <Pencil size={14} />
        </span>
      </div>
      <div className="text-sm text-night-900/70">
        <p className="font-medium text-night-900">{addr.fullName}</p>
        {addr.mobile && (
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-night-900/50"><Phone size={11} /> {addr.mobile}</p>
        )}
        <p className="mt-2">
          {addr.addressLine1}
          {addr.addressLine2 ? `, ${addr.addressLine2}` : ''}
        </p>
        <p>{addr.city}, {addr.state} {addr.pincode}</p>
        <p>{addr.country}</p>
      </div>
    </div>
  );
}
