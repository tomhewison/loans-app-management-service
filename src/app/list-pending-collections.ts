import { ReservationSummary } from '../domain/entities/dashboard-stats';
import { ReservationQueryRepo } from '../domain/repositories/reservation-query-repo';

export type ListPendingCollectionsDeps = {
    reservationQueryRepo: ReservationQueryRepo;
};

export type ListPendingCollectionsResult = {
    success: boolean;
    data?: ReservationSummary[];
    error?: string;
};

/**
 * Use case to list pending collections (awaiting pickup).
 */
export async function listPendingCollections(
    deps: ListPendingCollectionsDeps
): Promise<ListPendingCollectionsResult> {
    try {
        const reservations = await deps.reservationQueryRepo.listPendingCollections();
        return { success: true, data: reservations };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { success: false, error: message };
    }
}
