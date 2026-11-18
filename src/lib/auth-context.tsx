"use client";

import * as React from "react";
import { SessionUser } from "./auth";

export interface AuthContextValue {
  user: SessionUser | null;
  role: string;
  isDeliveryPerson: boolean;
  isWarehouseStaff: boolean;
  isOwnerOrAdmin: boolean;
  canCreateDeliveryNote: boolean;
  canCreateReturnNote: boolean;
  canCreateTrip: boolean;
  canCreateInvoice: boolean;
}

const defaultAuthContextValue: AuthContextValue = {
  user: null,
  role: "",
  isDeliveryPerson: false,
  isWarehouseStaff: false,
  isOwnerOrAdmin: false,
  canCreateDeliveryNote: true,
  canCreateReturnNote: true,
  canCreateTrip: false,
  canCreateInvoice: false,
};

const AuthContext = React.createContext<AuthContextValue>(defaultAuthContextValue);

export function AuthProvider({
  user,
  children,
}: {
  user: SessionUser | null;
  children: React.ReactNode;
}) {
  const role = (user?.role || "").toUpperCase();
  const isDeliveryPerson = role === "DELIVERY_PERSONNEL" || role === "DELIVERY_DRIVER";
  const isWarehouseStaff = role === "WAREHOUSE_STAFF" || role === "WAREHOUSE_OPERATOR";
  const isOwnerOrAdmin = role === "OWNER" || role === "ADMINISTRATOR" || role === "ADMIN";

  // Delivery drivers are field personnel executing physical delivery/acknowledgement.
  // They are strictly not permitted to create Delivery Notes, Material Return Notes, or Vehicle Trips.
  const canCreateDeliveryNote = !isDeliveryPerson;
  const canCreateReturnNote = !isDeliveryPerson;
  const canCreateTrip = !isDeliveryPerson;
  const canCreateInvoice = isOwnerOrAdmin || role === "ACCOUNTANT";

  const value = React.useMemo<AuthContextValue>(
    () => ({
      user,
      role,
      isDeliveryPerson,
      isWarehouseStaff,
      isOwnerOrAdmin,
      canCreateDeliveryNote,
      canCreateReturnNote,
      canCreateTrip,
      canCreateInvoice,
    }),
    [user, role, isDeliveryPerson, isWarehouseStaff, isOwnerOrAdmin, canCreateDeliveryNote, canCreateReturnNote, canCreateTrip, canCreateInvoice]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useCurrentUser(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  const [clientUser, setClientUser] = React.useState<SessionUser | null>(ctx?.user ?? null);

  React.useEffect(() => {
    if (!ctx?.user && !clientUser && typeof window !== "undefined") {
      fetch("/api/v1/auth/me")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.success && data?.data?.user) {
            setClientUser(data.data.user);
          }
        })
        .catch(() => {});
    }
  }, [ctx?.user, clientUser]);

  const activeUser = ctx?.user ?? clientUser;
  const role = (activeUser?.role || "").toUpperCase();
  const isDeliveryPerson = role === "DELIVERY_PERSONNEL" || role === "DELIVERY_DRIVER";
  const isWarehouseStaff = role === "WAREHOUSE_STAFF" || role === "WAREHOUSE_OPERATOR";
  const isOwnerOrAdmin = role === "OWNER" || role === "ADMINISTRATOR" || role === "ADMIN";

  return {
    user: activeUser,
    role,
    isDeliveryPerson,
    isWarehouseStaff,
    isOwnerOrAdmin,
    canCreateDeliveryNote: !isDeliveryPerson,
    canCreateReturnNote: !isDeliveryPerson,
    canCreateTrip: !isDeliveryPerson,
    canCreateInvoice: isOwnerOrAdmin || role === "ACCOUNTANT",
  };
}
