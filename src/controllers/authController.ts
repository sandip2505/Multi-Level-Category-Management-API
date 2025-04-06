import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import User, { IUser } from '../models/User';
import { JWT_SECRET } from '../config/constants';

// Generate JWT token
const generateToken = (userId: string): string => {
    return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '24h' });
};

export const register = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, password } = req.body;

        // Check if user exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            res.status(400).json({ message: 'User with this email already exists' });
            return;
        }

        // Create new user
        const user = new User({ email, password });
        await user.save();

        const token = generateToken(user._id.toString());

        res.status(201).json({
            message: 'User registered successfully',
            token,
            userId: user._id
        });
    } catch (error) {
        res.status(500).json({ message: 'Registration failed', error: (error as Error).message });
    }
};

export const login = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, password } = req.body;

        // Find user by email
        const user = await User.findOne({ email }) as IUser | null;

        if (!user) {
            res.status(401).json({ message: 'Invalid email or password' });
            return;
        }

        // Check password
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            res.status(401).json({ message: 'Invalid email or password' });
            return;
        }

        const token = generateToken(user._id.toString());

        res.json({
            message: 'Login successful',
            token,
            userId: user._id
        });
    } catch (error) {
        res.status(500).json({ message: 'Login failed', error: (error as Error).message });
    }
};
