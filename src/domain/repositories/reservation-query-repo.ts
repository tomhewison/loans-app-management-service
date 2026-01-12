import { DashboardStats, ReservationSummary, ReservationFilters } from '../entities/dashboard-stats';

/**
 * Repository interface for querying reservation data for admin views.
 * This provides read-only access to reservation data.
 */
export interface ReservationQueryRepo {
    /**
     * Get aggregated dashboard statistics.
     */
    getDashboardStats(): Promise<DashboardStats>;

    /**
     * List all reservations with optional filters.
     */
    listReservations(filters?: ReservationFilters): Promise<ReservationSummary[]>;

    /**
     * List overdue reservations (collected but past return due date).
     */
    listOverdueReservations(): Promise<ReservationSummary[]>;

    /**
     * List pending collections (reserved but not yet collected).
     */
    listPendingCollections(): Promise<ReservationSummary[]>;
}
