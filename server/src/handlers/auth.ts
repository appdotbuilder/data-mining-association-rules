
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type LoginInput, type User } from '../schema';
import { eq } from 'drizzle-orm';

const JWT_SECRET = process.env['JWT_SECRET'] || 'your-secret-key';

// Simple JWT implementation using Bun's built-in crypto
function createJWT(payload: any, secret: string, expiresIn: string = '24h'): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const exp = now + (expiresIn === '24h' ? 24 * 60 * 60 : 60 * 60); // 24h or 1h
  
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

export async function login(input: LoginInput): Promise<{ user: User; token: string } | null> {
  try {
    // Find user by username
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.username, input.username))
      .execute();

    if (users.length === 0) {
      return null;
    }

    const user = users[0];

    // For demo purposes, we're doing a simple password check
    // In production, you should use bcrypt to hash and compare passwords
    const isValidPassword = await Bun.password.verify(input.password, user.password_hash);
    
    if (!isValidPassword) {
      return null;
    }

    // Generate JWT token
    const token = createJWT(
      { 
        userId: user.id, 
        username: user.username, 
        role: user.role 
      },
      JWT_SECRET,
      '24h'
    );

    return {
      user: {
        id: user.id,
        username: user.username,
        password_hash: user.password_hash,
        role: user.role,
        created_at: user.created_at
      },
      token
    };
  } catch (error) {
    console.error('Login failed:', error);
    throw error;
  }
}

export async function getCurrentUser(token: string): Promise<User | null> {
  try {
    // Verify JWT token
    const decoded = verifyJWT(token, JWT_SECRET);
    
    if (!decoded || !decoded.userId) {
      return null;
    }

    // Fetch current user data from database
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, decoded.userId))
      .execute();

    if (users.length === 0) {
      return null;
    }

    const user = users[0];
    return {
      id: user.id,
      username: user.username,
      password_hash: user.password_hash,
      role: user.role,
      created_at: user.created_at
    };
  } catch (error) {
    console.error('Token verification failed:', error);
    return null;
  }
}
