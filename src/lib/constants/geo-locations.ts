/**
 * INVENTRA – Indian Geographic Masters & Defaults
 * Headquartered in Chennai, Tamil Nadu (State Code: 33)
 */

export interface IndianState {
  name: string;
  code: string;
  isUnionTerritory?: boolean;
}

export const INDIAN_STATES: IndianState[] = [
  // Primary operational state first
  { name: "Tamil Nadu", code: "33" },
  { name: "Karnataka", code: "29" },
  { name: "Andhra Pradesh", code: "37" },
  { name: "Kerala", code: "32" },
  { name: "Telangana", code: "36" },
  { name: "Puducherry", code: "34", isUnionTerritory: true },
  { name: "Maharashtra", code: "27" },
  { name: "Delhi", code: "07", isUnionTerritory: true },
  { name: "Gujarat", code: "24" },
  { name: "Uttar Pradesh", code: "09" },
  { name: "West Bengal", code: "19" },
  { name: "Rajasthan", code: "08" },
  { name: "Madhya Pradesh", code: "23" },
  { name: "Bihar", code: "10" },
  { name: "Punjab", code: "03" },
  { name: "Haryana", code: "06" },
  { name: "Odisha", code: "21" },
  { name: "Assam", code: "18" },
  { name: "Jharkhand", code: "20" },
  { name: "Chhattisgarh", code: "22" },
  { name: "Uttarakhand", code: "05" },
  { name: "Goa", code: "30" },
  { name: "Himachal Pradesh", code: "02" },
  { name: "Jammu and Kashmir", code: "01", isUnionTerritory: true },
  { name: "Chandigarh", code: "04", isUnionTerritory: true },
  { name: "Tripura", code: "16" },
  { name: "Meghalaya", code: "17" },
  { name: "Manipur", code: "14" },
  { name: "Nagaland", code: "13" },
  { name: "Mizoram", code: "15" },
  { name: "Arunachal Pradesh", code: "12" },
  { name: "Sikkim", code: "11" },
  { name: "Ladakh", code: "38", isUnionTerritory: true },
  { name: "Andaman and Nicobar Islands", code: "35", isUnionTerritory: true },
  { name: "Dadra and Nagar Haveli and Daman and Diu", code: "26", isUnionTerritory: true },
  { name: "Lakshadweep", code: "31", isUnionTerritory: true },
];

export const DEFAULT_STATE = "Tamil Nadu";
export const DEFAULT_STATE_CODE = "33";
export const DEFAULT_CITY = "Chennai";
export const DEFAULT_DISTRICT = "Chennai";
export const DEFAULT_PIN_CODE = "600001";
export const CHENNAI_DEFAULT_LAT = 13.0827;
export const CHENNAI_DEFAULT_LNG = 80.2707;

export const POPULAR_CITIES_BY_STATE: Record<string, string[]> = {
  "Tamil Nadu": [
    "Chennai",
    "Coimbatore",
    "Madurai",
    "Tiruchirappalli",
    "Salem",
    "Tiruppur",
    "Erode",
    "Tirunelveli",
    "Vellore",
    "Thoothukudi",
    "Dindigul",
    "Thanjavur",
    "Kanchipuram",
    "Chengalpattu",
    "Tambaram",
    "Avadi",
    "Hosur",
    "Nagercoil",
    "Cuddalore",
    "Kumbakonam",
    "Tiruvannamalai",
    "Poonamallee",
    "Ambattur",
    "Guindy",
    "Sriperumbudur",
    "Maraimalai Nagar",
    "Ranipet",
    "Karur",
    "Pudukkottai",
    "Nagapattinam",
    "Villupuram",
  ],
  Karnataka: [
    "Bengaluru",
    "Mysuru",
    "Hubballi-Dharwad",
    "Mangaluru",
    "Belagavi",
    "Davanagere",
    "Ballari",
    "Shivamogga",
    "Tumakuru",
    "Udupi",
    "Hosapete",
  ],
  "Andhra Pradesh": [
    "Visakhapatnam",
    "Vijayawada",
    "Guntur",
    "Nellore",
    "Kurnool",
    "Tirupati",
    "Kakinada",
    "Rajamahendravaram",
    "Kadapa",
    "Anantapur",
  ],
  Telangana: [
    "Hyderabad",
    "Warangal",
    "Nizamabad",
    "Khammam",
    "Karimnagar",
    "Ramagundam",
    "Mahbubnagar",
  ],
  Kerala: [
    "Kochi",
    "Thiruvananthapuram",
    "Kozhikode",
    "Thrissur",
    "Kollam",
    "Palakkad",
    "Alappuzha",
    "Kannur",
    "Kottayam",
  ],
  Puducherry: [
    "Puducherry",
    "Karaikal",
    "Ozhukarai",
    "Yanam",
    "Mahe",
  ],
  Maharashtra: [
    "Mumbai",
    "Pune",
    "Nagpur",
    "Thane",
    "Nashik",
    "Navi Mumbai",
    "Aurangabad",
    "Kolhapur",
    "Solapur",
  ],
  Delhi: [
    "New Delhi",
    "Central Delhi",
    "North Delhi",
    "South Delhi",
    "East Delhi",
    "West Delhi",
  ],
};

/**
 * Returns the GST state code for a given state name or variations.
 */
export function getStateCode(stateName: string): string {
  if (!stateName) return DEFAULT_STATE_CODE;
  const normalized = stateName.toLowerCase().replace(/[\s_-]+/g, "");

  const match = INDIAN_STATES.find(
    (s) => s.name.toLowerCase().replace(/[\s_-]+/g, "") === normalized
  );

  return match ? match.code : DEFAULT_STATE_CODE;
}

/**
 * Returns the standardized state name given an input string or GST code.
 */
export function getStandardStateName(input: string): string {
  if (!input) return DEFAULT_STATE;
  const clean = input.trim();

  // If numeric GST code
  const byCode = INDIAN_STATES.find((s) => s.code === clean);
  if (byCode) return byCode.name;

  const normalized = clean.toLowerCase().replace(/[\s_-]+/g, "");
  const byName = INDIAN_STATES.find(
    (s) => s.name.toLowerCase().replace(/[\s_-]+/g, "") === normalized
  );

  return byName ? byName.name : clean;
}

/**
 * Returns list of cities for a given state, falling back to Chennai & major metros.
 */
export function getCitiesForState(stateName?: string): string[] {
  const stdState = stateName ? getStandardStateName(stateName) : DEFAULT_STATE;
  if (POPULAR_CITIES_BY_STATE[stdState]) {
    return POPULAR_CITIES_BY_STATE[stdState];
  }

  // If state not in dictionary, return combined list of popular Indian cities with Chennai first
  return [
    ...POPULAR_CITIES_BY_STATE["Tamil Nadu"],
    "Bengaluru",
    "Hyderabad",
    "Mumbai",
    "New Delhi",
    "Kochi",
    "Vijayawada",
  ];
}
