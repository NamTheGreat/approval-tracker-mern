import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { AppError } from '../errors/AppError.js';

/**
 * Sign a JWT token for an authenticated user
 * @param {Object} user - User document or payload
 * @returns {string} Signed JWT
 */
export function generateToken(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured in environment variables');
  }

  return jwt.sign(
    {
      id: user._id ? user._id.toString() : user.id,
      role: user.role,
      email: user.email,
    },
    secret,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '1d',
    }
  );
}

/**
 * Register a new user
 * @param {Object} payload - { name, email, password, role }
 */
export async function registerUser({ name, email, password, role }) {
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new AppError('User with this email already exists', 409);
  }

  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  const newUser = await User.create({
    name,
    email,
    passwordHash,
    role: role || 'employee',
  });

  const token = generateToken(newUser);

  return {
    user: {
      id: newUser._id.toString(),
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
    },
    token,
  };
}

/**
 * Authenticate existing user credentials
 * @param {Object} credentials - { email, password }
 */
export async function loginUser({ email, password }) {
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user) {
    throw new AppError('Invalid email or password', 401);
  }

  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    throw new AppError('Invalid email or password', 401);
  }

  const token = generateToken(user);

  return {
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
    },
    token,
  };
}
