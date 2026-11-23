/**
 * INVENTRA ERP - Indian PIN Code Geocoding & Distance Calculation Utility
 * Operating Business: AJAY ENTERPRISES
 * 
 * Provides:
 * 1. Offline centroid coordinate lookup for Indian postal PIN codes (6-digit exact, 3-digit district, 2-digit state).
 * 2. Great-circle Haversine distance with standard Indian road tortuosity factors (1.30x intra-city, 1.20x inter-city).
 * 3. Extraction of PIN codes from site addresses and location coordinates.
 * 4. Safe calculation for E-Way Bill statutory Part-A distance requirements.
 */

export interface GeoCoordinate {
  lat: number;
  lng: number;
  place?: string;
  state?: string;
}

export interface DistanceCalculationResult {
  distanceKm: number;
  fromLocation?: string;
  toLocation?: string;
  method: "GPS_COORDINATES" | "PINCODE_CENTROID" | "SAME_PINCODE" | "FALLBACK";
  straightLineKm?: number;
}

export interface CalculateDistanceOptions {
  fromPincode?: string | null;
  toPincode?: string | null;
  fromCoords?: { lat: number; lng: number } | null;
  toCoords?: { lat: number; lng: number } | null;
}

/**
 * High-precision exact 6-digit PIN code centroids for primary operational hubs.
 */
export const EXACT_PINCODE_CENTROIDS: Record<string, GeoCoordinate> = {
  // Chennai & Greater Chennai Suburbs (Primary Hub for AJAY ENTERPRISES)
  "600001": { lat: 13.0900, lng: 80.2885, place: "George Town / Parry's Corner", state: "Tamil Nadu" },
  "600002": { lat: 13.0642, lng: 80.2694, place: "Anna Salai / Mount Road", state: "Tamil Nadu" },
  "600004": { lat: 13.0336, lng: 80.2678, place: "Mylapore", state: "Tamil Nadu" },
  "600017": { lat: 13.0418, lng: 80.2341, place: "T. Nagar", state: "Tamil Nadu" },
  "600018": { lat: 13.0336, lng: 80.2520, place: "Alwarpet / Teynampet", state: "Tamil Nadu" },
  "600020": { lat: 13.0067, lng: 80.2570, place: "Adyar", state: "Tamil Nadu" },
  "600028": { lat: 13.0244, lng: 80.2605, place: "Mandaveli / RA Puram", state: "Tamil Nadu" },
  "600032": { lat: 13.0067, lng: 80.2036, place: "Guindy Industrial Estate", state: "Tamil Nadu" },
  "600034": { lat: 13.0569, lng: 80.2425, place: "Nungambakkam", state: "Tamil Nadu" },
  "600040": { lat: 13.0850, lng: 80.2101, place: "Anna Nagar West", state: "Tamil Nadu" },
  "600041": { lat: 12.9830, lng: 80.2594, place: "Thiruvanmiyur / ECR", state: "Tamil Nadu" },
  "600042": { lat: 12.9815, lng: 80.2180, place: "Velachery", state: "Tamil Nadu" },
  "600045": { lat: 12.9249, lng: 80.1000, place: "Tambaram", state: "Tamil Nadu" },
  "600058": { lat: 13.0983, lng: 80.1617, place: "Ambattur Industrial Estate", state: "Tamil Nadu" },
  "600077": { lat: 13.0722, lng: 80.1234, place: "Thiruverkadu / Poonamallee", state: "Tamil Nadu" },
  "600089": { lat: 13.0210, lng: 80.1770, place: "Ramapuram / Porur", state: "Tamil Nadu" },
  "600096": { lat: 12.9654, lng: 80.2461, place: "Perungudi / OMR", state: "Tamil Nadu" },
  "600097": { lat: 12.9352, lng: 80.2297, place: "Thoraipakkam / OMR", state: "Tamil Nadu" },
  "600100": { lat: 12.9185, lng: 80.1915, place: "Medavakkam", state: "Tamil Nadu" },
  "600107": { lat: 13.0694, lng: 80.1948, place: "Koyambedu / Peenya Yard", state: "Tamil Nadu" },
  "600119": { lat: 12.8996, lng: 80.2279, place: "Sholinganallur / OMR", state: "Tamil Nadu" },
  "602105": { lat: 12.9675, lng: 79.9416, place: "Sriperumbudur Industrial Hub", state: "Tamil Nadu" },
  "603001": { lat: 12.6921, lng: 79.9836, place: "Chengalpattu", state: "Tamil Nadu" },
  "603204": { lat: 12.7486, lng: 80.0125, place: "Maraimalai Nagar", state: "Tamil Nadu" },
  "631501": { lat: 12.8342, lng: 79.7036, place: "Kanchipuram", state: "Tamil Nadu" },
  "632001": { lat: 12.9165, lng: 79.1325, place: "Vellore", state: "Tamil Nadu" },
  "635109": { lat: 12.7409, lng: 77.8253, place: "Hosur Industrial Complex", state: "Tamil Nadu" },

  // Bengaluru Urban & Rural Operational Centers
  "560001": { lat: 12.9779, lng: 77.5952, place: "Bengaluru GPO / MG Road", state: "Karnataka" },
  "560002": { lat: 12.9654, lng: 77.5871, place: "City Market / Chickpet", state: "Karnataka" },
  "560004": { lat: 12.9431, lng: 77.5738, place: "Basavanagudi", state: "Karnataka" },
  "560011": { lat: 12.9250, lng: 77.5938, place: "Jayanagar", state: "Karnataka" },
  "560025": { lat: 12.9620, lng: 77.6080, place: "Richmond Town", state: "Karnataka" },
  "560034": { lat: 12.9279, lng: 77.6271, place: "Koramangala", state: "Karnataka" },
  "560035": { lat: 12.9102, lng: 77.6834, place: "Sarjapur Road / Carmelaram", state: "Karnataka" },
  "560037": { lat: 12.9563, lng: 77.7011, place: "Marathahalli", state: "Karnataka" },
  "560038": { lat: 12.9784, lng: 77.6408, place: "Indiranagar", state: "Karnataka" },
  "560058": { lat: 13.0285, lng: 77.5197, place: "Peenya Industrial Area 1st Stage", state: "Karnataka" },
  "560064": { lat: 13.1007, lng: 77.5963, place: "Yelahanka New Town", state: "Karnataka" },
  "560066": { lat: 12.9698, lng: 77.7500, place: "Whitefield / ITPL", state: "Karnataka" },
  "560068": { lat: 12.9063, lng: 77.6289, place: "Madiwala / Bommanahalli", state: "Karnataka" },
  "560076": { lat: 12.8885, lng: 77.6045, place: "BTM Layout 2nd Stage", state: "Karnataka" },
  "560078": { lat: 12.9077, lng: 77.5855, place: "JP Nagar", state: "Karnataka" },
  "560085": { lat: 12.9238, lng: 77.5458, place: "Banashankari 3rd Stage", state: "Karnataka" },
  "560092": { lat: 13.0358, lng: 77.5970, place: "Hebbal", state: "Karnataka" },
  "560100": { lat: 12.8452, lng: 77.6602, place: "Electronic City Phase 1", state: "Karnataka" },
  "560102": { lat: 12.9116, lng: 77.6389, place: "HSR Layout", state: "Karnataka" },
  "560103": { lat: 12.9345, lng: 77.6912, place: "Bellandur / Outer Ring Road", state: "Karnataka" },
};

