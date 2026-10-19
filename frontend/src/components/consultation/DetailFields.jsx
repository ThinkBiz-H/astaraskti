// Each component below registers exactly the fields the backend's
// createBookingValidator expects for that service type (see
// validators/consultation.validator.js on the backend), nested under the
// matching key: horoscopeDetails / gemstoneDetails / vastuDetails.
//
// There is deliberately no KundliFields here — "kundli"-typed services
// redirect straight to the Premium Kundli purchase flow (see
// pages/kundli/PremiumKundliPage.jsx) before this appointment-booking form
// is ever reached; a live-astrologer consultation's scheduling fields
// don't apply to an instant AI-generated PDF purchase.

export function HoroscopeFields({ register }) {
  return (
    <>
      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <legend className="col-span-full mb-1 text-sm font-semibold uppercase tracking-wide text-gold-600">Bride's Details</legend>
        <input {...register('horoscopeDetails.bride.name', { required: true })} placeholder="Bride's Name" className="input-field" />
        <input type="date" {...register('horoscopeDetails.bride.dob', { required: true })} className="input-field" />
        <input type="time" {...register('horoscopeDetails.bride.birthTime', { required: true })} className="input-field" />
        <input {...register('horoscopeDetails.bride.birthPlace', { required: true })} placeholder="Birth Place" className="input-field" />
      </fieldset>
      <fieldset className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <legend className="col-span-full mb-1 text-sm font-semibold uppercase tracking-wide text-gold-600">Groom's Details</legend>
        <input {...register('horoscopeDetails.groom.name', { required: true })} placeholder="Groom's Name" className="input-field" />
        <input type="date" {...register('horoscopeDetails.groom.dob', { required: true })} className="input-field" />
        <input type="time" {...register('horoscopeDetails.groom.birthTime', { required: true })} className="input-field" />
        <input {...register('horoscopeDetails.groom.birthPlace', { required: true })} placeholder="Birth Place" className="input-field" />
      </fieldset>
    </>
  );
}

export function GemstoneFields({ register }) {
  return (
    <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <legend className="col-span-full mb-1 text-sm font-semibold uppercase tracking-wide text-gold-600">Birth Details</legend>
      <div>
        <label className="label-field">Date of Birth</label>
        <input type="date" {...register('gemstoneDetails.dob', { required: true })} className="input-field" />
      </div>
      <div>
        <label className="label-field">Time of Birth</label>
        <input type="time" {...register('gemstoneDetails.birthTime', { required: true })} className="input-field" />
      </div>
      <div className="sm:col-span-2">
        <label className="label-field">Place of Birth</label>
        <input {...register('gemstoneDetails.birthPlace', { required: true })} className="input-field" />
      </div>
    </fieldset>
  );
}

export function VastuFields({ register }) {
  return (
    <fieldset className="grid grid-cols-1 gap-4">
      <legend className="mb-1 text-sm font-semibold uppercase tracking-wide text-gold-600">Property Details</legend>
      <div>
        <label className="label-field">Full Address</label>
        <textarea {...register('vastuDetails.fullAddress', { required: true })} rows={2} className="input-field" />
      </div>
      <div>
        <label className="label-field">Property Type</label>
        <select {...register('vastuDetails.propertyType', { required: true })} className="input-field">
          <option value="">Select</option>
          <option>Residential</option><option>Commercial</option><option>Plot</option><option>Other</option>
        </select>
      </div>
      <div>
        <label className="label-field">Problem Description</label>
        <textarea {...register('vastuDetails.problemDescription', { required: true })} rows={3} className="input-field" />
      </div>
      <div>
        <label className="label-field">Property Photos (optional)</label>
        <input type="file" accept="image/*" multiple {...register('vastuImages')} className="input-field" />
      </div>
    </fieldset>
  );
}
