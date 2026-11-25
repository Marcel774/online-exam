import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.ts';
import { User } from '../models/User.ts';
import { ClassModel } from '../models/Class.ts';
import { Settings } from '../models/Settings.ts';
import { AppError } from '../middleware/errorHandler.ts';
import {
  clearSessionCookie,
  setSessionCookie,
  signJwtToken,
} from '../middleware/auth.ts';
import type { AuthenticatedRequest } from '../middleware/auth.ts';
import { generateUniqueCode, isValidObjectId } from '../utils/idGenerator.ts';
import { asCleanString, asValidEmail } from '../validators/input.ts';
import { ensureDefaultSettings, initializeWorkspace } from '../services/seedService.ts';

function serializeUser(user: Record<string, unknown>) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    studentId: user.studentId || null,
    teacherId: user.teacherId || null,
    phone: user.phone || '',
    profileImage: user.profileImage || '',
    classId: user.classId || null,
    assignedSubjects: user.assignedSubjects || [],
    assignedClasses: user.assignedClasses || [],
    status: user.status,
    createdAt: user.createdAt,
  };
}

export async function getSetupStatus(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    await ensureDefaultSettings();
    const adminCount = await User.countDocuments({ role: 'admin' });
    const settings = await Settings.findOne().lean();
    res.json({
      initialized: adminCount > 0,
      requiresPasscode: Boolean(env.adminBootstrapPasscode),
      allowSelfRegistration: settings?.allowSelfRegistration ?? true,
      institutionName: settings?.institutionName || 'EXAMPRO Academy',
    });
  } catch (err) {
    next(err);
  }
}

export async function bootstrapWorkspace(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const existingAdmin = await User.exists({ role: 'admin' });
    if (existingAdmin) {
      throw new AppError('Workspace administrator has already been initialized.', 403);
    }

    const adminName = asCleanString(req.body.name, 120) || 'Dr. Evelyn Mercer';
    const adminEmail = asValidEmail(req.body.email);
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const bootstrapPasscode = asCleanString(req.body.bootstrapPasscode, 120);
    const includeSampleData = req.body.includeSampleData !== false;

    if (!adminEmail) {
      throw new AppError('Please provide a valid administrator email address.', 400);
    }
    if (password.length < 6) {
      throw new AppError('Password must be at least 6 characters long.', 400);
    }

    if (env.adminBootstrapPasscode && bootstrapPasscode !== env.adminBootstrapPasscode) {
      throw new AppError('Invalid workspace initialization passcode.', 403);
    }

    const { adminUser, sampleAccounts } = await initializeWorkspace({
      adminName,
      adminEmail,
      password,
      includeSampleData,
    });

    const token = signJwtToken(adminUser._id.toString(), adminUser.role);
    setSessionCookie(req, res, token);

    const populated = await User.findById(adminUser._id).lean();
    res.status(201).json({
      token,
      user: serializeUser(populated as unknown as Record<string, unknown>),
      sampleAccounts,
    });
  } catch (err) {
    next(err);
  }
}

export async function register(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    await ensureDefaultSettings();
    const settings = await Settings.findOne().lean();
    if (settings && !settings.allowSelfRegistration) {
      throw new AppError('Self-registration is currently disabled by the administrator.', 403);
    }

    const name = asCleanString(req.body.name, 120);
    const email = asValidEmail(req.body.email);
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const phone = asCleanString(req.body.phone, 40);
    const classId = req.body.classId;

    if (!name || name.length < 2) {
      throw new AppError('Full name must be at least 2 characters.', 400);
    }
    if (!email) {
      throw new AppError('Please enter a valid email address.', 400);
    }
    if (password.length < 6) {
      throw new AppError('Password must be at least 6 characters.', 400);
    }

    const exists = await User.exists({ email });
    if (exists) {
      throw new AppError('An account with this email already exists.', 409);
    }

    let validClassId = null;
    if (classId && isValidObjectId(classId)) {
      const cls = await ClassModel.findById(classId);
      if (cls) validClassId = cls._id;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const studentId = await generateUniqueCode('student');

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: 'student',
      studentId,
      phone,
      classId: validClassId,
      profileImage: '/src/assets/images/avatar_scholar_student_1795592795326.jpg',
      status: 'active',
    });

    const token = signJwtToken(user._id.toString(), user.role);
    setSessionCookie(req, res, token);

    const populated = await User.findById(user._id).populate('classId', 'name academicYear').lean();
    res.status(201).json({
      token,
      user: serializeUser(populated as unknown as Record<string, unknown>),
    });
  } catch (err) {
    next(err);
  }
}