/**
 * 3-Digit Postal Sorting District Centroids covering all major districts.
 */
export const DISTRICT_3DIGIT_CENTROIDS: Record<string, GeoCoordinate> = {
  // Tamil Nadu (600 - 643)
  "600": { lat: 13.0827, lng: 80.2707, place: "Chennai District", state: "Tamil Nadu" },
  "601": { lat: 13.1438, lng: 79.9077, place: "Tiruvallur District", state: "Tamil Nadu" },
  "602": { lat: 12.9675, lng: 79.9416, place: "Sriperumbudur / Kanchipuram North", state: "Tamil Nadu" },
  "603": { lat: 12.6921, lng: 79.9836, place: "Chengalpattu District", state: "Tamil Nadu" },
  "604": { lat: 12.2286, lng: 79.6500, place: "Tindivanam / Villupuram", state: "Tamil Nadu" },
  "605": { lat: 11.9416, lng: 79.8083, place: "Puducherry / Cuddalore North", state: "Puducherry" },
  "606": { lat: 12.2253, lng: 79.0747, place: "Tiruvannamalai District", state: "Tamil Nadu" },
  "607": { lat: 11.7480, lng: 79.7714, place: "Cuddalore / Neyveli", state: "Tamil Nadu" },
  "608": { lat: 11.3992, lng: 79.6936, place: "Chidambaram", state: "Tamil Nadu" },
  "609": { lat: 11.1018, lng: 79.6522, place: "Mayiladuthurai", state: "Tamil Nadu" },
  "610": { lat: 10.7725, lng: 79.6365, place: "Tiruvarur District", state: "Tamil Nadu" },
  "611": { lat: 10.7672, lng: 79.8449, place: "Nagapattinam District", state: "Tamil Nadu" },
  "612": { lat: 10.9602, lng: 79.3845, place: "Kumbakonam", state: "Tamil Nadu" },
  "613": { lat: 10.7870, lng: 79.1378, place: "Thanjavur District", state: "Tamil Nadu" },
  "614": { lat: 10.4285, lng: 79.3175, place: "Pattukkottai", state: "Tamil Nadu" },
  "620": { lat: 10.7905, lng: 78.7047, place: "Tiruchirappalli (Trichy) City", state: "Tamil Nadu" },
  "621": { lat: 10.8700, lng: 78.8200, place: "Trichy Rural / Ariyalur", state: "Tamil Nadu" },
  "622": { lat: 10.3797, lng: 78.8208, place: "Pudukkottai District", state: "Tamil Nadu" },
  "623": { lat: 9.3639, lng: 78.8395, place: "Ramanathapuram District", state: "Tamil Nadu" },
  "624": { lat: 10.3673, lng: 77.9803, place: "Dindigul District", state: "Tamil Nadu" },
  "625": { lat: 9.9252, lng: 78.1198, place: "Madurai District", state: "Tamil Nadu" },
  "626": { lat: 9.5680, lng: 77.9624, place: "Virudhunagar / Sivakasi", state: "Tamil Nadu" },
  "627": { lat: 8.7139, lng: 77.7567, place: "Tirunelveli District", state: "Tamil Nadu" },
  "628": { lat: 8.7642, lng: 78.1348, place: "Thoothukudi (Tuticorin)", state: "Tamil Nadu" },
  "629": { lat: 8.1833, lng: 77.4119, place: "Nagercoil / Kanyakumari", state: "Tamil Nadu" },
  "630": { lat: 10.0735, lng: 78.7732, place: "Karaikudi / Sivaganga", state: "Tamil Nadu" },
  "631": { lat: 13.0784, lng: 79.6685, place: "Arakkonam / Ranipet", state: "Tamil Nadu" },
  "632": { lat: 12.9165, lng: 79.1325, place: "Vellore District", state: "Tamil Nadu" },
  "635": { lat: 12.5186, lng: 78.2137, place: "Krishnagiri / Hosur", state: "Tamil Nadu" },
  "636": { lat: 11.6643, lng: 78.1460, place: "Salem District", state: "Tamil Nadu" },
  "637": { lat: 11.2189, lng: 78.1674, place: "Namakkal / Tiruchengode", state: "Tamil Nadu" },
  "638": { lat: 11.3410, lng: 77.7172, place: "Erode District", state: "Tamil Nadu" },
  "639": { lat: 10.9601, lng: 78.0766, place: "Karur District", state: "Tamil Nadu" },
  "641": { lat: 11.0168, lng: 76.9558, place: "Coimbatore City & East", state: "Tamil Nadu" },
  "642": { lat: 10.6580, lng: 77.0080, place: "Pollachi / Coimbatore South", state: "Tamil Nadu" },
  "643": { lat: 11.4102, lng: 76.6950, place: "Ooty / Nilgiris", state: "Tamil Nadu" },

  // Karnataka (560 - 591)
  "560": { lat: 12.9716, lng: 77.5946, place: "Bengaluru Urban", state: "Karnataka" },
  "561": { lat: 13.4325, lng: 77.7275, place: "Chikkaballapur District", state: "Karnataka" },
  "562": { lat: 13.1667, lng: 77.5333, place: "Bengaluru Rural / Doddaballapur", state: "Karnataka" },
  "563": { lat: 13.1378, lng: 78.1291, place: "Kolar / KGF", state: "Karnataka" },
  "570": { lat: 12.2958, lng: 76.6394, place: "Mysuru (Mysore) City", state: "Karnataka" },
  "571": { lat: 12.5218, lng: 76.8951, place: "Mandya / Chamarajanagar", state: "Karnataka" },
  "572": { lat: 13.3409, lng: 77.1006, place: "Tumakuru (Tumkur)", state: "Karnataka" },
  "573": { lat: 13.0033, lng: 76.1004, place: "Hassan District", state: "Karnataka" },
  "574": { lat: 13.0000, lng: 74.9000, place: "Dakshina Kannada Rural", state: "Karnataka" },
  "575": { lat: 12.9141, lng: 74.8560, place: "Mangaluru (Mangalore)", state: "Karnataka" },
  "576": { lat: 13.3409, lng: 74.7421, place: "Udupi District", state: "Karnataka" },
  "577": { lat: 13.9299, lng: 75.5681, place: "Shivamogga / Davanagere", state: "Karnataka" },
  "580": { lat: 15.3647, lng: 75.1240, place: "Hubballi-Dharwad", state: "Karnataka" },
  "581": { lat: 14.8185, lng: 74.1332, place: "Uttara Kannada / Karwar", state: "Karnataka" },
  "582": { lat: 15.4167, lng: 75.6333, place: "Gadag District", state: "Karnataka" },
  "583": { lat: 15.1394, lng: 76.9214, place: "Ballari / Hosapete", state: "Karnataka" },
  "584": { lat: 16.2076, lng: 77.3463, place: "Raichur District", state: "Karnataka" },
  "585": { lat: 17.3297, lng: 76.8343, place: "Kalaburagi (Gulbarga)", state: "Karnataka" },
  "586": { lat: 16.8302, lng: 75.7100, place: "Vijayapura (Bijapur)", state: "Karnataka" },
  "587": { lat: 16.1691, lng: 75.6615, place: "Bagalkote District", state: "Karnataka" },
  "590": { lat: 15.8497, lng: 74.4977, place: "Belagavi (Belgaum) City", state: "Karnataka" },
  "591": { lat: 16.1667, lng: 74.8333, place: "Belagavi Rural / Chikkodi", state: "Karnataka" },

  // Andhra Pradesh & Telangana (500 - 535)
  "500": { lat: 17.3850, lng: 78.4867, place: "Hyderabad / Secunderabad", state: "Telangana" },
  "501": { lat: 17.3000, lng: 78.6000, place: "Rangareddy District", state: "Telangana" },
  "502": { lat: 17.6200, lng: 78.0800, place: "Medak / Sangareddy", state: "Telangana" },
  "503": { lat: 18.6725, lng: 78.0941, place: "Nizamabad District", state: "Telangana" },
  "505": { lat: 18.4386, lng: 79.1288, place: "Karimnagar District", state: "Telangana" },
  "506": { lat: 17.9689, lng: 79.5941, place: "Warangal District", state: "Telangana" },
  "507": { lat: 17.2473, lng: 80.1514, place: "Khammam District", state: "Telangana" },
  "509": { lat: 16.7488, lng: 77.9866, place: "Mahbubnagar District", state: "Telangana" },
  "515": { lat: 14.6819, lng: 77.6006, place: "Anantapur District", state: "Andhra Pradesh" },
  "516": { lat: 14.4673, lng: 78.8242, place: "Kadapa (Cuddapah)", state: "Andhra Pradesh" },
  "517": { lat: 13.6288, lng: 79.4192, place: "Tirupati / Chittoor", state: "Andhra Pradesh" },
  "518": { lat: 15.8281, lng: 78.0373, place: "Kurnool District", state: "Andhra Pradesh" },
  "520": { lat: 16.5062, lng: 80.6480, place: "Vijayawada City", state: "Andhra Pradesh" },
  "521": { lat: 16.1800, lng: 81.1300, place: "Krishna District Rural", state: "Andhra Pradesh" },
  "522": { lat: 16.3067, lng: 80.4365, place: "Guntur District", state: "Andhra Pradesh" },
  "524": { lat: 14.4426, lng: 79.9865, place: "Nellore District", state: "Andhra Pradesh" },
  "530": { lat: 17.6868, lng: 83.2185, place: "Visakhapatnam (Vizag)", state: "Andhra Pradesh" },
  "533": { lat: 16.9891, lng: 82.2475, place: "Kakinada / East Godavari", state: "Andhra Pradesh" },
  "534": { lat: 16.7107, lng: 81.0952, place: "Eluru / West Godavari", state: "Andhra Pradesh" },

  // Kerala (670 - 695)
  "670": { lat: 11.8745, lng: 75.3704, place: "Kannur District", state: "Kerala" },
  "671": { lat: 12.5102, lng: 74.9852, place: "Kasaragod District", state: "Kerala" },
  "673": { lat: 11.2588, lng: 75.7804, place: "Kozhikode (Calicut)", state: "Kerala" },
  "676": { lat: 11.0732, lng: 76.0740, place: "Malappuram District", state: "Kerala" },
  "678": { lat: 10.7867, lng: 76.6548, place: "Palakkad District", state: "Kerala" },
  "680": { lat: 10.5276, lng: 76.2144, place: "Thrissur District", state: "Kerala" },
  "682": { lat: 9.9312, lng: 76.2673, place: "Kochi / Ernakulam", state: "Kerala" },
  "686": { lat: 9.5916, lng: 76.5222, place: "Kottayam District", state: "Kerala" },
  "688": { lat: 9.4981, lng: 76.3388, place: "Alappuzha (Alleppey)", state: "Kerala" },
  "691": { lat: 8.8932, lng: 76.6141, place: "Kollam (Quilon)", state: "Kerala" },
  "695": { lat: 8.5241, lng: 76.9366, place: "Thiruvananthapuram (Trivandrum)", state: "Kerala" },

  // Maharashtra & Goa (400 - 444)
  "400": { lat: 19.0760, lng: 72.8777, place: "Mumbai City / Suburban", state: "Maharashtra" },
  "401": { lat: 19.3919, lng: 72.8397, place: "Thane / Palghar", state: "Maharashtra" },
  "403": { lat: 15.4909, lng: 73.8278, place: "Goa (Panaji / Margao)", state: "Goa" },
  "410": { lat: 18.7537, lng: 73.4064, place: "Lonavala / Pune Rural", state: "Maharashtra" },
  "411": { lat: 18.5204, lng: 73.8567, place: "Pune City", state: "Maharashtra" },
  "414": { lat: 19.0948, lng: 74.7480, place: "Ahmednagar District", state: "Maharashtra" },
  "416": { lat: 16.7050, lng: 74.2433, place: "Kolhapur District", state: "Maharashtra" },
  "422": { lat: 19.9975, lng: 73.7898, place: "Nashik District", state: "Maharashtra" },
  "431": { lat: 19.8762, lng: 75.3433, place: "Chhatrapati Sambhajinagar (Aurangabad)", state: "Maharashtra" },
  "440": { lat: 21.1458, lng: 79.0882, place: "Nagpur District", state: "Maharashtra" },

  // North & Other Regions
  "110": { lat: 28.6139, lng: 77.2090, place: "Delhi NCR", state: "Delhi" },
  "121": { lat: 28.4089, lng: 77.3178, place: "Faridabad", state: "Haryana" },
  "122": { lat: 28.4595, lng: 77.0266, place: "Gurugram (Gurgaon)", state: "Haryana" },
  "141": { lat: 30.9010, lng: 75.8573, place: "Ludhiana", state: "Punjab" },
  "160": { lat: 30.7333, lng: 76.7794, place: "Chandigarh", state: "Chandigarh" },
  "201": { lat: 28.5355, lng: 77.3910, place: "Noida / Ghaziabad", state: "Uttar Pradesh" },
  "226": { lat: 26.8467, lng: 80.9462, place: "Lucknow", state: "Uttar Pradesh" },
  "302": { lat: 26.9124, lng: 75.7873, place: "Jaipur", state: "Rajasthan" },
  "380": { lat: 23.0225, lng: 72.5714, place: "Ahmedabad", state: "Gujarat" },
  "395": { lat: 21.1702, lng: 72.8311, place: "Surat", state: "Gujarat" },
  "700": { lat: 22.5726, lng: 88.3639, place: "Kolkata", state: "West Bengal" },
  "751": { lat: 20.2961, lng: 85.8245, place: "Bhubaneswar", state: "Odisha" },
  "800": { lat: 25.5941, lng: 85.1376, place: "Patna", state: "Bihar" },
};

