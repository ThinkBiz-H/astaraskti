import { PageHeader } from '@/components/common/Elements';
import { Bell } from 'lucide-react';

// TODO(backend): No Newsletter Subscriber model or admin endpoints exist yet
// (no GET /admin/newsletter-subscribers, no CSV export). Placeholder until
// the backend adds this module.
export default function NewsletterPage() {
  return (
    <div>
      <PageHeader title="Newsletter Subscribers" />
      <div className="card flex flex-col items-center justify-center gap-3 py-20 text-center">
        <Bell size={36} className="text-night-900/20" />
        <p className="font-medium text-night-900/70">Not available yet</p>
        <p className="max-w-sm text-sm text-night-900/40">
          The backend has no newsletter subscriber storage or export endpoint. Add
          a <code className="rounded bg-night-900/5 px-1">Newsletter</code> model and
          a <code className="rounded bg-night-900/5 px-1">GET /admin/newsletter-subscribers?format=csv</code>{' '}
          endpoint, then wire this list + an "Export CSV" button the same way the Reports module works.
        </p>
      </div>
    </div>
  );
}
