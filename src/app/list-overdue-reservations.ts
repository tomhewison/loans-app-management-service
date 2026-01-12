import { ReservationSummary } from '../domain/entities/dashboard-stats';
import { ReservationQueryRepo } from '../domain/repositories/reservation-query-repo';

export type ListOverdueReservationsDeps = {
    reservationQueryRepo: ReservationQueryRepo;
};

export type ListOverdueReservationsResult = {
    success: boolean;
    data?: ReservationSummary[];
    error?: string;
};

/**
 * Use case to list overdue reservations (past return due date).
 */
export async function listOverdueReservations(
    deps: ListOverdueReservationsDeps
): Promise<ListOverdueReservationsResult> {
    try {
        const reservations = await deps.reservationQueryRepo.listOverdueReservations();
        return { success: true, data: reservations };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { success: false, error: message };
    }
}