/**
 * 2-Digit Postal Circle Fallbacks for every state in India.
 */
export const CIRCLE_2DIGIT_CENTROIDS: Record<string, GeoCoordinate> = {
  "11": { lat: 28.6139, lng: 77.2090, place: "Delhi Circle", state: "Delhi" },
  "12": { lat: 29.0588, lng: 76.0856, place: "Haryana Circle", state: "Haryana" },
  "13": { lat: 29.0588, lng: 76.0856, place: "Haryana Circle", state: "Haryana" },
  "14": { lat: 31.1471, lng: 75.3412, place: "Punjab Circle", state: "Punjab" },
  "15": { lat: 31.1471, lng: 75.3412, place: "Punjab Circle", state: "Punjab" },
  "16": { lat: 30.7333, lng: 76.7794, place: "Chandigarh Circle", state: "Chandigarh" },
  "17": { lat: 31.1048, lng: 77.1734, place: "Himachal Pradesh Circle", state: "Himachal Pradesh" },
  "18": { lat: 34.0837, lng: 74.7973, place: "Jammu & Kashmir Circle", state: "Jammu and Kashmir" },
  "19": { lat: 34.0837, lng: 74.7973, place: "Jammu & Kashmir Circle", state: "Jammu and Kashmir" },
  "20": { lat: 26.8467, lng: 80.9462, place: "Uttar Pradesh West", state: "Uttar Pradesh" },
  "21": { lat: 26.8467, lng: 80.9462, place: "Uttar Pradesh East", state: "Uttar Pradesh" },
  "22": { lat: 26.8467, lng: 80.9462, place: "Uttar Pradesh Central", state: "Uttar Pradesh" },
  "24": { lat: 30.0668, lng: 79.0193, place: "Uttarakhand Circle", state: "Uttarakhand" },
  "26": { lat: 26.8467, lng: 80.9462, place: "Uttar Pradesh Circle", state: "Uttar Pradesh" },
  "28": { lat: 26.8467, lng: 80.9462, place: "Uttar Pradesh Circle", state: "Uttar Pradesh" },
  "30": { lat: 26.9124, lng: 75.7873, place: "Rajasthan Circle", state: "Rajasthan" },
  "31": { lat: 26.9124, lng: 75.7873, place: "Rajasthan Circle", state: "Rajasthan" },
  "32": { lat: 26.9124, lng: 75.7873, place: "Rajasthan Circle", state: "Rajasthan" },
  "33": { lat: 26.9124, lng: 75.7873, place: "Rajasthan Circle", state: "Rajasthan" },
  "34": { lat: 26.9124, lng: 75.7873, place: "Rajasthan Circle", state: "Rajasthan" },
  "36": { lat: 23.0225, lng: 72.5714, place: "Gujarat Circle", state: "Gujarat" },
  "37": { lat: 23.0225, lng: 72.5714, place: "Gujarat Circle", state: "Gujarat" },
  "38": { lat: 23.0225, lng: 72.5714, place: "Gujarat Circle", state: "Gujarat" },
  "39": { lat: 21.1702, lng: 72.8311, place: "Gujarat South", state: "Gujarat" },
  "40": { lat: 19.0760, lng: 72.8777, place: "Maharashtra (Mumbai)", state: "Maharashtra" },
  "41": { lat: 18.5204, lng: 73.8567, place: "Maharashtra (Pune)", state: "Maharashtra" },
  "42": { lat: 19.9975, lng: 73.7898, place: "Maharashtra (Nashik)", state: "Maharashtra" },
  "43": { lat: 19.8762, lng: 75.3433, place: "Maharashtra (Marathwada)", state: "Maharashtra" },
  "44": { lat: 21.1458, lng: 79.0882, place: "Maharashtra (Vidarbha)", state: "Maharashtra" },
  "45": { lat: 23.2599, lng: 77.4126, place: "Madhya Pradesh Circle", state: "Madhya Pradesh" },
  "46": { lat: 23.2599, lng: 77.4126, place: "Madhya Pradesh Circle", state: "Madhya Pradesh" },
  "47": { lat: 23.2599, lng: 77.4126, place: "Madhya Pradesh Circle", state: "Madhya Pradesh" },
  "48": { lat: 23.2599, lng: 77.4126, place: "Madhya Pradesh Circle", state: "Madhya Pradesh" },
  "49": { lat: 21.2787, lng: 81.8661, place: "Chhattisgarh Circle", state: "Chhattisgarh" },
  "50": { lat: 17.3850, lng: 78.4867, place: "Telangana Circle", state: "Telangana" },
  "51": { lat: 14.6819, lng: 77.6006, place: "Rayalaseema Circle", state: "Andhra Pradesh" },
  "52": { lat: 16.5062, lng: 80.6480, place: "Coastal Andhra Circle", state: "Andhra Pradesh" },
  "53": { lat: 17.6868, lng: 83.2185, place: "North Andhra Circle", state: "Andhra Pradesh" },
  "56": { lat: 12.9716, lng: 77.5946, place: "Karnataka (Bengaluru Region)", state: "Karnataka" },
  "57": { lat: 12.9141, lng: 74.8560, place: "Karnataka (South / Coastal)", state: "Karnataka" },
  "58": { lat: 15.3647, lng: 75.1240, place: "Karnataka (North Central)", state: "Karnataka" },
  "59": { lat: 15.8497, lng: 74.4977, place: "Karnataka (Belagavi Region)", state: "Karnataka" },
  "60": { lat: 13.0827, lng: 80.2707, place: "Tamil Nadu (Chennai Region)", state: "Tamil Nadu" },
  "61": { lat: 10.7870, lng: 79.1378, place: "Tamil Nadu (Central Region)", state: "Tamil Nadu" },
  "62": { lat: 9.9252, lng: 78.1198, place: "Tamil Nadu (Madurai Region)", state: "Tamil Nadu" },
  "63": { lat: 11.6643, lng: 78.1460, place: "Tamil Nadu (Salem / West Region)", state: "Tamil Nadu" },
  "64": { lat: 11.0168, lng: 76.9558, place: "Tamil Nadu (Coimbatore Region)", state: "Tamil Nadu" },
  "67": { lat: 11.2588, lng: 75.7804, place: "Kerala (North Region)", state: "Kerala" },
  "68": { lat: 9.9312, lng: 76.2673, place: "Kerala (Central Region)", state: "Kerala" },
  "69": { lat: 8.5241, lng: 76.9366, place: "Kerala (South Region)", state: "Kerala" },
  "70": { lat: 22.5726, lng: 88.3639, place: "West Bengal (Kolkata Region)", state: "West Bengal" },
  "71": { lat: 22.9868, lng: 87.8550, place: "West Bengal Circle", state: "West Bengal" },
  "72": { lat: 22.9868, lng: 87.8550, place: "West Bengal Circle", state: "West Bengal" },
  "73": { lat: 26.7271, lng: 88.3953, place: "West Bengal North (Siliguri)", state: "West Bengal" },
  "75": { lat: 20.2961, lng: 85.8245, place: "Odisha Circle", state: "Odisha" },
  "76": { lat: 20.2961, lng: 85.8245, place: "Odisha Circle", state: "Odisha" },
  "77": { lat: 20.2961, lng: 85.8245, place: "Odisha Circle", state: "Odisha" },
  "78": { lat: 26.1445, lng: 91.7362, place: "Assam & North East Circle", state: "Assam" },
  "79": { lat: 26.1445, lng: 91.7362, place: "North East States Circle", state: "Meghalaya" },
  "80": { lat: 25.5941, lng: 85.1376, place: "Bihar Circle", state: "Bihar" },
  "81": { lat: 25.5941, lng: 85.1376, place: "Bihar Circle", state: "Bihar" },
  "82": { lat: 25.5941, lng: 85.1376, place: "Bihar Circle", state: "Bihar" },
  "83": { lat: 23.3441, lng: 85.3096, place: "Jharkhand Circle", state: "Jharkhand" },
  "84": { lat: 25.5941, lng: 85.1376, place: "Bihar Circle", state: "Bihar" },
  "85": { lat: 25.5941, lng: 85.1376, place: "Bihar Circle", state: "Bihar" },
};

