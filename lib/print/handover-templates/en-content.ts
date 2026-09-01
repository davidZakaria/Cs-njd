import type { GreenAvenueEnglish, JuraEnglish } from "./types";

const recipientLabels = {
  name: "Name",
  nationality: "Nationality",
  nationalId: "National ID / Passport",
  address: "Address",
  phone1: "Phone 1",
  phone2: "Phone 2",
  email: "Email",
};

export function getGreenAvenueEnglish(
  withInsurance: boolean,
  dual: boolean
): GreenAvenueEnglish {
  return {
    headerTitle: "Residential Unit Handover Protocol",
    headerSubtitle: "Green Avenue Project — New Administrative Capital",
    section1Title: "First — Recipient details",
    section2Title: "Second — Unit details",
    declarationTitle: "Declaration",
    recipientLabels,
    unitLine:
      "Residential unit no. ({unitNumber}) on floor ({floor}), building ({building}), with an area of ({area}) square metres only, in Green Avenue project on land plot no. (N6) in zone (R7), New Administrative Capital.",
    declaration: `I, the undersigned, holder of national ID no. {nationalId}, acknowledge that I have received from New Jersey for Real Estate Development the above-mentioned unit on {handoverDate}, in accordance with the specifications agreed in the sale contract dated day ({contractDay}) of ({contractMonth}) ({contractYear}), and I acknowledge that the unit is in my possession and I am fully responsible for it, that it conforms to the specifications and conditions agreed in the said sale contract, and I acknowledge my knowledge and approval of the loading ratio or common parts charged to the said unit and accept it in its current condition. I also waive all my rights regarding the delivery dates stated in the sale contract dated day ({contractDay}) of ({contractMonth}) ({contractYear}), undertake not to violate licensing conditions and bear full responsibility, undertake to preserve the property containing this unit and the unit subject of this protocol, implement all instructions of the seller or its legal representative or the management company, undertake not to join the owners' association, authorize the seller or its contractor to perform all owners' association competencies, powers and responsibilities, agree to transfer maintenance deposit proceeds to the management company contracted by the seller, and undertake to pay maintenance differentials if requested. I acknowledge the unit is delivered without utilities (electricity, water, natural gas, telephones, etc.). The second party shall assist the first party in completing utility connection procedures after delivery of residential district (R7) by the New Administrative Capital Company upon completion of electricity networks for district and plot (N6) in zone (R7). The second party bears all expenses determined by the first party for the unit. This protocol forms an integral part of the sale contract dated day ({contractDay}) of ({contractMonth}) ({contractYear}). I have inspected the received unit with full inspection excluding ignorance legally and religiously, accept its area, specifications and location, and may not claim against the seller now or in the future in this regard. This protocol is not a title deed; ownership passes only after full payment of agreed financial obligations. I acknowledge payment of the unit's share of utility meter costs as determined by the company. I may not dispose of, mortgage or assign the unit until full price is paid and written seller approval is obtained. I undertake to complete finishing within six (6) months from this protocol at maximum; otherwise I bear full legal responsibility and a delay penalty of 7% of unit value per month.`,
    violationsIntro: "Violations leading to contract termination",
    violationsBody: `Upon handover, the buyer undertakes: not to make internal modifications or change bathroom/kitchen locations without prior written seller approval; modifications subject to management and seller approval; not to change external paint of walls, balconies and windows; not to install AC or laundry lines on facades; not to use the unit for flammable/explosive storage; not to build on vacant areas, side walls or roofs; not to alter garden/roof if entitled to use; not to disturb neighbours or public order; maintain public services; not install roof water tank/motor; not change building footprint or facade colours; not tile facades; not modify AC locations; not install window/grille protection; not build garden walls contrary to standards; garden gate wood only; no marble garden columns; no terrace stair modifications; one garden entrance only; no iron fence only; no planting beds at garden door; no fence lighting; no extending interlock/landscape into garden; no merging balconies; no external drainage changes without approval; no laundry on reception balcony; no gypsum on balconies; no unit door change; no iron door; coordinate extra dish with engineering; remove construction waste within 24 hours; no storage outside unit over 48 hours; beige canvas awning for ground floor only with licence; no extra bathroom; no wall breaking without engineering approval; beige bamboo blinds shade 1013 on windows/doors only; no flammable materials on balconies/ground garden; no modifications without written company approval. All listed violations are examples; the recipient bears diligent-person responsibility. Violations shall be removed at buyer expense; any breach terminates the contract automatically without notice or court judgment.`,
    insurance: withInsurance
      ? "If the buyer wishes to make internal modifications with seller and management approval, the buyer shall pay a works insurance deposit to the management company. If finishing by the buyer, a deposit of 5% of total price, minimum EGP 100,000 (works insurance cheque), finishing within six months; delay penalty 7% of total unit price; full refund only upon compliance."
      : null,
    signatures: {
      client: dual ? "First buyer signature" : "Buyer signature",
      client2: dual ? "Second buyer signature" : undefined,
      company: "Company representative",
      date: "Date",
    },
  };
}

