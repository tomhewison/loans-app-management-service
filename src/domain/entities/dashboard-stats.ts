/**
 * Dashboard statistics for admin overview.
 */
export type DashboardStats = {
    /** Total number of active loans (collected, not yet returned) */
    activeLoans: number;
    /** Reservations awaiting collection */
    pendingCollection: number;
    /** Loans past their return due date */
    overdueLoans: number;
    /** Loans returned today */
    returnedToday: number;
    /** Reservations created today */
    reservationsToday: number;
    /** Timestamp when stats were calculated */
    calculatedAt: Date;
};

/**
 * Reservation status values (matching reservation-service)
 */
export enum ReservationStatus {
    Reserved = 'Reserved',
    Collected = 'Collected',
    Returned = 'Returned',
    Cancelled = 'Cancelled',
    Expired = 'Expired'
}

/**
 * Reservation summary for admin views.
 * Simplified projection of reservation data.
 */
export type ReservationSummary = {
    id: string;
    userId: string;
    userEmail: string;
    deviceId: string;
    deviceModelId: string;
    status: ReservationStatus;
    reservedAt: Date;
    expiresAt: Date;
    collectedAt?: Date;
    returnDueAt?: Date;
    returnedAt?: Date;
    isOverdue: boolean;
};

/**
 * Query filters for reservation lists.
 */
export type ReservationFilters = {
    status?: ReservationStatus;
    userId?: string;
    deviceModelId?: string;
    fromDate?: Date;
    toDate?: Date;
};