/**
 * Validates whether an input string is a valid 6-digit Indian PIN code.
 */
export function isValidPinCode(pincode?: string | null): boolean {
  if (!pincode) return false;
  return /^[1-9][0-9]{5}$/.test(pincode.trim());
}

/**
 * Extracts a 6-digit Indian PIN code from an address string or free text.
 */
export function extractPinCode(text?: string | null): string | null {
  if (!text) return null;
  const clean = text.trim();
  // Match standalone 6-digit number starting with 1-9
  const match = clean.match(/\b([1-9][0-9]{5})\b/);
  return match ? match[1] : null;
}

/**
 * Resolves geographic coordinates for a given 6-digit PIN code.
 */
export function resolvePincode(pincode?: string | null): GeoCoordinate | null {
  if (!pincode) return null;
  const pin = pincode.trim();
  if (!isValidPinCode(pin)) return null;

  // 1. Check exact 6-digit match
  if (EXACT_PINCODE_CENTROIDS[pin]) {
    return EXACT_PINCODE_CENTROIDS[pin];
  }

  // 2. Check 3-digit district sorting prefix
  const prefix3 = pin.slice(0, 3);
  if (DISTRICT_3DIGIT_CENTROIDS[prefix3]) {
    return DISTRICT_3DIGIT_CENTROIDS[prefix3];
  }

  // 3. Check 2-digit circle fallback
  const prefix2 = pin.slice(0, 2);
  if (CIRCLE_2DIGIT_CENTROIDS[prefix2]) {
    return CIRCLE_2DIGIT_CENTROIDS[prefix2];
  }

  // Fallback to Chennai HQ if unmatched
  return { lat: 13.0827, lng: 80.2707, place: "India", state: "Tamil Nadu" };
}

