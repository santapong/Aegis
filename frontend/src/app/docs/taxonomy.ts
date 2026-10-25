export const docCategories = [
  { id:"start", label:"Start with clarity", description:"Your first steps, the money model, and making Aegis feel like home.", icon:"compass" },
  { id:"everyday", label:"Everyday money", description:"Records, budgets, goals, trips, and the bigger picture.", icon:"wallet" },
  { id:"planning", label:"Plan ahead", description:"Cash workspaces, upcoming dates, scenarios, and business review.", icon:"calendar" },
  { id:"connections", label:"AI & connections", description:"Optional insights, LINE capture, and the local MCP server.", icon:"sparkles" },
  { id:"ownership", label:"Your data & control", description:"Privacy, exports, self-hosting, and keeping a recoverable copy.", icon:"shield" },
  { id:"developers", label:"Build & integrate", description:"Local setup, the API, architecture, and machine-readable docs.", icon:"code" },
] as const;
export type DocCategoryId = typeof docCategories[number]["id"];
export const legacyCategory:Record<string,DocCategoryId>={"first-steps":"start",transactions:"everyday",budgets:"everyday",plans:"planning","cash-planning":"planning",ai:"connections",exports:"ownership","local-setup":"developers",api:"developers",architecture:"developers"};
