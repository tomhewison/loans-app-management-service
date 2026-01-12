import { app } from '@azure/functions';
import { HttpRequest, HttpResponseInit } from '@azure/functions';
import { getReservationQueryRepo } from '../config/appServices';
import { listAllReservations } from '../app/list-all-reservations';
import { listOverdueReservations } from '../app/list-overdue-reservations';
import { listPendingCollections } from '../app/list-pending-collections';
import { ReservationStatus, ReservationSummary } from '../domain/entities/dashboard-stats';
import { addCorsHeaders, handleCorsPreflight } from '../infra/middleware/cors';
import { requireStaff } from '../infra/middleware/auth0-middleware';

/**
 * Helper to serialize ReservationSummary to JSON
 */
function serializeReservation(r: ReservationSummary) {
    return {
        id: r.id,
        userId: r.userId,
        userEmail: r.userEmail,
        deviceId: r.deviceId,
        deviceModelId: r.deviceModelId,
        status: r.status,
        reservedAt: r.reservedAt.toISOString(),
        expiresAt: r.expiresAt.toISOString(),
        collectedAt: r.collectedAt?.toISOString(),
        returnDueAt: r.returnDueAt?.toISOString(),
        returnedAt: r.returnedAt?.toISOString(),
        isOverdue: r.isOverdue,
    };
}

/**
 * GET /api/admin/reservations - List all reservations with optional filters (staff only)
 */
async function handleListReservations(request: HttpRequest): Promise<HttpResponseInit> {
    const origin = request.headers.get('origin');

    if (request.method === 'OPTIONS') {
        return handleCorsPreflight(origin);
    }

    const authResult = await requireStaff(request);
    if (!authResult.valid) {
        return addCorsHeaders({
            status: 401,
            jsonBody: { success: false, message: 'Unauthorized', error: authResult.error },
        }, origin);
    }

    try {
        // Parse optional filters from query params
        const status = request.query.get('status') as ReservationStatus | null;
        const userId = request.query.get('userId') || undefined;
        const deviceModelId = request.query.get('deviceModelId') || undefined;

        const result = await listAllReservations(
            { reservationQueryRepo: getReservationQueryRepo() },
            { status: status || undefined, userId, deviceModelId }
        );

        if (!result.success) {
            return addCorsHeaders({
                status: 500,
                jsonBody: { success: false, message: 'Failed to list reservations', error: result.error },
            }, origin);
        }

        return addCorsHeaders({
            status: 200,
            jsonBody: (result.data || []).map(serializeReservation),
        }, origin);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('Error in handleListReservations:', message, error);
        return addCorsHeaders({
            status: 500,
            jsonBody: { success: false, message: 'Failed to list reservations', error: message },
        }, origin);
    }
}

/**
 * GET /api/admin/reservations/overdue - List overdue reservations (staff only)
 */
async function handleListOverdue(request: HttpRequest): Promise<HttpResponseInit> {
    const origin = request.headers.get('origin');

    if (request.method === 'OPTIONS') {
        return handleCorsPreflight(origin);
    }

    const authResult = await requireStaff(request);
    if (!authResult.valid) {
        return addCorsHeaders({
            status: 401,
            jsonBody: { success: false, message: 'Unauthorized', error: authResult.error },
        }, origin);
    }

    try {
        const result = await listOverdueReservations({
            reservationQueryRepo: getReservationQueryRepo(),
        });

        if (!result.success) {
            return addCorsHeaders({
                status: 500,
                jsonBody: { success: false, message: 'Failed to list overdue reservations', error: result.error },
            }, origin);
        }

        return addCorsHeaders({
            status: 200,
            jsonBody: (result.data || []).map(serializeReservation),
        }, origin);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('Error in handleListOverdue:', message, error);
        return addCorsHeaders({
            status: 500,
            jsonBody: { success: false, message: 'Failed to list overdue reservations', error: message },
        }, origin);
    }
}

/**
 * GET /api/admin/reservations/pending - List pending collections (staff only)
 */
async function handleListPending(request: HttpRequest): Promise<HttpResponseInit> {
    const origin = request.headers.get('origin');

    if (request.method === 'OPTIONS') {
        return handleCorsPreflight(origin);
    }

    const authResult = await requireStaff(request);
    if (!authResult.valid) {
        return addCorsHeaders({
            status: 401,
            jsonBody: { success: false, message: 'Unauthorized', error: authResult.error },
        }, origin);
    }

    try {
        const result = await listPendingCollections({
            reservationQueryRepo: getReservationQueryRepo(),
        });

        if (!result.success) {
            return addCorsHeaders({
                status: 500,
                jsonBody: { success: false, message: 'Failed to list pending collections', error: result.error },
            }, origin);
        }

        return addCorsHeaders({
            status: 200,
            jsonBody: (result.data || []).map(serializeReservation),
        }, origin);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('Error in handleListPending:', message, error);
        return addCorsHeaders({
            status: 500,
            jsonBody: { success: false, message: 'Failed to list pending collections', error: message },
        }, origin);
    }
}

// Register HTTP endpoints
app.http('listAdminReservations', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'admin/reservations',
    handler: handleListReservations,
});

app.http('listOverdueReservations', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'admin/reservations/overdue',
    handler: handleListOverdue,
});

app.http('listPendingCollections', {
    methods: ['GET', 'OPTIONS'],
    authLevel: 'anonymous',
    route: 'admin/reservations/pending',
    handler: handleListPending,
});
