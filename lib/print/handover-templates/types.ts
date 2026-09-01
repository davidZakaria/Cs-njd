export type HandoverTemplateKey =
  | "green-avenue"
  | "green-avenue-no-insurance"
  | "green-avenue-dual"
  | "green-avenue-dual-no-insurance"
  | "jura"
  | "jura-dual";

export type HandoverTemplateOptions = {
  insurance?: boolean;
  dualSignature?: boolean;
};

export type HandoverFieldValues = {
  clientName: string;
  clientName2?: string;
  nationality: string;
  nationalId: string;
  address: string;
  phone1: string;
  phone2: string;
  email: string;
  unitNumber: string;
  floor: string;
  building: string;
  area: string;
  areaInWords: string;
  handoverDate: string;
  contractDay: string;
  contractMonth: string;
  contractYear: string;
  issuedDayName: string;
  issuedDate: string;
  contractShortDate: string;
};

export type GreenAvenueTemplate = {
  kind: "green-avenue";
  header: string;
  section1: string;
  section2: string;
  declaration: string;
  violationsIntro: string;
  violationsBody: string;
  insurance: string | null;
  dual: boolean;
  withInsurance: boolean;
};

export type JuraTemplatePart = {
  key: string;
  text: string;
};

export type JuraTemplate = {
  kind: "jura";
  header: string;
  parts: JuraTemplatePart[];
  dual: boolean;
};

export type HandoverTemplateContent = GreenAvenueTemplate | JuraTemplate;

export type BilingualSection = {
  ar: string;
  en: string;
};

export type HandoverPrintPayload = {
  templateKey: HandoverTemplateKey;
  template: HandoverTemplateContent;
  fields: HandoverFieldValues;
  companyName: string;
  companyAddress: string;
  locale: string;
};

export type GreenAvenueEnglish = {
  headerTitle: string;
  headerSubtitle: string;
  section1Title: string;
  section2Title: string;
  declarationTitle: string;
  declaration: string;
  violationsIntro: string;
  violationsBody: string;
  insurance: string | null;
  recipientLabels: {
    name: string;
    nationality: string;
    nationalId: string;
    address: string;
    phone1: string;
    phone2: string;
    email: string;
  };
  unitLine: string;
  signatures: {
    client: string;
    client2?: string;
    company: string;
    date: string;
  };
};

export type JuraEnglish = {
  headerTitle: string;
  headerSubtitle: string;
  headerDateLine: string;
  parts: { key: string; title: string; text: string }[];
  recipientLabels: GreenAvenueEnglish["recipientLabels"];
  signatures: GreenAvenueEnglish["signatures"];
};
