type PurposeCode = { code: string; name: string };

const PURPOSE_CODES: PurposeCode[] = [
  { code: "P0802", name: "Software Consultancy & Implementation" },
  { code: "P0803", name: "Database & Network Administration" },
  { code: "P0804", name: "Repair & Maintenance of Computer/Software" },
  { code: "P0807", name: "IT Services (Other)" },
  { code: "P0899", name: "Other Software & IT Services" },
  { code: "P0806", name: "Advertising, Market Research & Public Opinion" },
  { code: "P1007", name: "Other Professional & Technical Services" },
  { code: "P1006", name: "Other Business Services" },
  { code: "P0805", name: "Business & Management Consultancy" },
  { code: "P1003", name: "Research & Development Services" },
  { code: "P1004", name: "Architectural, Engineering & Other Technical Services" },
  { code: "P1201", name: "Educational Services" },
  { code: "P1202", name: "Health-Related & Medical Services" },
];

export default PURPOSE_CODES;
