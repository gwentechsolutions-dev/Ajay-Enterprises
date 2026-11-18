export type DriverLanguage = "en" | "ta" | "hi";

export interface LanguageOption {
  code: DriverLanguage;
  label: string;
  nativeLabel: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: "en", label: "English", nativeLabel: "English" },
  { code: "ta", label: "Tamil", nativeLabel: "தமிழ்" },
  { code: "hi", label: "Hindi", nativeLabel: "हिन्दी" },
];

export interface DriverTranslationDictionary {
  // Portal Header & Navigation
  portalTitle: string;
  portalSubtitle: string;
  online: string;
  offline: string;
  sync: string;
  syncComplete: string;
  syncFailed: string;
  language: string;
  selectLanguage: string;
  languageChanged: string;

  // Tabs
  tabAll: string;
  tabDeliveries: string;
  tabPickups: string;
  tabDone: string;

  // Sections
  assignedReturnPickups: string;
  assignedOutwardDeliveries: string;
  completedTasksToday: string;
  noPendingPickups: string;
  noPendingPickupsDesc: string;
  noPendingDeliveries: string;
  noPendingDeliveriesDesc: string;
  noCompletedToday: string;
  noCompletedTodayDesc: string;
  loadingTasks: string;
  offlineWarning: string;

  // Cards common
  customer: string;
  site: string;
  destinationYard: string;
  sourceYard: string;
  vehicle: string;
  trip: string;
  driver: string;
  items: string;
  navigate: string;
  call: string;
  status: string;
  date: string;
  time: string;
  uomNos: string;

  // Badges & Statuses
  badgeReturnPickup: string;
  badgeOutwardDelivery: string;
  statusDriverAssigned: string;
  statusArrivedAtSite: string;
  statusInTransitToYard: string;
  statusAwaitingQC: string;
  statusQCVerified: string;
  statusFinalized: string;
  statusDispatched: string;
  statusDelivered: string;
  thisYard: string;

  // Action Buttons
  btnMarkArrivalAtSite: string;
  btnMarkingArrival: string;
  btnCountMaterialsAndHandover: string;
  btnMarkArrivalAtYard: string;
  btnConfirmDeliveryAndSignature: string;
  btnCancel: string;
  btnClose: string;
  btnSubmit: string;
  btnSave: string;
  btnRetake: string;
  btnTakeEvidencePhoto: string;
  btnClearSignature: string;

  // Outward Delivery Modal
  deliveryModalTitle: string;
  deliveryModalDesc: string;
  deliveryItemsChecklist: string;
  receiverFullName: string;
  receiverFullNameReq: string;
  receiverPhoneOpt: string;
  designationOnSite: string;
  uploadDeliveryPhoto: string;
  captureSitePhotoDesc: string;
  touchSignature: string;
  touchSignatureDesc: string;
  deliveryRemarks: string;
  btnConfirmDelivery: string;
  btnConfirmingDelivery: string;

  // Material Return Pickup Modal
  pickupModalTitle: string;
  pickupModalDesc: string;
  pickupMaterialsChecklist: string;
  expectedQty: string;
  actualCollectedQty: string;
  goodQty: string;
  damagedQty: string;
  missingQty: string;
  conditionNotes: string;
  conditionNotesPlaceholder: string;
  heldOnSite: string;
  uploadReturnEvidencePhoto: string;
  uploadReturnEvidencePhotoDesc: string;
  customerHandoverAcknowledgement: string;
  customerHandoverRepName: string;
  customerRepDesignation: string;
  customerRepPhone: string;
  customerTouchSignature: string;
  customerAgreedDamageLabel: string;
  btnConfirmMaterialPickup: string;
  btnConfirmingMaterialPickup: string;

  // Yard Arrival Modal
  yardArrivalModalTitle: string;
  yardArrivalModalDesc: string;
  materialsTransportedNotice: string;
  finalOdometerReading: string;
  tripStartOdometer: string;
  yardReceivingEmployee: string;
  autoPopulateNotice: string;
  selectYardReceiverPlaceholder: string;
  searchYardStaffPlaceholder: string;
  quickSelect: string;
  designation: string;
  receiverPhone: string;
  yardArrivalRemarks: string;
  yardArrivalRemarksPlaceholder: string;
  btnConfirmYardArrival: string;
  btnConfirmingYardArrival: string;

  // Common Validations & Alerts
  validationGpsRequired: string;
  validationGpsAcquiring: string;
  validationGpsFailed: string;
  validationReceiverNameRequired: string;
  validationReceiverPhoneInvalid: string;
  validationPhotoMandatory: string;
  validationSignatureMandatory: string;
  validationQtyCannotBeNegative: string;
  successSiteArrivalRecorded: string;
  successDeliveryCompleted: string;
  successPickupCompleted: string;
  successYardArrivalRecorded: string;

  // Toast notifications
  toastGpsNotSupported: string;
  toastGpsCaptured: string;
  toastGpsSlowWarning: string;
  toastSiteArrivalConfirmed: string;
  toastPhotoCaptured: string;
  toastOfflineSaved: string;
  toastDeliveryCompleted: string;
  toastPickupConfirmed: string;
  toastYardHandoverCompleted: string;
  toastWarehousePersonRequired: string;
  toastInvalidOdometer: string;
}
