import { ReservationSummary, ReservationFilters } from '../domain/entities/dashboard-stats';
import { ReservationQueryRepo } from '../domain/repositories/reservation-query-repo';

export type ListAllReservationsDeps = {
    reservationQueryRepo: ReservationQueryRepo;
};

export type ListAllReservationsResult = {
    success: boolean;
    data?: ReservationSummary[];
    error?: string;
};

/**
 * Use case to list all reservations with optional filters.
 */
export async function listAllReservations(
    deps: ListAllReservationsDeps,
    filters?: ReservationFilters
): Promise<ListAllReservationsResult> {
    try {
        const reservations = await deps.reservationQueryRepo.listReservations(filters);
        return { success: true, data: reservations };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { success: false, error: message };
    }
}