/**
 * Calculates Great-Circle distance between two coordinates in kilometers using Haversine formula.
 */
export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (lat1 === lat2 && lon1 === lon2) return 0;

  const R = 6371.0088; // Earth's mean radius in km
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Finds the nearest known PIN code centroid from GPS coordinates.
 */
export function findNearestPincodeFromCoords(lat: number, lng: number): string | null {
  if (typeof lat !== "number" || typeof lng !== "number" || isNaN(lat) || isNaN(lng)) {
    return null;
  }

  let minDistance = Infinity;
  let nearestPin: string | null = null;

  // Search exact centroids first
  for (const [pin, coord] of Object.entries(EXACT_PINCODE_CENTROIDS)) {
    const dist = haversineDistanceKm(lat, lng, coord.lat, coord.lng);
    if (dist < minDistance) {
      minDistance = dist;
      nearestPin = pin;
    }
  }

  // If found within 35 km, return exact pin
  if (nearestPin && minDistance <= 35) {
    return nearestPin;
  }

  // Fallback to 3-digit district centroids
  for (const [prefix, coord] of Object.entries(DISTRICT_3DIGIT_CENTROIDS)) {
    const dist = haversineDistanceKm(lat, lng, coord.lat, coord.lng);
    if (dist < minDistance) {
      minDistance = dist;
      nearestPin = `${prefix}001`;
    }
  }

  return nearestPin;
}

