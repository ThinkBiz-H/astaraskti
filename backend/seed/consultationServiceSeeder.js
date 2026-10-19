const ConsultationService = require("../models/ConsultationService");
const logger = require("../utils/logger");

const services = [
  {
    name: "Kundli Reading",
    type: "kundli",
    price: 999,
    duration: 30,
    description:
      "A detailed birth chart (Kundli) reading covering planetary positions, dashas, and life predictions.",
  },
  {
    name: "Horoscope Matching",
    type: "horoscope_matching",
    price: 1499,
    duration: 45,
    description:
      "Kundli milan / Guna matching for marriage compatibility between bride and groom.",
  },
  {
    name: "Gemstone Consultation",
    type: "gemstone",
    price: 799,
    duration: 20,
    description:
      "Personalised gemstone recommendation based on your birth chart to strengthen favourable planets.",
  },
  {
    name: "Vastu Consultation",
    type: "vastu",
    price: 1999,
    duration: 40,
    description:
      "Vastu Shastra review of your home or commercial property, with remedies for reported issues.",
  },
];

const seedConsultationServices = async () => {
  const created = [];
  for (const svc of services) {
    const existing = await ConsultationService.findOne({ name: svc.name });
    if (existing) {
      created.push(existing);
      continue;
    }
    created.push(await ConsultationService.create(svc));
  }
  logger.info(`${created.length} consultation services ensured`);
  return created;
};

module.exports = seedConsultationServices;
