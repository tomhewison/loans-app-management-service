import { CosmosClient, Database, Container, SqlQuerySpec } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
import {
    DashboardStats,
    ReservationSummary,
    ReservationFilters,
    ReservationStatus
} from '../../domain/entities/dashboard-stats';
import { ReservationQueryRepo } from '../../domain/repositories/reservation-query-repo';

export type CosmosReservationQueryRepoOptions = {
    endpoint: string;
    key?: string;
    databaseId: string;
    containerId: string;
};

type ReservationDocument = {
    id: string;
    userId: string;
    userEmail: string;
    deviceId: string;
    deviceModelId: string;
    status: ReservationStatus;
    reservedAt: string;
    expiresAt: string;
    collectedAt?: string;
    returnDueAt?: string;
    returnedAt?: string;
    cancelledAt?: string;
    notes?: string;
    updatedAt: string;
};

/**
 * Read-only Cosmos DB adapter for querying reservation data.
 * Used by management-service to provide admin views and statistics.
 */
export class CosmosReservationQueryRepo implements ReservationQueryRepo {
    private readonly client: CosmosClient;
    private readonly database: Database;
    private readonly container: Container;

    constructor(private readonly options: CosmosReservationQueryRepoOptions) {
        console.log(`[CosmosReservationQueryRepo] Initializing with endpoint: ${options.endpoint}`);

        if (options.key) {
            this.client = new CosmosClient({ endpoint: options.endpoint, key: options.key });
        } else {
            this.client = new CosmosClient({ endpoint: options.endpoint, aadCredentials: new DefaultAzureCredential() });
        }
        this.database = this.client.database(options.databaseId);
        this.container = this.database.container(options.containerId);

        console.log('[CosmosReservationQueryRepo] Initialized successfully');
    }

    public async getDashboardStats(): Promise<DashboardStats> {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
        const nowIso = now.toISOString();

        // Run all count queries in parallel
        const [activeLoans, pendingCollection, overdueLoans, returnedToday, reservationsToday] = await Promise.all([
            this.countByStatus(ReservationStatus.Collected),
            this.countPendingCollections(),
            this.countOverdue(nowIso),
            this.countReturnedSince(todayStart),
            this.countReservedSince(todayStart),
        ]);

        return {
            activeLoans,
            pendingCollection,
            overdueLoans,
            returnedToday,
            reservationsToday,
            calculatedAt: now,
        };
    }

    public async listReservations(filters?: ReservationFilters): Promise<ReservationSummary[]> {
        let query = 'SELECT * FROM c WHERE 1=1';
        const parameters: { name: string; value: string }[] = [];

        if (filters?.status) {
            query += ' AND c.status = @status';
            parameters.push({ name: '@status', value: filters.status });
        }
        if (filters?.userId) {
            query += ' AND c.userId = @userId';
            parameters.push({ name: '@userId', value: filters.userId });
        }
        if (filters?.deviceModelId) {
            query += ' AND c.deviceModelId = @deviceModelId';
            parameters.push({ name: '@deviceModelId', value: filters.deviceModelId });
        }

        query += ' ORDER BY c.reservedAt DESC';

        const { resources } = await this.container.items
            .query<ReservationDocument>({ query, parameters })
            .fetchAll();

        return (resources ?? []).map((doc) => this.mapToSummary(doc));
    }

    public async listOverdueReservations(): Promise<ReservationSummary[]> {
        const now = new Date().toISOString();
        const query: SqlQuerySpec = {
            query: `SELECT * FROM c WHERE c.status = @status AND c.returnDueAt < @now ORDER BY c.returnDueAt ASC`,
            parameters: [
                { name: '@status', value: ReservationStatus.Collected },
                { name: '@now', value: now },
            ],
        };

        const { resources } = await this.container.items
            .query<ReservationDocument>(query)
            .fetchAll();

        return (resources ?? []).map((doc) => this.mapToSummary(doc, true));
    }

    public async listPendingCollections(): Promise<ReservationSummary[]> {
        const now = new Date().toISOString();
        const query: SqlQuerySpec = {
            query: `SELECT * FROM c WHERE c.status = @status AND c.expiresAt > @now ORDER BY c.expiresAt ASC`,
            parameters: [
                { name: '@status', value: ReservationStatus.Reserved },
                { name: '@now', value: now },
            ],
        };

        const { resources } = await this.container.items
            .query<ReservationDocument>(query)
            .fetchAll();

        return (resources ?? []).map((doc) => this.mapToSummary(doc));
    }

    // Private helpers for stats queries
    private async countByStatus(status: ReservationStatus): Promise<number> {
        const query: SqlQuerySpec = {
            query: 'SELECT VALUE COUNT(1) FROM c WHERE c.status = @status',
            parameters: [{ name: '@status', value: status }],
        };
        const { resources } = await this.container.items.query<number>(query).fetchAll();
        return resources?.[0] ?? 0;
    }

    private async countPendingCollections(): Promise<number> {
        const now = new Date().toISOString();
        const query: SqlQuerySpec = {
            query: 'SELECT VALUE COUNT(1) FROM c WHERE c.status = @status AND c.expiresAt > @now',
            parameters: [
                { name: '@status', value: ReservationStatus.Reserved },
                { name: '@now', value: now },
            ],
        };
        const { resources } = await this.container.items.query<number>(query).fetchAll();
        return resources?.[0] ?? 0;
    }

    private async countOverdue(now: string): Promise<number> {
        const query: SqlQuerySpec = {
            query: 'SELECT VALUE COUNT(1) FROM c WHERE c.status = @status AND c.returnDueAt < @now',
            parameters: [
                { name: '@status', value: ReservationStatus.Collected },
                { name: '@now', value: now },
            ],
        };
        const { resources } = await this.container.items.query<number>(query).fetchAll();
        return resources?.[0] ?? 0;
    }

    private async countReturnedSince(since: string): Promise<number> {
        const query: SqlQuerySpec = {
            query: 'SELECT VALUE COUNT(1) FROM c WHERE c.status = @status AND c.returnedAt >= @since',
            parameters: [
                { name: '@status', value: ReservationStatus.Returned },
                { name: '@since', value: since },
            ],
        };
        const { resources } = await this.container.items.query<number>(query).fetchAll();
        return resources?.[0] ?? 0;
    }

    private async countReservedSince(since: string): Promise<number> {
        const query: SqlQuerySpec = {
            query: 'SELECT VALUE COUNT(1) FROM c WHERE c.reservedAt >= @since',
            parameters: [{ name: '@since', value: since }],
        };
        const { resources } = await this.container.items.query<number>(query).fetchAll();
        return resources?.[0] ?? 0;
    }

    private mapToSummary(doc: ReservationDocument, forceOverdue = false): ReservationSummary {
        const now = new Date();
        const returnDueAt = doc.returnDueAt ? new Date(doc.returnDueAt) : undefined;
        const isOverdue = forceOverdue || (
            doc.status === ReservationStatus.Collected &&
            returnDueAt &&
            now > returnDueAt
        );

        return {
            id: doc.id,
            userId: doc.userId,
            userEmail: doc.userEmail,
            deviceId: doc.deviceId,
            deviceModelId: doc.deviceModelId,
            status: doc.status,
            reservedAt: new Date(doc.reservedAt),
            expiresAt: new Date(doc.expiresAt),
            collectedAt: doc.collectedAt ? new Date(doc.collectedAt) : undefined,
            returnDueAt,
            returnedAt: doc.returnedAt ? new Date(doc.returnedAt) : undefined,
            isOverdue,
        };
    }
}