/**
 * Calculates the statutory approximate transport distance (in KM) between
 * source yard and delivery site, utilizing either attached GPS coordinates or PIN codes.
 */
export function calculatePincodeDistance(
  options: CalculateDistanceOptions
): DistanceCalculationResult {
  const { fromPincode, toPincode, fromCoords, toCoords } = options;

  const cleanFromPin = fromPincode ? fromPincode.trim() : "";
  const cleanToPin = toPincode ? toPincode.trim() : "";

  // 1. Identical PIN code: local delivery within same post office/locality
  if (cleanFromPin && cleanToPin && cleanFromPin === cleanToPin && isValidPinCode(cleanFromPin)) {
    const geo = resolvePincode(cleanFromPin);
    return {
      distanceKm: 5, // Local delivery standard baseline (5 km)
      fromLocation: geo?.place || `PIN ${cleanFromPin}`,
      toLocation: geo?.place || `PIN ${cleanToPin}`,
      method: "SAME_PINCODE",
      straightLineKm: 0,
    };
  }

  // 2. Determine source coordinate
  let srcCoord: GeoCoordinate | null = null;
  if (fromCoords && typeof fromCoords.lat === "number" && typeof fromCoords.lng === "number" && !isNaN(fromCoords.lat)) {
    srcCoord = { lat: fromCoords.lat, lng: fromCoords.lng, place: "Source Yard GPS" };
  } else if (cleanFromPin) {
    srcCoord = resolvePincode(cleanFromPin);
  }

  // 3. Determine destination coordinate
  let dstCoord: GeoCoordinate | null = null;
  if (toCoords && typeof toCoords.lat === "number" && typeof toCoords.lng === "number" && !isNaN(toCoords.lat)) {
    dstCoord = { lat: toCoords.lat, lng: toCoords.lng, place: "Delivery Site GPS" };
  } else if (cleanToPin) {
    dstCoord = resolvePincode(cleanToPin);
  }

  if (!srcCoord || !dstCoord) {
    return {
      distanceKm: 25,
      fromLocation: srcCoord?.place || (cleanFromPin ? `PIN ${cleanFromPin}` : "Yard"),
      toLocation: dstCoord?.place || (cleanToPin ? `PIN ${cleanToPin}` : "Site"),
      method: "FALLBACK",
      straightLineKm: 20,
    };
  }

  const straightLine = haversineDistanceKm(srcCoord.lat, srcCoord.lng, dstCoord.lat, dstCoord.lng);

  // Apply road tortuosity factor:
  // - For intra-city trips (straightLine <= 35 km), city roads have turns, signals, detour: ~1.30x
  // - For inter-city / highway transit (> 35 km), highways are more direct: ~1.20x
  const roadFactor = straightLine <= 35 ? 1.30 : 1.20;
  const estimatedRoadKm = Math.max(1, Math.round(straightLine * roadFactor));

  const isGpsUsed = !!(fromCoords?.lat && toCoords?.lat);

  return {
    distanceKm: estimatedRoadKm,
    fromLocation: srcCoord.place || `PIN ${cleanFromPin}`,
    toLocation: dstCoord.place || `PIN ${cleanToPin}`,
    method: isGpsUsed ? "GPS_COORDINATES" : "PINCODE_CENTROID",
    straightLineKm: Math.round(straightLine * 10) / 10,
  };
}
