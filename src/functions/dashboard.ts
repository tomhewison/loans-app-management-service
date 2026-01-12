import { app } from '@azure/functions';
import { HttpRequest, HttpResponseInit } from '@azure/functions';
import { getReservationQueryRepo } from '../config/appServices';
import { getDashboardStats } from '../app/get-dashboard-stats';
import { addCorsHeaders, handleCorsPreflight } from '../infra/middleware/cors';
import { requireStaff } from '../infra/middleware/auth0-middleware';

/**
 * Helper to serialize DashboardStats to JSON
 */
function serializeDashboardStats(stats: {
    activeLoans: number;
    pendingCollection: number;
    overdueLoans: number;
    returnedToday: number;
    reservationsToday: number;
    calculatedAt: Date;
}) {
    return {
        activeLoans: stats.activeLoans,
        pendingCollection: stats.pendingCollection,
        overdueLoans: stats.overdueLoans,
        returnedToday: stats.returnedToday,
        reservationsToday: stats.reservationsToday,
        calculatedAt: stats.calculatedAt.toISOString(),
    };
}

/**
 * GET /api/dashboard/stats - Get dashboard statistics (staff only)
 */
async function handleGetDashboardStats(request: HttpRequest): Promise<HttpResponseInit> {
    const origin = request.headers.get('origin');

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
        return handleCorsPreflight(origin);
    }

    // Require staff authorization
    const authResult = await requireStaff(request);
    if (!authResult.valid) {
        return addCorsHeaders({
            status: 401,
            jsonBody: {
                success: false,
                message: 'Unauthorized',
                error: authResult.error,
            },
        }, origin);
    }

    try {
        const result = await getDashboardStats({
            reservationQueryRepo: getReservationQueryRepo(),
        });

        if (!result.success) {
            return addCorsHeaders({
                status: 500,
                jsonBody: {
                    success: false,
                    message: 'Failed to get dashboard stats',
                    error: result.error,
                },
            }, origin);
        }

        return addCorsHeaders({
            status: 200,
            jsonBody: serializeDashboardStats(result.data!),
        }, origin);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('Error in handleGetDashboardStats:', message, error);
        return addCorsHeaders({
            status: 500,
            jsonBody: {
                success: false,
                message: 'Failed to get dashboard stats',
                error: message,
            },
        }, origin);
    }
}

// Register HTTP endpoints
app.http('getDashboardStats', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'dashboard/stats',
    handler: handleGetDashboardStats,
});