export function getJuraEnglish(dual: boolean): JuraEnglish {
  return {
    headerTitle: "Tourism Unit Handover Protocol",
    headerSubtitle: "Jura Village Project — Galala, Ain Sokhna",
    headerDateLine: "On this day: ({issuedDayName}) corresponding to ({issuedDate})",
    recipientLabels,
    parts: [
      {
        key: "intro",
        title: "First — Declaration",
        text: dual
          ? "1- I, {clientName}, nationality {nationality}, ID/passport {nationalId}, residing at {address}, phone {phone1}, email {email}. 2- I, {clientName2}, same details. We inspected the unit with full inspection excluding ignorance, found it conforming to agreed specifications with no reservations. Unit no. {unitNumber}, building {building}, floor {floor}, fully finished, received per sale contract dated day ({contractDay}) of ({contractMonth}) ({contractYear}). Unit is in our possession; we waive compensation claims for delivery dates; undertake licensing compliance and property preservation."
          : "I, {clientName}, nationality {nationality}, ID/passport {nationalId}, residing at {address}, phone {phone1}, email {email}, inspected the unit with full inspection excluding ignorance, found it conforming to agreed specifications with no reservations. Unit no. {unitNumber}, building {building}, floor {floor}, fully finished, received per sale contract dated day ({contractDay}) of ({contractMonth}) ({contractYear}). Unit is in my possession; I waive compensation claims for delivery dates; undertake licensing compliance and property preservation.",
      },
      {
        key: "second",
        title: "Second — Utilities and meters",
        text: "I acknowledge payment of meter costs (electricity, gas, water, sewage, telephones, Smart City, etc.) as determined by the company, all consumption bills from this protocol date, meter installation fees to authorities or Jura Real Estate Development, and all seller/management instructions and administrative fees.",
      },
      {
        key: "third",
        title: "Third — Maintenance deposit and differentials",
        text: "I agree to pay annual maintenance differentials estimated by seller/management for inflation and service costs (security, cleaning, landscape, pools, elevators, etc.), not to join owners' association, authorize seller's contractor for association duties, agree to transfer deposit proceeds to management company, and pay differentials when requested. Payment is essential for services and entry permits; village management may take legal action or suspend services for late payment.",
      },
      {
        key: "fourth",
        title: "Fourth — Entry, exit and general rules",
        text: "I comply with all seller/management entry/exit instructions for persons and workers, obtain prior permits for interior works or building materials, shall not modify external facades or structure, and comply with beach, pool and public area rules, operating hours, and smart car stickers/fees.",
      },
      {
        key: "fifth",
        title: "Fifth — Visitors and pets",
        text: "Visitors: notify management at least two hours in advance with names and car numbers; responsible for visitor conduct; comply with beach/pool rules and swimwear; no litter in sea. Pets: allowed with management permit; leash and muzzle rules; immediate waste disposal; pets prohibited in pool areas and beaches.",
      },
      {
        key: "sixth",
        title: "Sixth — Fines and violations",
        text: "Management may impose immediate fines for visitor, pet or quiet-hour violations after written/email warning; no further visitors until fines and maintenance dues are paid.",
      },
      {
        key: "seventh",
        title: "Seventh — Renting to third parties",
        text: "Notify management 24–48 hours before tenants arrive with ID copies; entry permits required; owner jointly liable for tenant damage; tenants subject to facility rules; no commercial use without approval; optional management marketing contract available.",
      },
      {
        key: "tenth",
        title: "Tenth — Administrative eviction",
        text: "Management may terminate tenant stay immediately for public morality, disorder or safety breaches. This protocol is not a title deed; ownership after full payment; I undertake to pay all instalments per contract dated day ({contractDay}) of ({contractMonth}) ({contractYear}); integral part of sale contract dated {contractShortDate}.",
      },
    ],
    signatures: {
      client: dual ? "First owner signature" : "Owner signature",
      client2: dual ? "Second owner signature" : undefined,
      company: "Company representative",
      date: "Date",
    },
  };
}

export function fillEnglishPlaceholders(
  text: string,
  fields: Record<string, string>
): string {
  return text.replace(/\{(\w+)\}/g, (_, key: string) => fields[key] ?? "—");
}
