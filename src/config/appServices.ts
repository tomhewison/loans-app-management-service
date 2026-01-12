import { ReservationQueryRepo } from '../domain/repositories/reservation-query-repo';
import { CosmosReservationQueryRepo } from '../infra/adapters/cosmos-reservation-query-repo';

// Cached instances
let cachedReservationQueryRepo: ReservationQueryRepo | null = null;

/**
 * Get the reservation query repository singleton.
 * Connects to the reservation-service Cosmos DB (read-only).
 */
export const getReservationQueryRepo = (): ReservationQueryRepo => {
    if (!cachedReservationQueryRepo) {
        const endpoint = process.env.COSMOS_ENDPOINT || '';
        const databaseId = process.env.RESERVATION_DATABASE_ID || 'reservation-db';
        const containerId = process.env.RESERVATION_CONTAINER_ID || 'reservations';
        const key = process.env.COSMOS_KEY;

        if (!endpoint) {
            throw new Error('COSMOS_ENDPOINT environment variable is required');
        }

        cachedReservationQueryRepo = new CosmosReservationQueryRepo({
            endpoint,
            key,
            databaseId,
            containerId,
        });
    }
    return cachedReservationQueryRepo;
};
