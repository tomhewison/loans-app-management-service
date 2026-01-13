import { HttpRequest } from '@azure/functions';
import * as jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

export type Auth0User = {
  sub: string; // User ID
  email?: string;
  permissions?: string[];
};

export type Auth0ValidationResult = {
  valid: boolean;
  user?: Auth0User;
  error?: string;
};

function getAuth0Domain(): string {
  const domain = process.env.AUTH0_DOMAIN;
  if (!domain) {
    throw new Error('AUTH0_DOMAIN environment variable is required');
  }
  return domain.replace(/\/$/, '');
}

function getAuth0Audience(): string {
  const audience = process.env.AUTH0_AUDIENCE;
  if (!audience) {
    throw new Error('AUTH0_AUDIENCE environment variable is required');
  }
  return audience;
}

function createJwksClient() {
  const domain = getAuth0Domain();
  return jwksClient({
    jwksUri: `https://${domain}/.well-known/jwks.json`,
    cache: true,
    cacheMaxAge: 86400000,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
  });
}

async function getSigningKey(kid: string): Promise<string> {
  const client = createJwksClient();
  const key = await client.getSigningKey(kid);
  return key.getPublicKey();
}

export async function validateAuth0Token(request: HttpRequest): Promise<Auth0ValidationResult> {
  const authHeader = request.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      valid: false,
      error: 'Missing or invalid Authorization header',
    };
  }

  const token = authHeader.substring(7);

  if (!token || token.length === 0) {
    return {
      valid: false,
      error: 'Invalid token',
    };
  }

  try {
    const domain = getAuth0Domain();
    const audience = getAuth0Audience();
    const issuer = `https://${domain}/`;

    const decoded = jwt.decode(token, { complete: true });

    if (!decoded || typeof decoded === 'string' || !decoded.header || !decoded.header.kid) {
      return {
        valid: false,
        error: 'Invalid token format',
      };
    }

    const signingKey = await getSigningKey(decoded.header.kid);

    const verified = jwt.verify(token, signingKey, {
      audience,
      issuer,
      algorithms: ['RS256'],
    }) as jwt.JwtPayload;

    const user: Auth0User = {
      sub: verified.sub || '',
      email: verified.email as string | undefined,
      permissions: extractPermissions(verified),
    };

    if (!user.sub) {
      return {
        valid: false,
        error: 'Token missing user identifier (sub)',
      };
    }

    return {
      valid: true,
      user,
    };
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return {
        valid: false,
        error: 'Token has expired',
      };
    }

    if (error instanceof jwt.JsonWebTokenError) {
      return {
        valid: false,
        error: `Token validation failed: ${error.message}`,
      };
    }

    if (error instanceof Error) {
      return {
        valid: false,
        error: `Authentication error: ${error.message}`,
      };
    }

    return {
      valid: false,
      error: 'Unknown authentication error',
    };
  }
}

function extractPermissions(claims: jwt.JwtPayload): string[] {
  if (claims.permissions && Array.isArray(claims.permissions)) {
    return claims.permissions as string[];
  }

  if (claims.scope && typeof claims.scope === 'string') {
    return claims.scope.split(' ').filter(s => s.length > 0);
  }

  return [];
}

export function hasPermission(user: Auth0User, requiredPermission: string): boolean {
  return user.permissions?.includes(requiredPermission) ?? false;
}

export async function requireAuth(request: HttpRequest): Promise<Auth0ValidationResult> {
  try {
    const validation = await validateAuth0Token(request);

    if (!validation.valid) {
      return validation;
    }

    return validation;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      valid: false,
      error: `Authentication configuration error: ${message}`,
    };
  }
}



export async function requirePermission(
  request: HttpRequest,
  requiredPermission: string
): Promise<Auth0ValidationResult> {
  try {
    const validation = await validateAuth0Token(request);

    if (!validation.valid || !validation.user) {
      return {
        valid: false,
        error: validation.error || 'Authentication required',
      };
    }

    if (!hasPermission(validation.user, requiredPermission)) {
      return {
        valid: false,
        error: `Permission required: ${requiredPermission}`,
      };
    }

    return validation;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      valid: false,
      error: `Authentication configuration error: ${message}`,
    };
  }
}

