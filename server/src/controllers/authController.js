import * as authService from '../services/authService.js';

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export const register = asyncHandler(async (req, res) => {
  const data = await authService.registerUser(req.body);
  res.status(201).json({ success: true, message: 'User registered successfully', data });
});

export const login = asyncHandler(async (req, res) => {
  const data = await authService.loginUser(req.body);
  res.status(200).json({ success: true, message: 'Logged in successfully', data });
});
