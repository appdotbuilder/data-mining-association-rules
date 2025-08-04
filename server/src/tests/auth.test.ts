
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type LoginInput } from '../schema';
import { login, getCurrentUser } from '../handlers/auth';

const JWT_SECRET = process.env['JWT_SECRET'] || 'your-secret-key';

// Simple JWT verification for testing
function verifyJWT(token: string, secret: string): any {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const [encodedHeader, encodedPayload, signature] = parts;
    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = btoa(
      Array.from(
        new Uint8Array(
          new TextEncoder().encode(signatureInput + secret)
        )
      ).map(b => String.fromCharCode(b)).join('')
    );
    
    if (signature !== expectedSignature) return null;
    
    const payload = JSON.parse(atob(encodedPayload));
    const now = Math.floor(Date.now() / 1000);
    
    if (payload.exp && payload.exp < now) return null;
    
    return payload;
  } catch {
    return null;
  }
}

function createExpiredJWT(payload: any, secret: string): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const exp = now - 1; // Already expired
  
  const jwtPayload = { ...payload, iat: now, exp };
  
  const encodedHeader = btoa(JSON.stringify(header));
  const encodedPayload = btoa(JSON.stringify(jwtPayload));
  
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  const signature = btoa(
    Array.from(
      new Uint8Array(
        new TextEncoder().encode(signatureInput + secret)
      )
    ).map(b => String.fromCharCode(b)).join('')
  );
  
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

function createValidJWT(payload: any, secret: string): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 3600; // 1 hour from now
  
  const jwtPayload = { ...payload, iat: now, exp };
  
  const encodedHeader = btoa(JSON.stringify(header));
  const encodedPayload = btoa(JSON.stringify(jwtPayload));
  
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  const signature = btoa(
    Array.from(
      new Uint8Array(
        new TextEncoder().encode(signatureInput + secret)
      )
    ).map(b => String.fromCharCode(b)).join('')
  );
  
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

describe('auth handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('login', () => {
    it('should login with valid credentials', async () => {
      // Create test user with hashed password
      const hashedPassword = await Bun.password.hash('testpass123');
      await db.insert(usersTable)
        .values({
          username: 'testuser',
          password_hash: hashedPassword,
          role: 'user'
        })
        .execute();

      const input: LoginInput = {
        username: 'testuser',
        password: 'testpass123'
      };

      const result = await login(input);

      expect(result).not.toBeNull();
      expect(result!.user.username).toEqual('testuser');
      expect(result!.user.role).toEqual('user');
      expect(result!.user.id).toBeDefined();
      expect(result!.user.created_at).toBeInstanceOf(Date);
      expect(result!.token).toBeDefined();

      // Verify token structure
      const decoded = verifyJWT(result!.token, JWT_SECRET);
      expect(decoded.userId).toEqual(result!.user.id);
      expect(decoded.username).toEqual('testuser');
      expect(decoded.role).toEqual('user');
    });

    it('should return null for invalid username', async () => {
      const input: LoginInput = {
        username: 'nonexistent',
        password: 'anypassword'
      };

      const result = await login(input);
      expect(result).toBeNull();
    });

    it('should return null for invalid password', async () => {
      // Create test user
      const hashedPassword = await Bun.password.hash('correctpass');
      await db.insert(usersTable)
        .values({
          username: 'testuser',
          password_hash: hashedPassword,
          role: 'user'
        })
        .execute();

      const input: LoginInput = {
        username: 'testuser',
        password: 'wrongpassword'
      };

      const result = await login(input);
      expect(result).toBeNull();
    });

    it('should login admin user successfully', async () => {
      // Create admin user
      const hashedPassword = await Bun.password.hash('adminpass');
      await db.insert(usersTable)
        .values({
          username: 'admin',
          password_hash: hashedPassword,
          role: 'admin'
        })
        .execute();

      const input: LoginInput = {
        username: 'admin',
        password: 'adminpass'
      };

      const result = await login(input);

      expect(result).not.toBeNull();
      expect(result!.user.username).toEqual('admin');
      expect(result!.user.role).toEqual('admin');
      expect(result!.token).toBeDefined();
    });
  });

  describe('getCurrentUser', () => {
    it('should return user for valid token', async () => {
      // Create test user
      const hashedPassword = await Bun.password.hash('testpass');
      const userResult = await db.insert(usersTable)
        .values({
          username: 'testuser',
          password_hash: hashedPassword,
          role: 'user'
        })
        .returning()
        .execute();

      const user = userResult[0];

      // Login to get valid token
      const loginResult = await login({
        username: 'testuser',
        password: 'testpass'
      });

      expect(loginResult).not.toBeNull();
      const token = loginResult!.token;

      // Test getCurrentUser
      const currentUser = await getCurrentUser(token);

      expect(currentUser).not.toBeNull();
      expect(currentUser!.id).toEqual(user.id);
      expect(currentUser!.username).toEqual('testuser');
      expect(currentUser!.role).toEqual('user');
      expect(currentUser!.created_at).toBeInstanceOf(Date);
    });

    it('should return null for invalid token', async () => {
      const invalidToken = 'invalid.jwt.token';
      const result = await getCurrentUser(invalidToken);
      expect(result).toBeNull();
    });

    it('should return null for expired token', async () => {
      // Create a token that is already expired
      const expiredToken = createExpiredJWT(
        { userId: 999, username: 'test', role: 'user' },
        JWT_SECRET
      );

      const result = await getCurrentUser(expiredToken);
      expect(result).toBeNull();
    });

    it('should return null for user that no longer exists', async () => {
      // Create token for non-existent user
      const tokenForNonExistentUser = createValidJWT(
        { userId: 999999, username: 'nonexistent', role: 'user' },
        JWT_SECRET
      );

      const result = await getCurrentUser(tokenForNonExistentUser);
      expect(result).toBeNull();
    });
  });
});
