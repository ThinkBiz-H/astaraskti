import { PageHeader } from '@/components/common/Elements';
import { Mail } from 'lucide-react';

// TODO(backend): No ContactEnquiry model or admin endpoints exist yet
// (no GET/DELETE /admin/enquiries, no reply mechanism). This screen is a
// placeholder until the backend adds a Contact Enquiries module — see
// pages/ContactPage.jsx on the storefront for the matching TODO on the
// submission side.
export default function EnquiriesPage() {
  return (
    <div>
      <PageHeader title="Contact Enquiries" />
      <div className="card flex flex-col items-center justify-center gap-3 py-20 text-center">
        <Mail size={36} className="text-night-900/20" />
        <p className="font-medium text-night-900/70">Not available yet</p>
        <p className="max-w-sm text-sm text-night-900/40">
          The backend doesn't have a Contact Enquiry model or API yet. Once
          endpoints like <code className="rounded bg-night-900/5 px-1">GET /admin/enquiries</code> and{' '}
          <code className="rounded bg-night-900/5 px-1">DELETE /admin/enquiries/:id</code> exist, this page is
          ready to be wired up the same way every other list page in this app is.
        </p>
      </div>
    </div>
  );
}
