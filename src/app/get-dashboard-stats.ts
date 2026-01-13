import { DashboardStats } from '../domain/entities/dashboard-stats';
import { ReservationQueryRepo } from '../domain/repositories/reservation-query-repo';

export type GetDashboardStatsDeps = {
    reservationQueryRepo: ReservationQueryRepo;
};

export type GetDashboardStatsResult = {
    success: boolean;
    data?: DashboardStats;
    error?: string;
};

/**
 * Use case to get aggregated dashboard statistics for admin overview.
 */
export async function getDashboardStats(
    deps: GetDashboardStatsDeps
): Promise<GetDashboardStatsResult> {
    try {
        const stats = await deps.reservationQueryRepo.getDashboardStats();
        return { success: true, data: stats };
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { success: false, error: message };
    }
}

// Hello