export async function login(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const email = asValidEmail(req.body.email);
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!email || !password) {
      throw new AppError('Email and password are required.', 400);
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      throw new AppError('Invalid email or password.', 401);
    }

    const matches = await bcrypt.compare(password, user.password);
    if (!matches) {
      throw new AppError('Invalid email or password.', 401);
    }

    if (user.status !== 'active') {
      throw new AppError('Your account is currently inactive. Contact an administrator.', 403);
    }

    const token = signJwtToken(user._id.toString(), user.role);
    setSessionCookie(req, res, token);

    const populated = await User.findById(user._id)
      .populate('classId', 'name academicYear')
      .populate('assignedClasses', 'name academicYear')
      .populate('assignedSubjects', 'name code')
      .lean();

    res.json({
      token,
      user: serializeUser(populated as unknown as Record<string, unknown>),
    });
  } catch (err) {
    next(err);
  }
}

export async function getMe(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required.', 401);
    }

    const populated = await User.findById(req.user._id)
      .populate('classId', 'name academicYear')
      .populate('assignedClasses', 'name academicYear')
      .populate('assignedSubjects', 'name code')
      .lean();

    res.json({
      user: serializeUser(populated as unknown as Record<string, unknown>),
    });
  } catch (err) {
    next(err);
  }
}

export function logout(req: Request, res: Response): void {
  clearSessionCookie(req, res);
  res.json({ message: 'Signed out successfully.' });
}

export async function forgotPassword(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const email = asValidEmail(req.body.email);
    if (!email) {
      throw new AppError('Please provide a valid email address.', 400);
    }

    const user = await User.findOne({ email });
    if (!user) {
      res.json({
        message: 'If an account matches that email, password reset instructions have been generated.',
      });
      return;
    }

    const rawToken = crypto.randomBytes(24).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    user.resetTokenHash = tokenHash;
    user.resetTokenExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await user.save();

    res.json({
      message: 'Password reset token generated. Enter your reset token and new password below.',
      resetToken: env.nodeEnv !== 'production' ? rawToken : undefined,
    });
  } catch (err) {
    next(err);
  }
}

export async function resetPassword(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = asCleanString(req.body.token, 200);
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!token) {
      throw new AppError('Reset token is required.', 400);
    }
    if (password.length < 6) {
      throw new AppError('New password must be at least 6 characters.', 400);
    }

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      resetTokenHash: tokenHash,
      resetTokenExpiresAt: { $gt: new Date() },
    }).select('+resetTokenHash +resetTokenExpiresAt');

    if (!user) {
      throw new AppError('Reset token is invalid or has expired.', 400);
    }

    user.password = await bcrypt.hash(password, 10);
    user.resetTokenHash = undefined;
    user.resetTokenExpiresAt = undefined;
    await user.save();

    res.json({ message: 'Password updated successfully. You can now sign in.' });
  } catch (err) {
    next(err);
  }
}

export async function updateProfile(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      throw new AppError('Authentication required.', 401);
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
      throw new AppError('User not found.', 404);
    }

    const name = asCleanString(req.body.name, 120);
    const phone = asCleanString(req.body.phone, 40);
    const profileImage = asCleanString(req.body.profileImage, 500);
    const currentPassword = typeof req.body.currentPassword === 'string' ? req.body.currentPassword : '';
    const newPassword = typeof req.body.newPassword === 'string' ? req.body.newPassword : '';

    if (name) user.name = name;
    if (req.body.phone !== undefined) user.phone = phone;
    if (req.body.profileImage !== undefined) {
      if (profileImage === '' || profileImage.startsWith('/') || profileImage.startsWith('https://')) {
        user.profileImage = profileImage;
      }
    }

    if (newPassword) {
      if (!currentPassword) {
        throw new AppError('Current password is required to change your password.', 400);
      }
      const ok = await bcrypt.compare(currentPassword, user.password);
      if (!ok) {
        throw new AppError('Current password is incorrect.', 400);
      }
      if (newPassword.length < 6) {
        throw new AppError('New password must be at least 6 characters.', 400);
      }
      user.password = await bcrypt.hash(newPassword, 10);
    }

    await user.save();

    const populated = await User.findById(user._id)
      .populate('classId', 'name academicYear')
      .populate('assignedClasses', 'name academicYear')
      .populate('assignedSubjects', 'name code')
      .lean();

    res.json({
      message: 'Profile updated successfully.',
      user: serializeUser(populated as unknown as Record<string, unknown>),
    });
  } catch (err) {
    next(err);
  }
}
